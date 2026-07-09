-- ════════════════════════════════════════════════════════════════════════
-- Migration: whatsapp_mensagens ganha colunas de mídia (URL/MIME/nome)
-- Aplica em: public, uat, dev (multi-schema, DO blocks idempotentes)
-- ════════════════════════════════════════════════════════════════════════
--
-- O espelho passa a EXIBIR a mídia recebida (foto/áudio/vídeo/documento/
-- sticker) em vez de "[mídia]". O webhook zapi-inbox capta a URL da mídia do
-- payload da Z-API e grava aqui. Aditivo e idempotente (ADD COLUMN IF NOT
-- EXISTS) — mensagens antigas ficam com media_url NULL (fallback textual).
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
ALTER TABLE public.whatsapp_mensagens ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.whatsapp_mensagens ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE public.whatsapp_mensagens ADD COLUMN IF NOT EXISTS media_filename TEXT;

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    EXECUTE 'ALTER TABLE uat.whatsapp_mensagens ADD COLUMN IF NOT EXISTS media_url TEXT';
    EXECUTE 'ALTER TABLE uat.whatsapp_mensagens ADD COLUMN IF NOT EXISTS mime_type TEXT';
    EXECUTE 'ALTER TABLE uat.whatsapp_mensagens ADD COLUMN IF NOT EXISTS media_filename TEXT';
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    EXECUTE 'ALTER TABLE dev.whatsapp_mensagens ADD COLUMN IF NOT EXISTS media_url TEXT';
    EXECUTE 'ALTER TABLE dev.whatsapp_mensagens ADD COLUMN IF NOT EXISTS mime_type TEXT';
    EXECUTE 'ALTER TABLE dev.whatsapp_mensagens ADD COLUMN IF NOT EXISTS media_filename TEXT';
  END IF;
END $$;
