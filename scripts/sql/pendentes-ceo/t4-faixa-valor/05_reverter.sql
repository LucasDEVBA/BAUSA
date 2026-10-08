-- ═══════════════════════════════════════════════════════════════════════
-- T4 — REVERSÃO dos scripts 02/03/04 a partir do audit_logs (marcador em
-- ip_address). Só desfaz linha que AINDA está com o valor que o script
-- gravou (CAS) — edição posterior do CEO é preservada.
-- Uso: escolher o(s) marcador(es) em _t4r_marcadores e rodar. Termina em
-- ROLLBACK; COMMIT só com decisão explícita.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SELECT set_config('audit.ip_address', 'script:t4-reversao', true);

CREATE TEMP TABLE _t4r_marcadores (m text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _t4r_marcadores VALUES
  ('script:t4-backfill');            -- 02
  -- ('script:t4-escala-legada'),    -- 03
  -- ('script:t4-lead-score');       -- 04

ALTER TABLE public.atletas DISABLE TRIGGER trg_atletas_lead_score;
ALTER TABLE public.atletas DISABLE TRIGGER trg_atletas_updated_at;
ALTER TABLE public.deals   DISABLE TRIGGER trg_deals_updated_at;

-- Última alteração do script por registro (se rodou 2x, a 2ª não gravou nada)
CREATE TEMP TABLE _t4r ON COMMIT DROP AS
SELECT DISTINCT ON (l.tabela, l.registro_id)
       l.tabela, l.registro_id, l.dados_anteriores, l.dados_novos
FROM public.audit_logs l
JOIN _t4r_marcadores mk ON mk.m = l.ip_address
WHERE l.operacao = 'UPDATE' AND l.tabela IN ('deals', 'atletas')
ORDER BY l.tabela, l.registro_id, l.created_at DESC;

UPDATE public.deals d
SET valor_estimado = (r.dados_anteriores ->> 'valor_estimado')::numeric
FROM _t4r r
WHERE r.tabela = 'deals' AND d.id = r.registro_id
  AND d.valor_estimado = (r.dados_novos ->> 'valor_estimado')::numeric
  AND d.flag_valores_customizados = false;

UPDATE public.atletas a
SET faixa_investimento = r.dados_anteriores ->> 'faixa_investimento'
FROM _t4r r
WHERE r.tabela = 'atletas' AND a.id = r.registro_id
  AND (r.dados_novos ->> 'faixa_investimento') IS DISTINCT FROM (r.dados_anteriores ->> 'faixa_investimento')
  AND a.faixa_investimento = r.dados_novos ->> 'faixa_investimento';

UPDATE public.atletas a
SET lead_score = (r.dados_anteriores ->> 'lead_score')::int
FROM _t4r r
WHERE r.tabela = 'atletas' AND a.id = r.registro_id
  AND (r.dados_novos ->> 'lead_score') IS DISTINCT FROM (r.dados_anteriores ->> 'lead_score')
  AND a.lead_score = (r.dados_novos ->> 'lead_score')::int;

ALTER TABLE public.atletas ENABLE TRIGGER trg_atletas_lead_score;
ALTER TABLE public.atletas ENABLE TRIGGER trg_atletas_updated_at;
ALTER TABLE public.deals   ENABLE TRIGGER trg_deals_updated_at;

SELECT r.tabela, count(*) AS registros_no_audit,
       count(*) FILTER (WHERE r.tabela = 'deals'
         AND d.valor_estimado = (r.dados_anteriores ->> 'valor_estimado')::numeric) AS deals_revertidos,
       count(*) FILTER (WHERE r.tabela = 'atletas'
         AND a.faixa_investimento = r.dados_anteriores ->> 'faixa_investimento') AS faixas_revertidas
FROM _t4r r
LEFT JOIN public.deals d ON r.tabela = 'deals' AND d.id = r.registro_id
LEFT JOIN public.atletas a ON r.tabela = 'atletas' AND a.id = r.registro_id
GROUP BY r.tabela;

ROLLBACK;   -- ← COMMIT só com decisão explícita
