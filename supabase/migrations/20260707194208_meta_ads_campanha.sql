-- ════════════════════════════════════════════════════════════════════════
-- Migration: CAC granular (M2) — gasto de Meta por CAMPANHA e DIA
-- Aplica em: public, uat, dev (multi-schema, espelha investimentos_marketing)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   O sync do Meta hoje grava só o total da conta por mês em
--   investimentos_marketing. Para ROI EXATO por campanha (cruzando com
--   form_submissions.utm_id = campaign.id) e série diária, esta tabela
--   satélite guarda o gasto por (dia, campanha). O total mensal continua em
--   investimentos_marketing (fonte única dos TOTAIS do CAC/DRE — não muda);
--   esta tabela adiciona o DETALHE por campanha.
--
--   Forward-only, idempotente. TEXT+CHECK (sem enum novo). RLS por papel.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meta_ads_campanha (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data          DATE NOT NULL,                                  -- dia do gasto
  campanha_id   TEXT NOT NULL,                                  -- Meta campaign.id
  campanha_nome TEXT,
  valor_gasto   NUMERIC(12,2) NOT NULL CHECK (valor_gasto >= 0), -- BRL
  impressoes    INTEGER CHECK (impressoes >= 0),
  cliques       INTEGER CHECK (cliques >= 0),
  source        TEXT NOT NULL DEFAULT 'meta_api' CHECK (source IN ('meta_api')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT uq_meta_ads_dia_campanha UNIQUE (data, campanha_id)
);

COMMENT ON TABLE public.meta_ads_campanha IS 'Gasto de Meta Ads por campanha/dia (ingestão automática sync-meta-spend, level=campaign). Detalhe do CAC por campanha; o total mensal fica em investimentos_marketing.';
COMMENT ON COLUMN public.meta_ads_campanha.campanha_id IS 'Meta campaign.id — cruza com form_submissions.utm_id para ROI exato por campanha.';

DROP TRIGGER IF EXISTS trg_meta_ads_updated_at ON public.meta_ads_campanha;
CREATE TRIGGER trg_meta_ads_updated_at
  BEFORE UPDATE ON public.meta_ads_campanha
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_meta_ads ON public.meta_ads_campanha;
CREATE TRIGGER trg_audit_meta_ads
  AFTER INSERT OR UPDATE OR DELETE ON public.meta_ads_campanha
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

CREATE INDEX IF NOT EXISTS idx_meta_ads_data ON public.meta_ads_campanha (data) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_meta_ads_campanha ON public.meta_ads_campanha (campanha_id) WHERE deleted_at IS NULL;

ALTER TABLE public.meta_ads_campanha ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meta_ads_select" ON public.meta_ads_campanha;
CREATE POLICY "meta_ads_select" ON public.meta_ads_campanha
  FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "meta_ads_ceo" ON public.meta_ads_campanha;
CREATE POLICY "meta_ads_ceo" ON public.meta_ads_campanha
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "meta_ads_service" ON public.meta_ads_campanha;
CREATE POLICY "meta_ads_service" ON public.meta_ads_campanha
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── UAT ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.meta_ads_campanha (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data          DATE NOT NULL,
        campanha_id   TEXT NOT NULL,
        campanha_nome TEXT,
        valor_gasto   NUMERIC(12,2) NOT NULL CHECK (valor_gasto >= 0),
        impressoes    INTEGER CHECK (impressoes >= 0),
        cliques       INTEGER CHECK (cliques >= 0),
        source        TEXT NOT NULL DEFAULT ''meta_api'' CHECK (source IN (''meta_api'')),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ,
        CONSTRAINT uq_meta_ads_dia_campanha UNIQUE (data, campanha_id)
      )';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_meta_ads_updated_at ON uat.meta_ads_campanha';
    EXECUTE 'CREATE TRIGGER trg_meta_ads_updated_at BEFORE UPDATE ON uat.meta_ads_campanha
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_meta_ads ON uat.meta_ads_campanha';
    EXECUTE 'CREATE TRIGGER trg_audit_meta_ads AFTER INSERT OR UPDATE OR DELETE ON uat.meta_ads_campanha
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_meta_ads_data ON uat.meta_ads_campanha (data) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_meta_ads_campanha ON uat.meta_ads_campanha (campanha_id) WHERE deleted_at IS NULL';
    EXECUTE 'ALTER TABLE uat.meta_ads_campanha ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "meta_ads_select" ON uat.meta_ads_campanha';
    EXECUTE 'CREATE POLICY "meta_ads_select" ON uat.meta_ads_campanha FOR SELECT TO authenticated USING (deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "meta_ads_ceo" ON uat.meta_ads_campanha';
    EXECUTE 'CREATE POLICY "meta_ads_ceo" ON uat.meta_ads_campanha FOR ALL TO authenticated
      USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "meta_ads_service" ON uat.meta_ads_campanha';
    EXECUTE 'CREATE POLICY "meta_ads_service" ON uat.meta_ads_campanha FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─── DEV ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.meta_ads_campanha (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data          DATE NOT NULL,
        campanha_id   TEXT NOT NULL,
        campanha_nome TEXT,
        valor_gasto   NUMERIC(12,2) NOT NULL CHECK (valor_gasto >= 0),
        impressoes    INTEGER CHECK (impressoes >= 0),
        cliques       INTEGER CHECK (cliques >= 0),
        source        TEXT NOT NULL DEFAULT ''meta_api'' CHECK (source IN (''meta_api'')),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ,
        CONSTRAINT uq_meta_ads_dia_campanha UNIQUE (data, campanha_id)
      )';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_meta_ads_updated_at ON dev.meta_ads_campanha';
    EXECUTE 'CREATE TRIGGER trg_meta_ads_updated_at BEFORE UPDATE ON dev.meta_ads_campanha
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_meta_ads ON dev.meta_ads_campanha';
    EXECUTE 'CREATE TRIGGER trg_audit_meta_ads AFTER INSERT OR UPDATE OR DELETE ON dev.meta_ads_campanha
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_meta_ads_data ON dev.meta_ads_campanha (data) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_meta_ads_campanha ON dev.meta_ads_campanha (campanha_id) WHERE deleted_at IS NULL';
    EXECUTE 'ALTER TABLE dev.meta_ads_campanha ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "meta_ads_select" ON dev.meta_ads_campanha';
    EXECUTE 'CREATE POLICY "meta_ads_select" ON dev.meta_ads_campanha FOR SELECT TO authenticated USING (deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "meta_ads_ceo" ON dev.meta_ads_campanha';
    EXECUTE 'CREATE POLICY "meta_ads_ceo" ON dev.meta_ads_campanha FOR ALL TO authenticated
      USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "meta_ads_service" ON dev.meta_ads_campanha';
    EXECUTE 'CREATE POLICY "meta_ads_service" ON dev.meta_ads_campanha FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
