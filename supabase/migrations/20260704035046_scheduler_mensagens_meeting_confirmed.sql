-- ════════════════════════════════════════════════════════════════════════════
-- Migration: scheduler_mensagens + meeting_confirmed — textos da confirmação
--            de reunião (calendar-webhook) editáveis     | public, uat, dev
-- Contexto (Fase H1 das automações): a CF calendar-webhook passa a ler a chave
--   meeting_confirmed de configuracoes_sistema.scheduler_mensagens ao confirmar
--   reunião detectada no Google Calendar. Par { lead, ceo } — shape DIFERENTE
--   dos demais templates ({ atleta, responsavel }): lead = confirmação enviada
--   à família; ceo = notificação interna ao CEO.
--   FALLBACK PERMANENTE nos builders hardcoded da CF (guard:
--   tests/calendar-webhook-mensagens.test.js) — chave ausente, erro de rede ou
--   texto vazio → comportamento atual inalterado.
--   Seed = cópia byte a byte dos textos atuais da CF, com placeholders no lugar
--   das interpolações: {atleta_nome}, {responsavel_nome}, {telefone}, {email},
--   {data_reuniao}, {hora_reuniao}. {meet_link} fica disponível mas NÃO é
--   obrigatório — o link do Meet sempre vai anexado como preview do WhatsApp
--   (sendLinkMessage), independente do texto.
-- Merge idempotente: `valor || jsonb` APENAS quando a chave ainda não existe
--   (guard WHERE NOT (valor ? 'meeting_confirmed')) — rodar 2x não sobrescreve
--   edição do CEO. Row ausente (seed 20260704024235 pendente) → no-op seguro.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_meeting jsonb := $seed_json${
  "lead": "✅ *Reunião Estratégica Individual confirmada!*\n\nOlá, *{responsavel_nome}*!\n\nSua reunião com *Leandro Ribeiro* está confirmada.\n\n📅 *Data:* {data_reuniao}\n🕐 *Horário:* {hora_reuniao}h (Brasília)\n\n_Recomendamos acessar 5 minutos antes do horário marcado._\n\nNos vemos em breve!\n*Bolsa Atleta USA*",
  "ceo": "🔔 *Nova Reunião Agendada*\n\n*Atleta:* {atleta_nome}\n*Responsável:* {responsavel_nome}\n*Telefone:* {telefone}\n*Email:* {email}\n\n📅 *{data_reuniao}*\n🕐 *{hora_reuniao}h*"
}$seed_json$::jsonb;
BEGIN
  -- ─── PUBLIC (PRD) ───
  UPDATE public.configuracoes_sistema
     SET valor = valor || jsonb_build_object('meeting_confirmed', v_meeting)
   WHERE chave = 'scheduler_mensagens'
     AND NOT (valor ? 'meeting_confirmed');

  -- ─── UAT ───
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE 'UPDATE uat.configuracoes_sistema '
         || 'SET valor = valor || jsonb_build_object($1::text, $2) '
         || 'WHERE chave = $3 AND NOT (valor ? $1)'
      USING 'meeting_confirmed', v_meeting, 'scheduler_mensagens';
  END IF;

  -- ─── DEV ───
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE 'UPDATE dev.configuracoes_sistema '
         || 'SET valor = valor || jsonb_build_object($1::text, $2) '
         || 'WHERE chave = $3 AND NOT (valor ? $1)'
      USING 'meeting_confirmed', v_meeting, 'scheduler_mensagens';
  END IF;
END $$;
