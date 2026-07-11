-- ════════════════════════════════════════════════════════════════════════
-- Migration: experiencia-scheduler (pós-venda) | Aplica em public, uat, dev
-- Contexto: CF experiencia-scheduler (Cloud Scheduler diário 10:00 BRT):
--   • Check 1 — pesquisa NPS aos 6 meses (WhatsApp à família, CAS por
--     nps_enviado_at já existente). Texto editável em nps_mensagem.
--   • Check 2 — alerta ativo de inatividade: cooldown de 7 dias por família
--     via coluna NOVA ultimo_alerta_inatividade_at (CAS).
--
--   1. crm_experiencia.ultimo_alerta_inatividade_at TIMESTAMPTZ — quando o
--      último alerta de inatividade foi emitido (notificação + tarefa).
--   2. CHECK de nps_6meses relaxado de 1..10 para 0..10 — a escala NPS é
--      0–10 (a pesquisa pergunta "de 0 a 10"); o CHECK original impedia
--      registrar nota 0 (detrator máximo). Aditivo: amplia o domínio, nenhuma
--      linha existente viola.
--   3. Seed nps_mensagem = {} — campo `texto` ausente/vazio = default do
--      código da CF (fail-open, padrão das demais configs de sistema).
--      Toggles (nps_automatico/alerta_inatividade) NÃO precisam de seed:
--      vivem em sistema_automacoes_ativas (ausente = ativa).
--
-- uat/dev gateados por to_regclass (crm_experiencia pode não existir lá).
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
ALTER TABLE public.crm_experiencia
  ADD COLUMN IF NOT EXISTS ultimo_alerta_inatividade_at TIMESTAMPTZ;

COMMENT ON COLUMN public.crm_experiencia.ultimo_alerta_inatividade_at IS
  'Último alerta ativo de inatividade emitido (CF experiencia-scheduler; cooldown 7 dias).';

-- NPS é 0–10 (o CHECK original 1..10 impedia a nota 0 — detrator máximo)
ALTER TABLE public.crm_experiencia
  DROP CONSTRAINT IF EXISTS crm_experiencia_nps_6meses_check;
ALTER TABLE public.crm_experiencia
  ADD CONSTRAINT crm_experiencia_nps_6meses_check
  CHECK (nps_6meses >= 0 AND nps_6meses <= 10);

INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
  ('nps_mensagem', '{}'::jsonb,
   'Texto do WhatsApp da pesquisa NPS aos 6 meses (campo texto; placeholders {{responsavel}}/{{atleta}}). Ausente/vazio = default do código (experiencia-scheduler).')
ON CONFLICT (chave) DO NOTHING;

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.crm_experiencia') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.crm_experiencia ADD COLUMN IF NOT EXISTS ultimo_alerta_inatividade_at TIMESTAMPTZ';
    EXECUTE 'ALTER TABLE uat.crm_experiencia DROP CONSTRAINT IF EXISTS crm_experiencia_nps_6meses_check';
    EXECUTE 'ALTER TABLE uat.crm_experiencia ADD CONSTRAINT crm_experiencia_nps_6meses_check CHECK (nps_6meses >= 0 AND nps_6meses <= 10)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO uat.configuracoes_sistema (chave, valor, descricao) VALUES
        ('nps_mensagem', '{}'::jsonb,
         'Texto do WhatsApp da pesquisa NPS aos 6 meses (campo texto; placeholders {{responsavel}}/{{atleta}}). Ausente/vazio = default do código (experiencia-scheduler).')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.crm_experiencia') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.crm_experiencia ADD COLUMN IF NOT EXISTS ultimo_alerta_inatividade_at TIMESTAMPTZ';
    EXECUTE 'ALTER TABLE dev.crm_experiencia DROP CONSTRAINT IF EXISTS crm_experiencia_nps_6meses_check';
    EXECUTE 'ALTER TABLE dev.crm_experiencia ADD CONSTRAINT crm_experiencia_nps_6meses_check CHECK (nps_6meses >= 0 AND nps_6meses <= 10)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO dev.configuracoes_sistema (chave, valor, descricao) VALUES
        ('nps_mensagem', '{}'::jsonb,
         'Texto do WhatsApp da pesquisa NPS aos 6 meses (campo texto; placeholders {{responsavel}}/{{atleta}}). Ausente/vazio = default do código (experiencia-scheduler).')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;
