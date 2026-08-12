-- ════════════════════════════════════════════════════════════════════════
-- Migration: ads_planos — briefings do A4-Planner viram entidades salvas
-- Aplica em: public, uat, dev
-- Contexto (feedback do CEO 2026-08-11): planos gerados devem ser CLICÁVEIS
--   (lista + tela própria), CUSTOMIZÁVEIS (campos-chave editáveis) e com o
--   UTM sempre em destaque. `campanha_id` vincula o plano à campanha real
--   criada no Ads Manager (fecha o ciclo p/ o futuro A3 cobrar o CPL alvo).
-- GRANTs uat/dev: cobertos pelos DEFAULT PRIVILEGES (20260810201415).
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ads_planos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 3 AND 160),
  foco          TEXT,
  plano         JSONB NOT NULL,
  confianca     JSONB,
  evidencia     JSONB,
  status        TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'executado')),
  campanha_id   TEXT,
  notas         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_ads_planos_recentes
  ON public.ads_planos (created_at DESC) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_ads_planos_updated_at ON public.ads_planos;
CREATE TRIGGER trg_ads_planos_updated_at BEFORE UPDATE ON public.ads_planos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_ads_planos ON public.ads_planos;
CREATE TRIGGER trg_audit_ads_planos AFTER INSERT OR UPDATE OR DELETE ON public.ads_planos
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

ALTER TABLE public.ads_planos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ads_planos_select" ON public.ads_planos;
CREATE POLICY "ads_planos_select" ON public.ads_planos
  FOR SELECT TO authenticated USING (public.get_user_papel() = 'ceo' AND deleted_at IS NULL);
DROP POLICY IF EXISTS "ads_planos_write" ON public.ads_planos;
CREATE POLICY "ads_planos_write" ON public.ads_planos
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "ads_planos_service" ON public.ads_planos;
CREATE POLICY "ads_planos_service" ON public.ads_planos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.ads_planos (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        titulo        TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 3 AND 160),
        foco          TEXT,
        plano         JSONB NOT NULL,
        confianca     JSONB,
        evidencia     JSONB,
        status        TEXT NOT NULL DEFAULT ''rascunho'' CHECK (status IN (''rascunho'', ''executado'')),
        campanha_id   TEXT,
        notas         TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ,
        created_by    UUID REFERENCES auth.users(id)
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ads_planos_recentes_uat ON uat.ads_planos (created_at DESC) WHERE deleted_at IS NULL';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_ads_planos_updated_at ON uat.ads_planos';
    EXECUTE 'CREATE TRIGGER trg_ads_planos_updated_at BEFORE UPDATE ON uat.ads_planos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'ALTER TABLE uat.ads_planos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "ads_planos_select" ON uat.ads_planos';
    EXECUTE 'CREATE POLICY "ads_planos_select" ON uat.ads_planos FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'' AND deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "ads_planos_write" ON uat.ads_planos';
    EXECUTE 'CREATE POLICY "ads_planos_write" ON uat.ads_planos FOR ALL TO authenticated USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "ads_planos_service" ON uat.ads_planos';
    EXECUTE 'CREATE POLICY "ads_planos_service" ON uat.ads_planos FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.ads_planos (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        titulo        TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 3 AND 160),
        foco          TEXT,
        plano         JSONB NOT NULL,
        confianca     JSONB,
        evidencia     JSONB,
        status        TEXT NOT NULL DEFAULT ''rascunho'' CHECK (status IN (''rascunho'', ''executado'')),
        campanha_id   TEXT,
        notas         TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ,
        created_by    UUID REFERENCES auth.users(id)
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ads_planos_recentes_dev ON dev.ads_planos (created_at DESC) WHERE deleted_at IS NULL';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_ads_planos_updated_at ON dev.ads_planos';
    EXECUTE 'CREATE TRIGGER trg_ads_planos_updated_at BEFORE UPDATE ON dev.ads_planos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'ALTER TABLE dev.ads_planos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "ads_planos_select" ON dev.ads_planos';
    EXECUTE 'CREATE POLICY "ads_planos_select" ON dev.ads_planos FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'' AND deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "ads_planos_write" ON dev.ads_planos';
    EXECUTE 'CREATE POLICY "ads_planos_write" ON dev.ads_planos FOR ALL TO authenticated USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "ads_planos_service" ON dev.ads_planos';
    EXECUTE 'CREATE POLICY "ads_planos_service" ON dev.ads_planos FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
