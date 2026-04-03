-- ============================================================
-- CRM Bolsa Atleta USA — Tarefas e Notificações
-- ============================================================

-- ── Tarefas ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tarefas (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo                 TEXT NOT NULL,
  descricao              TEXT,
  responsavel_id         UUID NOT NULL REFERENCES public.user_profiles(id),
  prazo                  TIMESTAMPTZ NOT NULL,
  prioridade             prioridade_tarefa NOT NULL DEFAULT 'media',
  status                 status_tarefa NOT NULL DEFAULT 'pendente',
  deal_id                UUID REFERENCES public.deals(id),
  atleta_id              UUID REFERENCES public.atletas(id),
  experiencia_id         UUID REFERENCES public.crm_experiencia(id),
  modulo_origem          TEXT NOT NULL DEFAULT 'comercial'
                         CHECK (modulo_origem IN ('comercial','experiencia','financeiro','admissao')),
  criada_automaticamente BOOLEAN NOT NULL DEFAULT false,
  recorrencia            TEXT NOT NULL DEFAULT 'nenhuma'
                         CHECK (recorrencia IN ('nenhuma','diaria','semanal','mensal')),
  completed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at             TIMESTAMPTZ,
  created_by             UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.tarefas IS 'Tarefas manuais ou automáticas vinculadas a deals/atletas/experiência.';

DROP TRIGGER IF EXISTS trg_tarefas_updated_at ON public.tarefas;
CREATE TRIGGER trg_tarefas_updated_at
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel ON public.tarefas(responsavel_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON public.tarefas(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tarefas_prazo ON public.tarefas(prazo) WHERE deleted_at IS NULL AND status != 'concluida';
CREATE INDEX IF NOT EXISTS idx_tarefas_deal ON public.tarefas(deal_id) WHERE deal_id IS NOT NULL;

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tarefas_select" ON public.tarefas;
CREATE POLICY "tarefas_select" ON public.tarefas
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (
    public.get_user_papel() = 'ceo' OR responsavel_id = auth.uid()
  ));

DROP POLICY IF EXISTS "tarefas_insert" ON public.tarefas;
CREATE POLICY "tarefas_insert" ON public.tarefas
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "tarefas_update" ON public.tarefas;
CREATE POLICY "tarefas_update" ON public.tarefas
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() = 'ceo' OR responsavel_id = auth.uid())
  WITH CHECK (public.get_user_papel() = 'ceo' OR responsavel_id = auth.uid());

DROP POLICY IF EXISTS "tarefas_delete" ON public.tarefas;
CREATE POLICY "tarefas_delete" ON public.tarefas
  FOR DELETE TO authenticated USING (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "tarefas_service" ON public.tarefas;
CREATE POLICY "tarefas_service" ON public.tarefas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Notificações ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id   UUID NOT NULL REFERENCES auth.users(id),
  titulo            TEXT NOT NULL,
  mensagem          TEXT NOT NULL,
  tipo              TEXT NOT NULL,
  severidade        TEXT NOT NULL CHECK (severidade IN ('critica','alta','media','baixa')),
  lida              BOOLEAN NOT NULL DEFAULT false,
  lida_at           TIMESTAMPTZ,
  deal_id           UUID REFERENCES public.deals(id),
  link              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Imutável: sem updated_at, deleted_at
);

COMMENT ON TABLE public.notificacoes IS 'Notificações in-app. Regra: toda notificação espelhada ao CEO.';

CREATE INDEX IF NOT EXISTS idx_notif_destinatario ON public.notificacoes(destinatario_id, lida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_deal ON public.notificacoes(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notif_severidade ON public.notificacoes(severidade) WHERE lida = false;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- SELECT: próprias notificações OU CEO vê tudo
DROP POLICY IF EXISTS "notif_select" ON public.notificacoes;
CREATE POLICY "notif_select" ON public.notificacoes
  FOR SELECT TO authenticated
  USING (destinatario_id = auth.uid() OR public.get_user_papel() = 'ceo');

-- INSERT: via server actions / service_role
DROP POLICY IF EXISTS "notif_insert" ON public.notificacoes;
CREATE POLICY "notif_insert" ON public.notificacoes
  FOR INSERT TO authenticated WITH CHECK (true);

-- UPDATE: apenas marcar como lida (próprias)
DROP POLICY IF EXISTS "notif_update" ON public.notificacoes;
CREATE POLICY "notif_update" ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (destinatario_id = auth.uid())
  WITH CHECK (destinatario_id = auth.uid());

DROP POLICY IF EXISTS "notif_service" ON public.notificacoes;
CREATE POLICY "notif_service" ON public.notificacoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Audit triggers
DROP TRIGGER IF EXISTS trg_audit_tarefas ON public.tarefas;
CREATE TRIGGER trg_audit_tarefas
  AFTER INSERT OR UPDATE OR DELETE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();
