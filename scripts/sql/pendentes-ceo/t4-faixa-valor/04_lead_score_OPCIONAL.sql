-- ═══════════════════════════════════════════════════════════════════════
-- T4 — OPCIONAL (decisão do CEO): recalcular atletas.lead_score com a
-- faixa CORRIGIDA. Rodar SÓ depois do 02 commitado.
--
-- Achado (2026-10-08): lead_score é 0 em 100% dos atletas vivos. O trigger
-- trg_atletas_lead_score chama calcular_lead_score(NEW.id), que relê a
-- linha da TABELA — no INSERT ela ainda não existe (score 0) e no UPDATE
-- ela ainda é a ANTIGA (score da faixa velha). Consequência: o segmento de
-- remarketing "alto_score_sem_followup" (score ≥ 75) está sempre vazio.
--
-- Este script recalcula SÓ lead_score/lead_score_calculado_at, numa 2ª
-- passada (a função então lê a faixa já corrigida). lead_classificacao NÃO
-- é tocada: hoje ela foi sobrescrita para 'cold' em ~377 atletas QUENTE/
-- MORNO pelo mesmo trigger, e o /pipeline usa esse campo como classe do
-- deal — reclassificar por score mudaria filtros/badges de centenas de
-- deals. Corrigir a FONTE da classe no pipeline é tarefa à parte.
--
-- Efeito colateral a apresentar ao CEO: o segmento "alto_score_sem_followup"
-- passa a ter leads (só afeta disparos que o próprio CEO iniciar).
-- Reversão: 05_reverter.sql com o marcador deste script. Para desfazer o 02
-- depois deste, reverter os DOIS juntos (o 05 bloqueia reverter só o 02).
-- Termina em ROLLBACK.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL lock_timeout = '5s';
SELECT set_config('audit.ip_address', 'script:t4-lead-score', true);

-- Desliga o trigger (ele recalcularia de novo, lendo a linha antiga) e o
-- updated_at (recalcular não é atividade do lead).
ALTER TABLE public.atletas DISABLE TRIGGER trg_atletas_lead_score;
ALTER TABLE public.atletas DISABLE TRIGGER trg_atletas_updated_at;

CREATE TEMP TABLE _t4s ON COMMIT DROP AS
SELECT a.id, a.lead_score AS score_antes, public.calcular_lead_score(a.id) AS score_depois
FROM public.atletas a
WHERE a.deleted_at IS NULL;

UPDATE public.atletas a
SET lead_score = t.score_depois,
    lead_score_calculado_at = now()
FROM _t4s t
WHERE a.id = t.id
  AND a.lead_score IS DISTINCT FROM t.score_depois;

ALTER TABLE public.atletas ENABLE TRIGGER trg_atletas_lead_score;
ALTER TABLE public.atletas ENABLE TRIGGER trg_atletas_updated_at;

-- CONFERÊNCIA: distribuição antes × depois (faixas de 10) + segmento ≥ 75
SELECT 'score ' || lpad((width_bucket(score_depois, 0, 101, 10) - 1)::text, 1) || '0s' AS faixa_score,
       count(*) FILTER (WHERE score_antes = 0) AS vinham_de_zero,
       count(*) AS atletas
FROM _t4s GROUP BY 1
UNION ALL
SELECT 'segmento alto_score (>=75)', count(*) FILTER (WHERE score_antes >= 75), count(*) FILTER (WHERE score_depois >= 75)
FROM _t4s
ORDER BY 1;

ROLLBACK;   -- ← COMMIT só com autorização do CEO
