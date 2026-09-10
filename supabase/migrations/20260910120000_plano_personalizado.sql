-- ════════════════════════════════════════════════════════════════════════
-- Contratos totalmente customizáveis: plano 'personalizado' no enum
-- plano_tipo (ordem do CEO, 2026-09-10)
-- ════════════════════════════════════════════════════════════════════════
--
-- O contrato ganha customização total na criação: valor negociado, entrada,
-- parcelas, psicóloga e data da 1ª cobrança. Para negociações fora dos 3
-- planos fixos entra o plano 'personalizado' — valor + justificativa
-- obrigatórios (Regra 3: customização exige justificativa; as colunas
-- valor_customizado/justificativa_customizacao existem desde a 20260401000700).
--
-- PG15: ADD VALUE em DO block é permitido; o valor novo não é usado nesta
-- mesma transação (quem usa é a aplicação). Idempotente.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'plano_tipo' AND n.nspname = 'public'
  ) THEN
    ALTER TYPE public.plano_tipo ADD VALUE IF NOT EXISTS 'personalizado';
  ELSE
    RAISE NOTICE 'plano_personalizado: enum plano_tipo ausente — pulado';
  END IF;
END $$;
