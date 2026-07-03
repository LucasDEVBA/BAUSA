-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Automações — builder + runs (Fase A)          | public, uat, dev
-- Contexto: feature de criação de automações no BAU Engine (fluxo gatilho →
--   condições → ações) com execução real e acompanhamento por run.
--   Fase A = tabelas + RLS + audit + materialização de eventos (triggers leves).
--   A engine (Cloud Function `automation-engine`, Fase B) processa os runs
--   'pendente' com CAS e avalia gatilhos de tempo (parcela, inatividade...).
-- Gatilhos (TEXT + CHECK, sem enum novo — regra da skill):
--   evento:  lead_qualificado · deal_etapa_mudou · reuniao_marcada ·
--            temperatura_vermelha
--   tempo:   deal_parado_etapa · parcela_vencendo · parcela_atrasada ·
--            familia_sem_contato · tarefa_vencida   (avaliados pela engine)
-- Ações (validadas na aplicação/Zod): criar_tarefa · criar_notificacao ·
--   enviar_whatsapp · mover_deal
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── PUBLIC (PRD) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.automacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  descricao       TEXT,
  gatilho         TEXT NOT NULL CHECK (gatilho IN (
    'lead_qualificado', 'deal_etapa_mudou', 'reuniao_marcada', 'temperatura_vermelha',
    'deal_parado_etapa', 'parcela_vencendo', 'parcela_atrasada',
    'familia_sem_contato', 'tarefa_vencida'
  )),
  -- Parâmetros do gatilho (ex.: {"etapa_para":"reuniao_marcada"} | {"dias":3})
  gatilho_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Condições: array de {campo, operador, valor} — avaliadas pela engine
  condicoes       JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Ações: array de {tipo, parametros} — validação estrutural na aplicação (Zod)
  acoes           JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Nasce pausada: ativar é decisão explícita do CEO (segurança)
  ativo           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.automacao_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automacao_id          UUID NOT NULL REFERENCES public.automacoes(id),
  status                TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN (
    'pendente', 'executando', 'sucesso', 'erro', 'ignorado'
  )),
  -- Origem do disparo (registro que causou o evento)
  gatilho_origem_tabela TEXT,
  gatilho_origem_id     UUID,
  -- Snapshot do payload do evento (etapa_de/etapa_para, temperatura, etc.)
  contexto              JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Resultado da execução: {acoes_realizadas:[...], erros:[...]}
  resultado             JSONB NOT NULL DEFAULT '{}'::jsonb,
  tentativas            INTEGER NOT NULL DEFAULT 0,
  proxima_tentativa_at  TIMESTAMPTZ,
  executado_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rastreabilidade fim-a-fim: tarefa/notificação sabem qual run as criou
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS automacao_run_id UUID REFERENCES public.automacao_runs(id);
ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS automacao_run_id UUID REFERENCES public.automacao_runs(id);

-- updated_at automático
DROP TRIGGER IF EXISTS trg_automacoes_updated_at ON public.automacoes;
CREATE TRIGGER trg_automacoes_updated_at BEFORE UPDATE ON public.automacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_automacao_runs_updated_at ON public.automacao_runs;
CREATE TRIGGER trg_automacao_runs_updated_at BEFORE UPDATE ON public.automacao_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auditoria (definições de automação são config crítica; runs são operacionais)
DROP TRIGGER IF EXISTS trg_audit_automacoes ON public.automacoes;
CREATE TRIGGER trg_audit_automacoes AFTER INSERT OR UPDATE OR DELETE ON public.automacoes
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- Índices
CREATE INDEX IF NOT EXISTS idx_automacoes_ativo
  ON public.automacoes (gatilho) WHERE ativo AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_automacao_runs_fila
  ON public.automacao_runs (status, proxima_tentativa_at)
  WHERE status IN ('pendente', 'erro');
CREATE INDEX IF NOT EXISTS idx_automacao_runs_automacao
  ON public.automacao_runs (automacao_id, created_at DESC);

-- RLS — feature CEO-only (cto resolve p/ ceo via get_user_papel); engine usa service_role
ALTER TABLE public.automacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automacoes_ceo" ON public.automacoes;
CREATE POLICY "automacoes_ceo" ON public.automacoes
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "automacoes_service" ON public.automacoes;
CREATE POLICY "automacoes_service" ON public.automacoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.automacao_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automacao_runs_ceo_select" ON public.automacao_runs;
CREATE POLICY "automacao_runs_ceo_select" ON public.automacao_runs
  FOR SELECT TO authenticated USING (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "automacao_runs_service" ON public.automacao_runs;
CREATE POLICY "automacao_runs_service" ON public.automacao_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Materializador de eventos (função COMPARTILHADA, schema-aware) ──
-- Insere runs 'pendente' p/ automações ativas do MESMO schema do evento.
-- ⛔ NUNCA aborta a operação primária (incidente #52): EXCEPTION WHEN OTHERS.
-- SECURITY DEFINER (precedente: audit.log_change): o evento dispara em sessões
-- `authenticated` (ex.: CEO movendo deal no Kanban) e o INSERT em automacao_runs
-- seria bloqueado por RLS — e engolido pelo handler — sem o definer.
CREATE OR REPLACE FUNCTION public.automacao_materializa_evento()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_gatilhos TEXT[];
  v_contexto JSONB;
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'deals' AND TG_OP = 'INSERT' THEN
      v_gatilhos := ARRAY['lead_qualificado'];
      v_contexto := jsonb_build_object(
        'deal_id', NEW.id, 'atleta_id', NEW.atleta_id, 'etapa', NEW.etapa::text);
    ELSIF TG_TABLE_NAME = 'deals' AND TG_OP = 'UPDATE'
          AND OLD.etapa IS DISTINCT FROM NEW.etapa THEN
      v_gatilhos := ARRAY['deal_etapa_mudou'];
      IF NEW.etapa::text = 'reuniao_marcada' THEN
        v_gatilhos := v_gatilhos || 'reuniao_marcada';
      END IF;
      v_contexto := jsonb_build_object(
        'deal_id', NEW.id, 'atleta_id', NEW.atleta_id,
        'etapa_de', OLD.etapa::text, 'etapa_para', NEW.etapa::text);
    ELSIF TG_TABLE_NAME = 'crm_experiencia' AND TG_OP = 'UPDATE'
          AND NEW.temperatura::text = 'vermelho'
          AND OLD.temperatura IS DISTINCT FROM NEW.temperatura THEN
      v_gatilhos := ARRAY['temperatura_vermelha'];
      v_contexto := jsonb_build_object(
        'experiencia_id', NEW.id, 'atleta_id', NEW.atleta_id,
        'temperatura_de', OLD.temperatura::text, 'temperatura_para', NEW.temperatura::text);
    ELSE
      RETURN NEW;
    END IF;

    EXECUTE format(
      'INSERT INTO %I.automacao_runs
         (automacao_id, status, gatilho_origem_tabela, gatilho_origem_id, contexto)
       SELECT a.id, ''pendente'', %L, $1, $2
         FROM %I.automacoes a
        WHERE a.ativo AND a.deleted_at IS NULL AND a.gatilho = ANY($3)',
      TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_TABLE_SCHEMA
    ) USING NEW.id, v_contexto, v_gatilhos;
  EXCEPTION WHEN OTHERS THEN
    -- Side-effect de automação jamais trava a operação de negócio
    RAISE WARNING 'automacao_materializa_evento falhou (%.%): %',
      TG_TABLE_SCHEMA, TG_TABLE_NAME, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_automacao_evento_deals ON public.deals;
CREATE TRIGGER trg_automacao_evento_deals
  AFTER INSERT OR UPDATE OF etapa ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.automacao_materializa_evento();

-- Sem `OF temperatura`: a coluna é derivada por trigger BEFORE (trg_experiencia_temp)
-- e mudanças feitas em BEFORE não contam para a lista do UPDATE OF (doc PG).
-- A função já filtra a transição para 'vermelho' — custo de disparo é desprezível.
DROP TRIGGER IF EXISTS trg_automacao_evento_experiencia ON public.crm_experiencia;
CREATE TRIGGER trg_automacao_evento_experiencia
  AFTER UPDATE ON public.crm_experiencia
  FOR EACH ROW EXECUTE FUNCTION public.automacao_materializa_evento();

-- Seed de configuração da engine (CEO edita via Configurações)
INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
('automacao_engine', '{
  "max_tentativas": 3,
  "retry_backoff_min_s": 60,
  "retry_backoff_max_s": 3600,
  "timeout_execucao_s": 30
}', 'Parâmetros da engine de automações (retries, backoff, timeout)')
ON CONFLICT (chave) DO NOTHING;

-- ─────────────────────────── UAT ───────────────────────────
DO $$ BEGIN
  -- Guard completo: o bloco toca 5 relações — todas precisam existir no schema
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.tarefas') IS NOT NULL
     AND to_regclass('uat.notificacoes') IS NOT NULL
     AND to_regclass('uat.deals') IS NOT NULL
     AND to_regclass('uat.crm_experiencia') IS NOT NULL
     AND to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN

    EXECUTE 'CREATE TABLE IF NOT EXISTS uat.automacoes (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome            TEXT NOT NULL,
      descricao       TEXT,
      gatilho         TEXT NOT NULL CHECK (gatilho IN (
        ''lead_qualificado'', ''deal_etapa_mudou'', ''reuniao_marcada'', ''temperatura_vermelha'',
        ''deal_parado_etapa'', ''parcela_vencendo'', ''parcela_atrasada'',
        ''familia_sem_contato'', ''tarefa_vencida''
      )),
      gatilho_config  JSONB NOT NULL DEFAULT ''{}''::jsonb,
      condicoes       JSONB NOT NULL DEFAULT ''[]''::jsonb,
      acoes           JSONB NOT NULL DEFAULT ''[]''::jsonb,
      ativo           BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID REFERENCES auth.users(id)
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS uat.automacao_runs (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      automacao_id          UUID NOT NULL REFERENCES uat.automacoes(id),
      status                TEXT NOT NULL DEFAULT ''pendente'' CHECK (status IN (
        ''pendente'', ''executando'', ''sucesso'', ''erro'', ''ignorado''
      )),
      gatilho_origem_tabela TEXT,
      gatilho_origem_id     UUID,
      contexto              JSONB NOT NULL DEFAULT ''{}''::jsonb,
      resultado             JSONB NOT NULL DEFAULT ''{}''::jsonb,
      tentativas            INTEGER NOT NULL DEFAULT 0,
      proxima_tentativa_at  TIMESTAMPTZ,
      executado_at          TIMESTAMPTZ,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    EXECUTE 'ALTER TABLE uat.tarefas
      ADD COLUMN IF NOT EXISTS automacao_run_id UUID REFERENCES uat.automacao_runs(id)';
    EXECUTE 'ALTER TABLE uat.notificacoes
      ADD COLUMN IF NOT EXISTS automacao_run_id UUID REFERENCES uat.automacao_runs(id)';

    -- Schemas custom não herdam default privileges (incidente remarketing 20260605)
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON uat.automacoes TO authenticated, service_role';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON uat.automacao_runs TO authenticated, service_role';

    EXECUTE 'DROP TRIGGER IF EXISTS trg_automacoes_updated_at ON uat.automacoes';
    EXECUTE 'CREATE TRIGGER trg_automacoes_updated_at BEFORE UPDATE ON uat.automacoes
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_automacao_runs_updated_at ON uat.automacao_runs';
    EXECUTE 'CREATE TRIGGER trg_automacao_runs_updated_at BEFORE UPDATE ON uat.automacao_runs
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_automacoes ON uat.automacoes';
    EXECUTE 'CREATE TRIGGER trg_audit_automacoes AFTER INSERT OR UPDATE OR DELETE ON uat.automacoes
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_automacoes_ativo
      ON uat.automacoes (gatilho) WHERE ativo AND deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_automacao_runs_fila
      ON uat.automacao_runs (status, proxima_tentativa_at)
      WHERE status IN (''pendente'', ''erro'')';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_automacao_runs_automacao
      ON uat.automacao_runs (automacao_id, created_at DESC)';

    EXECUTE 'ALTER TABLE uat.automacoes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "automacoes_ceo" ON uat.automacoes';
    EXECUTE 'CREATE POLICY "automacoes_ceo" ON uat.automacoes
      FOR ALL TO authenticated
      USING (public.get_user_papel() = ''ceo'')
      WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "automacoes_service" ON uat.automacoes';
    EXECUTE 'CREATE POLICY "automacoes_service" ON uat.automacoes
      FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'ALTER TABLE uat.automacao_runs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "automacao_runs_ceo_select" ON uat.automacao_runs';
    EXECUTE 'CREATE POLICY "automacao_runs_ceo_select" ON uat.automacao_runs
      FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "automacao_runs_service" ON uat.automacao_runs';
    EXECUTE 'CREATE POLICY "automacao_runs_service" ON uat.automacao_runs
      FOR ALL TO service_role USING (true) WITH CHECK (true)';

    EXECUTE 'DROP TRIGGER IF EXISTS trg_automacao_evento_deals ON uat.deals';
    EXECUTE 'CREATE TRIGGER trg_automacao_evento_deals
      AFTER INSERT OR UPDATE OF etapa ON uat.deals
      FOR EACH ROW EXECUTE FUNCTION public.automacao_materializa_evento()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_automacao_evento_experiencia ON uat.crm_experiencia';
    EXECUTE 'CREATE TRIGGER trg_automacao_evento_experiencia
      AFTER UPDATE ON uat.crm_experiencia
      FOR EACH ROW EXECUTE FUNCTION public.automacao_materializa_evento()';

    EXECUTE 'INSERT INTO uat.configuracoes_sistema (chave, valor, descricao) VALUES
      (''automacao_engine'', ''{
        "max_tentativas": 3,
        "retry_backoff_min_s": 60,
        "retry_backoff_max_s": 3600,
        "timeout_execucao_s": 30
      }'', ''Parâmetros da engine de automações (retries, backoff, timeout)'')
      ON CONFLICT (chave) DO NOTHING';
  END IF;
END $$;

-- ─────────────────────────── DEV ───────────────────────────
DO $$ BEGIN
  -- Guard completo: o bloco toca 5 relações — todas precisam existir no schema
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.tarefas') IS NOT NULL
     AND to_regclass('dev.notificacoes') IS NOT NULL
     AND to_regclass('dev.deals') IS NOT NULL
     AND to_regclass('dev.crm_experiencia') IS NOT NULL
     AND to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN

    EXECUTE 'CREATE TABLE IF NOT EXISTS dev.automacoes (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome            TEXT NOT NULL,
      descricao       TEXT,
      gatilho         TEXT NOT NULL CHECK (gatilho IN (
        ''lead_qualificado'', ''deal_etapa_mudou'', ''reuniao_marcada'', ''temperatura_vermelha'',
        ''deal_parado_etapa'', ''parcela_vencendo'', ''parcela_atrasada'',
        ''familia_sem_contato'', ''tarefa_vencida''
      )),
      gatilho_config  JSONB NOT NULL DEFAULT ''{}''::jsonb,
      condicoes       JSONB NOT NULL DEFAULT ''[]''::jsonb,
      acoes           JSONB NOT NULL DEFAULT ''[]''::jsonb,
      ativo           BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at      TIMESTAMPTZ,
      created_by      UUID REFERENCES auth.users(id)
    )';

    EXECUTE 'CREATE TABLE IF NOT EXISTS dev.automacao_runs (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      automacao_id          UUID NOT NULL REFERENCES dev.automacoes(id),
      status                TEXT NOT NULL DEFAULT ''pendente'' CHECK (status IN (
        ''pendente'', ''executando'', ''sucesso'', ''erro'', ''ignorado''
      )),
      gatilho_origem_tabela TEXT,
      gatilho_origem_id     UUID,
      contexto              JSONB NOT NULL DEFAULT ''{}''::jsonb,
      resultado             JSONB NOT NULL DEFAULT ''{}''::jsonb,
      tentativas            INTEGER NOT NULL DEFAULT 0,
      proxima_tentativa_at  TIMESTAMPTZ,
      executado_at          TIMESTAMPTZ,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )';

    EXECUTE 'ALTER TABLE dev.tarefas
      ADD COLUMN IF NOT EXISTS automacao_run_id UUID REFERENCES dev.automacao_runs(id)';
    EXECUTE 'ALTER TABLE dev.notificacoes
      ADD COLUMN IF NOT EXISTS automacao_run_id UUID REFERENCES dev.automacao_runs(id)';

    -- Schemas custom não herdam default privileges (incidente remarketing 20260605)
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON dev.automacoes TO authenticated, service_role';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON dev.automacao_runs TO authenticated, service_role';

    EXECUTE 'DROP TRIGGER IF EXISTS trg_automacoes_updated_at ON dev.automacoes';
    EXECUTE 'CREATE TRIGGER trg_automacoes_updated_at BEFORE UPDATE ON dev.automacoes
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_automacao_runs_updated_at ON dev.automacao_runs';
    EXECUTE 'CREATE TRIGGER trg_automacao_runs_updated_at BEFORE UPDATE ON dev.automacao_runs
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_audit_automacoes ON dev.automacoes';
    EXECUTE 'CREATE TRIGGER trg_audit_automacoes AFTER INSERT OR UPDATE OR DELETE ON dev.automacoes
      FOR EACH ROW EXECUTE FUNCTION audit.log_change()';

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_automacoes_ativo
      ON dev.automacoes (gatilho) WHERE ativo AND deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_automacao_runs_fila
      ON dev.automacao_runs (status, proxima_tentativa_at)
      WHERE status IN (''pendente'', ''erro'')';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_automacao_runs_automacao
      ON dev.automacao_runs (automacao_id, created_at DESC)';

    EXECUTE 'ALTER TABLE dev.automacoes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "automacoes_ceo" ON dev.automacoes';
    EXECUTE 'CREATE POLICY "automacoes_ceo" ON dev.automacoes
      FOR ALL TO authenticated
      USING (public.get_user_papel() = ''ceo'')
      WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "automacoes_service" ON dev.automacoes';
    EXECUTE 'CREATE POLICY "automacoes_service" ON dev.automacoes
      FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'ALTER TABLE dev.automacao_runs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "automacao_runs_ceo_select" ON dev.automacao_runs';
    EXECUTE 'CREATE POLICY "automacao_runs_ceo_select" ON dev.automacao_runs
      FOR SELECT TO authenticated USING (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "automacao_runs_service" ON dev.automacao_runs';
    EXECUTE 'CREATE POLICY "automacao_runs_service" ON dev.automacao_runs
      FOR ALL TO service_role USING (true) WITH CHECK (true)';

    EXECUTE 'DROP TRIGGER IF EXISTS trg_automacao_evento_deals ON dev.deals';
    EXECUTE 'CREATE TRIGGER trg_automacao_evento_deals
      AFTER INSERT OR UPDATE OF etapa ON dev.deals
      FOR EACH ROW EXECUTE FUNCTION public.automacao_materializa_evento()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_automacao_evento_experiencia ON dev.crm_experiencia';
    EXECUTE 'CREATE TRIGGER trg_automacao_evento_experiencia
      AFTER UPDATE ON dev.crm_experiencia
      FOR EACH ROW EXECUTE FUNCTION public.automacao_materializa_evento()';

    EXECUTE 'INSERT INTO dev.configuracoes_sistema (chave, valor, descricao) VALUES
      (''automacao_engine'', ''{
        "max_tentativas": 3,
        "retry_backoff_min_s": 60,
        "retry_backoff_max_s": 3600,
        "timeout_execucao_s": 30
      }'', ''Parâmetros da engine de automações (retries, backoff, timeout)'')
      ON CONFLICT (chave) DO NOTHING';
  END IF;
END $$;
