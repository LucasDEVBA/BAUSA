-- ════════════════════════════════════════════════════════════════════════
-- Migration: Grupos de WhatsApp — captura AUTOMÁTICA (opt-out)
-- Aplica em public (+ uat/dev quando a tabela existir)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto (decisão de produto, CEO 2026-08-10): "os grupos já devem ser
-- capturados como automático, só desabilitado se quiser". Reverte o default
-- opt-in da migration 20260712140500 (rationale LGPD original): a ferramenta
-- é interna, os grupos são das famílias atendidas (consentimento LGPD no
-- onboarding) e o CEO é o operador único — o toggle por grupo permanece como
-- opt-out consciente.
--
-- Mudanças:
--   1. DEFAULT de whatsapp_grupos.capturar: false → true (grupos novos já
--      nascem capturando — a RPC whatsapp_grupo_ingest omite a coluna no
--      INSERT, então o default governa).
--   2. Backfill: grupos existentes com capturar=false viram true (o false
--      era o default herdado, não uma escolha; quem quiser silenciar um
--      grupo específico desliga na aba WhatsApp → Grupos).
--
-- O gate `IF v_capturar` da RPC permanece — desligar continua funcionando.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC SCHEMA (PRD) ────────────────────────────────────────────────

ALTER TABLE public.whatsapp_grupos
  ALTER COLUMN capturar SET DEFAULT true;

UPDATE public.whatsapp_grupos
SET capturar = true
WHERE capturar = false
  AND deleted_at IS NULL;

-- ─── UAT ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('uat.whatsapp_grupos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.whatsapp_grupos ALTER COLUMN capturar SET DEFAULT true';
    EXECUTE 'UPDATE uat.whatsapp_grupos SET capturar = true
      WHERE capturar = false AND deleted_at IS NULL';
  END IF;
END $$;

-- ─── DEV ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('dev.whatsapp_grupos') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.whatsapp_grupos ALTER COLUMN capturar SET DEFAULT true';
    EXECUTE 'UPDATE dev.whatsapp_grupos SET capturar = true
      WHERE capturar = false AND deleted_at IS NULL';
  END IF;
END $$;
