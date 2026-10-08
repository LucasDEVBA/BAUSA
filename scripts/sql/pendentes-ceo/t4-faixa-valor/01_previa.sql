-- ═══════════════════════════════════════════════════════════════════════
-- T4 — PRÉVIA (somente leitura) do backfill de faixa de investimento e
-- valor estimado. Rodar ANTES de pedir autorização ao CEO e anexar o
-- resultado ao pedido. Não escreve nada.
--
-- Mapeamento EXATO (= apps/crm/src/lib/faixa-investimento.ts):
--   15k-20k→ate_20k/16000 · 20k-30k→20k_30k/22000 · 30k-40k→30k_40k/28000
--   40k-50k|50k-70k|over-70k→40k_mais/32000 · abaixo-15k→ate_20k · acima-50k→40k_mais
-- Normalização do código = trim + lower + "_"→"-" + sem espaços.
-- ═══════════════════════════════════════════════════════════════════════

WITH mapa(codigo, faixa) AS (
  VALUES ('15k-20k','ate_20k'), ('20k-30k','20k_30k'), ('30k-40k','30k_40k'),
         ('40k-50k','40k_mais'), ('50k-70k','40k_mais'), ('over-70k','40k_mais'),
         ('abaixo-15k','ate_20k'), ('acima-50k','40k_mais')
), valores(faixa, valor) AS (
  VALUES ('ate_20k',16000::numeric), ('20k_30k',22000), ('30k_40k',28000), ('40k_mais',32000)
), bug(codigo, valor_bugado) AS (
  -- o que o mapeamento antigo (substring) gravava p/ cada código afetado
  VALUES ('15k-20k',22000::numeric), ('20k-30k',28000), ('30k-40k',32000)
), base AS (
  SELECT d.id AS deal_id, d.etapa::text AS etapa, d.valor_estimado,
         d.flag_valores_customizados, d.deleted_at IS NOT NULL AS deal_excluido,
         a.id AS atleta_id, a.faixa_investimento,
         regexp_replace(replace(lower(btrim(fs.investment_range)), '_', '-'), '\s+', '', 'g') AS codigo,
         EXISTS (SELECT 1 FROM public.contratos_financeiros c WHERE c.deal_id = d.id) AS tem_contrato,
         EXISTS (SELECT 1 FROM public.audit_logs l
                  WHERE l.tabela = 'deals' AND l.registro_id = d.id AND l.operacao = 'UPDATE'
                    AND 'valor_estimado' = ANY (l.campos_alterados)) AS valor_editado_antes
  FROM public.deals d
  JOIN public.atletas a ON a.id = d.atleta_id
  JOIN public.form_submissions fs ON fs.id = a.form_submission_id
), classif AS (
  SELECT b.*, m.faixa AS faixa_correta, v.valor AS valor_correto, bg.valor_bugado,
         CASE
           WHEN b.deal_excluido THEN 'fora: deal excluído'
           WHEN b.tem_contrato THEN 'fora: tem contrato'
           WHEN b.flag_valores_customizados THEN 'fora: valor customizado'
           WHEN b.valor_editado_antes THEN 'fora: valor editado (audit)'
           WHEN m.faixa IS NULL THEN 'fora: código desconhecido'
           WHEN b.valor_estimado = v.valor THEN 'ok: já canônico'
           WHEN bg.valor_bugado IS NOT NULL AND b.valor_estimado = bg.valor_bugado THEN 'B1: bug do mapeamento'
           WHEN b.valor_estimado IN (18000, 23000, 25000, 26000, 35000, 50000) THEN 'B2 (opcional): escala legada'
           ELSE 'fora: valor fora do padrão automático'
         END AS escopo_valor
  FROM base b
  LEFT JOIN mapa m ON m.codigo = b.codigo
  LEFT JOIN valores v ON v.faixa = m.faixa
  LEFT JOIN bug bg ON bg.codigo = b.codigo
)
SELECT escopo_valor, codigo, valor_estimado AS valor_hoje, valor_correto AS valor_depois,
       count(*) AS deals,
       count(*) FILTER (WHERE etapa NOT IN ('perdido','concluido','cancelamento_solicitado')) AS deals_ativos,
       sum(valor_correto - valor_estimado) FILTER (WHERE escopo_valor LIKE 'B%'
             AND etapa NOT IN ('perdido','concluido','cancelamento_solicitado')) AS delta_pipeline_ativo
FROM classif
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2, 3;

-- Faixa do atleta (bloco A) — independe de deal/contrato (é resposta do formulário)
WITH mapa(codigo, faixa) AS (
  VALUES ('15k-20k','ate_20k'), ('20k-30k','20k_30k'), ('30k-40k','30k_40k'),
         ('40k-50k','40k_mais'), ('50k-70k','40k_mais'), ('over-70k','40k_mais'),
         ('abaixo-15k','ate_20k'), ('acima-50k','40k_mais')
)
SELECT a.faixa_investimento AS faixa_hoje, m.faixa AS faixa_depois, m.codigo, count(*) AS atletas
FROM public.atletas a
JOIN public.form_submissions fs ON fs.id = a.form_submission_id
JOIN mapa m ON m.codigo = regexp_replace(replace(lower(btrim(fs.investment_range)), '_', '-'), '\s+', '', 'g')
WHERE a.deleted_at IS NULL
  AND a.faixa_investimento IS DISTINCT FROM m.faixa
GROUP BY 1, 2, 3
ORDER BY 3, 1;
