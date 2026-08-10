-- ════════════════════════════════════════════════════════════════════════
-- Migration: seed do heartbeat do sync Meta (meta_sync_last_tick_at)
-- Aplica em: public, uat, dev
-- Contexto: o check meta_frescor media MAX(meta_ads_campanha.data) — a data
--   do último GASTO. Com campanhas pausadas (gasto 0), acusava "CAC/DRE
--   CONGELADOS (token expirado?)" com o sync perfeito — diagnóstico enganoso
--   (por isso meta_frescor entrou em monitor_checks_desativados 2026-08-10).
--   O check v2 mede a VIDA DO SYNC: a CF sync-meta-spend grava este heartbeat
--   em TODO tick (mesmo com gasto 0), padrão billing_last_tick_at.
--   Seed obrigatório: PATCH em chave não semeada = 0 rows silencioso.
-- Idempotente (ON CONFLICT DO NOTHING; gates por information_schema.tables).
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO public.configuracoes_sistema (chave, valor, descricao, editavel_ceo)
VALUES
  ('meta_sync_last_tick_at', '{}'::jsonb,
   'Heartbeat do sync de Meta Ads (sync-meta-spend): {at, meses, linhas} por tick. Vazio = nunca rodou. Check meta_frescor: sem tick >26h = sync parado/token inválido.',
   false)
ON CONFLICT (chave) DO NOTHING;

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'uat' AND table_name = 'configuracoes_sistema') THEN
    EXECUTE $sql$
      INSERT INTO uat.configuracoes_sistema (chave, valor, descricao, editavel_ceo)
      VALUES ('meta_sync_last_tick_at', '{}'::jsonb, 'Heartbeat do sync de Meta Ads.', false)
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'dev' AND table_name = 'configuracoes_sistema') THEN
    EXECUTE $sql$
      INSERT INTO dev.configuracoes_sistema (chave, valor, descricao, editavel_ceo)
      VALUES ('meta_sync_last_tick_at', '{}'::jsonb, 'Heartbeat do sync de Meta Ads.', false)
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;
