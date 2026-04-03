-- ============================================================
-- Migration: Adiciona política SELECT para anon em UAT e DEV
--
-- Causa raiz identificada:
--   O PostgREST, ao processar um upsert com ON CONFLICT (email,
--   athlete_name) DO NOTHING, precisa verificar se a linha
--   conflitante é visível ao role atual (anon). Sem uma política
--   SELECT, o PostgreSQL não consegue fazer essa verificação e
--   lança 42501 "new row violates row-level security policy".
--
--   Esta é a última peça que faltava: além de INSERT e UPDATE,
--   o anon precisa de SELECT para que o ON CONFLICT funcione
--   corretamente com RLS habilitado.
--
--   Nota de segurança: uat e dev são schemas de teste, sem dados
--   de clientes reais. O SELECT para anon é aceitável nesse contexto.
--   Em public (PRD), esta política NÃO existe e não deve ser criada.
-- ============================================================

-- ── Schema UAT ───────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_can_select_uat" ON uat.form_submissions;
CREATE POLICY "anon_can_select_uat"
  ON uat.form_submissions
  FOR SELECT TO anon
  USING (true);

-- ── Schema DEV ───────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_can_select_dev" ON dev.form_submissions;
CREATE POLICY "anon_can_select_dev"
  ON dev.form_submissions
  FOR SELECT TO anon
  USING (true);
