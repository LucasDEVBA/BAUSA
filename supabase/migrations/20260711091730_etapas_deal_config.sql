-- ════════════════════════════════════════════════════════════
-- Migration: Etapas do pipeline COMERCIAL com apresentação configurável
-- Aplica em: public (PRD) direto + uat/dev via DO blocks gateados
-- Contexto:
--   • Nova chave `etapas_deal_config` em configuracoes_sistema —
--     overrides POR ETAPA de apresentação (rótulo, acento de cor,
--     ordem de exibição, ocultar coluna do Kanban). `{}` = defaults
--     do código (fail-open, ver apps/crm/src/lib/etapas-deal.ts).
--     O enum PG `status_deal` NÃO muda — só a apresentação.
--   • A chave `probabilidade_por_etapa` (seed 20260401000300, até
--     aqui órfã — ninguém lia) passa a ser lida pelo Engine em
--     moverDeal/promoverLead via getProbabilidadePorEtapa(); nenhum
--     DDL necessário para ela (já existe em todos os ambientes).
-- Idempotente: ON CONFLICT DO NOTHING. Só seed — sem função/enum.
-- ════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD): seed idempotente da chave de overrides ───
INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
VALUES (
  'etapas_deal_config',
  '{}'::jsonb,
  'Overrides de apresentação das etapas do pipeline comercial (rótulo, acento de cor, ordem de exibição e ocultar coluna do Kanban). Vazio = padrões do código. Formato: {"lead": {"label": "Lead", "accent": "blue", "order": 0, "oculta": false}}. Acentos válidos: blue, green, orange, red, purple, neutral. Os valores internos das etapas (enum status_deal) não mudam — automações e relatórios continuam funcionando.'
)
ON CONFLICT (chave) DO NOTHING;

-- ─── UAT: seed da chave (gateado — schema pode não ter a tabela) ───
DO $$
BEGIN
  IF to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    INSERT INTO uat.configuracoes_sistema (chave, valor, descricao)
    VALUES (
      'etapas_deal_config',
      '{}'::jsonb,
      'Overrides de apresentação das etapas do pipeline comercial (rótulo, acento de cor, ordem de exibição e ocultar coluna do Kanban). Vazio = padrões do código. Formato: {"lead": {"label": "Lead", "accent": "blue", "order": 0, "oculta": false}}. Acentos válidos: blue, green, orange, red, purple, neutral. Os valores internos das etapas (enum status_deal) não mudam — automações e relatórios continuam funcionando.'
    )
    ON CONFLICT (chave) DO NOTHING;
  END IF;
END $$;

-- ─── DEV: seed da chave (gateado — schema pode não ter a tabela) ───
DO $$
BEGIN
  IF to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN
    INSERT INTO dev.configuracoes_sistema (chave, valor, descricao)
    VALUES (
      'etapas_deal_config',
      '{}'::jsonb,
      'Overrides de apresentação das etapas do pipeline comercial (rótulo, acento de cor, ordem de exibição e ocultar coluna do Kanban). Vazio = padrões do código. Formato: {"lead": {"label": "Lead", "accent": "blue", "order": 0, "oculta": false}}. Acentos válidos: blue, green, orange, red, purple, neutral. Os valores internos das etapas (enum status_deal) não mudam — automações e relatórios continuam funcionando.'
    )
    ON CONFLICT (chave) DO NOTHING;
  END IF;
END $$;
