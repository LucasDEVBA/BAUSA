-- ════════════════════════════════════════════════════════════════════════
-- SCRIPT DE DADOS (NÃO é migration) — T21 · Pergunta 4(c) ao CEO
-- Troca a próxima ação VENCIDA "Preparar para reunião" pela ação padrão da
-- coluna nos deals que JÁ PASSARAM da reunião.
--
-- ⛔ SÓ RODAR COM AUTORIZAÇÃO EXPLÍCITA DO CEO ("pode trocar as 27 ações").
-- Pré-requisitos: migrations *_plano_escolhido_ordem_board_retrocesso (chave etapas_deal_regras) e
-- *_deals_next_action_meta (colunas next_action_etapa / next_action_manual_em) aplicadas.
--
-- Como rodar (Supabase SQL editor ou API de query), em 3 passos:
--   1) PRÉVIA  — só o SELECT do bloco 1; conferir a lista com o CEO.
--   2) EXECUÇÃO — o bloco 2 inteiro (BEGIN … COMMIT). Idempotente: re-rodar
--      não acha mais nada (o filtro é o próprio texto antigo).
--   3) CONFERÊNCIA — o SELECT do bloco 3 só pode listar colunas SEM ação
--      padrão (hoje: custom_2 "Valor total pago", 2 deals).
-- Colunas sem ação padrão (ex.: as personalizadas) NÃO são tocadas: o card
-- delas já deixa de pintar a ação como vencida (regra de "ação de etapa
-- anterior" do Engine).
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. PRÉVIA (somente leitura) ─────────────────────────────────────────
SELECT d.id,
       d.etapa::text                                              AS etapa,
       d.next_action                                              AS acao_atual,
       d.data_proxima_acao                                        AS vence_em,
       r.valor -> d.etapa::text -> 'acao_padrao' ->> 'texto'      AS acao_nova,
       (now() AT TIME ZONE 'America/Sao_Paulo')::date
         + COALESCE((r.valor -> d.etapa::text -> 'acao_padrao' ->> 'dias')::int, 0) AS nova_data
FROM public.deals d
CROSS JOIN (SELECT valor FROM public.configuracoes_sistema WHERE chave = 'etapas_deal_regras') r
WHERE d.deleted_at IS NULL
  AND d.next_action IN ('Preparar para reunião', 'Preparar para reuniao')
  AND d.next_action_manual_em IS NULL   -- nunca sobre ação assumida à mão pelo CEO
  AND d.etapa::text NOT IN ('contato_feito', 'lead', 'aguardando_timing', 'reuniao_marcada',
                            'perdido', 'concluido', 'cancelamento_solicitado', 'projeto_futuro')
ORDER BY d.etapa, d.data_proxima_acao;

-- ─── 2. EXECUÇÃO (com autorização) ───────────────────────────────────────
BEGIN;

WITH regras AS (
  SELECT valor FROM public.configuracoes_sistema WHERE chave = 'etapas_deal_regras'
), alvo AS (
  SELECT d.id,
         r.valor -> d.etapa::text -> 'acao_padrao' ->> 'texto'                     AS texto,
         COALESCE((r.valor -> d.etapa::text -> 'acao_padrao' ->> 'dias')::int, 0)   AS dias,
         d.etapa::text                                                               AS etapa
  FROM public.deals d CROSS JOIN regras r
  WHERE d.deleted_at IS NULL
    AND d.next_action IN ('Preparar para reunião', 'Preparar para reuniao')
    AND d.next_action_manual_em IS NULL
    AND d.etapa::text NOT IN ('contato_feito', 'lead', 'aguardando_timing', 'reuniao_marcada',
                              'perdido', 'concluido', 'cancelamento_solicitado', 'projeto_futuro')
    AND length(btrim(COALESCE(r.valor -> d.etapa::text -> 'acao_padrao' ->> 'texto', ''))) >= 3
)
UPDATE public.deals d
SET next_action           = a.texto,
    data_proxima_acao     = (now() AT TIME ZONE 'America/Sao_Paulo')::date + LEAST(GREATEST(a.dias, 0), 60),
    next_action_etapa     = a.etapa,
    next_action_manual_em = NULL
FROM alvo a
WHERE d.id = a.id
  AND d.next_action IN ('Preparar para reunião', 'Preparar para reuniao')   -- CAS: ninguém mexeu desde a prévia
  AND d.next_action_manual_em IS NULL
RETURNING d.id, d.etapa::text, d.next_action, d.data_proxima_acao;


-- ─── 3. CONFERÊNCIA (deve voltar só deals de colunas SEM ação padrão) ────
SELECT d.etapa::text, count(*) AS restantes
FROM public.deals d
WHERE d.deleted_at IS NULL
  AND d.next_action IN ('Preparar para reunião', 'Preparar para reuniao')
  AND d.next_action_manual_em IS NULL
  AND d.etapa::text NOT IN ('contato_feito', 'lead', 'aguardando_timing', 'reuniao_marcada',
                            'perdido', 'concluido', 'cancelamento_solicitado', 'projeto_futuro')
GROUP BY 1;

-- ─── FIM — padrão PLANO.md §5 ────────────────────────────────────────────
-- A conferência acima roda DENTRO da transação aberta no passo de execução.
-- Este arquivo termina em ROLLBACK de propósito: rodar inteiro NÃO persiste.
-- Trocar por COMMIT somente com a autorização explícita do CEO (pergunta 4c),
-- depois de conferir o "UPDATE n" e a conferência.
ROLLBACK;
