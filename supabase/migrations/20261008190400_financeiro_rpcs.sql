-- ════════════════════════════════════════════════════════════════════════
-- Migration: Financeiro — RPCs atômicas do contrato (T5/T9/T10/T11/T18)
-- Aplica em: public (as tabelas financeiras existem SÓ em public; o Engine lê
--   public em todo ambiente). Funções plpgsql não validam tabelas na criação,
--   mas cada uma checa o papel e falha com mensagem clara.
--
-- Por que RPC (e não N chamadas supabase-js):
--   1. ATOMICIDADE — editar contrato = soft delete de parcelas em aberto +
--      inserts + update + validação de soma. Com N requests, uma falha no meio
--      deixava o contrato incoerente (dinheiro!).
--   2. AUTOR NO AUDIT — set_audit_user() é transaction-local; chamado DENTRO
--      da RPC, o audit.log_change de todas as linhas da operação recebe o
--      user_id (hoje 0 de ~15 mil linhas têm autor — ver fix do grupo escolas
--      20261008170100, que é complementar).
--   3. CAS/LOCK — SELECT ... FOR UPDATE no contrato serializa baixa × edição;
--      token de versão (fin_versao_contrato) detecta edição concorrente.
--
-- SECURITY INVOKER (padrão): a RLS de contratos/parcelas (CEO = ALL) continua
-- valendo; fin_exigir_ceo() dá a mensagem clara antes. search_path fixo.
-- Erros: RAISE EXCEPTION 'FIN_<CODIGO>: <mensagem pt-BR>' — o TS mapeia o
-- prefixo para Result { code, error }.
-- Compatível com o código antigo: só CRIA funções novas (nenhuma existente
-- muda). Idempotente (CREATE OR REPLACE).
-- ════════════════════════════════════════════════════════════════════════

-- ─── Helpers ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fin_exigir_ceo()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.get_user_papel() IS DISTINCT FROM 'ceo' THEN
    RAISE EXCEPTION 'FIN_PERMISSAO: apenas CEO/CTO podem alterar dados financeiros.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Data local (BRT) — "hoje" do negócio, não do UTC do servidor.
CREATE OR REPLACE FUNCTION public.fin_hoje()
RETURNS date
LANGUAGE sql
STABLE
AS $$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date $$;

-- Data de pagamento (YYYY-MM-DD) → timestamptz ao meio-dia BRT (não escorrega
-- de dia por fuso ao exibir).
CREATE OR REPLACE FUNCTION public.fin_data_ao_meio_dia(p_data date)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$ SELECT (p_data::text || ' 12:00:00-03')::timestamptz $$;

CREATE OR REPLACE FUNCTION public.fin_metodo_da_forma(p_forma text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_forma
    WHEN 'pix' THEN 'pix'
    WHEN 'pix_avista' THEN 'pix'
    WHEN 'pix_parcelado' THEN 'pix'
    WHEN 'getnet_parcelado' THEN 'getnet'
    WHEN 'transferencia' THEN 'transferencia'
    WHEN 'boleto' THEN 'boleto'
    WHEN 'cartao' THEN 'cartao'
    WHEN 'dinheiro' THEN 'dinheiro'
    WHEN 'outro' THEN 'outro'
  END
$$;

-- Preço de TABELA do plano: fonte única = configuracoes_sistema.planos
-- (editável em Configurações). PLANO_VALORES do código só como fallback.
CREATE OR REPLACE FUNCTION public.fin_valor_tabela(p_plano text, p_forma text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cfg jsonb;
  v numeric;
BEGIN
  IF p_plano IS NULL OR p_plano = 'personalizado' THEN
    RETURN NULL;
  END IF;
  SELECT valor INTO v_cfg FROM configuracoes_sistema WHERE chave = 'planos';
  BEGIN
    v := CASE WHEN p_forma = 'pix_avista'
              THEN (v_cfg -> p_plano ->> 'valor_pix')::numeric
              ELSE (v_cfg -> p_plano ->> 'valor')::numeric END;
  EXCEPTION WHEN others THEN
    v := NULL; -- config malformada → fallback
  END;
  IF v IS NULL OR v <= 0 THEN
    v := CASE p_plano || ':' || COALESCE(p_forma, 'padrao')
      WHEN 'journey:padrao' THEN 26000 WHEN 'journey:pix_avista' THEN 23000
      WHEN 'legacy:padrao'  THEN 32000 WHEN 'legacy:pix_avista'  THEN 28500
      WHEN 'start:padrao'   THEN 18000 WHEN 'start:pix_avista'   THEN 16000
    END;
  END IF;
  RETURN v;
END;
$$;

-- Token de versão do contrato (CAS otimista): qualquer mudança no contrato,
-- nas parcelas ou nos itens muda o token.
CREATE OR REPLACE FUNCTION public.fin_versao_contrato(p_contrato_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT md5(concat_ws('|',
    (SELECT updated_at::text FROM contratos_financeiros WHERE id = p_contrato_id),
    (SELECT COALESCE(max(updated_at)::text, '-') || ':' || count(*)
       FROM parcelas WHERE contrato_id = p_contrato_id),
    (SELECT COALESCE(max(updated_at)::text, '-') || ':' || count(*)
       FROM contrato_itens WHERE contrato_id = p_contrato_id)
  ))
$$;

-- entrada_paga = TODAS as parcelas de entrada vivas recebidas (T5).
-- Retorna true quando TRANSICIONOU false→true nesta chamada.
CREATE OR REPLACE FUNCTION public.fin_recalcular_entrada_paga(p_contrato_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total int;
  v_abertas int;
  v_ultima timestamptz;
  v_paga boolean;
  v_antes boolean;
BEGIN
  PERFORM fin_exigir_ceo();
  SELECT count(*), count(*) FILTER (WHERE status <> 'recebido'), max(recebido_at)
    INTO v_total, v_abertas, v_ultima
    FROM parcelas
   WHERE contrato_id = p_contrato_id AND tipo = 'entrada'
     AND deleted_at IS NULL AND status <> 'cancelado';

  v_paga := v_total > 0 AND v_abertas = 0;

  SELECT entrada_paga INTO v_antes FROM contratos_financeiros WHERE id = p_contrato_id;

  UPDATE contratos_financeiros
     SET entrada_paga = v_paga,
         entrada_paga_at = CASE WHEN v_paga THEN v_ultima ELSE NULL END
   WHERE id = p_contrato_id
     AND (entrada_paga IS DISTINCT FROM v_paga
          OR entrada_paga_at IS DISTINCT FROM CASE WHEN v_paga THEN v_ultima ELSE NULL END);

  RETURN v_paga AND NOT COALESCE(v_antes, false);
END;
$$;

-- Prova de sinal no DEAL (T11): sinal_pago_confirmado_por + data REAL do
-- pagamento. NUNCA mexe na etapa (quem move é o app, pela ordem do board).
-- Retorna true na 1ª confirmação (para XP/handoff).
CREATE OR REPLACE FUNCTION public.fin_confirmar_sinal_no_deal(p_deal_id uuid, p_pago_em timestamptz)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM fin_exigir_ceo();
  UPDATE deals
     SET sinal_pago_confirmado_por = auth.uid(),
         sinal_pago_at = p_pago_em
   WHERE id = p_deal_id
     AND deleted_at IS NULL
     AND sinal_pago_confirmado_por IS NULL
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

-- Estorno do último sinal recebido: o deal perde a PROVA de sinal (etapa não
-- muda — retroceder é decisão humana no board).
CREATE OR REPLACE FUNCTION public.fin_desconfirmar_sinal_se_vazio(p_contrato_id uuid, p_deal_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM fin_exigir_ceo();
  IF EXISTS (
    SELECT 1 FROM parcelas
     WHERE contrato_id = p_contrato_id AND tipo = 'entrada'
       AND status = 'recebido' AND deleted_at IS NULL
  ) THEN
    RETURN false;
  END IF;
  UPDATE deals SET sinal_pago_confirmado_por = NULL
   WHERE id = p_deal_id AND sinal_pago_confirmado_por IS NOT NULL
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

-- Invariantes de dinheiro (usada pelas RPCs que REMONTAM cronograma):
--   • composição: valor_total = base + Σ itens + (sinal_abatido ? 0 : entrada)
--     (só quando valor_base_plano não é NULL — legado fica de fora);
--   • Σ parcelas de entrada vivas = entrada_valor;
--   • Σ parcelas de saldo vivas = saldo_remanescente (quando há saldo definido).
CREATE OR REPLACE FUNCTION public.fin_validar_contrato(p_contrato_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  c contratos_financeiros%ROWTYPE;
  v_itens numeric;
  v_esperado numeric;
  v_ent numeric;
  v_sal numeric;
  v_qtd_sal int;
  v_qtd_ent int;
BEGIN
  SELECT * INTO c FROM contratos_financeiros WHERE id = p_contrato_id;

  SELECT COALESCE(sum(valor), 0) INTO v_itens
    FROM contrato_itens WHERE contrato_id = p_contrato_id AND deleted_at IS NULL;

  IF c.plano IS NULL THEN
    IF v_itens <> 0 THEN
      RAISE EXCEPTION 'FIN_ITENS_SEM_PLANO: escolha o plano antes de lançar serviços/descontos.';
    END IF;
  ELSIF c.valor_base_plano IS NOT NULL THEN
    v_esperado := c.valor_base_plano + v_itens
                  + CASE WHEN c.sinal_abatido THEN 0 ELSE c.entrada_valor END;
    IF v_esperado <> c.valor_total THEN
      RAISE EXCEPTION 'FIN_COMPOSICAO: valor total (%) difere de plano + itens (%).', c.valor_total, v_esperado;
    END IF;
  END IF;

  SELECT COALESCE(sum(valor) FILTER (WHERE tipo = 'entrada'), 0),
         COALESCE(sum(valor) FILTER (WHERE tipo = 'saldo'), 0),
         count(*) FILTER (WHERE tipo = 'saldo'),
         count(*) FILTER (WHERE tipo = 'entrada')
    INTO v_ent, v_sal, v_qtd_sal, v_qtd_ent
    FROM parcelas
   WHERE contrato_id = p_contrato_id AND deleted_at IS NULL AND status <> 'cancelado';

  IF v_ent <> c.entrada_valor THEN
    RAISE EXCEPTION 'FIN_CRONOGRAMA_ENTRADA: parcelas de entrada somam % e a entrada é %.', v_ent, c.entrada_valor;
  END IF;

  IF c.plano IS NULL AND v_qtd_sal > 0 THEN
    RAISE EXCEPTION 'FIN_SALDO_SEM_PLANO: contrato aguardando plano não tem saldo.';
  END IF;

  IF c.saldo_forma IS NOT NULL OR v_qtd_sal > 0 THEN
    IF v_sal <> c.saldo_remanescente THEN
      RAISE EXCEPTION 'FIN_CRONOGRAMA_SALDO: parcelas de saldo somam % e o saldo é %.', v_sal, c.saldo_remanescente;
    END IF;
  END IF;
END;
$$;

-- Insere uma lista de parcelas (gerada no servidor TS por calculo.mjs).
-- Valida cada item; nunca confia em status fora de previsto/recebido.
CREATE OR REPLACE FUNCTION public.fin_inserir_parcelas(p_contrato_id uuid, p_tipo text, p_lista jsonb)
RETURNS int
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  e jsonb;
  v_n int := 0;
  v_status text;
  v_valor numeric;
  v_venc date;
  v_metodo text;
BEGIN
  PERFORM fin_exigir_ceo();
  IF p_lista IS NULL OR jsonb_typeof(p_lista) <> 'array' THEN
    RETURN 0;
  END IF;
  IF jsonb_array_length(p_lista) > 60 THEN
    RAISE EXCEPTION 'FIN_PARCELAS_DEMAIS: máximo de 60 parcelas por grupo.';
  END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(p_lista) LOOP
    v_valor  := (e ->> 'valor')::numeric;
    v_venc   := (e ->> 'vencimento')::date;
    v_metodo := e ->> 'metodo';
    v_status := COALESCE(e ->> 'status', 'previsto');
    IF v_valor IS NULL OR v_valor <= 0 OR round(v_valor, 2) <> v_valor THEN
      RAISE EXCEPTION 'FIN_PARCELA_VALOR: valor de parcela inválido (%).', e ->> 'valor';
    END IF;
    IF v_venc IS NULL THEN
      RAISE EXCEPTION 'FIN_PARCELA_VENCIMENTO: vencimento ausente.';
    END IF;
    IF v_metodo IS NULL OR v_metodo NOT IN ('pix','getnet','transferencia','boleto','cartao','dinheiro','outro') THEN
      RAISE EXCEPTION 'FIN_METODO: método de pagamento da parcela inválido (%).', v_metodo;
    END IF;
    IF v_status NOT IN ('previsto', 'recebido') THEN
      RAISE EXCEPTION 'FIN_PARCELA_STATUS: status inicial inválido (%).', v_status;
    END IF;
    IF v_status = 'recebido' AND (e ->> 'recebido_em')::date > fin_hoje() THEN
      RAISE EXCEPTION 'FIN_DATA_FUTURA: pagamento não pode ter data futura.';
    END IF;
    INSERT INTO parcelas (
      contrato_id, tipo, numero_parcela, valor, vencimento, metodo, status,
      recebido_at, parcelas_cartao, comprovante_url, observacao, created_by
    ) VALUES (
      p_contrato_id, p_tipo,
      COALESCE(NULLIF(btrim(e ->> 'numero_parcela'), ''), CASE p_tipo WHEN 'entrada' THEN 'Entrada' ELSE 'Saldo' END),
      v_valor,
      v_venc,
      v_metodo,
      -- status 'atrasado' é marcado pela régua/leitura; nasce previsto
      v_status::status_parcela,
      CASE WHEN v_status = 'recebido'
           THEN fin_data_ao_meio_dia(COALESCE((e ->> 'recebido_em')::date, v_venc))
           ELSE NULL END,
      NULLIF(e ->> 'parcelas_cartao', '')::smallint,
      NULLIF(btrim(e ->> 'comprovante_url'), ''),
      NULLIF(btrim(e ->> 'observacao'), ''),
      auth.uid()
    );
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

-- Soft delete das parcelas EM ABERTO de um grupo (ids novos na regeração:
-- a régua não herda marcos antigos). Recebidas/canceladas nunca são tocadas.
CREATE OR REPLACE FUNCTION public.fin_descartar_abertas(p_contrato_id uuid, p_tipo text)
RETURNS int
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n int;
BEGIN
  PERFORM fin_exigir_ceo();
  UPDATE parcelas SET deleted_at = now()
   WHERE contrato_id = p_contrato_id AND tipo = p_tipo
     AND deleted_at IS NULL AND status IN ('previsto', 'atrasado');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- Itens (T18a): sincroniza a lista desejada (diff por id). Valida e devolve Σ.
CREATE OR REPLACE FUNCTION public.fin_sincronizar_itens(p_contrato_id uuid, p_itens jsonb)
RETURNS numeric
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  e jsonb;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
  v_tipo text;
  v_valor numeric;
  v_desc text;
  v_soma numeric;
BEGIN
  PERFORM fin_exigir_ceo();
  IF p_itens IS NULL THEN
    p_itens := '[]'::jsonb;
  END IF;
  IF jsonb_typeof(p_itens) <> 'array' OR jsonb_array_length(p_itens) > 30 THEN
    RAISE EXCEPTION 'FIN_ITENS: lista de itens inválida (máx. 30).';
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_tipo  := e ->> 'tipo';
    v_valor := (e ->> 'valor')::numeric;
    v_desc  := btrim(COALESCE(e ->> 'descricao', ''));
    IF v_tipo NOT IN ('servico', 'desconto', 'ajuste') THEN
      RAISE EXCEPTION 'FIN_ITENS: tipo de item inválido (%).', v_tipo;
    END IF;
    IF v_valor IS NULL OR round(v_valor, 2) <> v_valor
       OR (v_tipo = 'servico' AND v_valor <= 0)
       OR (v_tipo = 'desconto' AND v_valor >= 0)
       OR (v_tipo = 'ajuste' AND v_valor = 0) THEN
      RAISE EXCEPTION 'FIN_ITENS: valor inválido para % (%).', v_tipo, e ->> 'valor';
    END IF;
    IF char_length(v_desc) < 2 OR char_length(v_desc) > 160 THEN
      RAISE EXCEPTION 'FIN_ITENS: descrição do item deve ter de 2 a 160 caracteres.';
    END IF;

    v_id := NULLIF(e ->> 'id', '')::uuid;
    IF v_id IS NOT NULL THEN
      UPDATE contrato_itens
         SET tipo = v_tipo, valor = v_valor, descricao = v_desc,
             catalogo_chave = NULLIF(e ->> 'catalogo_chave', '')
       WHERE id = v_id AND contrato_id = p_contrato_id AND deleted_at IS NULL
         AND (tipo, valor, descricao, COALESCE(catalogo_chave, ''))
             IS DISTINCT FROM (v_tipo, v_valor, v_desc, COALESCE(NULLIF(e ->> 'catalogo_chave', ''), ''));
      IF NOT EXISTS (SELECT 1 FROM contrato_itens WHERE id = v_id AND contrato_id = p_contrato_id AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'FIN_ITENS: item % não pertence a este contrato.', v_id;
      END IF;
    ELSE
      INSERT INTO contrato_itens (contrato_id, tipo, descricao, valor, catalogo_chave)
      VALUES (p_contrato_id, v_tipo, v_desc, v_valor, NULLIF(e ->> 'catalogo_chave', ''))
      RETURNING id INTO v_id;
    END IF;
    v_ids := v_ids || v_id;
  END LOOP;

  UPDATE contrato_itens SET deleted_at = now()
   WHERE contrato_id = p_contrato_id AND deleted_at IS NULL
     AND NOT (id = ANY (v_ids));

  SELECT COALESCE(sum(valor), 0) INTO v_soma
    FROM contrato_itens WHERE contrato_id = p_contrato_id AND deleted_at IS NULL;
  RETURN v_soma;
END;
$$;

CREATE OR REPLACE FUNCTION public.fin_registrar_evento(
  p_contrato_id uuid, p_deal_id uuid, p_tipo text, p_justificativa text, p_detalhes jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM fin_exigir_ceo();
  INSERT INTO contrato_eventos (contrato_id, deal_id, tipo, justificativa, detalhes, created_by)
  VALUES (p_contrato_id, p_deal_id, p_tipo, NULLIF(btrim(p_justificativa), ''),
          COALESCE(p_detalhes, '{}'::jsonb), auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.fin_resultado(p_contrato_id uuid, p_extra jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'contrato_id', c.id,
    'deal_id', c.deal_id,
    'plano', c.plano,
    'valor_total', c.valor_total,
    'entrada_valor', c.entrada_valor,
    'entrada_paga', c.entrada_paga,
    'versao', fin_versao_contrato(c.id)
  ) || COALESCE(p_extra, '{}'::jsonb)
  FROM contratos_financeiros c WHERE c.id = p_contrato_id
$$;

-- ─── 1. Criar contrato completo (T6) — também ressuscita linha descartada ─
-- UNIQUE(deal_id) é completa (embed 1:1 = objeto): contrato descartado
-- (soft delete) é REUTILIZADO em vez de inserir outro (corrige o 23505 do
-- "Refazer contrato").
CREATE OR REPLACE FUNCTION public.fin_criar_contrato(p_deal_id uuid, p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deal deals%ROWTYPE;
  v_exist contratos_financeiros%ROWTYPE;
  v_id uuid;
  v_plano text := p_dados ->> 'plano';
  v_forma text := COALESCE(p_dados ->> 'forma_pagamento_plano', 'padrao');
  v_base numeric := (p_dados ->> 'valor_base_plano')::numeric;
  v_just text := btrim(COALESCE(p_dados ->> 'justificativa', ''));
  v_abatido boolean := COALESCE((p_dados ->> 'sinal_abatido')::boolean, true);
  v_ent jsonb := COALESCE(p_dados -> 'entrada', '{}'::jsonb);
  v_sal jsonb := COALESCE(p_dados -> 'saldo', '{}'::jsonb);
  v_ent_valor numeric := COALESCE((v_ent ->> 'valor')::numeric, 0);
  v_sal_forma text := NULLIF(v_sal ->> 'forma', '');
  v_tabela numeric;
  v_custom boolean;
  v_itens numeric;
  v_total numeric;
  v_ressuscitado boolean := false;
  v_sinal_agora boolean := false;
  v_primeiro_receb timestamptz;
  v_negociado boolean;
BEGIN
  PERFORM fin_exigir_ceo();
  PERFORM set_audit_user();

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_DEAL_NAO_ENCONTRADO: negócio não encontrado.';
  END IF;

  IF v_plano IS NULL OR v_plano NOT IN ('journey', 'legacy', 'start', 'personalizado') THEN
    RAISE EXCEPTION 'FIN_PLANO: escolha um plano válido.';
  END IF;
  IF v_forma NOT IN ('padrao', 'pix_avista') THEN
    RAISE EXCEPTION 'FIN_PLANO: forma de pagamento do plano inválida.';
  END IF;
  IF v_base IS NULL OR v_base <= 0 OR round(v_base, 2) <> v_base THEN
    RAISE EXCEPTION 'FIN_VALOR: informe o valor do plano.';
  END IF;
  IF v_ent_valor < 0 OR round(v_ent_valor, 2) <> v_ent_valor THEN
    RAISE EXCEPTION 'FIN_ENTRADA: valor de entrada inválido.';
  END IF;

  v_tabela := fin_valor_tabela(v_plano, v_forma);
  v_custom := v_tabela IS NULL OR v_base <> v_tabela;
  IF v_custom AND char_length(v_just) < 5 THEN
    RAISE EXCEPTION 'FIN_JUSTIFICATIVA: valor fora da tabela do plano exige justificativa (mín. 5 caracteres).';
  END IF;

  SELECT * INTO v_exist FROM contratos_financeiros WHERE deal_id = p_deal_id FOR UPDATE;
  IF FOUND AND v_exist.deleted_at IS NULL THEN
    RAISE EXCEPTION 'FIN_CONTRATO_EXISTE: este negócio já tem contrato — edite o existente.';
  END IF;

  IF FOUND THEN
    v_ressuscitado := true;
    v_id := v_exist.id;
    -- Parcelas/itens da vida anterior já estão com soft delete (descarte);
    -- garante que nada vivo sobrou.
    UPDATE parcelas SET deleted_at = now() WHERE contrato_id = v_id AND deleted_at IS NULL;
    UPDATE contrato_itens SET deleted_at = now() WHERE contrato_id = v_id AND deleted_at IS NULL;
    UPDATE contratos_financeiros SET
      plano = v_plano::plano_tipo, forma_pagamento_plano = v_forma,
      valor_base_plano = v_base, valor_total = v_base, entrada_valor = 0,
      entrada_forma = NULL, entrada_parcelas = 0, entrada_paga = false, entrada_paga_at = NULL,
      saldo_forma = NULL, saldo_parcelas = NULL, sinal_abatido = v_abatido,
      valor_customizado = NULL, justificativa_customizacao = NULL,
      nf_status = 'pendente', nf_numero = NULL, nf_emitida_at = NULL, nf_valor = NULL,
      lucro_estimado = NULL, plano_definido_at = now(),
      created_at = now(), deleted_at = NULL
    WHERE id = v_id;
  ELSE
    INSERT INTO contratos_financeiros (
      deal_id, plano, forma_pagamento_plano, valor_base_plano, valor_total,
      entrada_valor, entrada_forma, entrada_parcelas, sinal_abatido,
      plano_definido_at, created_by
    ) VALUES (
      p_deal_id, v_plano::plano_tipo, v_forma, v_base, v_base,
      0, NULL, 0, v_abatido, now(), auth.uid()
    ) RETURNING id INTO v_id;
  END IF;

  v_itens := fin_sincronizar_itens(v_id, p_dados -> 'itens');
  v_total := v_base + v_itens + CASE WHEN v_abatido THEN 0 ELSE v_ent_valor END;
  -- Regra 3 completa: o valor do contrato difere da tabela também por itens
  -- (serviços/descontos/ajustes) ou por sinal cobrado à parte.
  v_negociado := v_custom OR v_itens <> 0 OR (NOT v_abatido AND v_ent_valor > 0);
  IF v_negociado AND char_length(v_just) < 5 THEN
    RAISE EXCEPTION 'FIN_JUSTIFICATIVA: condições fora da tabela (valor do plano, serviços, descontos, ajustes ou sinal à parte) exigem justificativa (mín. 5 caracteres).';
  END IF;
  IF v_total < v_ent_valor OR v_total <= 0 THEN
    RAISE EXCEPTION 'FIN_VALOR_TOTAL: valor total (%) menor que a entrada (%).', v_total, v_ent_valor;
  END IF;
  IF v_total - v_ent_valor > 0 AND v_sal_forma IS NOT NULL
     AND jsonb_array_length(COALESCE(v_sal -> 'parcelas', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'FIN_CRONOGRAMA_SALDO: informe as parcelas do saldo.';
  END IF;

  PERFORM fin_inserir_parcelas(v_id, 'entrada', v_ent -> 'parcelas');
  IF v_sal_forma IS NOT NULL THEN
    PERFORM fin_inserir_parcelas(v_id, 'saldo', v_sal -> 'parcelas');
  END IF;

  UPDATE contratos_financeiros SET
    valor_total = v_total,
    valor_customizado = CASE WHEN v_negociado THEN v_total ELSE NULL END,
    justificativa_customizacao = CASE WHEN v_negociado THEN v_just ELSE NULL END,
    entrada_valor = v_ent_valor,
    entrada_forma = CASE WHEN v_ent_valor > 0 THEN v_ent ->> 'forma' ELSE NULL END,
    entrada_parcelas = (SELECT count(*) FROM parcelas WHERE contrato_id = v_id AND tipo = 'entrada' AND deleted_at IS NULL),
    saldo_forma = v_sal_forma,
    saldo_parcelas = CASE WHEN v_sal_forma IS NULL THEN NULL
                          ELSE (SELECT count(*) FROM parcelas WHERE contrato_id = v_id AND tipo = 'saldo' AND deleted_at IS NULL) END,
    inclui_psicologa = COALESCE((p_dados ->> 'inclui_psicologa')::boolean, false),
    custo_psicologa = CASE WHEN COALESCE((p_dados ->> 'inclui_psicologa')::boolean, false)
                           THEN COALESCE((p_dados ->> 'custo_psicologa')::numeric, 0) ELSE 0 END
  WHERE id = v_id;

  PERFORM fin_recalcular_entrada_paga(v_id);
  SELECT min(recebido_at) INTO v_primeiro_receb
    FROM parcelas WHERE contrato_id = v_id AND tipo = 'entrada' AND status = 'recebido' AND deleted_at IS NULL;
  IF v_primeiro_receb IS NOT NULL THEN
    v_sinal_agora := fin_confirmar_sinal_no_deal(p_deal_id, v_primeiro_receb);
  END IF;

  PERFORM fin_validar_contrato(v_id);
  PERFORM fin_registrar_evento(v_id, p_deal_id, 'contrato_criado',
    CASE WHEN v_negociado THEN v_just ELSE NULL END,
    jsonb_build_object('plano', v_plano, 'valor_total', v_total, 'valor_base_plano', v_base,
                       'itens', v_itens, 'entrada', v_ent_valor, 'saldo_forma', v_sal_forma,
                       'ressuscitado', v_ressuscitado,
                       'created_at_anterior', CASE WHEN v_ressuscitado THEN v_exist.created_at END));

  RETURN fin_resultado(v_id, jsonb_build_object('sinal_confirmado_agora', v_sinal_agora,
                                                'etapa', v_deal.etapa, 'ressuscitado', v_ressuscitado));
END;
$$;

-- ─── 2. Registrar sinal SEM plano (T11) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_registrar_sinal(p_deal_id uuid, p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deal deals%ROWTYPE;
  v_c contratos_financeiros%ROWTYPE;
  v_id uuid;
  v_valor numeric := (p_dados ->> 'valor')::numeric;
  v_forma text := p_dados ->> 'forma';
  v_data date := (p_dados ->> 'data_pagamento')::date;
  v_cartao int := NULLIF(p_dados ->> 'parcelas_cartao', '')::int;
  v_n int;
  v_sinal_agora boolean;
  v_criado boolean := false;
BEGIN
  PERFORM fin_exigir_ceo();
  PERFORM set_audit_user();

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_DEAL_NAO_ENCONTRADO: negócio não encontrado.';
  END IF;
  IF v_valor IS NULL OR v_valor <= 0 OR round(v_valor, 2) <> v_valor THEN
    RAISE EXCEPTION 'FIN_VALOR: informe o valor do sinal.';
  END IF;
  IF v_forma IS NULL OR v_forma NOT IN ('pix','getnet_parcelado','transferencia','boleto','cartao','dinheiro','outro') THEN
    RAISE EXCEPTION 'FIN_FORMA: escolha a forma de pagamento do sinal.';
  END IF;
  IF v_data IS NULL OR v_data > fin_hoje() OR v_data < DATE '2020-01-01' THEN
    RAISE EXCEPTION 'FIN_DATA_FUTURA: data do pagamento inválida (não pode ser futura).';
  END IF;
  IF v_cartao IS NOT NULL AND (v_cartao < 1 OR v_cartao > 24 OR v_forma NOT IN ('getnet_parcelado', 'cartao')) THEN
    RAISE EXCEPTION 'FIN_FORMA: vezes no cartão só para Getnet/cartão (1 a 24).';
  END IF;

  SELECT * INTO v_c FROM contratos_financeiros WHERE deal_id = p_deal_id FOR UPDATE;

  IF FOUND AND v_c.deleted_at IS NULL AND v_c.plano IS NOT NULL THEN
    RAISE EXCEPTION 'FIN_CONTRATO_COM_PLANO: este contrato já tem plano — dê baixa na parcela de entrada.';
  END IF;

  IF NOT FOUND THEN
    INSERT INTO contratos_financeiros (
      deal_id, plano, forma_pagamento_plano, valor_total, entrada_valor,
      entrada_forma, entrada_parcelas, sinal_abatido, created_by
    ) VALUES (p_deal_id, NULL, NULL, 0, 0, NULL, 0, true, auth.uid())
    RETURNING * INTO v_c;
    v_criado := true;
  ELSIF v_c.deleted_at IS NOT NULL THEN
    UPDATE parcelas SET deleted_at = now() WHERE contrato_id = v_c.id AND deleted_at IS NULL;
    UPDATE contrato_itens SET deleted_at = now() WHERE contrato_id = v_c.id AND deleted_at IS NULL;
    UPDATE contratos_financeiros SET
      plano = NULL, forma_pagamento_plano = NULL, valor_base_plano = NULL,
      valor_total = 0, entrada_valor = 0, entrada_forma = NULL, entrada_parcelas = 0,
      entrada_paga = false, entrada_paga_at = NULL, saldo_forma = NULL, saldo_parcelas = NULL,
      sinal_abatido = true, valor_customizado = NULL, justificativa_customizacao = NULL,
      nf_status = 'pendente', nf_numero = NULL, nf_emitida_at = NULL, nf_valor = NULL,
      lucro_estimado = NULL, plano_definido_at = NULL, created_at = now(), deleted_at = NULL
    WHERE id = v_c.id
    RETURNING * INTO v_c;
    v_criado := true;
  END IF;
  v_id := v_c.id;

  SELECT count(*) INTO v_n FROM parcelas
   WHERE contrato_id = v_id AND tipo = 'entrada' AND deleted_at IS NULL;

  PERFORM fin_inserir_parcelas(v_id, 'entrada', jsonb_build_array(jsonb_build_object(
    'numero_parcela', CASE WHEN v_n = 0 THEN 'Sinal' ELSE 'Sinal ' || (v_n + 1) END,
    'valor', v_valor,
    'vencimento', v_data,
    'metodo', fin_metodo_da_forma(v_forma),
    'status', 'recebido',
    'recebido_em', v_data,
    'parcelas_cartao', v_cartao,
    'comprovante_url', p_dados ->> 'comprovante_url',
    'observacao', p_dados ->> 'observacao'
  )));

  -- Aguardando plano: total = Σ sinais (CHECK contratos_financeiros_aguardando_plano_check).
  UPDATE contratos_financeiros SET
    entrada_valor = entrada_valor + v_valor,
    valor_total = valor_total + v_valor,
    entrada_forma = COALESCE(entrada_forma, v_forma),
    entrada_parcelas = v_n + 1
  WHERE id = v_id;

  PERFORM fin_recalcular_entrada_paga(v_id);
  v_sinal_agora := fin_confirmar_sinal_no_deal(p_deal_id, fin_data_ao_meio_dia(v_data));
  PERFORM fin_validar_contrato(v_id);
  PERFORM fin_registrar_evento(v_id, p_deal_id, 'sinal_registrado', p_dados ->> 'observacao',
    jsonb_build_object('valor', v_valor, 'forma', v_forma, 'data_pagamento', v_data,
                       'parcelas_cartao', v_cartao, 'contrato_criado', v_criado));

  RETURN fin_resultado(v_id, jsonb_build_object('sinal_confirmado_agora', v_sinal_agora,
                                                'etapa', v_deal.etapa));
END;
$$;

-- ─── 3. Salvar condições: escolher plano (T10) / editar contrato (T9/T18a) ─
CREATE OR REPLACE FUNCTION public.fin_salvar_condicoes(p_contrato_id uuid, p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  c contratos_financeiros%ROWTYPE;
  v_antes jsonb;
  v_plano text := p_dados ->> 'plano';
  v_forma text := COALESCE(p_dados ->> 'forma_pagamento_plano', 'padrao');
  v_base numeric := (p_dados ->> 'valor_base_plano')::numeric;
  v_just text := btrim(COALESCE(p_dados ->> 'justificativa', ''));
  v_abatido boolean := COALESCE((p_dados ->> 'sinal_abatido')::boolean, true);
  v_ent jsonb := COALESCE(p_dados -> 'entrada', '{}'::jsonb);
  v_sal jsonb := COALESCE(p_dados -> 'saldo', '{}'::jsonb);
  v_ent_valor numeric := (v_ent ->> 'valor')::numeric;
  v_sal_forma text := NULLIF(v_sal ->> 'forma', '');
  v_tabela numeric;
  v_custom boolean;
  v_itens numeric;
  v_total numeric;
  v_rec_ent numeric;
  v_rec_sal numeric;
  v_vivas_sal int;
  v_primeira_escolha boolean;
  v_primeiro_receb timestamptz;
  v_sinal_agora boolean := false;
  v_negociado boolean;
BEGIN
  PERFORM fin_exigir_ceo();
  PERFORM set_audit_user();

  SELECT * INTO c FROM contratos_financeiros
   WHERE id = p_contrato_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: contrato não encontrado.';
  END IF;
  IF (p_dados ->> 'versao') IS DISTINCT FROM fin_versao_contrato(p_contrato_id) THEN
    RAISE EXCEPTION 'FIN_CONTRATO_MUDOU: o contrato mudou em outra aba ou por outra pessoa — recarregue.';
  END IF;

  -- Contrato cancelado (solicitarCancelamento marca as parcelas previstas como
  -- 'cancelado'): refazer cronograma criaria parcelas em aberto que a régua
  -- cobraria de uma família que cancelou.
  IF EXISTS (SELECT 1 FROM parcelas WHERE contrato_id = c.id AND status = 'cancelado' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'FIN_CONTRATO_CANCELADO: contrato com parcelas canceladas — trate pelo fluxo de cancelamento.';
  END IF;

  v_primeira_escolha := c.plano IS NULL;
  v_antes := to_jsonb(c) || jsonb_build_object('itens',
    (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'descricao', descricao, 'valor', valor)), '[]'::jsonb)
       FROM contrato_itens WHERE contrato_id = c.id AND deleted_at IS NULL));

  IF v_plano IS NULL OR v_plano NOT IN ('journey', 'legacy', 'start', 'personalizado') THEN
    RAISE EXCEPTION 'FIN_PLANO: escolha um plano válido.';
  END IF;
  IF v_forma NOT IN ('padrao', 'pix_avista') THEN
    RAISE EXCEPTION 'FIN_PLANO: forma de pagamento do plano inválida.';
  END IF;
  IF v_base IS NULL OR v_base <= 0 OR round(v_base, 2) <> v_base THEN
    RAISE EXCEPTION 'FIN_VALOR: informe o valor do plano.';
  END IF;
  IF v_ent_valor IS NULL OR v_ent_valor < 0 OR round(v_ent_valor, 2) <> v_ent_valor THEN
    RAISE EXCEPTION 'FIN_ENTRADA: valor de entrada inválido.';
  END IF;

  v_tabela := fin_valor_tabela(v_plano, v_forma);
  v_custom := v_tabela IS NULL OR v_base <> v_tabela;
  -- Regra 3 + T9: editar contrato que JÁ tinha plano sempre exige justificativa;
  -- escolher o plano exige só quando fora da tabela.
  IF (v_custom OR NOT v_primeira_escolha) AND char_length(v_just) < 5 THEN
    RAISE EXCEPTION 'FIN_JUSTIFICATIVA: informe a justificativa (mín. 5 caracteres) — fica no histórico.';
  END IF;

  SELECT COALESCE(sum(valor) FILTER (WHERE tipo = 'entrada' AND status = 'recebido'), 0),
         COALESCE(sum(valor) FILTER (WHERE tipo = 'saldo' AND status = 'recebido'), 0),
         count(*) FILTER (WHERE tipo = 'saldo')
    INTO v_rec_ent, v_rec_sal, v_vivas_sal
    FROM parcelas
   WHERE contrato_id = c.id AND deleted_at IS NULL AND status <> 'cancelado';

  -- Trocar plano com saldo já pago exige confirmação explícita (T10).
  IF c.plano IS NOT NULL AND c.plano::text <> v_plano AND v_rec_sal > 0
     AND NOT COALESCE((p_dados ->> 'confirmar_com_pagamentos')::boolean, false) THEN
    RAISE EXCEPTION 'FIN_REQUER_CONFIRMACAO: já há pagamentos além do sinal — confirme a troca de plano.';
  END IF;

  IF v_ent_valor < v_rec_ent THEN
    RAISE EXCEPTION 'FIN_ENTRADA_MENOR_RECEBIDO: a entrada não pode ser menor que o já recebido (R$ %). Estorne antes.', v_rec_ent;
  END IF;

  v_itens := fin_sincronizar_itens(c.id, p_dados -> 'itens');
  v_total := v_base + v_itens + CASE WHEN v_abatido THEN 0 ELSE v_ent_valor END;
  v_negociado := v_custom OR v_itens <> 0 OR (NOT v_abatido AND v_ent_valor > 0);
  IF v_negociado AND char_length(v_just) < 5 THEN
    RAISE EXCEPTION 'FIN_JUSTIFICATIVA: condições fora da tabela (valor do plano, serviços, descontos, ajustes ou sinal à parte) exigem justificativa (mín. 5 caracteres).';
  END IF;
  IF v_total < v_ent_valor OR v_total <= 0 THEN
    RAISE EXCEPTION 'FIN_VALOR_TOTAL: valor total (%) menor que a entrada (%).', v_total, v_ent_valor;
  END IF;
  IF (v_total - v_ent_valor) < v_rec_sal THEN
    RAISE EXCEPTION 'FIN_SALDO_MENOR_RECEBIDO: o saldo ficaria menor que o já recebido (R$ %).', v_rec_sal;
  END IF;
  IF v_sal_forma IS NULL AND v_vivas_sal > 0 THEN
    RAISE EXCEPTION 'FIN_SALDO_FORMA_OBRIGATORIA: o saldo já tem parcelas — informe a forma.';
  END IF;

  IF COALESCE((v_ent ->> 'regerar')::boolean, false) THEN
    PERFORM fin_descartar_abertas(c.id, 'entrada');
    PERFORM fin_inserir_parcelas(c.id, 'entrada', v_ent -> 'parcelas');
  END IF;
  IF v_sal_forma IS NOT NULL AND COALESCE((v_sal ->> 'regerar')::boolean, false) THEN
    PERFORM fin_descartar_abertas(c.id, 'saldo');
    PERFORM fin_inserir_parcelas(c.id, 'saldo', v_sal -> 'parcelas');
  END IF;

  UPDATE contratos_financeiros SET
    plano = v_plano::plano_tipo,
    forma_pagamento_plano = v_forma,
    valor_base_plano = v_base,
    valor_total = v_total,
    valor_customizado = CASE WHEN v_negociado THEN v_total ELSE NULL END,
    justificativa_customizacao = CASE WHEN v_negociado THEN v_just ELSE NULL END,
    sinal_abatido = v_abatido,
    entrada_valor = v_ent_valor,
    entrada_forma = CASE WHEN v_ent_valor > 0 THEN COALESCE(NULLIF(v_ent ->> 'forma', ''), c.entrada_forma) ELSE NULL END,
    entrada_parcelas = (SELECT count(*) FROM parcelas WHERE contrato_id = c.id AND tipo = 'entrada' AND deleted_at IS NULL AND status <> 'cancelado'),
    saldo_forma = v_sal_forma,
    saldo_parcelas = CASE WHEN v_sal_forma IS NULL THEN NULL
                          ELSE GREATEST(1, (SELECT count(*) FROM parcelas WHERE contrato_id = c.id AND tipo = 'saldo' AND deleted_at IS NULL AND status <> 'cancelado')) END,
    inclui_psicologa = COALESCE((p_dados ->> 'inclui_psicologa')::boolean, c.inclui_psicologa),
    custo_psicologa = CASE WHEN COALESCE((p_dados ->> 'inclui_psicologa')::boolean, c.inclui_psicologa)
                           THEN COALESCE((p_dados ->> 'custo_psicologa')::numeric, c.custo_psicologa, 0) ELSE 0 END,
    plano_definido_at = COALESCE(plano_definido_at, now())
  WHERE id = c.id;

  PERFORM fin_recalcular_entrada_paga(c.id);
  SELECT min(recebido_at) INTO v_primeiro_receb
    FROM parcelas WHERE contrato_id = c.id AND tipo = 'entrada' AND status = 'recebido' AND deleted_at IS NULL;
  IF v_primeiro_receb IS NOT NULL THEN
    v_sinal_agora := fin_confirmar_sinal_no_deal(c.deal_id, v_primeiro_receb);
  END IF;

  PERFORM fin_validar_contrato(c.id);
  PERFORM fin_registrar_evento(c.id, c.deal_id,
    CASE WHEN v_primeira_escolha THEN 'plano_escolhido' ELSE 'condicoes_editadas' END,
    NULLIF(v_just, ''),
    jsonb_build_object('antes', v_antes,
                       'depois', (SELECT to_jsonb(x) FROM contratos_financeiros x WHERE x.id = c.id),
                       'itens_total', v_itens,
                       'regerou_entrada', COALESCE((v_ent ->> 'regerar')::boolean, false),
                       'regerou_saldo', COALESCE((v_sal ->> 'regerar')::boolean, false)));

  RETURN fin_resultado(c.id, jsonb_build_object('sinal_confirmado_agora', v_sinal_agora,
                                                'primeira_escolha', v_primeira_escolha));
END;
$$;

-- ─── 4. Dar baixa com data/método/valor reais (T5/T9) ──────────────────
CREATE OR REPLACE FUNCTION public.fin_baixar_parcela(p_parcela_id uuid, p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  p parcelas%ROWTYPE;
  c contratos_financeiros%ROWTYPE;
  v_data date := (p_dados ->> 'data')::date;
  v_metodo text := COALESCE(NULLIF(p_dados ->> 'metodo', ''), NULL);
  v_valor numeric := NULLIF(p_dados ->> 'valor_recebido', '')::numeric;
  v_resto numeric := 0;
  v_resto_id uuid;
  v_entrada_agora boolean := false;
  v_sinal_agora boolean := false;
BEGIN
  PERFORM fin_exigir_ceo();
  PERFORM set_audit_user();

  SELECT * INTO p FROM parcelas WHERE id = p_parcela_id;
  IF NOT FOUND OR p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'FIN_PARCELA_INVALIDA: parcela não encontrada.';
  END IF;
  -- Lock no CONTRATO primeiro (mesma ordem em todas as RPCs → sem deadlock).
  SELECT * INTO c FROM contratos_financeiros WHERE id = p.contrato_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: contrato não encontrado.';
  END IF;
  SELECT * INTO p FROM parcelas WHERE id = p_parcela_id FOR UPDATE;
  IF p.status NOT IN ('previsto', 'atrasado') THEN
    RAISE EXCEPTION 'FIN_PARCELA_JA_BAIXADA: esta parcela não está em aberto (status %).', p.status;
  END IF;
  IF v_data IS NULL OR v_data > fin_hoje() OR v_data < DATE '2020-01-01' THEN
    RAISE EXCEPTION 'FIN_DATA_FUTURA: data do pagamento inválida (não pode ser futura).';
  END IF;
  v_metodo := COALESCE(v_metodo, p.metodo);
  IF v_metodo NOT IN ('pix','getnet','transferencia','boleto','cartao','dinheiro','outro') THEN
    RAISE EXCEPTION 'FIN_METODO: método de pagamento inválido.';
  END IF;
  v_valor := COALESCE(v_valor, p.valor);
  IF v_valor <= 0 OR round(v_valor, 2) <> v_valor THEN
    RAISE EXCEPTION 'FIN_VALOR: valor recebido inválido.';
  END IF;
  IF v_valor > p.valor THEN
    RAISE EXCEPTION 'FIN_VALOR_MAIOR: valor recebido maior que a parcela — use "Quitar" ou edite as parcelas.';
  END IF;

  IF v_valor < p.valor THEN
    -- Pagamento parcial: a diferença vira parcela nova em aberto (mesmo vencimento).
    v_resto := p.valor - v_valor;
    INSERT INTO parcelas (contrato_id, tipo, numero_parcela, valor, vencimento, metodo, status, created_by)
    VALUES (p.contrato_id, p.tipo, left(p.numero_parcela || ' (restante)', 60), v_resto, p.vencimento, p.metodo,
            (CASE WHEN p.vencimento < fin_hoje() THEN 'atrasado' ELSE 'previsto' END)::status_parcela, auth.uid())
    RETURNING id INTO v_resto_id;
  END IF;

  UPDATE parcelas SET
    status = 'recebido',
    valor = v_valor,
    recebido_at = fin_data_ao_meio_dia(v_data),
    metodo = v_metodo,
    comprovante_url = COALESCE(NULLIF(btrim(p_dados ->> 'comprovante_url'), ''), comprovante_url),
    observacao = COALESCE(NULLIF(btrim(p_dados ->> 'observacao'), ''), observacao),
    parcelas_cartao = COALESCE(NULLIF(p_dados ->> 'parcelas_cartao', '')::smallint, parcelas_cartao)
  WHERE id = p.id AND status IN ('previsto', 'atrasado') AND deleted_at IS NULL;

  IF p.tipo = 'entrada' THEN
    v_entrada_agora := fin_recalcular_entrada_paga(c.id);
    v_sinal_agora := fin_confirmar_sinal_no_deal(c.deal_id, fin_data_ao_meio_dia(v_data));
  END IF;

  PERFORM fin_registrar_evento(c.id, c.deal_id, 'parcela_baixada', p_dados ->> 'observacao',
    jsonb_build_object('parcela_id', p.id, 'tipo', p.tipo, 'numero', p.numero_parcela,
                       'valor_parcela', p.valor, 'valor_recebido', v_valor, 'data', v_data,
                       'metodo', v_metodo, 'restante_parcela_id', v_resto_id, 'restante', v_resto));

  RETURN fin_resultado(c.id, jsonb_build_object(
    'tipo', p.tipo, 'entrada_paga_agora', v_entrada_agora,
    'sinal_confirmado_agora', v_sinal_agora, 'restante_parcela_id', v_resto_id));
END;
$$;

-- ─── 5. Estornar baixa (T9) ─────────────────────────────────────────────
-- Contrato aguardando plano: estornar o sinal = REMOVER o registro (soft
-- delete). Voltar para "previsto" faria a régua cobrar um sinal fantasma.
-- Assinatura de 2 args (rascunho anterior) não pode coexistir: chamada com
-- 2 args ficaria ambígua ("function is not unique").
DROP FUNCTION IF EXISTS public.fin_estornar_parcela(uuid, text);
CREATE OR REPLACE FUNCTION public.fin_estornar_parcela(p_parcela_id uuid, p_justificativa text, p_novo_vencimento date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  p parcelas%ROWTYPE;
  c contratos_financeiros%ROWTYPE;
  v_just text := btrim(COALESCE(p_justificativa, ''));
  v_removido boolean := false;
  v_descartado boolean := false;
  v_desconfirmado boolean := false;
BEGIN
  PERFORM fin_exigir_ceo();
  PERFORM set_audit_user();

  IF char_length(v_just) < 5 THEN
    RAISE EXCEPTION 'FIN_JUSTIFICATIVA: estorno exige justificativa (mín. 5 caracteres).';
  END IF;

  SELECT * INTO p FROM parcelas WHERE id = p_parcela_id;
  IF NOT FOUND OR p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'FIN_PARCELA_INVALIDA: parcela não encontrada.';
  END IF;
  SELECT * INTO c FROM contratos_financeiros WHERE id = p.contrato_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: contrato não encontrado.';
  END IF;
  SELECT * INTO p FROM parcelas WHERE id = p_parcela_id FOR UPDATE;
  IF p.status <> 'recebido' THEN
    RAISE EXCEPTION 'FIN_PARCELA_NAO_RECEBIDA: só parcelas recebidas podem ser estornadas.';
  END IF;

  IF c.plano IS NULL AND p.tipo = 'entrada' THEN
    UPDATE parcelas SET deleted_at = now() WHERE id = p.id;
    UPDATE contratos_financeiros SET
      entrada_valor = entrada_valor - p.valor,
      valor_total = valor_total - p.valor,
      entrada_parcelas = GREATEST(entrada_parcelas - 1, 0),
      entrada_forma = CASE WHEN entrada_valor - p.valor = 0 THEN NULL ELSE entrada_forma END
    WHERE id = c.id;
    v_removido := true;
  ELSE
    -- Parcela com vencimento passado volta ATRASADA e a régua (billing-reminders)
    -- cobra no próximo tick (D+1/D+3/D+7…). O CEO pode informar um novo
    -- vencimento (>= hoje) na mesma operação; aí os marcos da régua recomeçam.
    IF p_novo_vencimento IS NOT NULL AND p_novo_vencimento < fin_hoje() THEN
      RAISE EXCEPTION 'FIN_VENCIMENTO: o novo vencimento não pode estar no passado.';
    END IF;
    UPDATE parcelas SET
      vencimento = COALESCE(p_novo_vencimento, vencimento),
      status = (CASE WHEN COALESCE(p_novo_vencimento, vencimento) < fin_hoje() THEN 'atrasado' ELSE 'previsto' END)::status_parcela,
      recebido_at = NULL,
      comprovante_url = NULL,
      regua_dneg3_at = CASE WHEN p_novo_vencimento IS NOT NULL THEN NULL ELSE regua_dneg3_at END,
      regua_d0_at    = CASE WHEN p_novo_vencimento IS NOT NULL THEN NULL ELSE regua_d0_at END,
      regua_d1_at    = CASE WHEN p_novo_vencimento IS NOT NULL THEN NULL ELSE regua_d1_at END,
      regua_d3_at    = CASE WHEN p_novo_vencimento IS NOT NULL THEN NULL ELSE regua_d3_at END,
      regua_d7_at    = CASE WHEN p_novo_vencimento IS NOT NULL THEN NULL ELSE regua_d7_at END,
      regua_d15_at   = CASE WHEN p_novo_vencimento IS NOT NULL THEN NULL ELSE regua_d15_at END
    WHERE id = p.id;
  END IF;

  IF p.tipo = 'entrada' THEN
    PERFORM fin_recalcular_entrada_paga(c.id);
    v_desconfirmado := fin_desconfirmar_sinal_se_vazio(c.id, c.deal_id);
  END IF;

  PERFORM fin_registrar_evento(c.id, c.deal_id,
    CASE WHEN v_removido THEN 'sinal_removido' ELSE 'parcela_estornada' END, v_just,
    jsonb_build_object('parcela_id', p.id, 'tipo', p.tipo, 'numero', p.numero_parcela,
                       'valor', p.valor, 'recebido_at_anterior', p.recebido_at,
                       'comprovante_anterior', p.comprovante_url,
                       'vencimento_anterior', p.vencimento, 'novo_vencimento', p_novo_vencimento));

  -- Aguardando plano sem nenhum sinal: descarta (soft delete). registrar_sinal
  -- ou criar_contrato reutilizam a linha (UNIQUE(deal_id) completa).
  -- Estorno comum só muda STATUS (somas intactas): NÃO revalida — senão um
  -- contrato legado com centavos sobrando (Amanda: 12 × 2.166,02) ficaria
  -- impossível de estornar (pego no teste do script 02 em ROLLBACK).
  IF v_removido AND NOT EXISTS (
    SELECT 1 FROM parcelas WHERE contrato_id = c.id AND deleted_at IS NULL) THEN
    UPDATE contratos_financeiros SET deleted_at = now() WHERE id = c.id;
    v_descartado := true;
  ELSIF v_removido THEN
    PERFORM fin_validar_contrato(c.id);
  END IF;

  RETURN jsonb_build_object('contrato_id', c.id, 'deal_id', c.deal_id, 'tipo', p.tipo,
                            'sinal_removido', v_removido, 'contrato_descartado', v_descartado,
                            'sinal_desconfirmado', v_desconfirmado,
                            'versao', CASE WHEN v_descartado THEN NULL ELSE fin_versao_contrato(c.id) END);
END;
$$;

-- ─── 6. Editar parcela em aberto (T9) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_editar_parcela(p_parcela_id uuid, p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  p parcelas%ROWTYPE;
  c contratos_financeiros%ROWTYPE;
  u parcelas%ROWTYPE;
  v_just text := btrim(COALESCE(p_dados ->> 'justificativa', ''));
  v_valor numeric := NULLIF(p_dados ->> 'valor', '')::numeric;
  v_venc date := NULLIF(p_dados ->> 'vencimento', '')::date;
  v_metodo text := NULLIF(p_dados ->> 'metodo', '');
  v_modo text := COALESCE(NULLIF(p_dados ->> 'modo_valor', ''), 'ajustar_ultima');
  v_delta numeric := 0;
BEGIN
  PERFORM fin_exigir_ceo();
  PERFORM set_audit_user();

  IF char_length(v_just) < 5 THEN
    RAISE EXCEPTION 'FIN_JUSTIFICATIVA: editar parcela exige justificativa (mín. 5 caracteres).';
  END IF;

  SELECT * INTO p FROM parcelas WHERE id = p_parcela_id;
  IF NOT FOUND OR p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'FIN_PARCELA_INVALIDA: parcela não encontrada.';
  END IF;
  SELECT * INTO c FROM contratos_financeiros WHERE id = p.contrato_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: contrato não encontrado.';
  END IF;
  IF (p_dados ->> 'versao') IS DISTINCT FROM fin_versao_contrato(c.id) THEN
    RAISE EXCEPTION 'FIN_CONTRATO_MUDOU: o contrato mudou em outra aba ou por outra pessoa — recarregue.';
  END IF;
  SELECT * INTO p FROM parcelas WHERE id = p_parcela_id FOR UPDATE;
  IF p.status NOT IN ('previsto', 'atrasado') THEN
    RAISE EXCEPTION 'FIN_PARCELA_NAO_EDITAVEL: só parcelas em aberto podem ser editadas (estorne antes).';
  END IF;
  IF v_metodo IS NOT NULL AND v_metodo NOT IN ('pix','getnet','transferencia','boleto','cartao','dinheiro','outro') THEN
    RAISE EXCEPTION 'FIN_METODO: método de pagamento inválido.';
  END IF;

  IF v_valor IS NOT NULL AND v_valor <> p.valor THEN
    IF v_valor <= 0 OR round(v_valor, 2) <> v_valor THEN
      RAISE EXCEPTION 'FIN_VALOR: valor da parcela inválido.';
    END IF;
    v_delta := v_valor - p.valor;
    IF v_modo = 'ajustar_ultima' THEN
      SELECT * INTO u FROM parcelas
       WHERE contrato_id = c.id AND tipo = p.tipo AND id <> p.id
         AND deleted_at IS NULL AND status IN ('previsto', 'atrasado')
       ORDER BY vencimento DESC, created_at DESC LIMIT 1
       FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'FIN_SEM_PARCELA_PARA_AJUSTE: não há outra parcela em aberto para absorver a diferença — use "alterar o valor do contrato".';
      END IF;
      IF u.valor - v_delta <= 0 THEN
        RAISE EXCEPTION 'FIN_AJUSTE_INVALIDO: a última parcela ficaria zerada/negativa.';
      END IF;
      UPDATE parcelas SET valor = valor - v_delta WHERE id = u.id;
    ELSIF v_modo = 'alterar_total' THEN
      IF p.tipo <> 'saldo' OR c.plano IS NULL THEN
        RAISE EXCEPTION 'FIN_USE_EDITAR_CONTRATO: para mudar a entrada, use "Editar contrato".';
      END IF;
      INSERT INTO contrato_itens (contrato_id, tipo, descricao, valor)
      VALUES (c.id, 'ajuste', left('Ajuste na parcela ' || p.numero_parcela || ': ' || v_just, 160), v_delta);
      UPDATE contratos_financeiros SET valor_total = valor_total + v_delta WHERE id = c.id;
    ELSE
      RAISE EXCEPTION 'FIN_VALOR: modo de ajuste inválido.';
    END IF;
  END IF;

  UPDATE parcelas SET
    valor = COALESCE(v_valor, valor),
    metodo = COALESCE(v_metodo, metodo),
    vencimento = COALESCE(v_venc, vencimento),
    observacao = COALESCE(NULLIF(btrim(p_dados ->> 'observacao'), ''), observacao),
    -- Vencimento novo = régua recomeça (marcos e status do novo prazo).
    status = CASE WHEN v_venc IS NOT NULL AND v_venc <> p.vencimento
                  THEN (CASE WHEN v_venc < fin_hoje() THEN 'atrasado' ELSE 'previsto' END)::status_parcela
                  ELSE status END,
    regua_dneg3_at = CASE WHEN v_venc IS NOT NULL AND v_venc <> p.vencimento THEN NULL ELSE regua_dneg3_at END,
    regua_d0_at    = CASE WHEN v_venc IS NOT NULL AND v_venc <> p.vencimento THEN NULL ELSE regua_d0_at END,
    regua_d1_at    = CASE WHEN v_venc IS NOT NULL AND v_venc <> p.vencimento THEN NULL ELSE regua_d1_at END,
    regua_d3_at    = CASE WHEN v_venc IS NOT NULL AND v_venc <> p.vencimento THEN NULL ELSE regua_d3_at END,
    regua_d7_at    = CASE WHEN v_venc IS NOT NULL AND v_venc <> p.vencimento THEN NULL ELSE regua_d7_at END,
    regua_d15_at   = CASE WHEN v_venc IS NOT NULL AND v_venc <> p.vencimento THEN NULL ELSE regua_d15_at END
  WHERE id = p.id;

  IF v_modo = 'alterar_total' AND v_delta <> 0 THEN
    PERFORM fin_validar_contrato(c.id);
  END IF;

  PERFORM fin_registrar_evento(c.id, c.deal_id, 'parcela_editada', v_just,
    jsonb_build_object('parcela_id', p.id, 'numero', p.numero_parcela,
                       'antes', jsonb_build_object('valor', p.valor, 'vencimento', p.vencimento, 'metodo', p.metodo),
                       'depois', jsonb_build_object('valor', COALESCE(v_valor, p.valor), 'vencimento', COALESCE(v_venc, p.vencimento), 'metodo', COALESCE(v_metodo, p.metodo)),
                       'modo_valor', CASE WHEN v_delta <> 0 THEN v_modo END,
                       'parcela_ajustada_id', u.id));

  RETURN fin_resultado(c.id, '{}'::jsonb);
END;
$$;

-- ─── 7. Quitar contrato (T9) ────────────────────────────────────────────
-- Baixa de TODAS as parcelas em aberto na data/método informados; valor sem
-- cronograma (saldo "definir depois") vira parcela "Quitação" recebida. NÃO
-- move o deal de etapa.
CREATE OR REPLACE FUNCTION public.fin_quitar_contrato(p_contrato_id uuid, p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  c contratos_financeiros%ROWTYPE;
  v_data date := (p_dados ->> 'data')::date;
  v_metodo text := NULLIF(p_dados ->> 'metodo', '');
  v_qtd int;
  v_soma_abertas numeric;
  v_vivas numeric;
  v_falta numeric;
  v_excesso numeric;
  v_ultima uuid;
  v_entrada_agora boolean := false;
  v_sinal_agora boolean := false;
  v_primeiro_receb timestamptz;
BEGIN
  PERFORM fin_exigir_ceo();
  PERFORM set_audit_user();

  SELECT * INTO c FROM contratos_financeiros WHERE id = p_contrato_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: contrato não encontrado.';
  END IF;
  IF (p_dados ->> 'versao') IS DISTINCT FROM fin_versao_contrato(c.id) THEN
    RAISE EXCEPTION 'FIN_CONTRATO_MUDOU: o contrato mudou em outra aba ou por outra pessoa — recarregue.';
  END IF;
  IF c.plano IS NULL THEN
    RAISE EXCEPTION 'FIN_QUITAR_SEM_PLANO: escolha o plano antes de quitar.';
  END IF;
  -- Cancelado: o valor das parcelas canceladas NÃO pode virar "Quitação" recebida.
  IF EXISTS (SELECT 1 FROM parcelas WHERE contrato_id = c.id AND status = 'cancelado' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'FIN_CONTRATO_CANCELADO: contrato com parcelas canceladas — trate pelo fluxo de cancelamento.';
  END IF;
  IF v_data IS NULL OR v_data > fin_hoje() OR v_data < DATE '2020-01-01' THEN
    RAISE EXCEPTION 'FIN_DATA_FUTURA: data do pagamento inválida (não pode ser futura).';
  END IF;
  IF v_metodo IS NULL OR v_metodo NOT IN ('pix','getnet','transferencia','boleto','cartao','dinheiro','outro') THEN
    RAISE EXCEPTION 'FIN_METODO: escolha o método da quitação.';
  END IF;

  SELECT COALESCE(sum(valor), 0) INTO v_vivas
    FROM parcelas WHERE contrato_id = c.id AND deleted_at IS NULL AND status <> 'cancelado';

  -- Centavos de arredondamento legado (ex.: 12 × 2.166,02 > saldo): a última
  -- parcela em aberto absorve o excesso antes da baixa.
  v_excesso := v_vivas - c.valor_total;
  IF v_excesso > 0 THEN
    SELECT id INTO v_ultima FROM parcelas
     WHERE contrato_id = c.id AND deleted_at IS NULL AND status IN ('previsto', 'atrasado')
     ORDER BY vencimento DESC, created_at DESC LIMIT 1;
    IF v_ultima IS NULL THEN
      RAISE EXCEPTION 'FIN_CRONOGRAMA_SALDO: parcelas somam mais que o contrato e não há parcela em aberto para ajustar.';
    END IF;
    UPDATE parcelas SET valor = valor - v_excesso WHERE id = v_ultima AND valor - v_excesso > 0;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'FIN_CRONOGRAMA_SALDO: não foi possível ajustar os centavos — edite as parcelas.';
    END IF;
  END IF;

  SELECT count(*), COALESCE(sum(valor), 0) INTO v_qtd, v_soma_abertas
    FROM parcelas WHERE contrato_id = c.id AND deleted_at IS NULL AND status IN ('previsto', 'atrasado');

  UPDATE parcelas SET
    status = 'recebido',
    recebido_at = fin_data_ao_meio_dia(v_data),
    metodo = v_metodo,
    observacao = COALESCE(NULLIF(btrim(p_dados ->> 'observacao'), ''), observacao)
  WHERE contrato_id = c.id AND deleted_at IS NULL AND status IN ('previsto', 'atrasado');

  SELECT COALESCE(sum(valor), 0) INTO v_vivas
    FROM parcelas WHERE contrato_id = c.id AND deleted_at IS NULL AND status <> 'cancelado';
  v_falta := c.valor_total - v_vivas;
  IF v_falta > 0 THEN
    -- Valor sem cronograma: entrada faltante e/ou saldo "definir depois".
    IF (SELECT COALESCE(sum(valor), 0) FROM parcelas WHERE contrato_id = c.id AND tipo = 'entrada'
          AND deleted_at IS NULL AND status <> 'cancelado') < c.entrada_valor THEN
      RAISE EXCEPTION 'FIN_CRONOGRAMA_ENTRADA: a entrada não tem parcelas — edite o contrato antes de quitar.';
    END IF;
    PERFORM fin_inserir_parcelas(c.id, 'saldo', jsonb_build_array(jsonb_build_object(
      'numero_parcela', 'Quitação', 'valor', v_falta, 'vencimento', v_data,
      'metodo', v_metodo, 'status', 'recebido', 'recebido_em', v_data,
      'observacao', p_dados ->> 'observacao')));
    UPDATE contratos_financeiros SET
      saldo_forma = COALESCE(saldo_forma, CASE v_metodo
        WHEN 'pix' THEN 'pix_avista' WHEN 'getnet' THEN 'getnet_parcelado' ELSE v_metodo END),
      saldo_parcelas = (SELECT count(*) FROM parcelas WHERE contrato_id = c.id AND tipo = 'saldo' AND deleted_at IS NULL AND status <> 'cancelado')
    WHERE id = c.id;
  END IF;

  v_entrada_agora := fin_recalcular_entrada_paga(c.id);
  SELECT min(recebido_at) INTO v_primeiro_receb
    FROM parcelas WHERE contrato_id = c.id AND tipo = 'entrada' AND status = 'recebido' AND deleted_at IS NULL;
  IF v_primeiro_receb IS NOT NULL THEN
    v_sinal_agora := fin_confirmar_sinal_no_deal(c.deal_id, v_primeiro_receb);
  END IF;

  PERFORM fin_validar_contrato(c.id);
  PERFORM fin_registrar_evento(c.id, c.deal_id, 'contrato_quitado', p_dados ->> 'justificativa',
    jsonb_build_object('data', v_data, 'metodo', v_metodo, 'parcelas_baixadas', v_qtd,
                       'valor_baixado', v_soma_abertas, 'valor_sem_cronograma', GREATEST(v_falta, 0),
                       'centavos_ajustados', GREATEST(v_excesso, 0)));

  RETURN fin_resultado(c.id, jsonb_build_object(
    'parcelas_quitadas', v_qtd, 'valor_quitado', v_soma_abertas + GREATEST(v_falta, 0),
    'entrada_paga_agora', v_entrada_agora, 'sinal_confirmado_agora', v_sinal_agora));
END;
$$;

-- ─── 8. Descartar contrato SEM pagamento (substitui o fluxo N-requests) ──
-- Lock no contrato + checagem de pagamento + soft delete de parcelas/itens/
-- contrato + evento, tudo na MESMA transação (o excluirContratoSemPagamento
-- antigo apagava as parcelas ANTES do CAS: uma baixa no meio deixava a
-- parcela recebida com soft delete). A linha é reutilizada depois
-- (UNIQUE(deal_id) completa).
CREATE OR REPLACE FUNCTION public.fin_descartar_contrato(p_contrato_id uuid, p_justificativa text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  c contratos_financeiros%ROWTYPE;
  v_parc int;
  v_itens int;
BEGIN
  PERFORM fin_exigir_ceo();
  PERFORM set_audit_user();

  SELECT * INTO c FROM contratos_financeiros WHERE id = p_contrato_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: contrato não encontrado (já descartado?).';
  END IF;
  IF c.entrada_paga OR EXISTS (
    SELECT 1 FROM parcelas WHERE contrato_id = c.id AND status = 'recebido' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'FIN_TEM_PAGAMENTO: contrato com pagamento recebido não pode ser descartado — use Editar contrato ou Estornar.';
  END IF;

  UPDATE parcelas SET deleted_at = now() WHERE contrato_id = c.id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_parc = ROW_COUNT;
  UPDATE contrato_itens SET deleted_at = now() WHERE contrato_id = c.id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_itens = ROW_COUNT;
  UPDATE contratos_financeiros SET deleted_at = now() WHERE id = c.id;

  PERFORM fin_registrar_evento(c.id, c.deal_id, 'contrato_descartado', p_justificativa,
    jsonb_build_object('parcelas_descartadas', v_parc, 'itens_descartados', v_itens));
  RETURN jsonb_build_object('contrato_id', c.id, 'deal_id', c.deal_id, 'parcelas_descartadas', v_parc);
END;
$$;

-- ─── Permissões: só authenticated (o papel é checado dentro) ───────────
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'fin_exigir_ceo()', 'fin_hoje()', 'fin_data_ao_meio_dia(date)', 'fin_metodo_da_forma(text)',
    'fin_valor_tabela(text, text)', 'fin_versao_contrato(uuid)', 'fin_recalcular_entrada_paga(uuid)',
    'fin_confirmar_sinal_no_deal(uuid, timestamptz)', 'fin_desconfirmar_sinal_se_vazio(uuid, uuid)',
    'fin_validar_contrato(uuid)', 'fin_inserir_parcelas(uuid, text, jsonb)', 'fin_descartar_abertas(uuid, text)',
    'fin_sincronizar_itens(uuid, jsonb)', 'fin_registrar_evento(uuid, uuid, text, text, jsonb)',
    'fin_resultado(uuid, jsonb)', 'fin_criar_contrato(uuid, jsonb)', 'fin_registrar_sinal(uuid, jsonb)',
    'fin_salvar_condicoes(uuid, jsonb)', 'fin_baixar_parcela(uuid, jsonb)', 'fin_estornar_parcela(uuid, text, date)',
    'fin_editar_parcela(uuid, jsonb)', 'fin_quitar_contrato(uuid, jsonb)', 'fin_descartar_contrato(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', f);
  END LOOP;
END $$;
