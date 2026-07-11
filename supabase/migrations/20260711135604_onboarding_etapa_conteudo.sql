-- ════════════════════════════════════════════════════════════════════════
-- Migration: Conteúdo por etapa do onboarding — anexos, links e checklist
--            editável pela Head (tela dedicada de execução)
-- Aplica em: public (uat/dev gateados por to_regclass — onboarding_* só
-- existe em public; o Engine lê public em todos os ambientes)
--
-- Contexto: o onboarding vira uma TELA dedicada (/familias-crm/onboarding/
-- <experiencia_id>) onde cada etapa é uma aba e concentra reuniões, links,
-- anexos/prints e o registro obrigatório de informações. Este arquivo:
--   1. anexos JSONB em onboarding_etapa_estado
--      (array de {path,name,type,size,uploaded_at} — bucket crm-uploads)
--   2. links JSONB em onboarding_etapa_estado
--      (array de {url,titulo,adicionado_at})
--   3. RPC adicionar_item_checklist (append atômico — Head define o checklist)
--   4. RPC remover_item_checklist (remove atômico — só item NÃO concluído)
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1/2. Colunas de conteúdo da etapa ────────────────────────────────────
ALTER TABLE public.onboarding_etapa_estado
  ADD COLUMN IF NOT EXISTS anexos JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.onboarding_etapa_estado.anexos IS
  'Anexos/prints da etapa: array de {path,name,type,size,uploaded_at}. Arquivos no bucket crm-uploads (scope onboarding/<etapa_estado_id>).';

ALTER TABLE public.onboarding_etapa_estado
  ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.onboarding_etapa_estado.links IS
  'Links úteis da etapa (reunião, contato, materiais): array de {url,titulo,adicionado_at}.';

-- Valor não-array quebraria os parsers e as RPCs de append — CHECK de tipo
-- fecha a porta (a RLS permite head/ceo escreverem direto via PostgREST,
-- fora do Zod das actions). Mesmo padrão do checklist_estado.
DO $$ BEGIN
  ALTER TABLE public.onboarding_etapa_estado
    ADD CONSTRAINT chk_onboarding_etapa_estado_anexos_array
    CHECK (jsonb_typeof(anexos) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.onboarding_etapa_estado
    ADD CONSTRAINT chk_onboarding_etapa_estado_links_array
    CHECK (jsonb_typeof(links) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. RPC: adicionar item ao checklist da etapa (append atômico) ────────
-- SECURITY INVOKER (default): a RLS de onboarding_etapa_estado continua
-- valendo (só ceo/head_sucesso atualizam). Append via `||` em um único
-- UPDATE com CAS de status no WHERE — sem read-modify-write, adições
-- concorrentes não se sobrescrevem. Limites: item 1..300 chars, máx 30 itens.
CREATE OR REPLACE FUNCTION public.adicionar_item_checklist(
  p_etapa_estado_id UUID,
  p_item TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_item TEXT := btrim(COALESCE(p_item, ''));
  v_novo JSONB;
BEGIN
  IF length(v_item) < 1 OR length(v_item) > 300 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'O item deve ter entre 1 e 300 caracteres.');
  END IF;

  UPDATE public.onboarding_etapa_estado
  SET checklist_estado = checklist_estado || jsonb_build_array(
    jsonb_build_object('item', v_item, 'concluido', FALSE, 'concluido_at', NULL)
  )
  WHERE id = p_etapa_estado_id
    AND status IN ('pendente', 'em_andamento')
    AND jsonb_typeof(checklist_estado) = 'array'
    AND jsonb_array_length(checklist_estado) < 30
  RETURNING checklist_estado INTO v_novo;

  IF v_novo IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Etapa finalizada ou checklist cheio (máx. 30 itens). Recarregue a página.');
  END IF;
  RETURN jsonb_build_object('success', TRUE, 'checklist', v_novo);
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.adicionar_item_checklist(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adicionar_item_checklist(UUID, TEXT) TO authenticated, service_role;

-- ─── 4. RPC: remover item do checklist da etapa (atômico, `#-`) ───────────
-- Só remove item ainda NÃO concluído e com a etapa aberta — item concluído é
-- registro de execução e não pode sumir.
CREATE OR REPLACE FUNCTION public.remover_item_checklist(
  p_etapa_estado_id UUID,
  p_index INT
)
RETURNS JSONB AS $$
DECLARE
  v_novo JSONB;
BEGIN
  UPDATE public.onboarding_etapa_estado
  SET checklist_estado = checklist_estado #- ARRAY[p_index::text]
  WHERE id = p_etapa_estado_id
    AND status IN ('pendente', 'em_andamento')
    AND p_index >= 0
    AND jsonb_typeof(checklist_estado) = 'array'
    AND p_index < jsonb_array_length(checklist_estado)
    AND COALESCE((checklist_estado->p_index->>'concluido')::boolean, FALSE) = FALSE
  RETURNING checklist_estado INTO v_novo;

  IF v_novo IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Item concluído ou etapa finalizada não pode ser removido. Recarregue a página.');
  END IF;
  RETURN jsonb_build_object('success', TRUE, 'checklist', v_novo);
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.remover_item_checklist(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remover_item_checklist(UUID, INT) TO authenticated, service_role;

-- ─── UAT / DEV ────────────────────────────────────────────────────────────
-- As tabelas onboarding_* existem só em public (o Engine lê public em todos
-- os ambientes). Gate por tabela mantém a migration segura caso um dia os
-- schemas uat/dev ganhem essas tabelas.
DO $$ BEGIN
  IF to_regclass('uat.onboarding_etapa_estado') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE uat.onboarding_etapa_estado ADD COLUMN IF NOT EXISTS anexos JSONB NOT NULL DEFAULT ''[]''::jsonb';
    EXECUTE 'ALTER TABLE uat.onboarding_etapa_estado ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT ''[]''::jsonb';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('dev.onboarding_etapa_estado') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE dev.onboarding_etapa_estado ADD COLUMN IF NOT EXISTS anexos JSONB NOT NULL DEFAULT ''[]''::jsonb';
    EXECUTE 'ALTER TABLE dev.onboarding_etapa_estado ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT ''[]''::jsonb';
  END IF;
END $$;
