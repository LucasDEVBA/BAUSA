-- ============================================================
-- CRM Bolsa Atleta USA — Migration 3: Audit Trail
-- Tabela imutável (append-only) para log de todas as alterações.
-- Retenção mínima: 5 anos. Ninguém pode UPDATE ou DELETE.
-- ============================================================

-- ── Schema de audit (isola funções de auditoria) ─────────────
CREATE SCHEMA IF NOT EXISTS audit;

-- ── Tabela de audit logs ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela          TEXT NOT NULL,           -- Nome da tabela afetada
  registro_id     UUID NOT NULL,           -- ID do registro afetado
  operacao        TEXT NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  dados_anteriores JSONB,                  -- OLD (NULL em INSERT)
  dados_novos     JSONB,                   -- NEW (NULL em DELETE)
  campos_alterados TEXT[],                 -- Lista de campos que mudaram (UPDATE)
  user_id         UUID REFERENCES auth.users(id),
  user_papel      TEXT,                    -- Papel no momento da ação
  ip_address      TEXT,
  justificativa   TEXT,                    -- Obrigatória em certas operações
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- SEM updated_at e deleted_at: imutável
);

COMMENT ON TABLE public.audit_logs IS 'Log imutável de auditoria. Append-only. Retenção 5 anos.';
COMMENT ON COLUMN public.audit_logs.campos_alterados IS 'Campos que mudaram no UPDATE (facilita busca)';
COMMENT ON COLUMN public.audit_logs.justificativa IS 'Obrigatória em retrocesso de etapa, customização financeira, etc.';

-- Índices para consulta
CREATE INDEX IF NOT EXISTS idx_audit_logs_tabela_registro ON public.audit_logs(tabela, registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operacao ON public.audit_logs(operacao);

-- ── RLS: apenas CEO pode LER. Ninguém pode UPDATE/DELETE. ───
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: apenas CEO
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.get_user_papel() = 'ceo');

-- INSERT: service_role apenas (triggers usam SECURITY DEFINER)
DROP POLICY IF EXISTS "audit_logs_insert_service" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_service" ON public.audit_logs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- NENHUMA policy de UPDATE ou DELETE para authenticated
-- Isso significa que nenhum usuário autenticado pode modificar logs

-- ── Trigger para IMPEDIR UPDATE/DELETE mesmo pelo service_role ─
CREATE OR REPLACE FUNCTION audit.prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs é imutável. UPDATE e DELETE são proibidos.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_prevent_update ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_prevent_update
  BEFORE UPDATE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit.prevent_audit_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_prevent_delete ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_prevent_delete
  BEFORE DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit.prevent_audit_mutation();

-- ── Função genérica de audit trigger ─────────────────────────
-- Aplicada em todas as tabelas do CRM via migration separada.
-- Captura: tabela, id, operação, OLD, NEW, user_id, papel.
-- O user_id vem de current_setting('audit.user_id') setado
-- pela aplicação antes de cada operação.
CREATE OR REPLACE FUNCTION audit.log_change()
RETURNS TRIGGER AS $$
DECLARE
  _user_id UUID;
  _user_papel TEXT;
  _registro_id UUID;
  _dados_anteriores JSONB;
  _dados_novos JSONB;
  _campos_alterados TEXT[];
  _key TEXT;
BEGIN
  -- Captura user_id do contexto da aplicação
  BEGIN
    _user_id := current_setting('audit.user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    _user_id := NULL;
  END;

  -- Captura papel do user
  BEGIN
    _user_papel := current_setting('audit.user_papel', true);
  EXCEPTION WHEN OTHERS THEN
    _user_papel := NULL;
  END;

  -- Determina o ID do registro
  IF TG_OP = 'DELETE' THEN
    _registro_id := OLD.id;
    _dados_anteriores := to_jsonb(OLD);
    _dados_novos := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    _registro_id := NEW.id;
    _dados_anteriores := NULL;
    _dados_novos := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    _registro_id := NEW.id;
    _dados_anteriores := to_jsonb(OLD);
    _dados_novos := to_jsonb(NEW);

    -- Detecta quais campos mudaram
    _campos_alterados := ARRAY[]::TEXT[];
    FOR _key IN SELECT jsonb_object_keys(to_jsonb(NEW))
    LOOP
      IF to_jsonb(OLD) ->> _key IS DISTINCT FROM to_jsonb(NEW) ->> _key THEN
        -- Ignora campos de timestamp automáticos
        IF _key NOT IN ('updated_at') THEN
          _campos_alterados := _campos_alterados || _key;
        END IF;
      END IF;
    END LOOP;

    -- Se nada relevante mudou (apenas updated_at), não loga
    IF array_length(_campos_alterados, 1) IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Insere o log (usa SECURITY DEFINER para bypass RLS)
  INSERT INTO public.audit_logs (
    tabela, registro_id, operacao,
    dados_anteriores, dados_novos, campos_alterados,
    user_id, user_papel, ip_address, created_at
  ) VALUES (
    TG_TABLE_NAME, _registro_id, TG_OP,
    _dados_anteriores, _dados_novos, _campos_alterados,
    _user_id, _user_papel,
    current_setting('audit.ip_address', true),
    NOW()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit.log_change() IS 'Trigger genérico de audit. Aplicar em todas as tabelas do CRM.';
