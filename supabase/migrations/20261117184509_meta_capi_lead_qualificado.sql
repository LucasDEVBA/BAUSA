-- ════════════════════════════════════════════════════════════════════════
-- Migration: API de Conversões do Meta — evento LeadQualificado
-- Aplica em: public, uat, dev (gate por tabela)
-- Contexto (17/11/2026): o CEO quer "ensinar o algoritmo o que é lead bom":
--   mandar ao Meta um evento LeadQualificado só para QUENTE/MORNO, para depois
--   otimizar campanha por esse evento (e não por "Lead" bruto).
--   1. Sinais de correspondência capturados no ENVIO do formulário:
--        meta_fbp  — cookie _fbp do Pixel (navegador)
--        meta_fbc  — cookie _fbc, ou montado do fbclid da URL de entrada
--        ip_address — já existia em public (nunca preenchido); o site passa a
--                     preencher via /api/client-context. ADD IF NOT EXISTS
--                     cobre uat/dev.
--      São dados do CLIENTE (mesma natureza de user_agent/utm_*): o anon grava.
--      Sem CHECK de formato no banco de propósito — um valor estranho nunca
--      pode rejeitar o cadastro do lead; a CF meta-capi valida antes de enviar.
--   2. Envio exatamente-uma-vez pela CF meta-capi (Cloud Scheduler):
--        meta_capi_lq_sent_at    — CAS (marca ANTES de enviar; volta a NULL
--                                  só em falha, para nova tentativa)
--        meta_capi_lq_tentativas — teto de tentativas (a CF para em 5)
--        meta_capi_lq_erro       — último erro (diagnóstico, sem PII)
--      Essas três são do SERVIDOR: entram na trava de mass-assignment do anon
--      (fs_anon_campos_servidor) — senão o formulário público poderia marcar
--      o lead como "já enviado" e calar o evento.
--   3. Heartbeat meta_capi_last_tick_at (check meta_capi_frescor no monitor).
--      Seed obrigatório: PATCH em chave não semeada = 0 rows silencioso.
-- Forward-only, aditiva, idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1+2. Colunas (public, uat, dev) ────────────────────────────────────
DO $$
DECLARE
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = s AND table_name = 'form_submissions') THEN
      EXECUTE format(
        'ALTER TABLE %I.form_submissions
           ADD COLUMN IF NOT EXISTS meta_fbp text,
           ADD COLUMN IF NOT EXISTS meta_fbc text,
           ADD COLUMN IF NOT EXISTS ip_address text,
           ADD COLUMN IF NOT EXISTS meta_capi_lq_sent_at timestamptz,
           ADD COLUMN IF NOT EXISTS meta_capi_lq_tentativas integer NOT NULL DEFAULT 0,
           ADD COLUMN IF NOT EXISTS meta_capi_lq_erro text', s);
    END IF;
  END LOOP;
END $$;

-- ─── 2'. Trava de mass-assignment do anon: + colunas da CAPI ────────────
-- Corpo IDÊNTICO ao de 20261008180200_form_submissions_anon_campos_servidor
-- (mesmo comportamento para todas as colunas existentes) + o bloco "API de
-- Conversões do Meta" no fim do jsonb. Os triggers dos 3 schemas já apontam
-- para esta função — CREATE OR REPLACE basta.
CREATE OR REPLACE FUNCTION public.fs_anon_campos_servidor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  padrao jsonb;
  antigo jsonb;
BEGIN
  IF current_user <> 'anon' THEN
    RETURN NEW;
  END IF;

  padrao := jsonb_build_object(
    -- identidade / carimbos do servidor
    'id',                            gen_random_uuid(),
    'submitted_at',                  now(),
    'updated_at',                    now(),
    'processed_at',                  NULL,
    'status',                        'new',
    'deleted_at',                    NULL,
    -- classificação (qualify-lead)
    'qualified',                     NULL,
    'qualification_classification',  NULL,
    'qualification_reason',          NULL,
    'qualification_confidence',      NULL,
    'qualified_at',                  NULL,
    'qualification_pending',         false,
    'qualification_attempts',        0,
    'last_qualification_attempt_at', NULL,
    'last_qualification_error',      NULL,
    'timing_status',                 'ideal',
    'score_financeiro',              NULL,
    'tier_profissao',                NULL,
    'sinais_reforco',                NULL,
    'sinais_alerta',                 NULL,
    'prioridade_estrategica',        NULL,
    'acao_recomendada',              NULL,
    'prompt_version',                NULL,
    'desfecho_real',                 NULL,
    -- gate humano (aprovarLead / reprovarLead no Engine)
    'aprovacao_status',              NULL,
    'aprovacao_decidida_por',        NULL,
    'aprovacao_decidida_em',         NULL,
    'aprovacao_motivo',              NULL,
    -- outreach / CAS dos schedulers
    'whatsapp_sent_at',              NULL,
    'followup_1_sent_at',            NULL,
    'followup_2_sent_at',            NULL,
    'scheduled_followup_at',         NULL,
    'scheduled_followup_sent_at',    NULL,
    'reativacao_em',                 NULL,
    -- calendar-webhook / sync-leads
    'meeting_scheduled',             false,
    'meeting_scheduled_at',          NULL,
    'sheets_synced_at',              NULL
  ) || jsonb_build_object(
    -- API de Conversões do Meta (CF meta-capi) — 17/11/2026
    'meta_capi_lq_sent_at',          NULL,
    'meta_capi_lq_tentativas',       0,
    'meta_capi_lq_erro',             NULL
  );

  IF TG_OP = 'UPDATE' THEN
    antigo := to_jsonb(OLD);
    SELECT padrao || coalesce(jsonb_object_agg(chave, antigo -> chave), '{}'::jsonb)
      INTO padrao
      FROM jsonb_object_keys(padrao) AS chave
     WHERE antigo ? chave
       AND chave <> 'updated_at'
       AND NOT (chave = 'deleted_at' AND to_jsonb(NEW) -> 'deleted_at' = 'null'::jsonb);
  END IF;

  NEW := jsonb_populate_record(NEW, padrao);
  RETURN NEW;
END;
$$;

-- ─── 3. Heartbeat da CF meta-capi ───────────────────────────────────────
DO $$
DECLARE
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = s AND table_name = 'configuracoes_sistema') THEN
      EXECUTE format(
        'INSERT INTO %I.configuracoes_sistema (chave, valor, descricao, editavel_ceo)
         VALUES (%L, %L::jsonb, %L, false)
         ON CONFLICT (chave) DO NOTHING',
        s,
        'meta_capi_last_tick_at',
        '{}',
        'Heartbeat da API de Conversões do Meta (meta-capi): {at, configurado, enviados, falhas, pendentes} por tick. Vazio = nunca rodou. Check meta_capi_frescor.'
      );
    END IF;
  END LOOP;
END $$;
