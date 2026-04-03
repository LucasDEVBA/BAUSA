-- ============================================================
-- CRM Bolsa Atleta USA — CRM Experiência da Família
-- Registro pós-venda. Criado automaticamente quando sinal é pago.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.crm_experiencia (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atleta_id              UUID NOT NULL UNIQUE REFERENCES public.atletas(id),
  deal_id                UUID NOT NULL REFERENCES public.deals(id),
  fase                   fase_experiencia NOT NULL DEFAULT 'admissao',
  temperatura            temperatura_familia NOT NULL DEFAULT 'verde',
  ansiedade              INTEGER DEFAULT 3 CHECK (ansiedade >= 1 AND ansiedade <= 5),
  satisfacao             INTEGER DEFAULT 5 CHECK (satisfacao >= 1 AND satisfacao <= 5),
  risco_percebido        INTEGER DEFAULT 1 CHECK (risco_percebido >= 1 AND risco_percebido <= 5),
  tipos_risco            TEXT[] DEFAULT '{}',
  status                 TEXT NOT NULL DEFAULT 'satisfeita'
                         CHECK (status IN ('satisfeita', 'atencao', 'crise')),
  descricao_problema     TEXT,
  acao_em_andamento      TEXT,
  tipo_crise             tipo_crise,
  nivel_crise            nivel_crise,
  psicologa_acionada     BOOLEAN NOT NULL DEFAULT false,
  psicologa_acionada_at  TIMESTAMPTZ,
  data_ultimo_contato    TIMESTAMPTZ,
  tipo_ultimo_contato    canal_comunicacao,
  proximo_contato        TIMESTAMPTZ,
  data_prevista_embarque DATE,
  escola_confirmada_id   UUID,  -- FK → escolas será adicionada na Fase 4 quando a tabela existir
  nps_6meses             INTEGER CHECK (nps_6meses >= 1 AND nps_6meses <= 10),
  nps_enviado_at         TIMESTAMPTZ,
  retencao_segundo_ano   BOOLEAN,
  indicacoes_geradas     INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at             TIMESTAMPTZ,
  created_by             UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.crm_experiencia IS 'Registro de experiência pós-venda. 1:1 com atleta. Handoff automático.';

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_crm_experiencia_updated_at ON public.crm_experiencia;
CREATE TRIGGER trg_crm_experiencia_updated_at
  BEFORE UPDATE ON public.crm_experiencia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: temperatura automática (Regra 8)
CREATE OR REPLACE FUNCTION public.trg_experiencia_temperatura()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ansiedade >= 4 OR NEW.satisfacao <= 2 THEN
    NEW.temperatura := 'vermelho';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_experiencia_temp ON public.crm_experiencia;
CREATE TRIGGER trg_experiencia_temp
  BEFORE INSERT OR UPDATE OF ansiedade, satisfacao ON public.crm_experiencia
  FOR EACH ROW EXECUTE FUNCTION public.trg_experiencia_temperatura();

-- Índices
CREATE INDEX IF NOT EXISTS idx_crm_experiencia_atleta ON public.crm_experiencia(atleta_id);
CREATE INDEX IF NOT EXISTS idx_crm_experiencia_fase ON public.crm_experiencia(fase) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_experiencia_temperatura ON public.crm_experiencia(temperatura) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_experiencia_status ON public.crm_experiencia(status) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE public.crm_experiencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exp_select" ON public.crm_experiencia;
CREATE POLICY "exp_select" ON public.crm_experiencia
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "exp_insert" ON public.crm_experiencia;
CREATE POLICY "exp_insert" ON public.crm_experiencia
  FOR INSERT TO authenticated WITH CHECK (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "exp_update" ON public.crm_experiencia;
CREATE POLICY "exp_update" ON public.crm_experiencia
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() IN ('ceo', 'head_sucesso'))
  WITH CHECK (public.get_user_papel() IN ('ceo', 'head_sucesso'));

DROP POLICY IF EXISTS "exp_delete" ON public.crm_experiencia;
CREATE POLICY "exp_delete" ON public.crm_experiencia
  FOR DELETE TO authenticated USING (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "exp_service" ON public.crm_experiencia;
CREATE POLICY "exp_service" ON public.crm_experiencia
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Contatos da Experiência ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contatos_experiencia (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiencia_id   UUID NOT NULL REFERENCES public.crm_experiencia(id),
  tipo             canal_comunicacao NOT NULL,
  resumo           TEXT NOT NULL,
  proximo_contato  TIMESTAMPTZ,
  registrado_por   UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id)
);

DROP TRIGGER IF EXISTS trg_contatos_exp_updated_at ON public.contatos_experiencia;
CREATE TRIGGER trg_contatos_exp_updated_at
  BEFORE UPDATE ON public.contatos_experiencia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_contatos_exp_experiencia ON public.contatos_experiencia(experiencia_id);

ALTER TABLE public.contatos_experiencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contatos_exp_select" ON public.contatos_experiencia;
CREATE POLICY "contatos_exp_select" ON public.contatos_experiencia
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "contatos_exp_insert" ON public.contatos_experiencia;
CREATE POLICY "contatos_exp_insert" ON public.contatos_experiencia
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "contatos_exp_update" ON public.contatos_experiencia;
CREATE POLICY "contatos_exp_update" ON public.contatos_experiencia
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "contatos_exp_service" ON public.contatos_experiencia;
CREATE POLICY "contatos_exp_service" ON public.contatos_experiencia
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Audit triggers
DROP TRIGGER IF EXISTS trg_audit_crm_experiencia ON public.crm_experiencia;
CREATE TRIGGER trg_audit_crm_experiencia
  AFTER INSERT OR UPDATE OR DELETE ON public.crm_experiencia
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS trg_audit_contatos_exp ON public.contatos_experiencia;
CREATE TRIGGER trg_audit_contatos_exp
  AFTER INSERT OR UPDATE OR DELETE ON public.contatos_experiencia
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();
