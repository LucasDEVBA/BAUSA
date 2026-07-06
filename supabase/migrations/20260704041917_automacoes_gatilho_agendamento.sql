-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Automações — gatilho 'agendamento' (Fase H3)   | public, uat, dev
-- Contexto: gatilho recorrente genérico ("criar gatilho" pedido pelo CEO).
--   Dispara em horário fixo BRT (diário, semanal ou mensal), materializado
--   pela engine (CF automation-engine) com dedup POR PERÍODO (bucket
--   dia/semana/mês em contexto->>periodo) — sem lead/deal no contexto.
--   gatilho_config: { frequencia: diaria|semanal|mensal, hora: 0-23,
--   dia_semana?: 0-6 (semanal), dia_mes?: 1-28 (mensal) }.
-- A constraint original é o CHECK inline da coluna `gatilho` na migration
--   20260703232151 — nome auto-gerado pelo Postgres: automacoes_gatilho_check
--   (convenção {tabela}_{coluna}_check). DROP IF EXISTS + ADD = idempotente
--   e forward-only (o novo conjunto é superset: nenhuma row existente viola).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
ALTER TABLE public.automacoes DROP CONSTRAINT IF EXISTS automacoes_gatilho_check;
ALTER TABLE public.automacoes ADD CONSTRAINT automacoes_gatilho_check CHECK (gatilho IN (
  'lead_qualificado', 'deal_etapa_mudou', 'reuniao_marcada', 'temperatura_vermelha',
  'deal_parado_etapa', 'parcela_vencendo', 'parcela_atrasada',
  'familia_sem_contato', 'tarefa_vencida', 'agendamento'
));

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.automacoes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.automacoes DROP CONSTRAINT IF EXISTS automacoes_gatilho_check';
    EXECUTE 'ALTER TABLE uat.automacoes ADD CONSTRAINT automacoes_gatilho_check CHECK (gatilho IN (
      ''lead_qualificado'', ''deal_etapa_mudou'', ''reuniao_marcada'', ''temperatura_vermelha'',
      ''deal_parado_etapa'', ''parcela_vencendo'', ''parcela_atrasada'',
      ''familia_sem_contato'', ''tarefa_vencida'', ''agendamento''
    ))';
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.automacoes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.automacoes DROP CONSTRAINT IF EXISTS automacoes_gatilho_check';
    EXECUTE 'ALTER TABLE dev.automacoes ADD CONSTRAINT automacoes_gatilho_check CHECK (gatilho IN (
      ''lead_qualificado'', ''deal_etapa_mudou'', ''reuniao_marcada'', ''temperatura_vermelha'',
      ''deal_parado_etapa'', ''parcela_vencendo'', ''parcela_atrasada'',
      ''familia_sem_contato'', ''tarefa_vencida'', ''agendamento''
    ))';
  END IF;
END $$;
