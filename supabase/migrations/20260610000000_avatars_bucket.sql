-- ============================================================
-- Avatares de usuário: bucket Storage público para fotos de perfil
--
-- A coluna user_profiles.avatar_url JÁ existe (migration 20260401000100).
-- Aqui só criamos o bucket de Storage + policies. Storage é global
-- (compartilhado entre os schemas public/uat/dev do mesmo projeto).
-- Idempotente: ON CONFLICT + DROP POLICY IF EXISTS.
-- ============================================================

-- ─── Bucket público (avatares são exibidos no app: sidebar/header/listas) ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── Leitura pública (bucket público; exibição direta por URL) ───
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- ─── Escrita: o dono escreve a própria pasta (<uid>/...) OU CEO escreve qualquer ───
-- Convenção de path: 'avatars/<user_id>/<arquivo>' → foldername[1] = user_id.
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.get_user_papel() = 'ceo'
    )
  );

DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.get_user_papel() = 'ceo'
    )
  );

DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.get_user_papel() = 'ceo'
    )
  );

-- service_role tem acesso total (operações administrativas)
DROP POLICY IF EXISTS "avatars_service" ON storage.objects;
CREATE POLICY "avatars_service" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');
