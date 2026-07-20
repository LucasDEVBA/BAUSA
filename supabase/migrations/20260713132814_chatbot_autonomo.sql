-- ════════════════════════════════════════════════════════════════════════
-- Migration: chatbot AUTÔNOMO de WhatsApp — config + estado por conversa + log
-- Aplica em: public, uat, dev (multi-schema; uat/dev gateados por to_regclass)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   A feature MAIS sensível do sistema: a IA pode RESPONDER leads sozinha.
--   Motor na CF `chatbot-autonomo` (Cloud Scheduler ~2min). NASCE DESLIGADO.
--
--   Três modos GLOBAIS (chave chatbot_autonomo.modo):
--     • off    → a CF não faz NADA (default de nascimento).
--     • sombra → a IA gera um rascunho, o CEO revisa; NUNCA envia ao lead.
--     • ativo  → a IA envia sozinha (único lugar do sistema onde isso ocorre),
--                só em categorias SEGURAS; qualquer dúvida escala ao humano.
--
--   O critério do gate de intenção (chatbot_autonomo_criterio) e a persona
--   (chatbot_persona, já existente) são editáveis; ambos com fail-open p/ o
--   default do código na CF.
--
-- Decisões deliberadas:
--   • chatbot_autonomo_conversa (override por conversa) tem set_updated_at +
--     auditoria SÓ das mudanças do CEO (modo/atleta_id) + INSERT/DELETE — os
--     bumps de alto volume da CF (ultimo_tratado_*, respostas_no_dia) NÃO vão
--     para audit_logs (mesmo racional de whatsapp_grupos).
--   • chatbot_autonomo_log é append-only e É a trilha de auditoria do bot (o
--     que o CEO revisa no modo sombra) — sem updated_at/deleted_at, sem trigger
--     de auditoria (volume alto + conteúdo pessoal, como whatsapp_mensagens).
--   • Leitura/escrita de estado sempre em `public` (a CF hardcoda public, igual
--     zapi-inbox/whatsapp_mensagens); uat/dev recebem a estrutura por
--     consistência de testes isolados.
--
-- Forward-only, idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ────────────────────────────────────────────────────────

-- Config global — NASCE off. Só o CEO muda (pela UI, fase futura).
INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
  ('chatbot_autonomo', '{"modo":"off"}'::jsonb,
   'Chatbot AUTÔNOMO de WhatsApp. modo ∈ off|sombra|ativo. off = a CF não faz nada (default). sombra = gera rascunho p/ o CEO revisar (nunca envia). ativo = a IA responde leads sozinha em categorias seguras (escala dinheiro/negociação/reclamação/humano).')
ON CONFLICT (chave) DO NOTHING;

-- Critério editável do gate de intenção (fail-open p/ default do código na CF).
INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
  ('chatbot_autonomo_criterio', '{}'::jsonb,
   'Prompt do gate de intenção do chatbot autônomo (campo criterio). Vazio/ausente = default do código (fail-open). Define quando a resposta é SEGURA vs. quando ESCALAR ao humano.')
ON CONFLICT (chave) DO NOTHING;

-- Override por conversa: o CEO pode forçar 'ativo'/'desligado' numa conversa
-- específica (senão 'padrao' = segue o modo global). Também guarda a
-- idempotência (ultimo_tratado_message_id) e o loop-guard diário do bot.
CREATE TABLE IF NOT EXISTS public.chatbot_autonomo_conversa (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                       TEXT NOT NULL,                 -- só dígitos, tail-normalizado do lead
  atleta_id                   UUID REFERENCES public.atletas(id),
  modo                        TEXT NOT NULL DEFAULT 'padrao'
                              CHECK (modo IN ('padrao','ativo','desligado')),
  ultimo_tratado_message_id   TEXT,                          -- CAS/idempotência: última msg do lead já tratada
  ultimo_tratado_at           TIMESTAMPTZ,
  respostas_no_dia            INT NOT NULL DEFAULT 0,        -- loop-guard: respostas enviadas hoje
  dia_ref                     DATE,                          -- dia (BRT) de referência do contador
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by                  UUID REFERENCES auth.users(id),
  CONSTRAINT uq_chatbot_autonomo_conversa_phone UNIQUE (phone)  -- índice em phone (lookup por conversa)
);

COMMENT ON TABLE public.chatbot_autonomo_conversa IS 'Estado/override por conversa do chatbot autônomo de WhatsApp. UNIQUE(phone). modo padrao = segue o modo global; ativo/desligado = override do CEO. ultimo_tratado_message_id garante idempotência (não responde 2x a mesma mensagem).';

CREATE INDEX IF NOT EXISTS idx_chatbot_conversa_atleta
  ON public.chatbot_autonomo_conversa (atleta_id) WHERE atleta_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_chatbot_conversa_updated_at ON public.chatbot_autonomo_conversa;
CREATE TRIGGER trg_chatbot_conversa_updated_at BEFORE UPDATE ON public.chatbot_autonomo_conversa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auditoria SÓ das mudanças do CEO (modo/atleta_id) + INSERT/DELETE. Os bumps
-- por tick da CF (ultimo_tratado_*, respostas_no_dia, dia_ref) NÃO disparam
-- audit — alto volume, sem valor de trilha (mesma razão de whatsapp_grupos).
DROP TRIGGER IF EXISTS trg_audit_chatbot_conversa ON public.chatbot_autonomo_conversa;
CREATE TRIGGER trg_audit_chatbot_conversa
  AFTER INSERT OR DELETE OR UPDATE OF modo, atleta_id
  ON public.chatbot_autonomo_conversa
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- RLS: SELECT/INSERT/UPDATE só CEO (cto→ceo). A CF usa service_role.
ALTER TABLE public.chatbot_autonomo_conversa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chatbot_conversa_select" ON public.chatbot_autonomo_conversa;
CREATE POLICY "chatbot_conversa_select" ON public.chatbot_autonomo_conversa
  FOR SELECT TO authenticated USING (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "chatbot_conversa_insert" ON public.chatbot_autonomo_conversa;
CREATE POLICY "chatbot_conversa_insert" ON public.chatbot_autonomo_conversa
  FOR INSERT TO authenticated WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "chatbot_conversa_update" ON public.chatbot_autonomo_conversa;
CREATE POLICY "chatbot_conversa_update" ON public.chatbot_autonomo_conversa
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "chatbot_conversa_service" ON public.chatbot_autonomo_conversa;
CREATE POLICY "chatbot_conversa_service" ON public.chatbot_autonomo_conversa
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Log de auditoria do bot: cada decisão por conversa (o que o CEO revisa na
-- sombra). Append-only. atleta_id SEM FK (o log deve sobreviver a deleção do
-- atleta e registrar leads ainda desconhecidos = sem atleta).
CREATE TABLE IF NOT EXISTS public.chatbot_autonomo_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone             TEXT,
  atleta_id         UUID,
  mensagem_lead     TEXT,                          -- a inbound que disparou (truncada)
  decisao           TEXT NOT NULL
                    CHECK (decisao IN ('respondeu','sombra','escalou','ignorou','erro')),
  categoria         TEXT,
  resposta_gerada   TEXT,
  enviado           BOOLEAN NOT NULL DEFAULT FALSE,
  motivo            TEXT,
  modo_efetivo      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.chatbot_autonomo_log IS 'Trilha de auditoria do chatbot autônomo: 1 linha por decisão (respondeu/sombra/escalou/ignorou/erro). Append-only. enviado=true SÓ quando a IA de fato enviou ao lead (modo ativo).';

CREATE INDEX IF NOT EXISTS idx_chatbot_log_created
  ON public.chatbot_autonomo_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_log_phone_created
  ON public.chatbot_autonomo_log (phone, created_at DESC);

ALTER TABLE public.chatbot_autonomo_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chatbot_log_select" ON public.chatbot_autonomo_log;
CREATE POLICY "chatbot_log_select" ON public.chatbot_autonomo_log
  FOR SELECT TO authenticated USING (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "chatbot_log_service" ON public.chatbot_autonomo_log;
CREATE POLICY "chatbot_log_service" ON public.chatbot_autonomo_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── UAT ─────────────────────────────────────────────────────────────────
-- Gateado por tabela (uat/dev são incompletos): config só se configuracoes_sistema
-- existe; conversa só se atletas existe (a FK quebraria com 42P01 senão); log
-- não tem FK (criado junto p/ consistência quando o schema tem atletas).
DO $$
BEGIN
  IF to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO uat.configuracoes_sistema (chave, valor, descricao) VALUES
        ('chatbot_autonomo', '{"modo":"off"}'::jsonb,
         'Chatbot AUTÔNOMO de WhatsApp. modo ∈ off|sombra|ativo. Nasce off.'),
        ('chatbot_autonomo_criterio', '{}'::jsonb,
         'Prompt do gate de intenção do chatbot autônomo (campo criterio). Vazio = default do código (fail-open).')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;

  IF to_regclass('uat.atletas') IS NOT NULL THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.chatbot_autonomo_conversa (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone                       TEXT NOT NULL,
        atleta_id                   UUID REFERENCES uat.atletas(id),
        modo                        TEXT NOT NULL DEFAULT ''padrao''
                                    CHECK (modo IN (''padrao'',''ativo'',''desligado'')),
        ultimo_tratado_message_id   TEXT,
        ultimo_tratado_at           TIMESTAMPTZ,
        respostas_no_dia            INT NOT NULL DEFAULT 0,
        dia_ref                     DATE,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by                  UUID REFERENCES auth.users(id),
        CONSTRAINT uq_chatbot_autonomo_conversa_phone UNIQUE (phone)
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chatbot_conversa_atleta ON uat.chatbot_autonomo_conversa (atleta_id) WHERE atleta_id IS NOT NULL';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_chatbot_conversa_updated_at ON uat.chatbot_autonomo_conversa';
    EXECUTE 'CREATE TRIGGER trg_chatbot_conversa_updated_at BEFORE UPDATE ON uat.chatbot_autonomo_conversa FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_chatbot_conversa ON uat.chatbot_autonomo_conversa';
    EXECUTE 'CREATE TRIGGER trg_audit_chatbot_conversa AFTER INSERT OR DELETE OR UPDATE OF modo, atleta_id ON uat.chatbot_autonomo_conversa FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'ALTER TABLE uat.chatbot_autonomo_conversa ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "chatbot_conversa_select" ON uat.chatbot_autonomo_conversa';
    EXECUTE 'CREATE POLICY "chatbot_conversa_select" ON uat.chatbot_autonomo_conversa FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "chatbot_conversa_insert" ON uat.chatbot_autonomo_conversa';
    EXECUTE 'CREATE POLICY "chatbot_conversa_insert" ON uat.chatbot_autonomo_conversa FOR INSERT TO authenticated WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "chatbot_conversa_update" ON uat.chatbot_autonomo_conversa';
    EXECUTE 'CREATE POLICY "chatbot_conversa_update" ON uat.chatbot_autonomo_conversa FOR UPDATE TO authenticated USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "chatbot_conversa_service" ON uat.chatbot_autonomo_conversa';
    EXECUTE 'CREATE POLICY "chatbot_conversa_service" ON uat.chatbot_autonomo_conversa FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON uat.chatbot_autonomo_conversa TO authenticated';
    EXECUTE 'GRANT ALL ON uat.chatbot_autonomo_conversa TO service_role';

    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.chatbot_autonomo_log (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone             TEXT,
        atleta_id         UUID,
        mensagem_lead     TEXT,
        decisao           TEXT NOT NULL CHECK (decisao IN (''respondeu'',''sombra'',''escalou'',''ignorou'',''erro'')),
        categoria         TEXT,
        resposta_gerada   TEXT,
        enviado           BOOLEAN NOT NULL DEFAULT FALSE,
        motivo            TEXT,
        modo_efetivo      TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chatbot_log_created ON uat.chatbot_autonomo_log (created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chatbot_log_phone_created ON uat.chatbot_autonomo_log (phone, created_at DESC)';
    EXECUTE 'ALTER TABLE uat.chatbot_autonomo_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "chatbot_log_select" ON uat.chatbot_autonomo_log';
    EXECUTE 'CREATE POLICY "chatbot_log_select" ON uat.chatbot_autonomo_log FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "chatbot_log_service" ON uat.chatbot_autonomo_log';
    EXECUTE 'CREATE POLICY "chatbot_log_service" ON uat.chatbot_autonomo_log FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'GRANT SELECT ON uat.chatbot_autonomo_log TO authenticated';
    EXECUTE 'GRANT ALL ON uat.chatbot_autonomo_log TO service_role';
  END IF;
END $$;

-- ─── DEV ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO dev.configuracoes_sistema (chave, valor, descricao) VALUES
        ('chatbot_autonomo', '{"modo":"off"}'::jsonb,
         'Chatbot AUTÔNOMO de WhatsApp. modo ∈ off|sombra|ativo. Nasce off.'),
        ('chatbot_autonomo_criterio', '{}'::jsonb,
         'Prompt do gate de intenção do chatbot autônomo (campo criterio). Vazio = default do código (fail-open).')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;

  IF to_regclass('dev.atletas') IS NOT NULL THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.chatbot_autonomo_conversa (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone                       TEXT NOT NULL,
        atleta_id                   UUID REFERENCES dev.atletas(id),
        modo                        TEXT NOT NULL DEFAULT ''padrao''
                                    CHECK (modo IN (''padrao'',''ativo'',''desligado'')),
        ultimo_tratado_message_id   TEXT,
        ultimo_tratado_at           TIMESTAMPTZ,
        respostas_no_dia            INT NOT NULL DEFAULT 0,
        dia_ref                     DATE,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by                  UUID REFERENCES auth.users(id),
        CONSTRAINT uq_chatbot_autonomo_conversa_phone UNIQUE (phone)
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chatbot_conversa_atleta ON dev.chatbot_autonomo_conversa (atleta_id) WHERE atleta_id IS NOT NULL';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_chatbot_conversa_updated_at ON dev.chatbot_autonomo_conversa';
    EXECUTE 'CREATE TRIGGER trg_chatbot_conversa_updated_at BEFORE UPDATE ON dev.chatbot_autonomo_conversa FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_chatbot_conversa ON dev.chatbot_autonomo_conversa';
    EXECUTE 'CREATE TRIGGER trg_audit_chatbot_conversa AFTER INSERT OR DELETE OR UPDATE OF modo, atleta_id ON dev.chatbot_autonomo_conversa FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'ALTER TABLE dev.chatbot_autonomo_conversa ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "chatbot_conversa_select" ON dev.chatbot_autonomo_conversa';
    EXECUTE 'CREATE POLICY "chatbot_conversa_select" ON dev.chatbot_autonomo_conversa FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "chatbot_conversa_insert" ON dev.chatbot_autonomo_conversa';
    EXECUTE 'CREATE POLICY "chatbot_conversa_insert" ON dev.chatbot_autonomo_conversa FOR INSERT TO authenticated WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "chatbot_conversa_update" ON dev.chatbot_autonomo_conversa';
    EXECUTE 'CREATE POLICY "chatbot_conversa_update" ON dev.chatbot_autonomo_conversa FOR UPDATE TO authenticated USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "chatbot_conversa_service" ON dev.chatbot_autonomo_conversa';
    EXECUTE 'CREATE POLICY "chatbot_conversa_service" ON dev.chatbot_autonomo_conversa FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON dev.chatbot_autonomo_conversa TO authenticated';
    EXECUTE 'GRANT ALL ON dev.chatbot_autonomo_conversa TO service_role';

    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.chatbot_autonomo_log (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone             TEXT,
        atleta_id         UUID,
        mensagem_lead     TEXT,
        decisao           TEXT NOT NULL CHECK (decisao IN (''respondeu'',''sombra'',''escalou'',''ignorou'',''erro'')),
        categoria         TEXT,
        resposta_gerada   TEXT,
        enviado           BOOLEAN NOT NULL DEFAULT FALSE,
        motivo            TEXT,
        modo_efetivo      TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chatbot_log_created ON dev.chatbot_autonomo_log (created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chatbot_log_phone_created ON dev.chatbot_autonomo_log (phone, created_at DESC)';
    EXECUTE 'ALTER TABLE dev.chatbot_autonomo_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "chatbot_log_select" ON dev.chatbot_autonomo_log';
    EXECUTE 'CREATE POLICY "chatbot_log_select" ON dev.chatbot_autonomo_log FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "chatbot_log_service" ON dev.chatbot_autonomo_log';
    EXECUTE 'CREATE POLICY "chatbot_log_service" ON dev.chatbot_autonomo_log FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'GRANT SELECT ON dev.chatbot_autonomo_log TO authenticated';
    EXECUTE 'GRANT ALL ON dev.chatbot_autonomo_log TO service_role';
  END IF;
END $$;
