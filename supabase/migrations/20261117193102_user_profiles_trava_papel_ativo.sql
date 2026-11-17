-- ════════════════════════════════════════════════════════════════════════
-- Migration: papel e ativo de user_profiles só mudam por CEO/CTO
-- Aplica em: public (user_profiles só existe em public)
-- Contexto (revisão de segurança do conector do Claude, 17/11/2026):
--   a policy "user_profiles_update" (20260401000100) deixa o usuário editar a
--   PRÓPRIA linha para "preferências" — mas RLS não restringe coluna. Qualquer
--   usuário logado (comercial, head_sucesso) podia fazer
--     PATCH /rest/v1/user_profiles?id=eq.<ele>  {"papel":"ceo"}
--   com o próprio token e virar CEO em todo get_user_papel() do RLS (e em
--   todos os gates do Engine). O app nunca faz isso (atualizarMeuPerfil só
--   manda nome/avatar), mas a API pública aceitava.
-- Correção: trigger BEFORE UPDATE barra mudança de `papel`/`ativo` quando quem
--   pede é o role `authenticated` SEM papel efetivo CEO (cto→ceo via
--   get_user_papel). get_user_papel lê a linha ANTIGA (BEFORE), então quem se
--   auto-promove é barrado. CEO pela tela de Usuários (sessão do CEO) e o
--   servidor (service_role/postgres) seguem iguais.
-- Forward-only, idempotente (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.user_profiles_trava_papel_ativo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF (NEW.papel IS DISTINCT FROM OLD.papel OR NEW.ativo IS DISTINCT FROM OLD.ativo)
     AND coalesce(public.get_user_papel(), '') <> 'ceo' THEN
    RAISE EXCEPTION 'Só CEO/CTO podem alterar papel ou status de usuário.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS user_profiles_trava_papel_ativo_trg ON public.user_profiles';
    EXECUTE 'CREATE TRIGGER user_profiles_trava_papel_ativo_trg
             BEFORE UPDATE ON public.user_profiles
             FOR EACH ROW EXECUTE FUNCTION public.user_profiles_trava_papel_ativo()';
  END IF;
END $$;
