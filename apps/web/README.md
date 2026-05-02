# @bolsa-atleta/web

Aplicação web da **Bolsa Atleta USA** — landing page institucional, formulário de avaliação estratégica e fluxo de captação de leads.

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Estilo:** Tailwind CSS 4 + shadcn/ui + Radix UI + Framer Motion
- **i18n:** `next-intl` (pt-BR padrão, en, es)
- **Formulários:** React Hook Form + Zod
- **Estado servidor:** TanStack Query
- **Auth/DB:** Supabase (`@supabase/ssr`)
- **Tracking:** Google Tag Manager (`GTM-5J87JXSR`) + GA4 + Meta Pixel
- **Analytics:** `@vercel/analytics`
- **Deploy:** Vercel (production em `bolsaatletausa.com`)

## Estrutura

```
app/
  ├── [locale]/         → rotas i18n (pt | en | es)
  │   ├── layout.tsx    → metadata + GTM + Providers
  │   ├── page.tsx      → home + JSON-LD
  │   ├── acesso/       → links institucionais (link tree)
  │   ├── forms/        → avaliação estratégica (noindex)
  │   └── not-found.tsx
  ├── robots.ts         → robots.txt dinâmico
  ├── sitemap.ts        → sitemap.xml dinâmico
  └── globals.css

src/
  ├── components/       → componentes UI/feature
  ├── lib/
  │   ├── tracking/     → dataLayer, eventos, GTM
  │   └── jsonld.tsx    → wrapper structured data
  ├── config/seo.ts     → metadata centralizada multilíngue
  ├── i18n/             → routing + request config (next-intl)
  └── ...

public/
  ├── og-image.jpg      → Open Graph 1200×630
  ├── favicon.ico
  └── hero-campus.jpg

docs/                   → documentação técnica do app web
middleware.ts           → next-intl + auth gates
next.config.ts          → headers de segurança + redirects
```

## Pré-requisitos

- Node.js 20+ (idealmente Node 24 LTS)
- pnpm 9+ (monorepo Turborepo na raiz `BAUSA/`)

## Desenvolvimento

```bash
# Na raiz do monorepo (BAUSA/)
pnpm install

# Rodar apenas o web
pnpm --filter @bolsa-atleta/web dev

# OU via Turbo (todos os apps)
pnpm dev
```

Acessar `http://localhost:3000`.

## Variáveis de Ambiente

Copiar `.env.example` para `.env.local` e preencher. Principais:

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key do Supabase |
| `NEXT_PUBLIC_GTM_ID` | Container GTM (`GTM-5J87JXSR` em prod) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server-side only) |

Detalhes completos: [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).

## Tracking

GTM container `GTM-5J87JXSR` orquestra:

- **Tag do Google** (GA4 `G-3GP7EFN0P9`) — pageviews
- **Meta Pixel** (`1521863919289394`) — base + Lead
- **Eventos custom** disparados via `pushEvent()` em [`src/lib/tracking/events.ts`](src/lib/tracking/events.ts):
  - `form_start`, `form_step_completed`, `form_submit`, `form_error`
  - `cta_click` (com parâmetro `cta_source`)

Eventos `form_submit` e `cta_click` viram conversões `generate_lead` (GA4) e `Lead` (Meta) via tags configuradas no GTM.

## Deploy

- **Produção:** push em `main` → aprovação manual no GitHub Actions → deploy Vercel
- **Preview:** PRs para `develop` geram preview Vercel
- **Local DEV:** `pnpm dev` aponta para schema `dev` do Supabase

Detalhes: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Documentação relacionada

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — fluxo de dados, Cloud Functions
- [`docs/MODULES.md`](docs/MODULES.md) — módulos do app
- [`docs/SPEC.md`](docs/SPEC.md) — especificação funcional
- [`docs/BUSINESS_RULES.md`](docs/BUSINESS_RULES.md) — regras de negócio
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — próximos passos
