-- ════════════════════════════════════════════════════════════════════════
-- Migration: Marketing fonte única (M1) — remove o seed de despesa de marketing
-- Aplica em: public (o seed só foi semeado em public)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   Decisão: o gasto de marketing passa a viver EXCLUSIVAMENTE em
--   investimentos_marketing (fonte única que alimenta CAC E DRE). A migration
--   20260707023149 semeou uma despesa recorrente 'Marketing / Tráfego pago'
--   (R$ 3.000/mês, categoria=marketing) — que agora dobraria o custo (uma vez
--   no DRE via despesa, outra via investimentos_marketing). Soft-delete dessa
--   linha semeada para o DRE não contar marketing duas vezes.
--
--   Só remove a linha do SEED (descrição exata + recorrente + categoria
--   marketing). Não toca em despesas de marketing que o CEO tenha criado à mão
--   (improvável, mas preservado). Idempotente.
-- ════════════════════════════════════════════════════════════════════════

UPDATE public.despesas
SET deleted_at = NOW()
WHERE descricao = 'Marketing / Tráfego pago'
  AND categoria = 'marketing'
  AND recorrente = true
  AND deleted_at IS NULL;
