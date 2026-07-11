-- ════════════════════════════════════════════════════════════
-- Migration: Fases da jornada da família configuráveis pelo CEO
-- Aplica em: public (PRD) direto + uat/dev via DO blocks gateados
-- Contexto:
--   • Nova chave `fases_familia_config` em configuracoes_sistema —
--     overrides por fase (rótulo, descrição, ordem de exibição, dias
--     de alerta). `{}` = defaults do código (fail-open). O enum PG
--     `fase_experiencia` NÃO muda — só a apresentação/alerta.
--   • `familias_em_alerta_inatividade()` passa a ler os thresholds da
--     chave seed `inatividade_por_fase` (até aqui ninguém lia a chave;
--     os dias estavam hardcoded 2x no corpo da função — migration
--     20260401001400). Valor ausente/inválido → defaults históricos:
--     admissao=7, pre_embarque=15, embarcado_inicial=7,
--     acompanhamento=30. `aprovado` e `encerrado` continuam excluídas.
--   • Contrato de retorno da função preservado EXATAMENTE
--     (experiencia_id, atleta_nome, dias, fase, threshold).
-- Idempotente: ON CONFLICT DO NOTHING + CREATE OR REPLACE.
-- ════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD): seed idempotente da chave de overrides ───
INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
VALUES (
  'fases_familia_config',
  '{}'::jsonb,
  'Overrides das fases da jornada da família (rótulo, descrição, ordem de exibição e dias de alerta por fase). Vazio = padrões do código. Formato: {"admissao": {"label": "Admissão", "description": "...", "order": 0, "alertDays": 7}}. Os valores internos das fases (enum) não mudam.'
)
ON CONFLICT (chave) DO NOTHING;

-- ─── PUBLIC (PRD): função de alerta lê inatividade_por_fase ───
-- A função existe apenas no schema public (o Engine sempre chama via
-- public — confirmação: única definição em 20260401001400, sem DO
-- blocks para uat/dev). Threshold só é aceito se for inteiro 1..365;
-- qualquer outro valor (ausente, não-numérico, fora da faixa) cai no
-- default histórico da fase — fail-open, nunca quebra o alerta.
CREATE OR REPLACE FUNCTION public.familias_em_alerta_inatividade()
RETURNS TABLE(
  experiencia_id UUID,
  atleta_nome TEXT,
  dias INT,
  fase TEXT,
  threshold INT
) AS $$
  WITH cfg AS (
    SELECT cs.valor
    FROM configuracoes_sistema cs
    WHERE cs.chave = 'inatividade_por_fase'
      AND jsonb_typeof(cs.valor) = 'object'
    LIMIT 1
  ),
  th AS (
    SELECT
      CASE WHEN (SELECT c.valor->>'admissao' FROM cfg c) ~ '^[0-9]{1,3}$'
             AND ((SELECT c.valor->>'admissao' FROM cfg c))::INT BETWEEN 1 AND 365
           THEN ((SELECT c.valor->>'admissao' FROM cfg c))::INT
           ELSE 7 END AS admissao,
      CASE WHEN (SELECT c.valor->>'pre_embarque' FROM cfg c) ~ '^[0-9]{1,3}$'
             AND ((SELECT c.valor->>'pre_embarque' FROM cfg c))::INT BETWEEN 1 AND 365
           THEN ((SELECT c.valor->>'pre_embarque' FROM cfg c))::INT
           ELSE 15 END AS pre_embarque,
      CASE WHEN (SELECT c.valor->>'embarcado_inicial' FROM cfg c) ~ '^[0-9]{1,3}$'
             AND ((SELECT c.valor->>'embarcado_inicial' FROM cfg c))::INT BETWEEN 1 AND 365
           THEN ((SELECT c.valor->>'embarcado_inicial' FROM cfg c))::INT
           ELSE 7 END AS embarcado_inicial,
      CASE WHEN (SELECT c.valor->>'acompanhamento' FROM cfg c) ~ '^[0-9]{1,3}$'
             AND ((SELECT c.valor->>'acompanhamento' FROM cfg c))::INT BETWEEN 1 AND 365
           THEN ((SELECT c.valor->>'acompanhamento' FROM cfg c))::INT
           ELSE 30 END AS acompanhamento
  )
  SELECT
    ce.id,
    a.nome_completo,
    EXTRACT(DAY FROM NOW() - ce.data_ultimo_contato)::INT,
    ce.fase::TEXT,
    CASE ce.fase::TEXT
      WHEN 'admissao'          THEN th.admissao
      WHEN 'pre_embarque'      THEN th.pre_embarque
      WHEN 'embarcado_inicial' THEN th.embarcado_inicial
      WHEN 'acompanhamento'    THEN th.acompanhamento
      ELSE 30
    END
  FROM crm_experiencia ce
  JOIN atletas a ON a.id = ce.atleta_id
  CROSS JOIN th
  WHERE ce.deleted_at IS NULL
  AND ce.fase NOT IN ('encerrado', 'aprovado')
  AND ce.data_ultimo_contato IS NOT NULL
  AND EXTRACT(DAY FROM NOW() - ce.data_ultimo_contato) >
    CASE ce.fase::TEXT
      WHEN 'admissao'          THEN th.admissao
      WHEN 'pre_embarque'      THEN th.pre_embarque
      WHEN 'embarcado_inicial' THEN th.embarcado_inicial
      WHEN 'acompanhamento'    THEN th.acompanhamento
      ELSE 30
    END
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Hardening: a definição ORIGINAL (20260401001400) ficou exposta a anon via
-- PostgREST (SECURITY DEFINER + EXECUTE default a PUBLIC) — sonda em produção
-- confirmou HTTP 200 com a anon key, vazando nomes de famílias. O Engine chama
-- sempre autenticado (listarAlertasInatividade), então fechar p/ anon é seguro.
REVOKE EXECUTE ON FUNCTION public.familias_em_alerta_inatividade() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.familias_em_alerta_inatividade() TO authenticated, service_role;

COMMENT ON FUNCTION public.familias_em_alerta_inatividade() IS
  'Retorna famílias com dias sem contato acima do threshold por fase. Thresholds lidos de configuracoes_sistema.inatividade_por_fase (fallback: admissao=7, pre_embarque=15, embarcado_inicial=7, acompanhamento=30).';

-- ─── UAT: seed da chave (gateado — schema pode não ter a tabela) ───
DO $$
BEGIN
  IF to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    INSERT INTO uat.configuracoes_sistema (chave, valor, descricao)
    VALUES (
      'fases_familia_config',
      '{}'::jsonb,
      'Overrides das fases da jornada da família (rótulo, descrição, ordem de exibição e dias de alerta por fase). Vazio = padrões do código. Formato: {"admissao": {"label": "Admissão", "description": "...", "order": 0, "alertDays": 7}}. Os valores internos das fases (enum) não mudam.'
    )
    ON CONFLICT (chave) DO NOTHING;
  END IF;
END $$;

-- ─── DEV: seed da chave (gateado — schema pode não ter a tabela) ───
DO $$
BEGIN
  IF to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN
    INSERT INTO dev.configuracoes_sistema (chave, valor, descricao)
    VALUES (
      'fases_familia_config',
      '{}'::jsonb,
      'Overrides das fases da jornada da família (rótulo, descrição, ordem de exibição e dias de alerta por fase). Vazio = padrões do código. Formato: {"admissao": {"label": "Admissão", "description": "...", "order": 0, "alertDays": 7}}. Os valores internos das fases (enum) não mudam.'
    )
    ON CONFLICT (chave) DO NOTHING;
  END IF;
END $$;
