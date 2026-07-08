-- ════════════════════════════════════════════════════════════════════════
-- Migration: whatsapp_mensagens — espelho do WhatsApp via webhook Z-API
-- Aplica em: public, uat, dev
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   A instância Z-API é multi-device e NÃO fornece histórico de conversa por
--   API (400 "Does not work in multi device version"). O espelho real é
--   construído recebendo os webhooks da Z-API (CF zapi-inbox) e gravando cada
--   mensagem aqui; a tela /whatsapp do Engine lê desta tabela.
--
--   A instância Z-API é ÚNICA (compartilhada entre ambientes), então o stream
--   de mensagens é um dado de PRODUÇÃO: a CF receptora grava SEMPRE em
--   `public`, e o Engine (PRD e preview) lê de `public`. Os schemas uat/dev
--   recebem a estrutura por consistência (testes isolados apontando a CF dev).
--
-- Decisões deliberadas (difere do template padrão):
--   • Append-only: sem updated_at/deleted_at (mensagem é imutável).
--   • SEM trigger de auditoria: volume alto + conteúdo pessoal — espelhar cada
--     mensagem em audit_logs dobraria o armazenamento de PII sem valor de audit.
--   • Idempotência: UNIQUE(message_id) + insert com ignore-duplicates na CF
--     (Z-API reenvia webhooks em retry).
--
-- Forward-only, idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  TEXT NOT NULL,
  phone       TEXT NOT NULL,                     -- só dígitos com DDI
  from_me     BOOLEAN NOT NULL DEFAULT false,
  tipo        TEXT NOT NULL DEFAULT 'text'
              CHECK (tipo IN ('text','image','audio','video','document','sticker','location','contact','reaction','other')),
  texto       TEXT,                              -- corpo/caption; NULL p/ mídia sem legenda
  sender_name TEXT,
  momment     TIMESTAMPTZ,                       -- timestamp da mensagem na Z-API
  status      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_whatsapp_mensagens_message_id UNIQUE (message_id)
);

COMMENT ON TABLE public.whatsapp_mensagens IS 'Espelho do WhatsApp comercial — mensagens recebidas/enviadas capturadas via webhook Z-API (CF zapi-inbox). Append-only; histórico existe a partir da ativação do webhook.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_phone_momment
  ON public.whatsapp_mensagens (phone, momment DESC);

-- RLS: leitura SÓ CEO (cto resolve p/ ceo) — a tela /whatsapp é CEO-only e o
-- conteúdo é conversa pessoal integral; liberar p/ authenticated permitiria
-- head/comercial lerem tudo via PostgREST direto, driblando o guard da UI.
ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "whatsapp_msg_select" ON public.whatsapp_mensagens;
CREATE POLICY "whatsapp_msg_select" ON public.whatsapp_mensagens
  FOR SELECT TO authenticated USING (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "whatsapp_msg_service" ON public.whatsapp_mensagens;
CREATE POLICY "whatsapp_msg_service" ON public.whatsapp_mensagens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── UAT ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.whatsapp_mensagens (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id  TEXT NOT NULL,
        phone       TEXT NOT NULL,
        from_me     BOOLEAN NOT NULL DEFAULT false,
        tipo        TEXT NOT NULL DEFAULT ''text''
                    CHECK (tipo IN (''text'',''image'',''audio'',''video'',''document'',''sticker'',''location'',''contact'',''reaction'',''other'')),
        texto       TEXT,
        sender_name TEXT,
        momment     TIMESTAMPTZ,
        status      TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_whatsapp_mensagens_message_id UNIQUE (message_id)
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_phone_momment ON uat.whatsapp_mensagens (phone, momment DESC)';
    EXECUTE 'ALTER TABLE uat.whatsapp_mensagens ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_msg_select" ON uat.whatsapp_mensagens';
    EXECUTE 'CREATE POLICY "whatsapp_msg_select" ON uat.whatsapp_mensagens FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_msg_service" ON uat.whatsapp_mensagens';
    EXECUTE 'CREATE POLICY "whatsapp_msg_service" ON uat.whatsapp_mensagens FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'GRANT SELECT ON uat.whatsapp_mensagens TO authenticated';
    EXECUTE 'GRANT ALL ON uat.whatsapp_mensagens TO service_role';
  END IF;
END $$;

-- ─── DEV ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev') THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.whatsapp_mensagens (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id  TEXT NOT NULL,
        phone       TEXT NOT NULL,
        from_me     BOOLEAN NOT NULL DEFAULT false,
        tipo        TEXT NOT NULL DEFAULT ''text''
                    CHECK (tipo IN (''text'',''image'',''audio'',''video'',''document'',''sticker'',''location'',''contact'',''reaction'',''other'')),
        texto       TEXT,
        sender_name TEXT,
        momment     TIMESTAMPTZ,
        status      TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_whatsapp_mensagens_message_id UNIQUE (message_id)
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_phone_momment ON dev.whatsapp_mensagens (phone, momment DESC)';
    EXECUTE 'ALTER TABLE dev.whatsapp_mensagens ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_msg_select" ON dev.whatsapp_mensagens';
    EXECUTE 'CREATE POLICY "whatsapp_msg_select" ON dev.whatsapp_mensagens FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_msg_service" ON dev.whatsapp_mensagens';
    EXECUTE 'CREATE POLICY "whatsapp_msg_service" ON dev.whatsapp_mensagens FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'GRANT SELECT ON dev.whatsapp_mensagens TO authenticated';
    EXECUTE 'GRANT ALL ON dev.whatsapp_mensagens TO service_role';
  END IF;
END $$;
