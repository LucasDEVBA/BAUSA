-- ============================================================
-- CRM Bolsa Atleta USA — Policy: SELECT em form_submissions
-- Permite que usuários autenticados do CRM leiam form_submissions
-- para a tela de "Leads Novos" (promoção de leads).
-- NÃO altera nenhuma outra policy existente.
-- ============================================================

-- SELECT para authenticated (CRM pode ler leads do formulário público)
DROP POLICY IF EXISTS "authenticated_can_select" ON public.form_submissions;
CREATE POLICY "authenticated_can_select"
  ON public.form_submissions
  FOR SELECT TO authenticated
  USING (true);
