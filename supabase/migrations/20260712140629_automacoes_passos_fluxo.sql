-- ════════════════════════════════════════════════════════════════════════════
-- Migration: Automações — fluxo por PASSOS ordenados         | public, uat, dev
-- Contexto: o builder de automações (/automacoes) ganha um FLUXO DE VERDADE —
--   condições, condições-IA (ia_condicao) e ações intercaladas em qualquer
--   ordem. Modelo aditivo: coluna `passos JSONB` (array de {tipo, ...}).
--   BACKWARD-COMPAT por design: `passos` vazio/ausente = comportamento LEGADO
--   (condicoes → ações), idêntico ao histórico. A engine (CF automation-engine)
--   só usa o fluxo por passos quando `passos` é não-vazio. Coluna nasce com
--   default '[]' (nenhuma automação existente muda de comportamento).
-- Aditiva e idempotente (ADD COLUMN IF NOT EXISTS + DROP CONSTRAINT IF EXISTS
--   antes de ADD) — segura para rodar 2x. Sem enum novo, sem RLS nova (herda
--   as policies da tabela). CHECK garante array (defesa contra lixo no banco).
-- ════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── PUBLIC (PRD) ───────────────────────────
ALTER TABLE public.automacoes
  ADD COLUMN IF NOT EXISTS passos JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.automacoes DROP CONSTRAINT IF EXISTS automacoes_passos_array_check;
ALTER TABLE public.automacoes
  ADD CONSTRAINT automacoes_passos_array_check CHECK (jsonb_typeof(passos) = 'array');

COMMENT ON COLUMN public.automacoes.passos IS
  'Fluxo ordenado: array de {tipo: condicao|ia_condicao|acao, ...}. Não-vazio = a engine roda por passos (intercala condições/IA/ações). Vazio = fluxo legado (condicoes → acoes).';

-- ─────────────────────────── UAT ───────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.automacoes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.automacoes
      ADD COLUMN IF NOT EXISTS passos JSONB NOT NULL DEFAULT ''[]''::jsonb';
    EXECUTE 'ALTER TABLE uat.automacoes DROP CONSTRAINT IF EXISTS automacoes_passos_array_check';
    EXECUTE 'ALTER TABLE uat.automacoes
      ADD CONSTRAINT automacoes_passos_array_check CHECK (jsonb_typeof(passos) = ''array'')';
  END IF;
END $$;

-- ─────────────────────────── DEV ───────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.automacoes') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.automacoes
      ADD COLUMN IF NOT EXISTS passos JSONB NOT NULL DEFAULT ''[]''::jsonb';
    EXECUTE 'ALTER TABLE dev.automacoes DROP CONSTRAINT IF EXISTS automacoes_passos_array_check';
    EXECUTE 'ALTER TABLE dev.automacoes
      ADD CONSTRAINT automacoes_passos_array_check CHECK (jsonb_typeof(passos) = ''array'')';
  END IF;
END $$;
