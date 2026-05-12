-- ════════════════════════════════════════════════════════════════════════
-- Migration: Adicionar colunas de qualificação pendente
-- Issue: #24
-- Aplica em todos os schemas (public, uat, dev)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   A função qualify-lead chama o Gemini, que ocasionalmente retorna 5xx
--   (sobrecarga). Hoje 1 falha = lead permanece sem qualificação até
--   ação manual. Solução: marcar lead como pendente após 3 retries
--   internos e rotina diária reprocessa automaticamente; CEO/Head veem
--   alerta no War Room.
--
-- Colunas adicionadas:
--   qualification_pending          BOOLEAN  flag para War Room/cron
--   qualification_attempts         INT      contador de tentativas
--   last_qualification_attempt_at  TIMESTAMPTZ  para "esfriar" 6h antes
--                                              de reprocessar
--   last_qualification_error       TEXT     última mensagem de erro
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC SCHEMA (PRD) ────────────────────────────────────────────────

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS qualification_pending BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS qualification_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_qualification_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_qualification_error TEXT;

-- Índice parcial: só armazena os pendentes (otimiza queries do War Room/cron)
CREATE INDEX IF NOT EXISTS form_submissions_qualification_pending_idx
  ON public.form_submissions (last_qualification_attempt_at)
  WHERE qualification_pending = TRUE;


-- ─── UAT SCHEMA ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    EXECUTE 'ALTER TABLE uat.form_submissions
      ADD COLUMN IF NOT EXISTS qualification_pending BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS qualification_attempts INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_qualification_attempt_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_qualification_error TEXT';

    EXECUTE 'CREATE INDEX IF NOT EXISTS form_submissions_qualification_pending_idx
      ON uat.form_submissions (last_qualification_attempt_at)
      WHERE qualification_pending = TRUE';
  END IF;
END $$;


-- ─── DEV SCHEMA ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    EXECUTE 'ALTER TABLE dev.form_submissions
      ADD COLUMN IF NOT EXISTS qualification_pending BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS qualification_attempts INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_qualification_attempt_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_qualification_error TEXT';

    EXECUTE 'CREATE INDEX IF NOT EXISTS form_submissions_qualification_pending_idx
      ON dev.form_submissions (last_qualification_attempt_at)
      WHERE qualification_pending = TRUE';
  END IF;
END $$;
