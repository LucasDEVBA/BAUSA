-- ════════════════════════════════════════════════════════════════════════
-- Migration: Financeiro F1 — despesas (saídas) + colaboradores (folha)
-- Aplica em: public (PRD), uat, dev
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   O módulo financeiro só modelava ENTRADAS (contratos_financeiros + parcelas).
--   As SAÍDAS (custos fixos/variáveis) e a FOLHA viviam como constantes
--   hardcoded em apps/crm/src/app/(dashboard)/financeiro/page.tsx (FIXED_COSTS,
--   VARIABLE_COSTS). Esta migration cria a fundação de dados real:
--     • colaboradores  — folha (1 custo mensal por pessoa, já com encargos)
--     • despesas       — livro-razão de saídas, avulsas e recorrentes (template)
--   Base do DRE, Fluxo de Caixa e das métricas reais (F3).
--
-- Modelo de recorrência (decisão do CEO — "template"):
--   Uma despesa com recorrente=true é um TEMPLATE mensal (não é um pagamento
--   em si). A cada mês ela é projetada no fluxo/DRE; ao confirmar o pagamento
--   daquele mês cria-se uma despesa REALIZADA (recorrente=false) que aponta
--   para o template via despesa_origem_id (mesmo padrão contrato→parcelas).
--
-- Padrão: espelha 20260604220112_create_investimentos_marketing.sql
--   (TEXT+CHECK em vez de enum novo; DO blocks multi-schema; trio RLS;
--   triggers set_updated_at + audit.log_change; índices parciais).
--   Valores em BRL. Forward-only, idempotente.
-- ════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════
-- PUBLIC SCHEMA (PRD)
-- ════════════════════════════════════════════════════════════════════════

-- ─── colaboradores (folha) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              TEXT NOT NULL,
  cargo             TEXT,
  tipo_contrato     TEXT NOT NULL DEFAULT 'clt'
                      CHECK (tipo_contrato IN ('clt','pj','socio','estagio','outro')),
  custo_mensal_brl  NUMERIC(12,2) NOT NULL CHECK (custo_mensal_brl >= 0), -- total já com encargos
  ativo             BOOLEAN NOT NULL DEFAULT true,
  data_admissao     DATE,
  data_desligamento DATE,
  observacao        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.colaboradores IS 'Folha de pagamento (modelo simples): 1 custo mensal total por pessoa, já com encargos. Alimenta a folha do DRE/fluxo de caixa.';
COMMENT ON COLUMN public.colaboradores.custo_mensal_brl IS 'Custo mensal TOTAL da pessoa para a empresa (salário + encargos + benefícios), em BRL.';

DROP TRIGGER IF EXISTS trg_colaboradores_updated_at ON public.colaboradores;
CREATE TRIGGER trg_colaboradores_updated_at
  BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_colaboradores ON public.colaboradores;
CREATE TRIGGER trg_audit_colaboradores
  AFTER INSERT OR UPDATE OR DELETE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

CREATE INDEX IF NOT EXISTS idx_colaboradores_ativo
  ON public.colaboradores (ativo) WHERE deleted_at IS NULL;

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colaboradores_select" ON public.colaboradores;
CREATE POLICY "colaboradores_select" ON public.colaboradores
  FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "colaboradores_ceo" ON public.colaboradores;
CREATE POLICY "colaboradores_ceo" ON public.colaboradores
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "colaboradores_service" ON public.colaboradores;
CREATE POLICY "colaboradores_service" ON public.colaboradores
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── despesas (saídas: avulsas + templates recorrentes) ─────────────────
CREATE TABLE IF NOT EXISTS public.despesas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao         TEXT NOT NULL,
  categoria         TEXT NOT NULL
                      CHECK (categoria IN ('folha','marketing','ferramentas','servicos','impostos','comissoes','ocupacao','outros')),
  tipo              TEXT NOT NULL DEFAULT 'fixa' CHECK (tipo IN ('fixa','variavel')),
  valor_brl         NUMERIC(12,2) NOT NULL CHECK (valor_brl >= 0),
  competencia       DATE NOT NULL,                       -- 1º dia do mês de competência (regime de competência)
  vencimento        DATE,                                -- data prevista de pagamento (regime de caixa)
  status            TEXT NOT NULL DEFAULT 'previsto'
                      CHECK (status IN ('previsto','pago','atrasado','cancelado')),
  pago_at           TIMESTAMPTZ,
  metodo            TEXT CHECK (metodo IN ('pix','boleto','cartao','transferencia','debito_automatico','dinheiro','outro')),
  fornecedor        TEXT,
  recorrente        BOOLEAN NOT NULL DEFAULT false,      -- true = TEMPLATE mensal (não é um pagamento em si)
  recorrencia_dia   INTEGER CHECK (recorrencia_dia BETWEEN 1 AND 28),
  recorrencia_ativa BOOLEAN NOT NULL DEFAULT true,       -- template ligado/desligado
  despesa_origem_id UUID REFERENCES public.despesas(id), -- instância realizada → template de origem
  colaborador_id    UUID REFERENCES public.colaboradores(id), -- quando a saída é folha de uma pessoa específica
  comprovante_url   TEXT,
  observacao        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.despesas IS 'Saídas financeiras (livro-razão). Avulsas ou templates recorrentes. recorrente=true é um template mensal; a instância paga do mês aponta para ele via despesa_origem_id.';
COMMENT ON COLUMN public.despesas.competencia IS '1º dia do mês de competência (regime de competência para o DRE). Para template recorrente = mês de início da recorrência.';
COMMENT ON COLUMN public.despesas.recorrente IS 'true = TEMPLATE mensal projetado no fluxo/DRE todo mês; a confirmação de pagamento cria uma despesa realizada (recorrente=false, despesa_origem_id=este).';

DROP TRIGGER IF EXISTS trg_despesas_updated_at ON public.despesas;
CREATE TRIGGER trg_despesas_updated_at
  BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_despesas ON public.despesas;
CREATE TRIGGER trg_audit_despesas
  AFTER INSERT OR UPDATE OR DELETE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

CREATE INDEX IF NOT EXISTS idx_despesas_competencia
  ON public.despesas (competencia) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_despesas_categoria
  ON public.despesas (categoria) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_despesas_recorrente
  ON public.despesas (recorrencia_ativa) WHERE recorrente = true AND deleted_at IS NULL;
-- Único (origem, competência): garante 1 instância materializada por template/mês
-- (idempotência da efetivação sob concorrência) e serve as buscas por origem.
CREATE UNIQUE INDEX IF NOT EXISTS uq_despesas_origem_competencia
  ON public.despesas (despesa_origem_id, competencia)
  WHERE despesa_origem_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "despesas_select" ON public.despesas;
CREATE POLICY "despesas_select" ON public.despesas
  FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "despesas_ceo" ON public.despesas;
CREATE POLICY "despesas_ceo" ON public.despesas
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "despesas_service" ON public.despesas;
CREATE POLICY "despesas_service" ON public.despesas
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════════════
-- UAT SCHEMA
-- ════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    -- colaboradores
    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.colaboradores (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome              TEXT NOT NULL,
        cargo             TEXT,
        tipo_contrato     TEXT NOT NULL DEFAULT ''clt''
                            CHECK (tipo_contrato IN (''clt'',''pj'',''socio'',''estagio'',''outro'')),
        custo_mensal_brl  NUMERIC(12,2) NOT NULL CHECK (custo_mensal_brl >= 0),
        ativo             BOOLEAN NOT NULL DEFAULT true,
        data_admissao     DATE,
        data_desligamento DATE,
        observacao        TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at        TIMESTAMPTZ,
        created_by        UUID
      )';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_colaboradores_updated_at ON uat.colaboradores';
    EXECUTE 'CREATE TRIGGER trg_colaboradores_updated_at BEFORE UPDATE ON uat.colaboradores
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_colaboradores ON uat.colaboradores';
    EXECUTE 'CREATE TRIGGER trg_audit_colaboradores AFTER INSERT OR UPDATE OR DELETE ON uat.colaboradores
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_colaboradores_ativo ON uat.colaboradores (ativo) WHERE deleted_at IS NULL';
    EXECUTE 'ALTER TABLE uat.colaboradores ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "colaboradores_select" ON uat.colaboradores';
    EXECUTE 'CREATE POLICY "colaboradores_select" ON uat.colaboradores FOR SELECT TO authenticated USING (deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "colaboradores_ceo" ON uat.colaboradores';
    EXECUTE 'CREATE POLICY "colaboradores_ceo" ON uat.colaboradores FOR ALL TO authenticated
      USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "colaboradores_service" ON uat.colaboradores';
    EXECUTE 'CREATE POLICY "colaboradores_service" ON uat.colaboradores FOR ALL TO service_role USING (true) WITH CHECK (true)';

    -- despesas
    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.despesas (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        descricao         TEXT NOT NULL,
        categoria         TEXT NOT NULL
                            CHECK (categoria IN (''folha'',''marketing'',''ferramentas'',''servicos'',''impostos'',''comissoes'',''ocupacao'',''outros'')),
        tipo              TEXT NOT NULL DEFAULT ''fixa'' CHECK (tipo IN (''fixa'',''variavel'')),
        valor_brl         NUMERIC(12,2) NOT NULL CHECK (valor_brl >= 0),
        competencia       DATE NOT NULL,
        vencimento        DATE,
        status            TEXT NOT NULL DEFAULT ''previsto''
                            CHECK (status IN (''previsto'',''pago'',''atrasado'',''cancelado'')),
        pago_at           TIMESTAMPTZ,
        metodo            TEXT CHECK (metodo IN (''pix'',''boleto'',''cartao'',''transferencia'',''debito_automatico'',''dinheiro'',''outro'')),
        fornecedor        TEXT,
        recorrente        BOOLEAN NOT NULL DEFAULT false,
        recorrencia_dia   INTEGER CHECK (recorrencia_dia BETWEEN 1 AND 28),
        recorrencia_ativa BOOLEAN NOT NULL DEFAULT true,
        despesa_origem_id UUID REFERENCES uat.despesas(id),
        colaborador_id    UUID REFERENCES uat.colaboradores(id),
        comprovante_url   TEXT,
        observacao        TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at        TIMESTAMPTZ,
        created_by        UUID
      )';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_despesas_updated_at ON uat.despesas';
    EXECUTE 'CREATE TRIGGER trg_despesas_updated_at BEFORE UPDATE ON uat.despesas
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_despesas ON uat.despesas';
    EXECUTE 'CREATE TRIGGER trg_audit_despesas AFTER INSERT OR UPDATE OR DELETE ON uat.despesas
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_despesas_competencia ON uat.despesas (competencia) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON uat.despesas (categoria) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_despesas_recorrente ON uat.despesas (recorrencia_ativa) WHERE recorrente = true AND deleted_at IS NULL';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_despesas_origem_competencia ON uat.despesas (despesa_origem_id, competencia) WHERE despesa_origem_id IS NOT NULL AND deleted_at IS NULL';
    EXECUTE 'ALTER TABLE uat.despesas ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "despesas_select" ON uat.despesas';
    EXECUTE 'CREATE POLICY "despesas_select" ON uat.despesas FOR SELECT TO authenticated USING (deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "despesas_ceo" ON uat.despesas';
    EXECUTE 'CREATE POLICY "despesas_ceo" ON uat.despesas FOR ALL TO authenticated
      USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "despesas_service" ON uat.despesas';
    EXECUTE 'CREATE POLICY "despesas_service" ON uat.despesas FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════════════
-- DEV SCHEMA
-- ════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    -- colaboradores
    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.colaboradores (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome              TEXT NOT NULL,
        cargo             TEXT,
        tipo_contrato     TEXT NOT NULL DEFAULT ''clt''
                            CHECK (tipo_contrato IN (''clt'',''pj'',''socio'',''estagio'',''outro'')),
        custo_mensal_brl  NUMERIC(12,2) NOT NULL CHECK (custo_mensal_brl >= 0),
        ativo             BOOLEAN NOT NULL DEFAULT true,
        data_admissao     DATE,
        data_desligamento DATE,
        observacao        TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at        TIMESTAMPTZ,
        created_by        UUID
      )';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_colaboradores_updated_at ON dev.colaboradores';
    EXECUTE 'CREATE TRIGGER trg_colaboradores_updated_at BEFORE UPDATE ON dev.colaboradores
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_colaboradores ON dev.colaboradores';
    EXECUTE 'CREATE TRIGGER trg_audit_colaboradores AFTER INSERT OR UPDATE OR DELETE ON dev.colaboradores
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_colaboradores_ativo ON dev.colaboradores (ativo) WHERE deleted_at IS NULL';
    EXECUTE 'ALTER TABLE dev.colaboradores ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "colaboradores_select" ON dev.colaboradores';
    EXECUTE 'CREATE POLICY "colaboradores_select" ON dev.colaboradores FOR SELECT TO authenticated USING (deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "colaboradores_ceo" ON dev.colaboradores';
    EXECUTE 'CREATE POLICY "colaboradores_ceo" ON dev.colaboradores FOR ALL TO authenticated
      USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "colaboradores_service" ON dev.colaboradores';
    EXECUTE 'CREATE POLICY "colaboradores_service" ON dev.colaboradores FOR ALL TO service_role USING (true) WITH CHECK (true)';

    -- despesas
    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.despesas (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        descricao         TEXT NOT NULL,
        categoria         TEXT NOT NULL
                            CHECK (categoria IN (''folha'',''marketing'',''ferramentas'',''servicos'',''impostos'',''comissoes'',''ocupacao'',''outros'')),
        tipo              TEXT NOT NULL DEFAULT ''fixa'' CHECK (tipo IN (''fixa'',''variavel'')),
        valor_brl         NUMERIC(12,2) NOT NULL CHECK (valor_brl >= 0),
        competencia       DATE NOT NULL,
        vencimento        DATE,
        status            TEXT NOT NULL DEFAULT ''previsto''
                            CHECK (status IN (''previsto'',''pago'',''atrasado'',''cancelado'')),
        pago_at           TIMESTAMPTZ,
        metodo            TEXT CHECK (metodo IN (''pix'',''boleto'',''cartao'',''transferencia'',''debito_automatico'',''dinheiro'',''outro'')),
        fornecedor        TEXT,
        recorrente        BOOLEAN NOT NULL DEFAULT false,
        recorrencia_dia   INTEGER CHECK (recorrencia_dia BETWEEN 1 AND 28),
        recorrencia_ativa BOOLEAN NOT NULL DEFAULT true,
        despesa_origem_id UUID REFERENCES dev.despesas(id),
        colaborador_id    UUID REFERENCES dev.colaboradores(id),
        comprovante_url   TEXT,
        observacao        TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at        TIMESTAMPTZ,
        created_by        UUID
      )';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_despesas_updated_at ON dev.despesas';
    EXECUTE 'CREATE TRIGGER trg_despesas_updated_at BEFORE UPDATE ON dev.despesas
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_despesas ON dev.despesas';
    EXECUTE 'CREATE TRIGGER trg_audit_despesas AFTER INSERT OR UPDATE OR DELETE ON dev.despesas
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_despesas_competencia ON dev.despesas (competencia) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_despesas_categoria ON dev.despesas (categoria) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_despesas_recorrente ON dev.despesas (recorrencia_ativa) WHERE recorrente = true AND deleted_at IS NULL';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_despesas_origem_competencia ON dev.despesas (despesa_origem_id, competencia) WHERE despesa_origem_id IS NOT NULL AND deleted_at IS NULL';
    EXECUTE 'ALTER TABLE dev.despesas ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "despesas_select" ON dev.despesas';
    EXECUTE 'CREATE POLICY "despesas_select" ON dev.despesas FOR SELECT TO authenticated USING (deleted_at IS NULL)';
    EXECUTE 'DROP POLICY IF EXISTS "despesas_ceo" ON dev.despesas';
    EXECUTE 'CREATE POLICY "despesas_ceo" ON dev.despesas FOR ALL TO authenticated
      USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "despesas_service" ON dev.despesas';
    EXECUTE 'CREATE POLICY "despesas_service" ON dev.despesas FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════════════
-- SEED (public/PRD apenas) — migra os custos antes hardcoded em
-- financeiro/page.tsx para linhas reais e editáveis, para que a F2 possa
-- remover as constantes sem perder o que o CEO já via.
--   • Head de Sucesso (R$ 4.500) → colaborador (folha)
--   • 5 custos fixos não-folha → despesas recorrentes (templates mensais)
-- Os variáveis por contrato (psicóloga/suporte VIP) NÃO entram aqui: são
-- custo do contrato (contratos_financeiros.custo_psicologa) e virariam
-- dupla contagem. Idempotente (NOT EXISTS por descrição/recorrente).
-- ════════════════════════════════════════════════════════════════════════

-- Guard SEM `deleted_at IS NULL`: se o CEO apagar uma linha semeada, um rebuild
-- do banco não deve ressuscitá-la (idempotência real por descrição).
INSERT INTO public.colaboradores (nome, cargo, tipo_contrato, custo_mensal_brl, ativo)
SELECT 'Head de Sucesso', 'Head de Sucesso', 'clt', 4500.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.colaboradores WHERE nome = 'Head de Sucesso'
);

INSERT INTO public.despesas (descricao, categoria, tipo, valor_brl, competencia, recorrente, recorrencia_dia, recorrencia_ativa)
SELECT d.descricao, d.categoria, 'fixa', d.valor, date_trunc('month', CURRENT_DATE)::date, true, 5, true
FROM (VALUES
  ('IA / Ferramentas de IA',     'ferramentas', 800.00),
  ('Designer',                   'servicos',    2200.00),
  ('Infraestrutura / Hosting',   'ferramentas', 350.00),
  ('Marketing / Tráfego pago',   'marketing',   3000.00),
  ('Outros custos fixos',        'outros',      1200.00)
) AS d(descricao, categoria, valor)
WHERE NOT EXISTS (
  SELECT 1 FROM public.despesas p
  WHERE p.descricao = d.descricao AND p.recorrente = true
);
