-- ════════════════════════════════════════════════════════════════════════
-- Migration: policy UPDATE em automacao_runs para o CEO (fix do Reprocessar)
-- Aplica em: public, uat, dev (idempotente, forward-only)
-- ════════════════════════════════════════════════════════════════════════
--
-- BUG: o botão "Reprocessar" da aba Execuções nunca funcionou para runs do
-- builder — a action reprocessarRun (apps/crm/src/lib/actions/
-- automacoes-builder.ts) faz UPDATE com o client AUTENTICADO, mas a RLS de
-- automacao_runs (migration 20260703232151) só tinha SELECT p/ authenticated
-- e ALL p/ service_role → o UPDATE casava 0 rows e a action respondia
-- "Run não está em erro (talvez já reprocessado)".
--
-- FIX: policy UPDATE restrita ao CEO (mesmo padrão comprovado da policy
-- automacoes_ceo, que já sustenta as escritas do builder em produção).
-- INSERT/DELETE seguem exclusivos do service_role (runs são criados apenas
-- pelas Cloud Functions/engine). O bloqueio de runs de automações de SISTEMA
-- (gatilho='sistema', Fase 2b) permanece na action — inalterado.

-- ─── PUBLIC (PRD) ───
DROP POLICY IF EXISTS "automacao_runs_ceo_update" ON public.automacao_runs;
CREATE POLICY "automacao_runs_ceo_update" ON public.automacao_runs
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');

-- ─── UAT ─── (gate pela TABELA — schemas uat/dev são incompletos)
DO $$ BEGIN
  IF to_regclass('uat.automacao_runs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "automacao_runs_ceo_update" ON uat.automacao_runs';
    EXECUTE 'CREATE POLICY "automacao_runs_ceo_update" ON uat.automacao_runs
      FOR UPDATE TO authenticated
      USING (public.get_user_papel() = ''ceo'')
      WITH CHECK (public.get_user_papel() = ''ceo'')';
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF to_regclass('dev.automacao_runs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "automacao_runs_ceo_update" ON dev.automacao_runs';
    EXECUTE 'CREATE POLICY "automacao_runs_ceo_update" ON dev.automacao_runs
      FOR UPDATE TO authenticated
      USING (public.get_user_papel() = ''ceo'')
      WITH CHECK (public.get_user_papel() = ''ceo'')';
  END IF;
END $$;
