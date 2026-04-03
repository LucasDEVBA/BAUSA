-- ============================================================
-- Notas Internas — comunicacao CEO <-> Head de Sucesso
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notas_internas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id          UUID REFERENCES public.deals(id),
  atleta_id        UUID REFERENCES public.atletas(id),
  experiencia_id   UUID REFERENCES public.crm_experiencia(id),
  autor_id         UUID NOT NULL REFERENCES public.user_profiles(id),
  conteudo         TEXT NOT NULL,
  menciona_ids     UUID[] DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

ALTER TABLE notas_internas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_select" ON notas_internas FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "notes_insert" ON notas_internas FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_notas_deal ON notas_internas(deal_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notas_atleta ON notas_internas(atleta_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notas_experiencia ON notas_internas(experiencia_id) WHERE deleted_at IS NULL;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_notas_internas_updated_at ON public.notas_internas;
CREATE TRIGGER trg_notas_internas_updated_at
  BEFORE UPDATE ON public.notas_internas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit trigger
DROP TRIGGER IF EXISTS trg_audit_notas_internas ON public.notas_internas;
CREATE TRIGGER trg_audit_notas_internas
  AFTER INSERT OR UPDATE OR DELETE ON public.notas_internas
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();
