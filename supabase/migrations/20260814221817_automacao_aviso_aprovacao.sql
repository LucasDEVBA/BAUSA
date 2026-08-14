-- ════════════════════════════════════════════════════════════════════════
-- Migration: automação de sistema "Aviso de aprovação"
-- Aplica em: public + uat/dev (gateado por tabela)
-- Contexto:
--   O aviso de lead esperando aprovação passou a disparar na HORA da
--   qualificação (CF qualify-lead), não mais só no tick do monitor. Esta
--   âncora faz as execuções aparecerem na aba Execuções de /automacoes,
--   como as demais automações de sistema.
--   ID casado com RUN_AVISO_APROVACAO_ID na CF (guard de CI compara).
-- Idempotente: ON CONFLICT DO NOTHING.
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE sch TEXT;
BEGIN
  FOREACH sch IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    CONTINUE WHEN to_regclass(sch || '.automacoes') IS NULL;
    EXECUTE format($f$
      INSERT INTO %I.automacoes (id, nome, descricao, gatilho, ativo)
      VALUES (
        'a0000000-0000-4000-8000-000000000009',
        'Aviso de aprovação (sistema)',
        'Avisa o CEO no WhatsApp assim que um lead QUENTE/MORNO entra na fila de aprovação. Canais em Configurações → Notificações.',
        'sistema',
        FALSE
      )
      ON CONFLICT (id) DO NOTHING
    $f$, sch);
  END LOOP;
END $$;
