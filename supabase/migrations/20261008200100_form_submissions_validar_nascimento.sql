-- ════════════════════════════════════════════════════════════════════════
-- Migration: validação SERVER-SIDE da data de nascimento no formulário público
-- Aplica em: public, uat, dev (gate por tabela form_submissions)
-- Contexto (T23, vídeos do CEO 28/09 — caso Samuel): o formulário aceitava
--   nascimento no futuro / no ano corrente (o seletor de data do celular abre
--   no ano atual → idade −1) e data do RESPONSÁVEL (1972) no lugar da do
--   atleta. O Gemini lia "idade −1/54" como incoerência grave → INVALIDO →
--   lead real invisível. O front (Zod) passa a bloquear; ESTA trava repete a
--   regra no banco para envio direto (curl / bundle antigo em cache).
-- Escopo cirúrgico: só INSERT feito pelo role `anon` (o formulário público
--   posta direto no PostgREST com a anon key). CFs (service_role) e Engine
--   (authenticated) NÃO passam pela trava — dado legado com data ruim nunca
--   pode travar um PATCH de CF (calendar-webhook, qualify-lead, sync...).
-- Folga proposital: o banco aceita ±1 ano além da faixa do front e usa o dia
--   de amanhã (BRT) como referência — fuso/arredondamento do navegador nunca
--   pode fazer o servidor recusar um envio que o front aceitou.
-- PARIDADE: a tabela série → faixa de idade é IGUAL a
--   apps/web/src/lib/forms/nascimento.ts e functions/qualify-lead/index.js
--   (guard tests/nascimento-serie-paridade.test.js).
-- Mensagens = as MESMAS chaves PT do Zod (o front traduz via form.errors).
-- Idempotente: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
-- Compatível com código antigo: só recusa o que o front novo também recusa;
--   o front antigo (bundle em cache) recebe 400 com mensagem clara.
-- ⚠️ ROLLOUT (PR 2): o timestamp DESTE arquivo tem de ser MAIOR que o da
--   última migration já aplicada no banco (o deploy roda `supabase db push`
--   SEM --include-all; versão menor que a última remota = push recusado).
--   Era 20261008180100 (< 180200 do PR 1) — renomeado. Se outra migration
--   entrar antes do PR 2, renomeie de novo para o timestamp do dia.
-- ════════════════════════════════════════════════════════════════════════

-- ─── Funções (public; usadas pelos triggers dos 3 schemas) ───

-- Faixa de idade [min, max] em anos completos por série do formulário.
-- Série desconhecida (texto livre legado) → faixa absoluta.
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
    ELSE                            ARRAY[5, 30]
  END
$$;

-- NULL = válido; senão o motivo: ausente | formato | futuro | incoerente_serie
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
  v_data  date;
  v_idade int;
  v_faixa int[];
BEGIN
  IF p_birth_date IS NULL OR btrim(p_birth_date) = '' THEN
    RETURN 'ausente';
  END IF;
  -- <input type="date"> aceita ano de 5-6 dígitos digitado ("20001-06-02")
  IF p_birth_date !~ '^\d{4}-\d{2}-\d{2}$' THEN
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
  v_idade := date_part('year', age(p_ref, v_data))::int;
  v_faixa := public.fs_faixa_idade_serie(p_school_year);
  IF v_idade < v_faixa[1] - p_folga_anos OR v_idade > v_faixa[2] + p_folga_anos THEN
    RETURN 'incoerente_serie';
  END IF;
  RETURN NULL;
END;
$$;

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

  v_motivo := public.fs_motivo_nascimento_invalido(
    NEW.birth_date,
    NEW.school_year,
    ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1),  -- folga de fuso
    1                                                       -- folga de faixa
  );

  IF v_motivo IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',  -- check_violation → PostgREST devolve 400
      MESSAGE = CASE v_motivo
        WHEN 'ausente' THEN 'Data de nascimento é obrigatória'
        WHEN 'formato' THEN 'Data de nascimento inválida'
        WHEN 'futuro'  THEN 'A data de nascimento não pode ser no futuro'
        ELSE 'A data de nascimento não combina com a série escolhida — confira o ano de nascimento do atleta (não o do responsável)'
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
