-- ============================================================
-- Migration: Cria schemas UAT e DEV isolados do public (PRD)
-- Cada ambiente tem sua própria tabela form_submissions,
-- impedindo que dados de teste contaminem produção.
-- ============================================================

-- ── Função update_updated_at_column (se não existir) ────────────
-- Criada aqui para garantir existência mesmo em ambientes fresh.
-- O public.form_submissions provavelmente já a usa, mas pode ter
-- sido criada manualmente sem migration.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Schema UAT (User Acceptance Testing) ───────────────────────
CREATE SCHEMA IF NOT EXISTS uat;

-- Replica a estrutura completa da tabela de produção
CREATE TABLE IF NOT EXISTS uat.form_submissions
  (LIKE public.form_submissions INCLUDING ALL);

-- Trigger de updated_at (mesma função do public)
CREATE OR REPLACE TRIGGER update_uat_form_submissions_updated_at
  BEFORE UPDATE ON uat.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para queries de fila (whatsapp, follow-ups, qualificação)
CREATE INDEX IF NOT EXISTS uat_fs_email_idx
  ON uat.form_submissions (email);
CREATE INDEX IF NOT EXISTS uat_fs_status_idx
  ON uat.form_submissions (status);
CREATE INDEX IF NOT EXISTS uat_fs_classification_idx
  ON uat.form_submissions (qualification_classification);
CREATE INDEX IF NOT EXISTS uat_fs_qualified_at_idx
  ON uat.form_submissions (qualified_at);
CREATE INDEX IF NOT EXISTS uat_fs_whatsapp_sent_at_idx
  ON uat.form_submissions (whatsapp_sent_at);
CREATE INDEX IF NOT EXISTS uat_fs_followup_1_idx
  ON uat.form_submissions (followup_1_sent_at);
CREATE INDEX IF NOT EXISTS uat_fs_followup_2_idx
  ON uat.form_submissions (followup_2_sent_at);
CREATE INDEX IF NOT EXISTS uat_fs_meeting_scheduled_idx
  ON uat.form_submissions (meeting_scheduled);

-- RLS: mesma política do public
ALTER TABLE uat.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_can_insert_uat"
  ON uat.form_submissions
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "service_role_full_access_uat"
  ON uat.form_submissions
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Schema DEV ─────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS dev;

-- Replica a estrutura completa da tabela de produção
CREATE TABLE IF NOT EXISTS dev.form_submissions
  (LIKE public.form_submissions INCLUDING ALL);

-- Trigger de updated_at
CREATE OR REPLACE TRIGGER update_dev_form_submissions_updated_at
  BEFORE UPDATE ON dev.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices mínimos para dev
CREATE INDEX IF NOT EXISTS dev_fs_email_idx
  ON dev.form_submissions (email);
CREATE INDEX IF NOT EXISTS dev_fs_classification_idx
  ON dev.form_submissions (qualification_classification);
CREATE INDEX IF NOT EXISTS dev_fs_whatsapp_sent_at_idx
  ON dev.form_submissions (whatsapp_sent_at);

-- RLS: mesma política do public
ALTER TABLE dev.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_can_insert_dev"
  ON dev.form_submissions
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "service_role_full_access_dev"
  ON dev.form_submissions
  TO service_role
  USING (true)
  WITH CHECK (true);
