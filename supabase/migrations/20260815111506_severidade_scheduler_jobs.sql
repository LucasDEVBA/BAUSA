-- ════════════════════════════════════════════════════════════════════════
-- Migration: severidade do check novo `scheduler_jobs` (monitor-health)
-- Aplica em: public + uat/dev gateados por tabela.
-- Contexto:
--   Incidente 2026-08-15: o chatbot-autonomo falhou a cada tick por ~24h
--   ("Supabase não configurado") e nenhum check percebeu — o check de
--   negócio lê a tabela de decisões, e a CF morria antes de gravar nela.
--   O check novo lê o resultado da última tentativa de cada job do Cloud
--   Scheduler. Job de produção falhando = automação parada ⇒ crítico.
--   `||` com o valor existente à direita: customização do CEO vence.
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE sch TEXT;
BEGIN
  FOREACH sch IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    CONTINUE WHEN to_regclass(sch || '.configuracoes_sistema') IS NULL;
    EXECUTE format($f$
      UPDATE %I.configuracoes_sistema
      SET valor = '{"scheduler_jobs": "critico"}'::jsonb || COALESCE(valor, '{}'::jsonb),
          updated_at = NOW()
      WHERE chave = 'monitor_severidades'
    $f$, sch);
  END LOOP;
END $$;
