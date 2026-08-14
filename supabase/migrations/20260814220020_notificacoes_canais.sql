-- ════════════════════════════════════════════════════════════════════════
-- Migration: matriz de notificações (evento × canal)
-- Aplica em: public (PRD) + uat/dev gateados por tabela.
-- Contexto:
--   Os alertas do monitor saíam TODOS por WhatsApp + e-mail, o que virou
--   ruído: o CEO deixa de ler e o alerta perde a função. Agora cada evento
--   declara em quais canais sai, e o padrão é conservador — só o que é
--   crítico (funil parado, mensageria fora do ar) sai por e-mail.
--   'lead_aguardando_aprovacao' é o único que nasce com WhatsApp ligado:
--   é o evento que exige ação do CEO no mesmo dia.
-- Idempotente: ON CONFLICT DO NOTHING (não sobrescreve escolha do CEO).
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  sch TEXT;
  payload JSONB := '{
    "lead_aguardando_aprovacao": {"inapp": true,  "email": true,  "whatsapp": true},
    "monitor_critico":           {"inapp": true,  "email": true,  "whatsapp": false},
    "monitor_atencao":           {"inapp": true,  "email": false, "whatsapp": false},
    "reuniao_confirmada":        {"inapp": true,  "email": false, "whatsapp": true},
    "contrato_fechado":          {"inapp": true,  "email": true,  "whatsapp": false}
  }'::jsonb;
BEGIN
  FOREACH sch IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    CONTINUE WHEN to_regclass(sch || '.configuracoes_sistema') IS NULL;

    EXECUTE format($f$
      INSERT INTO %I.configuracoes_sistema (chave, valor, descricao)
      VALUES (
        'notificacoes_canais',
        %L::jsonb,
        'Quais canais cada evento usa. Chaves: lead_aguardando_aprovacao, monitor_critico, monitor_atencao, reuniao_confirmada, contrato_fechado. Cada uma com inapp/email/whatsapp booleanos. Editável em Configurações → Notificações.'
      )
      ON CONFLICT (chave) DO NOTHING
    $f$, sch, payload);

    -- Severidade de cada check do monitor. O que não estiver aqui é tratado
    -- como 'atencao' — novo check nasce silencioso de propósito: melhor
    -- descobrir que faltou classificar do que acordar o CEO sem necessidade.
    EXECUTE format($f$
      INSERT INTO %I.configuracoes_sistema (chave, valor, descricao)
      VALUES (
        'monitor_severidades',
        '{
          "zapi_conexao": "critico",
          "envios_sem_espelho": "critico",
          "fila_whatsapp_presa": "critico",
          "qualificacao_travada": "critico",
          "entrada_zero": "critico",
          "calendar_watch_expirando": "critico",
          "runs_presos": "critico",
          "billing_tick_atrasado": "critico",
          "runs_erro": "atencao",
          "chatbot_erro": "atencao",
          "remarketing_presa": "atencao",
          "regua_cobranca": "atencao",
          "experiencia_nps": "atencao",
          "meta_frescor": "atencao",
          "ads_cpl_alvo": "atencao",
          "transcricao_faltante": "atencao",
          "sheets_sync_pendente": "atencao",
          "weekly_report_atrasado": "atencao",
          "automacoes_saude": "atencao",
          "aprovacao_pendente_antiga": "atencao"
        }'::jsonb,
        'Severidade por check do monitor: critico | atencao. Governa qual bloco de canais (monitor_critico/monitor_atencao) o alerta usa. Check ausente = atencao.'
      )
      ON CONFLICT (chave) DO NOTHING
    $f$, sch);
  END LOOP;
END $$;
