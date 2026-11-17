-- ════════════════════════════════════════════════════════════════════════
-- Migration: token do conector do Claude é SOMENTE LEITURA no banco
-- Aplica em: public (tabelas com RLS ligado)
-- Contexto (revisão de segurança do conector, 17/11/2026):
--   o Claude autentica pelo servidor OAuth 2.1 do Supabase Auth e recebe um
--   JWT do PRÓPRIO usuário (CEO), com o claim extra `client_id`. O /api/mcp só
--   expõe leitura — mas o TOKEN vale no PostgREST inteiro: se vazar (log,
--   credencial local do Claude Code), quem o tiver escreveria no CRM como CEO.
-- Correção: policy RESTRICTIVE por tabela barra INSERT/UPDATE/DELETE quando o
--   JWT tem `client_id` (token emitido pelo servidor OAuth). RESTRICTIVE soma
--   com as permissivas por AND: sessão normal do Engine (sem client_id), anon
--   do formulário e service_role (bypassa RLS) não mudam em nada.
-- Limites conhecidos (documentados no CLAUDE.md): RPCs SECURITY DEFINER rodam
--   como dono e não passam pelo RLS; Storage não está coberto.
-- Tabela NOVA: chamar `SELECT public.conector_somente_leitura_aplicar();` no
--   fim da migration (guard tests/mcp-engine-invariants.test.js).
-- Idempotente (DROP POLICY IF EXISTS). Só tabelas cujo dono é o role da
--   migration (CREATE POLICY exige dono) — as outras são puladas com NOTICE.
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.conector_somente_leitura_aplicar(p_schema text DEFAULT 'public')
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  t record;
  aplicadas integer := 0;
  condicao constant text := '((auth.jwt() ->> ''client_id'') IS NULL)';
BEGIN
  FOR t IN
    SELECT c.relname, pg_get_userbyid(c.relowner) AS dono
      FROM pg_class c
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = p_schema
       AND c.relkind IN ('r', 'p')
       AND c.relrowsecurity
     ORDER BY c.relname
  LOOP
    IF t.dono <> current_user THEN
      RAISE NOTICE 'conector_somente_leitura: % pulada (dono %)', t.relname, t.dono;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS conector_somente_leitura_ins ON %I.%I', p_schema, t.relname);
    EXECUTE format('DROP POLICY IF EXISTS conector_somente_leitura_upd ON %I.%I', p_schema, t.relname);
    EXECUTE format('DROP POLICY IF EXISTS conector_somente_leitura_del ON %I.%I', p_schema, t.relname);
    EXECUTE format(
      'CREATE POLICY conector_somente_leitura_ins ON %I.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK %s',
      p_schema, t.relname, condicao);
    EXECUTE format(
      'CREATE POLICY conector_somente_leitura_upd ON %I.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING %s WITH CHECK %s',
      p_schema, t.relname, condicao, condicao);
    EXECUTE format(
      'CREATE POLICY conector_somente_leitura_del ON %I.%I AS RESTRICTIVE FOR DELETE TO authenticated USING %s',
      p_schema, t.relname, condicao);
    aplicadas := aplicadas + 1;
  END LOOP;
  RETURN aplicadas;
END;
$$;

REVOKE ALL ON FUNCTION public.conector_somente_leitura_aplicar(text) FROM PUBLIC, anon, authenticated;

SELECT public.conector_somente_leitura_aplicar('public');
