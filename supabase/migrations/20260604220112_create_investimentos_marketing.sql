-- ════════════════════════════════════════════════════════════════════════
-- Migration: Tabela investimentos_marketing (CAC/ROI Dashboard — Fase 1)
-- Issue: Feature "CAC/ROI Dashboard"
-- Aplica em todos os schemas (public, uat, dev)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   A BAUSA investe em anúncios mas não cruza gasto com leads/contratos.
--   Esta tabela armazena o gasto de marketing por canal/mês (input manual
--   na Fase 1; ingestão automática via Meta API na Fase 2 — source).
--   O dashboard /analytics/cac calcula CAC por lead/qualificado/cliente
--   e ROI por canal a partir desta tabela cruzada com form_submissions e
--   contratos_financeiros.
--
-- Padrão: RLS por papel (espelho de 20260401000700_crm_financeiro) +
--   DO blocks multi-schema (espelho de 20260515000000).
--   Sem enum novo: canal/source = TEXT + CHECK (evita ALTER TYPE
--   cross-schema). Valores monetários em BRL.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC SCHEMA (PRD) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.investimentos_marketing (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes           DATE NOT NULL,                                   -- sempre dia 01
  canal         TEXT NOT NULL CHECK (canal IN ('instagram','facebook','google','meta','tiktok','youtube','outro')),
  valor_gasto   NUMERIC(12,2) NOT NULL CHECK (valor_gasto >= 0), -- BRL
  impressoes    INTEGER CHECK (impressoes >= 0),
  cliques       INTEGER CHECK (cliques >= 0),
  leads_gerados INTEGER CHECK (leads_gerados >= 0),
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','meta_api')),
  observacao    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id),
  CONSTRAINT uq_invest_mes_canal_source UNIQUE (mes, canal, source)
);

COMMENT ON TABLE public.investimentos_marketing IS 'Gasto de marketing por canal/mês. source=manual (CEO) ou meta_api (Fase 2). Valores em BRL. Base do dashboard /analytics/cac.';
COMMENT ON COLUMN public.investimentos_marketing.mes IS 'Sempre o dia 01 do mês de referência (YYYY-MM-01).';
COMMENT ON COLUMN public.investimentos_marketing.source IS 'manual = inserido pelo CEO; meta_api = ingerido pela Cloud Function sync-meta-spend (Fase 2).';

-- Trigger updated_at (função compartilhada public.set_updated_at)
DROP TRIGGER IF EXISTS trg_invest_updated_at ON public.investimentos_marketing;
CREATE TRIGGER trg_invest_updated_at
  BEFORE UPDATE ON public.investimentos_marketing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger de auditoria (função genérica audit.log_change)
DROP TRIGGER IF EXISTS trg_audit_invest ON public.investimentos_marketing;
CREATE TRIGGER trg_audit_invest
  AFTER INSERT OR UPDATE OR DELETE ON public.investimentos_marketing
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- Índice parcial: otimiza a leitura do dashboard (ignora soft-deleted)
CREATE INDEX IF NOT EXISTS idx_invest_mes
  ON public.investimentos_marketing (mes)
  WHERE deleted_at IS NULL;

-- RLS: leitura para autenticados; escrita só CEO; service_role bypass
ALTER TABLE public.investimentos_marketing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invest_select" ON public.investimentos_marketing;
CREATE POLICY "invest_select" ON public.investimentos_marketing
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "invest_ceo" ON public.investimentos_marketing;
CREATE POLICY "invest_ceo" ON public.investimentos_marketing
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "invest_service" ON public.investimentos_marketing;
CREATE POLICY "invest_service" ON public.investimentos_marketing
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ─── UAT SCHEMA ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.investimentos_marketing (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mes           DATE NOT NULL,
        canal         TEXT NOT NULL CHECK (canal IN (''instagram'',''facebook'',''google'',''meta'',''tiktok'',''youtube'',''outro'')),
        valor_gasto   NUMERIC(12,2) NOT NULL CHECK (valor_gasto >= 0),
        impressoes    INTEGER CHECK (impressoes >= 0),
        cliques       INTEGER CHECK (cliques >= 0),
        leads_gerados INTEGER CHECK (leads_gerados >= 0),
        source        TEXT NOT NULL DEFAULT ''manual'' CHECK (source IN (''manual'',''meta_api'')),
        observacao    TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ,
        created_by    UUID,
        CONSTRAINT uq_invest_mes_canal_source UNIQUE (mes, canal, source)
      )';

    EXECUTE 'DROP TRIGGER IF EXISTS trg_invest_updated_at ON uat.investimentos_marketing';
    EXECUTE 'CREATE TRIGGER trg_invest_updated_at
      BEFORE UPDATE ON uat.investimentos_marketing
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';

    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_invest ON uat.investimentos_marketing';
    EXECUTE 'CREATE TRIGGER trg_audit_invest
      AFTER INSERT OR UPDATE OR DELETE ON uat.investimentos_marketing
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invest_mes
      ON uat.investimentos_marketing (mes) WHERE deleted_at IS NULL';

    EXECUTE 'ALTER TABLE uat.investimentos_marketing ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "invest_select" ON uat.investimentos_marketing';
    EXECUTE 'CREATE POLICY "invest_select" ON uat.investimentos_marketing
      FOR SELECT TO authenticated USING (deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "invest_ceo" ON uat.investimentos_marketing';
    EXECUTE 'CREATE POLICY "invest_ceo" ON uat.investimentos_marketing
      FOR ALL TO authenticated
      USING (public.get_user_papel() = ''ceo'')
      WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "invest_service" ON uat.investimentos_marketing';
    EXECUTE 'CREATE POLICY "invest_service" ON uat.investimentos_marketing
      FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;


-- ─── DEV SCHEMA ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.investimentos_marketing (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mes           DATE NOT NULL,
        canal         TEXT NOT NULL CHECK (canal IN (''instagram'',''facebook'',''google'',''meta'',''tiktok'',''youtube'',''outro'')),
        valor_gasto   NUMERIC(12,2) NOT NULL CHECK (valor_gasto >= 0),
        impressoes    INTEGER CHECK (impressoes >= 0),
        cliques       INTEGER CHECK (cliques >= 0),
        leads_gerados INTEGER CHECK (leads_gerados >= 0),
        source        TEXT NOT NULL DEFAULT ''manual'' CHECK (source IN (''manual'',''meta_api'')),
        observacao    TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ,
        created_by    UUID,
        CONSTRAINT uq_invest_mes_canal_source UNIQUE (mes, canal, source)
      )';

    EXECUTE 'DROP TRIGGER IF EXISTS trg_invest_updated_at ON dev.investimentos_marketing';
    EXECUTE 'CREATE TRIGGER trg_invest_updated_at
      BEFORE UPDATE ON dev.investimentos_marketing
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';

    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_invest ON dev.investimentos_marketing';
    EXECUTE 'CREATE TRIGGER trg_audit_invest
      AFTER INSERT OR UPDATE OR DELETE ON dev.investimentos_marketing
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_invest_mes
      ON dev.investimentos_marketing (mes) WHERE deleted_at IS NULL';

    EXECUTE 'ALTER TABLE dev.investimentos_marketing ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "invest_select" ON dev.investimentos_marketing';
    EXECUTE 'CREATE POLICY "invest_select" ON dev.investimentos_marketing
      FOR SELECT TO authenticated USING (deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "invest_ceo" ON dev.investimentos_marketing';
    EXECUTE 'CREATE POLICY "invest_ceo" ON dev.investimentos_marketing
      FOR ALL TO authenticated
      USING (public.get_user_papel() = ''ceo'')
      WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "invest_service" ON dev.investimentos_marketing';
    EXECUTE 'CREATE POLICY "invest_service" ON dev.investimentos_marketing
      FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
