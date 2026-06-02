---
name: bausa-supabase-migration
description: Use ao criar uma migration SQL em supabase/migrations/ do projeto BAUSA. Garante aplicação multi-schema (public/uat/dev) via DO blocks idempotentes, RLS por papel, trigger de auditoria, set_updated_at, e que a migration seja forward-only e segura para produção.
---

# BAUSA — Supabase Migrations

## Princípios inegociáveis

1. **Forward-only.** Migration já aplicada em PRD NUNCA é editada. Correção = nova migration compensatória.
2. **Multi-schema.** Toda mudança estrutural aplica em `public` (PRD), `uat` e `dev`. `public` direto; `uat`/`dev` via DO blocks `IF EXISTS schemata`.
3. **Idempotente.** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` antes de `CREATE POLICY`, `DROP TRIGGER IF EXISTS` antes de `CREATE TRIGGER`. Rodar 2x não quebra.
4. **Sem enum novo se evitável.** `ALTER TYPE ... ADD VALUE` não roda dentro de transação e complica cross-schema. Preferir `TEXT + CHECK (col IN (...))`. Se enum existente precisa de valor novo, usar bloco `DO $$ ... pg_enum ... ALTER TYPE ADD VALUE IF NOT EXISTS`.

## Nomenclatura
`YYYYMMDDHHmmss_descricao_curta.sql` (timestamp UTC, gerar com `date -u +"%Y%m%d%H%M%S"`).

## Template (espelhar `20260518120000_create_investimentos_marketing.sql` ou `20260515000000`)

```sql
-- ════════════════════════════════════════════════════════════
-- Migration: <título>  | Aplica em public, uat, dev
-- Contexto: <por quê, qual feature>
-- ════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ───
CREATE TABLE IF NOT EXISTS public.minha_tabela (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- colunas...
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ,                    -- soft delete
  created_by  UUID REFERENCES auth.users(id)
);

-- updated_at automático (função compartilhada)
DROP TRIGGER IF EXISTS trg_minha_updated_at ON public.minha_tabela;
CREATE TRIGGER trg_minha_updated_at BEFORE UPDATE ON public.minha_tabela
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auditoria (função genérica SECURITY DEFINER)
DROP TRIGGER IF EXISTS trg_audit_minha ON public.minha_tabela;
CREATE TRIGGER trg_audit_minha AFTER INSERT OR UPDATE OR DELETE ON public.minha_tabela
  FOR EACH ROW EXECUTE FUNCTION audit.log_change();

-- índice parcial (ignora soft-deleted)
CREATE INDEX IF NOT EXISTS idx_minha_x ON public.minha_tabela (x) WHERE deleted_at IS NULL;

-- RLS por papel (padrão de 20260401000700_crm_financeiro)
ALTER TABLE public.minha_tabela ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "minha_select" ON public.minha_tabela;
CREATE POLICY "minha_select" ON public.minha_tabela
  FOR SELECT TO authenticated USING (deleted_at IS NULL);
DROP POLICY IF EXISTS "minha_ceo" ON public.minha_tabela;
CREATE POLICY "minha_ceo" ON public.minha_tabela
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');
DROP POLICY IF EXISTS "minha_service" ON public.minha_tabela;
CREATE POLICY "minha_service" ON public.minha_tabela
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── UAT ───
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'uat') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS uat.minha_tabela ( ... )'; -- aspas '' escapadas
    EXECUTE 'DROP TRIGGER IF EXISTS ... ON uat.minha_tabela';
    EXECUTE 'CREATE TRIGGER ... EXECUTE FUNCTION public.set_updated_at()';
    -- audit, índice, RLS idem, prefixando uat.
  END IF;
END $$;

-- ─── DEV ─── (idêntico ao UAT, schema 'dev')
```

## Funções/triggers compartilhados (já existem — referenciar qualificado)
- `public.set_updated_at()` — timestamp automático
- `public.get_user_papel()` — retorna papel do usuário autenticado (RLS)
- `audit.log_change()` — registra INSERT/UPDATE/DELETE em `audit_logs` (SECURITY DEFINER)
- `public.calcular_lead_score(atleta_id)` / `calcular_match_score` / `calcular_health_score(experiencia_id)`

## ⛔ Checklist anti-regressão

- [ ] Aplica nos 3 schemas (public direto + DO blocks uat/dev)? Aspas `''` escapadas corretamente nos EXECUTE.
- [ ] Idempotente? Rodar 2x não falha (`IF NOT EXISTS`, `DROP ... IF EXISTS`).
- [ ] Trigger que toca tabela secundária NÃO aborta a operação crítica? (incidente #52 — handoff travou CEO de mover deal). Usar `EXCEPTION WHEN OTHERS` ou mover side-effect para application-level.
- [ ] `SECURITY DEFINER` só quando realmente necessário (bypass RLS controlado) — preferir `EXCEPTION` handler.
- [ ] UNIQUE constraint considera soft-delete? (registro deleted_at ainda ocupa o índice — usar upsert `onConflict` ou reativar).
- [ ] Coluna nova é aditiva (não renomeia/dropa coluna usada em PRD)?
- [ ] Default seguro em coluna NOT NULL nova (senão quebra rows existentes).

## Deploy
- PR para `develop` → `deploy-supabase-uat.yml` aplica em UAT automaticamente
- Validar nos 3 schemas via REST: `curl '<SUPA>/rest/v1/minha_tabela?select=*&limit=1' -H 'apikey:...' -H 'Accept-Profile: uat'`
- PR `develop→main` → `deploy-supabase.yml` aplica em PRD
- CI `Validate Migrations` checa arquivos não-vazios
