-- Migration: Add lead attribution and tracking columns
-- Applies to all 3 schemas: public, uat, dev

DO $$
DECLARE
  schema_name TEXT;
BEGIN
  FOR schema_name IN SELECT unnest(ARRAY['public', 'uat', 'dev'])
  LOOP
    EXECUTE format('
      ALTER TABLE %I.form_submissions
        ADD COLUMN IF NOT EXISTS utm_source       text,
        ADD COLUMN IF NOT EXISTS utm_medium       text,
        ADD COLUMN IF NOT EXISTS utm_campaign     text,
        ADD COLUMN IF NOT EXISTS utm_content      text,
        ADD COLUMN IF NOT EXISTS utm_term         text,
        ADD COLUMN IF NOT EXISTS referrer_url     text,
        ADD COLUMN IF NOT EXISTS landing_url      text,
        ADD COLUMN IF NOT EXISTS session_id       text,
        ADD COLUMN IF NOT EXISTS cta_source       text,
        ADD COLUMN IF NOT EXISTS device_type      text,
        ADD COLUMN IF NOT EXISTS form_started_at  timestamptz
    ', schema_name);
  END LOOP;
END;
$$;
