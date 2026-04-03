-- ============================================================
-- CRM Bolsa Atleta USA — Migration 2: Perfis de Usuário + RBAC
-- Cria tabela user_profiles e função helper public.get_user_papel()
-- para controle de acesso baseado em papel (RBAC via RLS).
-- ============================================================

-- ── Tabela de perfis ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  papel       papel_usuario NOT NULL,
  nome        TEXT NOT NULL,
  email       TEXT NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT true,
  avatar_url  TEXT,
  preferencias_notificacao JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- SEM deleted_at: usuários são desativados (ativo=false), não deletados
);

COMMENT ON TABLE public.user_profiles IS 'Perfis de usuários do CRM, vinculados ao Supabase Auth';
COMMENT ON COLUMN public.user_profiles.papel IS 'Papel RBAC: ceo, head_sucesso, comercial';
COMMENT ON COLUMN public.user_profiles.preferencias_notificacao IS 'Config de notificações do usuário (JSON)';

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_profiles_papel ON public.user_profiles(papel);
CREATE INDEX IF NOT EXISTS idx_user_profiles_ativo ON public.user_profiles(ativo) WHERE ativo = true;

-- ── Função helper: retorna o papel do usuário autenticado ────
-- Usada em todas as policies RLS do CRM.
-- Em public (não auth) porque Supabase não permite criar funções no schema auth.
-- SECURITY DEFINER para acessar user_profiles sem depender de RLS.
CREATE OR REPLACE FUNCTION public.get_user_papel()
RETURNS TEXT AS $$
  SELECT papel::TEXT FROM public.user_profiles
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_papel() IS 'Retorna o papel RBAC (ceo/head_sucesso/comercial) do usuário autenticado';

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: usuário vê o próprio registro OU CEO vê todos
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
CREATE POLICY "user_profiles_select" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.get_user_papel() = 'ceo');

-- UPDATE: usuário edita o próprio (apenas preferências) OU CEO edita qualquer
DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;
CREATE POLICY "user_profiles_update" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.get_user_papel() = 'ceo')
  WITH CHECK (id = auth.uid() OR public.get_user_papel() = 'ceo');

-- INSERT: apenas CEO pode criar novos perfis
DROP POLICY IF EXISTS "user_profiles_insert" ON public.user_profiles;
CREATE POLICY "user_profiles_insert" ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel() = 'ceo');

-- DELETE: apenas CEO pode remover perfis
DROP POLICY IF EXISTS "user_profiles_delete" ON public.user_profiles;
CREATE POLICY "user_profiles_delete" ON public.user_profiles
  FOR DELETE TO authenticated
  USING (public.get_user_papel() = 'ceo');

-- service_role tem acesso total (necessário para hooks e Cloud Functions)
DROP POLICY IF EXISTS "user_profiles_service" ON public.user_profiles;
CREATE POLICY "user_profiles_service" ON public.user_profiles
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
