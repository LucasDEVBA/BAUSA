-- ════════════════════════════════════════════════════════════════════
-- Migration: monitor-health v2 — chaves de config do heartbeat e supressão
-- Aplica em public, uat, dev | Idempotente (ON CONFLICT DO NOTHING)
-- Contexto: o watchdog v2 (pós-incidente Z-API 2026-07-15/17) grava um
-- heartbeat `monitor_last_tick_at` a cada tick de produção (consumido pelo
-- dead-man's switch via GitHub Actions) e respeita `monitor_checks_desativados`
-- (checks de features pausadas de propósito). O PATCH numa chave NÃO semeada
-- atualiza 0 linhas silenciosamente — por isso o seed é obrigatório.
--
-- `monitor_checks_desativados` nasce com regua_cobranca + experiencia_nps:
-- os jobs billing-reminders e experiencia-scheduler estão PAUSADOS de
-- propósito em PRD hoje — o CEO remove cada chave ao ativar a régua.
-- ════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
INSERT INTO public.configuracoes_sistema (chave, valor, descricao, editavel_ceo)
VALUES
  ('monitor_last_tick_at', '{}'::jsonb,
   'Heartbeat do monitor-health (dead-man): {at, falhas, checks_total, duration_ms}. Legível por anon via policy restrita — NUNCA incluir dados de leads.',
   false),
  ('monitor_checks_desativados', '["regua_cobranca","experiencia_nps"]'::jsonb,
   'Chaves de check do monitor-health suprimidas de propósito (features pausadas). Remover a chave ao ativar a feature.',
   true)
ON CONFLICT (chave) DO NOTHING;

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'uat' AND table_name = 'configuracoes_sistema') THEN
    EXECUTE $sql$
      INSERT INTO uat.configuracoes_sistema (chave, valor, descricao, editavel_ceo)
      VALUES
        ('monitor_last_tick_at', '{}'::jsonb,
         'Heartbeat do monitor-health (dead-man): {at, falhas, checks_total, duration_ms}.',
         false),
        ('monitor_checks_desativados', '["regua_cobranca","experiencia_nps"]'::jsonb,
         'Chaves de check do monitor-health suprimidas de propósito (features pausadas).',
         true)
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'dev' AND table_name = 'configuracoes_sistema') THEN
    EXECUTE $sql$
      INSERT INTO dev.configuracoes_sistema (chave, valor, descricao, editavel_ceo)
      VALUES
        ('monitor_last_tick_at', '{}'::jsonb,
         'Heartbeat do monitor-health (dead-man): {at, falhas, checks_total, duration_ms}.',
         false),
        ('monitor_checks_desativados', '["regua_cobranca","experiencia_nps"]'::jsonb,
         'Chaves de check do monitor-health suprimidas de propósito (features pausadas).',
         true)
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;
