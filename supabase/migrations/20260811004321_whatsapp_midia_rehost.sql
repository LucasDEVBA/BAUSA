-- ════════════════════════════════════════════════════════════════════════
-- Migration: Re-hospedagem de mídia do WhatsApp (bucket próprio + media_path)
-- Aplica em public (+ uat/dev quando a tabela existir); Storage é global.
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto: as URLs de mídia da Z-API (media_url → f004.backblazeb2.com)
-- EXPIRAM em ~semanas (diagnóstico 2026-08-10: áudio de 15/jul respondia 503)
-- e as conversas degradam para "[mídia expirada]". A CF zapi-inbox passa a
-- baixar cada mídia no ingest e subir no bucket PRÓPRIO — permanente.
--
-- Mudanças:
--   1. Bucket PRIVADO `whatsapp-midia` (conversas de leads = dado sensível;
--      leitura só via URL assinada, gerada sob sessão CEO).
--   2. Coluna whatsapp_mensagens.media_path (path no bucket; media_url da
--      Z-API permanece como fallback legado).
--   3. RPC whatsapp_grupo_ingest ganha p_media_path TEXT DEFAULT NULL.
--      A assinatura antiga (12 args) é DROPADA antes: manter as duas geraria
--      PGRST203 (ambiguidade) para a CF antiga, que chama com 12 args nomeados
--      — com o DEFAULT, a chamada antiga resolve na assinatura nova.
--
-- Mídia com media_url já expirada é irrecuperável — só o fluxo novo persiste.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Bucket privado (Storage é compartilhado entre schemas) ───────────

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('whatsapp-midia', 'whatsapp-midia', false, 15728640) -- 15MB
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- Leitura (habilita createSignedUrl com a sessão do usuário no Engine):
--   CEO/CTO → tudo; Head → SÓ mídia de grupo VINCULADO (o EXISTS roda sob a
--   RLS de whatsapp_grupos do PRÓPRIO usuário — policy head = grupo vinculado
--   — espelhando o escopo de leitura de whatsapp_mensagens; path de grupo tem
--   o grupo_id como 1º segmento). Escrita: NENHUMA policy p/ authenticated —
--   só a CF (service_role, bypassa RLS) grava.
DROP POLICY IF EXISTS "whatsapp_midia_select_ceo" ON storage.objects;
DROP POLICY IF EXISTS "whatsapp_midia_select" ON storage.objects;
CREATE POLICY "whatsapp_midia_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'whatsapp-midia'
    AND (
      public.get_user_papel() = 'ceo'
      OR EXISTS (
        SELECT 1 FROM public.whatsapp_grupos g
        WHERE g.grupo_id = (storage.foldername(name))[1]
          AND g.deleted_at IS NULL
      )
    )
  );

-- ─── 2. Coluna media_path ────────────────────────────────────────────────

ALTER TABLE public.whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS media_path TEXT;

DO $$
BEGIN
  IF to_regclass('uat.whatsapp_mensagens') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.whatsapp_mensagens ADD COLUMN IF NOT EXISTS media_path TEXT';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('dev.whatsapp_mensagens') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.whatsapp_mensagens ADD COLUMN IF NOT EXISTS media_path TEXT';
  END IF;
END $$;

-- ─── 3. RPC com p_media_path (DROP da assinatura antiga → sem ambiguidade) ─

DROP FUNCTION IF EXISTS public.whatsapp_grupo_ingest(
  TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.whatsapp_grupo_ingest(
  p_grupo_id           TEXT,
  p_nome               TEXT,
  p_message_id         TEXT,
  p_from_me            BOOLEAN,
  p_tipo               TEXT,
  p_texto              TEXT,
  p_media_url          TEXT,
  p_mime_type          TEXT,
  p_media_filename     TEXT,
  p_participante_nome  TEXT,
  p_participante_phone TEXT,
  p_momment            TIMESTAMPTZ,
  p_media_path         TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_capturar BOOLEAN;
  v_rows     INT := 0;
  v_last     TIMESTAMPTZ := COALESCE(p_momment, NOW());
BEGIN
  IF p_grupo_id IS NULL OR btrim(p_grupo_id) = '' THEN
    RETURN jsonb_build_object('capturar', false, 'inserted', false);
  END IF;

  -- Upsert do grupo: existência SEMPRE registrada; metadata (nome/last_message_at)
  -- atualizada mesmo com captura desligada. capturar/vínculo nunca mudam aqui.
  INSERT INTO public.whatsapp_grupos (grupo_id, nome, first_seen_at, last_message_at)
  VALUES (p_grupo_id, NULLIF(btrim(p_nome), ''), NOW(), v_last)
  ON CONFLICT (grupo_id) DO UPDATE
    SET nome            = COALESCE(NULLIF(btrim(EXCLUDED.nome), ''), whatsapp_grupos.nome),
        last_message_at = GREATEST(
          COALESCE(whatsapp_grupos.last_message_at, EXCLUDED.last_message_at),
          EXCLUDED.last_message_at
        )
  RETURNING capturar INTO v_capturar;

  -- Conteúdo só é gravado com captura ligada (opt-out desde 20260810204500).
  IF v_capturar AND p_message_id IS NOT NULL AND btrim(p_message_id) <> '' THEN
    INSERT INTO public.whatsapp_mensagens
      (message_id, phone, from_me, tipo, texto, media_url, mime_type, media_filename,
       media_path, sender_name, momment, grupo_id, is_grupo, participante_nome, participante_phone)
    VALUES
      (p_message_id, p_grupo_id, COALESCE(p_from_me, false), COALESCE(NULLIF(p_tipo, ''), 'text'),
       p_texto, p_media_url, p_mime_type, p_media_filename, p_media_path,
       p_participante_nome, v_last, p_grupo_id, true, p_participante_nome, p_participante_phone)
    ON CONFLICT (message_id) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    -- Incrementa SÓ quando houve inserção nova (idempotente em retry/corrida).
    IF v_rows > 0 THEN
      UPDATE public.whatsapp_grupos
        SET total_mensagens = total_mensagens + 1
        WHERE grupo_id = p_grupo_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('capturar', COALESCE(v_capturar, false), 'inserted', v_rows > 0);
END;
$fn$;

-- Só o service_role (a CF) executa a RPC — anon/authenticated nunca.
REVOKE ALL ON FUNCTION public.whatsapp_grupo_ingest(
  TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_grupo_ingest(
  TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_grupo_ingest(
  TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT
) TO service_role;
