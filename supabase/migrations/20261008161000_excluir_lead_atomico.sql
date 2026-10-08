-- ════════════════════════════════════════════════════════════════════════
-- Exclusão de lead ATÔMICA e IDEMPOTENTE (T1 — vídeo do CEO 28/09, 07h15m54)
-- Aplica em: public (+ uat/dev SÓ se as tabelas existirem — gate por tabela)
-- ════════════════════════════════════════════════════════════════════════
--
-- Bug: a exclusão pelo Engine falhava SEMPRE para lead com atleta/deal.
-- atletas_select/deals_select (authenticated) são USING (deleted_at IS NULL);
-- quando o UPDATE lê colunas (WHERE/RETURNING), a política de SELECT vale
-- também para a linha NOVA — e a linha nova tem deleted_at preenchido →
-- 42501 "new row violates row-level security policy". Reproduzido em
-- 2026-10-08 (BEGIN/ROLLBACK, papel ceo). O erro era engolido e a 2ª
-- tentativa abortava no CAS da form_submission ("Lead já estava excluído").
--
-- Desenho:
--   • SECURITY DEFINER (owner postgres, BYPASSRLS) + search_path fixo; o
--     gate de papel é DENTRO da função (IS DISTINCT FROM: NULL = negado).
--     NÃO afrouxamos atletas_select/deals_select (o CEO passaria a ver
--     excluídos no sistema inteiro).
--   • Uma transação: form_submission + atletas + deals (soft delete),
--     whatsapp_grupos DESVINCULADOS (nunca apagados), tarefas abertas
--     CANCELADAS (nunca apagadas). Pós-condição verificada: se algo do lead
--     continuar vivo, RAISE → rollback total (nunca meio excluído).
--   • Idempotente: form_submission já excluída NÃO é erro — completa a
--     cascata pendente (caso Vicente) e devolve ja_excluido=true.
--   • Cliente ativo (contrato financeiro ou Experiência vivos) é RECUSADO
--     sem alterar nada: billing-reminders não olha deals.deleted_at e
--     crm_experiencia não pode ser desvinculada (atleta_id/deal_id NOT NULL).
--   • Trilha: o contexto de auditoria é setado NA MESMA transação (o
--     set_audit_user via RPC separado não sobrevive — audit_logs.user_id
--     vinha sempre NULL), então os triggers de atletas/deals/whatsapp_grupos/
--     tarefas gravam o usuário; form_submissions (sem trigger) ganha um
--     registro explícito com o "recibo" da cascata (ids) p/ restauração.
--
-- Compatível com o código antigo (rollout: develop aplica antes do Engine
-- de PRD ser promovido): só ADICIONA uma função; nada é renomeado/removido.
-- Forward-only e idempotente (CREATE OR REPLACE; GRANT/REVOKE repetíveis).

DO $migration$
DECLARE
  v_schema text;
BEGIN
  FOREACH v_schema IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    -- Gate POR TABELA (uat/dev são incompletos: não têm atletas/deals —
    -- memória migration-guard-por-tabela-nao-schema). Todas as tabelas que
    -- a função toca precisam existir no schema.
    IF (
      SELECT count(*) FROM information_schema.tables
      WHERE table_schema = v_schema
        AND table_name IN ('form_submissions', 'atletas', 'deals', 'whatsapp_grupos',
                           'tarefas', 'contratos_financeiros', 'crm_experiencia')
    ) < 7 THEN
      RAISE NOTICE 'excluir_lead: schema % sem as tabelas do CRM — pulado', v_schema;
      CONTINUE;
    END IF;

    EXECUTE format($tpl$
CREATE OR REPLACE FUNCTION %1$I.excluir_lead(
  p_form_submission_id uuid DEFAULT NULL,
  p_deal_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
DECLARE
  v_uid           uuid := auth.uid();
  v_papel_real    text;
  v_agora         timestamptz := now();
  v_fs_id         uuid;
  v_fs_deleted_at timestamptz;
  v_deal_atleta   uuid;
  v_ja_excluido   boolean := false;
  v_atletas       uuid[] := ARRAY[]::uuid[];
  v_deals         uuid[] := ARRAY[]::uuid[];
  v_experiencias  uuid[] := ARRAY[]::uuid[];
  v_grupos        uuid[] := ARRAY[]::uuid[];
  v_tarefas       uuid[] := ARRAY[]::uuid[];
  v_n_fs          integer := 0;
  v_n_atletas     integer := 0;
  v_n_deals       integer := 0;
BEGIN
  -- 1. Autorização. SECURITY DEFINER pula a RLS: o gate é AQUI.
  --    IS DISTINCT FROM = fail-closed (anon/service_role/sem perfil → NULL).
  IF public.get_user_papel() IS DISTINCT FROM 'ceo' THEN
    RAISE EXCEPTION 'Apenas CEO/CTO podem excluir leads.' USING ERRCODE = '42501';
  END IF;

  -- 2. Entrada: exatamente um identificador.
  IF (p_form_submission_id IS NULL) = (p_deal_id IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'code', 'parametros',
      'error', 'Informe o lead OU o deal (exatamente um).');
  END IF;

  -- 3. Contexto de auditoria NA MESMA transação (triggers audit.log_change).
  SELECT up.papel::text INTO v_papel_real FROM public.user_profiles up WHERE up.id = v_uid;
  PERFORM set_config('audit.user_id', v_uid::text, true);
  PERFORM set_config('audit.user_papel', COALESCE(v_papel_real, 'unknown'), true);

  -- 4. Resolve o lead (pelo deal: deal → atleta → form_submission).
  IF p_deal_id IS NOT NULL THEN
    SELECT d.atleta_id INTO v_deal_atleta
    FROM %1$I.deals d WHERE d.id = p_deal_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'code', 'nao_encontrado',
        'error', 'Deal não encontrado.');
    END IF;
    SELECT a.form_submission_id INTO v_fs_id FROM %1$I.atletas a WHERE a.id = v_deal_atleta;
  ELSE
    v_fs_id := p_form_submission_id;
  END IF;

  -- 5. Trava a form_submission (duas abas serializam aqui) e lê o estado.
  IF v_fs_id IS NOT NULL THEN
    SELECT fs.deleted_at INTO v_fs_deleted_at
    FROM %1$I.form_submissions fs WHERE fs.id = v_fs_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'code', 'nao_encontrado',
        'error', 'Lead não encontrado.');
    END IF;
    v_ja_excluido := v_fs_deleted_at IS NOT NULL;
    -- TODOS os atletas do lead, vivos ou não: repara cascata parcial
    -- (atleta excluído com deal vivo também é recolhido).
    SELECT COALESCE(array_agg(a.id), ARRAY[]::uuid[]) INTO v_atletas
    FROM %1$I.atletas a WHERE a.form_submission_id = v_fs_id;
  END IF;
  IF v_deal_atleta IS NOT NULL AND NOT (v_deal_atleta = ANY (v_atletas)) THEN
    v_atletas := v_atletas || v_deal_atleta;
  END IF;

  -- Lead criado à mão (sem form_submission): o "já excluído" é o do deal.
  IF v_fs_id IS NULL THEN
    SELECT d.deleted_at IS NOT NULL INTO v_ja_excluido FROM %1$I.deals d WHERE d.id = p_deal_id;
  END IF;

  -- Trava os deals do lead (concorrência com mover/contrato) e lista todos.
  PERFORM 1 FROM %1$I.deals d WHERE d.atleta_id = ANY (v_atletas) FOR UPDATE;
  SELECT COALESCE(array_agg(d.id), ARRAY[]::uuid[]) INTO v_deals
  FROM %1$I.deals d WHERE d.atleta_id = ANY (v_atletas);
  IF p_deal_id IS NOT NULL AND NOT (p_deal_id = ANY (v_deals)) THEN
    v_deals := v_deals || p_deal_id;
  END IF;

  -- 6. Cliente ativo: recusa SEM alterar nada.
  IF EXISTS (
    SELECT 1 FROM %1$I.contratos_financeiros c
    WHERE c.deal_id = ANY (v_deals) AND c.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'cliente_ativo',
      'error', 'Este lead tem contrato financeiro ativo — cliente não é excluído como lead. Se o contrato foi criado por engano e não tem parcela recebida, descarte-o na aba Contrato (Refazer) e tente de novo; senão, fale com o suporte. Nada foi alterado.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM %1$I.crm_experiencia e
    WHERE (e.atleta_id = ANY (v_atletas) OR e.deal_id = ANY (v_deals)) AND e.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'cliente_ativo',
      'error', 'Esta família já está no pós-venda (Experiência). A exclusão de cliente é feita pelo suporte. Nada foi alterado.');
  END IF;

  -- 7. Soft delete — só o que ainda está vivo (idempotente).
  IF v_fs_id IS NOT NULL AND NOT v_ja_excluido THEN
    UPDATE %1$I.form_submissions SET deleted_at = v_agora
    WHERE id = v_fs_id AND deleted_at IS NULL;
    GET DIAGNOSTICS v_n_fs = ROW_COUNT;
  END IF;

  UPDATE %1$I.deals SET deleted_at = v_agora
  WHERE id = ANY (v_deals) AND deleted_at IS NULL;
  GET DIAGNOSTICS v_n_deals = ROW_COUNT;

  UPDATE %1$I.atletas SET deleted_at = v_agora
  WHERE id = ANY (v_atletas) AND deleted_at IS NULL;
  GET DIAGNOSTICS v_n_atletas = ROW_COUNT;

  -- 8. Grupos de WhatsApp: DESVINCULA (a conversa é real — nunca apaga).
  --    Só experiências já excluídas chegam aqui (as vivas recusaram no 6).
  SELECT COALESCE(array_agg(e.id), ARRAY[]::uuid[]) INTO v_experiencias
  FROM %1$I.crm_experiencia e
  WHERE e.atleta_id = ANY (v_atletas) OR e.deal_id = ANY (v_deals);

  WITH upd AS (
    UPDATE %1$I.whatsapp_grupos g
    SET atleta_id      = CASE WHEN g.atleta_id = ANY (v_atletas) THEN NULL ELSE g.atleta_id END,
        experiencia_id = CASE WHEN g.experiencia_id = ANY (v_experiencias) THEN NULL ELSE g.experiencia_id END
    WHERE g.atleta_id = ANY (v_atletas) OR g.experiencia_id = ANY (v_experiencias)
    RETURNING g.id
  )
  SELECT COALESCE(array_agg(upd.id), ARRAY[]::uuid[]) INTO v_grupos FROM upd;

  -- 9. Tarefas abertas do lead saem das listas: CANCELADAS (nunca apagadas;
  --    /tarefas já exclui status cancelada).
  WITH upd AS (
    UPDATE %1$I.tarefas t SET status = 'cancelada'
    WHERE (t.deal_id = ANY (v_deals) OR t.atleta_id = ANY (v_atletas))
      AND t.deleted_at IS NULL
      AND t.status IN ('pendente', 'em_andamento', 'atrasada')
    RETURNING t.id
  )
  SELECT COALESCE(array_agg(upd.id), ARRAY[]::uuid[]) INTO v_tarefas FROM upd;

  -- 10. Pós-condição: nada do lead pode ficar vivo. Se ficar, aborta TUDO
  --     (a transação desfaz os passos 7-9 — nunca "meio excluído").
  IF EXISTS (SELECT 1 FROM %1$I.deals d WHERE d.id = ANY (v_deals) AND d.deleted_at IS NULL)
     OR EXISTS (SELECT 1 FROM %1$I.atletas a WHERE a.id = ANY (v_atletas) AND a.deleted_at IS NULL)
     OR (v_fs_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM %1$I.form_submissions fs WHERE fs.id = v_fs_id AND fs.deleted_at IS NULL))
  THEN
    RAISE EXCEPTION 'excluir_lead: pós-condição violada — exclusão desfeita.' USING ERRCODE = 'P0001';
  END IF;

  -- 11. Trilha explícita (form_submissions não tem trigger de audit) com o
  --     recibo da cascata — permite restaurar com precisão.
  IF v_n_fs + v_n_deals + v_n_atletas + cardinality(v_grupos) + cardinality(v_tarefas) > 0 THEN
    INSERT INTO public.audit_logs (
      tabela, registro_id, operacao, dados_anteriores, dados_novos,
      campos_alterados, user_id, user_papel, justificativa
    ) VALUES (
      CASE WHEN v_fs_id IS NULL THEN 'deals' ELSE 'form_submissions' END,
      COALESCE(v_fs_id, p_deal_id),
      'UPDATE',
      jsonb_build_object('deleted_at', v_fs_deleted_at),
      jsonb_build_object(
        'deleted_at', COALESCE(v_fs_deleted_at, v_agora),
        'schema', %2$L,
        'cascata', jsonb_build_object(
          'em', v_agora,
          'atletas', to_jsonb(v_atletas),
          'deals', to_jsonb(v_deals),
          'grupos_desvinculados', to_jsonb(v_grupos),
          'tarefas_canceladas', to_jsonb(v_tarefas)
        )
      ),
      ARRAY['deleted_at'],
      v_uid,
      COALESCE(v_papel_real, 'unknown'),
      CASE WHEN v_ja_excluido
        THEN 'excluir_lead: reparo — lead já excluído, vínculos pendentes removidos'
        ELSE 'excluir_lead: soft delete em cascata (lead + atletas + deals)'
      END
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ja_excluido', v_ja_excluido,
    'form_submission_id', v_fs_id,
    'atletas_excluidos', v_n_atletas,
    'deals_excluidos', v_n_deals,
    'grupos_desvinculados', cardinality(v_grupos),
    'tarefas_canceladas', cardinality(v_tarefas),
    'deal_alvo_excluido', CASE WHEN p_deal_id IS NULL THEN NULL
      ELSE NOT EXISTS (SELECT 1 FROM %1$I.deals d WHERE d.id = p_deal_id AND d.deleted_at IS NULL) END,
    'aviso', CASE
      WHEN v_ja_excluido AND v_n_deals + v_n_atletas > 0
        THEN 'O lead já estava excluído — vínculos pendentes (atleta/deal) removidos agora.'
      WHEN v_ja_excluido
        THEN 'O lead já estava excluído — não havia nada pendente.'
      ELSE NULL END
  );
END;
$fn$;
$tpl$, v_schema, v_schema);

    -- SECURITY DEFINER: nunca exposta a anon (defesa em profundidade além do gate).
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.excluir_lead(uuid, uuid) FROM PUBLIC, anon', v_schema);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.excluir_lead(uuid, uuid) TO authenticated, service_role', v_schema);
    EXECUTE format(
      'COMMENT ON FUNCTION %I.excluir_lead(uuid, uuid) IS %L', v_schema,
      'T1 (2026-10-08): exclusão de lead atômica/idempotente (soft delete fs+atletas+deals, desvincula grupos, cancela tarefas abertas). CEO/CTO only.'
    );
  END LOOP;
END $migration$;
