-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Automações — novos gatilhos (NPS/crise/onboarding/indicação)
--                                                            | public, uat, dev
-- Contexto: o builder de automações (/automacoes) ganha 4 gatilhos novos:
--   evento: nps_registrado        — crm_experiencia.nps_6meses acabou de ser
--                                   gravado (condição por nota: detrator ≤ 6…)
--           crise_registrada      — crm_experiencia.status mudou p/ 'crise'
--                                   (distinto de temperatura_vermelha)
--           indicacao_convertida  — indicacoes.status mudou p/ 'convertido'
--   tempo:  onboarding_etapa_atrasada — avaliado pela ENGINE (CF
--           automation-engine, finder com dedup one-shot por etapa) — sem
--           trigger no banco.
-- O CHECK de gatilho é ampliado (superset — nenhuma row existente viola) no
--   padrão DROP IF EXISTS + ADD das migrations 20260704041917/20260709220205.
-- A função COMPARTILHADA public.automacao_materializa_evento() (schema-aware
--   via TG_TABLE_SCHEMA) é redefinida para materializar os eventos novos —
--   preservando: SECURITY DEFINER, search_path fixo e EXCEPTION WHEN OTHERS
--   (side-effect de automação JAMAIS trava a operação de negócio).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. CHECK do gatilho ganha os 4 valores novos ───────────────────────────

-- PUBLIC (PRD)
ALTER TABLE public.automacoes DROP CONSTRAINT IF EXISTS automacoes_gatilho_check;
ALTER TABLE public.automacoes ADD CONSTRAINT automacoes_gatilho_check CHECK (gatilho IN (
  'lead_qualificado', 'deal_etapa_mudou', 'reuniao_marcada', 'temperatura_vermelha',
  'deal_parado_etapa', 'parcela_vencendo', 'parcela_atrasada',
  'familia_sem_contato', 'tarefa_vencida', 'agendamento', 'sistema',
  'nps_registrado', 'crise_registrada', 'onboarding_etapa_atrasada', 'indicacao_convertida'
));

-- UAT
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.automacoes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.automacoes DROP CONSTRAINT IF EXISTS automacoes_gatilho_check';
    EXECUTE 'ALTER TABLE uat.automacoes ADD CONSTRAINT automacoes_gatilho_check CHECK (gatilho IN (
      ''lead_qualificado'', ''deal_etapa_mudou'', ''reuniao_marcada'', ''temperatura_vermelha'',
      ''deal_parado_etapa'', ''parcela_vencendo'', ''parcela_atrasada'',
      ''familia_sem_contato'', ''tarefa_vencida'', ''agendamento'', ''sistema'',
      ''nps_registrado'', ''crise_registrada'', ''onboarding_etapa_atrasada'', ''indicacao_convertida''
    ))';
  END IF;
END $$;

-- DEV
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.automacoes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.automacoes DROP CONSTRAINT IF EXISTS automacoes_gatilho_check';
    EXECUTE 'ALTER TABLE dev.automacoes ADD CONSTRAINT automacoes_gatilho_check CHECK (gatilho IN (
      ''lead_qualificado'', ''deal_etapa_mudou'', ''reuniao_marcada'', ''temperatura_vermelha'',
      ''deal_parado_etapa'', ''parcela_vencendo'', ''parcela_atrasada'',
      ''familia_sem_contato'', ''tarefa_vencida'', ''agendamento'', ''sistema'',
      ''nps_registrado'', ''crise_registrada'', ''onboarding_etapa_atrasada'', ''indicacao_convertida''
    ))';
  END IF;
END $$;

-- ─── 2. Materializador de eventos — versão estendida ────────────────────────
-- Redefinição a partir da versão de 20260703232151 (nenhuma redefinição
-- posterior — verificado por grep). Novos ramos:
--   crm_experiencia UPDATE → acumula até 3 gatilhos no MESMO evento
--     (temperatura_vermelha, nps_registrado, crise_registrada) — um UPDATE
--     que muda temperatura E nps materializa runs p/ os dois gatilhos;
--   indicacoes UPDATE → indicacao_convertida (transição p/ 'convertido').
-- Contextos ganham campos aditivos (fase/status/nps_nota/deal_id) — supersets
-- dos contextos históricos (runs antigos seguem válidos).
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
    ELSIF TG_TABLE_NAME = 'crm_experiencia' AND TG_OP = 'UPDATE' THEN
      v_gatilhos := ARRAY[]::TEXT[];
      IF NEW.temperatura::text = 'vermelho'
         AND OLD.temperatura IS DISTINCT FROM NEW.temperatura THEN
        v_gatilhos := v_gatilhos || 'temperatura_vermelha';
      END IF;
      -- NPS acabou de ser gravado/alterado com valor não-nulo
      IF NEW.nps_6meses IS NOT NULL
         AND OLD.nps_6meses IS DISTINCT FROM NEW.nps_6meses THEN
        v_gatilhos := v_gatilhos || 'nps_registrado';
      END IF;
      -- Status da experiência entrou em crise (protocolo de crise)
      IF NEW.status::text = 'crise'
         AND OLD.status IS DISTINCT FROM NEW.status THEN
        v_gatilhos := v_gatilhos || 'crise_registrada';
      END IF;
      IF array_length(v_gatilhos, 1) IS NULL THEN
        RETURN NEW;
      END IF;
      v_contexto := jsonb_build_object(
        'experiencia_id', NEW.id, 'atleta_id', NEW.atleta_id, 'deal_id', NEW.deal_id,
        'fase', NEW.fase::text, 'status', NEW.status::text,
        'temperatura_de', OLD.temperatura::text, 'temperatura_para', NEW.temperatura::text,
        'nps_nota', NEW.nps_6meses);
    ELSIF TG_TABLE_NAME = 'indicacoes' AND TG_OP = 'UPDATE'
          AND NEW.status::text = 'convertido'
          AND OLD.status IS DISTINCT FROM NEW.status THEN
      v_gatilhos := ARRAY['indicacao_convertida'];
      -- indicador_nome/indicado_nome: colunas diretas da linha (fluxo novo,
      -- 20260711091729) — sem subquery para manter a função schema-aware
      -- (o search_path fixo resolveria tabelas só em public).
      v_contexto := jsonb_build_object(
        'indicacao_id', NEW.id, 'atleta_id', NEW.atleta_indicado_id,
        'responsavel_indicador_id', NEW.responsavel_indicador_id,
        'indicador_experiencia_id', NEW.indicador_experiencia_id,
        'indicador_nome', NEW.indicador_nome,
        'indicado_nome', NEW.indicado_nome,
        'status_de', OLD.status, 'status_para', NEW.status);
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

-- ─── 3. Trigger de evento em indicacoes (status → convertido) ───────────────
-- crm_experiencia JÁ tem trigger AFTER UPDATE sem lista de colunas
-- (20260703232151) — a função estendida cobre NPS/crise sem trigger novo.

-- PUBLIC (PRD)
DROP TRIGGER IF EXISTS trg_automacao_evento_indicacoes ON public.indicacoes;
CREATE TRIGGER trg_automacao_evento_indicacoes
  AFTER UPDATE OF status ON public.indicacoes
  FOR EACH ROW EXECUTE FUNCTION public.automacao_materializa_evento();

-- UAT (gate por tabela: uat/dev são incompletos — deploy não pode quebrar)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.indicacoes') IS NOT NULL
     AND to_regclass('uat.automacoes') IS NOT NULL
     AND to_regclass('uat.automacao_runs') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_automacao_evento_indicacoes ON uat.indicacoes';
    EXECUTE 'CREATE TRIGGER trg_automacao_evento_indicacoes
      AFTER UPDATE OF status ON uat.indicacoes
      FOR EACH ROW EXECUTE FUNCTION public.automacao_materializa_evento()';
  END IF;
END $$;

-- DEV
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.indicacoes') IS NOT NULL
     AND to_regclass('dev.automacoes') IS NOT NULL
     AND to_regclass('dev.automacao_runs') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_automacao_evento_indicacoes ON dev.indicacoes';
    EXECUTE 'CREATE TRIGGER trg_automacao_evento_indicacoes
      AFTER UPDATE OF status ON dev.indicacoes
      FOR EACH ROW EXECUTE FUNCTION public.automacao_materializa_evento()';
  END IF;
END $$;
