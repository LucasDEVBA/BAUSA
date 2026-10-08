-- ═══════════════════════════════════════════════════════════════════════
-- T4 — BACKFILL da faixa de investimento (atletas) e do valor estimado
-- (deals) afetados pelo mapeamento por substring. ESCRITA EM PRODUÇÃO:
-- SÓ RODAR COM AUTORIZAÇÃO EXPLÍCITA DO CEO, depois de mostrar a prévia
-- (01_previa.sql). Rodar fora do horário comercial (trava atletas/deals por
-- alguns milissegundos).
--
-- O que faz (uma transação; qualquer erro desfaz tudo):
--   A. atletas.faixa_investimento ← faixa EXATA do código do formulário
--      (só atletas vivos, só códigos conhecidos, só onde diverge).
--   B1. deals.valor_estimado ← valor canônico da faixa, SOMENTE onde o valor
--      é exatamente o que o bug gravava (22000 p/ 15k-20k, 28000 p/ 20k-30k,
--      32000 p/ 30k-40k) e o deal: está vivo, NÃO é customizado, NÃO tem
--      contrato (nem excluído), e o valor NUNCA foi editado (audit).
--
-- O que NÃO faz (de propósito):
--   • lead_score / lead_classificacao NÃO mudam: o trigger
--     trg_atletas_lead_score fica DESLIGADO nesta transação. Ele calcula o
--     score lendo a linha ANTIGA da tabela (BEFORE UPDATE) e reclassificaria
--     ~350 atletas (hot/cold→warm) — testado em ROLLBACK. Recalcular o score
--     é decisão separada (04_lead_score_OPCIONAL.sql).
--   • updated_at NÃO muda: o /pipeline usa deals.updated_at como "tempo na
--     etapa" e ordenação; set_updated_at fica DESLIGADO nesta transação.
--   • Estimativas na escala legada (18k/23k/25k/26k/35k/50k) ficam como
--     estão — normalizar é 03_escala_legada_OPCIONAL.sql.
--
-- Idempotente: rodar de novo depois do COMMIT atualiza 0 linhas.
-- Rastro: audit_logs (trigger) com ip_address = 'script:t4-backfill' —
-- 05_reverter.sql desfaz a partir dele.
--
-- Como rodar: SQL editor do Supabase (ou API de query) com o arquivo
-- inteiro. Ele termina em ROLLBACK. Confira os números da CONFERÊNCIA
-- (devem bater com a prévia aprovada) e só então troque a última linha
-- para COMMIT e rode de novo.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SELECT set_config('audit.ip_address', 'script:t4-backfill', true);

ALTER TABLE public.atletas DISABLE TRIGGER trg_atletas_lead_score;
ALTER TABLE public.atletas DISABLE TRIGGER trg_atletas_updated_at;
ALTER TABLE public.deals   DISABLE TRIGGER trg_deals_updated_at;

CREATE TEMP TABLE _t4_mapa (codigo text PRIMARY KEY, faixa text NOT NULL) ON COMMIT DROP;
INSERT INTO _t4_mapa VALUES
  ('15k-20k','ate_20k'), ('20k-30k','20k_30k'), ('30k-40k','30k_40k'),
  ('40k-50k','40k_mais'), ('50k-70k','40k_mais'), ('over-70k','40k_mais'),
  ('abaixo-15k','ate_20k'), ('acima-50k','40k_mais');

CREATE TEMP TABLE _t4_valor (faixa text PRIMARY KEY, valor numeric NOT NULL) ON COMMIT DROP;
INSERT INTO _t4_valor VALUES ('ate_20k',16000), ('20k_30k',22000), ('30k_40k',28000), ('40k_mais',32000);

CREATE TEMP TABLE _t4_bug (codigo text PRIMARY KEY, valor_bugado numeric NOT NULL) ON COMMIT DROP;
INSERT INTO _t4_bug VALUES ('15k-20k',22000), ('20k-30k',28000), ('30k-40k',32000);

-- ─── A. Faixa do atleta ────────────────────────────────────────────────
CREATE TEMP TABLE _t4_atletas ON COMMIT DROP AS
SELECT a.id, a.faixa_investimento AS faixa_antes, m.faixa AS faixa_depois
FROM public.atletas a
JOIN public.form_submissions fs ON fs.id = a.form_submission_id
JOIN _t4_mapa m
  ON m.codigo = regexp_replace(replace(lower(btrim(fs.investment_range)), '_', '-'), '\s+', '', 'g')
WHERE a.deleted_at IS NULL
  AND a.faixa_investimento IS DISTINCT FROM m.faixa;

UPDATE public.atletas a
SET faixa_investimento = t.faixa_depois
FROM _t4_atletas t
WHERE a.id = t.id
  AND a.faixa_investimento = t.faixa_antes;   -- CAS: não sobrescreve edição concorrente

-- ─── B1. Valor do deal (só o que o bug gravou) ─────────────────────────
CREATE TEMP TABLE _t4_deals ON COMMIT DROP AS
SELECT d.id, d.valor_estimado AS valor_antes, v.valor AS valor_depois
FROM public.deals d
JOIN public.atletas a ON a.id = d.atleta_id
JOIN public.form_submissions fs ON fs.id = a.form_submission_id
JOIN _t4_mapa m
  ON m.codigo = regexp_replace(replace(lower(btrim(fs.investment_range)), '_', '-'), '\s+', '', 'g')
JOIN _t4_valor v ON v.faixa = m.faixa
JOIN _t4_bug b ON b.codigo = m.codigo
WHERE d.deleted_at IS NULL
  AND d.flag_valores_customizados = false
  AND d.valor_estimado = b.valor_bugado
  AND d.valor_estimado IS DISTINCT FROM v.valor
  AND NOT EXISTS (SELECT 1 FROM public.contratos_financeiros c WHERE c.deal_id = d.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.audit_logs l
    WHERE l.tabela = 'deals' AND l.registro_id = d.id AND l.operacao = 'UPDATE'
      AND 'valor_estimado' = ANY (l.campos_alterados)
  );

UPDATE public.deals d
SET valor_estimado = t.valor_depois
FROM _t4_deals t
WHERE d.id = t.id
  AND d.valor_estimado = t.valor_antes          -- CAS
  AND d.flag_valores_customizados = false;      -- customizou no meio? não toca

ALTER TABLE public.atletas ENABLE TRIGGER trg_atletas_lead_score;
ALTER TABLE public.atletas ENABLE TRIGGER trg_atletas_updated_at;
ALTER TABLE public.deals   ENABLE TRIGGER trg_deals_updated_at;

-- ─── CONFERÊNCIA (mesma transação) ─────────────────────────────────────
-- Esperado na prévia de 2026-10-08: A=350 atletas (262 15k-20k, 63 20k-30k,
-- 25 30k-40k); B1=317 deals (234 / 58 / 25). Números diferentes = PARAR,
-- refazer a prévia e reapresentar ao CEO.
SELECT 'A atletas' AS bloco, faixa_antes || ' → ' || faixa_depois AS mudanca, count(*) AS linhas
FROM _t4_atletas GROUP BY 2
UNION ALL
SELECT 'B1 deals', valor_antes::int || ' → ' || valor_depois::int, count(*)
FROM _t4_deals GROUP BY 2
UNION ALL
SELECT 'audit gravado', tabela, count(*)
FROM public.audit_logs
WHERE ip_address = 'script:t4-backfill' AND created_at >= now() - interval '5 minutes'
GROUP BY tabela
UNION ALL
SELECT 'triggers religados', tgname, (tgenabled = 'O')::int
FROM pg_trigger
WHERE tgname IN ('trg_atletas_lead_score', 'trg_atletas_updated_at', 'trg_deals_updated_at')
ORDER BY 1, 2;

ROLLBACK;   -- ← trocar por COMMIT SÓ depois de conferir e com o "pode rodar" do CEO
