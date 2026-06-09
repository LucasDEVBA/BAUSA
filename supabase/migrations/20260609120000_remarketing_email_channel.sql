-- ════════════════════════════════════════════════════════════════════════
-- Re-marketing — canal de E-MAIL (além de WhatsApp)
-- ════════════════════════════════════════════════════════════════════════
-- Aditiva e idempotente. Não muda campanhas existentes (canal default
-- 'whatsapp'). Aplica em public/uat/dev (banco único, schema por ambiente).
--
--   remarketing_campanhas: + canal ('whatsapp'|'email') + assunto (subject)
--   remarketing_envios:    + email (nullable) ; telefone passa a NULLABLE
--                          (campanha de e-mail não tem telefone)
--   remarketing_optout_email: opt-out por e-mail (LGPD), separado do opt-out
--                          por telefone. GRANTs explícitos (schemas custom não
--                          herdam default privileges — lição do incidente 06-05).
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE s TEXT;
BEGIN
  FOR s IN SELECT unnest(ARRAY['public', 'uat', 'dev']) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = s) THEN
      EXECUTE format($f$
        -- Campanhas: canal + assunto
        ALTER TABLE %1$I.remarketing_campanhas
          ADD COLUMN IF NOT EXISTS canal   TEXT NOT NULL DEFAULT 'whatsapp',
          ADD COLUMN IF NOT EXISTS assunto TEXT;
        ALTER TABLE %1$I.remarketing_campanhas DROP CONSTRAINT IF EXISTS chk_remktg_canal;
        ALTER TABLE %1$I.remarketing_campanhas ADD CONSTRAINT chk_remktg_canal
          CHECK (canal IN ('whatsapp', 'email'));

        -- Envios: email + telefone nullable (campanha de e-mail não usa telefone)
        ALTER TABLE %1$I.remarketing_envios ADD COLUMN IF NOT EXISTS email TEXT;
        ALTER TABLE %1$I.remarketing_envios ALTER COLUMN telefone DROP NOT NULL;

        -- Opt-out por e-mail (LGPD), separado do opt-out por telefone
        CREATE TABLE IF NOT EXISTS %1$I.remarketing_optout_email (
          email      TEXT PRIMARY KEY,
          atleta_id  UUID,
          motivo     TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        ALTER TABLE %1$I.remarketing_optout_email ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "remktg_optemail_service" ON %1$I.remarketing_optout_email;
        CREATE POLICY "remktg_optemail_service" ON %1$I.remarketing_optout_email
          FOR ALL TO service_role USING (true) WITH CHECK (true);
        DROP POLICY IF EXISTS "remktg_optemail_select" ON %1$I.remarketing_optout_email;
        CREATE POLICY "remktg_optemail_select" ON %1$I.remarketing_optout_email
          FOR SELECT TO authenticated USING (true);
        DROP POLICY IF EXISTS "remktg_optemail_ceo" ON %1$I.remarketing_optout_email;
        CREATE POLICY "remktg_optemail_ceo" ON %1$I.remarketing_optout_email
          FOR ALL TO authenticated
          USING (public.get_user_papel() = 'ceo') WITH CHECK (public.get_user_papel() = 'ceo');

        GRANT SELECT, INSERT, UPDATE, DELETE ON %1$I.remarketing_optout_email TO authenticated;
        GRANT ALL ON %1$I.remarketing_optout_email TO service_role;
      $f$, s);
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN public.remarketing_campanhas.canal IS 'whatsapp (Z-API) | email (Resend/Brevo). Default whatsapp.';
COMMENT ON COLUMN public.remarketing_campanhas.assunto IS 'Assunto do e-mail (só canal=email).';
COMMENT ON TABLE public.remarketing_optout_email IS 'Opt-out por e-mail (LGPD). A CF send-remarketing respeita antes de enviar; alimentado pela CF pública remarketing-unsubscribe.';
