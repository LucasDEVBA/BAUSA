# CLAUDE.md — BAUSA Engine (Design System)

> **Brief de trabalho** para a auditoria/padronização visual do CRM. Específico do app `apps/crm`.
> Complementa — **não substitui** — o `CLAUDE.md` raiz do monorepo e o `apps/crm/CLAUDE.md`.

## Contexto
Monorepo do Bolsa Atleta USA. O CRM fica em `apps/crm` (BAUSA Engine).
Stack do CRM: **Next + Tailwind CSS v4 (CSS-first) + shadcn/ui + Radix + CVA/clsx/tailwind-merge + Framer Motion + @dnd-kit + Lucide + Recharts 3**. Tema **dark por padrão** (`class="dark"` no `<html>`).

## Tarefa em andamento: auditoria e padronização visual (Design System Apple-grade)
Padronizar a aparência de **todas** as telas, modais e fluxos do CRM aplicando um design system inspirado na Apple — **sem alterar nenhuma regra de funcionamento.**

## ⛔ REGRA DE OURO (inegociável)
Você só edita a **camada de apresentação**: CSS, tokens, classes Tailwind, markup puramente visual, estados visuais, microinterações.
Você **NÃO** altera: handlers, lógica de negócio, condições, validações, contratos de dados, chamadas de API, integrações, rotas, permissões, nem o comportamento do @dnd-kit (Kanban).
Antes de cada commit, responda mentalmente: *"Revertendo meu CSS/markup, o usuário faz as mesmas ações, com os mesmos resultados, na mesma ordem?"* Se não for um sim absoluto, **pare e pergunte**.
Em dúvida entre visual e funcional, trate como funcional.

## Escopo de arquivos
- **Ler para contexto:** `apps/` (entender o sistema).
- **Atuar somente em:** `apps/crm/`.
- Componente de UI compartilhado fora do CRM (ex.: `packages/ui`): **avisar antes de tocar** (pode afetar outros apps). _Obs.: hoje só existe `packages/database` — não há `packages/ui`._

## Fontes da verdade (ler nesta ordem, antes de começar)
1. `apps/crm/docs/design-system/HIG-Rulebook-BAUSA.md` — princípios (Foundations, Patterns, Components, Inputs, Technologies), filtrados para web.
2. `apps/crm/docs/design-system/BAUSA-CRM-DesignSystem-AppleGrade.md` — valores e specs de componente.
3. `apps/crm/src/app/globals.css` — tokens (cor claro/escuro, tipo, raio, vidro). **Em conflito, os tokens vencem.**

## Princípios-chave (resumo)
- Cores = sistema Apple via tokens; **azul = ação**, status nunca usa a cor de ação como sólido (só tinted fill).
- Texto secundário por **alpha**, não cinza chapado.
- Dark eleva por **luminância de superfície**, não por sombra.
- Raios: input/botão 10px · card 12–16px · modal 20px · cantos contínuos onde suportado.
- Tipografia SF (system stack + Inter), tracking negativo nos títulos.
- Vidro só em chrome (header/sidebar/popover/modal), com contraste AA e fallback.
- Movimento = mola rápida (Framer), sempre com `prefers-reduced-motion`.
- Ícones Lucide com peso/tamanho consistentes; sem misturar; sem emoji.
- Preservar todas as props de acessibilidade do Radix (`aria-*`, `role`, `data-state`).

## Protocolo (por tela/modal/fluxo)
inventário → diagnóstico (citar item do rulebook) → proposta (ligada a token/spec) → confirmar escopo → aplicar → verificar fluxo idêntico.
Trabalhar em **branch separada**, commits pequenos por tela, mensagens descrevendo só a mudança visual.

## Entregar por bloco
Resumo do que mudou visualmente + itens do rulebook auditados + checklist da Regra de Ouro confirmado.

## Comandos úteis (reais do repo)
> Package manager: **pnpm 10.30.3** + Turborepo. Pacote do CRM: **`@bolsa-atleta/engine`** (não `crm`).
- Dev (só Engine): `pnpm dev:engine`
- Build (só Engine): `pnpm build:engine`
- Lint: `pnpm --filter @bolsa-atleta/engine lint`   _(ou `pnpm lint` para todos)_
- Typecheck: `pnpm --filter @bolsa-atleta/engine exec tsc --noEmit`   _(não há script `typecheck`; `tsconfig` já tem `noEmit: true`)_

## Notas do repo (verificadas em 2026-06-09)
- **TypeScript `strict: true`** em `apps/crm` (estende `tsconfig.base.json`). **Não usar `any`** — usar type guards (ex.: `PieLabelRenderProps` do Recharts).
- **Não existe `apps/crm/src/components/ui/`** (camada de primitivos shadcn). Os primitivos Radix são estilizados **inline** nos ~68 componentes. Recomendação: criar essa camada tokenizada como parte do trabalho (decisão a alinhar).
- `globals.css` é importado em `apps/crm/src/app/layout.tsx`. **Não há `crm.css`** neste app.
- O `<html lang="pt-BR" className="dark">` já existe no root layout — o dark é o padrão e deve permanecer.
- Branch de trabalho: `feat/design-system-pattern` (criada a partir de `develop`).
