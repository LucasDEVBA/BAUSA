-- Migration: add utm_id to form_submissions (chave estável de campanha Meta)
-- Aplica em public, uat, dev. Aditiva e idempotente.
--
-- utm_id = {{campaign.id}} no Meta Ads. Diferente de utm_campaign (= nome, que
-- muda ao renomear a campanha e quebra o agrupamento), o id numérico é estável
-- e serve de chave de join confiável para CAC/ROI por campanha (Fase 2A).

DO $$
DECLARE
  schema_name TEXT;
BEGIN
  FOR schema_name IN SELECT unnest(ARRAY['public', 'uat', 'dev'])
  LOOP
    EXECUTE format('
      ALTER TABLE %I.form_submissions
        ADD COLUMN IF NOT EXISTS utm_id text
    ', schema_name);
  END LOOP;
END;
$$;
