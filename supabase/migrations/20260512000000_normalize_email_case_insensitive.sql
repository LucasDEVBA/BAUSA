-- ════════════════════════════════════════════════════════════════════════
-- Migration: Normalizar email case-insensitive em form_submissions
-- Issue: #25
-- Aplica em todos os schemas (public, uat, dev)
-- ════════════════════════════════════════════════════════════════════════
--
-- Problema:
--   A constraint UNIQUE(email, athlete_name) em form_submissions é
--   case-sensitive. Submissões com case-difference no email (ex:
--   'Foo@gmail.com' vs 'foo@gmail.com') geram registros duplicados,
--   poluindo CRM, dashboards e disparando WhatsApp/email duas vezes.
--
-- Solução:
--   1. Normalizar emails existentes para lowercase
--   2. Trigger BEFORE INSERT/UPDATE forçando LOWER(email)
--   3. Trocar constraint UNIQUE atual por índice funcional CI
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC SCHEMA (PRD) ────────────────────────────────────────────────

-- 1. Normalizar emails existentes
UPDATE public.form_submissions
SET email = LOWER(TRIM(email))
WHERE email != LOWER(TRIM(email));

-- 2. Função de normalização
CREATE OR REPLACE FUNCTION public.normalize_form_submission_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email = LOWER(TRIM(NEW.email));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger BEFORE INSERT/UPDATE
DROP TRIGGER IF EXISTS form_submissions_normalize_email_trg ON public.form_submissions;
CREATE TRIGGER form_submissions_normalize_email_trg
  BEFORE INSERT OR UPDATE OF email ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.normalize_form_submission_email();

-- 4. Trocar constraint UNIQUE por índice funcional case-insensitive
ALTER TABLE public.form_submissions
  DROP CONSTRAINT IF EXISTS form_submissions_email_athlete_name_key;

DROP INDEX IF EXISTS public.form_submissions_email_athlete_name_ci_idx;
CREATE UNIQUE INDEX form_submissions_email_athlete_name_ci_idx
  ON public.form_submissions (LOWER(email), LOWER(athlete_name));


-- ─── UAT SCHEMA ─────────────────────────────────────────────────────────

-- Aplica somente se o schema 'uat' existir (ambiente UAT)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    -- Normalizar emails existentes
    UPDATE uat.form_submissions
    SET email = LOWER(TRIM(email))
    WHERE email != LOWER(TRIM(email));

    -- Função de normalização no schema uat
    EXECUTE $func$
      CREATE OR REPLACE FUNCTION uat.normalize_form_submission_email()
      RETURNS TRIGGER AS $f$
      BEGIN
        IF NEW.email IS NOT NULL THEN
          NEW.email = LOWER(TRIM(NEW.email));
        END IF;
        RETURN NEW;
      END;
      $f$ LANGUAGE plpgsql;
    $func$;

    -- Trigger
    EXECUTE 'DROP TRIGGER IF EXISTS form_submissions_normalize_email_trg ON uat.form_submissions';
    EXECUTE 'CREATE TRIGGER form_submissions_normalize_email_trg
             BEFORE INSERT OR UPDATE OF email ON uat.form_submissions
             FOR EACH ROW EXECUTE FUNCTION uat.normalize_form_submission_email()';

    -- Trocar constraint
    EXECUTE 'ALTER TABLE uat.form_submissions DROP CONSTRAINT IF EXISTS form_submissions_email_athlete_name_key';
    EXECUTE 'DROP INDEX IF EXISTS uat.form_submissions_email_athlete_name_ci_idx';
    EXECUTE 'CREATE UNIQUE INDEX form_submissions_email_athlete_name_ci_idx
             ON uat.form_submissions (LOWER(email), LOWER(athlete_name))';
  END IF;
END $$;


-- ─── DEV SCHEMA ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    UPDATE dev.form_submissions
    SET email = LOWER(TRIM(email))
    WHERE email != LOWER(TRIM(email));

    EXECUTE $func$
      CREATE OR REPLACE FUNCTION dev.normalize_form_submission_email()
      RETURNS TRIGGER AS $f$
      BEGIN
        IF NEW.email IS NOT NULL THEN
          NEW.email = LOWER(TRIM(NEW.email));
        END IF;
        RETURN NEW;
      END;
      $f$ LANGUAGE plpgsql;
    $func$;

    EXECUTE 'DROP TRIGGER IF EXISTS form_submissions_normalize_email_trg ON dev.form_submissions';
    EXECUTE 'CREATE TRIGGER form_submissions_normalize_email_trg
             BEFORE INSERT OR UPDATE OF email ON dev.form_submissions
             FOR EACH ROW EXECUTE FUNCTION dev.normalize_form_submission_email()';

    EXECUTE 'ALTER TABLE dev.form_submissions DROP CONSTRAINT IF EXISTS form_submissions_email_athlete_name_key';
    EXECUTE 'DROP INDEX IF EXISTS dev.form_submissions_email_athlete_name_ci_idx';
    EXECUTE 'CREATE UNIQUE INDEX form_submissions_email_athlete_name_ci_idx
             ON dev.form_submissions (LOWER(email), LOWER(athlete_name))';
  END IF;
END $$;
