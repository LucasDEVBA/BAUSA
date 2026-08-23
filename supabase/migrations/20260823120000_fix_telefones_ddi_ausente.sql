-- Fix de dados — telefones com DDI ausente (incidente Gustavo Telles, 2026-08-23).
--
-- O formulário deixava passar E.164 quebrado: "+28999711222" é DDD 28 com o
-- "+" colado e SEM o 55. O send-whatsapp confiava no "+" e enviava para um
-- DDI inexistente (ou real de OUTRO país: +49 DE, +27 ZA, +51 PE) — o
-- responsável nunca recebia o link de agendamento enquanto o atleta recebia
-- os follow-ups. 69 leads afetados na varredura de 2026-08-23 (~20 QUENTE/
-- MORNO aprovados com envio marcado).
--
-- Cura SÓ o padrão inequívoco de número BR, com o país declarado como
-- desempate (um celular peruano real +51 9… tem a mesma forma):
--   • 11 dígitos após o "+", 3º dígito = 9  → DDD + celular (9XXXXXXXX)
--   • 10 dígitos após o "+"                 → DDD + fixo/celular antigo
--   • DDD ∈ lista Anatel  E  address_country BR (ou NULL, default do form)
-- Um +55 VÁLIDO tem 12–13 dígitos — os comprimentos 10/11 nunca colidem.
--
-- Idempotente: o resultado começa com "+55" e tem 12+ dígitos — não casa
-- mais com os padrões. NÃO dispara mensagens: os webhooks são INSERT-only
-- e as colunas de CAS (*_sent_at) não mudam. Espelho em código:
-- healBrDdiAusente (functions/send-whatsapp) + telefone-analise.ts (Engine).
-- Guard: tests/telefone-heal-invariants.test.js.

DO $$
DECLARE
  s text;
  c text;
  n integer;
BEGIN
  FOREACH s IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    IF to_regclass(s || '.form_submissions') IS NULL THEN
      RAISE NOTICE 'fix_telefones: schema % sem form_submissions — pulado', s;
      CONTINUE;
    END IF;

    FOREACH c IN ARRAY ARRAY['guardian_whatsapp', 'athlete_whatsapp'] LOOP
      EXECUTE format(
        $q$
        UPDATE %I.form_submissions
        SET %I = '+55' || substr(%I, 2)
        WHERE (address_country IS NULL OR upper(address_country) = 'BR')
          AND (
            (%I ~ '^\+[0-9]{11}$' AND substr(%I, 4, 1) = '9')
            OR %I ~ '^\+[0-9]{10}$'
          )
          AND substr(%I, 2, 2) IN (
            '11','12','13','14','15','16','17','18','19',
            '21','22','24','27','28',
            '31','32','33','34','35','37','38',
            '41','42','43','44','45','46','47','48','49',
            '51','53','54','55',
            '61','62','63','64','65','66','67','68','69',
            '71','73','74','75','77','79',
            '81','82','83','84','85','86','87','88','89',
            '91','92','93','94','95','96','97','98','99'
          )
        $q$,
        s, c, c, c, c, c, c
      );
      GET DIAGNOSTICS n = ROW_COUNT;
      RAISE NOTICE 'fix_telefones: %.% — % linha(s) corrigida(s)', s, c, n;
    END LOOP;
  END LOOP;
END $$;
