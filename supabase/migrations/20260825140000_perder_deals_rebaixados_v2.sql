-- Deals de leads REBAIXADOS pelo classificador v2 → Perdido (ordem do CEO,
-- 2026-08-24: "Pode mover os rebaixados para Perdido com esse motivo").
--
-- Após o mutirão de requalificação, leads antes QUENTE/MORNO (com deal
-- criado na era pré-gate ou aprovados) viraram FRIO/INVALIDO/INCOMPLETO —
-- os deals deles poluíam a coluna "Lead qualificado" (204 cards). Este
-- one-shot move para 'perdido' com motivo ESTRUTURADO:
--   motivo_perda  = 'atleta_nao_qualificado' (valor existente do enum —
--                   ADD VALUE não pode ser usado na mesma transaction)
--   detalhe_perda = 'Requalificado <CLASSE> no classificador v2 (mutirão 2026-08-24)'
--
-- Recorte CONSERVADOR (reversível card a card no kanban — pipeline é livre):
-- • SÓ etapas pré-reunião ('contato_feito','lead','aguardando_timing') — a
--   população do mutirão era "sem reunião"; qualquer deal adiantado fica.
-- • SÓ leads com meeting_scheduled IS NOT TRUE (cinto e suspensório).
-- • pode_reativar = false (não polui a seção Projetos Futuros; reviver é
--   gesto manual no kanban).
-- • desfecho_real NÃO é gravado: fechamento ADMINISTRATIVO pós-rebaixamento
--   alimentaria o loop de aprendizado com profecia autorrealizável
--   ("modelo previu FRIO → nós perdemos → modelo acertou"). Só desfecho
--   orgânico (moverDeal) conta no previsto × realizado.
-- • Trigger de auditoria de deals registra dados_anteriores/novos (trail).
-- Idempotente: segunda execução não encontra etapa pré-reunião com lead
-- rebaixado (todas já viraram 'perdido').

DO $$
DECLARE
  n integer;
BEGIN
  IF to_regclass('public.deals') IS NULL THEN
    RAISE NOTICE 'perder_rebaixados_v2: sem tabela deals — pulado';
    RETURN;
  END IF;

  UPDATE public.deals d
  SET etapa = 'perdido',
      etapa_anterior = d.etapa,
      motivo_perda = 'atleta_nao_qualificado',
      detalhe_perda = 'Requalificado ' || fs.qualification_classification ||
                      ' no classificador v2 (mutirão 2026-08-24)',
      pode_reativar = false
  FROM public.atletas a
  JOIN public.form_submissions fs ON fs.id = a.form_submission_id
  WHERE d.atleta_id = a.id
    AND d.deleted_at IS NULL
    AND d.etapa IN ('contato_feito', 'lead', 'aguardando_timing')
    AND fs.deleted_at IS NULL
    AND fs.qualification_classification IN ('FRIO', 'INVALIDO', 'INCOMPLETO')
    AND fs.meeting_scheduled IS NOT TRUE;

  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'perder_rebaixados_v2: % deal(s) movidos para perdido', n;
END $$;
