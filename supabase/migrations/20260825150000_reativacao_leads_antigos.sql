-- Reativação de leads antigos (ordem do CEO, 2026-08-24):
-- "ainda tem leads na coluna Lead qualificado, mais antigos de 03/08 para
--  trás, que já receberam as mensagens e não agendaram — mova-os para
--  aguardando aprovação. E quando eu aprovar um lead com histórico, ele
--  entra no follow-up novamente, mas a primeira mensagem é de REATIVAÇÃO."
--
-- 1. Coluna `reativacao_em`: marcada pelo aprovarLead quando o lead aprovado
--    JÁ tem histórico de outreach — o whatsapp-scheduler (Bucket A, mesma
--    máquina/CAS/anti-ban) troca o template 'initial' por 'reactivation'.
--    O ciclo é re-armado na aprovação (whatsapp_sent_at/followups NULL,
--    meeting false) — após a reativação, FU1 (48h) e FU2 (7d) seguem o
--    MESMO follow-up de sempre.
-- 2. Re-fila one-shot: FS de deals ainda PRÉ-reunião no board, QUENTE/MORNO,
--    com mensagens já enviadas e entrada ≤ 03/08/2026 → 'pendente' (decisão
--    limpa). Inclui os aprovados de hoje: a RE-aprovação (com a feature no
--    ar) é o gatilho da reativação — aprovar antes dela não disparava nada.
--    O critério "não agendou" é a POSIÇÃO DO DEAL (pré-reunião = nunca
--    avançou), não o flag meeting_scheduled — flags antigos de reunião
--    morta/cancelada não blindam o lead da re-triagem.
-- Idempotente nas duas partes.

DO $$
DECLARE
  s text;
  n integer;
BEGIN
  FOREACH s IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    IF to_regclass(s || '.form_submissions') IS NULL THEN CONTINUE; END IF;
    EXECUTE format(
      'ALTER TABLE %I.form_submissions ADD COLUMN IF NOT EXISTS reativacao_em timestamptz',
      s);
  END LOOP;

  IF to_regclass('public.deals') IS NULL THEN
    RAISE NOTICE 'reativacao: sem tabela deals — re-fila pulada';
    RETURN;
  END IF;

  UPDATE public.form_submissions fs
  SET aprovacao_status = 'pendente',
      aprovacao_decidida_por = NULL,
      aprovacao_decidida_em = NULL,
      aprovacao_motivo = NULL
  FROM public.atletas a
  JOIN public.deals d ON d.atleta_id = a.id AND d.deleted_at IS NULL
  WHERE a.form_submission_id = fs.id
    AND fs.deleted_at IS NULL
    AND d.etapa IN ('contato_feito', 'lead', 'aguardando_timing')
    AND fs.qualification_classification IN ('QUENTE', 'MORNO')
    AND fs.whatsapp_sent_at IS NOT NULL
    AND fs.submitted_at < '2026-08-04T00:00:00Z'
    AND (fs.aprovacao_status IS NULL OR fs.aprovacao_status <> 'pendente');

  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'reativacao: % lead(s) antigos re-enfileirados p/ aprovação', n;
END $$;
