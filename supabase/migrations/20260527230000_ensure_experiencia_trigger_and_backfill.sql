-- ============================================================
-- GARANTIA: Recria trigger e materializa crm_experiencia faltantes
--
-- Necessária porque o histórico de migrations no Supabase remoto pode ter
-- marcado a 20260527000000 como aplicada sem que o trigger realmente
-- estivesse no banco (race entre workflows UAT e PRD). Esta migration:
--
--   1. Recria a função e o trigger (idempotente via CREATE OR REPLACE)
--   2. Faz backfill de TODOS os deals em admission_process/concluido
--      que ainda não têm crm_experiencia
--
-- Segura para rodar múltiplas vezes.
-- ============================================================

-- ── Função de handoff (idempotente) ──────────────────────────
CREATE OR REPLACE FUNCTION public.trg_create_experiencia_on_admission()
RETURNS TRIGGER AS $$
DECLARE
  v_existing UUID;
  v_head_id UUID;
  v_atleta_nome TEXT;
  v_fase_destino fase_experiencia;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.etapa IN ('admission_process', 'concluido'))
     OR (TG_OP = 'UPDATE'
         AND NEW.etapa IN ('admission_process', 'concluido')
         AND COALESCE(OLD.etapa::text, '') IS DISTINCT FROM NEW.etapa::text)
  THEN
    v_fase_destino := CASE NEW.etapa::text
      WHEN 'admission_process' THEN 'admissao'::fase_experiencia
      WHEN 'concluido'         THEN 'acompanhamento'::fase_experiencia
      ELSE 'admissao'::fase_experiencia
    END;

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
        3, 5, 1,
        'satisfeita', FALSE
      );

      SELECT id INTO v_head_id
      FROM public.user_profiles
      WHERE papel = 'head_sucesso' AND ativo = TRUE
      LIMIT 1;

      SELECT nome_completo INTO v_atleta_nome
      FROM public.atletas
      WHERE id = NEW.atleta_id;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SECURITY DEFINER garante que o trigger consegue inserir mesmo se o
-- usuário atual (CEO) não tivesse permissão direta — passa pelas RLS
-- com o owner da função.

DROP TRIGGER IF EXISTS trg_deals_create_experiencia ON public.deals;
CREATE TRIGGER trg_deals_create_experiencia
  AFTER INSERT OR UPDATE OF etapa ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_create_experiencia_on_admission();

COMMENT ON FUNCTION public.trg_create_experiencia_on_admission() IS
  'Auto-handoff: cria crm_experiencia quando deal entra em admission_process/concluido. Idempotente. SECURITY DEFINER.';

-- ── Backfill: materializa famílias faltantes ──────────────────
DO $$
DECLARE
  r RECORD;
  v_head_id UUID;
BEGIN
  SELECT id INTO v_head_id
  FROM public.user_profiles
  WHERE papel = 'head_sucesso' AND ativo = TRUE
  LIMIT 1;

  FOR r IN
    SELECT d.id AS deal_id, d.atleta_id, d.etapa::text AS etapa,
           a.nome_completo AS atleta_nome
    FROM public.deals d
    JOIN public.atletas a ON a.id = d.atleta_id
    WHERE d.etapa::text IN ('admission_process', 'concluido')
      AND d.deleted_at IS NULL
      AND d.atleta_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.crm_experiencia e
        WHERE e.atleta_id = d.atleta_id
      )
  LOOP
    INSERT INTO public.crm_experiencia (
      atleta_id, deal_id, fase, temperatura,
      ansiedade, satisfacao, risco_percebido,
      status, psicologa_acionada
    ) VALUES (
      r.atleta_id,
      r.deal_id,
      CASE r.etapa
        WHEN 'concluido' THEN 'acompanhamento'::fase_experiencia
        ELSE 'admissao'::fase_experiencia
      END,
      'verde',
      3, 5, 1,
      'satisfeita',
      FALSE
    );

    IF v_head_id IS NOT NULL THEN
      INSERT INTO public.tarefas (
        titulo, descricao, responsavel_id, prazo,
        prioridade, deal_id, modulo_origem, criada_automaticamente
      ) VALUES (
        CONCAT('Onboarding ', r.atleta_nome),
        'Backfill: familia criada retroativamente. Realizar onboarding.',
        v_head_id,
        NOW() + INTERVAL '48 hours',
        'alta',
        r.deal_id,
        'experiencia',
        TRUE
      );
    END IF;
  END LOOP;
END $$;
