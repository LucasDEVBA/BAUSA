-- ════════════════════════════════════════════════════════════════════════
-- Migration: chatbot autônomo — agent CUSTOM por conversa (agent_id)
-- Aplica em: public, uat, dev (multi-schema; uat/dev gateados por to_regclass)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto (F5-PR2 da Plataforma de Agents):
--   O CEO pode apontar UM agent custom (capacidade `chatbot_autonomo`) para
--   uma conversa específica: o prompt do agent SUBSTITUI a persona da CF
--   `chatbot-autonomo` naquela conversa. O CRITÉRIO de segurança segue GLOBAL
--   e intocável — o agent muda COMO o bot fala, nunca QUANDO pode falar.
--   Agent ausente/inativo/deletado/sem a capacidade → a CF cai na persona
--   padrão (fallback SEMPRE vivo; o tick nunca quebra por agent).
--
-- Decisões deliberadas:
--   • FK para agents(id) SEM ON DELETE: agents nunca sofrem DELETE físico
--     (exclusão é soft, deleted_at) — a FK só garante integridade do UUID.
--   • O audit trigger é RECRIADO incluindo agent_id na lista UPDATE OF:
--     apontar/remover agent é decisão do CEO (trilha), enquanto os bumps de
--     alto volume da CF (ultimo_tratado_*, respostas_no_dia) seguem fora.
--   • uat/dev gateados por to_regclass das DUAS tabelas (conversa + agents):
--     a FK exige ambas — schema incompleto não pode quebrar o deploy (42P01).
--
-- Forward-only, idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ────────────────────────────────────────────────────────

ALTER TABLE public.chatbot_autonomo_conversa
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.agents(id);

COMMENT ON COLUMN public.chatbot_autonomo_conversa.agent_id IS 'Agent CUSTOM (capacidade chatbot_autonomo) que substitui a PERSONA do bot nesta conversa. NULL = persona padrão. O critério de segurança é GLOBAL — o agent nunca o substitui. Agent inativo/deletado → a CF cai na persona padrão (fallback).';

-- Auditoria: recria o trigger incluindo agent_id (mudança do CEO = trilha;
-- bumps por tick da CF continuam FORA do audit — mesma razão da migration
-- 20260713132814).
DROP TRIGGER IF EXISTS trg_audit_chatbot_conversa ON public.chatbot_autonomo_conversa;
CREATE TRIGGER trg_audit_chatbot_conversa
  AFTER INSERT OR DELETE OR UPDATE OF modo, atleta_id, agent_id
  ON public.chatbot_autonomo_conversa
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- ─── UAT ─────────────────────────────────────────────────────────────────
-- Gateado pelas DUAS tabelas: a FK agent_id → uat.agents exige ambas.
DO $$
BEGIN
  IF to_regclass('uat.chatbot_autonomo_conversa') IS NOT NULL
     AND to_regclass('uat.agents') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.chatbot_autonomo_conversa ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES uat.agents(id)';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_chatbot_conversa ON uat.chatbot_autonomo_conversa';
    EXECUTE 'CREATE TRIGGER trg_audit_chatbot_conversa AFTER INSERT OR DELETE OR UPDATE OF modo, atleta_id, agent_id ON uat.chatbot_autonomo_conversa FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
  END IF;
END $$;

-- ─── DEV ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('dev.chatbot_autonomo_conversa') IS NOT NULL
     AND to_regclass('dev.agents') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.chatbot_autonomo_conversa ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES dev.agents(id)';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_chatbot_conversa ON dev.chatbot_autonomo_conversa';
    EXECUTE 'CREATE TRIGGER trg_audit_chatbot_conversa AFTER INSERT OR DELETE OR UPDATE OF modo, atleta_id, agent_id ON dev.chatbot_autonomo_conversa FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
  END IF;
END $$;
