-- ════════════════════════════════════════════════════════════════════════
-- Migration: Banco de Escolas — campo opcional `perfil` + view de histórico
--            BAUSA por escola (T15/T16/T22 — vídeo do CEO 28/09/2026)
-- Aplica em: public. Gate POR TABELA em public/uat/dev: escolas,
--            estrategia_escolas e atletas só existem em public (uat/dev são
--            incompletos — gatear por schemata quebra o deploy com 42P01).
--
-- 1. escolas.perfil (TEXT + CHECK, NULLABLE, sem default): perfil da high
--    school, preenchido por PESSOA pela tela /escolas. Nunca deduzido por IA
--    (a desconfiança do CEO nasceu exatamente de classificação inventada).
--    NULL = "Não classificado". Não entra no calcular_match_score.
-- 2. View escolas_historico_bausa (security_invoker): histórico REAL por
--    escola derivado de estrategia_escolas — substitui na tela as colunas
--    mortas total_aplicados/total_aceitos/bolsa_media_obtida/
--    tempo_medio_resposta (que nenhum código alimenta). As colunas antigas
--    ficam INTOCADAS: calcular_match_score lê total_aplicados/taxa_aceitacao
--    e o score não pode mudar.
--
-- Compatibilidade com o código antigo (main roda até a promoção):
--   - coluna nova NULLABLE sem default → SELECT * antigo só ganha um campo
--     que ignora; UPDATE antigo não a envia; INSERT antigo grava NULL.
--   - view nova não é lida pelo código antigo.
-- Idempotente: ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE VIEW.
-- ════════════════════════════════════════════════════════════════════════

DO $mig$
DECLARE
  _schema TEXT;
BEGIN
  FOREACH _schema IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP

    -- ─── 1. escolas.perfil ────────────────────────────────────────────
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = _schema AND table_name = 'escolas'
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I.escolas ADD COLUMN IF NOT EXISTS perfil TEXT '
        || 'CONSTRAINT escolas_perfil_check CHECK (perfil IS NULL OR perfil IN ('
        || '''academia_esportiva'', ''prep_tradicional'', ''religiosa'', '
        || '''boarding_internacional'', ''outro''))',
        _schema
      );
      EXECUTE format(
        'COMMENT ON COLUMN %I.escolas.perfil IS %L',
        _schema,
        'Perfil da high school (academia_esportiva | prep_tradicional | religiosa | '
        || 'boarding_internacional | outro). Preenchido por pessoa em /escolas — nunca '
        || 'deduzido por IA. NULL = não classificado. Não afeta calcular_match_score.'
      );
    END IF;

    -- ─── 2. View de histórico BAUSA por escola ────────────────────────
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = _schema AND table_name = 'estrategia_escolas')
       AND EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = _schema AND table_name = 'atletas')
    THEN
      -- Buckets MUTUAMENTE EXCLUSIVOS (somam atletas_total), sobre os valores
      -- reais dos CHECKs: resultado ∈ {aceito, recusado, waitlist, pendente,
      -- nao_aplicado}; status ∈ {pre_acordada, rede_ativa, planejamento,
      -- observacao_futura}.
      --   aceitos         = resultado 'aceito'
      --   recusados       = resultado 'recusado'
      --   em_andamento    = resultado 'pendente'/'waitlist', OU ainda não
      --                     aplicado mas com vaga pré-acordada
      --   em_planejamento = não aplicado e sem pré-acordo
      -- Atleta soft-deleted sai da conta (o JOIN filtra; sob security_invoker
      -- a RLS de atletas já esconde, o filtro explícito vale p/ service_role).
      EXECUTE format($view$
        CREATE OR REPLACE VIEW %1$I.escolas_historico_bausa
        WITH (security_invoker = true) AS
        SELECT
          es.escola_id,
          count(*)::int AS atletas_total,
          count(*) FILTER (WHERE es.resultado = 'aceito')::int AS aceitos,
          count(*) FILTER (WHERE es.resultado = 'recusado')::int AS recusados,
          count(*) FILTER (
            WHERE es.resultado IN ('pendente', 'waitlist')
               OR (es.resultado = 'nao_aplicado' AND es.status = 'pre_acordada')
          )::int AS em_andamento,
          count(*) FILTER (
            WHERE es.resultado = 'nao_aplicado' AND es.status <> 'pre_acordada'
          )::int AS em_planejamento,
          count(es.bolsa_obtida_pct) FILTER (WHERE es.resultado = 'aceito')::int
            AS bolsas_informadas,
          sum(es.bolsa_obtida_pct) FILTER (WHERE es.resultado = 'aceito')
            AS bolsa_obtida_pct_soma,
          round(avg(es.bolsa_obtida_pct) FILTER (WHERE es.resultado = 'aceito'), 1)
            AS bolsa_media_obtida_pct
        FROM %1$I.estrategia_escolas es
        JOIN %1$I.atletas a ON a.id = es.atleta_id AND a.deleted_at IS NULL
        WHERE es.deleted_at IS NULL
        GROUP BY es.escola_id
      $view$, _schema);

      EXECUTE format(
        'COMMENT ON VIEW %I.escolas_historico_bausa IS %L',
        _schema,
        'Histórico BAUSA por escola derivado de estrategia_escolas (fonte única dos '
        || 'cards/KPIs de /escolas). security_invoker: respeita a RLS de quem consulta.'
      );

      -- Somente leitura. A view agregada não é atualizável de qualquer forma,
      -- mas não deixamos os privilégios DML herdados do default do schema.
      EXECUTE format(
        'REVOKE ALL ON %I.escolas_historico_bausa FROM PUBLIC, anon, authenticated',
        _schema
      );
      EXECUTE format(
        'GRANT SELECT ON %I.escolas_historico_bausa TO authenticated, service_role',
        _schema
      );
    END IF;

  END LOOP;
END
$mig$;

NOTIFY pgrst, 'reload schema';
