-- ════════════════════════════════════════════════════════════════════════
-- Migration: jornada pós-venda ganha 'envio_opcoes' e 'pagamento_remanescente'
-- ════════════════════════════════════════════════════════════════════════
--
-- Decisão do CEO (2026-08-11): depois do GANHO (Sinal pago), a jornada é
--   Envio de opções → Application em andamento → Aceito + I-20 →
--   Pagamento remanescente → Visto → (embarque/acompanhamento/encerrado)
--
-- Duas fases são novas; as outras três já existem e mudam só de RÓTULO
-- (admissao → "Application em andamento", aprovado → "Aceito + I-20",
--  pre_embarque → "Visto"), via fases_familia_config.
--
-- ⚠️ ARQUIVO SEPARADO: valor de enum não pode ser usado na transação que o
-- cria. Rótulos, ordem e trigger vivem na 20260811142100.
-- ════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'fase_experiencia' AND e.enumlabel = 'envio_opcoes'
  ) THEN
    ALTER TYPE public.fase_experiencia ADD VALUE 'envio_opcoes' BEFORE 'admissao';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'fase_experiencia' AND e.enumlabel = 'pagamento_remanescente'
  ) THEN
    ALTER TYPE public.fase_experiencia ADD VALUE 'pagamento_remanescente' BEFORE 'pre_embarque';
  END IF;
END $$;
