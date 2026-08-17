-- Soft delete de lead (exclusão pelo CEO no Engine, 2026-08-15).
--
-- A linha NUNCA é apagada: deleted_at marca a exclusão (auditável e
-- reversível). Sintoma da ausência desta coluna em produção: duplicata
-- "arquivada" à mão renomeando o lead para "[ARQUIVADO] ..." e trocando o
-- e-mail — o registro seguia vivo para schedulers e métricas.
--
-- TODO scan de elegibilidade/lista/agregado passa a filtrar
-- deleted_at IS NULL (guard: tests/scheduler-eligibility.test.js).
-- atletas e deals já possuem deleted_at — a exclusão cascateia por soft
-- delete nos três.
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    IF to_regclass(format('%I.form_submissions', s)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.form_submissions ADD COLUMN IF NOT EXISTS deleted_at timestamptz',
        s
      );
    END IF;
  END LOOP;
END $$;
