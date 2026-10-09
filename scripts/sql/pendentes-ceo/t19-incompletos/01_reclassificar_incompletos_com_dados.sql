-- ════════════════════════════════════════════════════════════════════════
-- SCRIPT DE DADOS (NÃO é migration) — T19: INCOMPLETO com dados → FRIO
-- Arquivo: scripts/sql/pendentes-ceo/t19-incompletos/ (termina em ROLLBACK — PLANO §5).
-- ⛔ SÓ RODAR COM AUTORIZAÇÃO EXPLÍCITA DO CEO (pergunta 4b dos vídeos 28/09).
-- ⛔ PRÉ-REQUISITO: a CF qualify-lead com o gate determinístico do T19 já
--    está em PRD (senão um retry/requalify recria INCOMPLETO com dados).
-- Banco único: rodar em public (PRD). uat/dev não têm leads reais.
--
-- O que faz: leads com qualification_classification='INCOMPLETO' que TÊM
--   profissão (responsável 1 ou 2, ≥2 letras) E faixa de investimento válida
--   passam a FRIO — mesma regra do gate de código (aplicarGateCompletude).
--   Hoje (08/10): 85 linhas — 41 na janela de 90 dias (coluna Incompletos) e
--   44 mais antigas (13 delas com deal 'perdido' do mutirão 24/08).
-- O que NÃO faz: não toca em decisão humana (aprovacao_status precisa ser
--   NULL — CAS), não cria deal, não envia mensagem (FRIO e INCOMPLETO estão
--   ambos fora de fila/outreach: schedulers filtram IN (QUENTE,MORNO)),
--   não muda score (todos 0), qualified_at (cursor do requalify) nem o motivo.
-- Efeito visível: os 41 recentes saem da coluna "Incompletos — revisão" e
--   entram em "Frios — revisão" (por isso o T7, que corrige o corte de 80 da
--   coluna Frios, deve estar em PRD antes).
-- Idempotente: rodar 2x → a 2ª atualiza 0 linhas.
-- session_replication_role=replica (SET LOCAL, só nesta transação): suprime o
--   webhook sync_to_google_sheets (85 POSTs em rajada estourariam a cota do
--   Sheets — e a planilha não tem coluna de classe; A/B não mudam) e o
--   trigger de updated_at (setado à mão abaixo). Se o SET falhar por
--   permissão, remova a linha e rode em lotes de 20 (LIMIT no CTE alvo).
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1) PRÉVIA (somente leitura) ────────────────────────────────────────
WITH alvo AS (
  SELECT fs.id, fs.submitted_at, fs.score_financeiro, fs.investment_range,
         fs.qualification_reason,
         EXISTS (
           SELECT 1 FROM public.atletas a
           JOIN public.deals d ON d.atleta_id = a.id AND d.deleted_at IS NULL
           WHERE a.form_submission_id = fs.id AND a.deleted_at IS NULL
         ) AS tem_deal_ativo
  FROM public.form_submissions fs
  WHERE fs.deleted_at IS NULL
    AND fs.qualification_classification = 'INCOMPLETO'
    AND fs.aprovacao_status IS NULL
    AND (coalesce(fs.guardian_profession, '')   ~ '[[:alpha:]]{2}'
      OR coalesce(fs.guardian_profession_2, '') ~ '[[:alpha:]]{2}')
    AND fs.investment_range IN ('15k-20k','20k-30k','30k-40k','40k-50k','50k-70k','over-70k')
)
SELECT
  count(*)                                                        AS total_alvo,
  count(*) FILTER (WHERE submitted_at >= now() - interval '90 days') AS na_janela_90d,
  count(*) FILTER (WHERE tem_deal_ativo)                          AS com_deal_ativo,
  count(*) FILTER (WHERE qualification_reason ILIKE '%piso%')     AS motivo_piso,
  min(score_financeiro) AS score_min, max(score_financeiro) AS score_max,
  string_agg(DISTINCT investment_range, ',')                      AS faixas
FROM alvo;
-- Esperado em 08/10: total_alvo=85, na_janela_90d=41, com_deal_ativo=13,
-- score 0..0, faixas=15k-20k.  Se divergir muito, PARE e reavalie.

-- Quem NÃO entra (INCOMPLETO de verdade — deve continuar INCOMPLETO):
SELECT count(*) AS incompletos_legitimos
FROM public.form_submissions fs
WHERE fs.deleted_at IS NULL
  AND fs.qualification_classification = 'INCOMPLETO'
  AND NOT (
        (coalesce(fs.guardian_profession, '')   ~ '[[:alpha:]]{2}'
      OR coalesce(fs.guardian_profession_2, '') ~ '[[:alpha:]]{2}')
    AND fs.investment_range IN ('15k-20k','20k-30k','30k-40k','40k-50k','50k-70k','over-70k')
  );

-- ─── 2) EXECUÇÃO (CAS) — conferir o "UPDATE n" antes do COMMIT ──────────
BEGIN;
SET LOCAL session_replication_role = replica;
SET LOCAL lock_timeout = '5s';

UPDATE public.form_submissions fs
SET qualification_classification = 'FRIO',
    qualified        = false,
    acao_recomendada = 'nutricao',
    sinais_alerta    = coalesce(fs.sinais_alerta, '[]'::jsonb)
                       || jsonb_build_array(
                            'reclassificado INCOMPLETO→FRIO (T19, out/2026): profissão e faixa presentes — script autorizado pelo CEO'),
    updated_at       = now()
WHERE fs.deleted_at IS NULL
  AND fs.qualification_classification = 'INCOMPLETO'      -- CAS: só quem ainda é INCOMPLETO
  AND fs.aprovacao_status IS NULL                          -- CAS: nunca toca decisão humana
  AND (coalesce(fs.guardian_profession, '')   ~ '[[:alpha:]]{2}'
    OR coalesce(fs.guardian_profession_2, '') ~ '[[:alpha:]]{2}')
  AND fs.investment_range IN ('15k-20k','20k-30k','30k-40k','40k-50k','50k-70k','over-70k')
  -- Variante "só os 41 da coluna" (se o CEO autorizar só a janela visível):
  -- AND fs.submitted_at >= now() - interval '90 days'
;
-- Esperado: UPDATE 85 (ou 41 na variante). Diferente disso → ROLLBACK;

-- ─── 3) CONFERÊNCIA ─────────────────────────────────────────────────────
-- (a) zero INCOMPLETO com dados completos e sem decisão humana
SELECT count(*) AS deve_ser_zero
FROM public.form_submissions fs
WHERE fs.deleted_at IS NULL
  AND fs.qualification_classification = 'INCOMPLETO'
  AND fs.aprovacao_status IS NULL
  AND (coalesce(fs.guardian_profession, '')   ~ '[[:alpha:]]{2}'
    OR coalesce(fs.guardian_profession_2, '') ~ '[[:alpha:]]{2}')
  AND fs.investment_range IN ('15k-20k','20k-30k','30k-40k','40k-50k','50k-70k','over-70k');

-- (b) quantos foram marcados por este script
SELECT count(*) AS reclassificados
FROM public.form_submissions
WHERE deleted_at IS NULL
  AND qualification_classification = 'FRIO'
  AND sinais_alerta @> '["reclassificado INCOMPLETO→FRIO (T19, out/2026): profissão e faixa presentes — script autorizado pelo CEO"]'::jsonb;

-- (c) nenhum reclassificado entrou em fila/outreach (classe FRIO + qualified=false)
SELECT count(*) AS deve_ser_zero_qualificado
FROM public.form_submissions
WHERE sinais_alerta @> '["reclassificado INCOMPLETO→FRIO (T19, out/2026): profissão e faixa presentes — script autorizado pelo CEO"]'::jsonb
  AND (qualified IS TRUE OR aprovacao_status IS NOT NULL);

-- ─── FIM — padrão PLANO.md §5 ────────────────────────────────────────────
-- A conferência acima roda DENTRO da transação aberta no passo de execução.
-- Este arquivo termina em ROLLBACK de propósito: rodar inteiro NÃO persiste.
-- Trocar por COMMIT somente com a autorização explícita do CEO (pergunta 4b),
-- depois de conferir o "UPDATE n" e a conferência.
ROLLBACK;
