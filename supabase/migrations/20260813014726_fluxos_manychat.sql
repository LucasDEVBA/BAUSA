-- ════════════════════════════════════════════════════════════════════════
-- Migration: FLUXOS — motor de conversa multicanal (ManyChat próprio)
-- Aplica em: public, uat, dev
--
-- Contexto (pedido do CEO 2026-08-12): substituir o ManyChat externo por um
-- motor nosso, integrado ao funil. O ManyChat atual tem 3 automações (1
-- desligada), 213 disparos e **0 contatos/e-mails/telefones capturados** —
-- dispara e não alimenta o pipeline. Aqui a captura vira cidadã de primeira
-- classe (bloco `captura` grava em form_submissions/lead) e TUDO é medido.
--
-- Decisões de arquitetura:
--  • CANAL-AGNÓSTICO: o mesmo fluxo roda em `whatsapp` (Z-API, ATIVO hoje) e
--    em `instagram` (atrás de App Review). O canal é do FLUXO, não do motor.
--  • Blocos em tabela própria (`fluxo_blocos`) e não JSONB no fluxo: permite
--    métrica POR BLOCO (funil de abandono) sem varrer JSON.
--  • Execução com CAS: `fluxo_execucoes.bloco_atual_id` + `lock_until`
--    (mesmo padrão anti-duplicidade dos schedulers).
--  • Idempotência de entrada: UNIQUE(fluxo_id, contato_id, dedupe_key) evita
--    o mesmo comentário/DM disparar duas vezes.
--  • `fluxo_eventos` é append-only — é a fonte das métricas e do replay.
-- GRANTs uat/dev: cobertos pelos DEFAULT PRIVILEGES (20260810201415).
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. CONTATOS SOCIAIS (identidade unificada por canal) ────────────────
CREATE TABLE IF NOT EXISTS public.fluxo_contatos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal         TEXT NOT NULL CHECK (canal IN ('whatsapp', 'instagram')),
  -- id externo: telefone E.164 (whatsapp) ou IGSID (instagram)
  externo_id    TEXT NOT NULL CHECK (char_length(externo_id) BETWEEN 3 AND 120),
  username      TEXT,
  nome          TEXT,
  -- Dados capturados pelos blocos `pergunta`/`captura` (chave → valor)
  campos        JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  -- Ponte para o funil: preenchido quando a captura vira lead de verdade
  form_submission_id UUID,
  atleta_id     UUID,
  optin         BOOLEAN NOT NULL DEFAULT TRUE,
  optout_at     TIMESTAMPTZ,
  ultimo_contato_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT fluxo_contatos_canal_externo_uk UNIQUE (canal, externo_id)
);

CREATE INDEX IF NOT EXISTS idx_fluxo_contatos_recentes
  ON public.fluxo_contatos (ultimo_contato_at DESC NULLS LAST) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_fluxo_contatos_tags
  ON public.fluxo_contatos USING GIN (tags) WHERE deleted_at IS NULL;

-- ─── 2. FLUXOS (definição) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fluxos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL CHECK (char_length(nome) BETWEEN 3 AND 160),
  descricao     TEXT CHECK (descricao IS NULL OR char_length(descricao) <= 600),
  canal         TEXT NOT NULL CHECK (canal IN ('whatsapp', 'instagram')),
  -- Paridade ManyChat + o que o Z-API já permite hoje
  gatilho       TEXT NOT NULL CHECK (gatilho IN (
                  'comentario_post', 'comentario_reels', 'novo_seguidor',
                  'resposta_story', 'mencao_story', 'dm_palavra_chave',
                  'dm_primeira_msg', 'link_ref', 'mensagem_palavra_chave',
                  'manual', 'agendado')),
  -- palavras-chave, post alvo, ref, horário… (shape por gatilho no TS)
  gatilho_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  bloco_inicial_id UUID,
  -- Nasce SEMPRE pausado (mesma regra das automações)
  ativo         BOOLEAN NOT NULL DEFAULT FALSE,
  -- Anti-ban / anti-spam: teto de execuções por hora deste fluxo
  limite_hora   INTEGER NOT NULL DEFAULT 60 CHECK (limite_hora BETWEEN 1 AND 1000),
  -- Reentrada: um contato pode repetir o fluxo depois de X horas (0 = nunca)
  reentrada_horas INTEGER NOT NULL DEFAULT 0 CHECK (reentrada_horas BETWEEN 0 AND 8760),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fluxos_ativos
  ON public.fluxos (canal, gatilho) WHERE ativo = TRUE AND deleted_at IS NULL;

-- ─── 3. BLOCOS (nós do fluxo — perguntas encadeadas) ─────────────────────
CREATE TABLE IF NOT EXISTS public.fluxo_blocos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id      UUID NOT NULL REFERENCES public.fluxos(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN (
                  'mensagem', 'pergunta', 'botoes', 'condicao', 'ia_resposta',
                  'ia_condicao', 'delay', 'tag', 'captura', 'handoff',
                  'acao_crm', 'fim')),
  -- texto, mídia, opções, prompt, campo capturado… (shape por tipo no TS)
  conteudo      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Próximo bloco no caminho feliz (NULL = fim do ramo)
  proximo_id    UUID,
  -- Ramificações: [{ valor: 'sim', bloco_id: '…' }] p/ botoes/condicao/ia_condicao
  ramos         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Ordem de exibição no builder (não define execução — quem define é proximo_id)
  ordem         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fluxo_blocos_fluxo
  ON public.fluxo_blocos (fluxo_id, ordem);

-- ─── 4. EXECUÇÕES (uma por contato que entrou no fluxo) ──────────────────
CREATE TABLE IF NOT EXISTS public.fluxo_execucoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id      UUID NOT NULL REFERENCES public.fluxos(id) ON DELETE CASCADE,
  contato_id    UUID NOT NULL REFERENCES public.fluxo_contatos(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN (
                  'ativa', 'aguardando_resposta', 'concluida', 'abandonada',
                  'erro', 'handoff')),
  bloco_atual_id UUID,
  -- Variáveis capturadas nesta execução (nome → valor)
  variaveis     JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Idempotência da ENTRADA (id do comentário/mensagem que disparou)
  dedupe_key    TEXT,
  -- CAS: instância que pegou a execução segura até este instante
  lock_until    TIMESTAMPTZ,
  -- Quando a engine deve retomar (blocos `delay` e espera de resposta)
  retomar_em    TIMESTAMPTZ,
  erro          TEXT,
  iniciada_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluida_em  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fluxo_execucoes_dedupe_uk UNIQUE (fluxo_id, contato_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_fluxo_execucoes_pendentes
  ON public.fluxo_execucoes (retomar_em)
  WHERE status IN ('ativa', 'aguardando_resposta');
CREATE INDEX IF NOT EXISTS idx_fluxo_execucoes_fluxo
  ON public.fluxo_execucoes (fluxo_id, iniciada_em DESC);
CREATE INDEX IF NOT EXISTS idx_fluxo_execucoes_contato
  ON public.fluxo_execucoes (contato_id, iniciada_em DESC);

-- ─── 5. EVENTOS (append-only — fonte das métricas por bloco) ─────────────
CREATE TABLE IF NOT EXISTS public.fluxo_eventos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id   UUID NOT NULL REFERENCES public.fluxo_execucoes(id) ON DELETE CASCADE,
  fluxo_id      UUID NOT NULL,
  bloco_id      UUID,
  tipo          TEXT NOT NULL CHECK (tipo IN (
                  'entrou', 'bloco_executado', 'mensagem_enviada',
                  'resposta_recebida', 'botao_clicado', 'campo_capturado',
                  'lead_criado', 'tag_aplicada', 'handoff', 'abandonou',
                  'concluiu', 'erro')),
  detalhe       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fluxo_eventos_fluxo_tempo
  ON public.fluxo_eventos (fluxo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fluxo_eventos_bloco
  ON public.fluxo_eventos (bloco_id, tipo);

-- ─── Triggers compartilhados ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_fluxo_contatos_updated_at ON public.fluxo_contatos;
CREATE TRIGGER trg_fluxo_contatos_updated_at BEFORE UPDATE ON public.fluxo_contatos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_fluxos_updated_at ON public.fluxos;
CREATE TRIGGER trg_fluxos_updated_at BEFORE UPDATE ON public.fluxos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_fluxo_blocos_updated_at ON public.fluxo_blocos;
CREATE TRIGGER trg_fluxo_blocos_updated_at BEFORE UPDATE ON public.fluxo_blocos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_fluxo_execucoes_updated_at ON public.fluxo_execucoes;
CREATE TRIGGER trg_fluxo_execucoes_updated_at BEFORE UPDATE ON public.fluxo_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auditoria só na DEFINIÇÃO (fluxos/blocos). Execuções e eventos são
-- alto volume e já têm trilha própria em fluxo_eventos.
DROP TRIGGER IF EXISTS trg_audit_fluxos ON public.fluxos;
CREATE TRIGGER trg_audit_fluxos AFTER INSERT OR UPDATE OR DELETE ON public.fluxos
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- ─── RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.fluxo_contatos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluxos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluxo_blocos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluxo_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluxo_eventos   ENABLE ROW LEVEL SECURITY;

-- Leitura: CEO e Head (o Head opera a caixa de entrada). Escrita: CEO.
DROP POLICY IF EXISTS "fluxos_select" ON public.fluxos;
CREATE POLICY "fluxos_select" ON public.fluxos FOR SELECT TO authenticated
  USING (public.get_user_papel() IN ('ceo', 'head_sucesso') AND deleted_at IS NULL);
DROP POLICY IF EXISTS "fluxos_write" ON public.fluxos;
CREATE POLICY "fluxos_write" ON public.fluxos FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo') WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "fluxos_service" ON public.fluxos;
CREATE POLICY "fluxos_service" ON public.fluxos FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fluxo_blocos_select" ON public.fluxo_blocos;
CREATE POLICY "fluxo_blocos_select" ON public.fluxo_blocos FOR SELECT TO authenticated
  USING (public.get_user_papel() IN ('ceo', 'head_sucesso'));
DROP POLICY IF EXISTS "fluxo_blocos_write" ON public.fluxo_blocos;
CREATE POLICY "fluxo_blocos_write" ON public.fluxo_blocos FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo') WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "fluxo_blocos_service" ON public.fluxo_blocos;
CREATE POLICY "fluxo_blocos_service" ON public.fluxo_blocos FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fluxo_contatos_select" ON public.fluxo_contatos;
CREATE POLICY "fluxo_contatos_select" ON public.fluxo_contatos FOR SELECT TO authenticated
  USING (public.get_user_papel() IN ('ceo', 'head_sucesso') AND deleted_at IS NULL);
DROP POLICY IF EXISTS "fluxo_contatos_write" ON public.fluxo_contatos;
CREATE POLICY "fluxo_contatos_write" ON public.fluxo_contatos FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo') WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "fluxo_contatos_service" ON public.fluxo_contatos;
CREATE POLICY "fluxo_contatos_service" ON public.fluxo_contatos FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fluxo_execucoes_select" ON public.fluxo_execucoes;
CREATE POLICY "fluxo_execucoes_select" ON public.fluxo_execucoes FOR SELECT TO authenticated
  USING (public.get_user_papel() IN ('ceo', 'head_sucesso'));
DROP POLICY IF EXISTS "fluxo_execucoes_service" ON public.fluxo_execucoes;
CREATE POLICY "fluxo_execucoes_service" ON public.fluxo_execucoes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fluxo_eventos_select" ON public.fluxo_eventos;
CREATE POLICY "fluxo_eventos_select" ON public.fluxo_eventos FOR SELECT TO authenticated
  USING (public.get_user_papel() IN ('ceo', 'head_sucesso'));
DROP POLICY IF EXISTS "fluxo_eventos_service" ON public.fluxo_eventos;
CREATE POLICY "fluxo_eventos_service" ON public.fluxo_eventos FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.fluxos IS 'Fluxos de conversa multicanal (ManyChat próprio). Nasce pausado. canal=whatsapp roda hoje via Z-API; canal=instagram depende do App Review de instagram_manage_messages.';
COMMENT ON TABLE public.fluxo_eventos IS 'Trilha append-only de cada passo — fonte das métricas por bloco (funil de abandono) e do replay.';

-- ════════════════════════════════════════════════════════════════════════
-- UAT / DEV — gate por schema (mesmo shape)
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  s TEXT;
BEGIN
  FOREACH s IN ARRAY ARRAY['uat', 'dev'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = s) THEN
      EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.fluxo_contatos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          canal TEXT NOT NULL CHECK (canal IN (''whatsapp'', ''instagram'')),
          externo_id TEXT NOT NULL,
          username TEXT, nome TEXT,
          campos JSONB NOT NULL DEFAULT ''{}''::jsonb,
          tags TEXT[] NOT NULL DEFAULT ''{}'',
          form_submission_id UUID, atleta_id UUID,
          optin BOOLEAN NOT NULL DEFAULT TRUE, optout_at TIMESTAMPTZ,
          ultimo_contato_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ,
          CONSTRAINT fluxo_contatos_canal_externo_uk UNIQUE (canal, externo_id)
        )', s);
      EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.fluxos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          nome TEXT NOT NULL, descricao TEXT,
          canal TEXT NOT NULL CHECK (canal IN (''whatsapp'', ''instagram'')),
          gatilho TEXT NOT NULL,
          gatilho_config JSONB NOT NULL DEFAULT ''{}''::jsonb,
          bloco_inicial_id UUID,
          ativo BOOLEAN NOT NULL DEFAULT FALSE,
          limite_hora INTEGER NOT NULL DEFAULT 60,
          reentrada_horas INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          deleted_at TIMESTAMPTZ,
          created_by UUID REFERENCES auth.users(id)
        )', s);
      EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.fluxo_blocos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          fluxo_id UUID NOT NULL REFERENCES %I.fluxos(id) ON DELETE CASCADE,
          tipo TEXT NOT NULL,
          conteudo JSONB NOT NULL DEFAULT ''{}''::jsonb,
          proximo_id UUID,
          ramos JSONB NOT NULL DEFAULT ''[]''::jsonb,
          ordem INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', s, s);
      EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.fluxo_execucoes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          fluxo_id UUID NOT NULL REFERENCES %I.fluxos(id) ON DELETE CASCADE,
          contato_id UUID NOT NULL REFERENCES %I.fluxo_contatos(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT ''ativa'',
          bloco_atual_id UUID,
          variaveis JSONB NOT NULL DEFAULT ''{}''::jsonb,
          dedupe_key TEXT, lock_until TIMESTAMPTZ, retomar_em TIMESTAMPTZ, erro TEXT,
          iniciada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          concluida_em TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT fluxo_execucoes_dedupe_uk UNIQUE (fluxo_id, contato_id, dedupe_key)
        )', s, s, s);
      EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.fluxo_eventos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          execucao_id UUID NOT NULL REFERENCES %I.fluxo_execucoes(id) ON DELETE CASCADE,
          fluxo_id UUID NOT NULL, bloco_id UUID,
          tipo TEXT NOT NULL,
          detalhe JSONB NOT NULL DEFAULT ''{}''::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )', s, s);

      -- updated_at
      EXECUTE format('DROP TRIGGER IF EXISTS trg_fluxos_updated_at ON %I.fluxos', s);
      EXECUTE format('CREATE TRIGGER trg_fluxos_updated_at BEFORE UPDATE ON %I.fluxos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', s);
      EXECUTE format('DROP TRIGGER IF EXISTS trg_fluxo_execucoes_updated_at ON %I.fluxo_execucoes', s);
      EXECUTE format('CREATE TRIGGER trg_fluxo_execucoes_updated_at BEFORE UPDATE ON %I.fluxo_execucoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', s);

      -- RLS (mesmo desenho do public)
      EXECUTE format('ALTER TABLE %I.fluxos ENABLE ROW LEVEL SECURITY', s);
      EXECUTE format('DROP POLICY IF EXISTS "fluxos_select" ON %I.fluxos', s);
      EXECUTE format('CREATE POLICY "fluxos_select" ON %I.fluxos FOR SELECT TO authenticated USING (public.get_user_papel() IN (''ceo'', ''head_sucesso'') AND deleted_at IS NULL)', s);
      EXECUTE format('DROP POLICY IF EXISTS "fluxos_write" ON %I.fluxos', s);
      EXECUTE format('CREATE POLICY "fluxos_write" ON %I.fluxos FOR ALL TO authenticated USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')', s);
      EXECUTE format('DROP POLICY IF EXISTS "fluxos_service" ON %I.fluxos', s);
      EXECUTE format('CREATE POLICY "fluxos_service" ON %I.fluxos FOR ALL TO service_role USING (true) WITH CHECK (true)', s);

      EXECUTE format('ALTER TABLE %I.fluxo_blocos ENABLE ROW LEVEL SECURITY', s);
      EXECUTE format('DROP POLICY IF EXISTS "fluxo_blocos_service" ON %I.fluxo_blocos', s);
      EXECUTE format('CREATE POLICY "fluxo_blocos_service" ON %I.fluxo_blocos FOR ALL TO service_role USING (true) WITH CHECK (true)', s);
      EXECUTE format('DROP POLICY IF EXISTS "fluxo_blocos_rw" ON %I.fluxo_blocos', s);
      EXECUTE format('CREATE POLICY "fluxo_blocos_rw" ON %I.fluxo_blocos FOR ALL TO authenticated USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')', s);

      EXECUTE format('ALTER TABLE %I.fluxo_contatos ENABLE ROW LEVEL SECURITY', s);
      EXECUTE format('DROP POLICY IF EXISTS "fluxo_contatos_service" ON %I.fluxo_contatos', s);
      EXECUTE format('CREATE POLICY "fluxo_contatos_service" ON %I.fluxo_contatos FOR ALL TO service_role USING (true) WITH CHECK (true)', s);
      EXECUTE format('DROP POLICY IF EXISTS "fluxo_contatos_rw" ON %I.fluxo_contatos', s);
      EXECUTE format('CREATE POLICY "fluxo_contatos_rw" ON %I.fluxo_contatos FOR ALL TO authenticated USING (public.get_user_papel() = ''ceo'') WITH CHECK (public.get_user_papel() = ''ceo'')', s);

      EXECUTE format('ALTER TABLE %I.fluxo_execucoes ENABLE ROW LEVEL SECURITY', s);
      EXECUTE format('DROP POLICY IF EXISTS "fluxo_execucoes_service" ON %I.fluxo_execucoes', s);
      EXECUTE format('CREATE POLICY "fluxo_execucoes_service" ON %I.fluxo_execucoes FOR ALL TO service_role USING (true) WITH CHECK (true)', s);
      EXECUTE format('DROP POLICY IF EXISTS "fluxo_execucoes_select" ON %I.fluxo_execucoes', s);
      EXECUTE format('CREATE POLICY "fluxo_execucoes_select" ON %I.fluxo_execucoes FOR SELECT TO authenticated USING (public.get_user_papel() IN (''ceo'', ''head_sucesso''))', s);

      EXECUTE format('ALTER TABLE %I.fluxo_eventos ENABLE ROW LEVEL SECURITY', s);
      EXECUTE format('DROP POLICY IF EXISTS "fluxo_eventos_service" ON %I.fluxo_eventos', s);
      EXECUTE format('CREATE POLICY "fluxo_eventos_service" ON %I.fluxo_eventos FOR ALL TO service_role USING (true) WITH CHECK (true)', s);
      EXECUTE format('DROP POLICY IF EXISTS "fluxo_eventos_select" ON %I.fluxo_eventos', s);
      EXECUTE format('CREATE POLICY "fluxo_eventos_select" ON %I.fluxo_eventos FOR SELECT TO authenticated USING (public.get_user_papel() IN (''ceo'', ''head_sucesso''))', s);
    END IF;
  END LOOP;
END $$;
