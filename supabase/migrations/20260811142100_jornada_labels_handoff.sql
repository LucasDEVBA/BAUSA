-- ════════════════════════════════════════════════════════════════════════
-- Migration: rótulos da jornada + handoff do ganho entra em "Envio de opções"
-- Roda DEPOIS de 20260811142000 (que adiciona as fases ao enum).
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Rótulos/ordem da jornada (camada editável, mesma da /configuracoes) ──
-- Merge (`||`): o CEO segue livre para renomear tudo depois.
UPDATE public.configuracoes_sistema
SET valor = COALESCE(valor, '{}'::jsonb) || '{
  "envio_opcoes":           {"label": "Envio de opções",          "description": "Shortlist de escolas enviada à família", "order": 0},
  "admissao":               {"label": "Application em andamento", "description": "Aplicações submetidas às escolas",       "order": 1},
  "aprovado":               {"label": "Aceito + I-20",            "description": "Aceite recebido e I-20 emitido",         "order": 2},
  "pagamento_remanescente": {"label": "Pagamento remanescente",   "description": "Saldo do contrato em liquidação",        "order": 3},
  "pre_embarque":           {"label": "Visto",                    "description": "Entrevista, visto e preparação final",   "order": 4},
  "embarcado_inicial":      {"order": 5},
  "acompanhamento":         {"order": 6},
  "encerrado":              {"order": 7}
}'::jsonb,
    updated_at = NOW()
WHERE chave = 'fases_familia_config';

-- Dias de alerta de inatividade das fases novas (as demais já têm o seu).
UPDATE public.configuracoes_sistema
SET valor = COALESCE(valor, '{}'::jsonb) || '{"envio_opcoes": 7, "pagamento_remanescente": 10}'::jsonb,
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
            OR (v_fase_destino = 'envio_opcoes' AND FALSE)  -- ganho nunca rebaixa quem já avançou
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
