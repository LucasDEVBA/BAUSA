-- ============================================================
-- CRM Bolsa Atleta USA — Migration 6: Atletas (Leads do CRM)
-- Dados normalizados do atleta. Vinculado a responsável.
-- FK opcional para form_submissions (origem do formulário público).
-- Inclui cálculo automático de Lead Score.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.atletas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Dados pessoais
  nome_completo         TEXT NOT NULL,
  data_nascimento       DATE NOT NULL,
  whatsapp              TEXT NOT NULL,
  email                 TEXT,
  instagram             TEXT,
  -- Esporte
  esporte               TEXT NOT NULL,
  posicao               TEXT,
  nivel_competitivo     nivel_competitivo NOT NULL,
  historico_clubes      TEXT,
  conquistas            TEXT,
  video_highlights_url  TEXT,
  -- Acadêmico
  serie_escolar         TEXT NOT NULL CHECK (serie_escolar IN ('9th','10th','11th','12th','pg_year')),
  nivel_ingles          nivel_ingles NOT NULL,
  desempenho_academico  desempenho_academico NOT NULL,
  escola_atual          TEXT,
  cidade_estado         TEXT NOT NULL,
  modelo_educacional    TEXT,
  -- Projeto
  momento_inicio        TEXT NOT NULL CHECK (momento_inicio IN ('proximo_semestre','proximo_ano','dois_mais_anos')),
  comprometimento       comprometimento_atleta NOT NULL,
  decisao_familiar      decisao_familiar NOT NULL,
  faixa_investimento    TEXT NOT NULL CHECK (faixa_investimento IN ('ate_20k','20k_30k','30k_40k','40k_mais')),
  direcao_projeto       TEXT,
  safra                 TEXT NOT NULL,           -- ex: 'fall_2026', 'spring_2027'
  -- Lead Score (calculado automaticamente)
  lead_score            INTEGER CHECK (lead_score >= 0 AND lead_score <= 100),
  lead_classificacao    classificacao_lead,
  lead_score_calculado_at TIMESTAMPTZ,
  -- Relacionamentos
  responsavel_id        UUID NOT NULL REFERENCES public.responsaveis(id),
  form_submission_id    UUID UNIQUE REFERENCES public.form_submissions(id),  -- NULL se cadastro manual
  origem                origem_lead NOT NULL DEFAULT 'formulario_web',
  indicado_por_id       UUID REFERENCES public.responsaveis(id),  -- Quem indicou (responsável)
  -- LGPD (herdado do responsável, mas registrado aqui também)
  consentimento_lgpd    BOOLEAN NOT NULL DEFAULT false,
  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  created_by            UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.atletas IS 'Atletas (leads estruturados) do CRM. Fonte de verdade após promoção do formulário.';
COMMENT ON COLUMN public.atletas.form_submission_id IS 'FK para form_submissions. NULL se cadastro manual. UNIQUE impede promoção duplicada.';
COMMENT ON COLUMN public.atletas.lead_score IS 'Score 0-100 calculado automaticamente com pesos de configuracoes_sistema.';

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_atletas_updated_at ON public.atletas;
CREATE TRIGGER trg_atletas_updated_at
  BEFORE UPDATE ON public.atletas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_atletas_responsavel ON public.atletas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_atletas_lead_score ON public.atletas(lead_score DESC NULLS LAST) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_atletas_classificacao ON public.atletas(lead_classificacao) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_atletas_safra ON public.atletas(safra) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_atletas_form_submission ON public.atletas(form_submission_id) WHERE form_submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_atletas_origem ON public.atletas(origem);

-- RLS
ALTER TABLE public.atletas ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer autenticado
DROP POLICY IF EXISTS "atletas_select" ON public.atletas;
CREATE POLICY "atletas_select" ON public.atletas
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- INSERT: apenas CEO (promoção de lead)
DROP POLICY IF EXISTS "atletas_insert" ON public.atletas;
CREATE POLICY "atletas_insert" ON public.atletas
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel() = 'ceo');

-- UPDATE: CEO e Head (Head pode atualizar dados de contato)
DROP POLICY IF EXISTS "atletas_update" ON public.atletas;
CREATE POLICY "atletas_update" ON public.atletas
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() IN ('ceo', 'head_sucesso'))
  WITH CHECK (public.get_user_papel() IN ('ceo', 'head_sucesso'));

-- DELETE (soft): apenas CEO
DROP POLICY IF EXISTS "atletas_delete" ON public.atletas;
CREATE POLICY "atletas_delete" ON public.atletas
  FOR DELETE TO authenticated
  USING (public.get_user_papel() = 'ceo');

-- service_role
DROP POLICY IF EXISTS "atletas_service" ON public.atletas;
CREATE POLICY "atletas_service" ON public.atletas
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Função: Cálculo do Lead Score ────────────────────────────
-- Lê pesos de configuracoes_sistema (não hardcoded).
-- Retorna 0-100.
CREATE OR REPLACE FUNCTION public.calcular_lead_score(p_atleta_id UUID)
RETURNS INTEGER AS $$
DECLARE
  _atleta RECORD;
  _pesos JSONB;
  _faixas JSONB;
  _score INTEGER := 0;
  _comp_score INTEGER;
BEGIN
  -- Busca dados do atleta
  SELECT * INTO _atleta FROM public.atletas WHERE id = p_atleta_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Busca pesos configuráveis
  SELECT valor INTO _pesos FROM public.configuracoes_sistema WHERE chave = 'lead_score_pesos';
  SELECT valor INTO _faixas FROM public.configuracoes_sistema WHERE chave = 'lead_score_faixas';

  -- 1. Faixa de investimento (máx: peso configurável)
  _score := _score + CASE _atleta.faixa_investimento
    WHEN '40k_mais' THEN (_pesos->>'investimento')::INT
    WHEN '30k_40k'  THEN ROUND((_pesos->>'investimento')::INT * 0.80)
    WHEN '20k_30k'  THEN ROUND((_pesos->>'investimento')::INT * 0.48)
    WHEN 'ate_20k'  THEN ROUND((_pesos->>'investimento')::INT * 0.20)
    ELSE 0
  END;

  -- 2. Timing do projeto
  _score := _score + CASE _atleta.momento_inicio
    WHEN 'proximo_semestre' THEN (_pesos->>'timing')::INT
    WHEN 'proximo_ano'      THEN ROUND((_pesos->>'timing')::INT * 0.60)
    WHEN 'dois_mais_anos'   THEN ROUND((_pesos->>'timing')::INT * 0.25)
    ELSE 0
  END;

  -- 3. Nível de inglês
  _score := _score + CASE _atleta.nivel_ingles::TEXT
    WHEN 'fluente'        THEN (_pesos->>'ingles')::INT
    WHEN 'avancado'       THEN ROUND((_pesos->>'ingles')::INT * 0.80)
    WHEN 'intermediario'  THEN ROUND((_pesos->>'ingles')::INT * 0.53)
    WHEN 'basico'         THEN ROUND((_pesos->>'ingles')::INT * 0.20)
    WHEN 'nenhum'         THEN 0
    ELSE 0
  END;

  -- 4. Desempenho acadêmico
  _score := _score + CASE _atleta.desempenho_academico::TEXT
    WHEN 'excelente' THEN (_pesos->>'academico')::INT
    WHEN 'bom'       THEN ROUND((_pesos->>'academico')::INT * 0.67)
    WHEN 'regular'   THEN ROUND((_pesos->>'academico')::INT * 0.33)
    WHEN 'fraco'     THEN 0
    ELSE 0
  END;

  -- 5. Nível competitivo (esporte)
  _score := _score + CASE _atleta.nivel_competitivo::TEXT
    WHEN 'selecao'           THEN (_pesos->>'competitivo')::INT
    WHEN 'base_alto'         THEN ROUND((_pesos->>'competitivo')::INT * 0.80)
    WHEN 'base_medio'        THEN ROUND((_pesos->>'competitivo')::INT * 0.60)
    WHEN 'base_baixo'        THEN ROUND((_pesos->>'competitivo')::INT * 0.40)
    WHEN 'clube_social'      THEN ROUND((_pesos->>'competitivo')::INT * 0.30)
    WHEN 'escolinha'         THEN ROUND((_pesos->>'competitivo')::INT * 0.20)
    WHEN 'escolar'           THEN ROUND((_pesos->>'competitivo')::INT * 0.10)
    WHEN 'apenas_academico'  THEN 0
    ELSE 0
  END;

  -- 6. Comprometimento + decisão familiar (combinado)
  _comp_score := CASE
    WHEN _atleta.comprometimento::TEXT = 'alto' AND _atleta.decisao_familiar::TEXT = 'decidida'     THEN (_pesos->>'comprometimento')::INT
    WHEN _atleta.comprometimento::TEXT = 'alto' AND _atleta.decisao_familiar::TEXT = 'em_discussao'  THEN ROUND((_pesos->>'comprometimento')::INT * 0.70)
    WHEN _atleta.comprometimento::TEXT = 'medio'                                                     THEN ROUND((_pesos->>'comprometimento')::INT * 0.40)
    WHEN _atleta.comprometimento::TEXT = 'baixo'                                                     THEN ROUND((_pesos->>'comprometimento')::INT * 0.10)
    ELSE 0
  END;
  _score := _score + _comp_score;

  -- 7. Vídeo highlights
  _score := _score + CASE
    WHEN _atleta.video_highlights_url IS NOT NULL AND _atleta.video_highlights_url != '' THEN (_pesos->>'video')::INT
    ELSE 0
  END;

  -- Garante range 0-100
  _score := GREATEST(0, LEAST(100, _score));

  RETURN _score;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.calcular_lead_score(UUID) IS 'Calcula Lead Score 0-100 com pesos de configuracoes_sistema';

-- ── Trigger: recalcular lead_score ao inserir/atualizar atleta ─
CREATE OR REPLACE FUNCTION public.trg_calcular_lead_score()
RETURNS TRIGGER AS $$
DECLARE
  _score INTEGER;
  _faixas JSONB;
  _classificacao classificacao_lead;
BEGIN
  _score := public.calcular_lead_score(NEW.id);

  -- Determinar classificação
  SELECT valor INTO _faixas FROM public.configuracoes_sistema WHERE chave = 'lead_score_faixas';
  _classificacao := CASE
    WHEN _score >= (_faixas->>'hot')::INT  THEN 'hot'::classificacao_lead
    WHEN _score >= (_faixas->>'warm')::INT THEN 'warm'::classificacao_lead
    ELSE 'cold'::classificacao_lead
  END;

  NEW.lead_score := _score;
  NEW.lead_classificacao := _classificacao;
  NEW.lead_score_calculado_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_atletas_lead_score ON public.atletas;
CREATE TRIGGER trg_atletas_lead_score
  BEFORE INSERT OR UPDATE OF
    faixa_investimento, momento_inicio, nivel_ingles,
    desempenho_academico, nivel_competitivo, comprometimento,
    decisao_familiar, video_highlights_url
  ON public.atletas
  FOR EACH ROW EXECUTE FUNCTION public.trg_calcular_lead_score();
