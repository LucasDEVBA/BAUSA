-- ════════════════════════════════════════════════════════════════════════
-- Migration: Onboarding profissional — checklist por etapa + admin do CEO
-- Aplica em: public (uat/dev gateados por to_regclass — onboarding_* só
-- existe em public; o Engine lê public em todos os ambientes)
--
-- Contexto: o CEO passa a configurar os templates de onboarding pela UI
-- (/war-room/familias-onboarding → aba Modelos) e a Head executa etapas
-- com checklist de sub-itens. Este arquivo:
--   1. checklist JSONB (lista de sub-itens) em onboarding_template_etapas
--   2. checklist_estado JSONB (snapshot executável) em onboarding_etapa_estado
--   3. trigger de instanciação copia o checklist do template
--   4. RPC definir_template_default (troca atômica — índice único parcial)
--   5. RPC reordenar_etapas_template (atômica — UNIQUE(template_id, ordem))
--   6. Seed: checklists detalhados nas 6 etapas do template padrão
--   7. Backfill: etapas pendentes/em andamento de famílias existentes
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1/2. Colunas de checklist ────────────────────────────────────────────
ALTER TABLE public.onboarding_template_etapas
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.onboarding_template_etapas.checklist IS
  'Sub-itens da etapa (array JSON de strings). Copiado como snapshot para checklist_estado ao instanciar.';

ALTER TABLE public.onboarding_etapa_estado
  ADD COLUMN IF NOT EXISTS checklist_estado JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.onboarding_etapa_estado.checklist_estado IS
  'Snapshot executável do checklist: array de {item, concluido, concluido_at}. Editar o template não retroage.';

-- Valor não-array quebraria o trigger de instanciação (jsonb_array_elements_text)
-- para TODAS as famílias novas — CHECK de tipo fecha a porta (a RLS permite
-- head/ceo escreverem direto na tabela via PostgREST, fora do Zod das actions).
DO $$ BEGIN
  ALTER TABLE public.onboarding_template_etapas
    ADD CONSTRAINT chk_onboarding_tmpl_etapas_checklist_array
    CHECK (jsonb_typeof(checklist) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.onboarding_etapa_estado
    ADD CONSTRAINT chk_onboarding_etapa_estado_checklist_array
    CHECK (jsonb_typeof(checklist_estado) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. Trigger de instanciação copia o checklist ────────────────────────
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
    INSERT INTO public.onboarding_instancias (
      experiencia_id, template_id, responsavel_id, status
    ) VALUES (
      NEW.id, v_template.id, v_head_id, 'em_andamento'
    )
    RETURNING id INTO v_instancia_id;

    FOR v_etapa IN
      SELECT * FROM public.onboarding_template_etapas
      WHERE template_id = v_template.id
      ORDER BY ordem
    LOOP
      INSERT INTO public.onboarding_etapa_estado (
        instancia_id, template_etapa_id, ordem, titulo, descricao,
        prazo, requer_reuniao, requer_assuntos, requer_documentos,
        checklist_estado
      ) VALUES (
        v_instancia_id, v_etapa.id, v_etapa.ordem, v_etapa.titulo,
        v_etapa.descricao,
        NOW() + (v_etapa.prazo_dias || ' days')::INTERVAL,
        v_etapa.requer_reuniao, v_etapa.requer_assuntos,
        v_etapa.requer_documentos,
        (
          SELECT COALESCE(
            jsonb_agg(jsonb_build_object(
              'item', x.value, 'concluido', FALSE, 'concluido_at', NULL
            )),
            '[]'::jsonb
          )
          FROM jsonb_array_elements_text(COALESCE(v_etapa.checklist, '[]'::jsonb)) AS x(value)
        )
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

-- ─── 4. RPC: trocar o template default de forma atômica ──────────────────
-- O índice único parcial idx_onboarding_templates_default impede dois
-- defaults; a troca precisa ser em uma transação (unset → set).
CREATE OR REPLACE FUNCTION public.definir_template_default(p_template_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  -- IS DISTINCT FROM: fail-closed quando get_user_papel() retorna NULL
  -- (anon key / usuário sem user_profiles) — SECURITY DEFINER pula a RLS.
  IF public.get_user_papel() IS DISTINCT FROM 'ceo' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Apenas o CEO pode alterar o template padrão.');
  END IF;

  SELECT (ativo AND deleted_at IS NULL) INTO v_ok
  FROM public.onboarding_templates WHERE id = p_template_id;

  IF v_ok IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Template não encontrado ou inativo.');
  END IF;

  UPDATE public.onboarding_templates
  SET is_default = FALSE
  WHERE is_default = TRUE AND deleted_at IS NULL AND id <> p_template_id;

  UPDATE public.onboarding_templates
  SET is_default = TRUE
  WHERE id = p_template_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SECURITY DEFINER: nunca expor a anon (defesa em profundidade além do gate)
REVOKE EXECUTE ON FUNCTION public.definir_template_default(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_template_default(UUID) TO authenticated, service_role;

-- ─── 5. RPC: reordenar etapas de um template de forma atômica ────────────
-- UNIQUE(template_id, ordem) impede swaps diretos; desloca para uma faixa
-- temporária e reatribui 1..N conforme a posição no array.
CREATE OR REPLACE FUNCTION public.reordenar_etapas_template(
  p_template_id UUID,
  p_etapa_ids UUID[]
)
RETURNS JSONB AS $$
DECLARE
  v_count INT;
  i INT;
BEGIN
  -- IS DISTINCT FROM: fail-closed quando get_user_papel() retorna NULL
  IF public.get_user_papel() IS DISTINCT FROM 'ceo' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Apenas o CEO pode reordenar etapas.');
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.onboarding_template_etapas
  WHERE template_id = p_template_id;

  IF v_count <> COALESCE(array_length(p_etapa_ids, 1), 0) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Lista de etapas não confere com o template. Recarregue a página.');
  END IF;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  -- Duplicata no array deixaria uma etapa órfã na faixa temporária (>10000)
  IF (SELECT COUNT(DISTINCT u.id) FROM unnest(p_etapa_ids) AS u(id)) <> v_count THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Lista de etapas contém IDs duplicados. Recarregue a página.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(p_etapa_ids) AS u(id)
    LEFT JOIN public.onboarding_template_etapas te
      ON te.id = u.id AND te.template_id = p_template_id
    WHERE te.id IS NULL
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Etapa não pertence a este template.');
  END IF;

  UPDATE public.onboarding_template_etapas
  SET ordem = ordem + 10000
  WHERE template_id = p_template_id;

  FOR i IN 1 .. COALESCE(array_length(p_etapa_ids, 1), 0) LOOP
    UPDATE public.onboarding_template_etapas
    SET ordem = i
    WHERE id = p_etapa_ids[i] AND template_id = p_template_id;
  END LOOP;

  RETURN jsonb_build_object('success', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.reordenar_etapas_template(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reordenar_etapas_template(UUID, UUID[]) TO authenticated, service_role;

-- ─── 5b. RPC: toggle atômico de item do checklist (sem read-modify-write) ─
-- SECURITY INVOKER (default): a RLS de onboarding_etapa_estado continua
-- valendo (só ceo/head_sucesso atualizam). jsonb_set em um único UPDATE
-- elimina o last-write-wins de toggles concorrentes e re-checa status/índice
-- no próprio WHERE (CAS).
CREATE OR REPLACE FUNCTION public.toggle_checklist_item(
  p_etapa_estado_id UUID,
  p_index INT,
  p_concluido BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
  v_novo JSONB;
BEGIN
  UPDATE public.onboarding_etapa_estado
  SET checklist_estado = jsonb_set(
    checklist_estado,
    ARRAY[p_index::text],
    (checklist_estado->p_index) || jsonb_build_object(
      'concluido', p_concluido,
      'concluido_at', CASE WHEN p_concluido THEN to_jsonb(NOW()) ELSE 'null'::jsonb END
    )
  )
  WHERE id = p_etapa_estado_id
    AND status IN ('pendente', 'em_andamento')
    AND p_index >= 0
    AND jsonb_typeof(checklist_estado) = 'array'
    AND p_index < jsonb_array_length(checklist_estado)
  RETURNING checklist_estado INTO v_novo;

  IF v_novo IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Item indisponível ou etapa já finalizada. Recarregue a página.');
  END IF;
  RETURN jsonb_build_object('success', TRUE, 'checklist', v_novo);
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.toggle_checklist_item(UUID, INT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_checklist_item(UUID, INT, BOOLEAN) TO authenticated, service_role;

-- ─── 6. Seed: checklists detalhados no template padrão ───────────────────
-- Idempotente: só preenche onde o checklist ainda está vazio, casando pelo
-- título original do seed no template default.
DO $$
DECLARE
  v_template_id UUID;
BEGIN
  SELECT id INTO v_template_id
  FROM public.onboarding_templates
  WHERE is_default = TRUE AND deleted_at IS NULL
  LIMIT 1;

  IF v_template_id IS NULL THEN RETURN; END IF;

  UPDATE public.onboarding_template_etapas SET checklist = '[
    "Enviar mensagem de boas-vindas no WhatsApp",
    "Apresentar a Head como ponto de contato da família",
    "Explicar os próximos passos e prazos do onboarding"
  ]'::jsonb
  WHERE template_id = v_template_id AND checklist = '[]'::jsonb
    AND titulo = 'Boas-vindas e apresentação';

  UPDATE public.onboarding_template_etapas SET checklist = '[
    "Propor 2 a 3 horários à família",
    "Criar o link da reunião (Google Meet)",
    "Enviar convite com data, hora e link",
    "Confirmar presença 1 dia antes"
  ]'::jsonb
  WHERE template_id = v_template_id AND checklist = '[]'::jsonb
    AND titulo = 'Agendar call de onboarding';

  UPDATE public.onboarding_template_etapas SET checklist = '[
    "Alinhar expectativas do processo",
    "Apresentar o calendário e os marcos",
    "Listar os documentos necessários",
    "Definir o canal de contato preferido",
    "Registrar os assuntos discutidos na reunião"
  ]'::jsonb
  WHERE template_id = v_template_id AND checklist = '[]'::jsonb
    AND titulo = 'Realizar call de onboarding';

  UPDATE public.onboarding_template_etapas SET checklist = '[
    "Validar telefones do atleta e do responsável",
    "Validar e-mails",
    "Confirmar endereço completo",
    "Atualizar o cadastro no CRM"
  ]'::jsonb
  WHERE template_id = v_template_id AND checklist = '[]'::jsonb
    AND titulo = 'Confirmar dados de contato';

  UPDATE public.onboarding_template_etapas SET checklist = '[
    "Solicitar passaporte do atleta",
    "Solicitar histórico escolar",
    "Solicitar comprovantes financeiros",
    "Conferir a validade do passaporte",
    "Subir os arquivos na aba Documentos"
  ]'::jsonb
  WHERE template_id = v_template_id AND checklist = '[]'::jsonb
    AND titulo = 'Coletar documentos iniciais';

  UPDATE public.onboarding_template_etapas SET checklist = '[
    "Combinar a frequência de check-ins com a família",
    "Registrar o próximo contato agendado",
    "Criar a tarefa do primeiro check-in"
  ]'::jsonb
  WHERE template_id = v_template_id AND checklist = '[]'::jsonb
    AND titulo = 'Definir cadência de contato';
END $$;

-- ─── 7. Backfill: etapas ainda executáveis das famílias existentes ───────
-- Snapshot por design não retroage, mas etapas pendentes/em andamento sem
-- checklist ganham o do template (uma única vez — idempotente).
UPDATE public.onboarding_etapa_estado ee
SET checklist_estado = (
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('item', x.value, 'concluido', FALSE, 'concluido_at', NULL)),
    '[]'::jsonb
  )
  FROM jsonb_array_elements_text(te.checklist) AS x(value)
)
FROM public.onboarding_template_etapas te
WHERE ee.template_etapa_id = te.id
  AND ee.status IN ('pendente', 'em_andamento')
  AND ee.checklist_estado = '[]'::jsonb
  AND te.checklist <> '[]'::jsonb;

-- ─── UAT / DEV ────────────────────────────────────────────────────────────
-- As tabelas onboarding_* existem só em public (o Engine lê public em todos
-- os ambientes). Gate por tabela mantém a migration segura caso um dia os
-- schemas uat/dev ganhem essas tabelas.
DO $$ BEGIN
  IF to_regclass('uat.onboarding_template_etapas') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.onboarding_template_etapas ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT ''[]''::jsonb';
    EXECUTE 'ALTER TABLE uat.onboarding_etapa_estado ADD COLUMN IF NOT EXISTS checklist_estado JSONB NOT NULL DEFAULT ''[]''::jsonb';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('dev.onboarding_template_etapas') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.onboarding_template_etapas ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT ''[]''::jsonb';
    EXECUTE 'ALTER TABLE dev.onboarding_etapa_estado ADD COLUMN IF NOT EXISTS checklist_estado JSONB NOT NULL DEFAULT ''[]''::jsonb';
  END IF;
END $$;
