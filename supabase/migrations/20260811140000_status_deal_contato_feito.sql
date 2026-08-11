-- ════════════════════════════════════════════════════════════════════════
-- Migration: status_deal ganha 'contato_feito' (etapa 1 do processo comercial)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto (decisão do CEO, 2026-08-11): o funil comercial passa a ter 9
-- estágios — Contato feito → Lead qualificado no formulário → Reunião marcada
-- → Reunião realizada → Proposta enviada → Plano escolhido → Contrato enviado
-- → Contrato assinado → Sinal pago (GANHO).
--
-- Só UM valor novo é necessário: 'contato_feito' (prospecção ativa, fora do
-- formulário). Os demais estágios reusam valores existentes do enum e mudam
-- apenas de RÓTULO via configuracoes_sistema.etapas_deal_config —
-- renomear valor de enum invalidaria todo JSONB persistido
-- (etapas_deal_config, probabilidade_por_etapa, automacoes.gatilho_config)
-- e ~50 literais no app/CFs/CI.
--
-- ⚠️ ARQUIVO SEPARADO DE PROPÓSITO: o Postgres não permite USAR um valor de
-- enum na mesma transação que o adiciona. A renumeração de ordem_etapa, a
-- migração de deals e o seed dos rótulos vivem na migration seguinte
-- (20260811140100), que roda depois do COMMIT desta.
-- ════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'status_deal' AND e.enumlabel = 'contato_feito'
  ) THEN
    -- BEFORE 'lead': prospecção ativa antecede o lead que chegou pelo form.
    -- (a ordem de negócio vem de public.ordem_etapa, não da posição no enum;
    --  manter as duas coerentes evita surpresa em ORDER BY etapa)
    ALTER TYPE public.status_deal ADD VALUE 'contato_feito' BEFORE 'lead';
  END IF;
END $$;

-- O enum status_deal existe SÓ no schema public (compartilhado por uat/dev —
-- mesma nota da migration 20260515000000 que adicionou 'aguardando_timing').
