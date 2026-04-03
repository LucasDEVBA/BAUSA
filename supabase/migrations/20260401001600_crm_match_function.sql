-- ============================================================
-- CRM Bolsa Atleta USA — Motor de Match Atleta–Escola
-- Função principal + funções auxiliares de sugestão.
-- Lógica: filtros eliminatórios + scoring ponderado.
-- Regra especial: "Apenas Acadêmico" redistribui pesos.
-- ============================================================

-- Mapa de ordem das séries para comparação
CREATE OR REPLACE FUNCTION public.serie_ordem(serie TEXT)
RETURNS INTEGER AS $$
  SELECT CASE serie
    WHEN '9th' THEN 9  WHEN '10th' THEN 10
    WHEN '11th' THEN 11 WHEN '12th' THEN 12
    WHEN 'pg_year' THEN 13 ELSE 9
  END;
$$ LANGUAGE sql IMMUTABLE;

-- Mapa de faixa de investimento para valor numérico (USD)
CREATE OR REPLACE FUNCTION public.faixa_para_usd(faixa TEXT)
RETURNS NUMERIC AS $$
  SELECT CASE faixa
    WHEN '40k_mais' THEN 45000 WHEN '30k_40k' THEN 35000
    WHEN '20k_30k' THEN 25000 WHEN 'ate_20k' THEN 15000
    ELSE 15000
  END::NUMERIC;
$$ LANGUAGE sql IMMUTABLE;

-- Mapa de nivel_ingles para score numérico (0-100)
CREATE OR REPLACE FUNCTION public.ingles_score(nivel TEXT)
RETURNS INTEGER AS $$
  SELECT CASE nivel
    WHEN 'fluente' THEN 100 WHEN 'avancado' THEN 80
    WHEN 'intermediario' THEN 60 WHEN 'basico' THEN 30
    WHEN 'nenhum' THEN 0 ELSE 0
  END;
$$ LANGUAGE sql IMMUTABLE;

-- Mapa de nivel_competitivo para score (0-100)
CREATE OR REPLACE FUNCTION public.competitivo_score(nivel TEXT)
RETURNS INTEGER AS $$
  SELECT CASE nivel
    WHEN 'selecao' THEN 100 WHEN 'base_alto' THEN 80
    WHEN 'base_medio' THEN 60 WHEN 'base_baixo' THEN 40
    WHEN 'clube_social' THEN 30 WHEN 'escolinha' THEN 20
    WHEN 'escolar' THEN 10 WHEN 'apenas_academico' THEN 0
    ELSE 0
  END;
$$ LANGUAGE sql IMMUTABLE;

-- Mapa de influencia_esporte para multiplicador (0-1)
CREATE OR REPLACE FUNCTION public.influencia_mult(inf TEXT)
RETURNS NUMERIC AS $$
  SELECT CASE inf
    WHEN 'decisiva' THEN 1.0 WHEN 'forte' THEN 0.75
    WHEN 'moderada' THEN 0.50 WHEN 'baixa' THEN 0.25
    ELSE 0.50
  END::NUMERIC;
$$ LANGUAGE sql IMMUTABLE;

-- ── FUNÇÃO PRINCIPAL: calcular_match_score ───────────────────
CREATE OR REPLACE FUNCTION public.calcular_match_score(
  p_atleta_id UUID,
  p_escola_id UUID
) RETURNS INTEGER AS $$
DECLARE
  _a RECORD; _e RECORD;
  _apenas_academico BOOLEAN;
  _is_elite BOOLEAN;
  _peso_fin NUMERIC; _peso_acad NUMERIC;
  _peso_esp NUMERIC; _peso_serie NUMERIC; _peso_hist NUMERIC;
  _score_fin NUMERIC; _score_acad NUMERIC;
  _score_esp NUMERIC; _score_serie NUMERIC; _score_hist NUMERIC;
  _score_final NUMERIC;
  _atleta_usd NUMERIC; _budget_min NUMERIC; _budget_forte NUMERIC;
BEGIN
  SELECT * INTO _a FROM atletas WHERE id = p_atleta_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT * INTO _e FROM escolas WHERE id = p_escola_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  _apenas_academico := (_a.esporte = 'apenas_academico' OR _a.nivel_competitivo::TEXT = 'apenas_academico');
  _is_elite := (_a.nivel_competitivo::TEXT IN ('base_alto','selecao'));

  -- ═══ FILTROS ELIMINATÓRIOS ═══
  IF _e.status != 'ativa' THEN RETURN 0; END IF;

  IF public.serie_ordem(_a.serie_escolar) > public.serie_ordem(_e.serie_maxima) THEN
    RETURN 0;
  END IF;

  _atleta_usd := public.faixa_para_usd(_a.faixa_investimento);
  _budget_min := COALESCE(_e.budget_minimo_usd, 0);
  IF _atleta_usd < _budget_min AND NOT _is_elite THEN RETURN 0; END IF;

  IF NOT _apenas_academico
     AND array_length(_e.esportes_oferecidos, 1) IS NOT NULL
     AND NOT (_a.esporte = ANY(_e.esportes_oferecidos)) THEN
    RETURN 0;
  END IF;

  -- ═══ PESOS (regra especial Apenas Acadêmico) ═══
  IF _apenas_academico THEN
    _peso_fin := 30; _peso_acad := 50; _peso_esp := 0;
    _peso_serie := 10; _peso_hist := 10;
  ELSE
    _peso_fin := 30; _peso_acad := 25; _peso_esp := 25;
    _peso_serie := 10; _peso_hist := 10;
  END IF;

  -- ═══ SCORE FINANCEIRO ═══
  _budget_forte := COALESCE(_e.budget_forte_usd, _budget_min);
  IF _budget_forte <= 0 THEN
    _score_fin := 70;
  ELSIF _atleta_usd >= _budget_forte THEN
    _score_fin := 100;
  ELSIF _atleta_usd >= _budget_min THEN
    _score_fin := 20 + 80 * ((_atleta_usd - _budget_min) / NULLIF(_budget_forte - _budget_min, 0));
  ELSE
    _score_fin := 20;
  END IF;

  -- ═══ SCORE ACADÊMICO ═══
  DECLARE
    _atleta_ingles INT := public.ingles_score(_a.nivel_ingles::TEXT);
    _escola_ingles INT := public.ingles_score(COALESCE(_e.ingles_minimo::TEXT, 'nenhum'));
  BEGIN
    IF _escola_ingles = 0 THEN
      _score_acad := _atleta_ingles;
    ELSIF _atleta_ingles >= _escola_ingles THEN
      _score_acad := 100;
    ELSE
      _score_acad := (_atleta_ingles::NUMERIC / NULLIF(_escola_ingles, 0)) * 100;
    END IF;
  END;

  -- ═══ SCORE ESPORTIVO ═══
  IF _apenas_academico THEN
    _score_esp := 0;
  ELSE
    _score_esp := public.competitivo_score(_a.nivel_competitivo::TEXT)
                  * public.influencia_mult(COALESCE(_e.influencia_esporte::TEXT, 'moderada'));
  END IF;

  -- ═══ SCORE SÉRIE ═══
  IF _a.serie_escolar = ANY(_e.series_preferenciais) THEN
    _score_serie := 100;
  ELSIF public.serie_ordem(_a.serie_escolar) <= public.serie_ordem(_e.serie_maxima) THEN
    _score_serie := 60;
  ELSE
    _score_serie := 0;
  END IF;

  -- ═══ SCORE HISTÓRICO BAUSA ═══
  IF _e.total_aplicados = 0 THEN
    _score_hist := 50;
  ELSE
    _score_hist := LEAST(100, _e.taxa_aceitacao * 1.4);
  END IF;

  -- ═══ SCORE FINAL ═══
  _score_final := (
    _score_fin  * _peso_fin / 100 +
    _score_acad * _peso_acad / 100 +
    _score_esp  * _peso_esp / 100 +
    _score_serie * _peso_serie / 100 +
    _score_hist * _peso_hist / 100
  );

  RETURN GREATEST(0, LEAST(100, ROUND(_score_final)));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.calcular_match_score(UUID, UUID) IS 'Motor de Match: filtros eliminatórios + scoring ponderado 0-100';

-- ── Função: sugerir melhores escolas para um atleta ──────────
CREATE OR REPLACE FUNCTION public.sugerir_escolas(
  p_atleta_id UUID,
  p_limite INTEGER DEFAULT 10
) RETURNS TABLE(
  escola_id UUID, escola_nome TEXT, estado TEXT, tipo TEXT,
  score INTEGER, classificacao TEXT
) AS $$
  SELECT
    e.id, e.nome, e.estado_us, e.tipo,
    public.calcular_match_score(p_atleta_id, e.id) AS score,
    CASE
      WHEN public.calcular_match_score(p_atleta_id, e.id) >= 85 THEN 'excelente'
      WHEN public.calcular_match_score(p_atleta_id, e.id) >= 70 THEN 'forte'
      WHEN public.calcular_match_score(p_atleta_id, e.id) >= 50 THEN 'possivel'
      ELSE 'fraco'
    END AS classificacao
  FROM escolas e
  WHERE e.deleted_at IS NULL AND e.status = 'ativa'
  AND public.calcular_match_score(p_atleta_id, e.id) > 0
  ORDER BY score DESC
  LIMIT p_limite;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.sugerir_escolas(UUID, INTEGER) IS 'Retorna top N escolas por match score para um atleta';
