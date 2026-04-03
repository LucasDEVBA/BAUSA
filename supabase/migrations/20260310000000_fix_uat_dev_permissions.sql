-- ============================================================
-- Migration: Corrige permissões dos schemas UAT e DEV
--
-- O que esta migration faz:
--   1. Concede USAGE nos schemas para que roles possam acessá-los
--   2. Concede INSERT, SELECT, UPDATE na tabela para role anon
--      (PostgREST exige UPDATE mesmo em upsert com ignoreDuplicates)
--   3. Concede ALL para service_role
--   4. Adiciona política RLS UPDATE para anon (necessária para upsert
--      via PostgREST mesmo com resolution=ignore-duplicates)
-- ============================================================

-- ── Schema UAT ───────────────────────────────────────────────

-- Acesso ao schema
GRANT USAGE ON SCHEMA uat TO anon, authenticated, service_role;

-- Permissões na tabela (UPDATE obrigatório para upsert no PostgREST)
GRANT INSERT, SELECT, UPDATE ON TABLE uat.form_submissions TO anon;
GRANT ALL ON TABLE uat.form_submissions TO service_role;

-- Política RLS UPDATE (PostgREST verifica UPDATE antes de inserir via upsert)
DROP POLICY IF EXISTS "anon_can_update_uat" ON uat.form_submissions;
CREATE POLICY "anon_can_update_uat"
  ON uat.form_submissions
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- ── Schema DEV ───────────────────────────────────────────────

-- Acesso ao schema
GRANT USAGE ON SCHEMA dev TO anon, authenticated, service_role;

-- Permissões na tabela
GRANT INSERT, SELECT, UPDATE ON TABLE dev.form_submissions TO anon;
GRANT ALL ON TABLE dev.form_submissions TO service_role;

-- Política RLS UPDATE
DROP POLICY IF EXISTS "anon_can_update_dev" ON dev.form_submissions;
CREATE POLICY "anon_can_update_dev"
  ON dev.form_submissions
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
