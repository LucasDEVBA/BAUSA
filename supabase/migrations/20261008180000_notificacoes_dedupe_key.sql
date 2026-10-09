-- ════════════════════════════════════════════════════════════════════════
-- Migration: notificacoes.dedupe_key — idempotência de notificações de CF
-- Aplica em: public (uat/dev só se a tabela existir — hoje NÃO existe lá)
-- Contexto (T14, vídeos do CEO 28/09): o calendar-webhook passa a avisar o
--   CEO/CTO no sininho quando detecta reunião de lead FORA do pipeline
--   (Samuel/INVALIDO 21/09, Clara/FRIO 08/09 — ficaram invisíveis). O CAS de
--   meeting_scheduled já garante "uma vez por transição"; esta chave é a
--   SEGUNDA trava, no banco: o mesmo (destinatário, evento) nunca gera 2 linhas,
--   mesmo com retry/reprocessamento ou deploy manual fora de ordem.
-- Compatível com o código antigo: coluna NULLABLE sem default; NULLs são
--   distintos no índice único (NULLS DISTINCT, padrão do PG) → todo INSERT
--   existente (sem dedupe_key) segue idêntico.
-- Índice ÚNICO COMPLETO (não parcial): o PostgREST gera
--   ON CONFLICT (destinatario_id, dedupe_key) sem cláusula WHERE — índice
--   parcial não é inferido e o upsert falharia com 42P10.
-- Idempotente: ADD COLUMN IF NOT EXISTS / CREATE UNIQUE INDEX IF NOT EXISTS.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS dedupe_key text;

COMMENT ON COLUMN public.notificacoes.dedupe_key IS
  'Chave de idempotência opcional (ex.: reuniao_fora_pipeline:<lead_id>:<event_id>). '
  'UNIQUE(destinatario_id, dedupe_key); NULL = sem deduplicação (comportamento antigo).';

CREATE UNIQUE INDEX IF NOT EXISTS notificacoes_destinatario_dedupe_key_uidx
  ON public.notificacoes (destinatario_id, dedupe_key);

-- ─── UAT ─── (gate por TABELA: o schema uat existe, mas não tem notificacoes)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'uat' AND table_name = 'notificacoes') THEN
    EXECUTE 'ALTER TABLE uat.notificacoes ADD COLUMN IF NOT EXISTS dedupe_key text';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS notificacoes_destinatario_dedupe_key_uidx
             ON uat.notificacoes (destinatario_id, dedupe_key)';
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'dev' AND table_name = 'notificacoes') THEN
    EXECUTE 'ALTER TABLE dev.notificacoes ADD COLUMN IF NOT EXISTS dedupe_key text';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS notificacoes_destinatario_dedupe_key_uidx
             ON dev.notificacoes (destinatario_id, dedupe_key)';
  END IF;
END $$;
