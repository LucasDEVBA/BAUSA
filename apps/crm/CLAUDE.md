# CLAUDE.md — BAUSA Engine

> Contexto do projeto para Claude Code. Complementa o CLAUDE.md global (~/.claude/CLAUDE.md).
> Regras do CLAUDE.md global continuam valendo — este arquivo só sobrescreve/acrescenta o que é específico deste projeto.
> Para regras de negócio detalhadas, ver `docs/regras-de-negocio.md`. Para mapa de módulos, ver `docs/modulos.md`.
> **Design System (Apple-grade):** ao mexer na aparência do CRM, ler `docs/design-system/` — `CLAUDE.md` (brief + Regra de Ouro), `HIG-Rulebook-BAUSA.md` (princípios) e `BAUSA-CRM-DesignSystem-AppleGrade.md` (tokens/specs). Tokens em `src/app/globals.css` vencem em conflito.

---

## Identidade do Produto

**BAUSA Engine** é o sistema interno de gestão da Bolsa Atleta USA.
Centraliza pipeline comercial, acompanhamento de famílias, execução financeira e inteligência de matching atleta × escola.

- **Repositório:** https://github.com/LucasDEVBA/BAUSA
- **CEO/usuário principal:** Leandro Ribeiro

---

## Desvios do CLAUDE.md Global

| Regra global | Este projeto |
|---|---|
| `pnpm` como package manager | **`pnpm`** com path absoluto: `/Users/lucasbau/Library/pnpm/pnpm` |
| TypeScript `strict: true` | **`strict: true` ATIVO** — manter assim |
| Sem `any` | Válido — especialmente em tipos Recharts (`PieLabelRenderProps`) usar type guards numéricos |

---

## Stack

```
Next.js 16.1.6 (App Router)   React 19   TypeScript 5 (strict)
Tailwind CSS v4 (CSS-first: @import "tailwindcss")
Recharts 3 — gráficos (BarChart, LineChart, PieChart, FunnelChart)
Lucide React — ícones
Radix UI — primitivos (Dialog, Tabs, Select, Tooltip, Switch…)
React Hook Form + Zod — formulários
TanStack Query — server state
TanStack Table — tabelas
TanStack Virtual — virtualização de listas
Framer Motion — animações
Zustand — estado global
Supabase JS — BaaS (ainda não integrado — dados são mock)
date-fns — datas
sonner — toasts
```

---

## Paleta e Design System

> **Design System Apple-grade** (2026-06). Tokens em `src/app/globals.css` (CSS-first, Tailwind v4).
> Docs em `docs/design-system/` (`HIG-Rulebook-BAUSA.md`, `BAUSA-CRM-DesignSystem-AppleGrade.md`,
> `conversion-guide.md`). **Regra: zero hex solto — sempre tokens.**

- **Temas claro/escuro** com toggle no Header (classe `.dark` no `<html>`; persiste em `localStorage`
  `bausa-theme`; **dark é o padrão**; anti-FOUC via script inline no layout).
- **Cores = tokens semânticos** (paleta de sistema Apple):
  - Superfícies: `bg-background` · `bg-card` · `bg-popover` · `bg-secondary` · `bg-sidebar`.
  - Texto (hierarquia por alpha): `text-foreground` · `text-muted-foreground` · `text-label-tertiary`.
  - Ação (azul) = `primary`. Status (tinted fill ~15%): `sys-green/orange/red/blue/yellow`,
    lead `lead-hot/warm/cold`, planos `plan-legacy/journey/start`.
  - Marca BAUSA: `bau-blue` · `bau-burgundy` · `bau-gold`.
  - Recharts: props de cor via `var(--chart-*/--sys-*/--lead-*)`.
- **Liquid glass**: `.glass-card` (cards de conteúdo) e `.liquid-glass` (modais/sheets/popovers);
  fundo com gradiente aurora; fallback de `prefers-reduced-transparency`.
- **Tipografia** SF/Inter via `.text-title-*` · `.text-headline` · `.text-footnote` (tracking negativo).
- **Raios**: inputs/botões `rounded-md` (10px) · cards `rounded-xl` · modais `rounded-2xl` (20px).
- **Sidebar**: logo BAU (`/brand/bausa-bau.png`), **recolhível** (persiste); item ativo `bg-primary/15`
  + barra `bg-primary`; **footer abre Meu Perfil (`/perfil`)** e mostra o avatar do usuário.
- **A11y**: `:focus-visible` global (anel `--ring`), `prefers-reduced-motion`/`-transparency`.

> Exceções de cor real (não-tema): budgets de **escola** em USD (`min/strong_budget_usd`) e
> gradientes de marca pontuais (login).

---

## Atualizações recentes (2026-06)

- **Design System Apple-grade** no CRM inteiro + **tema claro/escuro** (toggle no Header) + **liquid glass**.
- **Logo BAU** no sidebar; **sidebar recolhível** (persiste em `localStorage`).
- **Meu Perfil** (`/perfil`): editar nome, **trocar senha** (Supabase Auth), **foto de perfil**
  (Storage bucket `avatars`, público). Abre pelo nome no footer do sidebar; **avatar no sidebar e header**.
- **Gestão de usuários** (Configurações → aba **Usuários**): listar, editar **papel/ativo**, e **criar usuário**
  (CEO; admin API do Supabase Auth — requer `SUPABASE_SERVICE_KEY` no ambiente; sem ela, o resto funciona).
  **CTO usa o papel `ceo`** (mesmas regras; sem enum novo).
- **Rename** de campos: métricas de receita (War Room/analytics) `*_usd` → `*_brl` (valores sempre BRL).
  Budgets de **escola** seguem `*_usd` (orçamento real em USD). War Room agora exibe **R$**.

> Arquivos-chave: `src/lib/actions/usuarios.ts` (server actions), `src/lib/supabase-admin.ts`
> (client service-role, **server-only**), `src/lib/avatar-upload.ts`, `src/app/(dashboard)/perfil/`,
> `src/components/configuracoes/UsuariosTab.tsx`,
> `supabase/migrations/20260610000000_avatars_bucket.sql`.

---

## Moeda

**Todos os valores monetários são em BRL (R$).** Não usar USD em novos campos.

- Campos de deal: `deal_value_brl`, `signal_value_brl`, `remaining_value_brl`
- Campos de família: `contract_value_brl`
- Campos de financeiro: `mrr_brl`, `total_received_brl`, etc.
- Exceção: `School` usa `min_budget_usd` / `strong_budget_usd` (orçamento da família em USD para fins de matching com escolas americanas)

---

## Integração Supabase (Dados Reais)

Este projeto está **totalmente integrado** com o Supabase do BAUSA. Não usa mais dados mock.

**Credenciais:** `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Arquivos de infraestrutura
| Arquivo | Propósito |
|---------|-----------|
| `src/lib/supabase-browser.ts` | Client Supabase para browser (client components) |
| `src/lib/supabase-server.ts` | Client Supabase para server components (com cookies) |
| `src/lib/supabase-audit.ts` | Client com audit trail (chama `set_audit_user` RPC) |
| `src/lib/auth.ts` | Auth: getSession, getUserProfile, requirePapel |
| `src/middleware.ts` | Middleware: protege rotas, redireciona para /login |

### Server Actions (src/lib/actions/)
| Arquivo | Funções |
|---------|---------|
| `leads.ts` | promoverLead (manual, legado) |
| `deals.ts` | moverDeal, atualizarDeal |
| `financeiro.ts` | criarContrato, confirmarPagamento, confirmarSinalPago |
| `experiencia.ts` | registrarContato, atualizarExperiencia, escalonarCEO |
| `escolas.ts` | criarEscola, atualizarEscola, sugerirEscolas, calcularMatch |
| `automacoes.ts` | criarTarefa, marcarTarefaConcluida, getNotificacoesNaoLidas |
| `whatsapp.ts` | enviarWhatsAppManual, enviarConviteReuniao |
| `calendario.ts` | registrarLinkCalendario |
| `configuracoes.ts` | getConfiguracoes, atualizarConfiguracao |
| `faq.ts` | listarArtigos, salvarArtigo, registrarAcesso |
| `indicacoes.ts` | marcarRecompensaEntregue |
| `documentos.ts` | listarDocumentos, adicionarDocumento, atualizarStatusDocumento |

### Automações
| Arquivo | Propósito |
|---------|-----------|
| `src/lib/automacoes/verificar-alertas.ts` | Detecta 5 tipos de alerta no pipeline |
| `src/lib/war-room-queries.ts` | Queries centralizadas para War Room |

---

## Fluxo Automatizado Lead → Pipeline

Leads QUENTES e MORNOS entram **automaticamente** no pipeline:

1. Lead preenche formulário → `form_submissions` (BAUSA)
2. Cloud Function `qualify-lead` classifica via Gemini
3. Se QUENTE/MORNO → auto-cria `atleta` + `deal` (etapa: `lead`)
4. WhatsApp enviado automaticamente (22h delay)
5. `process-followup-whatsapp` verifica Calendar a cada hora
6. Se reunião detectada → move deal para `reuniao_marcada`
7. CEO gerencia no Pipeline Kanban (este projeto)

**Separação de conceitos:**
- **Qualificado Gemini** (`qualificado_gemini`): fixo, classificação IA na entrada
- **Lead Score** (`lead_score` 0-100): dinâmico, melhora conforme dados preenchidos
- **Classificação Score** (hot/warm/cold): derivada do lead_score pelo trigger SQL

---

## Páginas e Rotas

| Rota | Acesso | Dados Supabase |
|------|--------|----------------|
| `/login` | Público | Supabase Auth |
| `/war-room` | CEO | deals, contratos, parcelas, crm_experiencia, configuracoes |
| `/war-room/dashboard` | CEO | Todas as métricas consolidadas |
| `/war-room/meta` | CEO | Receita vs meta mensal |
| `/war-room/funil` | CEO | Deals por etapa |
| `/war-room/caixa` | CEO | Parcelas recebidas/previstas |
| `/war-room/risco` | CEO | Parcelas atrasadas, deals sem ação |
| `/war-room/posicionamento` | CEO | Mix de planos (Legacy/Journey/Start) |
| `/war-room/familias` | CEO | crm_experiencia (temperatura, status) |
| `/dashboard` | CEO | form_submissions (métricas de leads) |
| `/leads` | CEO | form_submissions + atletas (pipeline status) |
| `/pipeline` | CEO | deals + atletas + form_submissions (Kanban drag-drop) |
| `/financeiro` | CEO | contratos_financeiros + parcelas |
| `/escolas` | CEO | escolas |
| `/matching` | CEO | atletas + escolas + estrategia_escolas |
| `/familias-crm` | CEO + Head | crm_experiencia + atletas + deals |
| `/analytics` | CEO | parcelas + contratos (receita 24 meses) |
| `/configuracoes` | CEO | Configurações (8 abas) + aba **Usuários** (listar/editar papel·ativo / criar usuário) |
| `/perfil` | Autenticado (todos) | **Meu Perfil**: nome, **trocar senha** (Supabase Auth), **foto** (bucket `avatars`). Abre pelo nome no footer do sidebar |
| `/minha-area` | Head | Área do Head (dashboard) — **distinto** de `/perfil` |

**Pipeline DealDetailSheet (4 abas):**
- Resumo: Qualificação Gemini + Lead Score + info rápida + campos editáveis
- Reunião: Status, data, link, ações WhatsApp
- Dados: Campos do atleta (preencher melhora o Lead Score)
- Histórico: Timeline de eventos (WhatsApp, follow-ups, reunião, etapas)

---

## Estrutura de Arquivos

```
src/
├── app/
│   ├── page.tsx                       → redirect para /war-room
│   └── (dashboard)/
│       ├── layout.tsx                 → Sidebar + Header
│       ├── analytics/page.tsx         → Analytics com seletor de período
│       ├── dashboard/page.tsx         → KPIs de Leads
│       ├── escolas/page.tsx           → Banco de Escolas
│       ├── familias-crm/page.tsx      → CRM Experiência das Famílias (novo)
│       ├── families/page.tsx          → Módulo Famílias (legado, mantido)
│       ├── financeiro/page.tsx        → Módulo Financeiro
│       ├── leads/
│       │   ├── page.tsx               → Tabela de Leads
│       │   └── novo/page.tsx          → Formulário entrada de lead (6 etapas)
│       ├── matching/page.tsx          → Motor de Match atleta×escola
│       ├── pipeline/page.tsx          → Kanban 14 estágios
│       └── war-room/
│           ├── page.tsx               → Overview compacto 3×2 cards
│           ├── dashboard/page.tsx     → Dashboard completo (todas as seções)
│           ├── meta/page.tsx
│           ├── funil/page.tsx
│           ├── caixa/page.tsx
│           ├── risco/page.tsx
│           ├── posicionamento/page.tsx
│           └── familias/page.tsx
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx                → Navegação com sub-itens e activeRoutes
│   │   └── Header.tsx                 → Breadcrumb via BREADCRUMB_MAP
│   ├── dashboard/
│   │   ├── MetricCard.tsx             → Card KPI reutilizável (variant: hot/warm/cold/default/purple)
│   │   ├── ClassificationChart.tsx
│   │   ├── LeadsOverTimeChart.tsx
│   │   └── RecentLeads.tsx
│   ├── pipeline/
│   │   └── DealCard.tsx               → Card kanban com FinancialProgressBar e product_tier badge
│   ├── war-room/
│   │   ├── WarRoomSectionCard.tsx     → Card clicável do overview (variant, lines, badge)
│   │   ├── GoalProgressCard.tsx
│   │   ├── CommercialFunnelSection.tsx
│   │   ├── ConversionFunnel.tsx
│   │   ├── CashFlowSection.tsx
│   │   ├── RevenueBarChart.tsx
│   │   ├── RiskRevenueSection.tsx
│   │   ├── PositioningSection.tsx
│   │   ├── FamilyExperienceSection.tsx
│   │   ├── FamilyRiskDonut.tsx
│   │   ├── FamilyStageChart.tsx
│   │   └── AlertsPanel.tsx
│   └── ui/                            → shadcn/ui primitivos
├── lib/
│   ├── supabase-browser.ts            → Client Supabase (browser/client components)
│   ├── supabase-server.ts             → Client Supabase (server components)
│   ├── supabase-audit.ts              → Client com audit trail (set_audit_user RPC)
│   ├── auth.ts                        → Auth: getSession, getUserProfile, requirePapel
│   ├── war-room-queries.ts            → Queries centralizadas para War Room
│   ├── actions/                       → Server Actions (deals, leads, financeiro, etc.)
│   ├── automacoes/                    → Verificação de alertas automáticos
│   └── utils.ts                       → cn(), getInitials(), formatRelativeTime(), formatDate()
└── types/
    ├── deal.ts                        → DealStage (14), ProductTier, DealStageConfig, DEAL_STAGE_CONFIG
    ├── family.ts                      → Family, FamilyJourneyStage (6), FamilyStatus, FamilyTemperature + aliases legado
    ├── financial.ts                   → PlanType, PLAN_CONFIG, Contract, Receivable, FixedCost, VariableCost
    ├── lead.ts                        → Lead, LeadClassification, LeadStatus
    ├── matching.ts                    → SchoolMatch, MatchClassification, MATCH_CLASSIFICATION_CONFIG
    ├── revenue.ts                     → MetaRevenueMetrics, CommercialFunnelMetrics, WarRoomMetrics…
    └── school.ts                      → School, SchoolType, SchoolSportInfluence, ScholarshipAggressiveness
```

---

## Roteamento e Navegação

### Rotas principais

| Rota | Descrição |
|---|---|
| `/` | Redirect → `/war-room` |
| `/war-room` | Overview compacto (6 cards 3×2) |
| `/war-room/dashboard` | Todas as seções em uma tela (scroll) |
| `/war-room/meta` | Seção detalhada Meta e Receita |
| `/war-room/funil` | Funil Comercial detalhado |
| `/war-room/caixa` | Caixa detalhado |
| `/war-room/risco` | Receita em Risco + Alertas |
| `/war-room/posicionamento` | Posicionamento por produto |
| `/war-room/familias` | Experiência das Famílias |
| `/analytics` | Analytics com período + comparação |
| `/dashboard` | KPIs de Leads |
| `/leads` | Tabela de leads qualificados |
| `/leads/novo` | Formulário de entrada de lead (6 etapas) |
| `/pipeline` | Kanban 14 estágios |
| `/families` | Módulo famílias (legado) |
| `/familias-crm` | CRM Experiência das Famílias (novo) |
| `/escolas` | Banco de Escolas |
| `/matching` | Motor de Match |
| `/financeiro` | Módulo Financeiro |

### Sidebar — grupos de navegação

`NAV_GROUPS`: **EXECUTIVO → COMERCIAL → INTELIGÊNCIA → FAMÍLIAS → SISTEMA**

- Sub-itens aparecem quando `isParentActive = true` (rota filha ativa)
- `activeRoutes?: string[]` no `NavItem` — ativa o pai em rotas que não são sub-paths
- Breadcrumbs em `Header.tsx` via `BREADCRUMB_MAP` — adicionar nova rota aqui ao criar página

---

## Pipeline — 14 Estágios

```typescript
type DealStage =
  | "lead"                  // 0 — entrada
  | "reuniao_marcada"       // 1 — agendamento confirmado
  | "reuniao_realizada"     // 2 — reunião ocorreu
  | "diagnostico_fit"       // 3 — diagnóstico e fit confirmado
  | "alinhamento_estrategico" // 4 — alinhamento do projeto
  | "proposta_enviada"      // 5 — proposta comercial enviada
  | "followup_proposta"     // 6 — follow-up ativo
  | "negociacao"            // 7 — negociação em curso
  | "contrato_enviado"      // 8 — contrato enviado para assinatura
  | "contrato_assinado"     // 9 — FINANCEIRO: contrato assinado ✓
  | "sinal_pago"            // 10 — FINANCEIRO: sinal recebido
  | "admission_process"     // 11 — FINANCEIRO: processo de admissão
  | "concluido"             // 12 — FINANCEIRO: concluído ✓
  | "perdido";              // 13 — perdido (isLost: true)

type ProductTier = "Legacy" | "Journey" | "Start";
```

- Estágios com `isFinancial: true` (9–12) renderizam `FinancialProgressBar` no `DealCard`
- `DealStageConfig.isLost` controla estilo diferenciado do estágio "perdido"
- Todo deal ativo deve ter `next_action` + `next_action_date` preenchidos

---

## Família — Modelo de Experiência

Dois módulos coexistem:

| Módulo | Rota | Dados |
|---|---|---|
| Legado | `/families` | Supabase — usa campos opcionais de compatibilidade |
| Novo | `/familias-crm` | Supabase (`crm_experiencia` + `atletas` + `deals`) — usa campos novos obrigatórios |

O type `Family` em `src/types/family.ts` suporta ambos. Campos legado são opcionais:
`risk_level?`, `emotional_temperature?`, `nps_score?`, `alerts?`, `target_university?`, `contract_value_usd?`

Campos obrigatórios do modelo novo: `family_status`, `temperature`, `anxiety_level`, `satisfaction_level`, `perceived_risk`, `risk_profile`, `contract_value_brl`, `attention_records`, `crisis_records`.

Ver `docs/regras-de-negocio.md` para o modelo de risco e protocolo de crise.

---

## War Room — Dados e Componentes

> **Dados reais via Supabase.** Todos os mocks foram removidos. As queries estão centralizadas em `src/lib/war-room-queries.ts`.

### Recharts — type guard obrigatório em CustomLabel

```typescript
// PieLabelRenderProps tem campos opcionais — sempre fazer type guard:
const x = typeof props.x === "number" ? props.x : 0;
const y = typeof props.y === "number" ? props.y : 0;
```

---

## Analytics — Lógica de Período

- Fatias de `MOCK_REVENUE_MONTHS` (12 itens, ordem cronológica)
- `PERIOD_MONTHS: { "30d": 1, "90d": 3, "6m": 6, "12m": 12 }`
- `currentSlice = allMonths.slice(-months)`
- `previousSlice = allMonths.slice(-months*2, -months)`
- Delta: `Math.round(((cur - prev) / prev) * 100)` — null se `prev === 0`
- Quando `compareEnabled`, adicionar barras escuras `(ant.)` no BarChart

---

## Padrões de Código

### Tooltips customizados (Recharts)

```tsx
const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-xs shadow-xl">
      {/* conteúdo */}
    </div>
  );
};
```

### MetricCard — variantes disponíveis

```typescript
variant: "default" | "hot" | "warm" | "cold" | "purple"
```

### WarRoomSectionCard — variantes

```typescript
variant: "default" | "danger" | "warning" | "success" | "blue" | "purple" | "indigo"
badge.variant: "danger" | "warning" | "success" | "neutral"
```

### Seções de página War Room

```tsx
<section>
  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">
    Nome da Seção
  </p>
  {/* conteúdo */}
</section>
```

---

## Git

- Branch: sempre feature branches, nunca direto em `main`
- Commits: Conventional Commits (`feat:`, `fix:`, `refactor:`, `style:`, `chore:`)
- Remote: `https://github.com/LucasDEVBA/BAUSA.git`

---

## Estado Atual (Abr/2026)

### Implementado com dados reais (Supabase)

- [x] Pipeline Kanban — 14 estágios, valores BRL, next_action obrigatório, drag-drop, DealDetailSheet
- [x] Leads — Dashboard KPIs + Tabela com dados reais de form_submissions
- [x] War Room — Overview + Dashboard + 6 sub-páginas com queries Supabase
- [x] Analytics — período + comparação (parcelas + contratos reais)
- [x] Famílias legado (/families)
- [x] CRM Experiência das Famílias (/familias-crm) — novo modelo com risco/crise
- [x] Banco de Escolas (/escolas) — KPIs, filtros por tipo
- [x] Motor de Match (/matching) — score 0–100, algoritmo de 4 dimensões
- [x] Financeiro (/financeiro) — contratos, parcelas, confirmação de pagamento
- [x] Integração Supabase completa (todos os mocks removidos)
- [x] Autenticação (Supabase Auth + middleware + requirePapel)
- [x] Server Actions para todas as operações de escrita
- [x] Dark theme completo em todas as páginas
- [x] Fluxo automatizado Lead → Pipeline (qualify-lead → auto-cria atleta + deal)

### Próximos passos

- [ ] Motor de Match com IA (Gemini) — substituir cálculo manual
- [ ] Testes (Vitest + React Testing Library)
