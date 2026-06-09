# HIG → BAUSA ENGINE — RULEBOOK (web-scoped)
### Adaptação acionável das Human Interface Guidelines da Apple para o CRM web

**O que é isto:** uma destilação das HIG em regras práticas, escrita em palavras próprias e **filtrada para um CRM web** (não app nativo). Cobre as 5 seções da HIG — Foundations, Patterns, Components, Inputs, Technologies — marcando o que se aplica e o que **não** se aplica ao seu produto, e por quê.

**Como o agente usa:** este arquivo é a fonte da verdade de *princípios*. Os *valores* (cor, tipo, raio, motion) vêm do `globals.css` e do `BAUSA-CRM-DesignSystem-AppleGrade.md`. Em conflito, vence o que está nos tokens.

**Premissa central (da própria HIG):** num app nativo, você usaria as APIs de cor de sistema. Na web não existem essas APIs — então adotamos a **intenção** (semântica, adaptativa claro/escuro, definida por propósito) via tokens CSS. Não replicamos comportamento nativo; replicamos princípios.

**Regra de ouro:** este documento só orienta a **camada de apresentação**. Nenhuma regra de negócio, fluxo ou contrato de dados muda.

---

# A. FOUNDATIONS

### A1. Accessibility ✅ aplica
- Contraste de texto mínimo **AA**: 4.5:1 (texto normal), 3:1 (texto grande/ícones). Verificar em claro e escuro.
- **Cor nunca é o único sinal.** Status de lead (Hot/Warm/Cold) precisa de cor **+** rótulo/ícone, para daltônicos.
- Foco sempre visível (`:focus-visible`, anel `--ring` 2px, offset 2px). Nunca `outline:none` sem substituto.
- Alvo interativo ≥ **44×44px** (área clicável, mesmo que o visual seja menor).
- Respeitar `prefers-reduced-motion` e `prefers-reduced-transparency` (já no `globals.css`).
- Estados não dependem de hover apenas (precisam funcionar via teclado/foco).

### A2. Color ✅ aplica (núcleo)
- Paleta = cores de sistema Apple, claro/escuro, via tokens. Ver `globals.css`.
- **Não usar a mesma cor para interativo e não interativo** (diretriz explícita da Apple). → O azul é cor de **ação**; o lead **Cold** só aparece como *tinted fill*, nunca azul sólido cheio.
- Cor com propósito: ação, status, alerta. Nada de cor decorativa.
- Hierarquia de texto por **alpha** (label/secondary/tertiary), não cinzas chapados.

### A3. Dark Mode ✅ aplica
- **Elevar por luminância de superfície, não por sombra pesada.** Preto base → superfícies mais claras conforme sobem (#000 → #1C1C1E → #2C2C2E).
- Evitar preto puro em grandes áreas de leitura prolongada se causar *halation*; usar superfícies elevadas para conteúdo.
- Cores de sistema já têm variante dark mais saturada/clara (nos tokens). Não reusar o hex claro no dark.
- Sombras no dark são quase imperceptíveis; a separação vem da cor da superfície + borda sutil.

### A4. Typography ✅ aplica
- Escala SF Pro (ver design doc). Fonte = system stack + Inter (não auto-hospedar SF Pro — licença).
- Hierarquia clara: título / headline / body / caption. Tracking negativo nos títulos.
- **Dynamic Type → na web vira tipografia responsiva/relativa:** usar `rem`, respeitar zoom do usuário, não fixar tudo em `px` absoluto no corpo.
- Tamanho mínimo legível de corpo: não descer abaixo de ~13px em texto de leitura.

### A5. Layout ✅ aplica
- Grade **8pt** (4pt para ajuste fino). Margens e ritmo vertical consistentes.
- "Safe areas" nativas → na web viram **container max-widths + padding de borda consistentes**.
- Alinhamento previsível; agrupar o que é relacionado; respiro generoso (deferência ao conteúdo).
- Responsivo: o CRM deve degradar bem em telas menores (sidebar colapsável, tabelas com scroll).

### A6. Materials ✅ aplica (com parcimônia)
- Vidro (`.glass-*`, `.liquid-glass`) só em **chrome**: headers fixos, sidebar, popovers, modais. Nunca em tudo.
- Garantir contraste AA do texto **sobre** o vidro. Fallback sólido em `prefers-reduced-transparency`.
- Custo de `backdrop-filter` é alto: evitar em listas longas; preferir poucos elementos fixos.

### A7. Motion ✅ aplica
- Movimento **comunica causa→efeito** (abrir modal, deslizar thumb, confirmar). Nunca decorativo.
- Mola rápida (Framer Motion specs no design doc). Micro 150ms / padrão 250ms / grande 350ms.
- Sempre honrar `prefers-reduced-motion` (CSS + `useReducedMotion()` no Framer).

### A8. Icons / SF Symbols ⚠️ adapta
- **SF Symbols não pode ser usado livremente na web** (licença Apple, fora de apps Apple). → manter **Lucide React** como biblioteca única.
- Aplicar os *princípios* do SF Symbols ao Lucide: **peso e tamanho consistentes**, alinhamento óptico com o texto ao lado, escala coerente (não misturar 16px e 24px na mesma linha sem motivo).
- Nunca misturar bibliotecas/estilos de ícone. Nunca emoji como ícone de UI.

### A9. Writing (UI copy) ✅ aplica
- Rótulos claros e diretos. Botões com **verbo de ação** ("Salvar", "Criar lead"), não "OK" genérico.
- *Sentence case* em rótulos e títulos de seção. Mensagens de erro úteis (o que houve + como resolver).
- Consistência de terminologia com o vocabulário BAU.

### Foundations — ❌ NÃO aplica (e por quê)
- **App icons / Branding:** regras de ícone da App Store e marketing de app — irrelevante para web.
- **Immersive experiences / Spatial layout:** visionOS / 3D — fora de escopo.
- **Right to left:** o CRM é PT-BR. Revisitar só se houver localização para árabe/hebraico.
- **Images (@2x/@3x):** lógica de asset nativo; na web use SVG/`srcset` quando relevante (nota técnica, não regra de design).
- **Inclusion:** princípios gerais já cobertos por Accessibility + Writing.

---

# B. PATTERNS

Padrões da HIG que existem no fluxo de um CRM:

### B1. Loading ✅
Skeletons para listas/cards; spinner só para ações pontuais; revelar conteúdo progressivamente. **Toda tela de dados precisa de estado de carregamento desenhado.**

### B2. Empty states ✅
Toda lista/tabela/kanban/coluna precisa de estado vazio: ícone discreto + frase curta + ação primária ("Adicionar primeiro lead"). Nunca tela em branco.

### B3. Entering data / Forms ✅
Validação inline; erro próximo ao campo, em `--destructive`, com texto de ajuda; nunca só borda vermelha. Foco move para o primeiro erro. Botão primário desabilitado/loading durante submit. **Sem alterar a lógica de validação existente — só a apresentação dela.**

### B4. Feedback ✅
Confirmação de sucesso (toast discreto); erro claro; **ações destrutivas exigem confirmação** (dialog) e usam cor destrutiva. Não bloquear a UI sem necessidade.

### B5. Modality ✅
Modal/sheet só para tarefas focadas que exigem decisão antes de continuar. Tarefa leve → inline/popover. Dialog tem botão de cancelar e fecha por Esc/overlay. (Comportamento de abrir/fechar permanece o atual; só o visual muda.)

### B6. Searching ✅
Campo de busca com ícone Lucide à esquerda, placeholder claro, limpar (×) quando há texto, estado "sem resultados" desenhado.

### B7. Onboarding ✅
O onboarding de famílias deve ser progressivo, com sensação de progresso e linguagem de acolhimento. Aplicar hierarquia tipográfica e respiro; não sobrecarregar uma tela.

### B8. Settings / Managing account ✅
Agrupamento em seções (estilo *grouped list* da Apple): cards com cabeçalho de seção, separadores entre itens, toggles à direita.

### Patterns — ❌ NÃO aplica
Launching, Multitasking, Live Activities, Widgets, App Clips, Apple Pay, In-app purchase, Ratings & reviews, Notifications nativas, Drag-and-drop **entre apps** (o DnD interno do Kanban é componente, não esse padrão). Tudo nativo/mobile.

---

# C. COMPONENTS  (HIG → equivalente shadcn/Radix)

Mapa do componente nativo para o que você já usa. Specs visuais detalhadas no design doc (Seção 6).

| HIG (nativo) | No BAUSA Engine (web) | Nota |
|---|---|---|
| Buttons | shadcn `Button` (CVA) | primary/secondary/plain/destructive |
| Menus | Radix `DropdownMenu` | vidro + radius 12 |
| Pickers / Pop-up buttons | Radix `Select` | fill bg, radius 10 |
| Segmented control | `Tabs`/segmented (pill + thumb) | thumb com `layoutId` |
| Toggles | Radix `Switch` | ON = systemGreen |
| Sliders / Steppers | shadcn `Slider`/stepper | track fino, knob branco |
| Text fields / Search | `Input`/search | radius 10, foco com anel |
| Lists / Tables / Outline | tabela do CRM + disclosure | separador, hover fill, header sticky de vidro |
| Progress indicators | `Progress`/spinner | determinado vs indeterminado |
| Sheets / Popovers / Alerts | Radix `Dialog`/`Popover`/`AlertDialog` | radius 20 (modal) / 12–13 (popover) |
| Toolbars | barra de ações do CRM | vidro fino, ícones consistentes |
| Sidebars | sidebar de navegação | `bg-sidebar` ou `.glass-regular` |
| Tab bars / Navigation | nav principal | item ativo em `primary` |
| Badges / Labels | `Badge` (status, planos) | tinted fill |
| Tooltips | Radix `Tooltip` | `.text-footnote`, vidro |
| Charts | Recharts 3 | paleta `--chart-*`, tooltip de vidro |

**Sem equivalente web (ignorar):** Tab bars de iOS, Page controls, Activity views, Context menus de toque (usar dropdown/right-click), Pull-to-refresh.

---

# D. INPUTS  (modalidades de entrada)

Na HIG "Inputs" trata de **como** o usuário interage. Para CRM web (mouse + teclado):

### D1. Pointer / hover ✅
Web tem hover (diferente de toque). Usar hover para revelar affordances **sem esconder informação essencial atrás dele**. Cursor coerente (`pointer` em clicáveis).

### D2. Keyboard ✅ (crítico num CRM)
- Navegação completa por teclado; ordem de tab lógica.
- Modais: `Esc` fecha, `Enter` confirma, foco preso no modal (Radix já entrega — não quebrar).
- Atalhos para ações frequentes (criar lead, buscar) — **proposta**, não alterar bindings existentes sem aprovação.
- Foco visível sempre (`:focus-visible`).

### D3. Focus & selection ✅
Estado de foco distinto do hover. Em tabelas/kanban, seleção clara (`color-mix(primary 12%)`).

### D4. Acessibilidade de entrada ✅
Leitores de tela: Radix entrega ARIA correto nos componentes — **preservar as props de acessibilidade ao re-estilizar** (não remover `aria-*`, `role`, `data-state`).

### Inputs — ❌ NÃO aplica
Apple Pencil, Digital Crown, controles de jogo, Siri/voz, gestos de toque (swipe/long-press), Apple TV remote. Nada disso no CRM web.

---

# E. TECHNOLOGIES

Sejamos honestos: **~95% desta seção da HIG é integração nativa Apple e não se aplica a um CRM web.** Apple Pay, Sign in with Apple, HealthKit, HomeKit, CarPlay, Maps nativo, iCloud, App Intents, Live Activities, Wallet — fora de escopo.

**Crossovers possíveis (revisitar só se você adicionar a feature):**
- **Sign in with Apple** — tem SDK web; só relevante se virar opção de login. Hoje: não.
- **Mapas** — se exibir localização de escolas, você usaria Google Maps (sua stack), não MapKit.
- **Web Push** — notificações no navegador; padrão web, não HIG.

**Recomendação:** ignorar Technologies por completo nesta auditoria. Marcar como "N/A — revisitar por demanda". Forçar regras nativas aqui só geraria ruído.

---

# F. Como rodar a análise (loop do agente)

Para **cada** seção aplicável, em **cada** tela/modal/fluxo:
1. Identificar quais regras deste rulebook incidem.
2. Diagnosticar desvios (com referência ao item, ex.: "viola A2 — cor de ação usada em status").
3. Propor o ajuste visual (ligado a token/spec).
4. Confirmar escopo: "só apresentação; fluxo idêntico".
5. Aplicar.
6. Verificar (mesmas ações, mesmos resultados) — e, com Antigravity, gerar screenshot de prova.

Entregar, por bloco: itens do rulebook auditados + desvios corrigidos + checklist da Regra de Ouro.

---

*Nota de propriedade intelectual: este documento é uma adaptação original, em palavras próprias, dos princípios públicos das Apple Human Interface Guidelines, escrita para uso interno na padronização do BAUSA Engine. Não reproduz o texto da Apple. As HIG permanecem propriedade da Apple Inc.; consulte developer.apple.com/design para a fonte oficial.*
