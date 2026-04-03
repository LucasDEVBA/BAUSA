-- ── Adiciona coluna address_country para suporte internacional ─────────────
-- Aplicado em public (PRD), uat (UAT) e dev (DEV)

-- PRD (public)
ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS address_country text DEFAULT 'BR';

-- UAT
ALTER TABLE uat.form_submissions
  ADD COLUMN IF NOT EXISTS address_country text DEFAULT 'BR';

-- DEV
ALTER TABLE dev.form_submissions
  ADD COLUMN IF NOT EXISTS address_country text DEFAULT 'BR';
