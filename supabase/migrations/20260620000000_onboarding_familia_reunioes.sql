-- ============================================================
-- Sistema de Onboarding da Família + Reuniões estruturadas
--
-- Quando deal entra em admission_process e a crm_experiencia é
-- criada, automaticamente é instanciado um onboarding seguindo
-- um template pré-definido (CEO configura). Cada etapa pode
-- exigir uma reunião com assuntos rastreáveis. CEO recebe
-- notificações em cada milestone.
--
-- Tabelas: onboarding_templates, onboarding_template_etapas,
--          onboarding_instancias, onboarding_etapa_estado,
--          reunioes_familia
-- Trigger: trg_create_onboarding_on_experiencia
-- Função:  progresso_onboarding(experiencia_id) → JSONB
-- ============================================================

-- ─── Enums ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE onboarding_etapa_status AS ENUM (
    'pendente', 'em_andamento', 'concluida', 'pulada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE onboarding_instancia_status AS ENUM (
    'em_andamento', 'concluido', 'pausado', 'cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reuniao_familia_status AS ENUM (
    'agendada', 'realizada', 'cancelada', 'reagendada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 1. onboarding_templates ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  descricao   TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

COMMENT ON TABLE public.onboarding_templates IS
  'Template mestre de checklist de onboarding. CEO configura. Um marcado como is_default é usado no handoff.';

-- Garante apenas 1 default ativo
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_templates_default
  ON public.onboarding_templates(is_default)
  WHERE is_default = TRUE AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_onboarding_templates_updated_at ON public.onboarding_templates;
CREATE TRIGGER trg_onboarding_templates_updated_at
  BEFORE UPDATE ON public.onboarding_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. onboarding_template_etapas ────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_template_etapas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       UUID NOT NULL REFERENCES public.onboarding_templates(id) ON DELETE CASCADE,
  ordem             INT NOT NULL,
  titulo            TEXT NOT NULL,
  descricao         TEXT,
  prazo_dias        INT NOT NULL DEFAULT 7 CHECK (prazo_dias > 0),
  requer_reuniao    BOOLEAN NOT NULL DEFAULT FALSE,
  requer_assuntos   BOOLEAN NOT NULL DEFAULT FALSE,
  requer_documentos BOOLEAN NOT NULL DEFAULT FALSE,
  template_msg_id   UUID, -- vínculo opcional a mensagem_templates
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id, ordem)
);

COMMENT ON TABLE public.onboarding_template_etapas IS
  'Etapas que compõem um template de onboarding (em ordem).';

DROP TRIGGER IF EXISTS trg_onboarding_template_etapas_updated_at
  ON public.onboarding_template_etapas;
CREATE TRIGGER trg_onboarding_template_etapas_updated_at
  BEFORE UPDATE ON public.onboarding_template_etapas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. onboarding_instancias ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_instancias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiencia_id    UUID NOT NULL UNIQUE REFERENCES public.crm_experiencia(id),
  template_id       UUID NOT NULL REFERENCES public.onboarding_templates(id),
  responsavel_id    UUID REFERENCES public.user_profiles(id),
  status            onboarding_instancia_status NOT NULL DEFAULT 'em_andamento',
  iniciado_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluido_at      TIMESTAMPTZ,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

COMMENT ON TABLE public.onboarding_instancias IS
  'Instância de onboarding para uma família específica. 1:1 com crm_experiencia.';

CREATE INDEX IF NOT EXISTS idx_onboarding_inst_experiencia
  ON public.onboarding_instancias(experiencia_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_onboarding_inst_responsavel
  ON public.onboarding_instancias(responsavel_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_onboarding_inst_status
  ON public.onboarding_instancias(status) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_onboarding_instancias_updated_at
  ON public.onboarding_instancias;
CREATE TRIGGER trg_onboarding_instancias_updated_at
  BEFORE UPDATE ON public.onboarding_instancias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. onboarding_etapa_estado ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_etapa_estado (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id      UUID NOT NULL REFERENCES public.onboarding_instancias(id) ON DELETE CASCADE,
  template_etapa_id UUID NOT NULL REFERENCES public.onboarding_template_etapas(id),
  ordem             INT NOT NULL,
  titulo            TEXT NOT NULL,
  descricao         TEXT,
  prazo             TIMESTAMPTZ NOT NULL,
  status            onboarding_etapa_status NOT NULL DEFAULT 'pendente',
  iniciada_at       TIMESTAMPTZ,
  concluida_at      TIMESTAMPTZ,
  observacao        TEXT,
  -- meta da etapa (copiados do template no momento da instância)
  requer_reuniao    BOOLEAN NOT NULL DEFAULT FALSE,
  requer_assuntos   BOOLEAN NOT NULL DEFAULT FALSE,
  requer_documentos BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(instancia_id, template_etapa_id)
);

COMMENT ON TABLE public.onboarding_etapa_estado IS
  'Estado de cada etapa do onboarding em uma instância específica.';

CREATE INDEX IF NOT EXISTS idx_onboarding_etapa_instancia
  ON public.onboarding_etapa_estado(instancia_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_etapa_status_prazo
  ON public.onboarding_etapa_estado(status, prazo);

DROP TRIGGER IF EXISTS trg_onboarding_etapa_estado_updated_at
  ON public.onboarding_etapa_estado;
CREATE TRIGGER trg_onboarding_etapa_estado_updated_at
  BEFORE UPDATE ON public.onboarding_etapa_estado
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 5. reunioes_familia ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reunioes_familia (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiencia_id      UUID NOT NULL REFERENCES public.crm_experiencia(id),
  etapa_estado_id     UUID REFERENCES public.onboarding_etapa_estado(id),
  titulo              TEXT NOT NULL,
  assuntos            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  data_hora           TIMESTAMPTZ NOT NULL,
  duracao_minutos     INT NOT NULL DEFAULT 30 CHECK (duracao_minutos > 0),
  link_reuniao        TEXT,
  status              reuniao_familia_status NOT NULL DEFAULT 'agendada',
  participantes       TEXT[] DEFAULT ARRAY[]::TEXT[],
  notas_realizacao    TEXT,
  assuntos_discutidos TEXT[] DEFAULT ARRAY[]::TEXT[],
  realizada_at        TIMESTAMPTZ,
  cancelada_motivo    TEXT,
  cancelada_at        TIMESTAMPTZ,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

COMMENT ON TABLE public.reunioes_familia IS
  'Reuniões estruturadas com a família. Vinculadas opcionalmente a uma etapa de onboarding.';

CREATE INDEX IF NOT EXISTS idx_reunioes_experiencia
  ON public.reunioes_familia(experiencia_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reunioes_etapa
  ON public.reunioes_familia(etapa_estado_id) WHERE etapa_estado_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reunioes_data_hora
  ON public.reunioes_familia(data_hora) WHERE status = 'agendada' AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_reunioes_familia_updated_at
  ON public.reunioes_familia;
CREATE TRIGGER trg_reunioes_familia_updated_at
  BEFORE UPDATE ON public.reunioes_familia
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_template_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_instancias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_etapa_estado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reunioes_familia ENABLE ROW LEVEL SECURITY;

-- Helper: CEO ou head_sucesso podem fazer tudo (read/write)
-- get_user_papel() já mapeia cto→ceo

CREATE POLICY "tmpl_select" ON public.onboarding_templates
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "tmpl_insert" ON public.onboarding_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel() IN ('ceo','head_sucesso'));

CREATE POLICY "tmpl_update" ON public.onboarding_templates
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() IN ('ceo','head_sucesso'))
  WITH CHECK (public.get_user_papel() IN ('ceo','head_sucesso'));

CREATE POLICY "tmpl_delete" ON public.onboarding_templates
  FOR DELETE TO authenticated
  USING (public.get_user_papel() = 'ceo');

CREATE POLICY "tmpl_etapas_all" ON public.onboarding_template_etapas
  FOR ALL TO authenticated
  USING (public.get_user_papel() IN ('ceo','head_sucesso'))
  WITH CHECK (public.get_user_papel() IN ('ceo','head_sucesso'));

CREATE POLICY "inst_select" ON public.onboarding_instancias
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.get_user_papel() IN ('ceo','head_sucesso'));

CREATE POLICY "inst_insert" ON public.onboarding_instancias
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel() IN ('ceo','head_sucesso'));

CREATE POLICY "inst_update" ON public.onboarding_instancias
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() IN ('ceo','head_sucesso'))
  WITH CHECK (public.get_user_papel() IN ('ceo','head_sucesso'));

CREATE POLICY "etapa_estado_select" ON public.onboarding_etapa_estado
  FOR SELECT TO authenticated
  USING (public.get_user_papel() IN ('ceo','head_sucesso'));

CREATE POLICY "etapa_estado_insert" ON public.onboarding_etapa_estado
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel() IN ('ceo','head_sucesso'));

CREATE POLICY "etapa_estado_update" ON public.onboarding_etapa_estado
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() IN ('ceo','head_sucesso'))
  WITH CHECK (public.get_user_papel() IN ('ceo','head_sucesso'));

CREATE POLICY "reunioes_select" ON public.reunioes_familia
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.get_user_papel() IN ('ceo','head_sucesso'));

CREATE POLICY "reunioes_insert" ON public.reunioes_familia
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel() IN ('ceo','head_sucesso'));

CREATE POLICY "reunioes_update" ON public.reunioes_familia
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() IN ('ceo','head_sucesso'))
  WITH CHECK (public.get_user_papel() IN ('ceo','head_sucesso'));

-- ─── Trigger: cria instância + etapas no handoff ─────────────
CREATE OR REPLACE FUNCTION public.trg_create_onboarding_for_experiencia()
RETURNS TRIGGER AS $$
DECLARE
  v_template RECORD;
  v_etapa RECORD;
  v_instancia_id UUID;
  v_head_id UUID;
  v_atleta_nome TEXT;
BEGIN
  -- Buscar template default ativo
  SELECT id INTO v_template
  FROM public.onboarding_templates
  WHERE is_default = TRUE AND ativo = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_template.id IS NULL THEN
    RAISE WARNING 'Nenhum template de onboarding default ativo. Skip.';
    RETURN NEW;
  END IF;

  -- Buscar Head ativo
  SELECT id INTO v_head_id
  FROM public.user_profiles
  WHERE papel = 'head_sucesso' AND ativo = TRUE
  LIMIT 1;

  -- Defensive: tudo em sub-bloco com EXCEPTION
  BEGIN
    -- Cria instância
    INSERT INTO public.onboarding_instancias (
      experiencia_id, template_id, responsavel_id, status
    ) VALUES (
      NEW.id, v_template.id, v_head_id, 'em_andamento'
    )
    RETURNING id INTO v_instancia_id;

    -- Cria estado de cada etapa do template
    FOR v_etapa IN
      SELECT * FROM public.onboarding_template_etapas
      WHERE template_id = v_template.id
      ORDER BY ordem
    LOOP
      INSERT INTO public.onboarding_etapa_estado (
        instancia_id, template_etapa_id, ordem, titulo, descricao,
        prazo, requer_reuniao, requer_assuntos, requer_documentos
      ) VALUES (
        v_instancia_id, v_etapa.id, v_etapa.ordem, v_etapa.titulo,
        v_etapa.descricao,
        NOW() + (v_etapa.prazo_dias || ' days')::INTERVAL,
        v_etapa.requer_reuniao, v_etapa.requer_assuntos,
        v_etapa.requer_documentos
      );
    END LOOP;

    -- Notificar CEO
    IF v_head_id IS NOT NULL THEN
      SELECT nome_completo INTO v_atleta_nome
      FROM public.atletas WHERE id = NEW.atleta_id;

      INSERT INTO public.notificacoes (
        destinatario_id, titulo, mensagem, tipo, severidade, link
      )
      SELECT up.id,
             CONCAT('Onboarding iniciado: ', COALESCE(v_atleta_nome, 'familia')),
             CONCAT('Onboarding atribuido a head. Acompanhe em /war-room/familias-onboarding'),
             'onboarding_iniciado', 'media', '/war-room/familias-onboarding'
      FROM public.user_profiles up
      WHERE up.papel IN ('ceo', 'cto') AND up.ativo = TRUE;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'trg_create_onboarding_for_experiencia: % (experiencia=%)', SQLERRM, NEW.id;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_experiencia_create_onboarding ON public.crm_experiencia;
CREATE TRIGGER trg_experiencia_create_onboarding
  AFTER INSERT ON public.crm_experiencia
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_create_onboarding_for_experiencia();

-- ─── Função: progresso_onboarding ─────────────────────────────
CREATE OR REPLACE FUNCTION public.progresso_onboarding(p_experiencia_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total INT;
  v_concluidas INT;
  v_proxima JSONB;
  v_instancia_id UUID;
  v_atrasadas INT;
BEGIN
  SELECT id INTO v_instancia_id
  FROM public.onboarding_instancias
  WHERE experiencia_id = p_experiencia_id AND deleted_at IS NULL
  LIMIT 1;

  IF v_instancia_id IS NULL THEN
    RETURN jsonb_build_object('existe', FALSE);
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'concluida')
    INTO v_total, v_concluidas
  FROM public.onboarding_etapa_estado
  WHERE instancia_id = v_instancia_id;

  SELECT COUNT(*) INTO v_atrasadas
  FROM public.onboarding_etapa_estado
  WHERE instancia_id = v_instancia_id
    AND status IN ('pendente', 'em_andamento')
    AND prazo < NOW();

  SELECT jsonb_build_object(
    'id', id, 'titulo', titulo, 'prazo', prazo,
    'status', status, 'ordem', ordem
  ) INTO v_proxima
  FROM public.onboarding_etapa_estado
  WHERE instancia_id = v_instancia_id
    AND status IN ('pendente', 'em_andamento')
  ORDER BY ordem ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'existe', TRUE,
    'instancia_id', v_instancia_id,
    'total', v_total,
    'concluidas', v_concluidas,
    'percent', CASE WHEN v_total = 0 THEN 0
                    ELSE ROUND((v_concluidas::NUMERIC / v_total) * 100) END,
    'atrasadas', v_atrasadas,
    'proxima', v_proxima
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ─── Função: completar instância quando todas etapas concluídas
CREATE OR REPLACE FUNCTION public.trg_check_onboarding_completo()
RETURNS TRIGGER AS $$
DECLARE
  v_pendentes INT;
BEGIN
  IF NEW.status = 'concluida' AND (OLD.status IS NULL OR OLD.status != 'concluida') THEN
    SELECT COUNT(*) INTO v_pendentes
    FROM public.onboarding_etapa_estado
    WHERE instancia_id = NEW.instancia_id
      AND status NOT IN ('concluida', 'pulada');

    IF v_pendentes = 0 THEN
      UPDATE public.onboarding_instancias
      SET status = 'concluido', concluido_at = NOW()
      WHERE id = NEW.instancia_id;

      -- Notificar CEO
      INSERT INTO public.notificacoes (
        destinatario_id, titulo, mensagem, tipo, severidade, link
      )
      SELECT up.id,
             'Onboarding concluido',
             'Familia completou todas as etapas de onboarding.',
             'onboarding_concluido', 'media', '/war-room/familias-onboarding'
      FROM public.user_profiles up
      WHERE up.papel IN ('ceo', 'cto') AND up.ativo = TRUE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_onboarding_completo ON public.onboarding_etapa_estado;
CREATE TRIGGER trg_check_onboarding_completo
  AFTER UPDATE OF status ON public.onboarding_etapa_estado
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_onboarding_completo();

-- ─── Seed: template default ───────────────────────────────────
DO $$
DECLARE
  v_template_id UUID;
BEGIN
  -- Só insere se não existir nenhum template default
  IF NOT EXISTS (
    SELECT 1 FROM public.onboarding_templates
    WHERE is_default = TRUE AND deleted_at IS NULL
  ) THEN
    INSERT INTO public.onboarding_templates (nome, descricao, is_default)
    VALUES (
      'Onboarding BAUSA padrão',
      'Checklist padrão de onboarding pós-admissão. 6 etapas em ~30 dias.',
      TRUE
    )
    RETURNING id INTO v_template_id;

    INSERT INTO public.onboarding_template_etapas
      (template_id, ordem, titulo, descricao, prazo_dias, requer_reuniao, requer_assuntos, requer_documentos)
    VALUES
      (v_template_id, 1,
       'Boas-vindas e apresentação',
       'Enviar mensagem de boas-vindas no WhatsApp explicando o papel da Head e os próximos passos.',
       1, FALSE, FALSE, FALSE),
      (v_template_id, 2,
       'Agendar call de onboarding',
       'Agendar reunião de 30min com a família para alinhamento. Definir data, link (Google Meet) e enviar convite.',
       2, TRUE, FALSE, FALSE),
      (v_template_id, 3,
       'Realizar call de onboarding',
       'Conduzir a reunião cobrindo: expectativas, calendário, documentos necessários, canal de contato preferido. Registrar assuntos discutidos.',
       7, TRUE, TRUE, FALSE),
      (v_template_id, 4,
       'Confirmar dados de contato',
       'Validar telefones, emails e endereço da família. Atualizar no CRM se necessário.',
       3, FALSE, FALSE, FALSE),
      (v_template_id, 5,
       'Coletar documentos iniciais',
       'Solicitar passaporte, histórico escolar, comprovantes. Subir na aba Documentos.',
       14, FALSE, FALSE, TRUE),
      (v_template_id, 6,
       'Definir cadência de contato',
       'Combinar frequência de check-ins (semanal/quinzenal) e próximo contato. Registrar na família.',
       7, FALSE, FALSE, FALSE);
  END IF;
END $$;

-- ─── Audit triggers ───────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_audit_onboarding_instancias ON public.onboarding_instancias;
CREATE TRIGGER trg_audit_onboarding_instancias
  AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_instancias
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS trg_audit_onboarding_etapa ON public.onboarding_etapa_estado;
CREATE TRIGGER trg_audit_onboarding_etapa
  AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_etapa_estado
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

DROP TRIGGER IF EXISTS trg_audit_reunioes ON public.reunioes_familia;
CREATE TRIGGER trg_audit_reunioes
  AFTER INSERT OR UPDATE OR DELETE ON public.reunioes_familia
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- ─── Backfill: criar onboarding para experiencias já existentes
DO $$
DECLARE
  r RECORD;
  v_template_id UUID;
  v_head_id UUID;
  v_instancia_id UUID;
  v_etapa RECORD;
BEGIN
  SELECT id INTO v_template_id
  FROM public.onboarding_templates
  WHERE is_default = TRUE AND ativo = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_template_id IS NULL THEN RETURN; END IF;

  SELECT id INTO v_head_id
  FROM public.user_profiles
  WHERE papel = 'head_sucesso' AND ativo = TRUE
  LIMIT 1;

  FOR r IN
    SELECT e.id, e.atleta_id
    FROM public.crm_experiencia e
    WHERE e.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.onboarding_instancias oi
        WHERE oi.experiencia_id = e.id
      )
  LOOP
    BEGIN
      INSERT INTO public.onboarding_instancias
        (experiencia_id, template_id, responsavel_id, status)
      VALUES (r.id, v_template_id, v_head_id, 'em_andamento')
      RETURNING id INTO v_instancia_id;

      FOR v_etapa IN
        SELECT * FROM public.onboarding_template_etapas
        WHERE template_id = v_template_id ORDER BY ordem
      LOOP
        INSERT INTO public.onboarding_etapa_estado (
          instancia_id, template_etapa_id, ordem, titulo, descricao,
          prazo, requer_reuniao, requer_assuntos, requer_documentos
        ) VALUES (
          v_instancia_id, v_etapa.id, v_etapa.ordem, v_etapa.titulo,
          v_etapa.descricao,
          NOW() + (v_etapa.prazo_dias || ' days')::INTERVAL,
          v_etapa.requer_reuniao, v_etapa.requer_assuntos,
          v_etapa.requer_documentos
        );
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Backfill onboarding falhou para experiencia %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;
