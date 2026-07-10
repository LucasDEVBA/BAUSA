-- ════════════════════════════════════════════════════════════════════════
-- Migration: chaves de config dos prompts de IA — Resumo de Transcrição e
-- Insights de CAC  | Aplica em: public, uat, dev (idempotente)
-- ════════════════════════════════════════════════════════════════════════
--
-- Todas as automações de IA passam a ser editáveis em /automacoes:
--  • transcricao_resumo_prompt — instruções do resumo Gemini das transcrições
--    do Meet (CF meeting-transcripts lê de PUBLIC, fail-open p/ o default).
--  • cac_insights_prompt — instruções dos Insights de IA da tela de CAC
--    (server action gerarInsightsCac).
-- Semeadas VAZIAS: campo `instrucoes` ausente/vazio = default do código
-- (fail-open, mesmo padrão de insights_conversa_prompt).
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
  ('transcricao_resumo_prompt', '{}'::jsonb,
   'Instruções do resumo Gemini das transcrições de reunião (CF meeting-transcripts). Campo instrucoes ausente/vazio = default do código.'),
  ('cac_insights_prompt', '{}'::jsonb,
   'Instruções dos Insights de IA do CAC. Campo instrucoes ausente/vazio = default do código.')
ON CONFLICT (chave) DO NOTHING;

-- ─── UAT ───
DO $$ BEGIN
  IF to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO uat.configuracoes_sistema (chave, valor, descricao) VALUES
        ('transcricao_resumo_prompt', '{}'::jsonb,
         'Instruções do resumo Gemini das transcrições de reunião (CF meeting-transcripts). Campo instrucoes ausente/vazio = default do código.'),
        ('cac_insights_prompt', '{}'::jsonb,
         'Instruções dos Insights de IA do CAC. Campo instrucoes ausente/vazio = default do código.')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO dev.configuracoes_sistema (chave, valor, descricao) VALUES
        ('transcricao_resumo_prompt', '{}'::jsonb,
         'Instruções do resumo Gemini das transcrições de reunião (CF meeting-transcripts). Campo instrucoes ausente/vazio = default do código.'),
        ('cac_insights_prompt', '{}'::jsonb,
         'Instruções dos Insights de IA do CAC. Campo instrucoes ausente/vazio = default do código.')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;
