-- ════════════════════════════════════════════════════════════════════════
-- Migration (DADOS de apresentação): a coluna "Plano escolhido" passa de
-- 'negociacao' para a etapa própria 'plano_escolhido'
-- Aplica em: public (chave etapas_deal_config). uat/dev não têm
-- configuracoes_sistema e o Engine lê public em todo ambiente — nada a fazer
-- lá (gate por TABELA, não por schema).
-- ════════════════════════════════════════════════════════════════════════
--
-- ⚠️ PR SEPARADO, mergeado em develop SÓ DEPOIS do vai-pra-prod do PR que
-- traz *_status_deal_plano_escolhido, *_plano_escolhido_ordem_board_retrocesso
-- e *_deals_next_action_meta + o código. Motivo: o banco é único (develop já
-- aplica em public) e o Engine de PRODUÇÃO antigo não conhece
-- 'plano_escolhido' — um deal gravado nessa etapa some do board antigo e
-- QUEBRA a visão de tabela (stageConfig[etapa] indefinido). Enquanto esta
-- migration não roda, a coluna nova fica OCULTA (DEAL_STAGE_CONFIG.
-- ocultaPorPadrao) e ninguém consegue soltar card nela.
--
-- O que faz (idempotente — o gatilho é 'negociacao' ainda rotulada "Plano
-- escolhido", não a ausência da chave nova: se o CEO reordenar o board ou
-- salvar a aba Pipelines antes desta migration, a etapa nova já terá uma
-- entrada oculta e mesmo assim o rótulo é migrado):
--   • Se 'negociacao' está rotulada "Plano escolhido" (PRD desde 10/09):
--       plano_escolhido ← rótulo/cor/ordem de negociacao + oculta:false
--       negociacao      ← sem rótulo/cor, oculta:true, ordem no fim (max+1)
--     negociacao volta a ser a etapa de PRÉ-VENDA (hoje com 0 deals; se
--     houver deals, a coluna oculta continua aparecendo com o badge "Oculta"
--     — nenhum deal é movido por esta migration).
--   • Senão, se plano_escolhido JÁ está visível (oculta:false explícito):
--     no-op. A mera existência da chave não basta — o PR anterior grava
--     plano_escolhido OCULTA ao reordenar o board ou salvar a aba Pipelines.
--   • Senão: torna plano_escolhido visível mesclando sobre a entrada que já
--     exista (rótulo/cor/ordem do CEO vencem; faltando, "Plano escolhido",
--     laranja, ordem de sinal_pago + 0.5) e não toca em negociacao.
-- Demais chaves do JSON (as outras colunas do CEO) ficam INTACTAS: o UPDATE
-- só reescreve as chaves 'plano_escolhido' e 'negociacao' via `||`.
-- Idempotente: todo ramo que escreve deixa plano_escolhido com oculta:false
-- e negociacao sem o rótulo → re-rodar é no-op.
--
-- Pré-merge: `select count(*) from public.deals where etapa = 'negociacao'
-- and deleted_at is null` deve ser 0 — deal solto na coluna antiga entre a
-- promoção e este PR vira pré-venda oculta (a migration só AVISA, não move).
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_cfg      jsonb;
  v_neg      jsonb;
  v_plano    jsonb;
  v_max      numeric;
  v_sinal    numeric;
  v_auto     integer := 0;
  v_deals    integer := 0;
  v_movido   boolean := false;
  v_regras   jsonb;
BEGIN
  IF to_regclass('public.configuracoes_sistema') IS NULL THEN
    RAISE NOTICE 'plano_escolhido_coluna: sem configuracoes_sistema — pulado';
    RETURN;
  END IF;

  SELECT valor INTO v_cfg
  FROM public.configuracoes_sistema
  WHERE chave = 'etapas_deal_config'
  FOR UPDATE;

  IF v_cfg IS NULL OR jsonb_typeof(v_cfg) <> 'object' THEN
    RAISE NOTICE 'plano_escolhido_coluna: etapas_deal_config ausente/inválida — código usa defaults';
    RETURN;
  END IF;

  v_neg := v_cfg -> 'negociacao';

  IF jsonb_typeof(v_neg) = 'object'
     AND lower(btrim(regexp_replace(COALESCE(v_neg ->> 'label', ''), '\s+', ' ', 'g'))) = 'plano escolhido' THEN
    -- Move a coluna do CEO (rótulo, cor, posição) para a etapa própria.
    -- Mescla sobre uma entrada plano_escolhido que já exista (ex.: o CEO
    -- reordenou o board ou salvou a aba Pipelines antes desta migration —
    -- a etapa nova estava oculta) — o que vem de negociacao vence.
    v_plano := COALESCE(
                 CASE WHEN jsonb_typeof(v_cfg -> 'plano_escolhido') = 'object'
                      THEN v_cfg -> 'plano_escolhido' END,
                 '{}'::jsonb)
               || v_neg || '{"oculta": false}'::jsonb;

    SELECT max((e.v ->> 'order')::numeric) INTO v_max
    FROM jsonb_each(v_cfg) AS e(k, v)
    WHERE jsonb_typeof(e.v) = 'object' AND jsonb_typeof(e.v -> 'order') = 'number';

    v_cfg := v_cfg || jsonb_build_object(
      'plano_escolhido', v_plano,
      'negociacao', (v_neg - 'label' - 'accent')
                    || jsonb_build_object('oculta', true, 'order', floor(COALESCE(v_max, 90)) + 1)
    );
    v_movido := true;
    RAISE NOTICE 'plano_escolhido_coluna: rótulo "Plano escolhido" movido de negociacao para plano_escolhido';
  ELSIF (v_cfg -> 'plano_escolhido' -> 'oculta') = 'false'::jsonb THEN
    RAISE NOTICE 'plano_escolhido_coluna: plano_escolhido já visível e negociacao sem o rótulo — no-op';
    RETURN;
  ELSE
    -- Defaults primeiro: o que o CEO já gravou na entrada oculta (ordem do
    -- reordenar, rótulo da aba Pipelines) vence; só a visibilidade é forçada.
    v_plano := jsonb_build_object('label', 'Plano escolhido', 'accent', 'orange')
               || COALESCE(
                    CASE WHEN jsonb_typeof(v_cfg -> 'plano_escolhido') = 'object'
                         THEN v_cfg -> 'plano_escolhido' END,
                    '{}'::jsonb)
               || '{"oculta": false}'::jsonb;
    IF jsonb_typeof(v_plano -> 'order') IS DISTINCT FROM 'number' THEN
      IF jsonb_typeof(v_cfg -> 'sinal_pago' -> 'order') = 'number' THEN
        v_sinal := (v_cfg -> 'sinal_pago' ->> 'order')::numeric;
      END IF;
      v_plano := v_plano - 'order';
      IF v_sinal IS NOT NULL THEN
        v_plano := v_plano || jsonb_build_object('order', v_sinal + 0.5);
      END IF;
    END IF;
    v_cfg := v_cfg || jsonb_build_object('plano_escolhido', v_plano);
    RAISE NOTICE 'plano_escolhido_coluna: negociacao não era "Plano escolhido" — coluna plano_escolhido tornada visível';
    -- Rótulo próprio e visível em negociacao pode ser a coluna antiga
    -- renomeada pelo CEO: o board passaria a ter duas colunas de plano.
    IF jsonb_typeof(v_neg) = 'object'
       AND COALESCE(v_neg ->> 'label', '') <> ''
       AND (v_neg -> 'oculta') IS DISTINCT FROM 'true'::jsonb THEN
      RAISE WARNING 'plano_escolhido_coluna: negociacao segue visível como "%" — se era a coluna Plano escolhido, mover os deals para plano_escolhido e ocultá-la', v_neg ->> 'label';
    END IF;
  END IF;

  UPDATE public.configuracoes_sistema
  SET valor = v_cfg, updated_at = NOW()
  WHERE chave = 'etapas_deal_config';

  -- Daqui para baixo só interessa quando o rótulo SAIU de negociacao: no
  -- ramo "coluna nova", negociacao nunca foi "Plano escolhido" e o que estiver
  -- preso a ela é pré-venda legítima.
  IF NOT v_movido THEN
    RETURN;
  END IF;

  -- Deal solto na coluna antiga entre a promoção e esta migration (janela
  -- R13) já pagou o sinal mas fica em 'negociacao', agora pré-venda oculta:
  -- conta fora de ganho, entra em "Negociação parada" e no remarketing. Só
  -- AVISA (08/10: 0 deals) — mover é decisão do CEO, nenhum deal é tocado.
  SELECT count(*) INTO v_deals
  FROM public.deals
  WHERE etapa::text = 'negociacao' AND deleted_at IS NULL;
  IF v_deals > 0 THEN
    RAISE WARNING 'plano_escolhido_coluna: % deal(s) em negociacao (antiga coluna Plano escolhido) — mover para Plano escolhido', v_deals;
  END IF;

  -- Automações presas à coluna antiga continuariam na etapa de pré-venda:
  -- gatilho/condição em 'negociacao' E ação mover_deal com etapa_destino
  -- 'negociacao' (mora em acoes ou, no fluxo por passos, em passos). Só
  -- AVISA (08/10: 0 automações) — religar é decisão do CEO no modal da coluna.
  IF to_regclass('public.automacoes') IS NOT NULL THEN
    SELECT count(*) INTO v_auto
    FROM public.automacoes
    WHERE deleted_at IS NULL
      AND (gatilho_config::text LIKE '%"negociacao"%'
           OR condicoes::text LIKE '%"negociacao"%'
           OR acoes::text LIKE '%"negociacao"%'
           OR COALESCE(passos::text, '') LIKE '%"negociacao"%');
    IF v_auto > 0 THEN
      RAISE WARNING 'plano_escolhido_coluna: % automação(ões) ainda presas a negociacao (gatilho, condição ou mover_deal) — revisar e religar à coluna Plano escolhido', v_auto;
    END IF;
  END IF;

  -- Comportamento editado no modal da coluna ANTES desta migration (ação
  -- padrão/pede_plano gravados em 'negociacao') fica na pré-venda: as regras
  -- semeadas de plano_escolhido valem para a coluna visível. Só AVISA — mover
  -- regra é decisão do CEO (o seed de plano_escolhido já é o combinado).
  SELECT valor -> 'negociacao' INTO v_regras
  FROM public.configuracoes_sistema
  WHERE chave = 'etapas_deal_regras';
  IF jsonb_typeof(v_regras) = 'object' AND v_regras <> '{}'::jsonb THEN
    RAISE WARNING 'plano_escolhido_coluna: etapas_deal_regras.negociacao = % — revisar a coluna Plano escolhido no modal', v_regras;
  END IF;
END $$;
