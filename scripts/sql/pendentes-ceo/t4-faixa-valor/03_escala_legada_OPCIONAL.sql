-- ═══════════════════════════════════════════════════════════════════════
-- T4 — OPCIONAL (decisão do CEO, separada do 02): normalizar as
-- ESTIMATIVAS em escala legada para a tabela atual da faixa.
--
-- De onde vêm: deals criados antes do mapeamento atual —
--   • migration 20260401002000 (02/04): 18000 (15k-20k), 23000 (20k-30k),
--     26000 (30k-40k e 40k-50k);
--   • lote de 09/05 (21:13–21:14): 25000, 35000, 50000.
-- Todos automáticos (flag_valores_customizados=false, nenhum UPDATE de
-- valor no audit). Prévia de 2026-10-08: 84 deals vivos (42 ativos),
-- pipeline ativo −R$ 252.000.
--
-- Mesmas salvaguardas do 02 (só deal vivo, não customizado, sem contrato,
-- nunca editado; updated_at preservado; CAS). Pode rodar antes ou depois do
-- 02 (independentes). Termina em ROLLBACK — trocar por COMMIT só com o
-- "pode rodar" do CEO para ESTE escopo.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SELECT set_config('audit.ip_address', 'script:t4-escala-legada', true);

ALTER TABLE public.deals DISABLE TRIGGER trg_deals_updated_at;

CREATE TEMP TABLE _t4l_mapa (codigo text PRIMARY KEY, faixa text NOT NULL) ON COMMIT DROP;
INSERT INTO _t4l_mapa VALUES
  ('15k-20k','ate_20k'), ('20k-30k','20k_30k'), ('30k-40k','30k_40k'),
  ('40k-50k','40k_mais'), ('50k-70k','40k_mais'), ('over-70k','40k_mais'),
  ('abaixo-15k','ate_20k'), ('acima-50k','40k_mais');

CREATE TEMP TABLE _t4l_valor (faixa text PRIMARY KEY, valor numeric NOT NULL) ON COMMIT DROP;
INSERT INTO _t4l_valor VALUES ('ate_20k',16000), ('20k_30k',22000), ('30k_40k',28000), ('40k_mais',32000);

CREATE TEMP TABLE _t4l_deals ON COMMIT DROP AS
SELECT d.id, m.codigo, d.valor_estimado AS valor_antes, v.valor AS valor_depois
FROM public.deals d
JOIN public.atletas a ON a.id = d.atleta_id
JOIN public.form_submissions fs ON fs.id = a.form_submission_id
JOIN _t4l_mapa m
  ON m.codigo = regexp_replace(replace(lower(btrim(fs.investment_range)), '_', '-'), '\s+', '', 'g')
JOIN _t4l_valor v ON v.faixa = m.faixa
WHERE d.deleted_at IS NULL
  AND d.flag_valores_customizados = false
  AND d.valor_estimado IN (18000, 23000, 25000, 26000, 35000, 50000)
  AND d.valor_estimado IS DISTINCT FROM v.valor
  AND NOT EXISTS (SELECT 1 FROM public.contratos_financeiros c WHERE c.deal_id = d.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.audit_logs l
    WHERE l.tabela = 'deals' AND l.registro_id = d.id AND l.operacao = 'UPDATE'
      AND 'valor_estimado' = ANY (l.campos_alterados)
  );

UPDATE public.deals d
SET valor_estimado = t.valor_depois
FROM _t4l_deals t
WHERE d.id = t.id
  AND d.valor_estimado = t.valor_antes
  AND d.flag_valores_customizados = false;

ALTER TABLE public.deals ENABLE TRIGGER trg_deals_updated_at;

-- CONFERÊNCIA — esperado em 2026-10-08: 84 deals
-- (15k-20k: 33×18000 + 28×25000 · 20k-30k: 14×23000 + 4×35000 ·
--  30k-40k: 4×26000 · over-70k: 1×50000).
SELECT codigo, valor_antes::int || ' → ' || valor_depois::int AS mudanca, count(*) AS deals
FROM _t4l_deals GROUP BY 1, 2
UNION ALL
SELECT 'audit gravado', tabela, count(*)
FROM public.audit_logs
WHERE ip_address = 'script:t4-escala-legada' AND created_at >= now() - interval '5 minutes'
GROUP BY tabela
ORDER BY 1, 2;

ROLLBACK;   -- ← COMMIT só com autorização do CEO para este escopo
