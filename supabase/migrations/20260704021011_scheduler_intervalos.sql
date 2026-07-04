-- ════════════════════════════════════════════════════════════════════════════
-- Migration: scheduler_intervalos — intervalos REAIS dos schedulers de WhatsApp
--            editáveis pelo CEO em /automacoes           | public, uat, dev
-- Contexto: a tela de Automações passa a exibir as automações NATIVAS do
--   sistema e permite editar seus intervalos. As CFs process-pending-whatsapp
--   e process-followup-whatsapp deixam de hardcodar 22h/48h/48h/168h e leem
--   esta chave (com fallback nos defaults e clamp 1h–720h — invariante de CI).
--   A chave existente `timers_automacao` NÃO é reusada: suas chaves não batem
--   com a semântica real dos schedulers (ex.: followup_horas=24 vs FU1=48h).
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
('scheduler_intervalos', '{
  "whatsapp_inicial_horas": 22,
  "whatsapp_timing_alt_horas": 48,
  "followup_1_horas": 48,
  "followup_2_horas": 168
}', 'Intervalos reais dos schedulers de WhatsApp (inicial, timing alternativo, follow-ups). Clamp 1h-720h aplicado nas CFs.')
ON CONFLICT (chave) DO NOTHING;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE 'INSERT INTO uat.configuracoes_sistema (chave, valor, descricao) VALUES
      (''scheduler_intervalos'', ''{
        "whatsapp_inicial_horas": 22,
        "whatsapp_timing_alt_horas": 48,
        "followup_1_horas": 48,
        "followup_2_horas": 168
      }'', ''Intervalos reais dos schedulers de WhatsApp (inicial, timing alternativo, follow-ups). Clamp 1h-720h aplicado nas CFs.'')
      ON CONFLICT (chave) DO NOTHING';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE 'INSERT INTO dev.configuracoes_sistema (chave, valor, descricao) VALUES
      (''scheduler_intervalos'', ''{
        "whatsapp_inicial_horas": 22,
        "whatsapp_timing_alt_horas": 48,
        "followup_1_horas": 48,
        "followup_2_horas": 168
      }'', ''Intervalos reais dos schedulers de WhatsApp (inicial, timing alternativo, follow-ups). Clamp 1h-720h aplicado nas CFs.'')
      ON CONFLICT (chave) DO NOTHING';
  END IF;
END $$;
