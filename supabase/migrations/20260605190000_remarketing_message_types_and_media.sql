-- ════════════════════════════════════════════════════════════════════════
-- Re-marketing v2 — tipos de mensagem (texto/imagem/link) + bucket de mídia
-- ════════════════════════════════════════════════════════════════════════
-- Aditiva e idempotente. Não altera comportamento de campanhas existentes
-- (default 'texto' = comportamento atual). Aplica colunas em public/uat/dev
-- (banco único, schema por ambiente) + cria 1 bucket público de mídia (storage
-- é global, não tem schema). Imagem de campanha precisa de URL PÚBLICA estável
-- porque a CF envia ao longo de dias (throttle) — bucket privado/signed URL
-- expiraria antes do fim do disparo.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Colunas de tipo de mensagem (public/uat/dev) ────────────────────
DO $$
DECLARE s TEXT;
BEGIN
  FOR s IN SELECT unnest(ARRAY['public', 'uat', 'dev']) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = s) THEN
      EXECUTE format($f$
        ALTER TABLE %1$I.remarketing_campanhas
          ADD COLUMN IF NOT EXISTS tipo_mensagem  TEXT NOT NULL DEFAULT 'texto',
          ADD COLUMN IF NOT EXISTS imagem_url     TEXT,
          ADD COLUMN IF NOT EXISTS link_url       TEXT,
          ADD COLUMN IF NOT EXISTS link_titulo    TEXT,
          ADD COLUMN IF NOT EXISTS link_descricao TEXT,
          ADD COLUMN IF NOT EXISTS link_imagem    TEXT;
        ALTER TABLE %1$I.remarketing_campanhas DROP CONSTRAINT IF EXISTS chk_remktg_tipo_mensagem;
        ALTER TABLE %1$I.remarketing_campanhas ADD CONSTRAINT chk_remktg_tipo_mensagem
          CHECK (tipo_mensagem IN ('texto', 'imagem', 'link'));
      $f$, s);
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN public.remarketing_campanhas.tipo_mensagem IS 'texto | imagem | link — define qual endpoint Z-API a CF usa (send-text/send-image/send-link).';
COMMENT ON COLUMN public.remarketing_campanhas.imagem_url IS 'URL pública da imagem (tipo=imagem). Bucket remarketing-media ou URL externa.';
COMMENT ON COLUMN public.remarketing_campanhas.link_url IS 'URL do CTA (tipo=link). Renderiza como card clicável no WhatsApp (send-link).';

-- ─── 2. Bucket público de mídia de campanha (storage é global) ──────────
-- Público: a CF/WhatsApp precisa buscar a imagem por URL durante dias de
-- disparo. Criativos de marketing não são sensíveis (≠ documentos da família,
-- que ficam no bucket privado crm-uploads).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'remarketing-media',
  'remarketing-media',
  true,
  10485760, -- 10MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Leitura é pública (bucket public=true). Escrita/remoção: só CEO autenticado.
DROP POLICY IF EXISTS "remktg_media_insert" ON storage.objects;
CREATE POLICY "remktg_media_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'remarketing-media' AND public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "remktg_media_delete" ON storage.objects;
CREATE POLICY "remktg_media_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'remarketing-media' AND public.get_user_papel() = 'ceo');
