-- ============================================================
-- CRM Bolsa Atleta USA — Fase 7: Documentos + FAQ
-- ============================================================

-- ── Documentos do Atleta ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documentos_atleta (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atleta_id       UUID NOT NULL REFERENCES public.atletas(id),
  escola_id       UUID REFERENCES public.escolas(id),
  tipo            TEXT NOT NULL,
  status          status_documento NOT NULL DEFAULT 'pendente',
  arquivo_url     TEXT,
  arquivo_nome    TEXT,
  data_upload     TIMESTAMPTZ,
  data_envio_escola DATE,
  deadline        DATE,
  observacao       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.documentos_atleta IS 'Documentos do atleta por escola. Checklist de admissão.';

DROP TRIGGER IF EXISTS trg_docs_updated_at ON public.documentos_atleta;
CREATE TRIGGER trg_docs_updated_at
  BEFORE UPDATE ON public.documentos_atleta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_docs_atleta ON public.documentos_atleta(atleta_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_docs_escola ON public.documentos_atleta(escola_id) WHERE escola_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_docs_status ON public.documentos_atleta(status) WHERE deleted_at IS NULL;

ALTER TABLE public.documentos_atleta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "docs_select" ON public.documentos_atleta;
CREATE POLICY "docs_select" ON public.documentos_atleta
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "docs_insert" ON public.documentos_atleta;
CREATE POLICY "docs_insert" ON public.documentos_atleta
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "docs_update" ON public.documentos_atleta;
CREATE POLICY "docs_update" ON public.documentos_atleta
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "docs_delete" ON public.documentos_atleta;
CREATE POLICY "docs_delete" ON public.documentos_atleta
  FOR DELETE TO authenticated USING (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "docs_service" ON public.documentos_atleta;
CREATE POLICY "docs_service" ON public.documentos_atleta
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── FAQ ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.faq_artigos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          TEXT NOT NULL,
  categoria       TEXT NOT NULL
                  CHECK (categoria IN ('visto','documentacao','embarque','adaptacao','financeiro','escola','saude','outros')),
  conteudo        TEXT NOT NULL,
  fases_aplicaveis TEXT[] DEFAULT '{}',
  acessos         INTEGER NOT NULL DEFAULT 0,
  arquivado       BOOLEAN NOT NULL DEFAULT false,
  criado_por      UUID REFERENCES auth.users(id),
  atualizado_por  UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.faq_artigos IS 'Base de conhecimento interna. Busca rápida + copiar para WhatsApp.';

DROP TRIGGER IF EXISTS trg_faq_updated_at ON public.faq_artigos;
CREATE TRIGGER trg_faq_updated_at
  BEFORE UPDATE ON public.faq_artigos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_faq_categoria ON public.faq_artigos(categoria) WHERE arquivado = false;
CREATE INDEX IF NOT EXISTS idx_faq_titulo ON public.faq_artigos USING gin (titulo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_faq_conteudo ON public.faq_artigos USING gin (conteudo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_faq_acessos ON public.faq_artigos(acessos DESC) WHERE arquivado = false;

ALTER TABLE public.faq_artigos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faq_select" ON public.faq_artigos;
CREATE POLICY "faq_select" ON public.faq_artigos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "faq_insert" ON public.faq_artigos;
CREATE POLICY "faq_insert" ON public.faq_artigos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "faq_update" ON public.faq_artigos;
CREATE POLICY "faq_update" ON public.faq_artigos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "faq_delete" ON public.faq_artigos;
CREATE POLICY "faq_delete" ON public.faq_artigos
  FOR DELETE TO authenticated USING (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "faq_service" ON public.faq_artigos;
CREATE POLICY "faq_service" ON public.faq_artigos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Audit triggers
DROP TRIGGER IF EXISTS trg_audit_docs ON public.documentos_atleta;
CREATE TRIGGER trg_audit_docs
  AFTER INSERT OR UPDATE OR DELETE ON public.documentos_atleta
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS trg_audit_faq ON public.faq_artigos;
CREATE TRIGGER trg_audit_faq
  AFTER INSERT OR UPDATE OR DELETE ON public.faq_artigos
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();
