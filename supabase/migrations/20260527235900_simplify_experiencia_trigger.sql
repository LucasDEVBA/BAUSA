-- ============================================================
-- FIX CRÍTICO: simplifica trigger de auto-handoff
--
-- Problema: o trigger anterior (com SECURITY DEFINER) fazia INSERT em
-- tarefas e notificacoes dentro da mesma transação do UPDATE em deals.
-- Se qualquer dessas INSERTs falhasse (NOT NULL, RLS, ou outro audit
-- trigger), a transação inteira era abortada — impedindo o CEO de
-- mover deals para admission_process.
--
-- Solução:
--   1. Trigger faz APENAS o INSERT em crm_experiencia (operação crítica)
--   2. EXCEPTION handler garante que falhas não abortam o UPDATE no deal
--   3. Sem SECURITY DEFINER — usa policy exp_insert (CEO já tem permissão)
--   4. Tarefa de onboarding e notificação ao Head movidas para a server
--      action moverDeal (application-level com try/catch)
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_create_experiencia_on_admission()
RETURNS TRIGGER AS $$
DECLARE
  v_existing UUID;
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

    -- Tudo em sub-bloco com EXCEPTION para NUNCA abortar o UPDATE em deals.
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
          3, 5, 1,
          'satisfeita', FALSE
        );
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
    EXCEPTION WHEN OTHERS THEN
      -- Loga warning mas NUNCA aborta o UPDATE no deal.
      -- A server action moverDeal tem fallback application-level.
      RAISE WARNING 'trg_create_experiencia_on_admission: % (deal=%, atleta=%)',
        SQLERRM, NEW.id, NEW.atleta_id;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sem SECURITY DEFINER: respeita policy exp_insert (CEO autorizado).
-- Se outro papel (head_sucesso) mover deal no futuro, a server action
-- moverDeal tem fallback application-level que faz o trabalho.

DROP TRIGGER IF EXISTS trg_deals_create_experiencia ON public.deals;
CREATE TRIGGER trg_deals_create_experiencia
  AFTER INSERT OR UPDATE OF etapa ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_create_experiencia_on_admission();

COMMENT ON FUNCTION public.trg_create_experiencia_on_admission() IS
  'Auto-handoff defensivo: cria crm_experiencia ao deal entrar em admission_process/concluido. NUNCA aborta o UPDATE no deal (EXCEPTION handler).';
