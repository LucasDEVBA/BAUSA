-- ============================================================
-- ordem_etapa + trg_deals_check_etapa — aguardando_timing (ordem 2)
--
-- Divergência pega em revisão adversarial (2026-07-06): o app
-- (ETAPA_ORDEM em apps/crm/src/types/crm.ts) passou a ordenar
-- aguardando_timing = 2, mas public.ordem_etapa ainda caía no
-- ELSE 0 (a migration 20260515000000 adicionou o valor ao enum
-- sem atualizar a função). Efeito: mover lead → aguardando_timing
-- era avanço no app e "retrocesso" no banco — flag_retrocedido
-- espúrio com motivo_retrocesso NULL (badge sem justificativa).
--
-- Semântica adotada (espelhada no app em lib/actions/deals.ts):
-- aguardando_timing é ESTACIONAMENTO (lead muito cedo aguardando
-- novembro) — entrar ou sair dele nunca conta como retrocesso.
--
-- As duas funções vivem em `public` e recebem o enum compartilhado
-- status_deal — os triggers de deals em qualquer schema (public/
-- uat/dev) apontam para elas, então um único REPLACE cobre todos.
-- Forward-only e idempotente (CREATE OR REPLACE).
-- ============================================================

-- Ordem das etapas (para detectar retrocesso) — agora com
-- aguardando_timing entre lead e reuniao_marcada (mesma posição
-- do enum e do ETAPA_ORDEM do app; números só comparados entre si,
-- nunca persistidos — renumerar é seguro).
CREATE OR REPLACE FUNCTION public.ordem_etapa(p_etapa status_deal)
RETURNS INTEGER AS $$
  SELECT CASE p_etapa
    WHEN 'lead'                    THEN 1
    WHEN 'aguardando_timing'       THEN 2
    WHEN 'reuniao_marcada'         THEN 3
    WHEN 'reuniao_realizada'       THEN 4
    WHEN 'diagnostico_fit'         THEN 5
    WHEN 'alinhamento_estrategico' THEN 6
    WHEN 'proposta_enviada'        THEN 7
    WHEN 'followup_proposta'       THEN 8
    WHEN 'negociacao'              THEN 9
    WHEN 'contrato_enviado'        THEN 10
    WHEN 'contrato_assinado'       THEN 11
    WHEN 'sinal_pago'              THEN 12
    WHEN 'admission_process'       THEN 13
    WHEN 'concluido'               THEN 14
    WHEN 'perdido'                 THEN 15
    WHEN 'cancelamento_solicitado' THEN 16
    WHEN 'projeto_futuro'          THEN 17
    ELSE 0
  END;
$$ LANGUAGE sql IMMUTABLE;

-- Mesmo corpo da 20260401000600, com aguardando_timing isento de
-- retrocesso nas DUAS direções (entrar = estacionar; sair = retomar).
CREATE OR REPLACE FUNCTION public.trg_deals_check_etapa()
RETURNS TRIGGER AS $$
BEGIN
  -- Só processa se a etapa mudou
  IF OLD.etapa IS DISTINCT FROM NEW.etapa THEN
    -- Salva etapa anterior
    NEW.etapa_anterior := OLD.etapa;

    -- Detecta retrocesso (nova etapa tem ordem menor que a anterior).
    -- Estados especiais e o estacionamento aguardando_timing não contam.
    IF public.ordem_etapa(NEW.etapa) < public.ordem_etapa(OLD.etapa)
       AND NEW.etapa NOT IN ('perdido', 'cancelamento_solicitado', 'projeto_futuro', 'aguardando_timing')
       AND OLD.etapa <> 'aguardando_timing' THEN
      NEW.flag_retrocedido := true;
      -- motivo_retrocesso é validado na camada de aplicação
      -- (constraint CHECK não funciona bem aqui pois depende de OLD)
    END IF;

    -- Seta timestamps de marcos
    IF NEW.etapa = 'reuniao_realizada' AND OLD.etapa != 'reuniao_realizada' THEN
      NEW.reuniao_realizada_at := COALESCE(NEW.reuniao_realizada_at, NOW());
    END IF;
    IF NEW.etapa = 'contrato_enviado' AND OLD.etapa != 'contrato_enviado' THEN
      NEW.contrato_enviado_at := COALESCE(NEW.contrato_enviado_at, NOW());
    END IF;
    IF NEW.etapa = 'contrato_assinado' AND OLD.etapa != 'contrato_assinado' THEN
      NEW.contrato_assinado_at := COALESCE(NEW.contrato_assinado_at, NOW());
    END IF;
    IF NEW.etapa = 'sinal_pago' AND OLD.etapa != 'sinal_pago' THEN
      NEW.sinal_pago_at := COALESCE(NEW.sinal_pago_at, NOW());
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
