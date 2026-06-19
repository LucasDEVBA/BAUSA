---
name: bausa-crm-page
description: Use ao criar ou editar páginas, componentes ou server actions no BAUSA Engine (apps/crm — Next.js 16 App Router). Garante padrão Server+Client component, proteção requirePapel, dark theme, TypeScript strict sem any, integração de navegação (Sidebar+Header), e server actions auditados.
---

# BAUSA Engine — Páginas e Componentes (apps/crm)

## Stack e regras
- Next.js 16 App Router, React 19, **TypeScript `strict: true` SEM `any`** (este projeto sobrescreve a regra global). Em tipos Recharts use type guards numéricos.
- Tailwind v4, Recharts 3, Radix, React Hook Form + Zod, sonner, date-fns, Zustand.
- **Dark theme:** bg base `#0c0e16`, card `#141720`, sidebar `#0f1117`, borda `#1e2130`, texto `zinc-100/400/500`, acento `indigo-500/600`, sucesso `emerald-400`, alerta `red-400`, atenção `amber-400`.

## Padrão Página (Server Component + Client Component)

Espelhar `apps/crm/src/app/(dashboard)/analytics/atribuicao/{page,client}.tsx` ou `.../analytics/cac/`.

```tsx
// page.tsx — Server Component
import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { MinhaClient } from "./client";

export default async function MinhaPage({ searchParams }: { searchParams: Promise<{ x?: string }> }) {
  await requirePapel("ceo");                 // proteção explícita (defense-in-depth + RLS)
  const sp = await searchParams;             // searchParams é Promise no Next 16
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("tabela").select("col1, col2").is("deleted_at", null);
  return <MinhaClient rows={(data as Row[]) ?? []} />;
}
```

```tsx
// client.tsx
"use client";
import { MetricCard } from "@/components/dashboard/MetricCard";
// useState/useTransition/useRouter, Recharts, etc.
```

## Reusar (NÃO reinventar)
- **Auth:** `requirePapel("ceo")` / `requirePapel(["ceo","head_sucesso"])` de `@/lib/auth` — o papel `cto` é resolvido para `ceo` em `getUserPapel()`, então `requirePapel("ceo")` já cobre o CTO automaticamente (nunca filtre por `cto` explicitamente).
- **Supabase server:** `createServerSupabaseClient()` de `@/lib/supabase-server` (leitura). `createAuditedSupabaseClient()` de `@/lib/supabase-audit` (escrita com audit trail via RPC `set_audit_user`).
- **Queries centralizadas:** `@/lib/war-room-queries.ts` (helpers `mesAtualPrefix`, `firstOfMonth`, `daysAgoISO`). Para CAC: `@/lib/cac-queries.ts`.
- **MetricCard:** `@/components/dashboard/MetricCard` — props `{title, value, subtitle?, icon: LucideIcon, trend?, variant?: "default"|"hot"|"warm"|"cold"|"purple"}`
- **CustomTooltip Recharts:** copiar o padrão de `atribuicao/client.tsx` (border `#1e2130`, bg `#0f1117`).
- **Health/temperatura:** `HealthBadge`, componentes em `components/crm-familia/` e `components/war-room/`.
- **Templates de mensagem:** tabela `mensagem_templates` (7 seeds) com variáveis `{atleta_primeiro_nome}` etc.

## Server Actions (escrita)

Padrão (espelhar `apps/crm/src/lib/actions/financeiro.ts` ou `investimentos.ts`):
```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

const schema = z.object({ /* ... */ });

export async function minhaAction(input: z.input<typeof schema>): Promise<{success: boolean; error?: string}> {
  if ((await getUserPapel()) !== "ceo") return { success: false, error: "Apenas CEO." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message };
  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase.from("tabela").upsert({ ... }, { onConflict: "..." });
  if (error) return { success: false, error: error.message };
  revalidatePath("/minha-rota");
  return { success: true };
}
```
Actions existentes por domínio: `deals.ts`, `experiencia.ts`, `financeiro.ts`, `documentos.ts`, `escolas.ts`, `automacoes.ts`, `whatsapp.ts`, `tarefas.ts`, `uploads.ts`, `investimentos.ts`.

## Navegação (ao criar rota nova)
1. `apps/crm/src/components/layout/Sidebar.tsx` — adicionar ao `subItems` do grupo certo, com `roles` correto
2. `apps/crm/src/components/layout/Header.tsx` — adicionar ao `BREADCRUMB_MAP` (`{ label, parent }`)

## ⛔ Checklist anti-regressão
- [ ] `await requirePapel(...)` na page (não confiar só na nav que esconde o link)
- [ ] `searchParams`/`params` são `Promise` no Next 16 — `await` antes de usar
- [ ] Zero `any` — `tsc --noEmit` EXIT 0
- [ ] Mudança em componente compartilhado (MetricCard, Sidebar, war-room/*) não quebra outros consumidores — buscar usos antes
- [ ] `revalidatePath` após escrita (senão UI fica stale)
- [ ] Soft-delete: queries filtram `.is("deleted_at", null)`
- [ ] Divisão por zero em métricas → `null` → renderizar "—", nunca `NaN`/`Infinity`
- [ ] `next build` compila (server/client boundary correto — `"use client"` onde há hooks/eventos)

## Validação
```bash
cd /Users/lucasbau/BAUSA && npx --prefix apps/crm tsc --noEmit   # ou: pnpm --filter @bolsa-atleta/engine exec tsc --noEmit
pnpm --filter @bolsa-atleta/engine build
pnpm --filter @bolsa-atleta/engine lint   # warnings pré-existentes em arquivos não-tocados são OK
```
