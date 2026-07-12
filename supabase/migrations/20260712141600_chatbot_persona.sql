-- ════════════════════════════════════════════════════════════════════════
-- Migration: chave de config da PERSONA do chatbot assistido (WhatsApp)
-- Aplica em: public, uat, dev (idempotente)
-- ════════════════════════════════════════════════════════════════════════
--
-- Chatbot v1 ASSISTIDO: a IA SUGERE uma resposta; o humano revisa e envia
-- (nunca envia sozinho). A server action sugerirRespostaChatbot lê o campo
-- `persona` desta chave com fallback no default do código
-- (apps/crm/src/lib/automacoes/chatbot-persona.ts).
--
-- Semeada VAZIA: ausente/vazio = default do código (fail-open, padrão das
-- demais chaves de sistema). Ainda não há UI de edição (fase futura) — a chave
-- é criada agora para editabilidade posterior sem nova migration.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
  ('chatbot_persona', '{}'::jsonb,
   'Persona do chatbot assistido de WhatsApp. Campo persona ausente/vazio = default do código.')
ON CONFLICT (chave) DO NOTHING;

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO uat.configuracoes_sistema (chave, valor, descricao) VALUES
        ('chatbot_persona', '{}'::jsonb,
         'Persona do chatbot assistido de WhatsApp. Campo persona ausente/vazio = default do código.')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO dev.configuracoes_sistema (chave, valor, descricao) VALUES
        ('chatbot_persona', '{}'::jsonb,
         'Persona do chatbot assistido de WhatsApp. Campo persona ausente/vazio = default do código.')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;
