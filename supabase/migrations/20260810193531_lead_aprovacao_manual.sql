-- ════════════════════════════════════════════════════════════════════════
-- Migration: Fila de aprovação manual de leads (gate humano pré-outreach)
-- Aplica em todos os schemas (public, uat, dev)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   Decisão de produto (2026-08-10): todo lead QUENTE/MORNO passa a esperar
--   aprovação explícita do CEO/CTO antes de (a) entrar no pipeline (atleta+
--   deal) e (b) receber QUALQUER mensagem automática (WhatsApp inicial,
--   timing alternativo, retomada de novembro). A classificação Gemini vira
--   pré-qualificação (recomendação); o humano é o gate único.
--   FRIO continua descartado automaticamente (nunca entra na fila).
--
-- Colunas adicionadas em form_submissions:
--   aprovacao_status        TEXT     'pendente' | 'aprovado' | 'reprovado'
--                                    (NULL = anterior à feature ou FRIO)
--   aprovacao_decidida_por  UUID     quem decidiu (auth.users.id)
--   aprovacao_decidida_em   TIMESTAMPTZ
--   aprovacao_motivo        TEXT     motivo opcional da reprovação
--
-- Backfill: leads QUENTE/MORNO existentes ganham 'aprovado' (já foram
--   promovidos/comunicados pelo fluxo antigo — não devem reaparecer na fila
--   nem ser bloqueados pelos schedulers).
--
-- Invariante novo dos schedulers (guard em tests/scheduler-eligibility.test.js):
--   elegibilidade de outreach = classe QUENTE/MORNO + timing correto
--   + aprovacao_status=eq.aprovado
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC SCHEMA (PRD) ────────────────────────────────────────────────

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS aprovacao_status TEXT,
  ADD COLUMN IF NOT EXISTS aprovacao_decidida_por UUID,
  ADD COLUMN IF NOT EXISTS aprovacao_decidida_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aprovacao_motivo TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'form_submissions_aprovacao_status_check'
      AND conrelid = 'public.form_submissions'::regclass
  ) THEN
    ALTER TABLE public.form_submissions
      ADD CONSTRAINT form_submissions_aprovacao_status_check
      CHECK (aprovacao_status IS NULL OR aprovacao_status IN ('pendente', 'aprovado', 'reprovado'));
  END IF;
END $$;

-- Índice parcial: fila de pendentes (badge/modal consultam com frequência)
CREATE INDEX IF NOT EXISTS form_submissions_aprovacao_pendente_idx
  ON public.form_submissions (submitted_at)
  WHERE aprovacao_status = 'pendente';

-- Backfill idempotente: QUENTE/MORNO pré-feature = aprovado
UPDATE public.form_submissions
SET aprovacao_status = 'aprovado'
WHERE qualification_classification IN ('QUENTE', 'MORNO')
  AND aprovacao_status IS NULL;

-- Policy de UPDATE para o CEO (aprovar/reprovar via server action com sessão).
-- form_submissions só tinha SELECT p/ authenticated + full p/ service_role.
-- get_user_papel() já resolve cto→ceo.
DROP POLICY IF EXISTS "form_submissions_update_ceo" ON public.form_submissions;
CREATE POLICY "form_submissions_update_ceo"
  ON public.form_submissions
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');


-- ─── UAT SCHEMA ─────────────────────────────────────────────────────────
-- Gate por existência da TABELA (schemas uat/dev são parciais — ver
-- incidente da migration 20260703232151).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'uat' AND table_name = 'form_submissions'
  ) THEN
    EXECUTE 'ALTER TABLE uat.form_submissions
      ADD COLUMN IF NOT EXISTS aprovacao_status TEXT,
      ADD COLUMN IF NOT EXISTS aprovacao_decidida_por UUID,
      ADD COLUMN IF NOT EXISTS aprovacao_decidida_em TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS aprovacao_motivo TEXT';

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'form_submissions_aprovacao_status_check'
        AND conrelid = 'uat.form_submissions'::regclass
    ) THEN
      EXECUTE 'ALTER TABLE uat.form_submissions
        ADD CONSTRAINT form_submissions_aprovacao_status_check
        CHECK (aprovacao_status IS NULL OR aprovacao_status IN (''pendente'', ''aprovado'', ''reprovado''))';
    END IF;

    EXECUTE 'CREATE INDEX IF NOT EXISTS form_submissions_aprovacao_pendente_idx
      ON uat.form_submissions (submitted_at)
      WHERE aprovacao_status = ''pendente''';

    EXECUTE 'UPDATE uat.form_submissions
      SET aprovacao_status = ''aprovado''
      WHERE qualification_classification IN (''QUENTE'', ''MORNO'')
        AND aprovacao_status IS NULL';
  END IF;
END $$;


-- ─── DEV SCHEMA ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'dev' AND table_name = 'form_submissions'
  ) THEN
    EXECUTE 'ALTER TABLE dev.form_submissions
      ADD COLUMN IF NOT EXISTS aprovacao_status TEXT,
      ADD COLUMN IF NOT EXISTS aprovacao_decidida_por UUID,
      ADD COLUMN IF NOT EXISTS aprovacao_decidida_em TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS aprovacao_motivo TEXT';

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'form_submissions_aprovacao_status_check'
        AND conrelid = 'dev.form_submissions'::regclass
    ) THEN
      EXECUTE 'ALTER TABLE dev.form_submissions
        ADD CONSTRAINT form_submissions_aprovacao_status_check
        CHECK (aprovacao_status IS NULL OR aprovacao_status IN (''pendente'', ''aprovado'', ''reprovado''))';
    END IF;

    EXECUTE 'CREATE INDEX IF NOT EXISTS form_submissions_aprovacao_pendente_idx
      ON dev.form_submissions (submitted_at)
      WHERE aprovacao_status = ''pendente''';

    EXECUTE 'UPDATE dev.form_submissions
      SET aprovacao_status = ''aprovado''
      WHERE qualification_classification IN (''QUENTE'', ''MORNO'')
        AND aprovacao_status IS NULL';
  END IF;
END $$;
