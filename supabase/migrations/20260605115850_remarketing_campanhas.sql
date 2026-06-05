-- ════════════════════════════════════════════════════════════════════════
-- Migration: Campanhas de re-marketing via WhatsApp (disparo automatizável)
-- Aplica em public, uat, dev.
-- ════════════════════════════════════════════════════════════════════════
--
-- Suporta o disparo controlado da aba /remarketing:
--   remarketing_campanhas — registro de cada campanha (segmento + mensagem)
--   remarketing_envios     — 1 linha por destinatário (idempotência via CAS
--                            em enviado_at; UNIQUE campanha_id+deal_id)
--   remarketing_optout     — telefones que pediram para não receber (LGPD)
--
-- Salvaguardas anti-ban são aplicadas na Cloud Function send-remarketing
-- (throttle, limite diário, horário seguro), não no schema.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.remarketing_campanhas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segmento     TEXT NOT NULL,
  mensagem     TEXT NOT NULL,
  filtros      JSONB DEFAULT '{}'::jsonb,
  total_alvo   INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'rascunho'
                 CHECK (status IN ('rascunho','enviando','concluida','pausada')),
  criada_por   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ
);
COMMENT ON TABLE public.remarketing_campanhas IS 'Campanhas de re-marketing via WhatsApp. Disparo controlado pela CF send-remarketing.';

CREATE TABLE IF NOT EXISTS public.remarketing_envios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id  UUID NOT NULL REFERENCES public.remarketing_campanhas(id),
  deal_id      UUID,
  atleta_id    UUID,
  telefone     TEXT NOT NULL,
  nome         TEXT,
  esporte      TEXT,
  status       TEXT NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente','enviado','erro','optout','sem_telefone')),
  enviado_at   TIMESTAMPTZ,            -- CAS: NULL = pendente
  erro         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_envio_campanha_deal UNIQUE (campanha_id, deal_id)
);
COMMENT ON COLUMN public.remarketing_envios.enviado_at IS 'CAS atômico: marca antes de enviar via Z-API; impede reenvio duplicado.';

CREATE INDEX IF NOT EXISTS idx_remktg_envios_pendentes
  ON public.remarketing_envios (campanha_id)
  WHERE status = 'pendente' AND enviado_at IS NULL;

CREATE TABLE IF NOT EXISTS public.remarketing_optout (
  telefone   TEXT PRIMARY KEY,
  atleta_id  UUID,
  motivo     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.remarketing_optout IS 'Telefones que pediram para não receber re-marketing (LGPD). A CF respeita antes de enviar.';

-- Triggers updated_at + audit (campanhas)
DROP TRIGGER IF EXISTS trg_remktg_camp_updated_at ON public.remarketing_campanhas;
CREATE TRIGGER trg_remktg_camp_updated_at BEFORE UPDATE ON public.remarketing_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_audit_remktg_camp ON public.remarketing_campanhas;
CREATE TRIGGER trg_audit_remktg_camp AFTER INSERT OR UPDATE OR DELETE ON public.remarketing_campanhas
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- RLS: leitura autenticada; escrita só CEO; service_role bypass (CF)
ALTER TABLE public.remarketing_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarketing_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarketing_optout ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "remktg_camp_select" ON public.remarketing_campanhas;
CREATE POLICY "remktg_camp_select" ON public.remarketing_campanhas FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "remktg_camp_ceo" ON public.remarketing_campanhas;
CREATE POLICY "remktg_camp_ceo" ON public.remarketing_campanhas FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo') WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "remktg_camp_service" ON public.remarketing_campanhas;
CREATE POLICY "remktg_camp_service" ON public.remarketing_campanhas FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "remktg_env_select" ON public.remarketing_envios;
CREATE POLICY "remktg_env_select" ON public.remarketing_envios FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "remktg_env_service" ON public.remarketing_envios;
CREATE POLICY "remktg_env_service" ON public.remarketing_envios FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "remktg_opt_select" ON public.remarketing_optout;
CREATE POLICY "remktg_opt_select" ON public.remarketing_optout FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "remktg_opt_ceo" ON public.remarketing_optout;
CREATE POLICY "remktg_opt_ceo" ON public.remarketing_optout FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo') WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "remktg_opt_service" ON public.remarketing_optout;
CREATE POLICY "remktg_opt_service" ON public.remarketing_optout FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─── UAT + DEV (DO blocks) ──────────────────────────────────────────────
DO $$
DECLARE s TEXT;
BEGIN
  FOR s IN SELECT unnest(ARRAY['uat','dev']) LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = s) THEN
      EXECUTE format($f$
        CREATE TABLE IF NOT EXISTS %1$I.remarketing_campanhas (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          segmento TEXT NOT NULL, mensagem TEXT NOT NULL, filtros JSONB DEFAULT '{}'::jsonb,
          total_alvo INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviando','concluida','pausada')),
          criada_por UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ);
        CREATE TABLE IF NOT EXISTS %1$I.remarketing_envios (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          campanha_id UUID NOT NULL REFERENCES %1$I.remarketing_campanhas(id),
          deal_id UUID, atleta_id UUID, telefone TEXT NOT NULL, nome TEXT, esporte TEXT,
          status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','erro','optout','sem_telefone')),
          enviado_at TIMESTAMPTZ, erro TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_envio_campanha_deal UNIQUE (campanha_id, deal_id));
        CREATE INDEX IF NOT EXISTS idx_remktg_envios_pendentes ON %1$I.remarketing_envios (campanha_id)
          WHERE status = 'pendente' AND enviado_at IS NULL;
        CREATE TABLE IF NOT EXISTS %1$I.remarketing_optout (
          telefone TEXT PRIMARY KEY, atleta_id UUID, motivo TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        DROP TRIGGER IF EXISTS trg_remktg_camp_updated_at ON %1$I.remarketing_campanhas;
        CREATE TRIGGER trg_remktg_camp_updated_at BEFORE UPDATE ON %1$I.remarketing_campanhas
          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
        ALTER TABLE %1$I.remarketing_campanhas ENABLE ROW LEVEL SECURITY;
        ALTER TABLE %1$I.remarketing_envios ENABLE ROW LEVEL SECURITY;
        ALTER TABLE %1$I.remarketing_optout ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "remktg_camp_select" ON %1$I.remarketing_campanhas;
        CREATE POLICY "remktg_camp_select" ON %1$I.remarketing_campanhas FOR SELECT TO authenticated USING (deleted_at IS NULL);
        DROP POLICY IF EXISTS "remktg_camp_ceo" ON %1$I.remarketing_campanhas;
        CREATE POLICY "remktg_camp_ceo" ON %1$I.remarketing_campanhas FOR ALL TO authenticated
          USING (public.get_user_papel() = 'ceo') WITH CHECK (public.get_user_papel() = 'ceo');
        DROP POLICY IF EXISTS "remktg_camp_service" ON %1$I.remarketing_campanhas;
        CREATE POLICY "remktg_camp_service" ON %1$I.remarketing_campanhas FOR ALL TO service_role USING (true) WITH CHECK (true);
        DROP POLICY IF EXISTS "remktg_env_service" ON %1$I.remarketing_envios;
        CREATE POLICY "remktg_env_service" ON %1$I.remarketing_envios FOR ALL TO service_role USING (true) WITH CHECK (true);
        DROP POLICY IF EXISTS "remktg_env_select" ON %1$I.remarketing_envios;
        CREATE POLICY "remktg_env_select" ON %1$I.remarketing_envios FOR SELECT TO authenticated USING (true);
        DROP POLICY IF EXISTS "remktg_opt_service" ON %1$I.remarketing_optout;
        CREATE POLICY "remktg_opt_service" ON %1$I.remarketing_optout FOR ALL TO service_role USING (true) WITH CHECK (true);
        DROP POLICY IF EXISTS "remktg_opt_select" ON %1$I.remarketing_optout;
        CREATE POLICY "remktg_opt_select" ON %1$I.remarketing_optout FOR SELECT TO authenticated USING (true);
      $f$, s);
    END IF;
  END LOOP;
END $$;
