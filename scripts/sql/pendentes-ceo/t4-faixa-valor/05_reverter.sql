-- ═══════════════════════════════════════════════════════════════════════
-- T4 — REVERSÃO dos scripts 02/03/04 a partir do audit_logs (marcador em
-- ip_address). Termina em ROLLBACK; COMMIT só com decisão explícita.
--
-- Como reverte (CAMPO a CAMPO, não linha a linha de audit):
--   Para cada (registro, campo) que os marcadores escolhidos alteraram —
--   deals.valor_estimado, atletas.faixa_investimento, atletas.lead_score,
--   atletas.lead_score_calculado_at — restaura o valor de ANTES da 1ª
--   alteração escolhida, e só se o valor atual ainda é o que a ÚLTIMA
--   alteração escolhida gravou (CAS): edição posterior do CEO é preservada.
--   Por que por campo: o 02 (faixa) e o 04 (score) mexem nos MESMOS atletas.
--   Escolher só a linha de audit mais recente por registro pegava a do 04,
--   pulava a faixa do 02 e a conferência ainda contava "revertida".
--
-- Combinações:
--   • 02 + 04 juntos: reverte faixa e score de uma vez (caso normal).
--   • Só o 02 com o 04 ainda aplicado: BLOQUEADO (RAISE) — o score ficaria
--     calculado sobre a faixa corrigida. Inclua o 04 (ou reverta-o antes).
--   • 03 é independente (deals que o 02 nunca toca, e vice-versa).
--
-- Uso: deixar descomentadas só as linhas INSERT dos marcadores a reverter
-- (uma por linha — comentar/descomentar nunca quebra a sintaxe) e rodar.
-- Conferir a CONFERÊNCIA no fim; trocar ROLLBACK por COMMIT só com decisão.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SELECT set_config('audit.ip_address', 'script:t4-reversao', true);

-- `ordem` = ordem em que os scripts rodam (02 → 03 → 04); desempata
-- alterações gravadas no mesmo instante.
CREATE TEMP TABLE _t4r_marcadores (m text PRIMARY KEY, ordem int NOT NULL) ON COMMIT DROP;
INSERT INTO _t4r_marcadores VALUES ('script:t4-backfill', 1);          -- 02
-- INSERT INTO _t4r_marcadores VALUES ('script:t4-escala-legada', 2);  -- 03
-- INSERT INTO _t4r_marcadores VALUES ('script:t4-lead-score', 3);     -- 04

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _t4r_marcadores WHERE m = 'script:t4-backfill')
     AND NOT EXISTS (SELECT 1 FROM _t4r_marcadores WHERE m = 'script:t4-lead-score')
     AND EXISTS (
       SELECT 1
       FROM public.audit_logs l
       JOIN public.atletas a ON a.id = l.registro_id
       WHERE l.tabela = 'atletas' AND l.operacao = 'UPDATE'
         AND l.ip_address = 'script:t4-lead-score'
         AND 'lead_score' = ANY (l.campos_alterados)
         AND a.lead_score IS NOT DISTINCT FROM (l.dados_novos ->> 'lead_score')::int
     ) THEN
    RAISE EXCEPTION 'T4: o score do 04 ainda está aplicado. Inclua script:t4-lead-score nos marcadores (ou reverta o 04 antes) para não deixar lead_score calculado sobre a faixa corrigida.';
  END IF;
END $$;

-- Trigger de score desligado: ele recalcularia lendo a linha ANTIGA (ver 02).
ALTER TABLE public.atletas DISABLE TRIGGER trg_atletas_lead_score;
ALTER TABLE public.atletas DISABLE TRIGGER trg_atletas_updated_at;
ALTER TABLE public.deals   DISABLE TRIGGER trg_deals_updated_at;

CREATE TEMP TABLE _t4r ON COMMIT DROP AS
WITH alteracoes AS (
  SELECT l.tabela, l.registro_id, c.campo, l.created_at, mk.ordem,
         l.dados_anteriores ->> c.campo AS valor_antes,
         l.dados_novos ->> c.campo AS valor_depois
  FROM public.audit_logs l
  JOIN _t4r_marcadores mk ON mk.m = l.ip_address
  CROSS JOIN LATERAL unnest(l.campos_alterados) AS c(campo)
  WHERE l.operacao = 'UPDATE'
    AND (l.tabela, c.campo) IN (
      ('deals', 'valor_estimado'),
      ('atletas', 'faixa_investimento'),
      ('atletas', 'lead_score'),
      ('atletas', 'lead_score_calculado_at'))
)
SELECT DISTINCT tabela, registro_id, campo,
       first_value(valor_antes) OVER w AS restaurar,
       last_value(valor_depois) OVER w AS gravado_pelo_script
FROM alteracoes
WINDOW w AS (PARTITION BY tabela, registro_id, campo ORDER BY created_at, ordem
             ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING);

UPDATE public.deals d
SET valor_estimado = r.restaurar::numeric
FROM _t4r r
WHERE r.tabela = 'deals' AND r.campo = 'valor_estimado' AND d.id = r.registro_id
  AND d.valor_estimado IS NOT DISTINCT FROM r.gravado_pelo_script::numeric   -- CAS
  AND d.flag_valores_customizados = false;

UPDATE public.atletas a
SET faixa_investimento = r.restaurar
FROM _t4r r
WHERE r.tabela = 'atletas' AND r.campo = 'faixa_investimento' AND a.id = r.registro_id
  AND a.faixa_investimento IS NOT DISTINCT FROM r.gravado_pelo_script;      -- CAS

UPDATE public.atletas a
SET lead_score = r.restaurar::int
FROM _t4r r
WHERE r.tabela = 'atletas' AND r.campo = 'lead_score' AND a.id = r.registro_id
  AND a.lead_score IS NOT DISTINCT FROM r.gravado_pelo_script::int;          -- CAS

UPDATE public.atletas a
SET lead_score_calculado_at = r.restaurar::timestamptz
FROM _t4r r
WHERE r.tabela = 'atletas' AND r.campo = 'lead_score_calculado_at' AND a.id = r.registro_id
  AND a.lead_score_calculado_at IS NOT DISTINCT FROM r.gravado_pelo_script::timestamptz;  -- CAS

ALTER TABLE public.atletas ENABLE TRIGGER trg_atletas_lead_score;
ALTER TABLE public.atletas ENABLE TRIGGER trg_atletas_updated_at;
ALTER TABLE public.deals   ENABLE TRIGGER trg_deals_updated_at;

-- ─── CONFERÊNCIA (mesma transação) ─────────────────────────────────────
-- Por campo: quantos registros os marcadores alteraram, quantos estão de
-- novo no valor ORIGINAL (o de antes da 1ª alteração) e quantos esta
-- reversão gravou agora. alterados − no_valor_original = edições
-- posteriores preservadas pelo CAS. Se no_valor_original < alterados sem
-- edição conhecida: PARAR e investigar antes de qualquer COMMIT.
SELECT r.tabela, r.campo,
       count(*) AS alterados_pelos_scripts,
       count(*) FILTER (WHERE CASE r.campo
         WHEN 'valor_estimado' THEN d.valor_estimado IS NOT DISTINCT FROM r.restaurar::numeric
         WHEN 'faixa_investimento' THEN a.faixa_investimento IS NOT DISTINCT FROM r.restaurar
         WHEN 'lead_score' THEN a.lead_score IS NOT DISTINCT FROM r.restaurar::int
         WHEN 'lead_score_calculado_at' THEN a.lead_score_calculado_at IS NOT DISTINCT FROM r.restaurar::timestamptz
       END) AS no_valor_original,
       (SELECT count(*)
        FROM public.audit_logs l
        WHERE l.ip_address = 'script:t4-reversao' AND l.created_at = now()
          AND l.tabela = r.tabela AND r.campo = ANY (l.campos_alterados)) AS revertidos_agora
FROM _t4r r
LEFT JOIN public.deals d ON r.tabela = 'deals' AND d.id = r.registro_id
LEFT JOIN public.atletas a ON r.tabela = 'atletas' AND a.id = r.registro_id
GROUP BY r.tabela, r.campo
UNION ALL
SELECT 'triggers religados', tgname, (tgenabled = 'O')::int, NULL, NULL
FROM pg_trigger
WHERE tgname IN ('trg_atletas_lead_score', 'trg_atletas_updated_at', 'trg_deals_updated_at')
ORDER BY 1, 2;

ROLLBACK;   -- ← COMMIT só com decisão explícita
