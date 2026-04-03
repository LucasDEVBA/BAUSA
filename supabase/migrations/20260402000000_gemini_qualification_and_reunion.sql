-- Migration: Gemini qualification columns + reunion fields + data population
-- Date: 2026-04-02
-- Description:
--   1. Add Gemini qualification columns to atletas
--   2. Add reunion fields to deals
--   3. Populate Gemini fields from form_submissions
--   4. Fix atletas data (nivel_ingles, lead_classificacao) from form_submissions
--   5. Populate reunion data in deals from form_submissions
--   6. Create indexes

BEGIN;

-- ============================================================
-- STEP 1: Add Gemini qualification columns to atletas
-- ============================================================

ALTER TABLE atletas ADD COLUMN IF NOT EXISTS qualificado_gemini BOOLEAN DEFAULT false;
ALTER TABLE atletas ADD COLUMN IF NOT EXISTS classificacao_gemini TEXT;
ALTER TABLE atletas ADD COLUMN IF NOT EXISTS motivo_gemini TEXT;
ALTER TABLE atletas ADD COLUMN IF NOT EXISTS confianca_gemini TEXT;
ALTER TABLE atletas ADD COLUMN IF NOT EXISTS qualificado_gemini_at TIMESTAMPTZ;

-- ============================================================
-- STEP 2: Add reunion fields to deals
-- ============================================================

ALTER TABLE deals ADD COLUMN IF NOT EXISTS reuniao_agendada_at TIMESTAMPTZ;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS reuniao_link TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS reuniao_data TIMESTAMPTZ;

-- ============================================================
-- STEP 3: Populate Gemini fields from form_submissions
-- ============================================================

-- Disable audit trigger to avoid noise
ALTER TABLE atletas DISABLE TRIGGER trg_audit_atletas;

UPDATE atletas a
SET
  qualificado_gemini = CASE
    WHEN fs.qualification_classification IN ('QUENTE', 'MORNO') THEN true
    ELSE false
  END,
  classificacao_gemini = fs.qualification_classification,
  motivo_gemini = fs.qualification_reason,
  confianca_gemini = fs.qualification_confidence,
  qualificado_gemini_at = fs.qualified_at
FROM form_submissions fs
WHERE a.form_submission_id = fs.id
  AND a.deleted_at IS NULL;

ALTER TABLE atletas ENABLE TRIGGER trg_audit_atletas;

-- ============================================================
-- STEP 4: Fix atletas data from form_submissions
-- ============================================================

-- Disable lead score trigger to avoid recalculation during bulk update
ALTER TABLE atletas DISABLE TRIGGER trg_atletas_lead_score;

UPDATE atletas a
SET
  nivel_ingles = CASE
    WHEN lower(COALESCE(fs.english_level, '')) SIMILAR TO '%(flu|native)%' THEN 'fluente'::nivel_ingles
    WHEN lower(COALESCE(fs.english_level, '')) SIMILAR TO '%(avanç|advan|upper)%' THEN 'avancado'::nivel_ingles
    WHEN lower(COALESCE(fs.english_level, '')) SIMILAR TO '%(interm|inter)%' THEN 'intermediario'::nivel_ingles
    WHEN lower(COALESCE(fs.english_level, '')) SIMILAR TO '%(bás|basic|beginn)%' THEN 'basico'::nivel_ingles
    WHEN lower(COALESCE(fs.english_level, '')) SIMILAR TO '%(nenh|none|no )%' THEN 'nenhum'::nivel_ingles
    ELSE a.nivel_ingles
  END,
  lead_classificacao = CASE
    WHEN fs.qualification_classification = 'QUENTE' THEN 'hot'::classificacao_lead
    WHEN fs.qualification_classification = 'MORNO' THEN 'warm'::classificacao_lead
    ELSE a.lead_classificacao
  END
FROM form_submissions fs
WHERE a.form_submission_id = fs.id
  AND a.deleted_at IS NULL;

-- Re-enable lead score trigger
ALTER TABLE atletas ENABLE TRIGGER trg_atletas_lead_score;

-- ============================================================
-- STEP 5: Populate reunion data in deals from form_submissions
-- ============================================================

UPDATE deals d
SET
  reuniao_agendada_at = fs.meeting_scheduled_at,
  reuniao_data = fs.meeting_scheduled_at
FROM atletas a
JOIN form_submissions fs ON fs.id = a.form_submission_id
WHERE d.atleta_id = a.id
  AND fs.meeting_scheduled = true
  AND d.deleted_at IS NULL;

-- ============================================================
-- STEP 6: Create indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_atletas_qualificado_gemini
  ON atletas(qualificado_gemini) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_deals_reuniao_data
  ON deals(reuniao_data) WHERE reuniao_data IS NOT NULL;

-- ============================================================
-- STEP 7: Summary
-- ============================================================

DO $$
DECLARE
  v_gemini INT;
  v_hot INT;
  v_warm INT;
  v_reuniao INT;
BEGIN
  SELECT count(*) INTO v_gemini FROM atletas WHERE qualificado_gemini = true AND deleted_at IS NULL;
  SELECT count(*) INTO v_hot FROM atletas WHERE classificacao_gemini = 'QUENTE' AND deleted_at IS NULL;
  SELECT count(*) INTO v_warm FROM atletas WHERE classificacao_gemini = 'MORNO' AND deleted_at IS NULL;
  SELECT count(*) INTO v_reuniao FROM deals WHERE reuniao_agendada_at IS NOT NULL AND deleted_at IS NULL;
  RAISE NOTICE 'Qualificados Gemini: % (% QUENTE, % MORNO)', v_gemini, v_hot, v_warm;
  RAISE NOTICE 'Deals com reuniao: %', v_reuniao;
END $$;

COMMIT;
