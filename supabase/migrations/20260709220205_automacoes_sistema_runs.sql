-- ════════════════════════════════════════════════════════════════════════
-- Migration: âncoras das automações de SISTEMA em `automacoes` (Fase 2b)
-- Aplica em: public, uat, dev (idempotente, forward-only)
-- ════════════════════════════════════════════════════════════════════════
--
-- As CFs de sistema passam a REGISTRAR cada execução em `automacao_runs`
-- (aba Execuções de /automacoes). A FK automacao_runs.automacao_id é NOT NULL
-- → cada automação de sistema ganha uma linha-ÂNCORA em `automacoes`:
--
--   • gatilho = 'sistema' (valor NOVO no CHECK): a engine não materializa
--     (TIME_TRIGGER_FINDERS não conhece 'sistema') e o trigger de evento do
--     banco não dispara para ele.
--   • ativo = FALSE sempre: fora do fetch de automações ativas da engine.
--   • IDs FIXOS (versionados aqui e hardcoded nas CFs — guard de CI
--     tests/automacao-runs-sistema.test.js compara os dois lados).
--
-- SEGURANÇA DA ENGINE: os runs de sistema nascem SEMPRE em estado terminal
-- ('sucesso'/'erro' com proxima_tentativa_at NULL e tentativas=1) — nunca
-- entram na fila (que seleciona pendente/erro-com-retry/executando). O replay
-- manual (reprocessarRun) é bloqueado para gatilho='sistema' na action.
-- ════════════════════════════════════════════════════════════════════════

-- ─── CHECK do gatilho ganha 'sistema' (padrão do 20260704041917) ───
ALTER TABLE public.automacoes DROP CONSTRAINT IF EXISTS automacoes_gatilho_check;
ALTER TABLE public.automacoes ADD CONSTRAINT automacoes_gatilho_check CHECK (gatilho IN (
  'lead_qualificado', 'deal_etapa_mudou', 'reuniao_marcada', 'temperatura_vermelha',
  'deal_parado_etapa', 'parcela_vencendo', 'parcela_atrasada',
  'familia_sem_contato', 'tarefa_vencida', 'agendamento', 'sistema'
));

-- ─── Âncoras (IDs fixos — NÃO alterar; as CFs os referenciam) ───
INSERT INTO public.automacoes (id, nome, descricao, gatilho, ativo) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'WhatsApp inicial (sistema)',
   'Execuções do convite de agendamento pós-qualificação (scheduler).', 'sistema', FALSE),
  ('a0000000-0000-4000-8000-000000000002', 'WhatsApp timing alternativo (sistema)',
   'Execuções das mensagens early_potential/late_timing (scheduler).', 'sistema', FALSE),
  ('a0000000-0000-4000-8000-000000000003', 'Follow-up 1 (sistema)',
   'Execuções do primeiro follow-up (scheduler).', 'sistema', FALSE),
  ('a0000000-0000-4000-8000-000000000004', 'Follow-up 2 (sistema)',
   'Execuções do segundo follow-up (scheduler).', 'sistema', FALSE),
  ('a0000000-0000-4000-8000-000000000005', 'Retomada de novembro (sistema)',
   'Execuções do scheduled_return para leads muito cedo.', 'sistema', FALSE),
  ('a0000000-0000-4000-8000-000000000006', 'Qualificação Gemini (sistema)',
   'Execuções da classificação de leads (QUENTE/MORNO/FRIO).', 'sistema', FALSE),
  ('a0000000-0000-4000-8000-000000000007', 'Confirmação de reunião (sistema)',
   'Execuções das notificações de reunião (webhook Calendar).', 'sistema', FALSE),
  ('a0000000-0000-4000-8000-000000000008', 'E-mails de confirmação (sistema)',
   'Execuções dos e-mails automáticos (Resend/Brevo).', 'sistema', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.automacoes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.automacoes DROP CONSTRAINT IF EXISTS automacoes_gatilho_check';
    EXECUTE 'ALTER TABLE uat.automacoes ADD CONSTRAINT automacoes_gatilho_check CHECK (gatilho IN (
      ''lead_qualificado'', ''deal_etapa_mudou'', ''reuniao_marcada'', ''temperatura_vermelha'',
      ''deal_parado_etapa'', ''parcela_vencendo'', ''parcela_atrasada'',
      ''familia_sem_contato'', ''tarefa_vencida'', ''agendamento'', ''sistema''
    ))';
    EXECUTE $sql$
      INSERT INTO uat.automacoes (id, nome, descricao, gatilho, ativo) VALUES
        ('a0000000-0000-4000-8000-000000000001', 'WhatsApp inicial (sistema)',
         'Execuções do convite de agendamento pós-qualificação (scheduler).', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000002', 'WhatsApp timing alternativo (sistema)',
         'Execuções das mensagens early_potential/late_timing (scheduler).', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000003', 'Follow-up 1 (sistema)',
         'Execuções do primeiro follow-up (scheduler).', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000004', 'Follow-up 2 (sistema)',
         'Execuções do segundo follow-up (scheduler).', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000005', 'Retomada de novembro (sistema)',
         'Execuções do scheduled_return para leads muito cedo.', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000006', 'Qualificação Gemini (sistema)',
         'Execuções da classificação de leads (QUENTE/MORNO/FRIO).', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000007', 'Confirmação de reunião (sistema)',
         'Execuções das notificações de reunião (webhook Calendar).', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000008', 'E-mails de confirmação (sistema)',
         'Execuções dos e-mails automáticos (Resend/Brevo).', 'sistema', FALSE)
      ON CONFLICT (id) DO NOTHING
    $sql$;
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.automacoes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.automacoes DROP CONSTRAINT IF EXISTS automacoes_gatilho_check';
    EXECUTE 'ALTER TABLE dev.automacoes ADD CONSTRAINT automacoes_gatilho_check CHECK (gatilho IN (
      ''lead_qualificado'', ''deal_etapa_mudou'', ''reuniao_marcada'', ''temperatura_vermelha'',
      ''deal_parado_etapa'', ''parcela_vencendo'', ''parcela_atrasada'',
      ''familia_sem_contato'', ''tarefa_vencida'', ''agendamento'', ''sistema''
    ))';
    EXECUTE $sql$
      INSERT INTO dev.automacoes (id, nome, descricao, gatilho, ativo) VALUES
        ('a0000000-0000-4000-8000-000000000001', 'WhatsApp inicial (sistema)',
         'Execuções do convite de agendamento pós-qualificação (scheduler).', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000002', 'WhatsApp timing alternativo (sistema)',
         'Execuções das mensagens early_potential/late_timing (scheduler).', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000003', 'Follow-up 1 (sistema)',
         'Execuções do primeiro follow-up (scheduler).', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000004', 'Follow-up 2 (sistema)',
         'Execuções do segundo follow-up (scheduler).', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000005', 'Retomada de novembro (sistema)',
         'Execuções do scheduled_return para leads muito cedo.', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000006', 'Qualificação Gemini (sistema)',
         'Execuções da classificação de leads (QUENTE/MORNO/FRIO).', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000007', 'Confirmação de reunião (sistema)',
         'Execuções das notificações de reunião (webhook Calendar).', 'sistema', FALSE),
        ('a0000000-0000-4000-8000-000000000008', 'E-mails de confirmação (sistema)',
         'Execuções dos e-mails automáticos (Resend/Brevo).', 'sistema', FALSE)
      ON CONFLICT (id) DO NOTHING
    $sql$;
  END IF;
END $$;
