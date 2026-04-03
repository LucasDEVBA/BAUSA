-- ============================================================
-- CRM Bolsa Atleta USA — Migration 8: Módulo Financeiro
-- Contratos financeiros (1:1 com deal) e parcelas (recebíveis).
-- Apenas CEO pode criar/editar. Customização requer justificativa.
-- ============================================================

-- ── Contratos Financeiros ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contratos_financeiros (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id                    UUID NOT NULL UNIQUE REFERENCES public.deals(id),
  -- Plano
  plano                      plano_tipo NOT NULL,
  forma_pagamento_plano      TEXT NOT NULL CHECK (forma_pagamento_plano IN ('padrao', 'pix_avista')),
  valor_total                NUMERIC(10,2) NOT NULL,
  -- Customização
  valor_customizado          NUMERIC(10,2),        -- Se diferente do padrão do plano
  justificativa_customizacao TEXT,                  -- Obrigatória se customizado (Regra 3)
  -- Entrada (sinal)
  entrada_valor              NUMERIC(10,2) NOT NULL DEFAULT 4500.00,
  entrada_forma              TEXT NOT NULL CHECK (entrada_forma IN ('pix', 'getnet_parcelado')),
  entrada_parcelas           INTEGER NOT NULL DEFAULT 1,
  entrada_paga               BOOLEAN NOT NULL DEFAULT false,
  entrada_paga_at            TIMESTAMPTZ,
  -- Saldo remanescente (calculado)
  saldo_remanescente         NUMERIC(10,2) GENERATED ALWAYS AS (valor_total - entrada_valor) STORED,
  saldo_forma                TEXT CHECK (saldo_forma IN ('pix_avista', 'getnet_parcelado')),
  saldo_parcelas             INTEGER,
  -- Serviços
  inclui_psicologa           BOOLEAN NOT NULL DEFAULT false,
  custo_psicologa            NUMERIC(10,2) DEFAULT 1200.00,
  -- Lucro estimado (atualizado por trigger)
  lucro_estimado             NUMERIC(10,2),
  -- NF
  nf_status                  TEXT NOT NULL DEFAULT 'pendente' CHECK (nf_status IN ('pendente', 'emitida', 'nao_aplicavel')),
  nf_numero                  TEXT,
  nf_emitida_at              TIMESTAMPTZ,
  nf_valor                   NUMERIC(10,2),
  -- Audit
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                 TIMESTAMPTZ,
  created_by                 UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.contratos_financeiros IS 'Contrato financeiro do deal. 1:1 com deals. Apenas CEO edita.';
COMMENT ON COLUMN public.contratos_financeiros.justificativa_customizacao IS 'Obrigatória quando valor difere do padrão do plano (Regra 3 — audit trail)';
COMMENT ON COLUMN public.contratos_financeiros.saldo_remanescente IS 'Calculado automaticamente: valor_total - entrada_valor';

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_contratos_updated_at ON public.contratos_financeiros;
CREATE TRIGGER trg_contratos_updated_at
  BEFORE UPDATE ON public.contratos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Parcelas (Recebíveis) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parcelas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id      UUID NOT NULL REFERENCES public.contratos_financeiros(id),
  tipo             TEXT NOT NULL CHECK (tipo IN ('entrada', 'saldo')),
  numero_parcela   TEXT NOT NULL,              -- ex: '1/6'
  valor            NUMERIC(10,2) NOT NULL,
  vencimento       DATE NOT NULL,
  metodo           TEXT NOT NULL CHECK (metodo IN ('pix', 'getnet')),
  status           status_parcela NOT NULL DEFAULT 'previsto',
  recebido_at      TIMESTAMPTZ,
  comprovante_url  TEXT,
  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.parcelas IS 'Agenda de recebíveis. Gerada ao criar contrato. CEO confirma recebimento.';

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_parcelas_updated_at ON public.parcelas;
CREATE TRIGGER trg_parcelas_updated_at
  BEFORE UPDATE ON public.parcelas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_contratos_deal ON public.contratos_financeiros(deal_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_contrato ON public.parcelas(contrato_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_vencimento ON public.parcelas(vencimento) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_parcelas_status ON public.parcelas(status) WHERE deleted_at IS NULL;

-- Índice parcial para War Room (parcelas atrasadas)
CREATE INDEX IF NOT EXISTS idx_parcelas_atrasadas ON public.parcelas(vencimento, contrato_id)
  WHERE status = 'atrasado' AND deleted_at IS NULL;

-- ── RLS: contratos e parcelas — apenas CEO ───────────────────
ALTER TABLE public.contratos_financeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;

-- Contratos
DROP POLICY IF EXISTS "contratos_select" ON public.contratos_financeiros;
CREATE POLICY "contratos_select" ON public.contratos_financeiros
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "contratos_ceo" ON public.contratos_financeiros;
CREATE POLICY "contratos_ceo" ON public.contratos_financeiros
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "contratos_service" ON public.contratos_financeiros;
CREATE POLICY "contratos_service" ON public.contratos_financeiros
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Parcelas
DROP POLICY IF EXISTS "parcelas_select" ON public.parcelas;
CREATE POLICY "parcelas_select" ON public.parcelas
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "parcelas_ceo" ON public.parcelas;
CREATE POLICY "parcelas_ceo" ON public.parcelas
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "parcelas_service" ON public.parcelas;
CREATE POLICY "parcelas_service" ON public.parcelas
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
