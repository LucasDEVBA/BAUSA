-- ============================================================
-- CRM Bolsa Atleta USA — Migration 10: Índices de Performance
-- Índices adicionais para queries do War Room, Pipeline e buscas.
-- ============================================================

-- ── Deals — queries do War Room ──────────────────────────────

-- Deals sem next_action (alerta)
CREATE INDEX IF NOT EXISTS idx_deals_sem_next_action ON public.deals(created_at)
  WHERE next_action IS NULL
  AND deleted_at IS NULL
  AND etapa NOT IN ('perdido', 'concluido', 'cancelamento_solicitado');

-- Deals por data de criação (relatórios)
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON public.deals(created_at DESC)
  WHERE deleted_at IS NULL;

-- ── Atletas — busca e relatórios ─────────────────────────────

-- Busca por nome (full text)
CREATE INDEX IF NOT EXISTS idx_atletas_nome_completo ON public.atletas
  USING gin (nome_completo gin_trgm_ops);

-- Atletas por data de criação
CREATE INDEX IF NOT EXISTS idx_atletas_created_at ON public.atletas(created_at DESC)
  WHERE deleted_at IS NULL;

-- ── Responsáveis — dedup e busca ─────────────────────────────

-- Já criados na migration 5: idx_responsaveis_whatsapp, idx_responsaveis_email
-- Busca por nome (trigram) já criado na migration 5

-- ── Parcelas — War Room financeiro ───────────────────────────

-- Parcelas previstas (filtro por status, sem CURRENT_DATE — não é IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_parcelas_proximas ON public.parcelas(vencimento)
  WHERE status = 'previsto'
  AND deleted_at IS NULL;

-- ── Audit logs — consulta por timeline ───────────────────────

-- Timeline de um registro específico (mais recentes primeiro)
-- Já criado na migration 3: idx_audit_logs_tabela_registro, idx_audit_logs_created_at

-- ── Habilitar extensão pg_trgm para busca fuzzy ─────────────
-- Necessária para os índices GIN com gin_trgm_ops
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Nota: se o índice gin_trgm_ops falhou nas migrations anteriores
-- por falta da extensão, recria-os aqui:
CREATE INDEX IF NOT EXISTS idx_atletas_nome_completo ON public.atletas
  USING gin (nome_completo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_responsaveis_nome ON public.responsaveis
  USING gin (nome gin_trgm_ops);
