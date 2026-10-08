-- ════════════════════════════════════════════════════════════════════════
-- SCRIPT DE DADOS (NÃO é migration) — T23: datas de nascimento ruins
-- Destino no repo: scripts/dados/2026-10-08-t23-datas-nascimento.sql
-- Parte A = relatório SOMENTE LEITURA (roda a qualquer momento).
-- Parte B = correção de UM lead — ⛔ só com a data REAL confirmada pela
--   família/CEO (pergunta 3b: Samuel) e autorização explícita.
-- Com o T23 em PRD o classificador já NÃO invalida por idade (vira alerta),
-- então não há urgência técnica: a correção é para o dossiê ficar certo.
-- A mesma regra do formulário/banco: série → faixa de idade (com folga 0
-- aqui = regra do front). Não expõe nome/e-mail/telefone no resultado.
-- ════════════════════════════════════════════════════════════════════════

-- ─── A) RELATÓRIO (leitura) ─────────────────────────────────────────────
-- Requer a migration 20261008180300 (PR 2) (funções fs_*). Antes dela, use o CASE
-- da função fs_faixa_idade_serie inline.
SELECT
  public.fs_motivo_nascimento_invalido(fs.birth_date, fs.school_year, fs.submitted_at::date) AS motivo,
  count(*)                                                        AS leads,
  count(*) FILTER (WHERE fs.submitted_at >= now() - interval '30 days') AS ultimos_30d,
  count(*) FILTER (WHERE fs.qualification_classification IN ('QUENTE','MORNO')) AS quente_morno
FROM public.form_submissions fs
WHERE fs.deleted_at IS NULL
GROUP BY 1
ORDER BY 2 DESC;

-- Lista para revisão (só id + série + ano de nascimento + classe):
SELECT fs.id, fs.school_year, left(fs.birth_date, 4) AS ano_nasc,
       public.fs_motivo_nascimento_invalido(fs.birth_date, fs.school_year, fs.submitted_at::date) AS motivo,
       fs.qualification_classification AS classe, fs.aprovacao_status,
       to_char(fs.submitted_at, 'YYYY-MM-DD') AS enviado
FROM public.form_submissions fs
WHERE fs.deleted_at IS NULL
  AND public.fs_motivo_nascimento_invalido(fs.birth_date, fs.school_year, fs.submitted_at::date) IS NOT NULL
ORDER BY fs.submitted_at DESC;

-- ─── B) CORREÇÃO DE UM LEAD (CAS no valor atual) ────────────────────────
-- Preencha os 3 parâmetros. data_atual = o valor que está HOJE no banco
-- (CAS: se alguém já corrigiu, o UPDATE não pega nada).
BEGIN;
SET LOCAL lock_timeout = '5s';

WITH p AS (
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS lead_id,   -- ← id do form_submission
         'AAAA-MM-DD'::text                         AS data_correta, -- ← data REAL do atleta
         'AAAA-MM-DD'::text                         AS data_atual    -- ← valor atual (CAS)
), fs_upd AS (
  UPDATE public.form_submissions fs
  SET birth_date = p.data_correta,
      age        = date_part('year', age(fs.submitted_at::date, p.data_correta::date))::int,
      updated_at = now()
  FROM p
  WHERE fs.id = p.lead_id
    AND fs.deleted_at IS NULL
    AND fs.birth_date IS NOT DISTINCT FROM p.data_atual
    AND p.data_correta ~ '^\d{4}-\d{2}-\d{2}$'
  RETURNING fs.id
), at_upd AS (
  UPDATE public.atletas a
  SET data_nascimento = p.data_correta::date
  FROM p
  WHERE a.form_submission_id = p.lead_id
    AND a.deleted_at IS NULL
    AND a.data_nascimento IS DISTINCT FROM p.data_correta::date
    AND EXISTS (SELECT 1 FROM fs_upd)
  RETURNING a.id
)
SELECT (SELECT count(*) FROM fs_upd) AS form_submissions_atualizados,
       (SELECT count(*) FROM at_upd) AS atletas_atualizados;
-- Esperado: 1 e (0 ou 1 — 0 quando o lead ainda não tem atleta, ex.: Samuel pendente).
-- Diferente disso → ROLLBACK;
COMMIT;

-- Conferência: o motivo do lead corrigido deve ser NULL.
-- SELECT public.fs_motivo_nascimento_invalido(birth_date, school_year, submitted_at::date)
-- FROM public.form_submissions WHERE id = '<lead_id>';
-- Opcional: requalificar o lead (retry-qualification com {"lead_id": "<id>"}) —
-- decisão humana (aprovado/reprovado) nunca é sobrescrita.
