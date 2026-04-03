-- ============================================================
-- CRM Bolsa Atleta USA — Migration 7: Deals (Pipeline Comercial)
-- Oportunidades comerciais. 14 etapas + 2 especiais.
-- Regra: next_action e data_proxima_acao obrigatórios para avançar.
-- ============================================================

-- Ordem das etapas (para detectar retrocesso)
CREATE OR REPLACE FUNCTION public.ordem_etapa(p_etapa status_deal)
RETURNS INTEGER AS $$
  SELECT CASE p_etapa
    WHEN 'lead'                    THEN 1
    WHEN 'reuniao_marcada'         THEN 2
    WHEN 'reuniao_realizada'       THEN 3
    WHEN 'diagnostico_fit'         THEN 4
    WHEN 'alinhamento_estrategico' THEN 5
    WHEN 'proposta_enviada'        THEN 6
    WHEN 'followup_proposta'       THEN 7
    WHEN 'negociacao'              THEN 8
    WHEN 'contrato_enviado'        THEN 9
    WHEN 'contrato_assinado'       THEN 10
    WHEN 'sinal_pago'              THEN 11
    WHEN 'admission_process'       THEN 12
    WHEN 'concluido'               THEN 13
    WHEN 'perdido'                 THEN 14
    WHEN 'cancelamento_solicitado' THEN 15
    WHEN 'projeto_futuro'          THEN 16
    ELSE 0
  END;
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE IF NOT EXISTS public.deals (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atleta_id                 UUID NOT NULL REFERENCES public.atletas(id),
  -- Pipeline
  etapa                     status_deal NOT NULL DEFAULT 'lead',
  etapa_anterior            status_deal,
  responsavel_id            UUID NOT NULL REFERENCES public.user_profiles(id),
  -- Valores
  valor_estimado            NUMERIC(10,2),
  probabilidade_fechamento  INTEGER CHECK (probabilidade_fechamento >= 0 AND probabilidade_fechamento <= 100),
  -- Contexto da negociação
  status_decisao_familia    decisao_familiar,
  notas_reuniao             TEXT,
  next_action               TEXT,
  data_proxima_acao         DATE,
  -- Perda
  motivo_perda              motivo_perda,
  detalhe_perda             TEXT,
  pode_reativar             BOOLEAN,
  data_reativacao           DATE,
  motivo_retrocesso         TEXT,       -- Obrigatório quando etapa retrocede
  -- Flags
  flag_retrocedido          BOOLEAN NOT NULL DEFAULT false,
  flag_valores_customizados BOOLEAN NOT NULL DEFAULT false,
  -- Datas de marcos
  reuniao_realizada_at      TIMESTAMPTZ,
  contrato_enviado_at       TIMESTAMPTZ,
  contrato_assinado_at      TIMESTAMPTZ,
  sinal_pago_at             TIMESTAMPTZ,
  sinal_pago_confirmado_por UUID REFERENCES auth.users(id),
  -- Integrações externas
  docusign_envelope_id      TEXT,
  docusign_status           status_contrato_assinatura DEFAULT 'nao_enviado',
  google_calendar_event_id  TEXT,
  -- Projeto futuro
  projeto_futuro_ano        INTEGER,
  projeto_futuro_data_reativacao DATE,
  safra                     TEXT,
  -- Audit
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                TIMESTAMPTZ,
  created_by                UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.deals IS 'Oportunidades comerciais do pipeline. 14 etapas + projeto_futuro + cancelamento.';
COMMENT ON COLUMN public.deals.next_action IS 'Próxima ação obrigatória para avançar de etapa (Regra 2).';
COMMENT ON COLUMN public.deals.motivo_retrocesso IS 'Obrigatório quando a etapa retrocede (Regra 5).';

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_deals_updated_at ON public.deals;
CREATE TRIGGER trg_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Trigger: detectar retrocesso de etapa ────────────────────
CREATE OR REPLACE FUNCTION public.trg_deals_check_etapa()
RETURNS TRIGGER AS $$
BEGIN
  -- Só processa se a etapa mudou
  IF OLD.etapa IS DISTINCT FROM NEW.etapa THEN
    -- Salva etapa anterior
    NEW.etapa_anterior := OLD.etapa;

    -- Detecta retrocesso (nova etapa tem ordem menor que a anterior)
    IF public.ordem_etapa(NEW.etapa) < public.ordem_etapa(OLD.etapa)
       AND NEW.etapa NOT IN ('perdido', 'cancelamento_solicitado', 'projeto_futuro') THEN
      NEW.flag_retrocedido := true;
      -- motivo_retrocesso é validado na camada de aplicação
      -- (constraint CHECK não funciona bem aqui pois depende de OLD)
    END IF;

    -- Seta timestamps de marcos
    IF NEW.etapa = 'reuniao_realizada' AND OLD.etapa != 'reuniao_realizada' THEN
      NEW.reuniao_realizada_at := COALESCE(NEW.reuniao_realizada_at, NOW());
    END IF;
    IF NEW.etapa = 'contrato_enviado' AND OLD.etapa != 'contrato_enviado' THEN
      NEW.contrato_enviado_at := COALESCE(NEW.contrato_enviado_at, NOW());
    END IF;
    IF NEW.etapa = 'contrato_assinado' AND OLD.etapa != 'contrato_assinado' THEN
      NEW.contrato_assinado_at := COALESCE(NEW.contrato_assinado_at, NOW());
    END IF;
    IF NEW.etapa = 'sinal_pago' AND OLD.etapa != 'sinal_pago' THEN
      NEW.sinal_pago_at := COALESCE(NEW.sinal_pago_at, NOW());
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deals_check_etapa ON public.deals;
CREATE TRIGGER trg_deals_check_etapa
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.trg_deals_check_etapa();

-- Índices
CREATE INDEX IF NOT EXISTS idx_deals_atleta ON public.deals(atleta_id);
CREATE INDEX IF NOT EXISTS idx_deals_etapa ON public.deals(etapa) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_responsavel ON public.deals(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_deals_data_proxima_acao ON public.deals(data_proxima_acao) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_sinal_pago ON public.deals(sinal_pago_at) WHERE sinal_pago_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_safra ON public.deals(safra) WHERE deleted_at IS NULL;

-- Índice parcial para War Room (deals ativos)
CREATE INDEX IF NOT EXISTS idx_deals_ativos ON public.deals(etapa, data_proxima_acao)
  WHERE deleted_at IS NULL AND etapa NOT IN ('perdido', 'concluido', 'cancelamento_solicitado');

-- RLS
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer autenticado (Head vê em modo leitura)
DROP POLICY IF EXISTS "deals_select" ON public.deals;
CREATE POLICY "deals_select" ON public.deals
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- INSERT: apenas CEO
DROP POLICY IF EXISTS "deals_insert" ON public.deals;
CREATE POLICY "deals_insert" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel() = 'ceo');

-- UPDATE: apenas CEO (Head não pode mover pipeline)
DROP POLICY IF EXISTS "deals_update" ON public.deals;
CREATE POLICY "deals_update" ON public.deals
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');

-- DELETE (soft): apenas CEO
DROP POLICY IF EXISTS "deals_delete" ON public.deals;
CREATE POLICY "deals_delete" ON public.deals
  FOR DELETE TO authenticated
  USING (public.get_user_papel() = 'ceo');

-- service_role
DROP POLICY IF EXISTS "deals_service" ON public.deals;
CREATE POLICY "deals_service" ON public.deals
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
