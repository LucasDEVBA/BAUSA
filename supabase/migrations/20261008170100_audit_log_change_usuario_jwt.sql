-- ════════════════════════════════════════════════════════════════════════════
-- Migration: audit.log_change passa a registrar QUEM editou   | função compartilhada
-- Contexto: T16 (Banco de Escolas) exige "audit_logs registra o UPDATE com o
--   usuário que editou". Diagnóstico em PRD (08/10/2026): 0 de ~15,6 mil linhas
--   de audit_logs têm user_id — createAuditedSupabaseClient() chama a RPC
--   set_audit_user, que faz set_config(..., is_local => true) numa transação
--   PRÓPRIA; o UPDATE seguinte é outra transação e não enxerga o valor.
-- Fix: fallback para auth.uid() (JWT da própria requisição, mesma transação)
--   e papel real via user_profiles. Só ACRESCENTA informação: nenhuma escrita
--   passa a falhar — todo acesso novo é protegido por EXCEPTION e o user_id
--   só é gravado se existir em auth.users (audit_logs.user_id tem FK NO
--   ACTION: sem esse filtro, JWT de usuário removido abortaria a escrita com
--   23503). CFs/cron (service_role, sem "sub") continuam com user_id NULL.
--   Corpo IDÊNTICO ao vigente (20260705214424) fora do bloco de captura.
--   Linhas NOVAS deixam de gravar '' em user_papel (vira NULL ou o papel
--   real); as 1.305 linhas legadas com '' ficam como estão.
-- Compatível com o código antigo: nenhum consumidor depende de user_id NULL
--   (audit/page, actions/audit.ts, experiencia.ts, reunioes-queries.ts e
--   whatsapp-conversa-metricas.ts só leem/exibem).
-- ATENÇÃO (CROSS-CUTTING): se outro grupo também redefinir audit.log_change, manter
--   UMA versão final contendo este bloco (a última migration vence).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION audit.log_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
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
  -- Captura user_id do contexto da aplicação (set_audit_user)
  BEGIN
    _user_id := NULLIF(current_setting('audit.user_id', true), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    _user_id := NULL;
  END;

  -- Fallback (2026-10-08): o app chama set_audit_user numa RPC SEPARADA —
  -- outra transação no PostgREST —, então o set_config(..., true) já foi
  -- descartado quando o INSERT/UPDATE chega aqui (0 de ~15k linhas de
  -- audit_logs tinham user_id). O JWT da PRÓPRIA requisição está em
  -- request.jwt.claims desta transação: auth.uid() lê de lá. service_role,
  -- pg_cron e SQL direto não têm "sub" → continuam NULL (= sistema).
  IF _user_id IS NULL THEN
    BEGIN
      _user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      _user_id := NULL;
    END;
  END IF;

  -- audit_logs.user_id tem FK para auth.users (NO ACTION). Um JWT ainda
  -- válido de usuário já removido (ou um "sub" que não é usuário) faria o
  -- INSERT do log falhar com 23503 e ABORTAR a escrita do usuário. Sem linha
  -- em auth.users → grava NULL (= sistema). Lookup por PK; falha nunca aborta.
  IF _user_id IS NOT NULL THEN
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = _user_id) THEN
        _user_id := NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      _user_id := NULL;
    END;
  END IF;

  -- Captura papel do user
  BEGIN
    _user_papel := NULLIF(current_setting('audit.user_papel', true), '');
  EXCEPTION WHEN OTHERS THEN
    _user_papel := NULL;
  END;

  -- Papel REAL de exibição (cto continua 'cto'; get_user_papel() resolveria
  -- para 'ceo'). Falha de leitura nunca aborta a escrita auditada.
  IF _user_papel IS NULL AND _user_id IS NOT NULL THEN
    BEGIN
      SELECT up.papel::TEXT INTO _user_papel
      FROM public.user_profiles up
      WHERE up.id = _user_id;
    EXCEPTION WHEN OTHERS THEN
      _user_papel := NULL;
    END;
  END IF;

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
$function$;
