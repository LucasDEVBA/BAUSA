-- ════════════════════════════════════════════════════════════════════════
-- Migration: GRANTs uat/dev — tabelas Meta CAC + default privileges
-- Aplica em: uat, dev (public INTOCADO — lá a Supabase concede sozinha)
-- Contexto: incidente 2026-08-10 — sync-meta-spend-uat falhou com 42501
--   ("permission denied for table investimentos_marketing").
--   Em schemas custom, tabela nova NÃO herda privilégios como no public:
--   RLS policy sem GRANT de tabela = 42501 até para service_role.
--   As migrations 20260604220112 (investimentos_marketing) e 20260707194208
--   (meta_ads_campanha) criaram uat/dev com RLS + policies mas SEM GRANT —
--   o padrão correto é o do molde 20260713132814_chatbot_autonomo.sql.
--   form_submissions funciona porque o grant da época da criação dos schemas
--   (manual) cobriu só as tabelas que existiam então.
-- Além do fix pontual, ALTER DEFAULT PRIVILEGES FOR ROLE postgres mata a
--   CLASSE para o pipeline atual: objetos futuros criados PELO ROLE postgres
--   (o das migrations via supabase db push) em uat/dev já nascem com
--   privilégios (RLS continua sendo o gate). DDL rodado por outro role
--   (ex.: SQL Editor do dashboard) NÃO herda — segue precisando de GRANT.
-- anon fica DE FORA por decisão consciente (superfície pública): grant de
--   anon continua por tabela, caso a caso (padrão 20260310000000
--   form_submissions e 20260720042011 deadman configuracoes_sistema).
-- Forward-only e idempotente (GRANT/ALTER DEFAULT PRIVILEGES são idempotentes;
--   gates por schemata + to_regclass — rodar 2x não falha, schema ausente pula).
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  s TEXT;
  t TEXT;
BEGIN
  FOREACH s IN ARRAY ARRAY['uat', 'dev'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = s) THEN
      -- USAGE no schema (idempotente — já existia, reafirma por segurança)
      EXECUTE format('GRANT USAGE ON SCHEMA %I TO authenticated, service_role', s);

      -- Fix pontual: tabelas do CAC Meta (gate por to_regclass — só se existir)
      FOREACH t IN ARRAY ARRAY['investimentos_marketing', 'meta_ads_campanha'] LOOP
        IF to_regclass(format('%I.%I', s, t)) IS NOT NULL THEN
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I.%I TO authenticated', s, t);
          EXECUTE format('GRANT ALL ON %I.%I TO service_role', s, t);
        END IF;
      END LOOP;

      -- Mata a classe p/ o pipeline atual: objetos FUTUROS criados pelo role
      -- postgres (supabase db push) já nascem com privilégios — RLS segue
      -- como único gate. FOR ROLE explícito = contrato visível (sem ele, o
      -- vínculo ao role executor seria implícito e silencioso).
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated', s);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT ALL ON TABLES TO service_role', s);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role', s);
    END IF;
  END LOOP;
END $$;
