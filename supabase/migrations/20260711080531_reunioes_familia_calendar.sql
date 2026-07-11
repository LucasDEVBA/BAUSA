-- ════════════════════════════════════════════════════════════
-- Migration: reunioes_familia — evento real no Google Calendar
-- Contexto: a aba Reuniões (LRM/pós-venda) passa a poder criar o
--           evento no Calendar do CEO via CF calendar-create-event
--           (Meet automático). google_event_id guarda o id do evento
--           para o badge na UI e para o CEO localizar/cancelar o
--           evento manualmente (a CF não tem caminho de delete).
-- Aplica em public (PRD). A tabela reunioes_familia existe SÓ em
-- public — os blocos uat/dev são gateados por to_regclass e viram
-- no-op (consistência com o padrão multi-schema do repo).
-- ════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
ALTER TABLE public.reunioes_familia
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

COMMENT ON COLUMN public.reunioes_familia.google_event_id IS
  'Id do evento no Google Calendar do CEO quando a reunião foi criada via CF calendar-create-event. NULL = reunião registrada só no Engine (link manual). O cancelamento no Engine NÃO remove o evento — a UI avisa para cancelar também no Calendar.';

-- ─── UAT (no-op enquanto a tabela não existir no schema) ───
DO $$ BEGIN
  IF to_regclass('uat.reunioes_familia') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.reunioes_familia ADD COLUMN IF NOT EXISTS google_event_id TEXT';
    EXECUTE 'COMMENT ON COLUMN uat.reunioes_familia.google_event_id IS ''Id do evento no Google Calendar do CEO quando a reunião foi criada via CF calendar-create-event. NULL = reunião registrada só no Engine (link manual).''';
  END IF;
END $$;

-- ─── DEV (no-op enquanto a tabela não existir no schema) ───
DO $$ BEGIN
  IF to_regclass('dev.reunioes_familia') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.reunioes_familia ADD COLUMN IF NOT EXISTS google_event_id TEXT';
    EXECUTE 'COMMENT ON COLUMN dev.reunioes_familia.google_event_id IS ''Id do evento no Google Calendar do CEO quando a reunião foi criada via CF calendar-create-event. NULL = reunião registrada só no Engine (link manual).''';
  END IF;
END $$;
