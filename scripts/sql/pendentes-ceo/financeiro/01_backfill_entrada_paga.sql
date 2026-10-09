-- ════════════════════════════════════════════════════════════════════════
-- PENDENTE DE AUTORIZAÇÃO DO CEO — NÃO é migration (não vai em supabase/migrations)
-- T5.3 — backfill de contratos_financeiros.entrada_paga / entrada_paga_at
--
-- O que faz: marca entrada_paga = true e entrada_paga_at = max(recebido_at)
--   nos contratos VIVOS cujas parcelas de entrada vivas estão TODAS recebidas.
--   Hoje (08/10) afeta só 1 contrato: Amanda Tavares Mantovan (8f076d97),
--   entrada de R$ 7,80 recebida em 31/08 — ela passa a aparecer em
--   "NF pendentes" e o CSV sai "Sim".
-- ATENÇÃO: o contrato da Amanda tem dado errado (R$ 7,80). Se a correção do
--   script 02 for feita ANTES, este backfill é desnecessário para ela (as RPCs
--   recalculam entrada_paga a cada escrita). Rodar este script só faz sentido
--   se o CEO quiser o flag coerente já, antes da correção.
-- Idempotente: só toca linha com flag divergente. Pode rodar 2x.
-- Executar via Management API / SQL editor, como postgres.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. PRÉVIA (rodar primeiro; somente leitura) ────────────────────────
SELECT c.id AS contrato_id, a.nome_completo AS atleta, c.entrada_valor,
       c.entrada_paga, c.entrada_paga_at,
       count(p.id) AS parcelas_entrada,
       count(p.id) FILTER (WHERE p.status = 'recebido') AS recebidas,
       max(p.recebido_at) AS ultima_baixa
  FROM public.contratos_financeiros c
  JOIN public.deals d ON d.id = c.deal_id
  JOIN public.atletas a ON a.id = d.atleta_id
  JOIN public.parcelas p ON p.contrato_id = c.id AND p.tipo = 'entrada'
                        AND p.deleted_at IS NULL AND p.status <> 'cancelado'
 WHERE c.deleted_at IS NULL
 GROUP BY c.id, a.nome_completo
HAVING count(p.id) > 0
   AND count(p.id) = count(p.id) FILTER (WHERE p.status = 'recebido')
   AND (NOT c.entrada_paga OR c.entrada_paga_at IS DISTINCT FROM max(p.recebido_at));

-- ─── 2. APLICAR (só com "pode aplicar" explícito do CEO) ────────────────
BEGIN;
SELECT set_config('audit.user_id', '142d518a-0623-4bfe-a1b2-1d8ea5ac744a', true); -- executor (CTO) — ajuste se outro rodar
SELECT set_config('audit.user_papel', 'cto', true);

WITH alvo AS (
  SELECT c.id, max(p.recebido_at) AS pago_em
    FROM public.contratos_financeiros c
    JOIN public.parcelas p ON p.contrato_id = c.id AND p.tipo = 'entrada'
                          AND p.deleted_at IS NULL AND p.status <> 'cancelado'
   WHERE c.deleted_at IS NULL
   GROUP BY c.id
  HAVING count(*) = count(*) FILTER (WHERE p.status = 'recebido')
)
UPDATE public.contratos_financeiros c
   SET entrada_paga = true, entrada_paga_at = alvo.pago_em
  FROM alvo
 WHERE c.id = alvo.id
   AND (NOT c.entrada_paga OR c.entrada_paga_at IS DISTINCT FROM alvo.pago_em)
RETURNING c.id, c.entrada_paga, c.entrada_paga_at;

-- Conferir o RETURNING acima (esperado hoje: 1 linha, 8f076d97…, 2026-08-31 14:35:24+00).

-- ─── 3. CONFERÊNCIA (ainda DENTRO da transação do bloco 2) (somente leitura) ───────────────────────────────────
-- Esperado: 0 linhas (nenhum contrato com entrada toda recebida e flag falso).
SELECT c.id
  FROM public.contratos_financeiros c
 WHERE c.deleted_at IS NULL AND NOT c.entrada_paga
   AND EXISTS (SELECT 1 FROM public.parcelas p WHERE p.contrato_id = c.id AND p.tipo = 'entrada'
                 AND p.deleted_at IS NULL AND p.status <> 'cancelado')
   AND NOT EXISTS (SELECT 1 FROM public.parcelas p WHERE p.contrato_id = c.id AND p.tipo = 'entrada'
                     AND p.deleted_at IS NULL AND p.status NOT IN ('recebido', 'cancelado'));

-- ─── 4. FECHAR ──────────────────────────────────────────────────────────
-- Padrão SEGURO: o arquivo inteiro termina em ROLLBACK (rodar tudo de uma vez
-- não persiste nada). Só depois de conferir o bloco 3 — dentro da MESMA
-- transação — e com o "pode aplicar" do CEO, troque a linha abaixo por COMMIT.
ROLLBACK;
