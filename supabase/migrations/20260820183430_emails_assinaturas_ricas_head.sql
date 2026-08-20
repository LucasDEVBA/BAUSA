-- E-mail v3 (2026-08-20): assinaturas RICAS + acesso da Head.
--
-- 1. Bucket email-assets: imagens das assinaturas (logo, foto) — público
--    (o destinatário do e-mail carrega a imagem por URL).
-- 2. emails_permissoes (seed): caixas e contas de envio liberadas para a
--    Head pelo CEO. Vazio = Head vê a tela mas sem caixas até o CEO liberar.
--    O CC forçado do CEO nos envios da Head é código (server action), não
--    config — não é desligável por chave.
-- 3. RLS de emails_mensagens: SELECT passa a incluir head_sucesso — o
--    recorte POR CAIXA é aplicado no servidor do app (todas as queries
--    filtram pelas caixas permitidas quando o papel é head).
--
-- Assinaturas: a chave emails_assinaturas passa a guardar LISTA por conta
-- ({conta: [{id, nome, html, padrao}]}); o formato legado (string) é
-- migrado pelo código na leitura — sem transformação SQL arriscada.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-assets',
  'email-assets',
  true,
  3145728, -- 3MB por imagem de assinatura
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "email_assets_public_read" ON storage.objects;
CREATE POLICY "email_assets_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'email-assets');
-- Escrita: só service_role (upload via server action com admin client) —
-- nenhuma policy de INSERT para authenticated. A policy explícita abaixo é
-- cinto-e-suspensório (service_role já ignora RLS) — mesmo padrão do bucket
-- avatars (migration 20260610000000).
DROP POLICY IF EXISTS "email_assets_service" ON storage.objects;
CREATE POLICY "email_assets_service" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'email-assets')
  WITH CHECK (bucket_id = 'email-assets');

INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
VALUES ('emails_permissoes',
        '{"head_sucesso": {"caixas": [], "envio": []}}'::jsonb,
        'Acesso da Head ao /emails: caixas visíveis e contas de envio (CEO define). CC do CEO nos envios dela é forçado por código.')
ON CONFLICT (chave) DO NOTHING;

DO $$
BEGIN
  IF to_regclass('public.emails_mensagens') IS NOT NULL THEN
    DROP POLICY IF EXISTS emails_mensagens_select_ceo ON public.emails_mensagens;
    DROP POLICY IF EXISTS emails_mensagens_select_equipe ON public.emails_mensagens;
    CREATE POLICY emails_mensagens_select_equipe ON public.emails_mensagens
      FOR SELECT TO authenticated
      USING (public.get_user_papel() IN ('ceo', 'head_sucesso'));
  END IF;
END $$;
