-- ════════════════════════════════════════════════════════════════════════════
-- Migration: audit.log_change com search_path fixado       | função compartilhada
-- Contexto: follow-up da revisão adversarial de 20260703232151 (seção 0).
--   A função é SECURITY DEFINER sem search_path fixado — nit de segurança:
--   um search_path malicioso da sessão invocadora poderia, em teoria, resolver
--   funções não-qualificadas para um schema controlado pelo atacante.
--   Fix: SET search_path = pg_catalog, public (precedente:
--   public.automacao_materializa_evento, mesma migration).
--   O CORPO é idêntico ao vigente (extração defensiva de registro_id via
--   to_jsonb p/ tabelas sem coluna id) — só o header muda. Forward-only.
--   Função única compartilhada pelos triggers de todos os schemas.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION audit.log_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _user_id UUID;
  _user_papel TEXT;
  _registro_id UUID;
  _dados_anteriores JSONB;
  _dados_novos JSONB;
  _campos_alterados TEXT[];
  _key TEXT;
  _rec JSONB;
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

  IF TG_OP = 'DELETE' THEN
    _rec := to_jsonb(OLD);
    _dados_anteriores := _rec;
    _dados_novos := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    _rec := to_jsonb(NEW);
    _dados_anteriores := NULL;
    _dados_novos := _rec;
  ELSIF TG_OP = 'UPDATE' THEN
    _rec := to_jsonb(NEW);
    _dados_anteriores := to_jsonb(OLD);
    _dados_novos := _rec;

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

  -- Tabelas sem `id` (ex.: configuracoes_sistema): UUID determinístico da PK
  IF _rec ? 'id' THEN
    _registro_id := (_rec ->> 'id')::UUID;
  ELSE
    _registro_id := md5(TG_TABLE_NAME || ':' || COALESCE(_rec ->> 'chave', md5(_rec::text)))::UUID;
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
$$ LANGUAGE plpgsql;
