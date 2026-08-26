-- Re-envio do lote de reativação de 2026-08-26 (ordem do CEO):
-- o lote das 11:00–11:27 BRT (24 leads) saiu com a copy ANTIGA de reativação;
-- a copy definitiva (novo ciclo de seleção 2027) entrou em PRD no promote
-- #388 às 15:53 BRT. O CEO mandou re-enviar a mensagem correta a TODOS do
-- lote MENOS Diego Alves Gonzaga (lead da Renata Alves — "vamos manter como
-- está"). Re-arma o ciclo: whatsapp_sent_at=NULL devolve os 23 ao Bucket A
-- do whatsapp-scheduler (mesma máquina/CAS/anti-ban/gate humano), que envia
-- o template 'reactivation' (reativacao_em não-nulo) já com a copy nova.
-- O link de agendamento é o personalizado por lead (resolveScheduleUrl na
-- CF send-whatsapp: slug determinístico por id) — por construção, em todos
-- os templates. Idempotente: a janela usa whatsapp_sent_at, que fica NULL
-- após o primeiro run.

DO $$
DECLARE n integer;
BEGIN
  IF to_regclass('public.form_submissions') IS NULL THEN
    RAISE NOTICE 'reenvio reativacao: sem form_submissions — pulado';
    RETURN;
  END IF;

  UPDATE public.form_submissions
  SET whatsapp_sent_at   = NULL,
      followup_1_sent_at = NULL,
      followup_2_sent_at = NULL,
      reativacao_em      = NOW()
  WHERE reativacao_em IS NOT NULL
    AND aprovacao_status = 'aprovado'
    AND deleted_at IS NULL
    AND meeting_scheduled IS NOT TRUE
    AND whatsapp_sent_at >= '2026-08-26T14:00:00Z'
    AND whatsapp_sent_at <  '2026-08-26T15:00:00Z'
    AND id <> 'b2904302-7ba1-4cae-b8d7-633f2da53c34';  -- Diego Alves Gonzaga fica

  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'reenvio reativacao: % lead(s) re-armados p/ a copy nova (esperado 23)', n;
END $$;
