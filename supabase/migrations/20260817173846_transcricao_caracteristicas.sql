-- Características valorizadas da reunião (2026-08-17): extraídas da
-- transcrição por IA sob demanda na aba Reunião (valor de investimento
-- citado, urgência, decisor, objeções, sinais de interesse, próximos
-- passos). NULL = ainda não extraída; cache — reprocessar é gesto explícito.
DO $$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    IF to_regclass(format('%I.reunioes_transcricoes', s)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.reunioes_transcricoes ADD COLUMN IF NOT EXISTS caracteristicas jsonb',
        s
      );
    END IF;
  END LOOP;
END $$;
