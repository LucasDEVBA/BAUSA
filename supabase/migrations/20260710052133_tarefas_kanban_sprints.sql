-- ════════════════════════════════════════════════════════════
-- Migration: Tarefas — quadro Kanban + Sprints  | Aplica em public, uat, dev
-- Contexto: reformular /tarefas como Kanban (Backlog/A fazer/Fazendo/Feito)
-- com Sprints leves, reusando a tabela public.tarefas existente.
--   • Nova tabela `sprints` (planejada/ativa/concluida).
--   • tarefas ganha: sprint_id (NULL = sem sprint) e quadro_coluna (a coluna do board).
--   • `status` (enum legado) permanece a fonte para os demais consumidores
--     (War Room, automações). O app mantém status ⇄ quadro_coluna em sincronia:
--       backlog/a_fazer → pendente · fazendo → em_andamento · feito → concluida
-- Aditiva e idempotente. Backfill escopado ao default ('a_fazer') p/ não
-- sobrescrever cards já movidos num eventual re-run (forward-only na prática).
-- ════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
CREATE TABLE IF NOT EXISTS public.sprints (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT NOT NULL,
  objetivo     TEXT,
  data_inicio  DATE,
  data_fim     DATE,
  status       TEXT NOT NULL DEFAULT 'planejada'
               CHECK (status IN ('planejada','ativa','concluida')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.sprints IS 'Sprints (ciclos) do quadro de tarefas do CRM.';

DROP TRIGGER IF EXISTS trg_sprints_updated_at ON public.sprints;
CREATE TRIGGER trg_sprints_updated_at BEFORE UPDATE ON public.sprints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_sprints ON public.sprints;
CREATE TRIGGER trg_audit_sprints AFTER INSERT OR UPDATE OR DELETE ON public.sprints
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

CREATE INDEX IF NOT EXISTS idx_sprints_status ON public.sprints (status) WHERE deleted_at IS NULL;

ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sprints_select" ON public.sprints;
CREATE POLICY "sprints_select" ON public.sprints
  FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "sprints_insert" ON public.sprints;
CREATE POLICY "sprints_insert" ON public.sprints
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel() IN ('ceo','head_sucesso'));
DROP POLICY IF EXISTS "sprints_update" ON public.sprints;
CREATE POLICY "sprints_update" ON public.sprints
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() IN ('ceo','head_sucesso'))
  WITH CHECK (public.get_user_papel() IN ('ceo','head_sucesso'));
DROP POLICY IF EXISTS "sprints_delete" ON public.sprints;
CREATE POLICY "sprints_delete" ON public.sprints
  FOR DELETE TO authenticated USING (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "sprints_service" ON public.sprints;
CREATE POLICY "sprints_service" ON public.sprints
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- tarefas: colunas do quadro
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES public.sprints(id);
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS quadro_coluna TEXT NOT NULL DEFAULT 'a_fazer'
  CHECK (quadro_coluna IN ('backlog','a_fazer','fazendo','feito'));

-- Backfill a partir do status (escopado ao default → idempotente por re-run)
UPDATE public.tarefas SET quadro_coluna = 'feito'
  WHERE status = 'concluida' AND quadro_coluna = 'a_fazer';
UPDATE public.tarefas SET quadro_coluna = 'fazendo'
  WHERE status = 'em_andamento' AND quadro_coluna = 'a_fazer';

CREATE INDEX IF NOT EXISTS idx_tarefas_quadro ON public.tarefas (quadro_coluna) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tarefas_sprint ON public.tarefas (sprint_id) WHERE sprint_id IS NOT NULL;

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.sprints (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome         TEXT NOT NULL,
        objetivo     TEXT,
        data_inicio  DATE,
        data_fim     DATE,
        status       TEXT NOT NULL DEFAULT ''planejada''
                     CHECK (status IN (''planejada'',''ativa'',''concluida'')),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at   TIMESTAMPTZ,
        created_by   UUID REFERENCES auth.users(id)
      )';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_sprints_updated_at ON uat.sprints';
    EXECUTE 'CREATE TRIGGER trg_sprints_updated_at BEFORE UPDATE ON uat.sprints FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_sprints ON uat.sprints';
    EXECUTE 'CREATE TRIGGER trg_audit_sprints AFTER INSERT OR UPDATE OR DELETE ON uat.sprints FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sprints_status ON uat.sprints (status) WHERE deleted_at IS NULL';
    EXECUTE 'ALTER TABLE uat.sprints ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "sprints_select" ON uat.sprints';
    EXECUTE 'CREATE POLICY "sprints_select" ON uat.sprints FOR SELECT TO authenticated USING (deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "sprints_insert" ON uat.sprints';
    EXECUTE 'CREATE POLICY "sprints_insert" ON uat.sprints FOR INSERT TO authenticated WITH CHECK (public.get_user_papel() IN (''ceo'',''head_sucesso''))';
    EXECUTE 'DROP POLICY IF EXISTS "sprints_update" ON uat.sprints';
    EXECUTE 'CREATE POLICY "sprints_update" ON uat.sprints FOR UPDATE TO authenticated USING (public.get_user_papel() IN (''ceo'',''head_sucesso'')) WITH CHECK (public.get_user_papel() IN (''ceo'',''head_sucesso''))';
    EXECUTE 'DROP POLICY IF EXISTS "sprints_delete" ON uat.sprints';
    EXECUTE 'CREATE POLICY "sprints_delete" ON uat.sprints FOR DELETE TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "sprints_service" ON uat.sprints';
    EXECUTE 'CREATE POLICY "sprints_service" ON uat.sprints FOR ALL TO service_role USING (true) WITH CHECK (true)';

    EXECUTE 'ALTER TABLE uat.tarefas ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES uat.sprints(id)';
    EXECUTE 'ALTER TABLE uat.tarefas ADD COLUMN IF NOT EXISTS quadro_coluna TEXT NOT NULL DEFAULT ''a_fazer'' CHECK (quadro_coluna IN (''backlog'',''a_fazer'',''fazendo'',''feito''))';
    EXECUTE 'UPDATE uat.tarefas SET quadro_coluna = ''feito'' WHERE status = ''concluida'' AND quadro_coluna = ''a_fazer''';
    EXECUTE 'UPDATE uat.tarefas SET quadro_coluna = ''fazendo'' WHERE status = ''em_andamento'' AND quadro_coluna = ''a_fazer''';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tarefas_quadro ON uat.tarefas (quadro_coluna) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tarefas_sprint ON uat.tarefas (sprint_id) WHERE sprint_id IS NOT NULL';
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.sprints (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome         TEXT NOT NULL,
        objetivo     TEXT,
        data_inicio  DATE,
        data_fim     DATE,
        status       TEXT NOT NULL DEFAULT ''planejada''
                     CHECK (status IN (''planejada'',''ativa'',''concluida'')),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at   TIMESTAMPTZ,
        created_by   UUID REFERENCES auth.users(id)
      )';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_sprints_updated_at ON dev.sprints';
    EXECUTE 'CREATE TRIGGER trg_sprints_updated_at BEFORE UPDATE ON dev.sprints FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_sprints ON dev.sprints';
    EXECUTE 'CREATE TRIGGER trg_audit_sprints AFTER INSERT OR UPDATE OR DELETE ON dev.sprints FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sprints_status ON dev.sprints (status) WHERE deleted_at IS NULL';
    EXECUTE 'ALTER TABLE dev.sprints ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "sprints_select" ON dev.sprints';
    EXECUTE 'CREATE POLICY "sprints_select" ON dev.sprints FOR SELECT TO authenticated USING (deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "sprints_insert" ON dev.sprints';
    EXECUTE 'CREATE POLICY "sprints_insert" ON dev.sprints FOR INSERT TO authenticated WITH CHECK (public.get_user_papel() IN (''ceo'',''head_sucesso''))';
    EXECUTE 'DROP POLICY IF EXISTS "sprints_update" ON dev.sprints';
    EXECUTE 'CREATE POLICY "sprints_update" ON dev.sprints FOR UPDATE TO authenticated USING (public.get_user_papel() IN (''ceo'',''head_sucesso'')) WITH CHECK (public.get_user_papel() IN (''ceo'',''head_sucesso''))';
    EXECUTE 'DROP POLICY IF EXISTS "sprints_delete" ON dev.sprints';
    EXECUTE 'CREATE POLICY "sprints_delete" ON dev.sprints FOR DELETE TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "sprints_service" ON dev.sprints';
    EXECUTE 'CREATE POLICY "sprints_service" ON dev.sprints FOR ALL TO service_role USING (true) WITH CHECK (true)';

    EXECUTE 'ALTER TABLE dev.tarefas ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES dev.sprints(id)';
    EXECUTE 'ALTER TABLE dev.tarefas ADD COLUMN IF NOT EXISTS quadro_coluna TEXT NOT NULL DEFAULT ''a_fazer'' CHECK (quadro_coluna IN (''backlog'',''a_fazer'',''fazendo'',''feito''))';
    EXECUTE 'UPDATE dev.tarefas SET quadro_coluna = ''feito'' WHERE status = ''concluida'' AND quadro_coluna = ''a_fazer''';
    EXECUTE 'UPDATE dev.tarefas SET quadro_coluna = ''fazendo'' WHERE status = ''em_andamento'' AND quadro_coluna = ''a_fazer''';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tarefas_quadro ON dev.tarefas (quadro_coluna) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tarefas_sprint ON dev.tarefas (sprint_id) WHERE sprint_id IS NOT NULL';
  END IF;
END $$;
