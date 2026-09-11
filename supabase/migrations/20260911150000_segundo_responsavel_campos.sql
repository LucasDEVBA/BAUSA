-- ════════════════════════════════════════════════════════════════════════
-- Segundo responsável legal: nome, WhatsApp e e-mail (ordem do CEO,
-- 2026-09-11) | Aplica em public, uat e dev
-- ════════════════════════════════════════════════════════════════════════
--
-- O formulário pergunta "Existe um segundo responsável legal?" (Sim/Não);
-- no "Sim" coleta os MESMOS dados do responsável principal. A profissão
-- (guardian_profession_2) já existia (classificador v2); estas são as três
-- colunas que faltavam. Aditivas e idempotentes — nada consome ainda em
-- versões antigas do app, então o deploy é seguro em qualquer ordem.

-- ─── PUBLIC (PRD) ───
ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS guardian_name_2 TEXT;
ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS guardian_whatsapp_2 TEXT;
ALTER TABLE public.form_submissions ADD COLUMN IF NOT EXISTS guardian_email_2 TEXT;
COMMENT ON COLUMN public.form_submissions.guardian_name_2 IS
  'Nome do segundo responsável legal (form: hasSecondGuardian=sim)';

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    EXECUTE 'ALTER TABLE uat.form_submissions ADD COLUMN IF NOT EXISTS guardian_name_2 TEXT';
    EXECUTE 'ALTER TABLE uat.form_submissions ADD COLUMN IF NOT EXISTS guardian_whatsapp_2 TEXT';
    EXECUTE 'ALTER TABLE uat.form_submissions ADD COLUMN IF NOT EXISTS guardian_email_2 TEXT';
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    EXECUTE 'ALTER TABLE dev.form_submissions ADD COLUMN IF NOT EXISTS guardian_name_2 TEXT';
    EXECUTE 'ALTER TABLE dev.form_submissions ADD COLUMN IF NOT EXISTS guardian_whatsapp_2 TEXT';
    EXECUTE 'ALTER TABLE dev.form_submissions ADD COLUMN IF NOT EXISTS guardian_email_2 TEXT';
  END IF;
END $$;
