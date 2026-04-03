-- ============================================================
-- Migration: Auto-promote existing QUENTE/MORNO leads to CRM
-- Date: 2026-04-01
-- ============================================================

-- Disable audit triggers
ALTER TABLE responsaveis DISABLE TRIGGER trg_audit_responsaveis;
ALTER TABLE atletas DISABLE TRIGGER trg_audit_atletas;
ALTER TABLE deals DISABLE TRIGGER trg_audit_deals;

-- Temporarily allow NULL responsavel_id on deals (no CEO user_profile yet)
ALTER TABLE deals ALTER COLUMN responsavel_id DROP NOT NULL;

-- ============================================================
-- STEP 1: Create responsáveis (dedup by normalized whatsapp)
-- ============================================================
INSERT INTO responsaveis (nome, email, whatsapp, profissao, parentesco, consentimento_lgpd, aceite_whatsapp)
SELECT DISTINCT ON (regexp_replace(fs.guardian_whatsapp, '[^+0-9]', '', 'g'))
  COALESCE(NULLIF(fs.guardian_name, ''), 'Responsavel'),
  fs.guardian_email,
  regexp_replace(fs.guardian_whatsapp, '[^+0-9]', '', 'g'),
  fs.guardian_profession,
  'outro',
  true,
  true
FROM form_submissions fs
WHERE fs.qualification_classification IN ('QUENTE', 'MORNO')
  AND fs.guardian_whatsapp IS NOT NULL
  AND regexp_replace(fs.guardian_whatsapp, '[^+0-9]', '', 'g') != ''
  AND NOT EXISTS (
    SELECT 1 FROM responsaveis r
    WHERE r.whatsapp = regexp_replace(fs.guardian_whatsapp, '[^+0-9]', '', 'g')
      AND r.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM atletas a WHERE a.form_submission_id = fs.id
  )
ORDER BY regexp_replace(fs.guardian_whatsapp, '[^+0-9]', '', 'g'), fs.submitted_at ASC;

-- ============================================================
-- STEP 2: Create atletas
-- ============================================================
INSERT INTO atletas (
  nome_completo, data_nascimento, whatsapp, email, instagram,
  esporte, posicao, nivel_competitivo, historico_clubes, conquistas, video_highlights_url,
  serie_escolar, nivel_ingles, desempenho_academico, escola_atual, cidade_estado,
  momento_inicio, comprometimento, decisao_familiar,
  faixa_investimento, safra,
  lead_score, lead_classificacao,
  responsavel_id, form_submission_id, origem, consentimento_lgpd
)
SELECT
  fs.athlete_name,
  COALESCE(
    CASE WHEN fs.birth_date ~ '^\d{4}-\d{2}-\d{2}' THEN fs.birth_date::date ELSE NULL END,
    '2008-01-01'::date
  ),
  COALESCE(NULLIF(regexp_replace(fs.guardian_whatsapp, '[^+0-9]', '', 'g'), ''), 'sem-whatsapp'),
  fs.email,
  fs.instagram,
  COALESCE(NULLIF(CASE WHEN fs.position IS NOT NULL AND fs.position != '' THEN 'Futebol' ELSE NULL END, ''), 'A definir'),
  fs.position,
  'escolar'::nivel_competitivo,
  fs.club_history,
  fs.achievements,
  fs.video_link,
  COALESCE(
    CASE
      WHEN lower(COALESCE(fs.school_year, '')) SIMILAR TO '%(1.%ano|9th|9º|1º)%' THEN '9th'
      WHEN lower(COALESCE(fs.school_year, '')) SIMILAR TO '%(2.%ano|10th|10º|2º)%' THEN '10th'
      WHEN lower(COALESCE(fs.school_year, '')) SIMILAR TO '%(3.%ano|11th|11º|3º)%' THEN '11th'
      WHEN lower(COALESCE(fs.school_year, '')) LIKE '%12%' THEN '12th'
      ELSE NULL
    END,
    '10th'
  ),
  'basico'::nivel_ingles,
  'regular'::desempenho_academico,
  fs.current_school,
  COALESCE(NULLIF(fs.city_state, ''), 'Nao informado'),
  'proximo_ano',
  'medio'::comprometimento_atleta,
  'em_discussao'::decisao_familiar,
  CASE
    WHEN fs.investment_range IN ('over-70k', '50k-70k', '40k-50k') THEN '40k_mais'
    WHEN fs.investment_range = '30k-40k' THEN '30k_40k'
    WHEN fs.investment_range = '20k-30k' THEN '20k_30k'
    ELSE 'ate_20k'
  END,
  'fall_2026',
  0,
  CASE
    WHEN fs.qualification_classification = 'QUENTE' THEN 'hot'::classificacao_lead
    ELSE 'warm'::classificacao_lead
  END,
  (
    SELECT r.id FROM responsaveis r
    WHERE r.whatsapp = regexp_replace(fs.guardian_whatsapp, '[^+0-9]', '', 'g')
      AND r.deleted_at IS NULL
    ORDER BY r.created_at DESC LIMIT 1
  ),
  fs.id,
  'formulario_web'::origem_lead,
  true
FROM form_submissions fs
WHERE fs.qualification_classification IN ('QUENTE', 'MORNO')
  AND NOT EXISTS (SELECT 1 FROM atletas a WHERE a.form_submission_id = fs.id)
  AND EXISTS (
    SELECT 1 FROM responsaveis r
    WHERE r.whatsapp = regexp_replace(fs.guardian_whatsapp, '[^+0-9]', '', 'g')
      AND r.deleted_at IS NULL
  );

-- ============================================================
-- STEP 3: Create deals (responsavel_id = NULL until CEO profile is created)
-- ============================================================
INSERT INTO deals (
  atleta_id, etapa, etapa_anterior,
  valor_estimado, probabilidade_fechamento,
  status_decisao_familia, safra,
  next_action, data_proxima_acao
)
SELECT
  a.id,
  CASE WHEN fs.meeting_scheduled = true THEN 'reuniao_marcada'::status_deal ELSE 'lead'::status_deal END,
  CASE WHEN fs.meeting_scheduled = true THEN 'lead'::status_deal ELSE NULL END,
  CASE
    WHEN fs.investment_range IN ('over-70k', '50k-70k') THEN 32000
    WHEN fs.investment_range IN ('40k-50k', '30k-40k') THEN 26000
    WHEN fs.investment_range = '20k-30k' THEN 23000
    ELSE 18000
  END,
  CASE WHEN fs.meeting_scheduled = true THEN 20 ELSE 10 END,
  'em_discussao'::decisao_familiar,
  'fall_2026',
  CASE WHEN fs.meeting_scheduled = true THEN 'Preparar para reuniao' ELSE 'Aguardar agendamento' END,
  (CURRENT_DATE + INTERVAL '7 days')::date
FROM atletas a
JOIN form_submissions fs ON fs.id = a.form_submission_id
WHERE NOT EXISTS (SELECT 1 FROM deals d WHERE d.atleta_id = a.id AND d.deleted_at IS NULL);

-- Re-enable triggers
ALTER TABLE responsaveis ENABLE TRIGGER trg_audit_responsaveis;
ALTER TABLE atletas ENABLE TRIGGER trg_audit_atletas;
ALTER TABLE deals ENABLE TRIGGER trg_audit_deals;

-- Summary
DO $$
DECLARE v_resp INT; v_atletas INT; v_deals INT; v_reuniao INT;
BEGIN
  SELECT count(*) INTO v_resp FROM responsaveis WHERE created_at >= NOW() - INTERVAL '5 minutes';
  SELECT count(*) INTO v_atletas FROM atletas WHERE created_at >= NOW() - INTERVAL '5 minutes';
  SELECT count(*) INTO v_deals FROM deals WHERE created_at >= NOW() - INTERVAL '5 minutes';
  SELECT count(*) INTO v_reuniao FROM deals WHERE created_at >= NOW() - INTERVAL '5 minutes' AND etapa = 'reuniao_marcada';
  RAISE NOTICE '=== PROMOCAO EM MASSA ===';
  RAISE NOTICE 'Responsaveis: %', v_resp;
  RAISE NOTICE 'Atletas: %', v_atletas;
  RAISE NOTICE 'Deals: % (% em reuniao_marcada)', v_deals, v_reuniao;
END $$;
