-- ════════════════════════════════════════════════════════════════════════
-- Migration: semeia a chave `scheduler_jobs_state` (sinal F2 do monitor)
-- Aplica em: public + uat/dev gateados por tabela.
-- Contexto:
--   O check scheduler_jobs grava seu resultado via salvarConfigKey, que é
--   PATCH puro: em chave inexistente afeta 0 linhas e "funciona" — o sinal
--   nunca aparecia e a tela /observabilidade ficava eternamente em "sem
--   sinal ainda". Mesma classe do bug de Configurações (update sem upsert).
--   PRD foi semeada à mão em 2026-08-15; esta migration torna o seed
--   durável e cobre uat/dev.
-- Idempotente: ON CONFLICT DO NOTHING.
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE sch TEXT;
BEGIN
  FOREACH sch IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    CONTINUE WHEN to_regclass(sch || '.configuracoes_sistema') IS NULL;
    EXECUTE format($f$
      INSERT INTO %I.configuracoes_sistema (chave, valor, descricao)
      VALUES (
        'scheduler_jobs_state',
        '{}'::jsonb,
        'Sinal F2 do check scheduler_jobs (monitor-health): resultado da última leitura da API do Cloud Scheduler. A tela /observabilidade lê daqui.'
      )
      ON CONFLICT (chave) DO NOTHING
    $f$, sch);
  END LOOP;
END $$;
