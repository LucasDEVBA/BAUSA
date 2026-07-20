-- ════════════════════════════════════════════════════════════════════
-- Migration: F2 observabilidade — sinais dos fluxos que não deixavam rastro
-- Aplica em public, uat, dev | Idempotente
-- Contexto (auditoria 2026-07-19): sync do Google Sheets, expiração do
-- calendar watch, weekly-report e tick da régua não tinham NENHUM sinal
-- observável no banco — falha silenciosa impossível de detectar.
--
-- sheets_synced_at: coluna POR LEAD (decisão D1 — chave agregada mascararia
-- falha parcial). Backfill = submitted_at: o histórico assume-se sincronizado
-- para o check nascer limpo (observabilidade prospectiva, decisão de design).
-- ════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS sheets_synced_at TIMESTAMPTZ;

UPDATE public.form_submissions
  SET sheets_synced_at = submitted_at
  WHERE sheets_synced_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_form_submissions_sheets_pendente
  ON public.form_submissions (submitted_at)
  WHERE sheets_synced_at IS NULL;

INSERT INTO public.configuracoes_sistema (chave, valor, descricao, editavel_ceo)
VALUES
  ('calendar_watch_state', '{}'::jsonb,
   'Estado do watch do Google Calendar (renew-calendar-watch): {expiration, channelId, resourceId, renewed_at}. Check: expiração <24h = crítico.',
   false),
  ('weekly_report_state', '{}'::jsonb,
   'Último envio do relatório semanal (weekly-report): {last_sent_at, sent, total}. Gravado SÓ com sent>0.',
   false),
  ('billing_last_tick_at', '{}'::jsonb,
   'Heartbeat da régua de cobrança (billing-reminders): {at, ...stats} por tick. Vazio = job nunca rodou (pausado).',
   false)
ON CONFLICT (chave) DO NOTHING;

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'uat' AND table_name = 'form_submissions') THEN
    EXECUTE 'ALTER TABLE uat.form_submissions ADD COLUMN IF NOT EXISTS sheets_synced_at TIMESTAMPTZ';
    EXECUTE 'UPDATE uat.form_submissions SET sheets_synced_at = submitted_at WHERE sheets_synced_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_form_submissions_sheets_pendente_uat ON uat.form_submissions (submitted_at) WHERE sheets_synced_at IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'uat' AND table_name = 'configuracoes_sistema') THEN
    EXECUTE $sql$
      INSERT INTO uat.configuracoes_sistema (chave, valor, descricao, editavel_ceo)
      VALUES
        ('calendar_watch_state', '{}'::jsonb, 'Estado do watch do Google Calendar (renew-calendar-watch).', false),
        ('weekly_report_state', '{}'::jsonb, 'Último envio do relatório semanal.', false),
        ('billing_last_tick_at', '{}'::jsonb, 'Heartbeat da régua de cobrança.', false)
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'dev' AND table_name = 'form_submissions') THEN
    EXECUTE 'ALTER TABLE dev.form_submissions ADD COLUMN IF NOT EXISTS sheets_synced_at TIMESTAMPTZ';
    EXECUTE 'UPDATE dev.form_submissions SET sheets_synced_at = submitted_at WHERE sheets_synced_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_form_submissions_sheets_pendente_dev ON dev.form_submissions (submitted_at) WHERE sheets_synced_at IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'dev' AND table_name = 'configuracoes_sistema') THEN
    EXECUTE $sql$
      INSERT INTO dev.configuracoes_sistema (chave, valor, descricao, editavel_ceo)
      VALUES
        ('calendar_watch_state', '{}'::jsonb, 'Estado do watch do Google Calendar (renew-calendar-watch).', false),
        ('weekly_report_state', '{}'::jsonb, 'Último envio do relatório semanal.', false),
        ('billing_last_tick_at', '{}'::jsonb, 'Heartbeat da régua de cobrança.', false)
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;
