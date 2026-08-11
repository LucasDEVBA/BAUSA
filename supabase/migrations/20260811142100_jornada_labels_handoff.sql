-- ════════════════════════════════════════════════════════════════════════
-- Migration: rótulos da jornada + handoff do ganho entra em "Envio de opções"
-- Roda DEPOIS de 20260811142000 (que adiciona as fases ao enum).
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Rótulos/ordem da jornada (camada editável, mesma da /configuracoes) ──
-- Valor existente à direita = customização do CEO vence (mesma regra da 140100).
UPDATE public.configuracoes_sistema
SET valor = '{
  "envio_opcoes":           {"label": "Envio de opções",          "description": "Shortlist de escolas enviada à família", "order": 0},
  "admissao":               {"label": "Application em andamento", "description": "Aplicações submetidas às escolas",       "order": 1},
  "aprovado":               {"label": "Aceito + I-20",            "description": "Aceite recebido e I-20 emitido",         "order": 2},
  "pagamento_remanescente": {"label": "Pagamento remanescente",   "description": "Saldo do contrato em liquidação",        "order": 3},
  "pre_embarque":           {"label": "Visto",                    "description": "Entrevista, visto e preparação final",   "order": 4},
  "embarcado_inicial":      {"order": 5},
  "acompanhamento":         {"order": 6},
  "encerrado":              {"order": 7}
}'::jsonb || COALESCE(valor, '{}'::jsonb),
    updated_at = NOW()
WHERE chave = 'fases_familia_config';

-- Dias de alerta de inatividade das fases novas (as demais já têm o seu).
UPDATE public.configuracoes_sistema
SET valor = '{"envio_opcoes": 7, "pagamento_remanescente": 10}'::jsonb || COALESCE(valor, '{}'::jsonb),
    updated_at = NOW()
WHERE chave = 'inatividade_por_fase';

-- ─── 2. Handoff: o ganho abre a jornada em "Envio de opções" ─────────────
-- (20260811140100 fez sinal_pago abrir em 'admissao' — agora que a fase de
--  envio de opções existe, ela é o primeiro passo pós-ganho.)
CREATE OR REPLACE FUNCTION public.trg_create_experiencia_on_admission()
RETURNS TRIGGER AS $$
DECLARE
  v_existing UUID;
  v_fase_destino fase_experiencia;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.etapa IN ('sinal_pago', 'admission_process', 'concluido'))
     OR (TG_OP = 'UPDATE'
         AND NEW.etapa IN ('sinal_pago', 'admission_process', 'concluido')
         AND COALESCE(OLD.etapa::text, '') IS DISTINCT FROM NEW.etapa::text)
  THEN
    v_fase_destino := CASE NEW.etapa::text
      WHEN 'sinal_pago'        THEN 'envio_opcoes'::fase_experiencia
      WHEN 'concluido'         THEN 'acompanhamento'::fase_experiencia
      ELSE 'admissao'::fase_experiencia
    END;

    BEGIN
      SELECT id INTO v_existing
      FROM public.crm_experiencia
      WHERE atleta_id = NEW.atleta_id
      LIMIT 1;

      IF v_existing IS NULL THEN
        INSERT INTO public.crm_experiencia (
          atleta_id, deal_id, fase, temperatura,
          ansiedade, satisfacao, risco_percebido,
          status, psicologa_acionada
        ) VALUES (
          NEW.atleta_id, NEW.id, v_fase_destino, 'verde',
          3, 5, 1, 'satisfeita', FALSE
        );
      ELSE
        -- Só AVANÇA a jornada: nunca puxa uma família de volta.
        UPDATE public.crm_experiencia
        SET fase = v_fase_destino
        WHERE id = v_existing
          AND fase::text NOT IN ('encerrado')
          AND (
            (v_fase_destino = 'acompanhamento' AND fase::text NOT IN ('acompanhamento', 'encerrado'))
            OR (v_fase_destino = 'admissao' AND fase::text IN ('envio_opcoes'))
            -- 'envio_opcoes' nunca aparece aqui: o ganho só CRIA a jornada;
            -- família existente jamais é rebaixada para o primeiro passo.
          );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'trg_create_experiencia_on_admission: % (deal=%, atleta=%)',
        SQLERRM, NEW.id, NEW.atleta_id;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.trg_create_experiencia_on_admission() IS
  'Auto-handoff defensivo: cria crm_experiencia ao deal ser GANHO (sinal_pago → fase envio_opcoes) ou entrar em admission_process/concluido. Nunca rebaixa a fase de quem já avançou. NUNCA aborta o UPDATE no deal.';

-- ─── 3. Alerta de inatividade conhece as fases novas ────────────────────
-- Helper: valida a chave da config (1..365) com fallback — extrai o CASE
-- repetido da versão anterior e evita 6 blocos idênticos.
CREATE OR REPLACE FUNCTION public.limite_inatividade_fase(p_valor TEXT, p_default INT)
RETURNS INT AS $fn$
  SELECT CASE
    WHEN p_valor ~ '^[0-9]{1,3}$' AND p_valor::INT BETWEEN 1 AND 365
      THEN p_valor::INT
    ELSE p_default
  END;
$fn$ LANGUAGE sql IMMUTABLE;

-- Sem isto, 'inatividade_por_fase' aceita as chaves novas mas a função cai no
-- ELSE 30 — a config de 7/10 dias não faria nada (achado da revisão).
CREATE OR REPLACE FUNCTION public.familias_em_alerta_inatividade()
RETURNS TABLE(
  experiencia_id UUID,
  atleta_nome TEXT,
  dias INT,
  fase TEXT,
  threshold INT
) AS $$
  WITH cfg AS (
    SELECT cs.valor
    FROM configuracoes_sistema cs
    WHERE cs.chave = 'inatividade_por_fase'
      AND jsonb_typeof(cs.valor) = 'object'
    LIMIT 1
  ),
  th AS (
    SELECT
      public.limite_inatividade_fase((SELECT c.valor->>'envio_opcoes' FROM cfg c), 7)           AS envio_opcoes,
      public.limite_inatividade_fase((SELECT c.valor->>'admissao' FROM cfg c), 7)               AS admissao,
      public.limite_inatividade_fase((SELECT c.valor->>'pagamento_remanescente' FROM cfg c), 10) AS pagamento_remanescente,
      public.limite_inatividade_fase((SELECT c.valor->>'pre_embarque' FROM cfg c), 15)          AS pre_embarque,
      public.limite_inatividade_fase((SELECT c.valor->>'embarcado_inicial' FROM cfg c), 7)      AS embarcado_inicial,
      public.limite_inatividade_fase((SELECT c.valor->>'acompanhamento' FROM cfg c), 30)        AS acompanhamento
  )
  SELECT
    ce.id,
    a.nome_completo,
    EXTRACT(DAY FROM NOW() - ce.data_ultimo_contato)::INT,
    ce.fase::TEXT,
    CASE ce.fase::TEXT
      WHEN 'envio_opcoes'           THEN th.envio_opcoes
      WHEN 'admissao'               THEN th.admissao
      WHEN 'pagamento_remanescente' THEN th.pagamento_remanescente
      WHEN 'pre_embarque'           THEN th.pre_embarque
      WHEN 'embarcado_inicial'      THEN th.embarcado_inicial
      WHEN 'acompanhamento'         THEN th.acompanhamento
      ELSE 30
    END
  FROM crm_experiencia ce
  JOIN atletas a ON a.id = ce.atleta_id
  CROSS JOIN th
  WHERE ce.deleted_at IS NULL
    AND ce.fase NOT IN ('encerrado', 'aprovado')
    AND ce.data_ultimo_contato IS NOT NULL
    AND EXTRACT(DAY FROM NOW() - ce.data_ultimo_contato) >
      CASE ce.fase::TEXT
        WHEN 'envio_opcoes'           THEN th.envio_opcoes
        WHEN 'admissao'               THEN th.admissao
        WHEN 'pagamento_remanescente' THEN th.pagamento_remanescente
        WHEN 'pre_embarque'           THEN th.pre_embarque
        WHEN 'embarcado_inicial'      THEN th.embarcado_inicial
        WHEN 'acompanhamento'         THEN th.acompanhamento
        ELSE 30
      END
  ORDER BY 3 DESC;
$$ LANGUAGE sql STABLE;
