-- ════════════════════════════════════════════════════════════════════════
-- PENDENTE DE AUTORIZAÇÃO + DADOS DO CEO — NÃO é migration
-- Correção do contrato da Amanda Tavares Mantovan (8f076d97-e995-42db-8fbf-30660d4af8af)
--
-- CAMINHO PREFERIDO: pela tela (aba Contrato → Estornar a entrada de R$ 7,80 →
--   Editar contrato → Dar baixa / Quitar). Deixa audit e histórico com o autor.
--   Este script faz EXATAMENTE os mesmos passos chamando as MESMAS RPCs (mesmas
--   validações, histórico em contrato_eventos, autor no audit) — usar só se for
--   urgente ou se a tela ainda não estiver no ar.
--
-- PRÉ-REQUISITOS: migrations *_financeiro_contrato_flexivel e *_financeiro_rpcs aplicadas.
-- PREENCHER os parâmetros do bloco 2 com as respostas do CEO (pergunta 3a):
--   valor e forma da entrada, data em que a entrada entrou, forma do saldo,
--   quantas parcelas, se já quitou (data/forma), valor fechado (26.000 ou 28.000).
-- Idempotente: cada passo só roda se o contrato ainda estiver no estado antigo.
-- Mantém a régua (billing-reminders) PARADA até rodar a conferência (bloco 3).
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. PRÉVIA (somente leitura) ────────────────────────────────────────
SELECT c.plano, c.forma_pagamento_plano, c.valor_total, c.valor_base_plano, c.entrada_valor,
       c.entrada_forma, c.entrada_paga, c.saldo_remanescente, c.saldo_forma, c.saldo_parcelas,
       d.etapa, d.valor_estimado,
       (SELECT json_agg(json_build_object('id', p.id, 'n', p.numero_parcela, 'tipo', p.tipo, 'valor', p.valor,
                                          'venc', p.vencimento, 'metodo', p.metodo, 'status', p.status,
                                          'recebido_at', p.recebido_at) ORDER BY p.vencimento)
          FROM public.parcelas p WHERE p.contrato_id = c.id AND p.deleted_at IS NULL) AS parcelas
  FROM public.contratos_financeiros c JOIN public.deals d ON d.id = c.deal_id
 WHERE c.id = '8f076d97-e995-42db-8fbf-30660d4af8af';

-- ─── 2. APLICAR (só com "pode aplicar" + parâmetros preenchidos) ────────
BEGIN;
-- Executor real (CTO com autorização do CEO) — aparece como autor no audit e no histórico.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"142d518a-0623-4bfe-a1b2-1d8ea5ac744a","role":"authenticated"}', true);

DO $$
DECLARE
  -- ⚠️ PARÂMETROS — preencher com a resposta do CEO (valores abaixo = EXEMPLO do teste em ROLLBACK)
  c_contrato       uuid    := '8f076d97-e995-42db-8fbf-30660d4af8af';
  p_plano          text    := 'journey';          -- ou 'personalizado' se o fechado for 28.000 fora da tabela
  p_valor_plano    numeric := 26000;              -- 26000 (tabela) ou 28000 (exige justificativa)
  p_entrada        numeric := 7800;               -- entrada REAL
  p_forma_entrada  text    := 'pix';              -- pix | getnet_parcelado | transferencia | boleto | cartao | dinheiro | outro
  p_data_entrada   date    := DATE '2026-08-31';  -- dia em que a entrada entrou
  p_forma_saldo    text    := 'transferencia';    -- pix_avista | pix_parcelado | getnet_parcelado | transferencia | boleto | cartao | dinheiro | outro
  p_qtd_saldo      int     := 1;                  -- nº de parcelas do saldo
  p_venc_saldo     date    := DATE '2026-09-10';  -- 1º vencimento do saldo
  p_quitado        boolean := true;               -- a família já pagou tudo?
  p_data_quitacao  date    := DATE '2026-09-10';
  p_metodo_quit    text    := 'transferencia';    -- pix | getnet | transferencia | boleto | cartao | dinheiro | outro
  p_justificativa  text    := 'Correção autorizada pelo CEO em <DATA>: entrada digitada R$ 7,80 (real R$ 7.800) e saldo não foi Getnet 12x.';
  -- ───────────────────────────────────────────────────────────────────────
  v_ent_errada uuid;
  v_saldo numeric;
  v_base numeric;
  v_parcelas jsonb;
  v_entrada_aberta uuid;
  v_r jsonb;
BEGIN
  -- a) Estorna a entrada digitada errada (R$ 7,80), se ainda estiver lá.
  SELECT id INTO v_ent_errada FROM parcelas
   WHERE contrato_id = c_contrato AND tipo = 'entrada' AND status = 'recebido'
     AND valor = 7.80 AND deleted_at IS NULL;
  IF v_ent_errada IS NOT NULL THEN
    PERFORM fin_estornar_parcela(v_ent_errada, p_justificativa);
    RAISE NOTICE 'a) entrada de R$ 7,80 estornada';
  END IF;

  -- b) Condições reais (entrada + saldo), refazendo só as parcelas em aberto.
  IF (SELECT entrada_valor <> p_entrada OR saldo_forma IS DISTINCT FROM p_forma_saldo
        FROM contratos_financeiros WHERE id = c_contrato) THEN
    v_saldo := p_valor_plano - p_entrada;   -- sinal abatido (padrão)
    v_base  := trunc(v_saldo / p_qtd_saldo, 2);
    SELECT jsonb_agg(jsonb_build_object(
             'numero_parcela', CASE WHEN p_qtd_saldo = 1 THEN 'Saldo' ELSE i || '/' || p_qtd_saldo END,
             'valor', CASE WHEN i < p_qtd_saldo THEN v_base ELSE v_saldo - v_base * (p_qtd_saldo - 1) END,
             'vencimento', (p_venc_saldo + make_interval(months => i - 1))::date,
             'metodo', fin_metodo_da_forma(p_forma_saldo)) ORDER BY i)
      INTO v_parcelas FROM generate_series(1, p_qtd_saldo) i;

    v_r := fin_salvar_condicoes(c_contrato, jsonb_build_object(
      'versao', fin_versao_contrato(c_contrato),
      'plano', p_plano, 'forma_pagamento_plano', 'padrao', 'valor_base_plano', p_valor_plano,
      'sinal_abatido', true, 'justificativa', p_justificativa,
      'inclui_psicologa', true, 'custo_psicologa', 1200,
      'entrada', jsonb_build_object('valor', p_entrada, 'forma', p_forma_entrada, 'regerar', true,
                   'parcelas', jsonb_build_array(jsonb_build_object('numero_parcela', 'Entrada', 'valor', p_entrada,
                                 'vencimento', p_data_entrada, 'metodo', fin_metodo_da_forma(p_forma_entrada)))),
      'saldo', jsonb_build_object('forma', p_forma_saldo, 'regerar', true, 'parcelas', v_parcelas)));
    RAISE NOTICE 'b) condições salvas: %', v_r;
  END IF;

  -- c) Baixa da entrada real na data real.
  SELECT id INTO v_entrada_aberta FROM parcelas
   WHERE contrato_id = c_contrato AND tipo = 'entrada' AND status IN ('previsto', 'atrasado') AND deleted_at IS NULL
   ORDER BY vencimento LIMIT 1;
  IF v_entrada_aberta IS NOT NULL THEN
    PERFORM fin_baixar_parcela(v_entrada_aberta, jsonb_build_object(
      'data', p_data_entrada, 'metodo', fin_metodo_da_forma(p_forma_entrada), 'observacao', 'Correção autorizada pelo CEO'));
    RAISE NOTICE 'c) entrada baixada em %', p_data_entrada;
  END IF;

  -- d) Quitação (se a família já pagou tudo). NÃO move o deal ("Valor total pago" continua).
  IF p_quitado AND EXISTS (SELECT 1 FROM parcelas WHERE contrato_id = c_contrato AND deleted_at IS NULL
                              AND status IN ('previsto', 'atrasado')) THEN
    PERFORM fin_quitar_contrato(c_contrato, jsonb_build_object(
      'versao', fin_versao_contrato(c_contrato), 'data', p_data_quitacao, 'metodo', p_metodo_quit,
      'observacao', 'Correção autorizada pelo CEO — quitação real'));
    RAISE NOTICE 'd) contrato quitado em %', p_data_quitacao;
  END IF;
END $$;


-- ─── 3. CONFERÊNCIA (ainda DENTRO da transação do bloco 2) (somente leitura) ───────────────────────────────────
-- Esperado (se quitado): a_receber = 0, em_atraso = 0, recebido = valor_total,
-- entrada_paga = true, deal na MESMA etapa (custom_2 "Valor total pago").
SELECT c.valor_total, c.entrada_valor, c.entrada_paga, c.entrada_paga_at, c.saldo_forma, d.etapa,
       COALESCE(sum(p.valor) FILTER (WHERE p.status = 'recebido'), 0) AS recebido,
       COALESCE(sum(p.valor) FILTER (WHERE p.status IN ('previsto', 'atrasado')), 0) AS a_receber,
       COALESCE(sum(p.valor) FILTER (WHERE p.status IN ('previsto', 'atrasado') AND p.vencimento < CURRENT_DATE), 0) AS em_atraso,
       count(*) FILTER (WHERE p.status IN ('previsto', 'atrasado')) AS parcelas_para_regua
  FROM public.contratos_financeiros c
  JOIN public.deals d ON d.id = c.deal_id
  LEFT JOIN public.parcelas p ON p.contrato_id = c.id AND p.deleted_at IS NULL AND p.status <> 'cancelado'
 WHERE c.id = '8f076d97-e995-42db-8fbf-30660d4af8af'
 GROUP BY c.id, d.etapa;

SELECT tipo, justificativa, created_at, created_by
  FROM public.contrato_eventos WHERE contrato_id = '8f076d97-e995-42db-8fbf-30660d4af8af'
 ORDER BY created_at;

-- ─── 4. FECHAR ──────────────────────────────────────────────────────────
-- Padrão SEGURO: o arquivo inteiro termina em ROLLBACK (rodar tudo de uma vez
-- não persiste nada). Só depois de conferir o bloco 3 — dentro da MESMA
-- transação — e com o "pode aplicar" do CEO, troque a linha abaixo por COMMIT.
ROLLBACK;
