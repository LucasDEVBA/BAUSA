-- ════════════════════════════════════════════════════════════════════════
-- Migration: Classificação por timing (cedo demais / tarde demais)
-- Issue: Feature "timing automation"
-- Aplica em todos os schemas (public, uat, dev)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   Hoje o qualify-lead trata todos os leads igual. Esta migration adiciona
--   suporte para 3 cenários de timing:
--     ideal       → fluxo atual (9º ano até graduated_last_year)
--     muito_cedo  → before_7th: aguarda novembro do ano civil seguinte
--     tarde_demais→ graduated_2plus: fora da janela competitiva
--
-- Novas colunas em form_submissions:
--   timing_status              ('ideal','muito_cedo','tarde_demais')
--   scheduled_followup_at      TIMESTAMPTZ (apenas para muito_cedo)
--   scheduled_followup_sent_at TIMESTAMPTZ
--
-- Novo valor no enum status_deal:
--   'aguardando_timing' (entre 'lead' e 'reuniao_marcada')
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC SCHEMA (PRD) ────────────────────────────────────────────────

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS timing_status TEXT
    CHECK (timing_status IN ('ideal','muito_cedo','tarde_demais'))
    DEFAULT 'ideal',
  ADD COLUMN IF NOT EXISTS scheduled_followup_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_followup_sent_at TIMESTAMPTZ;

-- Índice parcial: otimiza query do cron process-scheduled-followups
CREATE INDEX IF NOT EXISTS form_submissions_scheduled_followup_pending_idx
  ON public.form_submissions (scheduled_followup_at)
  WHERE scheduled_followup_at IS NOT NULL
    AND scheduled_followup_sent_at IS NULL;

-- Adicionar valor 'aguardando_timing' ao enum status_deal (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.status_deal'::regtype
      AND enumlabel = 'aguardando_timing'
  ) THEN
    ALTER TYPE public.status_deal ADD VALUE 'aguardando_timing' BEFORE 'reuniao_marcada';
  END IF;
END $$;


-- ─── UAT SCHEMA ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    EXECUTE 'ALTER TABLE uat.form_submissions
      ADD COLUMN IF NOT EXISTS timing_status TEXT
        CHECK (timing_status IN (''ideal'',''muito_cedo'',''tarde_demais''))
        DEFAULT ''ideal'',
      ADD COLUMN IF NOT EXISTS scheduled_followup_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS scheduled_followup_sent_at TIMESTAMPTZ';

    EXECUTE 'CREATE INDEX IF NOT EXISTS form_submissions_scheduled_followup_pending_idx
      ON uat.form_submissions (scheduled_followup_at)
      WHERE scheduled_followup_at IS NOT NULL
        AND scheduled_followup_sent_at IS NULL';

    -- enum status_deal só existe no schema public (compartilhado)
  END IF;
END $$;


-- ─── DEV SCHEMA ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    EXECUTE 'ALTER TABLE dev.form_submissions
      ADD COLUMN IF NOT EXISTS timing_status TEXT
        CHECK (timing_status IN (''ideal'',''muito_cedo'',''tarde_demais''))
        DEFAULT ''ideal'',
      ADD COLUMN IF NOT EXISTS scheduled_followup_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS scheduled_followup_sent_at TIMESTAMPTZ';

    EXECUTE 'CREATE INDEX IF NOT EXISTS form_submissions_scheduled_followup_pending_idx
      ON dev.form_submissions (scheduled_followup_at)
      WHERE scheduled_followup_at IS NOT NULL
        AND scheduled_followup_sent_at IS NULL';
  END IF;
END $$;
