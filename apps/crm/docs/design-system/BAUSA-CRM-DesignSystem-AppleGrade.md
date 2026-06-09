# BAUSA ENGINE — DESIGN SYSTEM APPLE-GRADE
### Referência técnica para auditoria e padronização visual do CRM (`apps/crm`)
**Stack-alvo:** Tailwind CSS v4 (CSS-first) · shadcn/ui · Radix · CVA/clsx/tailwind-merge · Framer Motion · @dnd-kit · Lucide · Recharts 3
**Fonte da verdade dos tokens:** `globals.css` (este pacote)
**Regra de ouro:** este documento altera **apenas a camada de apresentação**. Nenhuma regra de negócio, fluxo, validação ou contrato de dados é modificado.

---

## 0. Como o engenheiro deve usar este documento

1. Substituir/expandir o `globals.css` pelo arquivo fornecido (mantendo `class="dark"` no `<html>`).
2. Reescrever os componentes shadcn (`button`, `card`, `dialog`, `input`, `select`, `tabs`, `switch`, `tooltip`, `badge`, `popover`) para consumir **somente tokens** — zero hex solto.
3. Auditar tela por tela conforme a Seção 9, aplicando as specs de componente da Seção 6.
4. Nunca trocar a ordem/efeito de uma ação. Só a aparência.

---

## 1. Fundamentos da Apple (a filosofia, não a decoração)

A Apple não é "cantos arredondados e blur". São quatro princípios da Human Interface Guidelines que ditam cada decisão:

- **Clareza** — o conteúdo é o herói. Tipografia legível, hierarquia inequívoca, cor com propósito.
- **Deferência** — a interface recua para o conteúdo subir. Cromia sóbria, fundos neutros, cor reservada para ação e status.
- **Profundidade** — camadas e materiais comunicam relação e contexto (de onde vim, para onde vou).
- **Consistência** — o mesmo elemento se parece e se comporta igual em todo lugar.

No dark mode, a Apple **eleva por luminância de superfície, não por sombra pesada**: preto base, superfícies mais claras conforme sobem na hierarquia.

---

## 2. Cores — sistema oficial Apple (sRGB)

### 2.1 Paleta de sistema

| Cor | Claro | Escuro |
|---|---|---|
| Red | `#FF3B30` | `#FF453A` |
| Orange | `#FF9500` | `#FF9F0A` |
| Yellow | `#FFCC00` | `#FFD60A` |
| Green | `#34C759` | `#30D158` |
| Mint | `#00C7BE` | `#63E6E2` |
| Teal | `#30B0C7` | `#40C8E0` |
| Cyan | `#32ADE6` | `#64D2FF` |
| Blue (tint) | `#007AFF` | `#0A84FF` |
| Indigo | `#5856D6` | `#5E5CE6` |
| Purple | `#AF52DE` | `#BF5AF2` |
| Pink | `#FF2D55` | `#FF375F` |
| Brown | `#A2845E` | `#AC8E68` |

### 2.2 Neutros / superfícies

| Token | Claro | Escuro |
|---|---|---|
| Fundo base | `#F2F2F7` | `#000000` |
| Card / superfície | `#FFFFFF` | `#1C1C1E` |
| Superfície elevada | `#FFFFFF` | `#2C2C2E` |
| Borda / separador opaco | `#D1D1D6` | `#38383A` |
| systemGray | `#8E8E93` | `#8E8E93` |

### 2.3 Hierarquia de texto (label) — **use alpha, não cinzas chapados**

| Nível | Claro | Escuro |
|---|---|---|
| Primário | `#000000` | `#FFFFFF` |
| Secundário | `rgba(60,60,67,.60)` | `rgba(235,235,245,.60)` |
| Terciário | `rgba(60,60,67,.30)` | `rgba(235,235,245,.30)` |
| Quaternário | `rgba(60,60,67,.18)` | `rgba(235,235,245,.16)` |

Esse alpha é o que faz o texto secundário da Apple "respirar" sobre qualquer fundo. Não substitua por `#888`.

### 2.4 Cores de domínio BAU (preservadas, harmonizadas à família Apple)

| Significado | Antes | Agora (claro / escuro) | Observação |
|---|---|---|---|
| Lead **Hot** | `#22c55e` | `#34C759` / `#30D158` | systemGreen |
| Lead **Warm** | `#f59e0b` | `#FF9500` / `#FF9F0A` | systemOrange |
| Lead **Cold** | `#3b82f6` | `#007AFF` / `#0A84FF` | systemBlue |
| Plano **Legacy** | purple-400 | `#AF52DE` / `#BF5AF2` | systemPurple |
| Plano **Journey** | blue-400 | `#5856D6` / `#5E5CE6` | **systemIndigo** — movido p/ não colidir com Cold |
| Plano **Start** | zinc-400 | `#8E8E93` / `#98989F` | systemGray |

> **Decisão a validar:** Journey e Cold eram ambos azuis. Mantive Journey em indigo (mesma família, distinguível). Se você preferir manter Journey azul, diferencie por tratamento (badge **preenchido** vs **contornado**) em vez de cor.

### 2.5 Regra de "tinted fill" (badges de status — o jeito Apple)

Status não usa cor 100% no fundo. Usa **cor a ~15% + texto na cor cheia**:

```css
.badge-hot {
  background: color-mix(in srgb, var(--lead-hot) 15%, transparent);
  color: var(--lead-hot);
}
```
No dark, suba o texto para a variante mais clara (já está nos tokens) para manter contraste AA.

---

## 3. Tipografia — escala iOS (SF Pro)

Fonte: stack de sistema (`-apple-system…`) com **Inter** como fallback. O SF Pro renderiza nativamente em Safari/dispositivos Apple; Inter cobre o resto com métrica quase idêntica. **Não auto-hospede SF Pro em web** (licença Apple).

| Estilo | Tamanho | Entrelinha | Peso | Tracking | Classe |
|---|---|---|---|---|---|
| Large Title | 34px | 41px | 700 | −0.022em | `.text-large-title` |
| Title 1 | 28px | 34px | 700 | −0.020em | `.text-title-1` |
| Title 2 | 22px | 28px | 700 | −0.016em | `.text-title-2` |
| Title 3 | 20px | 25px | 600 | −0.012em | `.text-title-3` |
| Headline | 17px | 22px | 600 | −0.024em | `.text-headline` |
| Body | 17px | 22px | 400 | −0.024em | `.text-body` |
| Callout | 16px | 21px | 400 | −0.019em | `.text-callout` |
| Subhead | 15px | 20px | 400 | −0.015em | `.text-subhead` |
| Footnote | 13px | 18px | 400 | −0.006em | `.text-footnote` |
| Caption 1 | 12px | 16px | 400 | 0 | `.text-caption-1` |
| Caption 2 | 11px | 13px | 500 | +0.006em | `.text-caption-2` |

O tracking negativo crescente nos títulos é a assinatura óptica do SF. É o detalhe que separa "parece Apple" de "parece genérico".

> **Densidade desktop (CRM):** a escala acima é a canônica do iOS (toque). Num CRM de desktop, considere descer **um passo** o corpo de leitura (Body → 15px, base de tabela → 13–14px) mantendo a mesma hierarquia. Decida e aplique de forma consistente — não misture.

---

## 4. Raios de canto (cantos contínuos)

A Apple usa **curvatura contínua (squircle/superelipse)**, não o arco simples do `border-radius`. Escala:

| Token | Valor | Uso |
|---|---|---|
| `--radius-xs` | 6px | tags, chips pequenos |
| `--radius-sm` | 8px | controles pequenos, segmented |
| `--radius-md` | 10px | **inputs, botões (default)** |
| `--radius-lg` | 12px | cards |
| `--radius-xl` | 16px | cards grandes, sheets |
| `--radius-2xl` | 20px | **modais/dialogs** |
| full / 9999 | — | switches, pills, avatares |

**Como obter o squircle real:** o `globals.css` aplica `corner-shape: superellipse()` via progressive enhancement (Chromium recente). Onde não houver suporte, cai para `border-radius` normal. Para fidelidade total e cross-browser em cards/modais-chave, considere a lib `figma-squircle` / `@squircle-js/react` apenas nesses pontos — **sem alterar lógica**, só o wrapper visual.

---

## 5. Layout, espaçamento e alvos de toque

- **Grade base 8pt**, com 4pt para ajuste fino. Escala: 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- **Alvo interativo mínimo 44×44px** para controles primários (HIG). Em linhas densas de tabela, 36–40px é tolerável, mas o *hit area* clicável deve chegar a 44.
- Respiro generoso. Margem de conteúdo consistente. Ritmo vertical previsível em listas e formulários.
- Headers fixos e sidebars: candidatos naturais a material de vidro (Seção 7).

---

## 6. Specs de componente (shadcn + Radix)

Todos consomem tokens. Estados obrigatórios em **todo** interativo: default, hover, focus-visible (anel `--ring` 2px, offset 2px), active, disabled, loading. Listas/tabelas/kanban exigem estados **vazio** e **carregando** desenhados.

**Button**
- Primary: `bg-primary text-primary-foreground`, radius 10px, altura 36–44px, padding 16px H. Hover: −8% luminância; active: −12% + `scale(0.98)`.
- Secondary (tinted): `bg-secondary text-foreground`. Plain/text: sem fundo, `text-primary`. Destructive: `bg-destructive`.
- Transição 150ms `--ease-standard`.

**Input / Select / Textarea**
- `bg-card` (claro) / fill no dark, borda `--input`, radius 10px, altura 36–44px, padding 12px.
- Foco: borda `--ring` + anel 2px. Placeholder `--placeholder`. Erro: borda `--destructive` + texto de ajuda `--destructive`.

**Card**
- `bg-card`, radius 12–16px, borda `1px var(--border)` + `--shadow-sm`. Padding interno 16–24px. No dark, separa por luminância (não por sombra forte).

**Dialog / Modal (Radix Dialog)**
- Painel radius 20px, `--shadow-xl`. Overlay `rgba(0,0,0,.4)` com `backdrop-filter: blur(2px)`.
- Entrada: fade + `scale 0.96→1` em 250ms `--ease-out`. Conteúdo do painel pode usar `bg-popover`; barras internas podem usar `.glass-regular`.

**Tabs / Segmented control**
- Trilho pill (radius full) `bg-secondary`; *thumb* ativo `bg-card` + `--shadow-xs`, deslizando com Framer Motion `layoutId`.

**Switch (Radix)**
- Pill full. Ligado = `--sys-green`. Thumb branco com `--shadow-xs`. Transição 200ms.

**Tooltip / Popover / Dropdown**
- `.liquid-glass` ou `bg-popover`, radius 12–13px, `--shadow-lg`. Texto `.text-footnote`.

**Badge / Pill de status**
- Tinted fill (Seção 2.5). `.text-caption-1` semibold. Radius full ou 6px.

**Tabela / Lista**
- Linha: separador inferior `--separator`. Hover: `--fill-4`. Selecionado: `color-mix(primary 12%)`. Header sticky com `.glass-thin`.

**Kanban do Pipeline (@dnd-kit + Framer Motion)** — *atenção máxima: só visual*
- Card: `bg-card`, radius 12px, borda sutil, `--shadow-sm`. Faixa/indicador de lead na cor `--lead-*`.
- Em arraste: `--shadow-lg` + `scale(1.02)` + leve rotação opcional (≤2°). Drop zone: `--fill-3`.
- **Não** alterar a lógica de DnD, ordenação, persistência ou os handlers do @dnd-kit. Apenas classes/estilos do card e dos slots.

**Recharts (War Room / Analytics)**
- Séries: `--chart-1..5`. Grid/eixos: `--chart-grid`. Tooltip: `.liquid-glass` + radius 12px + `.text-footnote`.
- Funil/barras/pizza herdam a paleta de sistema — coerência com o resto do CRM.

---

## 7. Materiais / Liquid Glass

Quatro intensidades + utilitário assinatura, já no `globals.css`:

| Classe | Blur | Uso |
|---|---|---|
| `.glass-thin` | 12px | header de tabela sticky, divisores translúcidos |
| `.glass-regular` | 24px | sidebar translúcida, popovers, barras |
| `.glass-thick` | 40px | overlays sobre conteúdo denso |
| `.liquid-glass` | 24px + brilho especular | cartões/menus de destaque |

Regras: garanta **contraste AA do texto** sobre o vidro; use vidro como **acabamento de profundidade**, não em tudo; respeite `prefers-reduced-transparency` (fallback sólido já incluído); cuidado com custo de `backdrop-filter` em listas longas — prefira aplicar em elementos fixos/poucos.

---

## 8. Movimento (Framer Motion)

Sensação Apple = **mola rápida e natural**, não easings longos.

```ts
export const spring     = { type: "spring", stiffness: 300, damping: 30, mass: 1 };
export const springModal= { type: "spring", stiffness: 400, damping: 40 };
export const easeOut     = [0.16, 1, 0.3, 1] as const;

// duracões: micro 150ms · padrão 250ms · grande 350ms
```
- Abrir modal/sheet: `opacity 0→1`, `scale 0.96→1`, `springModal`.
- Hover de card: `scale 1.01`, 150ms. Active/press: `scale 0.98`.
- Thumb de tabs/segmented: `layoutId` + `spring`.
- **Sempre** respeitar `prefers-reduced-motion` (já tratado no CSS; espelhe em variantes do Framer com `useReducedMotion()`).

---

## 9. Mapa de auditoria — tela por tela (BAUSA Engine)

Para cada item: **inventário → diagnóstico → proposta (linkada a este doc) → confirmação de escopo → aplicar → verificar fluxo idêntico.**

- **Sidebar / navegação** → `.glass-regular` ou `bg-sidebar`; itens com `--fill-4` no hover, `primary` no ativo; ícones Lucide peso/escala consistentes.
- **Dashboard / War Room** → cards de métrica padronizados (Seção 6 Card); Recharts na paleta `--chart-*`; tooltips de vidro.
- **Pipeline Kanban** → cards e colunas repadronizados; faixa de lead em `--lead-*`; estados de arraste/drop visuais. **Lógica DnD intocada.**
- **Tabelas de leads/atletas** → linhas, hover, seleção, header sticky de vidro; badges de status com tinted fill.
- **Modais** (cadastro, contrato, edição) → radius 20px, overlay blur, animação de mola; inputs/selects padronizados; estados de erro/loading.
- **Formulários / onboarding** → ritmo vertical 8pt, hierarquia de label por alpha, foco acessível, mensagens de erro consistentes.
- **Analytics / metas financeiras** → gráficos e legendas na paleta de sistema; números em `.text-title-*`; rótulos em `.text-footnote`.
- **Selects, switches, tabs, tooltips** (Radix) → re-skin via tokens; nenhum comportamento alterado.

Ao fim de cada bloco: resumo do que mudou **visualmente** + checklist da Regra de Ouro confirmado ("mesmas ações, mesmos resultados, mesma ordem").

---

## 10. Checklist anti-"cara de IA/genérico"

- [ ] Zero hex solto nos componentes — tudo via token.
- [ ] Texto secundário usa **alpha** (label hierarchy), não cinza chapado.
- [ ] Sombras de baixa opacidade; no dark, eleva por luminância.
- [ ] Tracking negativo nos títulos aplicado.
- [ ] Raios coerentes por categoria (input 10 / card 12–16 / modal 20).
- [ ] Ícones Lucide com peso e tamanho consistentes; sem misturar estilos; sem emoji como ícone.
- [ ] Vidro só onde agrega profundidade; contraste AA preservado.
- [ ] Estados vazio/carregando/erro desenhados em todas as telas de dados.
- [ ] `prefers-reduced-motion` e `prefers-reduced-transparency` respeitados.
- [ ] Nenhuma regra de funcionamento alterada.
