-- ════════════════════════════════════════════════════════════
-- Migration: papel 'cto' (CTO) — mesmas permissões do CEO
-- Aplica em: public  (o RBAC do CRM — enum papel_usuario, user_profiles
--   e get_user_papel() — existe SOMENTE no schema public; não há cópia
--   em uat/dev, ao contrário de form_submissions).
--
-- Contexto: novo papel RBAC 'cto'. É DISTINTO na exibição (coluna
--   user_profiles.papel guarda 'cto'), porém IDÊNTICO ao 'ceo' em
--   autorização. Para não reescrever todas as policies (todas usam
--   `get_user_papel() = 'ceo'`), a função helper resolve cto→ceo.
--   Assim, zero policies precisam mudar e o CTO herda exatamente o
--   acesso do CEO via RLS.
--
-- Forward-only / idempotente: guard em pg_enum + CREATE OR REPLACE.
-- ════════════════════════════════════════════════════════════

-- ─── 1. Adiciona o valor 'cto' ao enum papel_usuario ───
-- Guard por pg_enum (idempotente). DO block SEM bloco EXCEPTION de propósito:
-- um handler EXCEPTION abriria subtransação e faria ALTER TYPE ADD VALUE
-- falhar com "cannot run inside a transaction block". Sem handler, o ALTER
-- roda na transação da migration (permitido no PG12+; o valor só não pode
-- ser USADO na mesma transação — e não é: get_user_papel compara via ::text).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'papel_usuario' AND e.enumlabel = 'cto'
  ) THEN
    ALTER TYPE public.papel_usuario ADD VALUE 'cto';
  END IF;
END $$;

-- ─── 2. get_user_papel() resolve cto→ceo (papel EFETIVO de autorização) ───
-- A coluna user_profiles.papel mantém o papel REAL ('cto'); apenas esta
-- função de permissão trata cto como ceo. Comparação por ::text evita usar
-- o novo valor de enum na mesma transação em que foi adicionado.
CREATE OR REPLACE FUNCTION public.get_user_papel()
RETURNS TEXT AS $$
  SELECT CASE WHEN papel::text = 'cto' THEN 'ceo' ELSE papel::text END
  FROM public.user_profiles
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_papel() IS
  'Retorna o papel EFETIVO de autorização do usuário (ceo/head_sucesso/comercial). CTO resolve para ceo (mesmas permissões). O papel REAL de exibição fica em user_profiles.papel.';

COMMENT ON COLUMN public.user_profiles.papel IS
  'Papel RBAC: ceo, cto (= ceo em permissões), head_sucesso, comercial';
