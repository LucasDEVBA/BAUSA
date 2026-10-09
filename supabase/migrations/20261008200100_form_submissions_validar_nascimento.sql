-- ════════════════════════════════════════════════════════════════════════
-- Migration: validação SERVER-SIDE da data de nascimento no formulário público
-- Aplica em: public, uat, dev (gate por tabela form_submissions)
-- Contexto (T23, vídeos do CEO 28/09 — caso Samuel): o formulário aceitava
--   nascimento no futuro / no ano corrente (o seletor de data do celular abre
--   no ano atual → idade −1) e data do RESPONSÁVEL (1972) no lugar da do
--   atleta. O Gemini lia "idade −1/54" como incoerência grave → INVALIDO →
--   lead real invisível. O front (Zod, PR-06) já bloqueia; ESTA trava repete a
--   regra no banco para envio direto (curl / bundle antigo em cache).
-- Escopo cirúrgico: só INSERT feito pelo role `anon` (o formulário público
--   posta direto no PostgREST com a anon key). CFs (service_role) e Engine
--   (authenticated) NÃO passam pela trava — dado legado com data ruim nunca
--   pode travar um PATCH de CF (calendar-webhook, qualify-lead, sync...).
--   O upsert do formulário (ON CONFLICT DO UPDATE) também passa pelo BEFORE
--   INSERT, então UPDATE fica fora de propósito.
-- Folga proposital: o banco aceita ±1 ano além da faixa do front e usa o dia
--   de amanhã (BRT) como referência — o "hoje" do navegador nunca passa de
--   amanhã em BRT (UTC+14 está 17h à frente), então fuso/arredondamento não
--   fazem o servidor recusar um envio que o front aceitou.
-- Falha INTERNA da validação (permissão, função ausente) aceita o envio com
--   WARNING: a trava é defesa em profundidade (o classificador já trata idade
--   incoerente como alerta) e perder o cadastro de uma família é pior.
-- PARIDADE (guard tests/nascimento-banco-paridade.test.js): a tabela
--   série → faixa de idade e a faixa absoluta são IGUAIS às de
--   apps/web/src/lib/forms/nascimento.ts (e functions/qualify-lead/index.js,
--   guard tests/nascimento-serie-paridade.test.js); série desconhecida usa a
--   faixa absoluta e devolve `fora_faixa` (o front: foraDaFaixa, sem citar a
--   série). Mensagens = as MESMAS chaves PT do Zod (o front traduz via
--   form.errors).
-- Idempotente: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- Rollout: só depois do front do PR-06 em PRODUÇÃO (com o front antigo a
--   família só veria o erro no último passo). Timestamp > 20261008200000
--   (PR-08): o deploy roda `supabase db push` SEM --include-all; se outra
--   migration entrar antes, re-carimbar para o horário do dia (os guards
--   acham este arquivo pelo sufixo).
-- ════════════════════════════════════════════════════════════════════════

-- ─── Funções (public; usadas pelos triggers dos 3 schemas) ───

-- Faixa de idade [min, max] em anos completos por série do formulário.
-- NULL = série desconhecida (texto livre legado) → quem chama usa a absoluta.
CREATE OR REPLACE FUNCTION public.fs_faixa_idade_serie(p_school_year text)
RETURNS int[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_school_year
    WHEN 'before_7th'          THEN ARRAY[6, 14]
    WHEN '8th_grade'           THEN ARRAY[11, 17]
    WHEN '9th_grade'           THEN ARRAY[12, 18]
    WHEN 'hs_1st'              THEN ARRAY[13, 20]
    WHEN 'hs_2nd'              THEN ARRAY[14, 21]
    WHEN 'hs_3rd'              THEN ARRAY[15, 22]
    WHEN 'graduated_last_year' THEN ARRAY[16, 24]
    WHEN 'graduated_2plus'     THEN ARRAY[17, 30]
    ELSE                            NULL
  END
$$;

-- NULL = válido; senão o motivo: ausente | formato | futuro | incoerente_serie | fora_faixa
CREATE OR REPLACE FUNCTION public.fs_motivo_nascimento_invalido(
  p_birth_date  text,
  p_school_year text,
  p_ref         date,
  p_folga_anos  int DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_data        date;
  v_idade       int;
  v_folga       int := coalesce(p_folga_anos, 0);
  v_faixa_serie int[];
  v_faixa       int[];
BEGIN
  IF p_birth_date IS NULL OR btrim(p_birth_date) = '' THEN
    RETURN 'ausente';
  END IF;
  -- <input type="date"> aceita ano de 5-6 dígitos digitado ("20001-06-02").
  -- [0-9] e não \d: só ISO 8601 puro, que o cast lê igual em qualquer DateStyle.
  IF p_birth_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RETURN 'formato';
  END IF;
  BEGIN
    v_data := p_birth_date::date;          -- cast ISO estrito (2026-02-30 falha)
  EXCEPTION WHEN others THEN
    RETURN 'formato';
  END;
  IF v_data > p_ref THEN
    RETURN 'futuro';
  END IF;
  -- Anos completos com a MESMA conta do front (calcularIdade), só com
  -- extract(…, date). Nada de age(date, date): ele resolve para
  -- age(timestamptz, timestamptz) e o cast date→timestamptz depende do
  -- TimeZone da sessão — em America/Sao_Paulo a meia-noite do início do
  -- horário de verão não existe e o aniversário saía 1 ano a menos. Sem
  -- timestamptz a função é IMMUTABLE de fato.
  v_idade := extract(year FROM p_ref)::int - extract(year FROM v_data)::int
           - CASE WHEN (extract(month FROM p_ref), extract(day FROM p_ref))
                     < (extract(month FROM v_data), extract(day FROM v_data))
                  THEN 1 ELSE 0 END;
  v_faixa_serie := public.fs_faixa_idade_serie(p_school_year);
  v_faixa := coalesce(v_faixa_serie, ARRAY[5, 30]);  -- FAIXA_IDADE_ABSOLUTA do front
  IF v_idade < v_faixa[1] - v_folga OR v_idade > v_faixa[2] + v_folga THEN
    RETURN CASE WHEN v_faixa_serie IS NULL THEN 'fora_faixa' ELSE 'incoerente_serie' END;
  END IF;
  RETURN NULL;
END;
$$;

-- O trigger é SECURITY INVOKER e roda COMO anon: sem EXECUTE explícito, um
-- default privilege restritivo desligaria a trava (o fail-open do trigger
-- aceitaria todo envio, só com WARNING no log).
GRANT EXECUTE ON FUNCTION public.fs_faixa_idade_serie(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fs_motivo_nascimento_invalido(text, text, date, int) TO anon, authenticated, service_role;

-- Trigger BEFORE INSERT: só o formulário público (role anon).
-- ON CONFLICT também passa aqui (o BEFORE INSERT dispara antes da detecção do
-- conflito), então a regra vale para qualquer POST do PostgREST com anon.
CREATE OR REPLACE FUNCTION public.fs_validar_nascimento_anon()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_motivo text;
BEGIN
  IF current_user <> 'anon' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_motivo := public.fs_motivo_nascimento_invalido(
      NEW.birth_date,
      NEW.school_year,
      ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1),  -- folga de fuso
      1                                                       -- folga de faixa
    );
  EXCEPTION WHEN others THEN
    RAISE WARNING USING MESSAGE = format(
      'fs_validar_nascimento_anon: validação indisponível (%s: %s) — envio aceito sem checar a data',
      SQLSTATE, SQLERRM
    );
    RETURN NEW;
  END;

  IF v_motivo IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',  -- check_violation → PostgREST devolve 400
      MESSAGE = CASE v_motivo
        WHEN 'ausente'          THEN 'Data de nascimento é obrigatória'
        WHEN 'formato'          THEN 'Data de nascimento inválida'
        WHEN 'futuro'           THEN 'A data de nascimento não pode ser no futuro'
        WHEN 'incoerente_serie' THEN 'A data de nascimento não combina com a série escolhida — confira o ano de nascimento do atleta (não o do responsável)'
        WHEN 'fora_faixa'       THEN 'Confira o ano de nascimento do atleta (não o do responsável)'
        ELSE                         'Data de nascimento inválida'
      END,
      HINT = 'form_submissions.birth_date: ' || v_motivo;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── PUBLIC (PRD) ───
DROP TRIGGER IF EXISTS fs_validar_nascimento_anon_trg ON public.form_submissions;
CREATE TRIGGER fs_validar_nascimento_anon_trg
  BEFORE INSERT ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.fs_validar_nascimento_anon();

-- ─── UAT ─── (Preview do site grava em uat.form_submissions)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'uat' AND table_name = 'form_submissions') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS fs_validar_nascimento_anon_trg ON uat.form_submissions';
    EXECUTE 'CREATE TRIGGER fs_validar_nascimento_anon_trg
             BEFORE INSERT ON uat.form_submissions
             FOR EACH ROW EXECUTE FUNCTION public.fs_validar_nascimento_anon()';
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'dev' AND table_name = 'form_submissions') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS fs_validar_nascimento_anon_trg ON dev.form_submissions';
    EXECUTE 'CREATE TRIGGER fs_validar_nascimento_anon_trg
             BEFORE INSERT ON dev.form_submissions
             FOR EACH ROW EXECUTE FUNCTION public.fs_validar_nascimento_anon()';
  END IF;
END $$;
