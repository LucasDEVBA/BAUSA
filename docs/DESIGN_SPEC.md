# BAUSA Engine — Spec de Redesign Visual (Spec-Driven Development)

> **Status:** fonte da verdade do overhaul visual do CRM (`apps/crm`).
> **Método:** Spec-Driven Development — este documento é o contrato. Implementa-se
> **contra o spec**, fase por fase; cada fase só fecha quando passa nos **critérios
> de aceite** (§10) e na **verificação anti-regressão** (§11).
> **Regra de ouro:** só **apresentação** muda. Nada de funcionalidade, rota, dado,
> lógica ou props sem justificativa. **Nunca** inventar dado/UI falsa (§8).

---

## 0. Como usar este spec (SDD)

1. Leia §1–§4 (objetivo, princípios, identidade, linguagem) — o "porquê" e o "quê".
2. Para cada componente/tela, o §6/§7 dá **anatomia + estados + tokens + aceite**.
3. Implemente **uma fase por vez** (§12). Cada fase = 1 branch → 1 PR → verificação → merge UAT → validação → PRD.
4. Antes de abrir PR: rode a **verificação** (§11) e marque o **Definition of Done** (§10) daquela superfície.
5. Este arquivo é vivo: se um token/decisão mudar, **atualize aqui primeiro**, depois o código.

---

## 1. Objetivo e escopo

**Objetivo:** levar o BAUSA Engine a um sistema visual **coeso, moderno e 100% na
identidade BAU**, na linguagem de dashboard da referência aprovada (cards limpos,
métricas com delta, charts com gradiente, abas segmentadas, sidebar seccionada).

**No escopo:** design tokens; primitivos (Card, Button, Badge, Input, Tabs);
chrome (Sidebar, Header); dashboard/War Room; charts (wrapper + gradientes +
seletor de período); tabelas; modais/sheets; empty/loading/skeleton states;
paridade **light/dark**; acessibilidade.

**Fora do escopo (non-goals):** mudar rotas, dados, queries, regras de negócio,
auth (`requirePapel`), automações. **Não** criar features novas para imitar a
referência (ver §8). **Não** habilitar `strict:false` nem introduzir `any`.

---

## 2. Princípios de engenharia (sênior)

- **Regression-safe by default.** Só muda `className`/estilo/markup de apresentação.
  Handlers, hooks, validações, `@dnd-kit`, Radix, `aria-*`/`role`/`data-*` intactos.
- **Token-first.** Zero cor/spacing/radius hardcoded em componente. Tudo via tokens
  (§5). Se faltar token, **crie o token** em `globals.css`, não um valor solto.
- **Brand-faithful.** Azul BAU é o primário; bordô e dourado têm papéis definidos (§3).
- **A11y não-negociável.** WCAG 2.1 AA: contraste, foco visível, navegação por
  teclado, `prefers-reduced-motion`, zoom 200% sem quebra.
- **Light + dark em paridade.** Toda decisão vale nos dois temas.
- **Integridade de dado.** Sem números/estados/percentuais inventados (§8).
- **DRY.** Um primitivo por conceito (um `Card`, um `Button`, um `Tabs`), reusado.
- **TS strict, sem `any`.** Tipos Recharts com type guards numéricos.

---

## 3. Identidade visual BAU (extraída do logo)

O wordmark **BAU** é azul-royal com a águia e um acento bordô. Três cores de marca:

| Token | Light | Dark | Papel |
|---|---|---|---|
| `--bau-blue` | `#25499f` | `#4a6fd0` | **Primário.** Ações, seleção, links, foco, aba ativa, série principal de chart. **Já é o `--primary`.** |
| `--bau-burgundy` | `#8e1824` | `#c0303c` | **Acento/ênfase.** Destaque executivo, 2ª série de chart (contraste), realces pontuais, gradiente de marca. |
| `--bau-gold` | `#9a7010` | `#c79a3a` | **Terciário.** Badges/《premium》, marcadores especiais. Uso raro. |

**Cores semânticas** (status — **não** são marca, não trocar): `sys-green`
(sucesso/positivo), `sys-orange` (atenção), `sys-red` (crítico/negativo),
`sys-blue` (info), `sys-purple` (destaque neutro).

### Regras de uso da marca (o que faltou aplicar)

1. **Primário = azul BAU sempre.** Qualquer "ação/seleção/ativo" usa `primary`
   (= `bau-blue`). Proibido systemBlue (`#007aff`) ou azul aleatório.
2. **Bordô é acento, não base.** Use `bau-burgundy` para **ênfase pontual**
   (KPIs executivos do War Room, 2ª série de chart, selo de plano Legacy, hover
   de destaque). Nunca como cor de texto de corpo nem fundo de área grande.
3. **Dourado é raro.** Só selos/《premium》.
4. **Gradiente de marca** `linear-gradient(135deg, bau-blue → bau-burgundy)`:
   permitido em **hero/faixa de destaque e avatar**, **nunca** atrás de texto de leitura.
5. **Contraste:** texto sobre `bau-blue`/`bau-burgundy` = branco (AA ok). Nunca
   texto bordô sobre azul ou vice-versa.
6. **Charts:** série 1 = `bau-blue`; série 2 = `bau-burgundy`; série 3 = `sys-purple`.
   Gradiente de área = cor da série → transparente (opacidade 0.25 → 0).

---

## 4. Linguagem visual da referência (o alvo, traduzido)

> Traduzido para princípios reutilizáveis — a implementação é original, em tokens BAU.

- **Superfícies:** cartões de fundo `card`, borda 1px sutil, **radius 12–16px**,
  sombra leve de elevação, **padding generoso** (16–20px). Respiro entre widgets (gap 16px).
- **Métrica (KPI):** título `muted` (sm) → **número grande** (2xl/3xl, `tabular-nums`)
  → **delta em badge** (seta ▲/▼ + `%` em pílula verde/vermelha) → contexto `muted` (xs).
- **Chart card:** header com título + **seletor de período segmentado** (1D·1W·1M·6M·1Y·ALL)
  → área/linha com **gradiente** suave, grid pontilhado leve, eixo `muted`, **tooltip
  escuro arredondado**. Card de forecast = histórico + projeção (faixa de confiança).
- **Abas:** **segmented** (pílula ativa elevada num trilho) p/ 2–4 abas;
  **underline** p/ muitas abas. Acento = `bau-blue`. (Já existe `BrandTabs`.)
- **Sidebar:** header de workspace (logo + nome/subtítulo) → nav ícone+label com
  **item ativo destacado** (fundo `primary/12` + barra de acento) → **seções com
  marcador de cor** → footer de perfil (avatar + nome + papel). Colapsável.
- **Header de conteúdo:** título grande + ações à direita (botões primário sólido +
  outline). *(Ações "Ask AI"/"Customize" — ver §8.)*
- **Botões:** primário sólido `bau-blue` texto branco; secundário outline; ghost.
  Radius 8–10px, altura 32–36px, `font-medium`.
- **Barra de status multicolor** (ex.: Leads por etapa): segmentos proporcionais
  com cores semânticas + legenda em cards.
- **Densidade:** confortável; hierarquia por tamanho/peso, não por caixa pesada.

---

## 5. Design tokens (spec de valores)

Fonte: `apps/crm/src/app/globals.css` (`:root` = light, `.dark` = dark, `@theme inline`
expõe utilitários Tailwind v4). **Toda cor nova entra aqui como token.**

### 5.1 Cor (o que garantir)
- `--primary` = `--bau-blue` (**já aplicado**: `#25499f` / `#4a6fd0`).
- `--bau-blue|burgundy|gold` (§3) — expostos como `bg-/text-/border-bau-*`.
- Superfícies: `--background`, `--card`, `--popover`, `--secondary`, `--muted`,
  `--sidebar`, `--border`, `--input`, `--ring` (= `primary`).
- Texto: `--foreground`, `--muted-foreground`, `--label-tertiary`.
- Semânticos: `--sys-green|orange|red|blue|purple|yellow`.
- Lead/plano: `--lead-hot|warm|cold`, `--plan-legacy|journey|start`.
- **Gradientes de marca (novos):** `--gradient-brand: linear-gradient(135deg, var(--bau-blue), var(--bau-burgundy))`.

### 5.2 Tipografia
- Família: **Inter** (já configurada). `tabular-nums` em todo número/métrica.
- Escala: `text-title-2` (headings de página), `text-sm` (corpo), `text-xs`/`[11px]`
  (contexto), `[10px]` (labels/eyebrow). Pesos: 400/500/600/700.

### 5.3 Espaçamento, radius, sombra, motion
- **Spacing:** grid base 4px. Padding de card 14–20px; gap de grid 12–16px.
- **Radius:** `--radius` base; cards `rounded-xl` (12) a `rounded-2xl` (16);
  pílulas/badges `rounded-full`; botões/inputs `rounded-lg` (8–10).
- **Sombra:** elevação leve (`shadow-sm`) em card; `shadow-md` em hover; sombra
  maior só em popover/modal.
- **Motion:** `transition-colors`/`transition-all` 150–250ms, easing padrão;
  respeitar `prefers-reduced-motion` (sem animação de layout).

### 5.4 Regra de migração
- Qualquer `#hex`, `rgb()`, systemBlue ou cor solta em `.tsx` → **substituir por token**.
  Auditar com: `grep -rnE "#[0-9a-fA-F]{6}|#007aff|rgb\(" apps/crm/src/components apps/crm/src/app`.

---

## 6. Specs de componentes (anatomia · estados · tokens · aceite)

> Formato por componente. **AC** = Acceptance Criteria (verificável).

### 6.1 `Card` (primitivo base — criar/consolidar)
- **Anatomia:** container `bg-card border border-border rounded-xl shadow-sm`,
  padding `p-4`/`p-5`; slots opcionais header/footer.
- **Estados:** default; `hover:shadow-md` quando clicável; `focus-visible:ring-2 ring-ring`.
- **Variantes:** `glass` (usa `.glass-card`), `plain`.
- **AC:** todos os cards do app usam este primitivo (sem `bg-[#...]` solto); radius e
  sombra consistentes; light/dark ok.

### 6.2 `MetricCard` (✅ já no padrão — manter como referência)
- Título `muted` → valor `xl tabular-nums` → **badge de delta** (▲/▼ `%`, verde/vermelho)
  → contexto `label-tertiary`. Ícone 8×8 sutil. Variantes `default|hot|warm|cold|purple`.
- **AC:** delta sempre em badge; número em destaque; sem trend em texto solto.

### 6.3 `Button` (auditar/padronizar)
- **Variantes:** `primary` (`bg-primary text-primary-foreground hover:bg-primary/90`),
  `secondary` (outline `border-border bg-card hover:bg-accent`), `ghost`,
  `destructive` (`sys-red`). Tamanhos `sm`/`md`. `rounded-lg`, `font-medium`, `gap-1.5`.
- **AC:** um só componente de botão; foco visível; primário = azul BAU.

### 6.4 `Badge` / `Pill`
- Tinted fill: `bg-{cor}/15 text-{cor} border border-{cor}/20`, `rounded-full`,
  `text-[11px] font-semibold`. Cores por semântica (status) ou marca (destaque).
- **AC:** deltas, status e contadores usam este padrão.

### 6.5 `BrandTabs` (✅ já existe — usar em 100% das telas com abas)
- `segmented` (2–4 abas) e `underline` (muitas). Ativo = `bau-blue`. Por rota (`href`)
  ou estado (`onSelect`). **AC:** nenhuma tela com abas usa markup ad-hoc; todas via `BrandTabs`.

### 6.6 `ChartCard` + charts (criar wrapper)
- **`ChartCard`:** header (título + `PeriodSelector` opcional) + área do gráfico + legenda.
- **Charts (Recharts):** `<defs><linearGradient>` cor-da-série→transparente;
  `<Area>`/`<Line>` com `stroke` = série; grid `strokeDasharray` leve; eixos `muted`;
  **tooltip custom** escuro `rounded-lg border border-border bg-popover`.
- Séries: 1=`bau-blue`, 2=`bau-burgundy`, 3=`sys-purple`.
- **AC:** todo chart tem gradiente + tooltip custom + eixos tokenizados; sem cores hex soltas.

### 6.7 `PeriodSelector`
- Segmented control (1D·1W·1M·6M·1Y·ALL). **Só implementar onde os dados suportam
  janela temporal real** (§8). Ativo = `bau-blue`.
- **AC:** botões inertes proibidos — cada opção filtra dado real, ou o seletor não existe.

### 6.8 `Sidebar`
- Header workspace (logo BAU + "BAUSA Engine"/subtítulo). Nav ícone+label; item ativo
  = `bg-primary/12` + barra de acento `bau-blue`. **Seções com marcador de cor de marca**
  (✅ já aplicado). Footer perfil. Colapsável (persistido). Sem widget de storage falso (§8).
- **AC:** ativo em `bau-blue`; seções com marcador; paridade colapsado/expandido; a11y do toggle.

### 6.9 `Header` (barra de conteúdo)
- Breadcrumb/título + ações à direita + avatar. Botões via `Button`. Sticky, `backdrop-blur`.
- **AC:** sem ações falsas; título consistente por rota (`BREADCRUMB_MAP`).

### 6.10 `Table`
- Header `text-muted-foreground` uppercase xs; linhas com `hover:bg-accent`; zebra opcional
  sutil; densidade confortável; estados de ordenação com ícone. Badges de status via §6.4.
- **AC:** tabelas (Leads, Financeiro, etc.) com o mesmo estilo tokenizado.

### 6.11 `Modal`/`Sheet` (Radix)
- Superfície `.liquid-glass`/`bg-popover`, `rounded-2xl`, overlay `bg-black/40 backdrop-blur-sm`,
  foco preso, `Esc`/click-out (comportamento Radix intacto). Header + body + footer de ações.
- **AC:** comportamento Radix não alterado; só estilo; a11y de foco mantida.

### 6.12 Estados vazios / loading / erro
- **Empty:** ícone `muted`, título, subtítulo, CTA opcional. **Loading:** skeleton
  (`bg-secondary animate-pulse rounded`). **Erro:** mensagem clara + retry quando aplicável.
- **AC:** listas/telas têm empty e skeleton coerentes (nada de tela em branco/spinner cru).

---

## 7. Specs de tela (layout)

- **Grid de dashboard:** faixa de KPIs (`MetricCard`) no topo → `ChartCard` de receita
  (largura maior) → blocos secundários (funil, risco, famílias) em grid 2–3 col.
  Responsivo: 1 col (mobile) → 2 (md) → 3 (lg+). Gap 16px.
- **War Room:** mantém a estrutura de abas (`BrandTabs` underline). Visão Geral =
  faixa de metas + KPI strip + drill cards + operacional + alertas (todos tokenizados).
- **Telas com sub-telas:** sempre `BrandTabs` (segmented) no topo.
- **Densidade/ordem:** informação mais acionável no topo-esquerda; detalhe abaixo.

---

## 8. Integridade — features que a referência tem e o BAUSA não

**Regra:** nunca renderizar dado/estado/percentual **inventado**. Para cada item, a
decisão é **(a) implementar de verdade** ou **(b) omitir** — nunca fake.

| Elemento da referência | BAUSA tem? | Decisão default |
|---|---|---|
| **Cloud Storage 90%** | ❌ sem quota por usuário | **Omitir** (ou substituir por widget real: ex. "safra atual"/atalho) |
| **Múltiplos workspaces** (switcher) | ❌ single-tenant | **Omitir** — manter header BAU único |
| **Ask AI** (chat) | ❌ sem chat (só Gemini de qualificação) | **Omitir** — ou implementar de verdade em fase própria |
| **Customize Widget** | ❌ sem dashboard configurável | **Omitir** — ou implementar persistência real |
| **Seletor de período nos charts** | ⚠️ parcial | Só onde a query aceita janela; senão **omitir** |
| **Delta "vs last week/month"** | ✅ há métricas com trend | **Usar** dado real (não hardcode) |

Qualquer decisão de "implementar de verdade" vira **feature à parte** (fora deste spec visual).

---

## 9. Acessibilidade e responsividade

- **Contraste:** AA (4.5:1 texto normal, 3:1 grande). Validar azul/bordô com branco.
- **Foco:** `focus-visible:ring-2 ring-ring ring-offset-2` em todo interativo.
- **Teclado:** tabs/roles corretos (`role="tablist/tab"`, `aria-selected`), navegação
  por Tab/Setas onde aplicável, foco preso em modal.
- **Reduced motion:** sem animação de layout/entrada quando `prefers-reduced-motion`.
- **Mobile-first:** breakpoints `sm/md/lg`; sidebar colapsa; grids reflow; zoom 200% ok.
- **Imagens/ícones:** `alt` significativo; ícones decorativos `aria-hidden`.

---

## 10. Definition of Done (por superfície)

Uma superfície só fecha quando **todos**:
- [ ] Zero cor/spacing/radius hardcoded — tudo em token (§5.4 grep limpo).
- [ ] Primário/ativo/seleção em **`bau-blue`**; bordô/dourado só como acento (§3).
- [ ] Componentes via primitivos (`Card`, `Button`, `Badge`, `BrandTabs`, `ChartCard`).
- [ ] Light **e** dark verificados (contraste + legibilidade).
- [ ] A11y: foco, contraste, teclado, reduced-motion.
- [ ] Responsivo (mobile→desktop) sem quebra a 200%.
- [ ] Sem UI/dado falso (§8).
- [ ] Nenhuma mudança de rota/dado/lógica/prop injustificada.

---

## 11. Anti-regressão e verificação

**Golden Rule:** diff só toca apresentação. Checar:
```bash
# só className/estilo/markup — nenhum handler/hook/validação/aria removido
git diff --stat
```
**Gates (todos verdes antes do PR):**
```bash
cd apps/crm
npx tsc --noEmit          # 0 erros, sem any
npx next build            # compila (server/client boundary correto)
npx eslint <arquivos>     # 0 erros (warnings pré-existentes em arquivos não-tocados = ok)
grep -rnE "#[0-9a-fA-F]{6}|#007aff|rgb\(" src/components src/app   # deve tender a vazio
```
**QA visual:** cada tela em **light e dark**, mobile e desktop, zoom 200%.
**Escopo preservado:** rotas, `requirePapel`, queries, `@dnd-kit`/Radix, dados — intactos.
**Skill obrigatória:** seguir `.claude/skills/bausa-crm-page` (Server+Client, sem `any`,
`revalidatePath`, etc.).

---

## 12. Plano faseado (SDD — um PR por fase, UAT→PRD)

| Fase | Entregável | Verificação |
|---|---|---|
| **0 · Tokens** | Auditar/consolidar tokens (§5); `--gradient-brand`; garantir `primary=bau-blue`; remover hex soltos em primitivos | grep de hex limpo nos primitivos |
| **1 · Primitivos** | `Card`, `Button`, `Badge`, `Input`, (`BrandTabs` ✅), `Skeleton`/`EmptyState` — padronizados e reusáveis | tsc/build/lint; um primitivo por conceito |
| **2 · Chrome** | `Sidebar` + `Header` 100% no spec (ativo bau-blue, seções, perfil; sem storage/switcher falso) | QA light/dark; a11y toggle |
| **3 · Charts** | `ChartCard` + gradientes + tooltip custom + `PeriodSelector` (só onde há dado); séries bau-blue/burgundy/purple | sem hex nos charts; tooltip tokenizado |
| **4 · Dashboards/telas** | Dashboard, War Room, Analytics, Leads, Famílias, Financeiro, Escolas, Matching no grid/estilo do spec (§7) | DoD por tela (§10) |
| **5 · Tabelas/Modais/Estados** | `Table`, `Modal/Sheet`, empty/loading/erro tokenizados | Radix intacto; a11y foco |
| **6 · QA final** | Varredura light/dark/mobile/200%; grep de hex; auditoria de contraste; checklist §10 em todas as telas | tudo verde + validação UAT |

Cada fase: `feat/redesign-fN-*` → PR → CI/verify → merge develop (UAT) → **você valida** → promove.

---

## 13. Prompt de execução (colar para rodar o spec)

```text
Você é um time sênior de engenharia de software + design (15+ anos). Vai executar o
overhaul visual do BAUSA Engine (apps/crm) SEGUINDO ESTRITAMENTE docs/DESIGN_SPEC.md
como fonte da verdade (Spec-Driven Development).

CONTEXTO
- Monorepo pnpm/Turborepo; app: apps/crm (Next.js 16 App Router, React 19, TS strict
  SEM any, Tailwind v4 com tokens em src/app/globals.css, Recharts, Radix, sonner).
- Identidade BAU (do logo): azul #25499f/#4a6fd0 (=primary), bordô #8e1824/#c0303c,
  dourado #9a7010/#c79a3a. Papéis e regras em DESIGN_SPEC §3.
- Já existe: BrandTabs (§6.5), MetricCard no padrão (§6.2), primary já = bau-blue.

REGRAS INEGOCIÁVEIS
1. Só APRESENTAÇÃO muda. Nunca handlers/hooks/validações/rotas/queries/props/@dnd-kit/
   Radix/aria/role/data-*. (Golden Rule, §11.)
2. TOKEN-FIRST: zero cor/spacing/radius hardcoded; se faltar token, criar em globals.css.
   Auditar com o grep do §5.4/§11 até tender a vazio.
3. IDENTIDADE: primário/ativo/seleção SEMPRE bau-blue; bordô = acento pontual; dourado raro (§3).
4. INTEGRIDADE: nunca inventar dado/UI falsa. Elementos sem função real (Ask AI,
   Customize Widget, Cloud Storage %, multi-workspace, seletor de período sem dado) =
   OMITIR ou implementar de verdade em feature à parte (§8).
5. Light E dark, responsivo, WCAG AA, reduced-motion (§9).
6. TS strict sem any; seguir a skill .claude/skills/bausa-crm-page.

EXECUÇÃO (uma fase por vez — §12)
- Comece pela Fase 0 (tokens) e siga 0→6. Uma branch feat/redesign-fN-* por fase.
- Para cada componente/tela, implemente conforme §6/§7 e feche o Definition of Done (§10).
- Antes de cada PR: rode os gates (§11) — tsc 0, build ok, eslint 0, grep de hex limpo.
  Faça QA visual light/dark/mobile/200%.
- Gitflow: feature → develop (UAT) → validação → main (PRD). Nunca commit direto em
  develop/main. Um PR pequeno e revisável por fase.
- No fim de cada fase, liste: o que mudou, prints/telas afetadas, e o checklist §10 marcado.

ENTREGA
- Comece confirmando a Fase 0 (diff de tokens) e siga. Pare e reporte ao fim de cada fase.
```

---

> **Manutenção:** ao mudar qualquer decisão de design, **edite este spec primeiro**
> (PR de doc), depois implemente. O código segue o spec — nunca o contrário.
