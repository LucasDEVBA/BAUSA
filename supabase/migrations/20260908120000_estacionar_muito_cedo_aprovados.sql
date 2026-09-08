-- ════════════════════════════════════════════════════════════════════════
-- Estacionar em aguardando_timing os muito_cedo aprovados órfãos na coluna
-- Lead (ordem do CEO, 2026-09-08 — tela de revisão dos muito cedo)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto: as mensagens automáticas de timing E a retomada de novembro
-- foram DESLIGADAS (sistema_automacoes_ativas, 2026-09-07/08). A revisão
-- manual dos muito cedo acontece na coluna Aguardando Timing do pipeline
-- (clique no card → dossiê completo; "Ativar agora" move para Lead).
--
-- Aprovações antigas/re-aprovações deixaram deals muito_cedo na etapa
-- 'lead' (o aprovarLead só estaciona ao CRIAR deal novo) — misturados com
-- leads em trabalho ativo. Este one-shot os reúne no estacionamento.
--
-- Recorte conservador (mesma família da 20260904120000):
--   · lead muito_cedo, QUENTE/MORNO, APROVADO, sem reunião detectada
--   · deal ativo ainda em etapa inicial ('lead', 'contato_feito')
-- Entrar em aguardando_timing NÃO é retrocesso (isenção no trigger).
-- Sair é decisão do CEO ("Ativar agora" ou arrastar de volta).
-- Idempotente: re-rodar não encontra mais linhas no recorte.

DO $$
DECLARE n integer;
BEGIN
  IF to_regclass('public.deals') IS NULL THEN
    RAISE NOTICE 'estacionar_muito_cedo: sem tabela deals — pulado';
    RETURN;
  END IF;

  UPDATE public.deals d
  SET etapa = 'aguardando_timing'
  FROM public.atletas a
  JOIN public.form_submissions fs ON fs.id = a.form_submission_id
  WHERE d.atleta_id = a.id
    AND d.deleted_at IS NULL
    AND d.etapa IN ('lead', 'contato_feito')
    AND fs.deleted_at IS NULL
    AND fs.timing_status = 'muito_cedo'
    AND fs.qualification_classification IN ('QUENTE', 'MORNO')
    AND fs.aprovacao_status = 'aprovado'
    AND fs.meeting_scheduled IS NOT TRUE;

  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'estacionar_muito_cedo: % deal(s) movidos para aguardando_timing', n;
END $$;
