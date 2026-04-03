-- ============================================================
-- CRM Bolsa Atleta USA — Migration 5: Responsáveis e Endereços
-- Responsável = pai/mãe do atleta. Entidade de deduplicação.
-- Múltiplos atletas (irmãos) vinculam ao mesmo responsável.
-- ============================================================

-- ── Extensão pg_trgm (necessária para busca fuzzy por nome) ──
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Endereços ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enderecos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pais         TEXT NOT NULL DEFAULT 'BR',   -- ISO 3166-1 alfa-2
  cep          TEXT,
  logradouro   TEXT,
  numero       TEXT,
  complemento  TEXT,
  bairro       TEXT,
  cidade       TEXT NOT NULL,
  estado       TEXT,                          -- UF para BR, state para US
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.enderecos IS 'Endereços de responsáveis/famílias';

DROP TRIGGER IF EXISTS trg_enderecos_updated_at ON public.enderecos;
CREATE TRIGGER trg_enderecos_updated_at
  BEFORE UPDATE ON public.enderecos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.enderecos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enderecos_authenticated" ON public.enderecos;
CREATE POLICY "enderecos_authenticated" ON public.enderecos
  FOR ALL TO authenticated
  USING (deleted_at IS NULL)
  WITH CHECK (true);

DROP POLICY IF EXISTS "enderecos_service" ON public.enderecos;
CREATE POLICY "enderecos_service" ON public.enderecos
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Responsáveis ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.responsaveis (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                  TEXT NOT NULL,
  email                 TEXT NOT NULL,
  whatsapp              TEXT NOT NULL,          -- Formato internacional E.164
  telefone_alternativo  TEXT,
  profissao             TEXT,
  parentesco            TEXT CHECK (parentesco IN ('pai', 'mae', 'outro')),
  endereco_id           UUID REFERENCES public.enderecos(id),
  -- Vínculo com formulário público (origem dos dados)
  form_submission_ids   UUID[] DEFAULT '{}',    -- Array de IDs de form_submissions
  -- LGPD
  consentimento_lgpd    BOOLEAN NOT NULL DEFAULT false,
  consentimento_lgpd_at TIMESTAMPTZ,
  aceite_whatsapp       BOOLEAN NOT NULL DEFAULT false,
  aceite_email          BOOLEAN NOT NULL DEFAULT false,
  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  created_by            UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.responsaveis IS 'Responsáveis legais dos atletas. Dedup por whatsapp/email.';
COMMENT ON COLUMN public.responsaveis.whatsapp IS 'Chave de deduplicação primária. Formato E.164.';
COMMENT ON COLUMN public.responsaveis.form_submission_ids IS 'IDs de form_submissions vinculados (origem do formulário público)';

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_responsaveis_updated_at ON public.responsaveis;
CREATE TRIGGER trg_responsaveis_updated_at
  BEFORE UPDATE ON public.responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Índices de deduplicação (UNIQUE garante que não existam duplicados)
CREATE UNIQUE INDEX IF NOT EXISTS idx_responsaveis_whatsapp
  ON public.responsaveis(whatsapp) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_responsaveis_email
  ON public.responsaveis(email) WHERE deleted_at IS NULL;

-- Índice para busca por nome
CREATE INDEX IF NOT EXISTS idx_responsaveis_nome
  ON public.responsaveis USING gin (nome gin_trgm_ops);

-- RLS
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer autenticado (CEO, Head, Comercial)
DROP POLICY IF EXISTS "responsaveis_select" ON public.responsaveis;
CREATE POLICY "responsaveis_select" ON public.responsaveis
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- INSERT/UPDATE: CEO e Head de Sucesso
DROP POLICY IF EXISTS "responsaveis_insert" ON public.responsaveis;
CREATE POLICY "responsaveis_insert" ON public.responsaveis
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel() IN ('ceo', 'head_sucesso'));

DROP POLICY IF EXISTS "responsaveis_update" ON public.responsaveis;
CREATE POLICY "responsaveis_update" ON public.responsaveis
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() IN ('ceo', 'head_sucesso'))
  WITH CHECK (public.get_user_papel() IN ('ceo', 'head_sucesso'));

-- DELETE (soft): apenas CEO
DROP POLICY IF EXISTS "responsaveis_delete" ON public.responsaveis;
CREATE POLICY "responsaveis_delete" ON public.responsaveis
  FOR DELETE TO authenticated
  USING (public.get_user_papel() = 'ceo');

-- service_role
DROP POLICY IF EXISTS "responsaveis_service" ON public.responsaveis;
CREATE POLICY "responsaveis_service" ON public.responsaveis
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
