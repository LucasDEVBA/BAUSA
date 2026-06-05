-- ════════════════════════════════════════════════════════════════════════
-- Correção: GRANTs de tabela + policy de escrita da fila de envios
--           para campanhas de re-marketing.
-- ════════════════════════════════════════════════════════════════════════
-- A migration 20260605115850 criou as tabelas remarketing_* com RLS, porém
-- duas lacunas impediam a feature de funcionar de ponta a ponta:
--
--   (1) GRANTs ausentes em uat/dev — o schema `public` herda privilégios via
--       default privileges do Supabase, mas schemas custom (uat/dev) exigem
--       GRANT explícito. Sem ele, a REST/PostgREST retornava
--       42501 "permission denied for table remarketing_campanhas".
--
--   (2) remarketing_envios só possuía policy SELECT(authenticated) + ALL(service_role).
--       prepararCampanha() (apps/crm) insere a fila de envios usando o cliente
--       audited, que roda como o CEO AUTENTICADO (publishable key + sessão) —
--       não como service_role. Logo o INSERT era bloqueado por RLS em TODOS os
--       schemas (inclusive public/PRD). Sem a policy de CEO, criar campanha falha.
--
-- Idempotente: GRANT é cumulativo; a policy usa DROP IF EXISTS + CREATE.
-- Seguro re-rodar. Aplica em public, uat e dev (banco único, schema por ambiente).
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE s TEXT;
BEGIN
  FOR s IN SELECT unnest(ARRAY['public', 'uat', 'dev']) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = s) THEN
      EXECUTE format($f$
        -- Acesso ao schema
        GRANT USAGE ON SCHEMA %1$I TO authenticated, service_role;

        -- Privilégios de tabela (RLS continua sendo a camada de autorização real)
        GRANT SELECT, INSERT, UPDATE, DELETE
          ON %1$I.remarketing_campanhas, %1$I.remarketing_envios, %1$I.remarketing_optout
          TO authenticated;
        GRANT ALL
          ON %1$I.remarketing_campanhas, %1$I.remarketing_envios, %1$I.remarketing_optout
          TO service_role;

        -- CEO autenticado pode gerenciar a fila de envios (prepararCampanha cria os envios).
        -- A policy SELECT(authenticated)=true e ALL(service_role) já existentes permanecem
        -- (policies permissivas são combinadas via OR).
        DROP POLICY IF EXISTS "remktg_env_ceo" ON %1$I.remarketing_envios;
        CREATE POLICY "remktg_env_ceo" ON %1$I.remarketing_envios FOR ALL TO authenticated
          USING (public.get_user_papel() = 'ceo')
          WITH CHECK (public.get_user_papel() = 'ceo');
      $f$, s);
    END IF;
  END LOOP;
END $$;
