-- ════════════════════════════════════════════════════════════════════════
-- Migration: Tabela reunioes_transcricoes (Transcrição do Google Meet — J2)
-- Aplica em todos os schemas (public, uat, dev)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   O CEO usa a transcrição nativa do Google Meet (Workspace) nas reuniões
--   com leads. A transcrição vira um Google Doc anexado ao evento do
--   Calendar minutos/horas após a reunião. A Cloud Function
--   meeting-transcripts (cron a cada 2h) detecta o anexo, exporta o texto
--   via Drive API e persiste aqui (+ resumo opcional via Gemini). A UI do
--   Engine exibe o registro no detalhe do lead (LeadDetailModal) e do deal
--   (DealDetailModal → seção Reunião).
--
-- Padrão: RLS por papel + DO blocks multi-schema com guards
--   (espelho de 20260604220112_create_investimentos_marketing e do guard
--   to_regclass de 20260703232151_automacoes_builder — deals precisa
--   existir no schema para a FK).
--
-- Idempotência de captura: UNIQUE(google_event_id) — o INSERT da CF em
--   evento já capturado retorna 409 e é tratado como sucesso (skip).
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC SCHEMA (PRD) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reunioes_transcricoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             UUID REFERENCES public.deals(id),
  form_submission_id  UUID,
  google_event_id     TEXT NOT NULL,
  doc_url             TEXT,
  transcript_text     TEXT,
  resumo              TEXT,
  capturada_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_reunioes_transcricoes_event UNIQUE (google_event_id)
);

COMMENT ON TABLE public.reunioes_transcricoes IS
  'Transcrições do Google Meet capturadas automaticamente pela CF meeting-transcripts (Doc anexado ao evento do Calendar → Drive export text/plain). resumo = síntese Gemini opcional. UNIQUE(google_event_id) garante idempotência.';
COMMENT ON COLUMN public.reunioes_transcricoes.google_event_id IS
  'ID do evento no Google Calendar (mesmo valor de deals.google_calendar_event_id).';
COMMENT ON COLUMN public.reunioes_transcricoes.form_submission_id IS
  'Lead de origem (form_submissions.id) — sem FK porque form_submissions vive por schema e o vínculo é informativo.';

-- Trigger updated_at (função compartilhada)
DROP TRIGGER IF EXISTS trg_reunioes_transcricoes_updated_at ON public.reunioes_transcricoes;
CREATE TRIGGER trg_reunioes_transcricoes_updated_at
  BEFORE UPDATE ON public.reunioes_transcricoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger de auditoria (função genérica audit.log_change)
DROP TRIGGER IF EXISTS trg_audit_reunioes_transcricoes ON public.reunioes_transcricoes;
CREATE TRIGGER trg_audit_reunioes_transcricoes
  AFTER INSERT OR UPDATE OR DELETE ON public.reunioes_transcricoes
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- Índices de leitura (UI busca por deal e por lead)
CREATE INDEX IF NOT EXISTS idx_reunioes_transcricoes_deal
  ON public.reunioes_transcricoes (deal_id);
CREATE INDEX IF NOT EXISTS idx_reunioes_transcricoes_form_submission
  ON public.reunioes_transcricoes (form_submission_id);

-- RLS: transcrições de reuniões comerciais são sensíveis → SELECT só nível
-- CEO (get_user_papel resolve cto→ceo); escrita fica com a service_role (CF).
ALTER TABLE public.reunioes_transcricoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reunioes_transcricoes_select_ceo" ON public.reunioes_transcricoes;
CREATE POLICY "reunioes_transcricoes_select_ceo" ON public.reunioes_transcricoes
  FOR SELECT TO authenticated
  USING (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "reunioes_transcricoes_service" ON public.reunioes_transcricoes;
CREATE POLICY "reunioes_transcricoes_service" ON public.reunioes_transcricoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─── UAT SCHEMA ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.deals') IS NOT NULL THEN

    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.reunioes_transcricoes (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id             UUID REFERENCES uat.deals(id),
        form_submission_id  UUID,
        google_event_id     TEXT NOT NULL,
        doc_url             TEXT,
        transcript_text     TEXT,
        resumo              TEXT,
        capturada_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_reunioes_transcricoes_event UNIQUE (google_event_id)
      )';

    EXECUTE 'DROP TRIGGER IF EXISTS trg_reunioes_transcricoes_updated_at ON uat.reunioes_transcricoes';
    EXECUTE 'CREATE TRIGGER trg_reunioes_transcricoes_updated_at
      BEFORE UPDATE ON uat.reunioes_transcricoes
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';

    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_reunioes_transcricoes ON uat.reunioes_transcricoes';
    EXECUTE 'CREATE TRIGGER trg_audit_reunioes_transcricoes
      AFTER INSERT OR UPDATE OR DELETE ON uat.reunioes_transcricoes
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reunioes_transcricoes_deal
      ON uat.reunioes_transcricoes (deal_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reunioes_transcricoes_form_submission
      ON uat.reunioes_transcricoes (form_submission_id)';

    EXECUTE 'ALTER TABLE uat.reunioes_transcricoes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "reunioes_transcricoes_select_ceo" ON uat.reunioes_transcricoes';
    EXECUTE 'CREATE POLICY "reunioes_transcricoes_select_ceo" ON uat.reunioes_transcricoes
      FOR SELECT TO authenticated
      USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "reunioes_transcricoes_service" ON uat.reunioes_transcricoes';
    EXECUTE 'CREATE POLICY "reunioes_transcricoes_service" ON uat.reunioes_transcricoes
      FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;


-- ─── DEV SCHEMA ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.deals') IS NOT NULL THEN

    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.reunioes_transcricoes (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id             UUID REFERENCES dev.deals(id),
        form_submission_id  UUID,
        google_event_id     TEXT NOT NULL,
        doc_url             TEXT,
        transcript_text     TEXT,
        resumo              TEXT,
        capturada_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_reunioes_transcricoes_event UNIQUE (google_event_id)
      )';

    EXECUTE 'DROP TRIGGER IF EXISTS trg_reunioes_transcricoes_updated_at ON dev.reunioes_transcricoes';
    EXECUTE 'CREATE TRIGGER trg_reunioes_transcricoes_updated_at
      BEFORE UPDATE ON dev.reunioes_transcricoes
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';

    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_reunioes_transcricoes ON dev.reunioes_transcricoes';
    EXECUTE 'CREATE TRIGGER trg_audit_reunioes_transcricoes
      AFTER INSERT OR UPDATE OR DELETE ON dev.reunioes_transcricoes
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reunioes_transcricoes_deal
      ON dev.reunioes_transcricoes (deal_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reunioes_transcricoes_form_submission
      ON dev.reunioes_transcricoes (form_submission_id)';

    EXECUTE 'ALTER TABLE dev.reunioes_transcricoes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "reunioes_transcricoes_select_ceo" ON dev.reunioes_transcricoes';
    EXECUTE 'CREATE POLICY "reunioes_transcricoes_select_ceo" ON dev.reunioes_transcricoes
      FOR SELECT TO authenticated
      USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "reunioes_transcricoes_service" ON dev.reunioes_transcricoes';
    EXECUTE 'CREATE POLICY "reunioes_transcricoes_service" ON dev.reunioes_transcricoes
      FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
