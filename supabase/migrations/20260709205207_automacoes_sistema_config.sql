-- ════════════════════════════════════════════════════════════════════════
-- Migration: chaves de config das automações de SISTEMA (editáveis na UI)
-- Aplica em: public, uat, dev (multi-schema, idempotente)
-- ════════════════════════════════════════════════════════════════════════
--
-- Fase 2a das automações de sistema editáveis em /automacoes:
--   • sistema_automacoes_ativas — toggles on/off por automação. Semeada VAZIA:
--     campo ausente = ATIVA (fail-open — comportamento atual). As CFs leem com
--     fallback; desligar exige gravação explícita `"<slug>": false` pela UI.
--   • email_config — config de e-mail do sistema (destino_interno). Vazia:
--     fallback para a env INTERNAL_EMAIL da CF send-messages.
--   • qualificacao_prompt — seções EDITÁVEIS do prompt Gemini de qualificação
--     (persona, critérios QUENTE/MORNO/FRIO, regra de renda variável, regras
--     importantes, variantes de endereço). Vazia: defaults hardcoded da CF
--     qualify-lead (byte-idênticos ao prompt atual). O contrato de saída JSON
--     e o bloco DADOS DO LEAD permanecem fixos no código.
--
-- Semear `{}` (e não os valores) é decisão de segurança: config ausente nunca
-- diverge do comportamento de produção; a UI mostra os defaults do código e só
-- grava overrides.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
  ('sistema_automacoes_ativas', '{}'::jsonb,
   'Toggles on/off das automações de sistema (/automacoes). Campo ausente = ativa (fail-open).'),
  ('email_config', '{}'::jsonb,
   'Config de e-mail do sistema: destino_interno (notificação de novo lead). Ausente = env INTERNAL_EMAIL.'),
  ('qualificacao_prompt', '{}'::jsonb,
   'Seções editáveis do prompt Gemini de qualificação. Campo ausente/vazio = default do código (qualify-lead).')
ON CONFLICT (chave) DO NOTHING;

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO uat.configuracoes_sistema (chave, valor, descricao) VALUES
        ('sistema_automacoes_ativas', '{}'::jsonb,
         'Toggles on/off das automações de sistema (/automacoes). Campo ausente = ativa (fail-open).'),
        ('email_config', '{}'::jsonb,
         'Config de e-mail do sistema: destino_interno (notificação de novo lead). Ausente = env INTERNAL_EMAIL.'),
        ('qualificacao_prompt', '{}'::jsonb,
         'Seções editáveis do prompt Gemini de qualificação. Campo ausente/vazio = default do código (qualify-lead).')
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
        ('sistema_automacoes_ativas', '{}'::jsonb,
         'Toggles on/off das automações de sistema (/automacoes). Campo ausente = ativa (fail-open).'),
        ('email_config', '{}'::jsonb,
         'Config de e-mail do sistema: destino_interno (notificação de novo lead). Ausente = env INTERNAL_EMAIL.'),
        ('qualificacao_prompt', '{}'::jsonb,
         'Seções editáveis do prompt Gemini de qualificação. Campo ausente/vazio = default do código (qualify-lead).')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;
