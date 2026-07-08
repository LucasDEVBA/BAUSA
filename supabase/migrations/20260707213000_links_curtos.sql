-- ════════════════════════════════════════════════════════════════════════
-- Migration: links_curtos — encurtador de links UTM (esconde as UTMs)
-- Aplica em: public, uat, dev (multi-schema, DO blocks idempotentes)
-- ════════════════════════════════════════════════════════════════════════
--
-- O gerador de UTM (Engine → Analytics) passa a criar um link curto
-- bolsaatletausa.com/l/<slug> que redireciona (302) para a URL completa com
-- as UTMs — o link compartilhado fica limpo, o tracking continua intacto.
--
--   • Criação: CEO, pelo Engine (server action, RLS).
--   • Resolução do redirect: site público (apps/web /l/[slug]) via RPC
--     registrar_clique_link (SECURITY DEFINER) — incrementa cliques e devolve
--     o destino atomicamente, sem depender de RLS/anon direto na tabela.
--
-- Auditoria SÓ em INSERT/DELETE (cliques são UPDATE frequente — não inundar
-- audit_logs). Forward-only, idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.links_curtos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL,
  destino       TEXT NOT NULL,
  titulo        TEXT,
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_content   TEXT,
  utm_term      TEXT,
  cliques       INTEGER NOT NULL DEFAULT 0 CHECK (cliques >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID,
  CONSTRAINT uq_links_curtos_slug UNIQUE (slug),
  CONSTRAINT links_curtos_destino_http CHECK (destino ~* '^https?://')
);

COMMENT ON TABLE public.links_curtos IS 'Links curtos do gerador de UTM (bolsaatletausa.com/l/<slug>) — redireciona 302 para destino com UTMs, escondendo os parâmetros do link compartilhado.';

DROP TRIGGER IF EXISTS trg_links_curtos_updated_at ON public.links_curtos;
CREATE TRIGGER trg_links_curtos_updated_at
  BEFORE UPDATE ON public.links_curtos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auditoria apenas em criação/remoção (cliques são UPDATE frequente).
DROP TRIGGER IF EXISTS trg_audit_links_curtos ON public.links_curtos;
CREATE TRIGGER trg_audit_links_curtos
  AFTER INSERT OR DELETE ON public.links_curtos
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

CREATE INDEX IF NOT EXISTS idx_links_curtos_created_at ON public.links_curtos (created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE public.links_curtos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "links_curtos_select" ON public.links_curtos;
CREATE POLICY "links_curtos_select" ON public.links_curtos
  FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "links_curtos_ceo" ON public.links_curtos;
CREATE POLICY "links_curtos_ceo" ON public.links_curtos
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "links_curtos_service" ON public.links_curtos;
CREATE POLICY "links_curtos_service" ON public.links_curtos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RPC de resolução do redirect (incrementa clique + devolve destino).
-- NOTA (v1): cliques podem inflar com prefetch/bots (anon chama a RPC sem
-- rate limit). É métrica de vaidade — enumeração de slug é inviável
-- (32^7 ≈ 34 bi). Se a precisão importar no futuro: tabela append-only por
-- evento com dedup por IP/UA + janela, ou rate limit no edge.
CREATE OR REPLACE FUNCTION public.registrar_clique_link(p_slug TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_destino TEXT;
BEGIN
  UPDATE public.links_curtos
     SET cliques = cliques + 1
   WHERE slug = p_slug AND deleted_at IS NULL
   RETURNING destino INTO v_destino;
  RETURN v_destino;  -- NULL se slug inexistente/removido
END;
$$;
GRANT EXECUTE ON FUNCTION public.registrar_clique_link(TEXT) TO anon, authenticated, service_role;

-- ─── UAT ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.links_curtos (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug          TEXT NOT NULL,
        destino       TEXT NOT NULL,
        titulo        TEXT,
        utm_source    TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
        cliques       INTEGER NOT NULL DEFAULT 0 CHECK (cliques >= 0),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ,
        created_by    UUID,
        CONSTRAINT uq_links_curtos_slug UNIQUE (slug),
        CONSTRAINT links_curtos_destino_http CHECK (destino ~* ''^https?://'')
      )';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_links_curtos_updated_at ON uat.links_curtos';
    EXECUTE 'CREATE TRIGGER trg_links_curtos_updated_at BEFORE UPDATE ON uat.links_curtos
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_links_curtos ON uat.links_curtos';
    EXECUTE 'CREATE TRIGGER trg_audit_links_curtos AFTER INSERT OR DELETE ON uat.links_curtos
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_links_curtos_created_at ON uat.links_curtos (created_at DESC) WHERE deleted_at IS NULL';
    EXECUTE 'ALTER TABLE uat.links_curtos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "links_curtos_select" ON uat.links_curtos';
    EXECUTE 'CREATE POLICY "links_curtos_select" ON uat.links_curtos FOR SELECT TO authenticated USING (deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "links_curtos_ceo" ON uat.links_curtos';
    EXECUTE 'CREATE POLICY "links_curtos_ceo" ON uat.links_curtos FOR ALL TO authenticated
      USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "links_curtos_service" ON uat.links_curtos';
    EXECUTE 'CREATE POLICY "links_curtos_service" ON uat.links_curtos FOR ALL TO service_role USING (true) WITH CHECK (true)';
    -- Schemas custom NÃO herdam default privileges do Supabase (só public) —
    -- GRANT explícito p/ PostgREST não retornar 42501 (RLS segue como autorização).
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON uat.links_curtos TO authenticated';
    EXECUTE 'GRANT ALL ON uat.links_curtos TO service_role';
    EXECUTE '
      CREATE OR REPLACE FUNCTION uat.registrar_clique_link(p_slug TEXT)
      RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = uat AS $fn$
      DECLARE v_destino TEXT;
      BEGIN
        UPDATE uat.links_curtos SET cliques = cliques + 1
         WHERE slug = p_slug AND deleted_at IS NULL RETURNING destino INTO v_destino;
        RETURN v_destino;
      END; $fn$';
    EXECUTE 'GRANT EXECUTE ON FUNCTION uat.registrar_clique_link(TEXT) TO anon, authenticated, service_role';
  END IF;
END $$;

-- ─── DEV ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.links_curtos (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug          TEXT NOT NULL,
        destino       TEXT NOT NULL,
        titulo        TEXT,
        utm_source    TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
        cliques       INTEGER NOT NULL DEFAULT 0 CHECK (cliques >= 0),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ,
        created_by    UUID,
        CONSTRAINT uq_links_curtos_slug UNIQUE (slug),
        CONSTRAINT links_curtos_destino_http CHECK (destino ~* ''^https?://'')
      )';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_links_curtos_updated_at ON dev.links_curtos';
    EXECUTE 'CREATE TRIGGER trg_links_curtos_updated_at BEFORE UPDATE ON dev.links_curtos
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_links_curtos ON dev.links_curtos';
    EXECUTE 'CREATE TRIGGER trg_audit_links_curtos AFTER INSERT OR DELETE ON dev.links_curtos
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_links_curtos_created_at ON dev.links_curtos (created_at DESC) WHERE deleted_at IS NULL';
    EXECUTE 'ALTER TABLE dev.links_curtos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "links_curtos_select" ON dev.links_curtos';
    EXECUTE 'CREATE POLICY "links_curtos_select" ON dev.links_curtos FOR SELECT TO authenticated USING (deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "links_curtos_ceo" ON dev.links_curtos';
    EXECUTE 'CREATE POLICY "links_curtos_ceo" ON dev.links_curtos FOR ALL TO authenticated
      USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "links_curtos_service" ON dev.links_curtos';
    EXECUTE 'CREATE POLICY "links_curtos_service" ON dev.links_curtos FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON dev.links_curtos TO authenticated';
    EXECUTE 'GRANT ALL ON dev.links_curtos TO service_role';
    EXECUTE '
      CREATE OR REPLACE FUNCTION dev.registrar_clique_link(p_slug TEXT)
      RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = dev AS $fn$
      DECLARE v_destino TEXT;
      BEGIN
        UPDATE dev.links_curtos SET cliques = cliques + 1
         WHERE slug = p_slug AND deleted_at IS NULL RETURNING destino INTO v_destino;
        RETURN v_destino;
      END; $fn$';
    EXECUTE 'GRANT EXECUTE ON FUNCTION dev.registrar_clique_link(TEXT) TO anon, authenticated, service_role';
  END IF;
END $$;
