-- ════════════════════════════════════════════════════════════════════════
-- Migration: status_deal ganha 'plano_escolhido' (etapa própria pós-sinal)
-- Aplica em: public (o enum status_deal só existe em public — uat/dev não
-- têm deals; mesma nota da 20260811140000).
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto (vídeo do CEO 28/09, T2): "Plano escolhido" era só um RÓTULO sobre
-- o enum 'negociacao', que tem ordem de negócio ANTES de sinal_pago. Arrastar
-- de "Sinal pago" para "Plano escolhido" (a coluna seguinte no board do CEO)
-- abria o modal de retrocesso e, se confirmado, devolvia uma família que já
-- pagou o sinal para a pré-venda (alerta "Negociação parada", remarketing
-- "proposta sem resposta", probabilidade 95→65).
--
-- ⚠️ ARQUIVO SEPARADO DE PROPÓSITO: valor novo de enum não pode ser USADO na
-- mesma transação que o adiciona. Ordem fixa, retrocesso pela ordem do board,
-- handoff e seeds vivem na migration seguinte (…124200), que roda depois do
-- COMMIT desta. Nenhum código antigo enxerga o valor novo até alguém gravar
-- um deal nele — e a coluna nasce OCULTA (ver DEAL_STAGE_CONFIG).
-- ════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'status_deal' AND n.nspname = 'public'
  ) THEN
    RAISE NOTICE 'plano_escolhido: enum public.status_deal ausente — pulado';
    RETURN;
  END IF;

  -- AFTER 'sinal_pago': a posição no enum acompanha a ordem de negócio
  -- (ORDER BY etapa coerente com ordem_etapa_fixa). IF NOT EXISTS = idempotente.
  ALTER TYPE public.status_deal ADD VALUE IF NOT EXISTS 'plano_escolhido' AFTER 'sinal_pago';
END $$;
