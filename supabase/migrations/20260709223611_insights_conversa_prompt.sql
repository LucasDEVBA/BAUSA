-- ════════════════════════════════════════════════════════════════════════
-- Migration: chave de config do prompt de Insights de Conversa (WhatsApp)
-- Aplica em: public, uat, dev (idempotente)
-- ════════════════════════════════════════════════════════════════════════
--
-- Insights de IA na conversa do espelho WhatsApp (sob demanda, CEO): a server
-- action gerarInsightsConversa lê `instrucoes` desta chave com fallback no
-- default do código (apps/crm/src/lib/automacoes/insights-conversa-prompt.ts).
-- Editável em /automacoes (card "Insights de IA"). Semeada VAZIA: ausente/
-- vazio = default do código (fail-open, padrão das demais chaves de sistema).
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
  ('insights_conversa_prompt', '{}'::jsonb,
   'Instruções do prompt de Insights de Conversa (WhatsApp). Campo instrucoes ausente/vazio = default do código.')
ON CONFLICT (chave) DO NOTHING;

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO uat.configuracoes_sistema (chave, valor, descricao) VALUES
        ('insights_conversa_prompt', '{}'::jsonb,
         'Instruções do prompt de Insights de Conversa (WhatsApp). Campo instrucoes ausente/vazio = default do código.')
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
        ('insights_conversa_prompt', '{}'::jsonb,
         'Instruções do prompt de Insights de Conversa (WhatsApp). Campo instrucoes ausente/vazio = default do código.')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;
