-- ════════════════════════════════════════════════════════════════════════
-- Migration: proteção de mass-assignment no INSERT anônimo de form_submissions
-- Aplica em: public, uat, dev (gate por tabela)   [T23-S2 — endurecimento]
-- Contexto (achado na análise do T23): o formulário público posta direto no
--   PostgREST com a anon key, e a policy de INSERT do anon é WITH CHECK (true)
--   com grant em TODAS as colunas. Qualquer pessoa com a anon key (pública,
--   está no bundle do site) consegue inserir um lead já com
--   aprovacao_status='aprovado' — e o qualify-lead PRESERVA decisão humana
--   ('aprovado'/'reprovado') → o lead pularia o gate humano e entraria no
--   outreach automático (WhatsApp do nosso número para um telefone qualquer).
-- Correção: para INSERT feito pelo role `anon`, as colunas que SÓ o servidor
--   escreve voltam ao default (classificação, aprovação, carimbos de envio,
--   reunião, sinais do classificador, sync...). O formulário NUNCA envia esses
--   campos (conferido em FormsPage.onSubmit) → zero mudança para o fluxo real.
-- jsonb_populate_record(NEW, ...) ignora chaves que não existem na tabela →
--   a mesma função serve aos 3 schemas mesmo se um deles divergir.
-- service_role (CFs) e authenticated (Engine) não passam por aqui.
-- Idempotente: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fs_anon_campos_servidor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user <> 'anon' THEN
    RETURN NEW;
  END IF;

  NEW := jsonb_populate_record(NEW, jsonb_build_object(
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
  ));

  RETURN NEW;
END;
$$;

-- ─── PUBLIC (PRD) ───
DROP TRIGGER IF EXISTS fs_anon_campos_servidor_trg ON public.form_submissions;
CREATE TRIGGER fs_anon_campos_servidor_trg
  BEFORE INSERT ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.fs_anon_campos_servidor();

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'uat' AND table_name = 'form_submissions') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS fs_anon_campos_servidor_trg ON uat.form_submissions';
    EXECUTE 'CREATE TRIGGER fs_anon_campos_servidor_trg
             BEFORE INSERT ON uat.form_submissions
             FOR EACH ROW EXECUTE FUNCTION public.fs_anon_campos_servidor()';
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'dev' AND table_name = 'form_submissions') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS fs_anon_campos_servidor_trg ON dev.form_submissions';
    EXECUTE 'CREATE TRIGGER fs_anon_campos_servidor_trg
             BEFORE INSERT ON dev.form_submissions
             FOR EACH ROW EXECUTE FUNCTION public.fs_anon_campos_servidor()';
  END IF;
END $$;
