-- ════════════════════════════════════════════════════════════════════════
-- Migration: próxima ação do deal por coluna (T21) — metadados + ação padrão
-- Aplica em: public. uat/dev: gate por TABELA (hoje não têm deals → no-op).
-- ════════════════════════════════════════════════════════════════════════
--
-- Problema (vídeo 28/09): "Preparar para reunião" é gravada UMA vez (CF
-- calendar-webhook / process-followup) e nunca muda — o card de uma família
-- em "Sinal pago" mostra essa ação vencida em vermelho. A coluna de destino
-- precisa poder trocar a ação pela "próxima ação padrão" dela, sem atropelar
-- o que o CEO escreveu à mão, e isso vale para QUALQUER escritor que mude a
-- etapa (moverDeal, meeting-transcripts → Reunião realizada, confirmarSinalPago,
-- automações, scripts) — por isso mora no banco, num trigger só.
--
--   • next_action_etapa      — etapa do deal quando a ação atual foi gravada
--                              (texto; NULL = legado OU escrita do Engine sem
--                              autoria declarada → o TEXTO decide, ver abaixo).
--   • next_action_manual_em  — quando o CEO escreveu a ação à mão (só o
--                              atualizarDeal declara). NULL = sistema/padrão.
--
-- Regras do trigger trg_deals_next_action_meta (BEFORE INSERT OR UPDATE):
--   1. AÇÃO PADRÃO: a etapa mudou, o escritor NÃO mexeu na ação nem no prazo,
--      a ação atual é "de sistema" (next_action_e_de_sistema) e a coluna de
--      destino tem acao_padrao válida em etapas_deal_regras → troca texto e
--      prazo (hoje BRT + dias). Nunca em 'perdido', nunca em deal excluído,
--      nunca esvazia (Regra 2). Config ilegível → não troca (WARNING).
--   2. METADADOS: texto mudou sem autoria manual declarada → manual_em := NULL;
--      a ação passa a pertencer à etapa atual — EXCETO quando quem escreve é
--      a sessão do Engine (role authenticated) sem declarar autoria: pode ser
--      o CEO digitando (ex.: código antigo durante o rollout) → sem carimbo,
--      o texto decide (texto desconhecido = manual, conservador).
--
-- "De sistema" = sem texto, OU (sem marca manual E (carimbada OU texto
-- conhecido de sistema)). Lista de textos = espelho EXATO de
-- ACOES_SISTEMA_LEGADAS em apps/crm/src/lib/proxima-acao.ts (guard
-- tests/etapas-plano-escolhido-invariants.test.js compara as duas).
--
-- Sem backfill: a troca da ação vencida dos 27 deals pós-reunião é script
-- SEPARADO (scripts/sql/t21-proxima-acao), só com autorização do CEO.
-- Compatível com o código antigo: colunas novas nullable; o trigger nunca
-- levanta erro; o código antigo não lê as colunas. Durante o rollout, um move
-- feito pelo Engine antigo já recebe a ação padrão (desejado) e uma ação
-- digitada no Engine antigo NÃO é carimbada como sistema (regra 2).
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC ──────────────────────────────────────────────────────────────
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS next_action_etapa TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS next_action_manual_em TIMESTAMPTZ;

COMMENT ON COLUMN public.deals.next_action_etapa IS
  'Etapa do deal quando a next_action atual foi gravada (mantida pelo trigger trg_deals_next_action_meta). NULL = legado anterior a 2026-10 ou escrita do Engine sem autoria declarada (o texto decide).';
COMMENT ON COLUMN public.deals.next_action_manual_em IS
  'Quando o CEO escreveu a next_action à mão (só atualizarDeal grava). NULL = ação de sistema/automação/padrão da coluna — pode ser trocada pela ação padrão ao mudar de etapa.';

-- Ação atual é "de sistema" (pode ser trocada pela ação padrão da coluna)?
-- Espelho de !isAcaoManual (apps/crm/src/lib/proxima-acao.ts).
CREATE OR REPLACE FUNCTION public.next_action_e_de_sistema(
  p_texto text, p_etapa text, p_manual_em timestamptz
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_texto IS NULL OR btrim(p_texto) = '' THEN true
    WHEN p_manual_em IS NOT NULL THEN false
    WHEN p_etapa IS NOT NULL THEN true
    ELSE btrim(p_texto) ~* ANY (ARRAY[
      '^preparar para reuni[aã]o$',
      '^reuni[aã]o detectada antes da aprova[cç][aã]o',
      '^reuni[aã]o no hist[oó]rico do deal',
      '^aguardar agendamento$',
      '^aguardar contato programado em novembro/[0-9]{4}$',
      '^aguardar novembro/[0-9]{4}$',
      '^retomar contato em novembro \(lead muito cedo\)$',
      '^lead re-aprovado pelo ceo',
      '^deal reaberto na re-aprova[cç][aã]o',
      '^confirmar realiza[cç][aã]o e definir pr[oó]ximos passos$'
    ])
  END;
$$;

COMMENT ON FUNCTION public.next_action_e_de_sistema(text, text, timestamptz) IS
  'A next_action atual é de sistema (trocável pela ação padrão da coluna)? Espelho de !isAcaoManual em apps/crm/src/lib/proxima-acao.ts — guard compara a lista de textos.';

CREATE OR REPLACE FUNCTION public.trg_deals_next_action_meta()
RETURNS TRIGGER AS $$
DECLARE
  v_acao jsonb;
  v_dias integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.next_action IS NOT NULL AND NEW.next_action_etapa IS NULL
       AND (NEW.next_action_manual_em IS NOT NULL OR current_user <> 'authenticated') THEN
      NEW.next_action_etapa := NEW.etapa::text;
    END IF;
    RETURN NEW;
  END IF;

  -- ─── 1. Ação padrão da coluna de destino (todos os escritores) ─────────
  IF NEW.etapa IS DISTINCT FROM OLD.etapa
     AND NEW.next_action IS NOT DISTINCT FROM OLD.next_action
     AND NEW.data_proxima_acao IS NOT DISTINCT FROM OLD.data_proxima_acao
     AND NEW.next_action_manual_em IS NOT DISTINCT FROM OLD.next_action_manual_em
     AND NEW.deleted_at IS NULL
     AND NEW.etapa::text <> 'perdido'
     AND public.next_action_e_de_sistema(OLD.next_action, OLD.next_action_etapa, OLD.next_action_manual_em)
  THEN
    BEGIN
      SELECT c.valor -> (NEW.etapa::text) -> 'acao_padrao' INTO v_acao
      FROM public.configuracoes_sistema c
      WHERE c.chave = 'etapas_deal_regras';
    EXCEPTION WHEN OTHERS THEN
      v_acao := NULL;
      RAISE WARNING 'trg_deals_next_action_meta: etapas_deal_regras ilegível — ação mantida (deal=%, erro=%)',
        NEW.id, SQLERRM;
    END;

    IF jsonb_typeof(v_acao) = 'object'
       AND jsonb_typeof(v_acao -> 'texto') = 'string'
       AND length(btrim(v_acao ->> 'texto')) BETWEEN 3 AND 120 THEN
      v_dias := CASE
        WHEN jsonb_typeof(v_acao -> 'dias') = 'number'
          THEN LEAST(60, GREATEST(0, round((v_acao ->> 'dias')::numeric)))::integer
        ELSE 2
      END;
      NEW.next_action := btrim(v_acao ->> 'texto');
      NEW.data_proxima_acao := (now() AT TIME ZONE 'America/Sao_Paulo')::date + v_dias;
      NEW.next_action_etapa := NEW.etapa::text;
      NEW.next_action_manual_em := NULL;
      RETURN NEW;
    END IF;
  END IF;

  -- ─── 2. Metadados (de qual etapa é a ação / se é manual) ──────────────
  IF NEW.next_action IS DISTINCT FROM OLD.next_action
     OR NEW.next_action_manual_em IS DISTINCT FROM OLD.next_action_manual_em THEN
    -- Texto mudou e o escritor não declarou autoria manual NESTA escrita:
    -- a marca manual anterior não vale para o texto novo.
    IF NEW.next_action IS DISTINCT FROM OLD.next_action
       AND NEW.next_action_manual_em IS NOT DISTINCT FROM OLD.next_action_manual_em THEN
      NEW.next_action_manual_em := NULL;
    END IF;
    -- A ação passa a pertencer à etapa atual (salvo se o escritor informou).
    IF NEW.next_action_etapa IS NOT DISTINCT FROM OLD.next_action_etapa THEN
      NEW.next_action_etapa := CASE
        WHEN NEW.next_action IS NULL THEN NULL
        WHEN NEW.next_action_manual_em IS NOT NULL THEN NEW.etapa::text
        -- Sessão do Engine sem autoria declarada (pode ser o CEO digitando no
        -- código antigo): sem carimbo — o texto decide (conservador).
        WHEN current_user = 'authenticated' THEN NULL
        ELSE NEW.etapa::text
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.trg_deals_next_action_meta() IS
  'T21: aplica a próxima ação padrão da coluna de destino (etapas_deal_regras) quando a etapa muda e a ação atual é de sistema, e mantém next_action_etapa/next_action_manual_em para TODOS os escritores (app e CFs). Nunca aborta, nunca esvazia a ação.';

DROP TRIGGER IF EXISTS trg_deals_next_action_meta ON public.deals;
CREATE TRIGGER trg_deals_next_action_meta
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.trg_deals_next_action_meta();

-- ─── UAT / DEV (gate por tabela — hoje sem deals: no-op) ─────────────────
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['uat', 'dev'] LOOP
    IF to_regclass(s || '.deals') IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.deals ADD COLUMN IF NOT EXISTS next_action_etapa TEXT', s);
      EXECUTE format('ALTER TABLE %I.deals ADD COLUMN IF NOT EXISTS next_action_manual_em TIMESTAMPTZ', s);
      EXECUTE format('DROP TRIGGER IF EXISTS trg_deals_next_action_meta ON %I.deals', s);
      EXECUTE format('CREATE TRIGGER trg_deals_next_action_meta BEFORE INSERT OR UPDATE ON %I.deals
                      FOR EACH ROW EXECUTE FUNCTION public.trg_deals_next_action_meta()', s);
    ELSE
      RAISE NOTICE 'next_action_meta: %.deals ausente — pulado', s;
    END IF;
  END LOOP;
END $$;
