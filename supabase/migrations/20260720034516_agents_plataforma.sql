-- ════════════════════════════════════════════════════════════════════════
-- Migration: plataforma de Agents — agents CUSTOM criados pelo CEO
-- Aplica em: public, uat, dev (multi-schema; uat/dev gateados por to_regclass)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   O hub /agents ganha a seção "Seus agents": o CEO cria agents próprios
--   (nome + prompt + capacidades) que plugam nas superfícies de IA do Engine:
--     • conversa          → copiloto selecionável na sugestão de resposta
--                           do WhatsApp (1:1 e grupo) — substitui SÓ a persona;
--                           o restante do prompt continua fixo no código.
--     • analise           → analista sob demanda (análise INTERNA da conversa;
--                           nunca gera mensagem para enviar ao lead).
--     • automacao         → reservada p/ integração com o builder (PR2).
--     • chatbot_autonomo  → reservada p/ o copiloto autônomo (PR2; sensível).
--
-- Decisões deliberadas:
--   • SEM índice GIN em capacidades — a tabela é minúscula (dezenas de linhas,
--     no máximo); um seq scan é mais barato que manter o índice.
--   • SEM seed — os agents NATIVOS do sistema continuam nas chaves de
--     configuracoes_sistema (chatbot_persona, *_prompt etc.); esta tabela é
--     só dos agents CUSTOM do CEO.
--   • Auditoria COMPLETA (AFTER INSERT OR DELETE OR UPDATE, audit.log_change):
--     tudo aqui é edição manual do CEO, baixo volume — trilha integral.
--   • Soft delete (deleted_at) — SEM policy de DELETE: a exclusão é um UPDATE
--     {deleted_at, ativo=false} coberto pela policy de UPDATE do CEO.
--   • SELECT também para head_sucesso: o Head usa o copiloto de grupo e
--     precisa listar os agents de conversa. Escrita é CEO-only.
--
-- Forward-only, idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT NOT NULL CHECK (char_length(nome) BETWEEN 3 AND 120),
  descricao    TEXT CHECK (descricao IS NULL OR char_length(descricao) <= 500),
  prompt       TEXT NOT NULL CHECK (char_length(prompt) BETWEEN 10 AND 4000),
  capacidades  TEXT[] NOT NULL CHECK (
    capacidades <@ ARRAY['conversa','automacao','analise','chatbot_autonomo']::text[]
    AND cardinality(capacidades) >= 1
  ),
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.agents IS 'Agents de IA CUSTOM criados pelo CEO (hub /agents, seção "Seus agents"). capacidades ⊆ {conversa, automacao, analise, chatbot_autonomo}. Soft delete via deleted_at (sem DELETE físico). Os agents nativos seguem em configuracoes_sistema.';

DROP TRIGGER IF EXISTS trg_agents_updated_at ON public.agents;
CREATE TRIGGER trg_agents_updated_at BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auditoria completa: tudo é edição do CEO (baixo volume) — trilha integral.
DROP TRIGGER IF EXISTS trg_audit_agents ON public.agents;
CREATE TRIGGER trg_audit_agents AFTER INSERT OR DELETE OR UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- RLS: SELECT ceo+head (o Head usa o copiloto de grupo); escrita SÓ ceo
-- (cto→ceo via get_user_papel()); service_role integral. SEM policy de DELETE
-- (soft delete = UPDATE).
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agents_select" ON public.agents;
CREATE POLICY "agents_select" ON public.agents
  FOR SELECT TO authenticated
  USING (public.get_user_papel() IN ('ceo', 'head_sucesso'));

DROP POLICY IF EXISTS "agents_insert" ON public.agents;
CREATE POLICY "agents_insert" ON public.agents
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "agents_update" ON public.agents;
CREATE POLICY "agents_update" ON public.agents
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "agents_service" ON public.agents;
CREATE POLICY "agents_service" ON public.agents
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── UAT ─────────────────────────────────────────────────────────────────
-- Gateado por tabela (uat/dev são incompletos): agents só se o schema tem a
-- base do CRM (configuracoes_sistema) — a tabela não tem FK por schema, mas o
-- gate evita criar estrutura órfã num schema sem o restante do Engine.
DO $$
BEGIN
  IF to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.agents (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome         TEXT NOT NULL CHECK (char_length(nome) BETWEEN 3 AND 120),
        descricao    TEXT CHECK (descricao IS NULL OR char_length(descricao) <= 500),
        prompt       TEXT NOT NULL CHECK (char_length(prompt) BETWEEN 10 AND 4000),
        capacidades  TEXT[] NOT NULL CHECK (
          capacidades <@ ARRAY[''conversa'',''automacao'',''analise'',''chatbot_autonomo'']::text[]
          AND cardinality(capacidades) >= 1
        ),
        ativo        BOOLEAN NOT NULL DEFAULT TRUE,
        deleted_at   TIMESTAMPTZ,
        created_by   UUID REFERENCES auth.users(id),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_agents_updated_at ON uat.agents';
    EXECUTE 'CREATE TRIGGER trg_agents_updated_at BEFORE UPDATE ON uat.agents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_agents ON uat.agents';
    EXECUTE 'CREATE TRIGGER trg_audit_agents AFTER INSERT OR DELETE OR UPDATE ON uat.agents FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'ALTER TABLE uat.agents ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "agents_select" ON uat.agents';
    EXECUTE 'CREATE POLICY "agents_select" ON uat.agents FOR SELECT TO authenticated USING (public.get_user_papel() IN (''ceo'', ''head_sucesso''))';
    EXECUTE 'DROP POLICY IF EXISTS "agents_insert" ON uat.agents';
    EXECUTE 'CREATE POLICY "agents_insert" ON uat.agents FOR INSERT TO authenticated WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "agents_update" ON uat.agents';
    EXECUTE 'CREATE POLICY "agents_update" ON uat.agents FOR UPDATE TO authenticated USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "agents_service" ON uat.agents';
    EXECUTE 'CREATE POLICY "agents_service" ON uat.agents FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON uat.agents TO authenticated';
    EXECUTE 'GRANT ALL ON uat.agents TO service_role';
  END IF;
END $$;

-- ─── DEV ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.agents (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome         TEXT NOT NULL CHECK (char_length(nome) BETWEEN 3 AND 120),
        descricao    TEXT CHECK (descricao IS NULL OR char_length(descricao) <= 500),
        prompt       TEXT NOT NULL CHECK (char_length(prompt) BETWEEN 10 AND 4000),
        capacidades  TEXT[] NOT NULL CHECK (
          capacidades <@ ARRAY[''conversa'',''automacao'',''analise'',''chatbot_autonomo'']::text[]
          AND cardinality(capacidades) >= 1
        ),
        ativo        BOOLEAN NOT NULL DEFAULT TRUE,
        deleted_at   TIMESTAMPTZ,
        created_by   UUID REFERENCES auth.users(id),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_agents_updated_at ON dev.agents';
    EXECUTE 'CREATE TRIGGER trg_agents_updated_at BEFORE UPDATE ON dev.agents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_agents ON dev.agents';
    EXECUTE 'CREATE TRIGGER trg_audit_agents AFTER INSERT OR DELETE OR UPDATE ON dev.agents FOR EACH ROW EXECUTE FUNCTION audit.log_change()';
    EXECUTE 'ALTER TABLE dev.agents ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "agents_select" ON dev.agents';
    EXECUTE 'CREATE POLICY "agents_select" ON dev.agents FOR SELECT TO authenticated USING (public.get_user_papel() IN (''ceo'', ''head_sucesso''))';
    EXECUTE 'DROP POLICY IF EXISTS "agents_insert" ON dev.agents';
    EXECUTE 'CREATE POLICY "agents_insert" ON dev.agents FOR INSERT TO authenticated WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "agents_update" ON dev.agents';
    EXECUTE 'CREATE POLICY "agents_update" ON dev.agents FOR UPDATE TO authenticated USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "agents_service" ON dev.agents';
    EXECUTE 'CREATE POLICY "agents_service" ON dev.agents FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON dev.agents TO authenticated';
    EXECUTE 'GRANT ALL ON dev.agents TO service_role';
  END IF;
END $$;
