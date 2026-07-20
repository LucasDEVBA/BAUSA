-- ════════════════════════════════════════════════════════════════════
-- Migration: F3 dead-man's switch — policy anon restrita ao tick do monitor
-- Aplica em public, uat, dev | Idempotente
-- Contexto: o workflow GitHub Actions (deadman-monitor.yml) precisa ler
-- APENAS a chave monitor_last_tick_at via PostgREST com a anon key — decisão
-- D2 do plano: menor privilégio (service key no Actions seria blast radius
-- total para ler 1 timestamp). O valor da chave contém SÓ campos agregados
-- {at, falhas, checks_total, duration_ms} — nunca dados de leads (invariante
-- travado pelo guard tests/monitor-health-invariants.test.js).
-- A chave é, por contrato, PÚBLICA (a anon key vive no bundle do frontend).
-- ════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
GRANT SELECT ON public.configuracoes_sistema TO anon;
DROP POLICY IF EXISTS "config_select_anon_deadman" ON public.configuracoes_sistema;
CREATE POLICY "config_select_anon_deadman" ON public.configuracoes_sistema
  FOR SELECT TO anon
  USING (chave = 'monitor_last_tick_at');

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'uat' AND table_name = 'configuracoes_sistema') THEN
    EXECUTE 'GRANT SELECT ON uat.configuracoes_sistema TO anon';
    EXECUTE 'DROP POLICY IF EXISTS "config_select_anon_deadman" ON uat.configuracoes_sistema';
    EXECUTE 'CREATE POLICY "config_select_anon_deadman" ON uat.configuracoes_sistema FOR SELECT TO anon USING (chave = ''monitor_last_tick_at'')';
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'dev' AND table_name = 'configuracoes_sistema') THEN
    EXECUTE 'GRANT SELECT ON dev.configuracoes_sistema TO anon';
    EXECUTE 'DROP POLICY IF EXISTS "config_select_anon_deadman" ON dev.configuracoes_sistema';
    EXECUTE 'CREATE POLICY "config_select_anon_deadman" ON dev.configuracoes_sistema FOR SELECT TO anon USING (chave = ''monitor_last_tick_at'')';
  END IF;
END $$;
