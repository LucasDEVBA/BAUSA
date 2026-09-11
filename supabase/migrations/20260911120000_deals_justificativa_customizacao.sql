-- ════════════════════════════════════════════════════════════════════════
-- deals.justificativa_customizacao — coluna que faltava (bug 2026-09-11)
-- ════════════════════════════════════════════════════════════════════════
--
-- customizarValorDeal grava a justificativa da customização de valor no
-- DEAL (flag_valores_customizados já existia), mas a coluna nunca foi
-- criada — PostgREST: "Could not find the 'justificativa_customizacao'
-- column of 'deals' in the schema cache". Pegou o CEO customizando um
-- valor em produção.
--
-- HOTFIX: o mesmo DDL já foi aplicado direto em public via Management API
-- em 2026-09-11 (desbloqueio imediato). Esta migration VERSIONA o schema —
-- idempotente, o deploy encontra a coluna existente e segue.

DO $$
BEGIN
  IF to_regclass('public.deals') IS NOT NULL THEN
    ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS justificativa_customizacao TEXT;
    COMMENT ON COLUMN public.deals.justificativa_customizacao IS
      'Motivo da customização do valor estimado (Regra 3 — sempre com flag_valores_customizados)';
  ELSE
    RAISE NOTICE 'deals_justificativa: sem tabela deals — pulado';
  END IF;
END $$;
