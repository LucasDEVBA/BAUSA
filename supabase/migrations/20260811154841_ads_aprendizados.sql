-- ════════════════════════════════════════════════════════════════════════
-- Migration: ads_aprendizados — o "cérebro" de Ads que aprende
-- Aplica em: public, uat, dev
-- Contexto (A4-Planner, decisão do CEO 2026-08-11): cada plano gerado,
--   resultado de campanha e observação vira um registro APPEND-ONLY que
--   alimenta os prompts seguintes (planner, insights de CAC, futuro A3).
--   A confiança aqui é a registrada na ORIGEM do aprendizado; os badges da
--   UI são sempre recalculados deterministicamente (ads-confianca.ts).
-- Append-only: sem policies de UPDATE/DELETE (imutável, como audit_logs).
-- GRANTs uat/dev: cobertos pelos DEFAULT PRIVILEGES (migration 20260810201415).
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ads_aprendizados (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          TEXT NOT NULL CHECK (tipo IN ('plano_gerado', 'resultado_campanha', 'observacao')),
  resumo        TEXT NOT NULL CHECK (char_length(resumo) BETWEEN 10 AND 2000),
  evidencia     JSONB,
  campanha_id   TEXT,
  confianca     TEXT CHECK (confianca IN ('assertiva', 'parcial', 'sugestiva')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_ads_aprendizados_recentes
  ON public.ads_aprendizados (created_at DESC);

ALTER TABLE public.ads_aprendizados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ads_apr_select" ON public.ads_aprendizados;
CREATE POLICY "ads_apr_select" ON public.ads_aprendizados
  FOR SELECT TO authenticated USING (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "ads_apr_insert" ON public.ads_aprendizados;
CREATE POLICY "ads_apr_insert" ON public.ads_aprendizados
  FOR INSERT TO authenticated WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "ads_apr_service" ON public.ads_aprendizados;
CREATE POLICY "ads_apr_service" ON public.ads_aprendizados
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.ads_aprendizados (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tipo          TEXT NOT NULL CHECK (tipo IN (''plano_gerado'', ''resultado_campanha'', ''observacao'')),
        resumo        TEXT NOT NULL CHECK (char_length(resumo) BETWEEN 10 AND 2000),
        evidencia     JSONB,
        campanha_id   TEXT,
        confianca     TEXT CHECK (confianca IN (''assertiva'', ''parcial'', ''sugestiva'')),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by    UUID REFERENCES auth.users(id)
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ads_aprendizados_recentes_uat ON uat.ads_aprendizados (created_at DESC)';
    EXECUTE 'ALTER TABLE uat.ads_aprendizados ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "ads_apr_select" ON uat.ads_aprendizados';
    EXECUTE 'CREATE POLICY "ads_apr_select" ON uat.ads_aprendizados FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "ads_apr_insert" ON uat.ads_aprendizados';
    EXECUTE 'CREATE POLICY "ads_apr_insert" ON uat.ads_aprendizados FOR INSERT TO authenticated WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "ads_apr_service" ON uat.ads_aprendizados';
    EXECUTE 'CREATE POLICY "ads_apr_service" ON uat.ads_aprendizados FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.ads_aprendizados (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tipo          TEXT NOT NULL CHECK (tipo IN (''plano_gerado'', ''resultado_campanha'', ''observacao'')),
        resumo        TEXT NOT NULL CHECK (char_length(resumo) BETWEEN 10 AND 2000),
        evidencia     JSONB,
        campanha_id   TEXT,
        confianca     TEXT CHECK (confianca IN (''assertiva'', ''parcial'', ''sugestiva'')),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by    UUID REFERENCES auth.users(id)
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ads_aprendizados_recentes_dev ON dev.ads_aprendizados (created_at DESC)';
    EXECUTE 'ALTER TABLE dev.ads_aprendizados ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "ads_apr_select" ON dev.ads_aprendizados';
    EXECUTE 'CREATE POLICY "ads_apr_select" ON dev.ads_aprendizados FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "ads_apr_insert" ON dev.ads_aprendizados';
    EXECUTE 'CREATE POLICY "ads_apr_insert" ON dev.ads_aprendizados FOR INSERT TO authenticated WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "ads_apr_service" ON dev.ads_aprendizados';
    EXECUTE 'CREATE POLICY "ads_apr_service" ON dev.ads_aprendizados FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
