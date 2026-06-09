# Guia de Conversão — hex/Tailwind cru → tokens Apple

> Rosetta usada na padronização do BAUSA Engine. **Só camada de apresentação.**
> Tokens definidos em `src/app/globals.css`. Em conflito, tokens vencem.

## Regra de Ouro (hard constraints)
- Mudar **apenas** `className`/`style` e mapas de estilo puro (strings de classe em `const X = {...}`).
- **NUNCA** alterar: handlers, condições, validações, dados, props funcionais, imports de lógica, `aria-*`, `role`, `data-*`, ordem de elementos, comportamento de @dnd-kit/Radix.
- Em dúvida entre visual e funcional → tratar como funcional (não mexer) e reportar.

## Superfícies (backgrounds)
| Antes | Depois |
|---|---|
| `bg-[#0c0e16]` (base) | `bg-background` |
| `bg-[#141720]`, `bg-surface` (card) | `bg-card` |
| `bg-[#0f1117]` (popover/menu/tooltip) | `bg-popover` |
| `bg-[#0f1117]` (sidebar) | `bg-sidebar` |
| `bg-[#1a1f2e]`, `bg-surface-hover` (elevado) | `bg-secondary` |
| `bg-white/5`, `hover:bg-white/5` (hover sutil) | `hover:bg-fill-4` |
| hover de linha/item (mais visível) | `hover:bg-accent` |
| seleção de linha | `bg-primary/10` |

## Bordas e separadores
| Antes | Depois |
|---|---|
| `border-[#1e2130]`, `border-zinc-700/800` | `border-border` |
| borda da sidebar | `border-sidebar-border` |
| divisória de lista/linha | `border-border` (ou `divide-border`) |

## Texto (hierarquia por alpha)
| Antes | Depois |
|---|---|
| `text-zinc-100`, `text-white` (primário) | `text-foreground` |
| `text-zinc-400`, `text-zinc-500` (secundário) | `text-muted-foreground` |
| `text-zinc-600`, `text-zinc-700` (terciário/sutil) | `text-label-tertiary` |
| placeholder | `placeholder:text-placeholder` (ou herda) |

## Ação (azul) vs status — A2 (separação obrigatória)
- **Azul = AÇÃO**: `indigo-*`/`blue-*` em botão/link/nav ativo/foco → `primary`.
  - `bg-indigo-600` → `bg-primary`; `text-indigo-400` (link) → `text-primary`; ativo nav → `bg-primary/15 text-foreground` + barra `bg-primary`.
- **Status nunca usa a cor de ação como sólido** — só tinted fill (abaixo).

## Status — tinted fill (doc §2.5): cor 15% + texto/ícone na cor cheia
| Semântica | Token | Classe típica |
|---|---|---|
| Sucesso / recebido / hot | `sys-green` / `lead-hot` | `bg-sys-green/15 text-sys-green border-sys-green/20` |
| Atenção / morno | `sys-orange` / `lead-warm` | `bg-sys-orange/15 text-sys-orange` |
| Médio (escala risco) | `sys-yellow` | `bg-sys-yellow/15 text-sys-yellow` |
| Frio / info | `sys-blue` / `lead-cold` | `bg-sys-blue/15 text-sys-blue` |
| Crítico / erro / perda | `sys-red` / `destructive` | `bg-sys-red/15 text-sys-red` (status) · `bg-destructive` (botão destrutivo) |
| Plano Legacy | `plan-legacy` (purple) | `bg-plan-legacy/15 text-plan-legacy` |
| Plano Journey | `plan-journey` (indigo) | `bg-plan-journey/15 text-plan-journey` |
| Plano Start | `plan-start` (gray) | `bg-plan-start/15 text-plan-start` |
| Neutro / N-A | `secondary` + `muted-foreground` | `bg-secondary text-muted-foreground border-border` |

Tailwind cru → mapear por semântica: `emerald→sys-green`, `amber→sys-orange`, `blue→sys-blue` (info) ou `lead-cold` (lead), `red→sys-red`, `purple→plan-legacy`, `indigo→primary` (ação) **ou** `plan-journey` (plano).

## Raios (arredondamentos)
| Uso | Classe | Valor |
|---|---|---|
| inputs, botões, controles | `rounded-md` | 10px |
| cards | `rounded-lg` / `rounded-xl` | 12 / 16px |
| modais/dialogs | `rounded-2xl` | 20px |
| pills, switches, avatares, dots | `rounded-full` | — |

## Sombras e foco
- Cards/popovers: `shadow-sm` (card), `shadow-lg` (popover/menu), `shadow-xl` (modal). No dark, separar por luminância + borda.
- Foco: nunca `outline:none` solto. `:focus-visible` global já entrega o anel `--ring` (definido em globals.css).

## Recharts (CRÍTICO — props de cor são STRINGS, não classes)
- `fill`, `stroke`, `color`, `stopColor` recebem **string CSS** → usar `var(--token)`:
  - séries: `fill="var(--chart-1)"` … `var(--chart-5)`
  - grid/eixos: `stroke="var(--chart-grid)"`
  - cores semânticas: `var(--sys-green)`, `var(--lead-hot)`, etc.
- **Não** trocar props de dados (`dataKey`, `data`, `name`, formatters, `domain`) — só cor.
- `CustomTooltip` é `<div>` com className → tokenizar: `border-[#1e2130] bg-[#0f1117]` → `border-border bg-popover`; pode usar `.liquid-glass` + `rounded-xl` + `.text-footnote`.

## Vidro (materiais) — só em chrome
- Header app / barras fixas: `bg-background/80 backdrop-blur-xl border-b border-border` ou `.glass-thin`.
- Popovers/menus/tooltips: `bg-popover` ou `.liquid-glass`.
- Header sticky de tabela: `.glass-thin`. Sidebar: `bg-sidebar` (sólido, perf).

## Movimento (Framer Motion) — quando adicionar
- Mola: `{ type: "spring", stiffness: 300, damping: 30 }`; modal `stiffness: 400, damping: 40`.
- Sempre `useReducedMotion()`. Hover card `scale 1.01` 150ms; press `scale 0.98`.

## Verificação por bloco
1. `tsc --noEmit` OK.
2. `git diff -U0` filtrado: nenhuma linha não-visual alterada.
3. Build periódico (Tailwind compila).
4. Checklist Regra de Ouro: "mesmas ações, mesmos resultados, mesma ordem".
