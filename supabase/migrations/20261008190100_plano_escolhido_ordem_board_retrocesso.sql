-- ════════════════════════════════════════════════════════════════════════
-- Migration: plano_escolhido — ordem fixa, retrocesso pela ORDEM DO BOARD,
-- handoff da jornada e regras de comportamento por coluna
-- Roda DEPOIS de *_status_deal_plano_escolhido (que adiciona 'plano_escolhido' ao enum).
-- Aplica em: public. uat/dev não têm deals nem configuracoes_sistema (gate
-- por TABELA no fim do arquivo — schema existir não basta).
-- ════════════════════════════════════════════════════════════════════════
--
-- 1. ordem_etapa_fixa(text): ordem de NEGÓCIO renumerada com plano_escolhido
--    entre sinal_pago e admission_process. ordem_etapa(status_deal) passa a
--    delegar para ela (mesma assinatura — nenhum chamador muda). Números só
--    são comparados entre si, nunca persistidos (nota da 20260811140100).
--    Espelho TS: ETAPA_ORDEM em apps/crm/src/types/crm.ts (guard compara).
-- 2. ordem_etapa_board(text, jsonb) [IMMUTABLE, pura] e
--    ordem_etapa_board(status_deal) [STABLE, lê etapas_deal_config]: ordem
--    CONFIGURADA PELO CEO, só quando a etapa está VISÍVEL no board e tem
--    'order' explícito; NULL caso contrário. Lê tabela → nunca usar em índice.
-- 3. etapa_e_retrocesso(de, para, cfg): a regra ÚNICA de retrocesso —
--    isenções de sempre (perdido, cancelamento_solicitado, projeto_futuro,
--    aguardando_timing, custom_%) e comparação SEMPRE na mesma escala: as duas
--    etapas visíveis com ordem explícita → ordem do board; senão → ordem fixa
--    para AS DUAS (sair de Sinal pago para uma etapa oculta anterior, ex.
--    followup_proposta, continua retrocesso). Espelho TS: lib/etapas-ordem.ts.
-- 4. trg_deals_check_etapa usa etapa_e_retrocesso. Config ilegível → ordem
--    fixa + RAISE WARNING (o trigger NUNCA aborta o UPDATE por causa disso).
-- 5. Handoff: entrar em plano_escolhido abre a jornada como sinal_pago
--    (envio_opcoes) — comparação por ::text (sem cast de enum).
-- 6. Seeds aditivos (existente vence): probabilidade_por_etapa.plano_escolhido
--    = 97 e a chave NOVA etapas_deal_regras (ganho / pede_plano / ação padrão
--    por coluna). Código antigo não lê etapas_deal_regras nem grava nela.
--
-- Compatível com o código antigo (main): nenhuma coluna/chave existente muda
-- de forma; o board antigo segue igual (a coluna "Plano escolhido" só migra
-- de 'negociacao' para 'plano_escolhido' na migration de DADOS 124400, que
-- vai num PR posterior ao vai-pra-prod).
-- Idempotente: CREATE OR REPLACE + seeds com ON CONFLICT DO NOTHING / guarda
-- de chave existente.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Ordem fixa (negócio) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ordem_etapa_fixa(p_etapa text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_etapa
    WHEN 'contato_feito'           THEN 1
    WHEN 'lead'                    THEN 2
    WHEN 'aguardando_timing'       THEN 3
    WHEN 'reuniao_marcada'         THEN 4
    WHEN 'reuniao_realizada'       THEN 5
    WHEN 'diagnostico_fit'         THEN 6
    WHEN 'alinhamento_estrategico' THEN 7
    WHEN 'proposta_enviada'        THEN 8
    WHEN 'followup_proposta'       THEN 9
    WHEN 'negociacao'              THEN 10
    WHEN 'contrato_enviado'        THEN 11
    WHEN 'contrato_assinado'       THEN 12
    WHEN 'sinal_pago'              THEN 13
    WHEN 'plano_escolhido'         THEN 14
    WHEN 'admission_process'       THEN 15
    WHEN 'concluido'               THEN 16
    WHEN 'perdido'                 THEN 17
    WHEN 'cancelamento_solicitado' THEN 18
    WHEN 'projeto_futuro'          THEN 19
    ELSE 0   -- custom_1..custom_6: raias livres (isentas de retrocesso)
  END;
$$;

COMMENT ON FUNCTION public.ordem_etapa_fixa(text) IS
  'Ordem de NEGÓCIO das etapas de deal (texto). Espelho de ETAPA_ORDEM (apps/crm/src/types/crm.ts) — tests/etapas-plano-escolhido-invariants.test.js compara as duas.';

-- Mesma assinatura de sempre: o ::text evita cast de literal para o enum
-- (a função compila mesmo antes do valor novo existir).
CREATE OR REPLACE FUNCTION public.ordem_etapa(p_etapa status_deal)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.ordem_etapa_fixa(p_etapa::text);
$$;

-- ─── 2. Ordem do board (configurada pelo CEO) ───────────────────────────
-- Pura: recebe o JSON de etapas_deal_config. NULL = "sem ordem de board
-- comparável" (etapa oculta, sem 'order' explícito, fora do board ou config
-- inválida). Visibilidade espelha mergeDealStageConfig: 'oculta' booleano
-- explícito vence; sem ele, slots custom_% e plano_escolhido nascem ocultos
-- (DEAL_STAGE_CONFIG.ocultaPorPadrao); as demais, visíveis.
CREATE OR REPLACE FUNCTION public.ordem_etapa_board(p_etapa text, p_cfg jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_etapa IS NULL OR p_cfg IS NULL THEN NULL
    WHEN jsonb_typeof(p_cfg) IS DISTINCT FROM 'object' THEN NULL
    -- não são colunas do Kanban (PIPELINE_STAGE_ORDER)
    WHEN p_etapa IN ('cancelamento_solicitado', 'projeto_futuro') THEN NULL
    WHEN jsonb_typeof(p_cfg -> p_etapa) IS DISTINCT FROM 'object' THEN NULL
    WHEN jsonb_typeof(p_cfg -> p_etapa -> 'order') IS DISTINCT FROM 'number' THEN NULL
    WHEN COALESCE(
           CASE WHEN jsonb_typeof(p_cfg -> p_etapa -> 'oculta') = 'boolean'
                THEN (p_cfg -> p_etapa ->> 'oculta')::boolean END,
           (p_etapa LIKE 'custom\_%' OR p_etapa = 'plano_escolhido')
         ) THEN NULL
    ELSE (p_cfg -> p_etapa ->> 'order')::numeric
  END;
$$;

-- STABLE: lê configuracoes_sistema. NUNCA usar em índice/coluna gerada.
CREATE OR REPLACE FUNCTION public.ordem_etapa_board(p_etapa status_deal)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT public.ordem_etapa_board(
    p_etapa::text,
    (SELECT c.valor FROM public.configuracoes_sistema c WHERE c.chave = 'etapas_deal_config')
  );
$$;

COMMENT ON FUNCTION public.ordem_etapa_board(status_deal) IS
  'Ordem da etapa no board configurado pelo CEO (etapas_deal_config) — NULL quando oculta/sem ordem explícita. STABLE (lê tabela): proibido em índice.';

-- ─── 3. Regra única de retrocesso ───────────────────────────────────────
-- Espelho exato de isRetrocessoEtapa (apps/crm/src/lib/etapas-ordem.ts).
CREATE OR REPLACE FUNCTION public.etapa_e_retrocesso(p_de text, p_para text, p_cfg jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_de IS NULL OR p_para IS NULL OR p_de = p_para THEN false
    -- isenções de sempre (20260706173000 + 20260904120000)
    WHEN p_para IN ('perdido', 'cancelamento_solicitado', 'projeto_futuro', 'aguardando_timing') THEN false
    WHEN p_de = 'aguardando_timing' THEN false
    WHEN p_para LIKE 'custom\_%' OR p_de LIKE 'custom\_%' THEN false
    -- mesma escala: as duas no board com ordem explícita e distinta
    WHEN public.ordem_etapa_board(p_de, p_cfg) IS NOT NULL
     AND public.ordem_etapa_board(p_para, p_cfg) IS NOT NULL
     AND public.ordem_etapa_board(p_de, p_cfg) <> public.ordem_etapa_board(p_para, p_cfg)
      THEN public.ordem_etapa_board(p_para, p_cfg) < public.ordem_etapa_board(p_de, p_cfg)
    -- senão: ordem fixa para AS DUAS
    ELSE public.ordem_etapa_fixa(p_para) < public.ordem_etapa_fixa(p_de)
  END;
$$;

COMMENT ON FUNCTION public.etapa_e_retrocesso(text, text, jsonb) IS
  'Regra única de retrocesso de deal (isenções + ordem do board quando as duas etapas estão visíveis com ordem explícita; senão ordem fixa). Espelho: isRetrocessoEtapa em apps/crm/src/lib/etapas-ordem.ts.';

-- ─── 4. Trigger: retrocesso pela regra única ────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_deals_check_etapa()
RETURNS TRIGGER AS $$
DECLARE
  v_cfg jsonb;
BEGIN
  -- Só processa se a etapa mudou
  IF OLD.etapa IS DISTINCT FROM NEW.etapa THEN
    -- Salva etapa anterior
    NEW.etapa_anterior := OLD.etapa;

    -- Ordem do board do CEO. Falha de leitura NUNCA aborta o UPDATE: cai na
    -- ordem fixa (v_cfg NULL) e deixa rastro no log do Postgres.
    BEGIN
      SELECT c.valor INTO v_cfg
      FROM public.configuracoes_sistema c
      WHERE c.chave = 'etapas_deal_config';
    EXCEPTION WHEN OTHERS THEN
      v_cfg := NULL;
      RAISE WARNING 'trg_deals_check_etapa: etapas_deal_config ilegível — ordem fixa (deal=%, erro=%)',
        NEW.id, SQLERRM;
    END;

    -- Retrocesso: regra única (isenções + mesma escala). O trigger só LIGA a
    -- flag; motivo_retrocesso é validado na aplicação (moverDeal).
    IF public.etapa_e_retrocesso(OLD.etapa::text, NEW.etapa::text, v_cfg) THEN
      NEW.flag_retrocedido := true;
    END IF;

    -- Seta timestamps de marcos (inalterado)
    IF NEW.etapa = 'reuniao_realizada' AND OLD.etapa != 'reuniao_realizada' THEN
      NEW.reuniao_realizada_at := COALESCE(NEW.reuniao_realizada_at, NOW());
    END IF;
    IF NEW.etapa = 'contrato_enviado' AND OLD.etapa != 'contrato_enviado' THEN
      NEW.contrato_enviado_at := COALESCE(NEW.contrato_enviado_at, NOW());
    END IF;
    IF NEW.etapa = 'contrato_assinado' AND OLD.etapa != 'contrato_assinado' THEN
      NEW.contrato_assinado_at := COALESCE(NEW.contrato_assinado_at, NOW());
    END IF;
    IF NEW.etapa = 'sinal_pago' AND OLD.etapa != 'sinal_pago' THEN
      NEW.sinal_pago_at := COALESCE(NEW.sinal_pago_at, NOW());
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── 5. Handoff: plano_escolhido abre a jornada como o sinal ────────────
-- Cópia fiel da versão de 20260811142100 + plano_escolhido. Comparações por
-- ::text (sem cast de literal para o enum).
CREATE OR REPLACE FUNCTION public.trg_create_experiencia_on_admission()
RETURNS TRIGGER AS $$
DECLARE
  v_existing UUID;
  v_fase_destino fase_experiencia;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.etapa::text IN ('sinal_pago', 'plano_escolhido', 'admission_process', 'concluido'))
     OR (TG_OP = 'UPDATE'
         AND NEW.etapa::text IN ('sinal_pago', 'plano_escolhido', 'admission_process', 'concluido')
         AND COALESCE(OLD.etapa::text, '') IS DISTINCT FROM NEW.etapa::text)
  THEN
    v_fase_destino := CASE NEW.etapa::text
      WHEN 'sinal_pago'        THEN 'envio_opcoes'::fase_experiencia
      WHEN 'plano_escolhido'   THEN 'envio_opcoes'::fase_experiencia
      WHEN 'concluido'         THEN 'acompanhamento'::fase_experiencia
      ELSE 'admissao'::fase_experiencia
    END;

    BEGIN
      SELECT id INTO v_existing
      FROM public.crm_experiencia
      WHERE atleta_id = NEW.atleta_id
      LIMIT 1;

      IF v_existing IS NULL THEN
        INSERT INTO public.crm_experiencia (
          atleta_id, deal_id, fase, temperatura,
          ansiedade, satisfacao, risco_percebido,
          status, psicologa_acionada
        ) VALUES (
          NEW.atleta_id, NEW.id, v_fase_destino, 'verde',
          3, 5, 1, 'satisfeita', FALSE
        );
      ELSE
        -- Só AVANÇA a jornada: nunca puxa uma família de volta.
        UPDATE public.crm_experiencia
        SET fase = v_fase_destino
        WHERE id = v_existing
          AND fase::text NOT IN ('encerrado')
          AND (
            (v_fase_destino = 'acompanhamento' AND fase::text NOT IN ('acompanhamento', 'encerrado'))
            OR (v_fase_destino = 'admissao' AND fase::text IN ('envio_opcoes'))
            -- 'envio_opcoes' nunca aparece aqui: o ganho só CRIA a jornada;
            -- família existente jamais é rebaixada para o primeiro passo.
          );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'trg_create_experiencia_on_admission: % (deal=%, atleta=%)',
        SQLERRM, NEW.id, NEW.atleta_id;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.trg_create_experiencia_on_admission() IS
  'Auto-handoff defensivo: cria crm_experiencia ao deal entrar em sinal_pago / plano_escolhido (ganho, fase envio_opcoes) / admission_process / concluido. NUNCA aborta o UPDATE no deal (EXCEPTION handler).';

-- ─── 6a. Probabilidade da etapa nova (existente vence) ──────────────────
UPDATE public.configuracoes_sistema
SET valor = '{"plano_escolhido": 97}'::jsonb || valor,
    updated_at = NOW()
WHERE chave = 'probabilidade_por_etapa'
  AND jsonb_typeof(valor) = 'object'
  AND NOT (valor ? 'plano_escolhido');

-- ─── 6b. Regras de comportamento por coluna (chave NOVA) ────────────────
-- {etapa: {ganho?, pede_plano?, acao_padrao?: {texto, dias}}}
--   • ganho      — só vale para slots custom_* (etapas fixas têm a semântica
--                  no código e não são configuráveis). Semeado nas colunas
--                  que o CEO já nomeou "Admitido" e "Valor total pago".
--   • pede_plano — soltar card sem plano abre a escolha de plano (T10).
--   • acao_padrao— próxima ação aplicada ao ENTRAR na coluna (T21), exceto
--                  quando a ação atual foi escrita à mão.
-- ON CONFLICT DO NOTHING: re-rodar nunca sobrescreve a edição do CEO.
INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
VALUES (
  'etapas_deal_regras',
  '{
    "reuniao_realizada": {"acao_padrao": {"texto": "Enviar a proposta", "dias": 1}},
    "proposta_enviada":  {"acao_padrao": {"texto": "Fazer follow-up da proposta", "dias": 2}},
    "contrato_enviado":  {"acao_padrao": {"texto": "Confirmar a assinatura do contrato", "dias": 2}},
    "contrato_assinado": {"acao_padrao": {"texto": "Confirmar o pagamento do sinal", "dias": 2}},
    "sinal_pago":        {"acao_padrao": {"texto": "Definir o plano com a família", "dias": 3}},
    "plano_escolhido":   {"pede_plano": true, "acao_padrao": {"texto": "Iniciar o processo de admissão", "dias": 7}}
  }'::jsonb
  || COALESCE((
       SELECT jsonb_object_agg(e.k, '{"ganho": true}'::jsonb)
       FROM public.configuracoes_sistema c,
            LATERAL jsonb_each(c.valor) AS e(k, v)
       WHERE c.chave = 'etapas_deal_config'
         AND jsonb_typeof(c.valor) = 'object'
         AND e.k ~ '^custom_[1-6]$'
         AND jsonb_typeof(e.v) = 'object'
         AND lower(btrim(e.v ->> 'label')) IN ('admitido', 'valor total pago')
     ), '{}'::jsonb),
  'Regras de comportamento por coluna do pipeline (não de exibição): {"<etapa>": {"ganho": bool (só colunas personalizadas custom_*), "pede_plano": bool, "acao_padrao": {"texto": "3-120 chars", "dias": 0-60}}}. ganho=true faz a coluna contar como negócio ganho (métricas, War Room, remarketing, chatbot). pede_plano abre a escolha de plano ao soltar um card sem plano. acao_padrao vira a próxima ação do deal ao entrar na coluna, exceto quando a ação atual foi escrita à mão.'
)
ON CONFLICT (chave) DO NOTHING;

-- ─── UAT / DEV ───────────────────────────────────────────────────────────
-- Gate por TABELA (uat/dev hoje NÃO têm deals nem configuracoes_sistema): o
-- enum, as funções e os triggers acima vivem em public e só public.deals os
-- usa. Se um dia uat/dev ganharem configuracoes_sistema, recebem a chave
-- nova vazia (o código cai nos defaults).
DO $$
BEGIN
  IF to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $q$INSERT INTO uat.configuracoes_sistema (chave, valor, descricao)
      VALUES ('etapas_deal_regras', '{}'::jsonb, 'Regras de comportamento por coluna do pipeline (ver public).')
      ON CONFLICT (chave) DO NOTHING$q$;
  END IF;
  IF to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $q$INSERT INTO dev.configuracoes_sistema (chave, valor, descricao)
      VALUES ('etapas_deal_regras', '{}'::jsonb, 'Regras de comportamento por coluna do pipeline (ver public).')
      ON CONFLICT (chave) DO NOTHING$q$;
  END IF;
END $$;
