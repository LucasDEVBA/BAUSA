-- Briefing diário das 9h (ordem do CEO, 2026-08-27): o aviso de "leads
-- aguardando aprovação" por e-mail/WhatsApp saía a cada tick do monitor
-- (30min) e acumulava repetido; passa a sair UMA vez por dia às 9h BRT,
-- junto com o resumo do dia anterior (CF monitor-health).
--
-- Seed da chave de estado — regra da casa: chave nova de
-- configuracoes_sistema NASCE em migration com ON CONFLICT DO NOTHING;
-- sem a linha, o PATCH da CF é no-op silencioso e o briefing repetiria
-- todo tick (exatamente o bug que esta feature mata).

DO $$
BEGIN
  IF to_regclass('public.configuracoes_sistema') IS NULL THEN
    RAISE NOTICE 'briefing_diario: sem configuracoes_sistema — pulado';
    RETURN;
  END IF;

  INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
  VALUES ('briefing_diario_state', '{}'::jsonb,
          'Estado do briefing diário das 9h (monitor-health): {dia, enviado_em}. A CF marca o dia ANTES de enviar — garante no máximo 1 envio/dia.')
  ON CONFLICT (chave) DO NOTHING;
END $$;
