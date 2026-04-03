-- ============================================================
-- CRM Bolsa Atleta USA — Migration 9: Audit Triggers
-- Aplica audit.log_change() em todas as tabelas do CRM.
-- NÃO aplicar em audit_logs (evita recursão) nem form_submissions.
-- ============================================================

-- ── user_profiles ────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_user_profiles ON public.user_profiles;
CREATE TRIGGER trg_audit_user_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- ── configuracoes_sistema ────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_configuracoes ON public.configuracoes_sistema;
CREATE TRIGGER trg_audit_configuracoes
  AFTER INSERT OR UPDATE OR DELETE ON public.configuracoes_sistema
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- ── enderecos ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_enderecos ON public.enderecos;
CREATE TRIGGER trg_audit_enderecos
  AFTER INSERT OR UPDATE OR DELETE ON public.enderecos
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- ── responsaveis ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_responsaveis ON public.responsaveis;
CREATE TRIGGER trg_audit_responsaveis
  AFTER INSERT OR UPDATE OR DELETE ON public.responsaveis
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- ── atletas ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_atletas ON public.atletas;
CREATE TRIGGER trg_audit_atletas
  AFTER INSERT OR UPDATE OR DELETE ON public.atletas
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- ── deals ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_deals ON public.deals;
CREATE TRIGGER trg_audit_deals
  AFTER INSERT OR UPDATE OR DELETE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- ── contratos_financeiros ────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_contratos ON public.contratos_financeiros;
CREATE TRIGGER trg_audit_contratos
  AFTER INSERT OR UPDATE OR DELETE ON public.contratos_financeiros
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- ── parcelas ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_parcelas ON public.parcelas;
CREATE TRIGGER trg_audit_parcelas
  AFTER INSERT OR UPDATE OR DELETE ON public.parcelas
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();
