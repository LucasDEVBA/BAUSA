-- ============================================================
-- CRM Bolsa Atleta USA — Função para setar user_id no audit
-- Chamada via RPC antes de operações que precisam de audit trail
-- com user_id preenchido.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_audit_user()
RETURNS void AS $$
BEGIN
  PERFORM set_config('audit.user_id', auth.uid()::text, true);
  PERFORM set_config('audit.user_papel',
    COALESCE((SELECT papel::text FROM public.user_profiles WHERE id = auth.uid()), 'unknown'),
    true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.set_audit_user() IS 'Seta user_id e papel no contexto da transação para o audit trail';
