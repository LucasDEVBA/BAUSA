-- ════════════════════════════════════════════════════════════════════════
-- Migration: Memória do lead (lead_memoria) + captura/classificação de docs
--            (colunas em documentos_atleta) + seed dos prompts de IA
-- Aplica em: public (PRD), uat, dev — idempotente, forward-only
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto (F2 — Agent de Memória & Documentos, SOB DEMANDA):
--   Um agent de IA, acionado numa conversa (1:1 ou grupo), (a) extrai
--   fatos/insights e persiste na MEMÓRIA do lead, e (b) acha documentos/mídias
--   que o lead mandou, identifica QUAL é o documento e anexa ao perfil do
--   atleta. Nunca envia mensagem. Server action: apps/crm/src/lib/actions/
--   lead-memoria.ts.
--
-- (a) Tabela lead_memoria — append-only + soft-delete (gabarito de
--     reunioes_transcricoes: RLS por papel + DO blocks multi-schema gateados
--     por to_regclass). SEM trigger de auditoria (dado derivado de alto volume;
--     PK id UUID de qualquer forma). Idempotência: UNIQUE(dedupe_key) parcial —
--     reprocessar a mesma conversa não duplica fatos.
--
-- (b) documentos_atleta ganha colunas aditivas de proveniência da captura por
--     IA. UNIQUE(atleta_id, fonte_ref) parcial garante que o mesmo arquivo
--     (message_id da origem) não seja recapturado.
--
-- (c) Seed VAZIO das 2 chaves de prompt em configuracoes_sistema (fail-open:
--     campo instrucoes ausente/vazio = default do código).
-- ════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════
-- PARTE (a) — lead_memoria
-- ═══════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.lead_memoria (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  atleta_id           UUID REFERENCES public.atletas(id),
  experiencia_id      UUID REFERENCES public.crm_experiencia(id),
  form_submission_id  UUID,                        -- informativo (sem FK)
  origem              TEXT NOT NULL
                      CHECK (origem IN ('whatsapp_1a1','whatsapp_grupo','manual','reuniao')),
  tipo                TEXT NOT NULL
                      CHECK (tipo IN ('fato','preferencia','insight','resumo','alerta')),
  conteudo            TEXT NOT NULL,
  confianca           TEXT CHECK (confianca IN ('alta','media','baixa')),
  dedupe_key          TEXT,                        -- idempotência (hash âncora+tipo+conteúdo)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,                 -- soft delete (dispensar)
  created_by          UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.lead_memoria IS
  'Memória append-only do lead/família: fatos/preferências/insights extraídos por IA das conversas (1:1/grupo) sob demanda. Nunca envia nada. dedupe_key torna a reprocessagem idempotente. Soft-delete (deleted_at) = dispensada pelo CEO.';
COMMENT ON COLUMN public.lead_memoria.form_submission_id IS
  'Lead de origem (form_submissions.id) — sem FK porque form_submissions vive por schema e o vínculo é informativo.';
COMMENT ON COLUMN public.lead_memoria.dedupe_key IS
  'Hash de (âncora + tipo + conteúdo normalizado). UNIQUE parcial garante idempotência ao reprocessar a mesma conversa.';

-- Idempotência: reprocessar não duplica (NULLs são distintos → índice parcial).
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_memoria_dedupe
  ON public.lead_memoria (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Leitura por âncora (timeline mais recente primeiro), ignorando soft-deleted.
CREATE INDEX IF NOT EXISTS idx_lead_memoria_atleta
  ON public.lead_memoria (atleta_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lead_memoria_experiencia
  ON public.lead_memoria (experiencia_id, created_at DESC) WHERE deleted_at IS NULL;

-- RLS: memória da família é visível ao CEO e ao Head de Sucesso (get_user_papel
-- resolve cto→ceo). Escrita/soft-delete só CEO; service_role FOR ALL.
ALTER TABLE public.lead_memoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_memoria_select" ON public.lead_memoria;
CREATE POLICY "lead_memoria_select" ON public.lead_memoria
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.get_user_papel() IN ('ceo','head_sucesso'));

DROP POLICY IF EXISTS "lead_memoria_insert_ceo" ON public.lead_memoria;
CREATE POLICY "lead_memoria_insert_ceo" ON public.lead_memoria
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "lead_memoria_update_ceo" ON public.lead_memoria;
CREATE POLICY "lead_memoria_update_ceo" ON public.lead_memoria
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');

DROP POLICY IF EXISTS "lead_memoria_service" ON public.lead_memoria;
CREATE POLICY "lead_memoria_service" ON public.lead_memoria
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ─── UAT ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.atletas') IS NOT NULL
     AND to_regclass('uat.crm_experiencia') IS NOT NULL THEN

    EXECUTE '
      CREATE TABLE IF NOT EXISTS uat.lead_memoria (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        atleta_id           UUID REFERENCES uat.atletas(id),
        experiencia_id      UUID REFERENCES uat.crm_experiencia(id),
        form_submission_id  UUID,
        origem              TEXT NOT NULL
                            CHECK (origem IN (''whatsapp_1a1'',''whatsapp_grupo'',''manual'',''reuniao'')),
        tipo                TEXT NOT NULL
                            CHECK (tipo IN (''fato'',''preferencia'',''insight'',''resumo'',''alerta'')),
        conteudo            TEXT NOT NULL,
        confianca           TEXT CHECK (confianca IN (''alta'',''media'',''baixa'')),
        dedupe_key          TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at          TIMESTAMPTZ,
        created_by          UUID REFERENCES auth.users(id)
      )';

    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_memoria_dedupe
      ON uat.lead_memoria (dedupe_key) WHERE dedupe_key IS NOT NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lead_memoria_atleta
      ON uat.lead_memoria (atleta_id, created_at DESC) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lead_memoria_experiencia
      ON uat.lead_memoria (experiencia_id, created_at DESC) WHERE deleted_at IS NULL';

    EXECUTE 'ALTER TABLE uat.lead_memoria ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "lead_memoria_select" ON uat.lead_memoria';
    EXECUTE 'CREATE POLICY "lead_memoria_select" ON uat.lead_memoria
      FOR SELECT TO authenticated
      USING (deleted_at IS NULL AND public.get_user_papel() IN (''ceo'',''head_sucesso''))';
    EXECUTE 'DROP POLICY IF EXISTS "lead_memoria_insert_ceo" ON uat.lead_memoria';
    EXECUTE 'CREATE POLICY "lead_memoria_insert_ceo" ON uat.lead_memoria
      FOR INSERT TO authenticated
      WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "lead_memoria_update_ceo" ON uat.lead_memoria';
    EXECUTE 'CREATE POLICY "lead_memoria_update_ceo" ON uat.lead_memoria
      FOR UPDATE TO authenticated
      USING (public.get_user_papel() = ''ceo'')
      WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "lead_memoria_service" ON uat.lead_memoria';
    EXECUTE 'CREATE POLICY "lead_memoria_service" ON uat.lead_memoria
      FOR ALL TO service_role USING (true) WITH CHECK (true)';

    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON uat.lead_memoria TO authenticated, service_role';
  END IF;
END $$;


-- ─── DEV ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.atletas') IS NOT NULL
     AND to_regclass('dev.crm_experiencia') IS NOT NULL THEN

    EXECUTE '
      CREATE TABLE IF NOT EXISTS dev.lead_memoria (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        atleta_id           UUID REFERENCES dev.atletas(id),
        experiencia_id      UUID REFERENCES dev.crm_experiencia(id),
        form_submission_id  UUID,
        origem              TEXT NOT NULL
                            CHECK (origem IN (''whatsapp_1a1'',''whatsapp_grupo'',''manual'',''reuniao'')),
        tipo                TEXT NOT NULL
                            CHECK (tipo IN (''fato'',''preferencia'',''insight'',''resumo'',''alerta'')),
        conteudo            TEXT NOT NULL,
        confianca           TEXT CHECK (confianca IN (''alta'',''media'',''baixa'')),
        dedupe_key          TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at          TIMESTAMPTZ,
        created_by          UUID REFERENCES auth.users(id)
      )';

    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_memoria_dedupe
      ON dev.lead_memoria (dedupe_key) WHERE dedupe_key IS NOT NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lead_memoria_atleta
      ON dev.lead_memoria (atleta_id, created_at DESC) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lead_memoria_experiencia
      ON dev.lead_memoria (experiencia_id, created_at DESC) WHERE deleted_at IS NULL';

    EXECUTE 'ALTER TABLE dev.lead_memoria ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "lead_memoria_select" ON dev.lead_memoria';
    EXECUTE 'CREATE POLICY "lead_memoria_select" ON dev.lead_memoria
      FOR SELECT TO authenticated
      USING (deleted_at IS NULL AND public.get_user_papel() IN (''ceo'',''head_sucesso''))';
    EXECUTE 'DROP POLICY IF EXISTS "lead_memoria_insert_ceo" ON dev.lead_memoria';
    EXECUTE 'CREATE POLICY "lead_memoria_insert_ceo" ON dev.lead_memoria
      FOR INSERT TO authenticated
      WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "lead_memoria_update_ceo" ON dev.lead_memoria';
    EXECUTE 'CREATE POLICY "lead_memoria_update_ceo" ON dev.lead_memoria
      FOR UPDATE TO authenticated
      USING (public.get_user_papel() = ''ceo'')
      WITH CHECK (public.get_user_papel() = ''ceo'')';
    EXECUTE 'DROP POLICY IF EXISTS "lead_memoria_service" ON dev.lead_memoria';
    EXECUTE 'CREATE POLICY "lead_memoria_service" ON dev.lead_memoria
      FOR ALL TO service_role USING (true) WITH CHECK (true)';

    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON dev.lead_memoria TO authenticated, service_role';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- PARTE (b) — documentos_atleta ganha proveniência da captura por IA
-- ═══════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
ALTER TABLE public.documentos_atleta ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.documentos_atleta ADD COLUMN IF NOT EXISTS fonte_ref TEXT;
ALTER TABLE public.documentos_atleta ADD COLUMN IF NOT EXISTS identificado_por_ia BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.documentos_atleta ADD COLUMN IF NOT EXISTS confianca TEXT;
ALTER TABLE public.documentos_atleta ADD COLUMN IF NOT EXISTS identificacao_resumo TEXT;

COMMENT ON COLUMN public.documentos_atleta.fonte_ref IS
  'message_id da mensagem de origem (WhatsApp) — idempotência da captura por IA via UNIQUE(atleta_id, fonte_ref).';

-- Não recaptura o mesmo arquivo (idempotência da captura por IA).
CREATE UNIQUE INDEX IF NOT EXISTS uq_documentos_atleta_fonte
  ON public.documentos_atleta (atleta_id, fonte_ref)
  WHERE fonte_ref IS NOT NULL AND deleted_at IS NULL;

-- ─── UAT ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat')
     AND to_regclass('uat.documentos_atleta') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.documentos_atleta ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT ''manual''';
    EXECUTE 'ALTER TABLE uat.documentos_atleta ADD COLUMN IF NOT EXISTS fonte_ref TEXT';
    EXECUTE 'ALTER TABLE uat.documentos_atleta ADD COLUMN IF NOT EXISTS identificado_por_ia BOOLEAN NOT NULL DEFAULT FALSE';
    EXECUTE 'ALTER TABLE uat.documentos_atleta ADD COLUMN IF NOT EXISTS confianca TEXT';
    EXECUTE 'ALTER TABLE uat.documentos_atleta ADD COLUMN IF NOT EXISTS identificacao_resumo TEXT';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_documentos_atleta_fonte
      ON uat.documentos_atleta (atleta_id, fonte_ref)
      WHERE fonte_ref IS NOT NULL AND deleted_at IS NULL';
  END IF;
END $$;

-- ─── DEV ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev')
     AND to_regclass('dev.documentos_atleta') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.documentos_atleta ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT ''manual''';
    EXECUTE 'ALTER TABLE dev.documentos_atleta ADD COLUMN IF NOT EXISTS fonte_ref TEXT';
    EXECUTE 'ALTER TABLE dev.documentos_atleta ADD COLUMN IF NOT EXISTS identificado_por_ia BOOLEAN NOT NULL DEFAULT FALSE';
    EXECUTE 'ALTER TABLE dev.documentos_atleta ADD COLUMN IF NOT EXISTS confianca TEXT';
    EXECUTE 'ALTER TABLE dev.documentos_atleta ADD COLUMN IF NOT EXISTS identificacao_resumo TEXT';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_documentos_atleta_fonte
      ON dev.documentos_atleta (atleta_id, fonte_ref)
      WHERE fonte_ref IS NOT NULL AND deleted_at IS NULL';
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════
-- PARTE (c) — seed VAZIO dos prompts de IA (fail-open p/ default do código)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
  ('memoria_extracao_prompt', '{}'::jsonb,
   'Instruções do Agent de Memória (extração de fatos/insights das conversas). Campo instrucoes ausente/vazio = default do código.'),
  ('doc_classificacao_prompt', '{}'::jsonb,
   'Instruções do Agent de Documentos (identificação do tipo de documento enviado pelo lead). Campo instrucoes ausente/vazio = default do código.')
ON CONFLICT (chave) DO NOTHING;

-- ─── UAT ───
DO $$ BEGIN
  IF to_regclass('uat.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO uat.configuracoes_sistema (chave, valor, descricao) VALUES
        ('memoria_extracao_prompt', '{}'::jsonb,
         'Instruções do Agent de Memória (extração de fatos/insights das conversas). Campo instrucoes ausente/vazio = default do código.'),
        ('doc_classificacao_prompt', '{}'::jsonb,
         'Instruções do Agent de Documentos (identificação do tipo de documento enviado pelo lead). Campo instrucoes ausente/vazio = default do código.')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;

-- ─── DEV ───
DO $$ BEGIN
  IF to_regclass('dev.configuracoes_sistema') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO dev.configuracoes_sistema (chave, valor, descricao) VALUES
        ('memoria_extracao_prompt', '{}'::jsonb,
         'Instruções do Agent de Memória (extração de fatos/insights das conversas). Campo instrucoes ausente/vazio = default do código.'),
        ('doc_classificacao_prompt', '{}'::jsonb,
         'Instruções do Agent de Documentos (identificação do tipo de documento enviado pelo lead). Campo instrucoes ausente/vazio = default do código.')
      ON CONFLICT (chave) DO NOTHING
    $sql$;
  END IF;
END $$;
