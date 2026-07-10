-- ════════════════════════════════════════════════════════════════════════
-- Migration: restringe SELECT de links_curtos ao CEO (least-privilege)
-- Aplica em: public, uat, dev (multi-schema, DO blocks idempotentes)
-- ════════════════════════════════════════════════════════════════════════
--
-- A policy `links_curtos_select` (FOR SELECT TO authenticated USING
-- deleted_at IS NULL) deixava a tabela legível por QUALQUER usuário
-- authenticated (head_sucesso/comercial) via PostgREST direto — mais amplo que
-- o gate de app (CEO-only em listarLinksCurtos / requirePapel). Como policies
-- RLS são permissivas (OR), ela concedia acesso independentemente do papel.
--
-- É desnecessária: o CEO já é coberto por `links_curtos_ceo` (FOR ALL) e o
-- redirect público usa a RPC `registrar_clique_link` (SECURITY DEFINER, nunca
-- SELECT direto). Removê-la alinha o banco ao modelo pretendido sem quebrar
-- nenhum fluxo (forward-only, idempotente).
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
DROP POLICY IF EXISTS "links_curtos_select" ON public.links_curtos;

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    EXECUTE 'DROP POLICY IF EXISTS "links_curtos_select" ON uat.links_curtos';
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    EXECUTE 'DROP POLICY IF EXISTS "links_curtos_select" ON dev.links_curtos';
  END IF;
END $$;
