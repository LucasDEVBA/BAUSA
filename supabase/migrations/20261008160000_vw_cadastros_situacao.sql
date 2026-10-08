-- ════════════════════════════════════════════════════════════════════════
-- Migration: Visibilidade de cadastros — view de situação + busca sem acento
-- (T7 colunas Frios/Incompletos, T8 /leads paginada, T13 busca do Pipeline —
-- vídeos do CEO de 28/09) | public; uat/dev só se tiverem atletas+deals
-- ════════════════════════════════════════════════════════════════════════
--
-- POR QUÊ
--   1. A coluna Frios aplicava .limit(80) ANTES de excluir quem tem deal (o
--      filtro de deal era feito no Node, sobre o embed). 194 FRIOs elegíveis,
--      80 visíveis: 114 sumiam do board e da busca (Clara: FRIO com reunião).
--      A exclusão "tem deal ativo" precisa acontecer NO BANCO, antes do
--      LIMIT/RANGE — esta view expõe `tem_deal_ativo` para isso.
--   2. /leads lia form_submissions inteiro (select *) e o PostgREST corta em
--      max_rows=1000 (909 ativos em 08/10, +~250/mês). Paginação no servidor
--      precisa ordenar/filtrar por campos derivados (etapa do deal, origem,
--      comunicação) e buscar sem acento — tudo aqui, numa fonte só.
--   3. A busca do Pipeline precisa dizer ONDE o lead está (deal/etapa,
--      decisão, classe, janela) — a view entrega os fatos; a regra de
--      exibição fica em TS (apps/crm/src/lib/revisao-leads.ts), uma fonte só.
--
-- SEGURANÇA
--   - security_invoker = true: a view roda com o RLS de QUEM consulta
--     (form_submissions/atletas/deals) — nunca vira bypass de RLS.
--   - REVOKE de anon/PUBLIC: só authenticated/service_role leem. As server
--     actions ainda exigem papel CEO (getUserPapel) — defesa em profundidade.
--
-- ROLLOUT (código antigo continua funcionando)
--   Puramente ADITIVA: extensão + função + view nova. Nenhuma coluna, tabela,
--   policy ou trigger existente muda; nada no caminho de ESCRITA do
--   form_submissions (o formulário público e as CFs não passam por aqui —
--   por isso NÃO há índice de expressão em form_submissions: um erro na
--   função de normalização jamais pode derrubar a captação de lead).
--
-- FORWARD-ONLY: CREATE OR REPLACE VIEW só ACRESCENTA colunas no fim. Para
-- mudar/remover coluna da view, nova migration com DROP VIEW + CREATE.
--
-- DEPENDÊNCIA (atenção em migrations FUTURAS): a view prende as colunas que
-- lê de form_submissions/atletas/deals. ALTER COLUMN ... TYPE ou DROP COLUMN
-- numa delas FALHA ("cannot alter type of a column used by a view") — a
-- migration que fizer isso precisa DROP VIEW antes e recriar esta view
-- depois, na MESMA migration. ADD COLUMN, CHECK e ADD VALUE em enum não são
-- afetados.
-- ════════════════════════════════════════════════════════════════════════

-- unaccent: disponível no Supabase, ainda não instalado (conferido em 08/10).
-- Schema extensions (padrão Supabase; está no db_extra_search_path).
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- Normalização de busca: minúsculas + sem acento. STABLE (o dicionário do
-- unaccent pode mudar) e search_path vazio (nomes totalmente qualificados).
-- O lado TS normaliza o termo com a MESMA regra (NFD + remove diacríticos +
-- lower) em apps/crm/src/lib/revisao-leads.ts → normalizarTermoBusca().
CREATE OR REPLACE FUNCTION public.f_normalizar_busca(p_texto text)
RETURNS text
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = ''
AS $fn$
  SELECT pg_catalog.lower(
    extensions.unaccent('extensions.unaccent'::regdictionary, COALESCE(p_texto, ''))
  );
$fn$;

COMMENT ON FUNCTION public.f_normalizar_busca(text) IS
  'Busca sem acento (T13): lower(unaccent(texto)). Par do normalizarTermoBusca() do Engine.';

REVOKE ALL ON FUNCTION public.f_normalizar_busca(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.f_normalizar_busca(text) TO authenticated, service_role;

-- View de situação do cadastro: 1 linha por form_submission NÃO excluído,
-- com o deal ativo mais recente (se houver) e as colunas de busca.
-- Gate POR TABELA (uat/dev hoje só têm form_submissions — sem atletas/deals
-- a view não faz sentido; o Engine lê public em todo ambiente).
DO $mig$
DECLARE
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    IF to_regclass(format('%I.form_submissions', s)) IS NULL
       OR to_regclass(format('%I.atletas', s)) IS NULL
       OR to_regclass(format('%I.deals', s)) IS NULL THEN
      RAISE NOTICE 'vw_cadastros_situacao: schema % sem form_submissions/atletas/deals — pulado', s;
      CONTINUE;
    END IF;

    EXECUTE format($v$
      CREATE OR REPLACE VIEW %1$I.vw_cadastros_situacao
      WITH (security_invoker = true) AS
      SELECT
        fs.id,
        fs.submitted_at,
        fs.athlete_name,
        fs.email,
        fs.guardian_name,
        fs.city_state,
        fs.position,
        fs.address_state,
        fs.investment_range,
        fs.qualification_classification,
        fs.qualification_reason,
        fs.score_financeiro,
        fs.timing_status,
        fs.aprovacao_status,
        fs.aprovacao_decidida_em,
        fs.aprovacao_motivo,
        fs.meeting_scheduled,
        fs.meeting_scheduled_at,
        fs.whatsapp_sent_at,
        fs.followup_1_sent_at,
        fs.followup_2_sent_at,
        fs.utm_source,
        fs.cta_source,
        fs.device_type,
        fs.athlete_whatsapp,
        fs.guardian_whatsapp,
        -- Ordenações de /leads que antes eram calculadas no navegador
        COALESCE(NULLIF(fs.utm_source, ''), NULLIF(fs.cta_source, '')) AS origem,
        CASE
          WHEN fs.meeting_scheduled THEN 4
          WHEN fs.followup_2_sent_at IS NOT NULL THEN 3
          WHEN fs.followup_1_sent_at IS NOT NULL THEN 2
          WHEN fs.whatsapp_sent_at IS NOT NULL THEN 1
          ELSE 0
        END AS comunicacao_etapa,
        -- Duplicata por WhatsApp do responsável (mesma regra do /leads antigo)
        NULLIF(regexp_replace(COALESCE(fs.guardian_whatsapp, ''), '\D', '', 'g'), '')
          AS telefone_resp_digitos,
        -- Busca sem acento: atleta, responsáveis e e-mails
        public.f_normalizar_busca(
          COALESCE(fs.athlete_name, '') || ' ' ||
          COALESCE(fs.guardian_name, '') || ' ' ||
          COALESCE(fs.guardian_name_2, '') || ' ' ||
          COALESCE(fs.email, '') || ' ' ||
          COALESCE(fs.guardian_email, '') || ' ' ||
          COALESCE(fs.guardian_email_2, '')
        ) AS busca_texto,
        -- Busca por telefone: só dígitos, um bloco por número
        regexp_replace(COALESCE(fs.athlete_whatsapp, ''), '\D', '', 'g') || ' ' ||
        regexp_replace(COALESCE(fs.guardian_whatsapp, ''), '\D', '', 'g') || ' ' ||
        regexp_replace(COALESCE(fs.guardian_whatsapp_2, ''), '\D', '', 'g')
          AS busca_telefone,
        a.atleta_id,
        a.responsavel_id,
        d.deal_id,
        d.deal_etapa,
        d.deal_motivo_perda,
        COALESCE(d.deals_ativos, 0)::int AS deals_ativos,
        (d.deal_id IS NOT NULL) AS tem_deal_ativo
      FROM %1$I.form_submissions fs
      LEFT JOIN LATERAL (
        -- UNIQUE(form_submission_id) garante no máximo 1 atleta
        SELECT at.id AS atleta_id, at.responsavel_id
        FROM %1$I.atletas at
        WHERE at.form_submission_id = fs.id
          AND at.deleted_at IS NULL
        LIMIT 1
      ) a ON true
      LEFT JOIN LATERAL (
        -- deals.atleta_id NÃO é único: pega o ativo mais recente e conta todos
        SELECT dl.id AS deal_id,
               dl.etapa::text AS deal_etapa,
               dl.motivo_perda::text AS deal_motivo_perda,
               count(*) OVER () AS deals_ativos
        FROM %1$I.deals dl
        WHERE dl.atleta_id = a.atleta_id
          AND dl.deleted_at IS NULL
        ORDER BY dl.updated_at DESC, dl.id DESC
        LIMIT 1
      ) d ON true
      WHERE fs.deleted_at IS NULL
    $v$, s);

    -- Default privileges do Supabase dão ALL a anon/authenticated em objeto
    -- novo do public: zera e devolve SÓ leitura (view de consulta).
    EXECUTE format('REVOKE ALL ON %I.vw_cadastros_situacao FROM PUBLIC, anon, authenticated', s);
    EXECUTE format('GRANT SELECT ON %I.vw_cadastros_situacao TO authenticated, service_role', s);
    EXECUTE format(
      'COMMENT ON VIEW %I.vw_cadastros_situacao IS %L', s,
      'Situação de cada cadastro não excluído (deal ativo, decisão, busca sem acento). '
      'security_invoker: respeita o RLS de quem consulta. Usada por /pipeline (Frios, '
      'Incompletos, busca) e /leads (paginação no servidor).'
    );
  END LOOP;
END $mig$;
