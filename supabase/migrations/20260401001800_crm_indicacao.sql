-- ============================================================
-- CRM Bolsa Atleta USA — Programa de Indicação
-- ============================================================

CREATE TABLE IF NOT EXISTS public.indicacoes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  responsavel_indicador_id  UUID NOT NULL REFERENCES public.responsaveis(id),
  atleta_indicado_id        UUID NOT NULL REFERENCES public.atletas(id),
  status                    TEXT NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente','em_negociacao','convertido','perdido')),
  recompensa_devida         BOOLEAN NOT NULL DEFAULT false,
  recompensa_entregue       BOOLEAN NOT NULL DEFAULT false,
  recompensa_entregue_at    TIMESTAMPTZ,
  recompensa_descricao      TEXT,
  observacao                TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                TIMESTAMPTZ,
  created_by                UUID REFERENCES auth.users(id)
);

DROP TRIGGER IF EXISTS trg_indicacoes_updated_at ON public.indicacoes;
CREATE TRIGGER trg_indicacoes_updated_at
  BEFORE UPDATE ON public.indicacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_indicacoes_indicador ON public.indicacoes(responsavel_indicador_id);
CREATE INDEX IF NOT EXISTS idx_indicacoes_atleta ON public.indicacoes(atleta_indicado_id);
CREATE INDEX IF NOT EXISTS idx_indicacoes_status ON public.indicacoes(status) WHERE deleted_at IS NULL;

ALTER TABLE public.indicacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "indicacoes_select" ON public.indicacoes;
CREATE POLICY "indicacoes_select" ON public.indicacoes
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "indicacoes_ceo" ON public.indicacoes;
CREATE POLICY "indicacoes_ceo" ON public.indicacoes
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "indicacoes_service" ON public.indicacoes;
CREATE POLICY "indicacoes_service" ON public.indicacoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Audit
DROP TRIGGER IF EXISTS trg_audit_indicacoes ON public.indicacoes;
CREATE TRIGGER trg_audit_indicacoes
  AFTER INSERT OR UPDATE OR DELETE ON public.indicacoes
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();
