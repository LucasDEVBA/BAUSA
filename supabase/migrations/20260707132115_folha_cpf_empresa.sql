-- ════════════════════════════════════════════════════════════════════════
-- Migration: Folha G2 — CPF do colaborador + dados da empresa (recibos)
-- Aplica em: public, uat, dev (colaboradores é multi-schema); config em public
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   Recibo de pagamento (folha/despesa) precisa do CPF de quem recebe e dos
--   dados de quem paga (razão social + CNPJ). Adiciona cpf em colaboradores e
--   semeia empresa_dados em configuracoes_sistema (editável pelo CEO).
--   Forward-only, idempotente. Coluna aditiva nullable (segura em PRD).
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC ─────────────────────────────────────────────────────────────
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS cpf TEXT;
COMMENT ON COLUMN public.colaboradores.cpf IS 'CPF do colaborador (opcional) — usado no recibo de pagamento.';

INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
SELECT 'empresa_dados', $json$
{
  "razao_social": "Bolsa Atleta USA",
  "cnpj": "",
  "cidade": ""
}
$json$::jsonb, 'Dados da empresa (pagador) para recibos: razão social, CNPJ e cidade.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.configuracoes_sistema WHERE chave = 'empresa_dados'
);

-- ─── UAT ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.colaboradores') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.colaboradores ADD COLUMN IF NOT EXISTS cpf TEXT';
  END IF;
END $$;

-- ─── DEV ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.colaboradores') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.colaboradores ADD COLUMN IF NOT EXISTS cpf TEXT';
  END IF;
END $$;
