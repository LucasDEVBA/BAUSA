-- ============================================================
-- CRM Bolsa Atleta USA — Fase 4: Banco de Escolas
-- Base institucional. Cadastro manual pelo CEO.
-- Inclui estratégia de escolas por atleta.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.escolas (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                        TEXT NOT NULL,
  estado_us                   TEXT NOT NULL,
  cidade                      TEXT NOT NULL,
  tipo                        TEXT NOT NULL CHECK (tipo IN ('boarding','day','mista')),
  status                      TEXT NOT NULL DEFAULT 'ativa'
                              CHECK (status IN ('ativa','inativa','em_analise')),
  website                     TEXT,
  notas_internas              TEXT,
  -- Regras financeiras
  budget_minimo_usd           NUMERIC(10,2),
  budget_forte_usd            NUMERIC(10,2),
  agressividade_bolsa         agressividade_bolsa,
  regra_pratica               TEXT,
  -- Regras acadêmicas
  ingles_minimo               nivel_ingles DEFAULT 'intermediario',
  testes_exigidos             TEXT[] DEFAULT '{}',
  nota_minima_duolingo        INTEGER,
  nota_minima_psat            INTEGER,
  nota_minima_ssat            INTEGER,
  gpa_minimo                  NUMERIC(3,2),
  -- Regras esportivas
  esportes_oferecidos         TEXT[] DEFAULT '{}',
  influencia_esporte          influencia_esporte DEFAULT 'moderada',
  aceita_excecao_elite        BOOLEAN DEFAULT false,
  nota_esporte                TEXT,
  -- Regras por série
  series_preferenciais        TEXT[] DEFAULT '{}',
  serie_maxima                TEXT DEFAULT '12th',
  nota_series                 TEXT,
  -- Deadlines
  deadline_fall               DATE,
  deadline_spring             DATE,
  rolling_admission           BOOLEAN DEFAULT false,
  tempo_medio_resposta        INTEGER,
  -- Histórico (calculado)
  total_aplicados             INTEGER NOT NULL DEFAULT 0,
  total_aceitos               INTEGER NOT NULL DEFAULT 0,
  taxa_aceitacao              NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_aplicados > 0
    THEN (total_aceitos::NUMERIC / total_aplicados * 100)
    ELSE 0 END
  ) STORED,
  bolsa_media_obtida          NUMERIC(5,2),
  -- Relacionamento BAUSA
  admissions_officer_nome     TEXT,
  admissions_officer_email    TEXT,
  admissions_officer_telefone TEXT,
  temperatura_relacionamento  TEXT DEFAULT 'neutro'
                              CHECK (temperatura_relacionamento IN ('forte','bom','neutro','frio')),
  ultimo_contato_at           DATE,
  proximo_contato_at          DATE,
  tipo_ultimo_contato         TEXT,
  notas_relacionamento        TEXT,
  -- Padrão
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                  TIMESTAMPTZ,
  created_by                  UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.escolas IS 'Base institucional de escolas. Cadastro manual pelo CEO.';

DROP TRIGGER IF EXISTS trg_escolas_updated_at ON public.escolas;
CREATE TRIGGER trg_escolas_updated_at
  BEFORE UPDATE ON public.escolas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_escolas_status ON public.escolas(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_escolas_estado ON public.escolas(estado_us) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_escolas_tipo ON public.escolas(tipo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_escolas_nome ON public.escolas USING gin (nome gin_trgm_ops);

ALTER TABLE public.escolas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escolas_select" ON public.escolas;
CREATE POLICY "escolas_select" ON public.escolas
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "escolas_ceo" ON public.escolas;
CREATE POLICY "escolas_ceo" ON public.escolas
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "escolas_service" ON public.escolas;
CREATE POLICY "escolas_service" ON public.escolas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Histórico de contatos com escola ─────────────────────────
CREATE TABLE IF NOT EXISTS public.historico_contatos_escola (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escola_id   UUID NOT NULL REFERENCES public.escolas(id),
  data        DATE NOT NULL,
  tipo        TEXT NOT NULL,
  resumo      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,
  created_by  UUID REFERENCES auth.users(id)
);

DROP TRIGGER IF EXISTS trg_hist_escola_updated_at ON public.historico_contatos_escola;
CREATE TRIGGER trg_hist_escola_updated_at
  BEFORE UPDATE ON public.historico_contatos_escola
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_hist_escola ON public.historico_contatos_escola(escola_id);

ALTER TABLE public.historico_contatos_escola ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hist_escola_select" ON public.historico_contatos_escola;
CREATE POLICY "hist_escola_select" ON public.historico_contatos_escola
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "hist_escola_ceo" ON public.historico_contatos_escola;
CREATE POLICY "hist_escola_ceo" ON public.historico_contatos_escola
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "hist_escola_service" ON public.historico_contatos_escola;
CREATE POLICY "hist_escola_service" ON public.historico_contatos_escola
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Estratégia de escolas por atleta ─────────────────────────
CREATE TABLE IF NOT EXISTS public.estrategia_escolas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atleta_id           UUID NOT NULL REFERENCES public.atletas(id),
  escola_id           UUID NOT NULL REFERENCES public.escolas(id),
  match_score         INTEGER CHECK (match_score >= 0 AND match_score <= 100),
  prioridade          TEXT CHECK (prioridade IN ('primeira','segunda','terceira','safety')),
  status              TEXT NOT NULL DEFAULT 'planejamento'
                      CHECK (status IN ('pre_acordada','rede_ativa','planejamento','observacao_futura')),
  bolsa_estimada_pct  NUMERIC(5,2),
  bolsa_estimada_valor NUMERIC(10,2),
  bolsa_obtida_pct    NUMERIC(5,2),
  bolsa_obtida_valor  NUMERIC(10,2),
  data_aplicacao      DATE,
  data_resposta       DATE,
  resultado           TEXT NOT NULL DEFAULT 'nao_aplicado'
                      CHECK (resultado IN ('aceito','recusado','waitlist','pendente','nao_aplicado')),
  observacao          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES auth.users(id),
  UNIQUE(atleta_id, escola_id)
);

COMMENT ON TABLE public.estrategia_escolas IS 'Escolas-alvo por atleta. Criada após sinal pago.';

DROP TRIGGER IF EXISTS trg_estrategia_updated_at ON public.estrategia_escolas;
CREATE TRIGGER trg_estrategia_updated_at
  BEFORE UPDATE ON public.estrategia_escolas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_estrategia_atleta ON public.estrategia_escolas(atleta_id);
CREATE INDEX IF NOT EXISTS idx_estrategia_escola ON public.estrategia_escolas(escola_id);
CREATE INDEX IF NOT EXISTS idx_estrategia_resultado ON public.estrategia_escolas(resultado) WHERE deleted_at IS NULL;

ALTER TABLE public.estrategia_escolas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estrategia_select" ON public.estrategia_escolas;
CREATE POLICY "estrategia_select" ON public.estrategia_escolas
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "estrategia_ceo" ON public.estrategia_escolas;
CREATE POLICY "estrategia_ceo" ON public.estrategia_escolas
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "estrategia_service" ON public.estrategia_escolas;
CREATE POLICY "estrategia_service" ON public.estrategia_escolas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── FK em crm_experiencia ────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.crm_experiencia
    ADD CONSTRAINT fk_escola_confirmada
    FOREIGN KEY (escola_confirmada_id) REFERENCES public.escolas(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Audit triggers ───────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_escolas ON public.escolas;
CREATE TRIGGER trg_audit_escolas
  AFTER INSERT OR UPDATE OR DELETE ON public.escolas
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS trg_audit_hist_escola ON public.historico_contatos_escola;
CREATE TRIGGER trg_audit_hist_escola
  AFTER INSERT OR UPDATE OR DELETE ON public.historico_contatos_escola
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS trg_audit_estrategia ON public.estrategia_escolas;
CREATE TRIGGER trg_audit_estrategia
  AFTER INSERT OR UPDATE OR DELETE ON public.estrategia_escolas
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();
