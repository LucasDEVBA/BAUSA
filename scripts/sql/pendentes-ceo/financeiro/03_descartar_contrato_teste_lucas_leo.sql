-- ════════════════════════════════════════════════════════════════════════
-- PENDENTE DE CONFIRMAÇÃO DO CEO (pergunta 3d) — NÃO é migration
-- Descarta (SOFT DELETE) o contrato de TESTE "Lucas Leo" (8bcfb649-a0d0-4aba-bf58-2ba237c851fc)
--
-- Por quê: deal em etapa "lead", entrada R$ 4.500 vencida em 17/08 e 6 parcelas
--   "previsto" (Getnet 6x padrão do formulário antigo). Se a régua de cobrança
--   (billing-reminders) for ligada, ela COBRA o responsável desse cadastro.
-- O que faz: soft delete do contrato e das parcelas (nada é apagado; histórico
--   em contrato_eventos + audit_logs). O deal/atleta NÃO são tocados (exclusão
--   de lead é outra tarefa — T1). Mesma regra do "Descartar contrato" da tela:
--   recusa se houver qualquer parcela RECEBIDA.
-- Idempotente: se já descartado, não faz nada.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. PRÉVIA (somente leitura) — confirmar que é teste ────────────────
SELECT c.id, c.plano, c.valor_total, c.entrada_valor, c.deleted_at, d.etapa, a.nome_completo,
       count(p.id) FILTER (WHERE p.deleted_at IS NULL) AS parcelas_vivas,
       count(p.id) FILTER (WHERE p.status = 'recebido' AND p.deleted_at IS NULL) AS recebidas
  FROM public.contratos_financeiros c
  JOIN public.deals d ON d.id = c.deal_id
  JOIN public.atletas a ON a.id = d.atleta_id
  LEFT JOIN public.parcelas p ON p.contrato_id = c.id
 WHERE c.id = '8bcfb649-a0d0-4aba-bf58-2ba237c851fc'
 GROUP BY c.id, d.etapa, a.nome_completo;
-- Esperado: Lucas Leo · etapa lead · 7 parcelas vivas · 0 recebidas · deleted_at NULL

-- ─── 2. APLICAR (só com "pode descartar" do CEO) ────────────────────────
BEGIN;
SELECT set_config('audit.user_id', '142d518a-0623-4bfe-a1b2-1d8ea5ac744a', true); -- executor (CTO)
SELECT set_config('audit.user_papel', 'cto', true);

DO $$
DECLARE
  c_id uuid := '8bcfb649-a0d0-4aba-bf58-2ba237c851fc';
  v_deal uuid;
  v_n int;
BEGIN
  SELECT deal_id INTO v_deal FROM public.contratos_financeiros WHERE id = c_id AND deleted_at IS NULL FOR UPDATE;
  IF v_deal IS NULL THEN
    RAISE NOTICE 'contrato já descartado — nada a fazer';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.parcelas WHERE contrato_id = c_id AND status = 'recebido' AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'contrato tem parcela recebida — NÃO descartar (histórico financeiro real)';
  END IF;

  UPDATE public.parcelas SET deleted_at = now() WHERE contrato_id = c_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE public.contratos_financeiros SET deleted_at = now() WHERE id = c_id AND deleted_at IS NULL;

  INSERT INTO public.contrato_eventos (contrato_id, deal_id, tipo, justificativa, detalhes, created_by)
  VALUES (c_id, v_deal, 'contrato_descartado',
          'Contrato de teste descartado com autorização do CEO (pergunta 3d, <DATA>) antes de ligar a régua de cobrança.',
          jsonb_build_object('parcelas_descartadas', v_n, 'via', 'script 03'), NULL);
  RAISE NOTICE 'descartado: % parcelas', v_n;
END $$;

-- ─── 3. CONFERÊNCIA (ainda DENTRO da transação do bloco 2) ─────────────────────────────────────────────────────
-- Esperado: deleted_at preenchido no contrato e nas 7 parcelas; 0 parcelas vivas.
SELECT c.deleted_at,
       (SELECT count(*) FROM public.parcelas WHERE contrato_id = c.id AND deleted_at IS NULL) AS vivas
  FROM public.contratos_financeiros c WHERE c.id = '8bcfb649-a0d0-4aba-bf58-2ba237c851fc';

-- ─── 4. FECHAR ──────────────────────────────────────────────────────────
-- Padrão SEGURO: o arquivo inteiro termina em ROLLBACK (rodar tudo de uma vez
-- não persiste nada). Só depois de conferir o bloco 3 — dentro da MESMA
-- transação — e com o "pode aplicar" do CEO, troque a linha abaixo por COMMIT.
ROLLBACK;
