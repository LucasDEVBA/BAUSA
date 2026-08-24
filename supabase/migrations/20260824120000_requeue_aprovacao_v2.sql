-- Re-fila de aprovação pós-classificador v2 (ordem do CEO, 2026-08-24):
-- "todos os leads qualificados devem ser movidos para aguardando aprovação".
--
-- Após o mutirão de requalificação (PR #375), TODO lead QUENTE/MORNO ainda
-- SEM reunião volta para aprovacao_status='pendente' — inclusive os que já
-- tinham decisão humana (aprovado/reprovado): o CEO quer re-decidir a base
-- inteira sob o classificador novo. Os campos de decisão são limpos para a
-- re-decisão nascer limpa na fila (que agora ordena por score_financeiro).
--
-- Segurança:
-- • Re-aprovar não duplica nada: promoverLeadCore é idempotente (atleta por
--   form_submission_id + UNIQUE backstop) — atleta/deal existentes reusados.
-- • Voltar a 'pendente' NÃO dispara mensagens: outreach inicial exige
--   aprovado (lead pausa até a re-decisão); follow-ups de quem JÁ recebeu o
--   inicial herdam via whatsapp_sent_at (continuam — comportamento documentado).
-- • FRIO/INVALIDO/INCOMPLETO ficam fora (nunca entram na fila).
-- • Quem tem reunião marcada fica fora (população definida pelo CEO).
-- • One-shot idempotente: segunda execução encontra tudo 'pendente' → 0 linhas.
--
-- NOTA (invariante preservado): esta é uma VARREDURA única. A CF qualify-lead
-- continua NUNCA sobrescrevendo decisão humana em requalificações (guard
-- tests/requalificacao-invariants.test.js) — a regra de código não muda.

DO $$
DECLARE
  s text;
  n integer;
BEGIN
  FOREACH s IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    IF to_regclass(s || '.form_submissions') IS NULL THEN
      RAISE NOTICE 'requeue_aprovacao_v2: schema % sem form_submissions — pulado', s;
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = s AND table_name = 'form_submissions'
        AND column_name = 'aprovacao_status'
    ) THEN
      RAISE NOTICE 'requeue_aprovacao_v2: schema % sem coluna aprovacao_status — pulado', s;
      CONTINUE;
    END IF;

    EXECUTE format($q$
      UPDATE %I.form_submissions
      SET aprovacao_status = 'pendente',
          aprovacao_decidida_por = NULL,
          aprovacao_decidida_em = NULL,
          aprovacao_motivo = NULL
      WHERE deleted_at IS NULL
        AND qualification_classification IN ('QUENTE', 'MORNO')
        AND meeting_scheduled IS NOT TRUE
        AND (aprovacao_status IS NULL OR aprovacao_status <> 'pendente')
    $q$, s);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'requeue_aprovacao_v2: %.form_submissions — % lead(s) re-enfileirado(s)', s, n;
  END LOOP;
END $$;
