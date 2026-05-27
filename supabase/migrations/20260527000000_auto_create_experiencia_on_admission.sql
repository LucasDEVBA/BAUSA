-- ============================================================
-- Auto-handoff: deal → crm_experiencia quando atinge admission_process
--
-- Garante que toda família entre na gestão da Head de Sucesso assim
-- que o deal chega em admission_process, mesmo se sinal_pago for pulado.
-- Idempotente: não duplica se a experiencia já existir.
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_create_experiencia_on_admission()
RETURNS TRIGGER AS $$
DECLARE
  v_existing UUID;
  v_head_id UUID;
  v_atleta_nome TEXT;
  v_inclui_psicologa BOOLEAN := FALSE;
  v_fase_destino fase_experiencia;
BEGIN
  -- Só dispara se a etapa MUDOU para um valor que deve materializar família
  IF (TG_OP = 'INSERT' AND NEW.etapa IN ('admission_process', 'concluido'))
     OR (TG_OP = 'UPDATE'
         AND NEW.etapa IN ('admission_process', 'concluido')
         AND COALESCE(OLD.etapa::text, '') IS DISTINCT FROM NEW.etapa::text)
  THEN
    -- Mapear etapa do deal → fase da experiencia
    v_fase_destino := CASE NEW.etapa::text
      WHEN 'admission_process' THEN 'admissao'::fase_experiencia
      WHEN 'concluido'         THEN 'acompanhamento'::fase_experiencia
      ELSE 'admissao'::fase_experiencia
    END;

    -- Verificar se já existe experiencia para este atleta
    SELECT id INTO v_existing
    FROM public.crm_experiencia
    WHERE atleta_id = NEW.atleta_id
    LIMIT 1;

    -- Buscar se contrato inclui psicologa
    SELECT COALESCE(inclui_psicologa, FALSE)
      INTO v_inclui_psicologa
    FROM public.contratos_financeiros
    WHERE deal_id = NEW.id AND deleted_at IS NULL
    LIMIT 1;

    IF v_existing IS NULL THEN
      INSERT INTO public.crm_experiencia (
        atleta_id, deal_id, fase, temperatura,
        ansiedade, satisfacao, risco_percebido,
        status, psicologa_acionada
      ) VALUES (
        NEW.atleta_id, NEW.id, v_fase_destino, 'verde',
        3, 5, 1,
        'satisfeita', FALSE
      );

      -- Buscar Head de Sucesso ativo
      SELECT id INTO v_head_id
      FROM public.user_profiles
      WHERE papel = 'head_sucesso' AND ativo = TRUE
      LIMIT 1;

      SELECT nome_completo INTO v_atleta_nome
      FROM public.atletas
      WHERE id = NEW.atleta_id;

      -- Tarefa de onboarding (48h) — Head de Sucesso
      IF v_head_id IS NOT NULL THEN
        INSERT INTO public.tarefas (
          titulo, descricao, responsavel_id, prazo,
          prioridade, deal_id, modulo_origem, criada_automaticamente
        ) VALUES (
          CONCAT('Onboarding ', COALESCE(v_atleta_nome, 'familia')),
          'Iniciar gestao da familia: confirmar dados de contato, indicadores iniciais e proximo contato.',
          v_head_id,
          NOW() + INTERVAL '48 hours',
          'alta',
          NEW.id,
          'experiencia',
          TRUE
        );

        INSERT INTO public.notificacoes (
          destinatario_id, titulo, mensagem, tipo, severidade, deal_id, link
        ) VALUES (
          v_head_id,
          CONCAT('Nova familia: ', COALESCE(v_atleta_nome, 'atleta')),
          'Deal avancou para admission_process. Registro de experiencia criado.',
          'handoff',
          'alta',
          NEW.id,
          '/familias-crm'
        );
      END IF;
    ELSE
      -- Já existe: atualizar fase se mais avançada
      UPDATE public.crm_experiencia
      SET fase = v_fase_destino
      WHERE id = v_existing
        AND fase::text NOT IN ('encerrado')
        AND (
          (v_fase_destino = 'acompanhamento' AND fase::text NOT IN ('acompanhamento', 'encerrado'))
          OR (v_fase_destino = 'admissao' AND fase::text NOT IN ('admissao', 'aprovado', 'pre_embarque', 'embarcado_inicial', 'acompanhamento', 'encerrado'))
        );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deals_create_experiencia ON public.deals;
CREATE TRIGGER trg_deals_create_experiencia
  AFTER INSERT OR UPDATE OF etapa ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_create_experiencia_on_admission();

COMMENT ON FUNCTION public.trg_create_experiencia_on_admission() IS
  'Auto-handoff: cria crm_experiencia quando deal entra em admission_process/concluido. Idempotente.';

-- ============================================================
-- Backfill: criar crm_experiencia para deals já em admission+
-- ============================================================
INSERT INTO public.crm_experiencia (
  atleta_id, deal_id, fase, temperatura,
  ansiedade, satisfacao, risco_percebido,
  status, psicologa_acionada
)
SELECT
  d.atleta_id,
  d.id,
  CASE d.etapa::text
    WHEN 'concluido' THEN 'acompanhamento'::fase_experiencia
    ELSE 'admissao'::fase_experiencia
  END,
  'verde',
  3, 5, 1,
  'satisfeita',
  FALSE
FROM public.deals d
WHERE d.etapa::text IN ('admission_process', 'concluido')
  AND d.deleted_at IS NULL
  AND d.atleta_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.crm_experiencia e WHERE e.atleta_id = d.atleta_id
  );
