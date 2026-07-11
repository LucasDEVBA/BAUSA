-- ════════════════════════════════════════════════════════════
-- Migration: indicações completo — vínculo com a família (crm_experiencia),
--            indicado avulso (fora do CRM) e RPC de incremento do contador
-- Contexto: o programa de indicações passa a ser gerenciável no Engine
--           (/indicacoes): criar indicação, transicionar status e, ao
--           CONVERTER, incrementar crm_experiencia.indicacoes_geradas da
--           família indicadora (hoje o campo nunca é incrementado).
--           A tabela original exige responsavel_indicador_id e
--           atleta_indicado_id (NOT NULL) — mas na prática quem indica é a
--           FAMÍLIA cliente (crm_experiencia) e o indicado normalmente ainda
--           NÃO existe no CRM. Mudanças 100% aditivas:
--             • DROP NOT NULL nos dois FKs legados (linhas antigas intactas)
--             • indicador_experiencia_id → FK p/ crm_experiencia (novo vínculo)
--             • indicador_nome / indicado_nome / indicado_whatsapp (texto livre)
--             • RPC incrementar_indicacoes_geradas — SECURITY INVOKER: a RLS
--               de crm_experiencia (exp_update: ceo/head_sucesso) já autoriza
--               o UPDATE, então não há necessidade de DEFINER (fail-closed
--               por RLS para qualquer outro papel).
-- Aplica em public (PRD); uat/dev gateados por to_regclass (viram no-op
-- enquanto as tabelas CRM não existirem nesses schemas).
-- ════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───

-- Indicador/indicado deixam de ser obrigatórios como FK (aditivo: linhas
-- existentes continuam válidas; novas linhas usam o vínculo por experiência
-- e/ou os campos de texto livre — a server action valida a presença).
ALTER TABLE public.indicacoes ALTER COLUMN responsavel_indicador_id DROP NOT NULL;
ALTER TABLE public.indicacoes ALTER COLUMN atleta_indicado_id DROP NOT NULL;

ALTER TABLE public.indicacoes
  ADD COLUMN IF NOT EXISTS indicador_experiencia_id UUID REFERENCES public.crm_experiencia(id),
  ADD COLUMN IF NOT EXISTS indicador_nome TEXT,
  ADD COLUMN IF NOT EXISTS indicado_nome TEXT,
  ADD COLUMN IF NOT EXISTS indicado_whatsapp TEXT;

COMMENT ON COLUMN public.indicacoes.indicador_experiencia_id IS
  'Família cliente (crm_experiencia) que fez a indicação. Ao converter, incrementa indicacoes_geradas via RPC.';
COMMENT ON COLUMN public.indicacoes.indicador_nome IS
  'Nome de exibição de quem indicou (resolvido do atleta da experiência ou digitado livre quando sem vínculo).';
COMMENT ON COLUMN public.indicacoes.indicado_nome IS
  'Nome do indicado quando ele ainda não existe no CRM (alternativa ao FK atleta_indicado_id).';
COMMENT ON COLUMN public.indicacoes.indicado_whatsapp IS
  'WhatsApp do indicado (somente dígitos, com DDI).';

CREATE INDEX IF NOT EXISTS idx_indicacoes_indicador_exp
  ON public.indicacoes(indicador_experiencia_id) WHERE deleted_at IS NULL;

-- RPC: incremento atômico do contador de indicações geradas da família.
-- SECURITY INVOKER: respeita a RLS de crm_experiencia (exp_update permite
-- ceo/head_sucesso; qualquer outro papel atualiza 0 linhas — fail-closed).
-- Retorna o nº de linhas atualizadas (0 = experiência inexistente/apagada).
CREATE OR REPLACE FUNCTION public.incrementar_indicacoes_geradas(p_experiencia_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $fn$
  WITH atualizadas AS (
    UPDATE public.crm_experiencia
       SET indicacoes_geradas = indicacoes_geradas + 1
     WHERE id = p_experiencia_id
       AND deleted_at IS NULL
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER FROM atualizadas;
$fn$;

REVOKE EXECUTE ON FUNCTION public.incrementar_indicacoes_geradas(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.incrementar_indicacoes_geradas(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.incrementar_indicacoes_geradas(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.incrementar_indicacoes_geradas(UUID) TO service_role;

-- ─── UAT (no-op enquanto as tabelas CRM não existirem no schema) ───
DO $mig$ BEGIN
  IF to_regclass('uat.indicacoes') IS NOT NULL
     AND to_regclass('uat.crm_experiencia') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.indicacoes ALTER COLUMN responsavel_indicador_id DROP NOT NULL';
    EXECUTE 'ALTER TABLE uat.indicacoes ALTER COLUMN atleta_indicado_id DROP NOT NULL';
    EXECUTE 'ALTER TABLE uat.indicacoes
      ADD COLUMN IF NOT EXISTS indicador_experiencia_id UUID REFERENCES uat.crm_experiencia(id),
      ADD COLUMN IF NOT EXISTS indicador_nome TEXT,
      ADD COLUMN IF NOT EXISTS indicado_nome TEXT,
      ADD COLUMN IF NOT EXISTS indicado_whatsapp TEXT';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_indicacoes_indicador_exp
      ON uat.indicacoes(indicador_experiencia_id) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE OR REPLACE FUNCTION uat.incrementar_indicacoes_geradas(p_experiencia_id UUID)
      RETURNS INTEGER
      LANGUAGE sql
      SECURITY INVOKER
      SET search_path = uat
      AS $fn$
        WITH atualizadas AS (
          UPDATE uat.crm_experiencia
             SET indicacoes_geradas = indicacoes_geradas + 1
           WHERE id = p_experiencia_id
             AND deleted_at IS NULL
          RETURNING 1
        )
        SELECT COUNT(*)::INTEGER FROM atualizadas;
      $fn$';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION uat.incrementar_indicacoes_geradas(UUID) FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION uat.incrementar_indicacoes_geradas(UUID) FROM anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION uat.incrementar_indicacoes_geradas(UUID) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION uat.incrementar_indicacoes_geradas(UUID) TO service_role';
  END IF;
END $mig$;

-- ─── DEV (no-op enquanto as tabelas CRM não existirem no schema) ───
DO $mig$ BEGIN
  IF to_regclass('dev.indicacoes') IS NOT NULL
     AND to_regclass('dev.crm_experiencia') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.indicacoes ALTER COLUMN responsavel_indicador_id DROP NOT NULL';
    EXECUTE 'ALTER TABLE dev.indicacoes ALTER COLUMN atleta_indicado_id DROP NOT NULL';
    EXECUTE 'ALTER TABLE dev.indicacoes
      ADD COLUMN IF NOT EXISTS indicador_experiencia_id UUID REFERENCES dev.crm_experiencia(id),
      ADD COLUMN IF NOT EXISTS indicador_nome TEXT,
      ADD COLUMN IF NOT EXISTS indicado_nome TEXT,
      ADD COLUMN IF NOT EXISTS indicado_whatsapp TEXT';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_indicacoes_indicador_exp
      ON dev.indicacoes(indicador_experiencia_id) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE OR REPLACE FUNCTION dev.incrementar_indicacoes_geradas(p_experiencia_id UUID)
      RETURNS INTEGER
      LANGUAGE sql
      SECURITY INVOKER
      SET search_path = dev
      AS $fn$
        WITH atualizadas AS (
          UPDATE dev.crm_experiencia
             SET indicacoes_geradas = indicacoes_geradas + 1
           WHERE id = p_experiencia_id
             AND deleted_at IS NULL
          RETURNING 1
        )
        SELECT COUNT(*)::INTEGER FROM atualizadas;
      $fn$';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION dev.incrementar_indicacoes_geradas(UUID) FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION dev.incrementar_indicacoes_geradas(UUID) FROM anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION dev.incrementar_indicacoes_geradas(UUID) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION dev.incrementar_indicacoes_geradas(UUID) TO service_role';
  END IF;
END $mig$;
