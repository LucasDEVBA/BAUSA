-- ════════════════════════════════════════════════════════════════════════
-- Pipeline: colunas personalizadas + re-fila dos fora de timing
-- (ordens do CEO, 2026-09-04)
-- ════════════════════════════════════════════════════════════════════════
--
-- 1. SEIS SLOTS de coluna personalizada no enum status_deal (custom_1..6).
--    O CEO "cria" uma coluna nomeando um slot livre em etapas_deal_config
--    (mesma camada de apresentação do PR #307: enum nunca renomeia; rótulo/
--    cor/ordem são config). Slot sem nome fica oculto e vazio — invisível.
-- 2. Retrocesso: mover PARA ou DE uma coluna personalizada nunca conta como
--    retrocesso (são raias livres do CEO, sem semântica de funil) — mesma
--    isenção do aguardando_timing.
-- 3. Re-fila one-shot: leads QUENTE/MORNO fora de timing (muito_cedo/
--    tarde_demais) já aprovados e SEM reunião voltam para 'pendente' — o CEO
--    quer decidi-los na coluna Aguardando aprovação (o deal pré-reunião
--    suspende do board pela representação única).
--
-- Idempotente nas três partes. PG15: ADD VALUE em DO block é permitido; os
-- valores novos não são usados nesta mesma transação.

-- ─── 1. Slots custom no enum ─────────────────────────────────────────────
DO $$
DECLARE i integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'status_deal' AND n.nspname = 'public'
  ) THEN
    FOR i IN 1..6 LOOP
      EXECUTE format('ALTER TYPE public.status_deal ADD VALUE IF NOT EXISTS %L', 'custom_' || i);
    END LOOP;
  ELSE
    RAISE NOTICE 'colunas_custom: enum status_deal ausente — pulado';
  END IF;
END $$;

-- ─── 2. Isenção de retrocesso para colunas personalizadas ────────────────
-- ordem_etapa devolve 0 (ELSE) para custom_% — sem esta isenção, ENTRAR numa
-- coluna custom a partir de qualquer etapa dispararia flag_retrocedido.
CREATE OR REPLACE FUNCTION public.trg_deals_check_etapa()
RETURNS TRIGGER AS $$
BEGIN
  -- Só processa se a etapa mudou
  IF OLD.etapa IS DISTINCT FROM NEW.etapa THEN
    -- Salva etapa anterior
    NEW.etapa_anterior := OLD.etapa;

    -- Detecta retrocesso (nova etapa tem ordem menor que a anterior).
    -- Estados especiais, o estacionamento aguardando_timing e as colunas
    -- personalizadas (custom_%) não contam.
    IF public.ordem_etapa(NEW.etapa) < public.ordem_etapa(OLD.etapa)
       AND NEW.etapa NOT IN ('perdido', 'cancelamento_solicitado', 'projeto_futuro', 'aguardando_timing')
       AND OLD.etapa <> 'aguardando_timing'
       AND NEW.etapa::text NOT LIKE 'custom\_%'
       AND OLD.etapa::text NOT LIKE 'custom\_%' THEN
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

-- ─── 3. Re-fila dos fora de timing (one-shot, receita da 20260825150000) ─
DO $$
DECLARE n integer;
BEGIN
  IF to_regclass('public.deals') IS NULL THEN
    RAISE NOTICE 'refila_timing: sem tabela deals — pulado';
    RETURN;
  END IF;

  UPDATE public.form_submissions fs
  SET aprovacao_status = 'pendente',
      aprovacao_decidida_por = NULL,
      aprovacao_decidida_em = NULL,
      aprovacao_motivo = 'Re-enfileirado (2026-09-04): fora de timing volta a exigir decisão do CEO'
  FROM public.atletas a
  JOIN public.deals d ON d.atleta_id = a.id AND d.deleted_at IS NULL
  WHERE a.form_submission_id = fs.id
    AND fs.deleted_at IS NULL
    AND fs.timing_status IN ('muito_cedo', 'tarde_demais')
    AND fs.qualification_classification IN ('QUENTE', 'MORNO')
    AND fs.aprovacao_status = 'aprovado'
    AND fs.meeting_scheduled IS NOT TRUE
    AND d.etapa IN ('contato_feito', 'lead', 'aguardando_timing');

  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'refila_timing: % lead(s) fora de timing re-enfileirados p/ aprovação', n;
END $$;
