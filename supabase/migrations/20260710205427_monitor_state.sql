-- ════════════════════════════════════════════════════════════════════════
-- Migration: chave de estado do monitor de saúde (monitor-health)
-- Aplica em: public, uat, dev (idempotente)
-- ════════════════════════════════════════════════════════════════════════
--
-- A CF monitor-health (watchdog do funil, Cloud Scheduler 30min) usa esta
-- chave para o COOLDOWN de alertas (ultimo_alerta por check, 6h) — sem ela
-- o monitor alertaria a cada tick. Estado vive SEMPRE em public (os dados
-- monitorados são os de produção). Semeada vazia; fail-open na CF.

-- ─── PUBLIC (PRD) ───
INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
  ('monitor_state', '{}'::jsonb,
   'Estado interno do monitor de saúde (cooldown de alertas por check). Gerido pela CF monitor-health.')
ON CONFLICT (chave) DO NOTHING;

-- ─── UAT ───
DO $$ BEGIN
  IF to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO uat.configuracoes_sistema (chave, valor, descricao) VALUES
        ('monitor_state', '{}'::jsonb,
         'Estado interno do monitor de saúde (cooldown de alertas por check). Gerido pela CF monitor-health.')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO dev.configuracoes_sistema (chave, valor, descricao) VALUES
        ('monitor_state', '{}'::jsonb,
         'Estado interno do monitor de saúde (cooldown de alertas por check). Gerido pela CF monitor-health.')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;
