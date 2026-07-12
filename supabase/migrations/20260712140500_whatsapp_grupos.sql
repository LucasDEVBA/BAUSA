-- ════════════════════════════════════════════════════════════════════════
-- Migration: whatsapp_grupos — coletor de grupos de WhatsApp (Fase A dos agents)
-- Aplica em: public, uat, dev (multi-schema; uat/dev gateados por to_regclass)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   Fundação de dados para os "agents de WhatsApp": a CF zapi-inbox passa a
--   RECONHECER mensagens de grupo (antes descartadas) e a registrar a EXISTÊNCIA
--   de cada grupo (id + nome). O CONTEÚDO das mensagens só é armazenado para
--   grupos que o CEO explicitamente marcou "capturar" (opt-in, LGPD-safe) — o
--   CEO liga a captura de cada grupo conscientemente pela aba /whatsapp > Grupos.
--
--   Sem retroativo: a instância Z-API multi-device não fornece histórico por API;
--   o espelho de grupo existe a partir da ativação da captura em diante.
--
--   Como whatsapp_mensagens, o stream é dado de PRODUÇÃO (instância Z-API única
--   compartilhada) e a CF zapi-inbox hardcoda schema 'public'. Os schemas uat/dev
--   recebem a estrutura por consistência; a RPC de ingestão existe SÓ em public
--   (nada em uat/dev a chama — a CF -uat também grava em public).
--
-- Decisões deliberadas:
--   • Auditoria SÓ nas mudanças do CEO (capturar/atleta_id/experiencia_id) e no
--     INSERT/DELETE — os bumps de metadata da RPC (nome/last_message_at/
--     total_mensagens) são alto-volume e não vão para audit_logs (mesma razão de
--     whatsapp_mensagens não ter trigger de auditoria).
--   • Contagem via RPC atômica (whatsapp_grupo_ingest): upsert do grupo +
--     INSERT idempotente da mensagem (ON CONFLICT message_id DO NOTHING) +
--     incremento de total_mensagens SÓ quando a linha foi de fato inserida —
--     reprocessar o mesmo webhook não duplica nem conta em dobro.
--
-- Forward-only, idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_grupos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id         TEXT NOT NULL,                       -- id do grupo na Z-API (phone do payload de grupo)
  nome             TEXT,                                -- chatName do grupo
  atleta_id        UUID REFERENCES public.atletas(id),         -- vínculo opcional à família (atleta)
  experiencia_id   UUID REFERENCES public.crm_experiencia(id), -- vínculo opcional à experiência pós-venda
  capturar         BOOLEAN NOT NULL DEFAULT false,      -- opt-in: só true armazena CONTEÚDO das mensagens
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at  TIMESTAMPTZ,
  total_mensagens  INT NOT NULL DEFAULT 0,              -- nº de mensagens capturadas (só cresce com captura ligada)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  created_by       UUID REFERENCES auth.users(id),
  CONSTRAINT uq_whatsapp_grupos_grupo_id UNIQUE (grupo_id)
);

COMMENT ON TABLE public.whatsapp_grupos IS 'Grupos de WhatsApp detectados pela CF zapi-inbox. A existência é sempre registrada; o conteúdo das mensagens só é capturado quando capturar=true (opt-in do CEO, LGPD-safe).';

CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_atleta
  ON public.whatsapp_grupos (atleta_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_experiencia
  ON public.whatsapp_grupos (experiencia_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_capturar
  ON public.whatsapp_grupos (capturar) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_last_message
  ON public.whatsapp_grupos (last_message_at DESC) WHERE deleted_at IS NULL;

-- updated_at automático (função compartilhada)
DROP TRIGGER IF EXISTS trg_whatsapp_grupos_updated_at ON public.whatsapp_grupos;
CREATE TRIGGER trg_whatsapp_grupos_updated_at BEFORE UPDATE ON public.whatsapp_grupos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auditoria SÓ das mudanças do CEO (capturar/vínculo) + INSERT/DELETE. Os bumps
-- de metadata da RPC (nome/last_message_at/total_mensagens) NÃO disparam audit
-- (alto volume: 1 por mensagem de grupo) — coluna nome fica de fora de propósito.
DROP TRIGGER IF EXISTS trg_audit_whatsapp_grupos ON public.whatsapp_grupos;
CREATE TRIGGER trg_audit_whatsapp_grupos
  AFTER INSERT OR DELETE OR UPDATE OF capturar, atleta_id, experiencia_id
  ON public.whatsapp_grupos
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- RLS: leitura e alteração (ligar captura / vincular família) SÓ CEO (cto→ceo).
ALTER TABLE public.whatsapp_grupos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "whatsapp_grupos_select" ON public.whatsapp_grupos;
CREATE POLICY "whatsapp_grupos_select" ON public.whatsapp_grupos
  FOR SELECT TO authenticated USING (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "whatsapp_grupos_update" ON public.whatsapp_grupos;
CREATE POLICY "whatsapp_grupos_update" ON public.whatsapp_grupos
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "whatsapp_grupos_service" ON public.whatsapp_grupos;
CREATE POLICY "whatsapp_grupos_service" ON public.whatsapp_grupos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Colunas de grupo em whatsapp_mensagens (herdam a RLS existente: SELECT ceo).
ALTER TABLE public.whatsapp_mensagens ADD COLUMN IF NOT EXISTS grupo_id TEXT;
ALTER TABLE public.whatsapp_mensagens ADD COLUMN IF NOT EXISTS is_grupo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.whatsapp_mensagens ADD COLUMN IF NOT EXISTS participante_nome TEXT;
ALTER TABLE public.whatsapp_mensagens ADD COLUMN IF NOT EXISTS participante_phone TEXT;

CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_grupo_momment
  ON public.whatsapp_mensagens (grupo_id, momment DESC) WHERE is_grupo;

-- ─── RPC de ingestão (SÓ public — a CF hardcoda schema public) ───────────
-- Atômica e idempotente: upsert do grupo (existência sempre registrada) +
-- INSERT da mensagem SÓ se capturar=true, com incremento do contador apenas
-- quando a linha foi realmente inserida (ON CONFLICT message_id DO NOTHING).
-- Retorna { capturar, inserted } para a CF logar sem duplicar contagem.
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
  p_momment            TIMESTAMPTZ
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

  -- Conteúdo só é gravado com opt-in do CEO (capturar=true).
  IF v_capturar AND p_message_id IS NOT NULL AND btrim(p_message_id) <> '' THEN
    INSERT INTO public.whatsapp_mensagens
      (message_id, phone, from_me, tipo, texto, media_url, mime_type, media_filename,
       sender_name, momment, grupo_id, is_grupo, participante_nome, participante_phone)
    VALUES
      (p_message_id, p_grupo_id, COALESCE(p_from_me, false), COALESCE(NULLIF(p_tipo, ''), 'text'),
       p_texto, p_media_url, p_mime_type, p_media_filename, p_participante_nome, v_last,
       p_grupo_id, true, p_participante_nome, p_participante_phone)
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
  TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_grupo_ingest(
  TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_grupo_ingest(
  TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;

-- ─── UAT ─────────────────────────────────────────────────────────────────
-- Gateado por tabela (uat/dev são incompletos): colunas de whatsapp_mensagens
-- só se a tabela existe; whatsapp_grupos só se atletas E crm_experiencia existem
-- (as FKs quebrariam com 42P01 caso contrário).
DO $$
BEGIN
  IF to_regclass('uat.whatsapp_mensagens') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.whatsapp_mensagens ADD COLUMN IF NOT EXISTS grupo_id TEXT';
    EXECUTE 'ALTER TABLE uat.whatsapp_mensagens ADD COLUMN IF NOT EXISTS is_grupo BOOLEAN NOT NULL DEFAULT false';
    EXECUTE 'ALTER TABLE uat.whatsapp_mensagens ADD COLUMN IF NOT EXISTS participante_nome TEXT';
    EXECUTE 'ALTER TABLE uat.whatsapp_mensagens ADD COLUMN IF NOT EXISTS participante_phone TEXT';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_grupo_momment ON uat.whatsapp_mensagens (grupo_id, momment DESC) WHERE is_grupo';
  END IF;

  IF to_regclass('uat.atletas') IS NOT NULL AND to_regclass('uat.crm_experiencia') IS NOT NULL THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.whatsapp_grupos (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        grupo_id         TEXT NOT NULL,
        nome             TEXT,
        atleta_id        UUID REFERENCES uat.atletas(id),
        experiencia_id   UUID REFERENCES uat.crm_experiencia(id),
        capturar         BOOLEAN NOT NULL DEFAULT false,
        first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_message_at  TIMESTAMPTZ,
        total_mensagens  INT NOT NULL DEFAULT 0,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at       TIMESTAMPTZ,
        created_by       UUID REFERENCES auth.users(id),
        CONSTRAINT uq_whatsapp_grupos_grupo_id UNIQUE (grupo_id)
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_atleta ON uat.whatsapp_grupos (atleta_id) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_experiencia ON uat.whatsapp_grupos (experiencia_id) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_capturar ON uat.whatsapp_grupos (capturar) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_last_message ON uat.whatsapp_grupos (last_message_at DESC) WHERE deleted_at IS NULL';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_whatsapp_grupos_updated_at ON uat.whatsapp_grupos';
    EXECUTE 'CREATE TRIGGER trg_whatsapp_grupos_updated_at BEFORE UPDATE ON uat.whatsapp_grupos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_whatsapp_grupos ON uat.whatsapp_grupos';
    EXECUTE 'CREATE TRIGGER trg_audit_whatsapp_grupos AFTER INSERT OR DELETE OR UPDATE OF capturar, atleta_id, experiencia_id ON uat.whatsapp_grupos FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'ALTER TABLE uat.whatsapp_grupos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_grupos_select" ON uat.whatsapp_grupos';
    EXECUTE 'CREATE POLICY "whatsapp_grupos_select" ON uat.whatsapp_grupos FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_grupos_update" ON uat.whatsapp_grupos';
    EXECUTE 'CREATE POLICY "whatsapp_grupos_update" ON uat.whatsapp_grupos FOR UPDATE TO authenticated USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_grupos_service" ON uat.whatsapp_grupos';
    EXECUTE 'CREATE POLICY "whatsapp_grupos_service" ON uat.whatsapp_grupos FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'GRANT SELECT, UPDATE ON uat.whatsapp_grupos TO authenticated';
    EXECUTE 'GRANT ALL ON uat.whatsapp_grupos TO service_role';
  END IF;
END $$;

-- ─── DEV ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('dev.whatsapp_mensagens') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.whatsapp_mensagens ADD COLUMN IF NOT EXISTS grupo_id TEXT';
    EXECUTE 'ALTER TABLE dev.whatsapp_mensagens ADD COLUMN IF NOT EXISTS is_grupo BOOLEAN NOT NULL DEFAULT false';
    EXECUTE 'ALTER TABLE dev.whatsapp_mensagens ADD COLUMN IF NOT EXISTS participante_nome TEXT';
    EXECUTE 'ALTER TABLE dev.whatsapp_mensagens ADD COLUMN IF NOT EXISTS participante_phone TEXT';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_grupo_momment ON dev.whatsapp_mensagens (grupo_id, momment DESC) WHERE is_grupo';
  END IF;

  IF to_regclass('dev.atletas') IS NOT NULL AND to_regclass('dev.crm_experiencia') IS NOT NULL THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.whatsapp_grupos (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        grupo_id         TEXT NOT NULL,
        nome             TEXT,
        atleta_id        UUID REFERENCES dev.atletas(id),
        experiencia_id   UUID REFERENCES dev.crm_experiencia(id),
        capturar         BOOLEAN NOT NULL DEFAULT false,
        first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_message_at  TIMESTAMPTZ,
        total_mensagens  INT NOT NULL DEFAULT 0,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at       TIMESTAMPTZ,
        created_by       UUID REFERENCES auth.users(id),
        CONSTRAINT uq_whatsapp_grupos_grupo_id UNIQUE (grupo_id)
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_atleta ON dev.whatsapp_grupos (atleta_id) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_experiencia ON dev.whatsapp_grupos (experiencia_id) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_capturar ON dev.whatsapp_grupos (capturar) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_grupos_last_message ON dev.whatsapp_grupos (last_message_at DESC) WHERE deleted_at IS NULL';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_whatsapp_grupos_updated_at ON dev.whatsapp_grupos';
    EXECUTE 'CREATE TRIGGER trg_whatsapp_grupos_updated_at BEFORE UPDATE ON dev.whatsapp_grupos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_whatsapp_grupos ON dev.whatsapp_grupos';
    EXECUTE 'CREATE TRIGGER trg_audit_whatsapp_grupos AFTER INSERT OR DELETE OR UPDATE OF capturar, atleta_id, experiencia_id ON dev.whatsapp_grupos FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'ALTER TABLE dev.whatsapp_grupos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_grupos_select" ON dev.whatsapp_grupos';
    EXECUTE 'CREATE POLICY "whatsapp_grupos_select" ON dev.whatsapp_grupos FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_grupos_update" ON dev.whatsapp_grupos';
    EXECUTE 'CREATE POLICY "whatsapp_grupos_update" ON dev.whatsapp_grupos FOR UPDATE TO authenticated USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_grupos_service" ON dev.whatsapp_grupos';
    EXECUTE 'CREATE POLICY "whatsapp_grupos_service" ON dev.whatsapp_grupos FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'GRANT SELECT, UPDATE ON dev.whatsapp_grupos TO authenticated';
    EXECUTE 'GRANT ALL ON dev.whatsapp_grupos TO service_role';
  END IF;
END $$;
