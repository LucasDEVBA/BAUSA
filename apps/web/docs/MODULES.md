# MODULES.md — Mapa de Modulos Implementados (CRM BAUSA)

> Documentacao baseada no codigo implementado. Atualizado em 2026-04-01.

---

## Visao Geral

O CRM possui **14 modulos implementados**, acessiveis via rotas Next.js em `/[locale]/crm/*`. A autenticacao e feita via Supabase Auth + `user_profiles`, e o controle de acesso por papel (`ceo`, `head_sucesso`, `comercial`) e verificado tanto no servidor (server actions) quanto na navegacao (sidebar + requirePapel).

O layout compartilhado (`CrmShell`) inclui sidebar com navegacao filtrada por papel, header com breadcrumb, busca, notificacoes em tempo real e indicador "Ao vivo".

---

## Mapa de Modulos

| # | Modulo | Rota | Status | Componentes | Server Actions | Acesso |
|---|---|---|---|---|---|---|
| 1 | **War Room** | `/crm/war-room` | Implementado | `MetricCard`, `GoalProgressCard`, `WarRoomSectionCard`, `AlertsPanel` | `verificarAlertas` | CEO |
| 2 | **Relatorios** | `/crm/relatorios` | Implementado | `Tabs` (shadcn), `MetricCard`, `Bar` (inline) | — (queries diretas) | CEO |
| 3 | **Leads** | `/crm/leads` | Implementado | `LeadsTable`, `LeadStatusBadge`, `MetricCard` | `promoverLead` | CEO |
| 4 | **Pipeline** | `/crm/pipeline` | Implementado | `KanbanBoard`, `KanbanColumn`, `DealCard`, `DealModal`, `ContratoPanel` | `moverDeal`, `atualizarDeal`, `enviarConviteReuniao`, `enviarWhatsAppManual`, `registrarLinkCalendario` | CEO |
| 5 | **Financeiro** | `/crm/financeiro` | Implementado | `MetricCard` | `criarContrato`, `confirmarPagamento`, `confirmarSinalPago`, `getContratoByDeal` | CEO |
| 6 | **Escolas** | `/crm/escolas` | Implementado | `EscolasList`, `EscolaModal`, `MetricCard` | `criarEscola`, `atualizarEscola` | CEO |
| 7 | **Matching** | `/crm/matching` | Implementado | `MetricCard` | `sugerirEscolas`, `calcularMatch`, `adicionarEstrategia`, `atualizarResultadoEscola` | CEO |
| 8 | **Experiencia** | `/crm/experiencia` | Implementado | `ExperienciaDashboard`, `FamiliaModal`, `DocumentosPanel` | `registrarContato`, `atualizarExperiencia`, `escalonarCEO`, `getContatosExperiencia`, `getExperiencias` | CEO, Head |
| 9 | **Tarefas** | `/crm/tarefas` | Implementado | `TarefasList` | `criarTarefa`, `marcarTarefaConcluida` | CEO, Head, Comercial |
| 10 | **FAQ** | `/crm/faq` | Implementado | `FaqSearch` | `salvarArtigo`, `registrarAcesso`, `listarArtigos`, `buscarArtigos` | CEO, Head |
| 11 | **Indicacoes** | `/crm/indicacoes` | Implementado | `IndicacoesList` | `marcarRecompensaEntregue` | CEO |
| 12 | **Configuracoes** | `/crm/configuracoes` | Implementado | `ConfiguracoesForm` | `atualizarConfiguracao`, `atualizarMultiplasConfiguracoes`, `getConfiguracoes` | CEO |
| 13 | **Notificacoes** | (componente no header) | Implementado | `NotificationBell` | `getNotificacoesNaoLidas`, `marcarNotificacaoLida`, `marcarTodasNotificacoesLidas` | Todos |
| 14 | **Documentos** | (sub-componente) | Implementado | `DocumentosPanel` | `listarDocumentos`, `adicionarDocumento`, `atualizarStatusDocumento` | CEO, Head |

---

## Organizacao na Sidebar

A sidebar (`Sidebar.tsx`) organiza os modulos em 5 grupos:

| Grupo | Modulos | Papeis |
|---|---|---|
| **EXECUTIVO** | War Room, Relatorios | CEO |
| **COMERCIAL** | Pipeline, Leads, Financeiro | CEO |
| **INTELIGENCIA** | Banco de Escolas, Motor de Match | CEO |
| **FAMILIAS** | Experiencia | CEO, Head |
| **SISTEMA** | Tarefas, FAQ, Indicacoes, Configuracoes | Varia por item |

---

## Detalhamento por Modulo

### 1. War Room (`/crm/war-room`)

**Descricao:** Dashboard executivo consolidado. Ponto de entrada padrao para o CEO.

**Funcionalidades:**
- 4 KPI cards: Receita Fechada (mes), Pipeline Total (deals ativos), Taxa de Conversao, Familias Ativas
- Card de progresso da meta mensal (recebido vs projetado vs meta)
- 6 cards de secao com links rapidos: Meta/Receita, Funil Comercial, Caixa, Receita em Risco, Posicionamento, Familias
- Painel de alertas automaticos (verificarAlertas): deals sem next_action 48h+, reuniao sem proposta 12h+, proposta sem follow-up 48h+, negociacao parada 4d+, contrato sem assinatura 48h+
- Lista de 5 leads mais recentes com classificacao
- Lista de 10 proximas acoes com indicador visual de vencidas
- Tabela de pipeline por etapa (deals e valor por etapa)

**Tabelas lidas:** `contratos_financeiros`, `parcelas`, `deals`, `crm_experiencia`, `configuracoes_sistema`, `form_submissions`

**Componentes:** `MetricCard`, `GoalProgressCard`, `WarRoomSectionCard`, `AlertsPanel`

---

### 2. Relatorios (`/crm/relatorios`)

**Descricao:** Analise consolidada com 4 abas tematicas.

**Funcionalidades:**
- **Aba Comercial:** receita do mes, deals ativos, atletas no CRM, deals perdidos, pipeline por etapa (grafico de barras), leads por origem, motivos de perda
- **Aba Financeiro:** receita recebida, inadimplencia, previsao de recebiveis 30/60/90 dias (graficos de barras)
- **Aba Experiencia:** distribuicao de temperatura (verde/amarelo/vermelho), satisfacao e ansiedade medias
- **Aba Escolas:** ranking por taxa de aceitacao (grafico de barras), escolas sem contato 90+ dias

**Tabelas lidas:** `deals`, `contratos_financeiros`, `atletas`, `parcelas`, `crm_experiencia`, `escolas`

**Componentes:** `Tabs` (shadcn), `MetricCard`, `Bar` (componente inline)

---

### 3. Leads (`/crm/leads`)

**Descricao:** Gestao de leads vindos do formulario web. Permite visualizar, filtrar e promover para o CRM.

**Funcionalidades:**
- 4 KPI cards: Total Novos, Quentes, Mornos, Frios
- Abas "Novos" e "No CRM" (atletas ja promovidos)
- Tabela com colunas: Atleta (avatar + nome + email), Classificacao (badge), Investimento, Posicao, Local, WhatsApp, Recebido (tempo relativo)
- TanStack Table: ordenacao, busca global, filtro por classificacao (Todos/Quente/Morno/Frio), paginacao (15/pagina)
- Detail sheet (slide-in) ao clicar num lead: dados completos, analise da IA, links rapidos WhatsApp/Email, secoes Atleta/Educacao/Projeto/Responsavel/Endereco
- Botao "Promover para CRM" no detail sheet: cria Responsavel + Endereco + Atleta + Deal

**Server actions:** `promoverLead` — cria responsavel (dedup por whatsapp), endereco, atleta (mapeando campos do formulario), deal na etapa "lead"

**Tabelas lidas:** `form_submissions`, `atletas`
**Tabelas escritas (promover):** `responsaveis`, `enderecos`, `atletas`, `deals`

**Componentes:** `LeadsTable`, `LeadStatusBadge`, `MetricCard`

---

### 4. Pipeline (`/crm/pipeline`)

**Descricao:** Board Kanban com drag-and-drop para gerenciar oportunidades.

**Funcionalidades:**
- Board Kanban com 12 colunas visiveis (lead ate admission_process), excluindo perdido/concluido/cancelamento/projeto_futuro
- Cada coluna mostra contador de deals e valor total
- Drag-and-drop via @dnd-kit/core com optimistic update e rollback em caso de erro
- DealCard: avatar do atleta, nome, esporte, serie, valor estimado, badge de classificacao
- DealModal (sheet slide-in): dados do atleta, campos editaveis (Next Action, Data Proxima Acao, Notas da Reuniao), secao de reuniao (link do Google Calendar, data), secao WhatsApp (convite de reuniao, mensagem manual), secao Financeiro (ContratoPanel), acoes (salvar, avancar etapa, marcar como perdido)
- Validacoes: avancar exige next_action + data; retroceder exige justificativa; perdido exige motivo

**Server actions:** `moverDeal`, `atualizarDeal`, `enviarConviteReuniao`, `enviarWhatsAppManual`, `registrarLinkCalendario`

**Tabelas lidas:** `deals` (join com `atletas`, `user_profiles`)
**Tabelas escritas:** `deals`, `notificacoes`

**Componentes:** `KanbanBoard`, `KanbanColumn`, `DealCard`, `DealModal`, `ContratoPanel`

---

### 5. Financeiro (`/crm/financeiro`)

**Descricao:** Visao de contratos, parcelas e recebiveis.

**Funcionalidades:**
- 4 KPI cards: Recebido no mes, Recebiveis (previstas), Inadimplencia (atrasadas), NFs Pendentes
- Tabela de contratos ativos: plano (badge), valor total, status entrada (Pago/Pendente), status NF
- Tabela de recebiveis: numero parcela, valor, vencimento (destaque se vencida), metodo (pix/getnet), status (badge)
- Destaque visual em parcelas vencidas (fundo vermelho)

**Server actions (disponiveis mas usadas via DealModal):** `criarContrato`, `confirmarPagamento`, `confirmarSinalPago`, `getContratoByDeal`

**Tabelas lidas:** `parcelas`, `contratos_financeiros`
**Tabelas escritas (via DealModal):** `contratos_financeiros`, `parcelas`, `deals`, `crm_experiencia`, `tarefas`, `notificacoes`

**Componentes:** `MetricCard`, `ContratoPanel` (embutido no DealModal)

> Nota: A criacao de contratos e feita pelo `ContratoPanel` dentro do `DealModal` (Pipeline), nao pela pagina Financeiro diretamente.

---

### 6. Escolas (`/crm/escolas`)

**Descricao:** Base institucional de escolas americanas.

**Funcionalidades:**
- 4 KPI cards: Total Escolas, Ativas, Com Aplicacao, Relacao Forte
- Busca por nome/estado/cidade
- Filtro por status (Todas/Ativa/Inativa/Em analise)
- Botao "Nova Escola"
- Tabela: nome, local (cidade + estado), tipo (badge), status (badge), budget USD, taxa de aceitacao, temperatura de relacionamento (badge colorido)
- EscolaModal para visualizar/editar detalhes completos: dados academicos, requisitos de ingles/testes, esportes oferecidos, deadlines, dados do admissions officer, notas internas

**Server actions:** `criarEscola`, `atualizarEscola`

**Tabelas lidas/escritas:** `escolas`

**Componentes:** `EscolasList`, `EscolaModal`, `MetricCard`

---

### 7. Matching (`/crm/matching`)

**Descricao:** Motor de cruzamento inteligente entre atletas e escolas.

**Funcionalidades:**
- 4 KPI cards: Escolas Ativas, Atletas no CRM, Matches Gerados, Score Medio
- Tabela de estrategias existentes: escola (nome + local), score (barra de progresso + numero), classificacao (Excelente/Forte/Possivel/Fraco com badge colorido), prioridade, status, resultado
- Grid de cards de atletas disponiveis para match: nome, esporte, serie, investimento, ingles, nivel competitivo

**Server actions:** `sugerirEscolas` (RPC), `calcularMatch` (RPC), `adicionarEstrategia`, `atualizarResultadoEscola`

**Tabelas lidas:** `atletas`, `escolas`, `estrategia_escolas`
**Tabelas escritas:** `estrategia_escolas`, `escolas` (contadores)

**Componentes:** `MetricCard`

---

### 8. Experiencia (`/crm/experiencia`)

**Descricao:** Acompanhamento pos-venda das familias. Pagina principal da Head de Sucesso.

**Funcionalidades:**
- Titulo adaptativo: "Minhas Familias" (Head) ou "CRM Experiencia" (CEO)
- Secao "Fazer Agora": tarefas atrasadas/criticas + familias em crise/atencao, com destaque visual vermelho
- Lista de familias ordenadas: crise primeiro, depois atencao, depois por dias sem contato (decrescente)
- Cada card de familia mostra: icone de temperatura (verde/amarelo/vermelho), nome do atleta, badge de status, fase, dias sem contato, botao "Contato"
- Destaque em familias inativas (borda vermelha) conforme threshold por fase
- Secao "Proximos 7 dias": contatos agendados
- FamiliaModal (sheet): 3 abas — Contato (tipo, resumo, proximo contato), Indicadores (ansiedade 1-5, satisfacao 1-5, fase, status, descricao problema), Historico (contatos anteriores)
- Temperatura calculada automaticamente a partir de ansiedade/satisfacao (vermelho se ansiedade >= 4 ou satisfacao <= 2; verde se ansiedade <= 2, satisfacao >= 4 e status satisfeita)
- Escalonamento ao CEO com tarefa critica (prazo 2h) + notificacao critica
- Notificacao automatica ao CEO quando status muda para atencao/crise

**Server actions:** `registrarContato`, `atualizarExperiencia`, `escalonarCEO`, `getContatosExperiencia`, `getExperiencias`

**Tabelas lidas:** `crm_experiencia` (join `atletas`, `responsaveis`, `deals`, `contratos_financeiros`), `tarefas`, `contatos_experiencia`
**Tabelas escritas:** `contatos_experiencia`, `crm_experiencia`, `tarefas`, `notificacoes`

**Componentes:** `ExperienciaDashboard`, `FamiliaModal`

---

### 9. Tarefas (`/crm/tarefas`)

**Descricao:** Gestao de atividades e prazos com filtros e conclusao.

**Funcionalidades:**
- Filtro por status: Pendente, Em Andamento, Concluida, Atrasada, Todas
- Busca por titulo
- Lista de tarefas com checkbox para concluir
- Cada card mostra: titulo (riscado se concluida), badge de prioridade (critica/alta/media/baixa com cores semanticas), badge "Auto" se criada automaticamente, prazo (destaque vermelho se vencida), modulo de origem
- Ordenacao automatica: critica primeiro, depois por data de prazo
- CEO ve todas as tarefas; outros papeis veem apenas as suas

**Server actions:** `criarTarefa`, `marcarTarefaConcluida`

**Tabelas lidas/escritas:** `tarefas`

**Componentes:** `TarefasList`

---

### 10. FAQ (`/crm/faq`)

**Descricao:** Base de conhecimento interna para atendimento.

**Funcionalidades:**
- Busca por texto (titulo + conteudo)
- Filtro por categoria (Visto, Documentacao, Embarque, Adaptacao, Financeiro, Escola, Saude, Outros)
- Botao "Novo" para criar artigo
- Lista de artigos: titulo, preview do conteudo (150 chars), badge de categoria, contador de acessos
- Detail sheet (slide-in): titulo, badge de categoria, conteudo completo, botao "Copiar para WhatsApp" (incrementa contador de acessos)
- Sheet de criacao: titulo, categoria (select), conteudo (textarea)

**Server actions:** `salvarArtigo`, `registrarAcesso`, `listarArtigos`, `buscarArtigos`

**Tabelas lidas/escritas:** `faq_artigos`

**Componentes:** `FaqSearch`

---

### 11. Indicacoes (`/crm/indicacoes`)

**Descricao:** Tracking de familias indicadas e controle de recompensas.

**Funcionalidades:**
- 3 KPI cards: Total indicacoes, Taxa de conversao, Recompensas pendentes (destaque se > 0)
- Filtro por status: Todas, Pendente, Em Negociacao, Convertido, Perdido
- Tabela: quem indicou (nome), atleta indicado, status (badge colorido), recompensa (Entregue/Pendente/—), data, botao "Entregar" para recompensas pendentes

**Server actions:** `marcarRecompensaEntregue`

**Tabelas lidas:** `indicacoes` (join `responsaveis`, `atletas`)
**Tabelas escritas:** `indicacoes`

**Componentes:** `IndicacoesList`

---

### 12. Configuracoes (`/crm/configuracoes`)

**Descricao:** Painel de parametros globais do sistema. Acesso exclusivo CEO.

**Funcionalidades:**
- 7 abas de configuracao:
  - **Planos:** JSON dos planos e valores, entrada padrao (R$), custo psicologa
  - **Lead Scoring:** pesos do lead score (JSON), faixas de classificacao (JSON)
  - **Match:** pesos do motor de match (JSON), faixas de classificacao (JSON)
  - **Timers:** timers de automacao em horas/dias (JSON)
  - **Metas:** meta anual (R$), meta mensal (R$), ticket medio alvo (R$), contratos/mes alvo, pipeline health ratio (JSON)
  - **Experiencia:** thresholds de temperatura (JSON), inatividade por fase (JSON), horario do digest (JSON)
  - **Cobranca:** regua de cobranca (JSON), probabilidade padrao por etapa (JSON)
- Cada configuracao pode ser editada e salva individualmente
- Campos JSON com textarea monospaced
- Campos numericos com input + botao salvar

**Server actions:** `atualizarConfiguracao`, `atualizarMultiplasConfiguracoes`, `getConfiguracoes`

**Tabelas lidas/escritas:** `configuracoes_sistema`

**Componentes:** `ConfiguracoesForm`

---

### 13. Notificacoes (componente global)

**Descricao:** Sistema de notificacoes in-app via popover no header.

**Funcionalidades:**
- Icone de sino no header com badge vermelha (contador de nao lidas, max "9+")
- Popover com lista de notificacoes nao lidas (max 10 visiveis)
- Cada notificacao: dot de severidade (critica=vermelho, alta=laranja, media=azul, baixa=cinza), titulo, mensagem truncada, timestamp
- Clicar na notificacao marca como lida
- Botao "Marcar todas como lidas"
- Polling automatico a cada 60 segundos
- Empty state com icone quando nao ha notificacoes

**Server actions:** `getNotificacoesNaoLidas`, `marcarNotificacaoLida`, `marcarTodasNotificacoesLidas`

**Tabelas lidas/escritas:** `notificacoes`

**Componentes:** `NotificationBell`

> Nota: Notificacoes sao criadas automaticamente por outros modulos (confirmarSinalPago, atualizarExperiencia, escalonarCEO, enviarWhatsAppManual).

---

### 14. Documentos (sub-componente)

**Descricao:** Gestao de documentos por atleta. Integrado via `DocumentosPanel` dentro do modal de experiencia/deal.

**Funcionalidades:**
- Lista de documentos do atleta com status visual (pendente/enviado_atleta/revisado/enviado_escola/aprovado)
- Adicionar novo documento: tipo (9 opcoes — historico escolar, passaporte, video, carta de recomendacao, etc.), escola associada, arquivo, deadline, observacao
- Avancar status do documento sequencialmente (pendente -> enviado_atleta -> revisado -> enviado_escola -> aprovado)
- Badges coloridos por status

**Server actions:** `listarDocumentos`, `adicionarDocumento`, `atualizarStatusDocumento`

**Tabelas lidas/escritas:** `documentos_atleta`

**Componentes:** `DocumentosPanel`

> Nota: Nao possui pagina propria. E acessado como componente embutido.

---

## Matriz de Permissoes

### Controle de Acesso por Pagina

| Pagina | CEO | Head de Sucesso | Comercial |
|---|---|---|---|
| War Room | Acesso total | Sem acesso (redirect) | Sem acesso |
| Relatorios | Acesso total | Sem acesso | Sem acesso |
| Leads | Acesso total | Sem acesso | Sem acesso |
| Pipeline | Acesso total | Sem acesso | Sem acesso |
| Financeiro | Acesso total | Sem acesso | Sem acesso |
| Escolas | Acesso total | Sem acesso | Sem acesso |
| Matching | Acesso total | Sem acesso | Sem acesso |
| Experiencia | Supervisao + escrita | Acesso completo | Sem acesso |
| Tarefas | Todas as tarefas | Somente suas | Somente suas |
| FAQ | Leitura + criacao | Leitura + criacao | Sem acesso |
| Indicacoes | Acesso total | Sem acesso | Sem acesso |
| Configuracoes | Acesso total | Sem acesso | Sem acesso |
| Notificacoes | Todas (popover) | Todas (popover) | Todas (popover) |

### Controle de Acesso por Acao (Server Actions)

| Acao | CEO | Head | Comercial |
|---|---|---|---|
| `promoverLead` | Sim | Nao | Nao |
| `moverDeal` | Sim | Nao | Nao |
| `atualizarDeal` | Sim | Nao | Nao |
| `criarContrato` | Sim | Nao | Nao |
| `confirmarPagamento` | Sim | Nao | Nao |
| `confirmarSinalPago` | Sim | Nao | Nao |
| `criarEscola` | Sim | Nao | Nao |
| `atualizarEscola` | Sim | Nao | Nao |
| `adicionarEstrategia` | Sim | Nao | Nao |
| `atualizarResultadoEscola` | Sim | Nao | Nao |
| `registrarContato` | Sim | Sim | Nao |
| `atualizarExperiencia` | Sim | Sim | Nao |
| `escalonarCEO` | Nao | Sim | Nao |
| `criarTarefa` | Sim | Sim | Nao |
| `marcarTarefaConcluida` | Sim | Sim | Sim* |
| `salvarArtigo` | Sim | Sim | Nao |
| `atualizarConfiguracao` | Sim | Nao | Nao |
| `marcarRecompensaEntregue` | Sim | Nao | Nao |
| `enviarWhatsAppManual` | Sim | Nao | Nao |
| `enviarConviteReuniao` | Sim | Nao | Nao |
| `registrarLinkCalendario` | Sim | Nao | Nao |
| `marcarNotificacaoLida` | Sim | Sim | Sim |
| `marcarTodasNotificacoesLidas` | Sim | Sim | Sim |
| `listarDocumentos` | Sim | Sim | Sim |
| `adicionarDocumento` | Sim | Sim | Sim |
| `atualizarStatusDocumento` | Sim | Sim | Sim |

> *`marcarTarefaConcluida` nao faz check de papel (qualquer usuario autenticado pode).

---

## Redirecionamentos

| Papel | Rota `/crm` redireciona para |
|---|---|
| CEO | `/crm/war-room` |
| Head de Sucesso | `/crm/experiencia` |

---

## Dependencias de Dados (Tabelas Supabase)

| Tabela | Modulos que Leem | Modulos que Escrevem |
|---|---|---|
| `form_submissions` | War Room, Leads | — (preenchida pelo formulario web) |
| `atletas` | Leads, Pipeline, Matching, Experiencia, Relatorios | Leads (promover) |
| `responsaveis` | Experiencia, Indicacoes | Leads (promover) |
| `enderecos` | — | Leads (promover) |
| `deals` | War Room, Pipeline, Financeiro, Experiencia, Relatorios | Pipeline, Financeiro (confirmarSinalPago) |
| `contratos_financeiros` | War Room, Financeiro, Experiencia, Relatorios | Financeiro (criarContrato) |
| `parcelas` | War Room, Financeiro, Relatorios | Financeiro (criarContrato, confirmarPagamento) |
| `escolas` | Escolas, Matching, Relatorios | Escolas, Matching (contadores) |
| `estrategia_escolas` | Matching | Matching |
| `crm_experiencia` | War Room, Experiencia, Relatorios | Financeiro (handoff), Experiencia |
| `contatos_experiencia` | Experiencia (modal) | Experiencia |
| `tarefas` | Experiencia, Tarefas | Financeiro (onboarding), Experiencia (escalonamento), Tarefas |
| `notificacoes` | Notificacoes | Pipeline (WhatsApp), Financeiro (handoff), Experiencia (alerta/escalonamento) |
| `configuracoes_sistema` | War Room (meta), Configuracoes | Configuracoes |
| `faq_artigos` | FAQ | FAQ |
| `indicacoes` | Indicacoes | Indicacoes |
| `documentos_atleta` | Documentos | Documentos |
| `user_profiles` | Layout (auth), Financeiro (head lookup), Experiencia (escalonamento) | — |

---

## Automacoes Implementadas

| Automacao | Trigger | Acoes |
|---|---|---|
| **Alertas War Room** | Abertura da pagina War Room | Verifica 5 tipos: sem next_action 48h, reuniao sem proposta 12h, proposta sem followup 48h, negociacao parada 4d, contrato sem assinatura 48h |
| **Handoff Sinal Pago** | `confirmarSinalPago` | Cria registro em `crm_experiencia`, tarefa de onboarding (48h) para Head, notificacoes para CEO e Head |
| **Temperatura Automatica** | `atualizarExperiencia` | Calcula temperatura (verde/amarelo/vermelho) baseado em ansiedade e satisfacao |
| **Notificacao de Crise** | `atualizarExperiencia` (status atencao/crise) | Notifica CEO com severidade alta/critica |
| **Escalonamento** | `escalonarCEO` | Cria tarefa critica (prazo 2h) + notificacao critica para CEO |
| **Polling Notificacoes** | `NotificationBell` (useEffect) | Busca notificacoes nao lidas a cada 60 segundos |

---

## Server Actions — Arquivos

| Arquivo | Funcoes | Modulos que Usam |
|---|---|---|
| `src/lib/crm/actions/leads.ts` | `promoverLead` | Leads |
| `src/lib/crm/actions/deals.ts` | `moverDeal`, `atualizarDeal` | Pipeline |
| `src/lib/crm/actions/financeiro.ts` | `criarContrato`, `confirmarPagamento`, `confirmarSinalPago`, `getContratoByDeal` | Pipeline (DealModal), Financeiro |
| `src/lib/crm/actions/escolas.ts` | `criarEscola`, `atualizarEscola`, `sugerirEscolas`, `calcularMatch`, `adicionarEstrategia`, `atualizarResultadoEscola` | Escolas, Matching |
| `src/lib/crm/actions/experiencia.ts` | `registrarContato`, `atualizarExperiencia`, `escalonarCEO`, `getContatosExperiencia`, `getExperiencias` | Experiencia |
| `src/lib/crm/actions/automacoes.ts` | `criarTarefa`, `marcarTarefaConcluida`, `getNotificacoesNaoLidas`, `marcarNotificacaoLida`, `marcarTodasNotificacoesLidas` | Tarefas, Notificacoes |
| `src/lib/crm/actions/configuracoes.ts` | `atualizarConfiguracao`, `atualizarMultiplasConfiguracoes`, `getConfiguracoes` | Configuracoes |
| `src/lib/crm/actions/faq.ts` | `listarArtigos`, `buscarArtigos`, `salvarArtigo`, `registrarAcesso` | FAQ |
| `src/lib/crm/actions/indicacoes.ts` | `marcarRecompensaEntregue` | Indicacoes |
| `src/lib/crm/actions/documentos.ts` | `listarDocumentos`, `adicionarDocumento`, `atualizarStatusDocumento` | Documentos |
| `src/lib/crm/actions/whatsapp.ts` | `enviarWhatsAppManual`, `enviarConviteReuniao` | Pipeline (DealModal) |
| `src/lib/crm/actions/calendario.ts` | `registrarLinkCalendario`, `verificarReunioesPendentes` | Pipeline (DealModal) |
| `src/lib/crm/automacoes/verificar-alertas.ts` | `verificarAlertas` | War Room |

---

## Types (src/types/crm.ts)

| Tipo | Descricao |
|---|---|
| `PapelUsuario` | `'ceo' \| 'head_sucesso' \| 'comercial'` |
| `StatusDeal` | 16 etapas do pipeline (lead ate projeto_futuro) |
| `ClassificacaoLead` | `'hot' \| 'warm' \| 'cold'` |
| `TemperaturaFamilia` | `'verde' \| 'amarelo' \| 'vermelho'` |
| `PrioridadeTarefa` | `'critica' \| 'alta' \| 'media' \| 'baixa'` |
| `StatusTarefa` | `'pendente' \| 'em_andamento' \| 'concluida' \| 'atrasada' \| 'cancelada'` |
| `StatusParcela` | `'previsto' \| 'recebido' \| 'atrasado' \| 'cancelado'` |
| `DecisaoFamiliar` | `'decidida' \| 'em_discussao' \| 'resistente'` |
| `MotivoPerda` | 6 opcoes (financeiro, timing, etc.) |
| `OrigemLead` | 5 opcoes (formulario_web, indicacao, etc.) |

**Interfaces principais:** `UserProfile`, `Responsavel`, `Atleta`, `Deal`, `DealWithRelations`, `FormSubmission`, `ContratoFinanceiro`, `Parcela`, `Tarefa`, `Notificacao`, `CrmExperiencia`, `Escola`, `EstrategiaEscola`, `DocumentoAtleta`, `FaqArtigo`, `Indicacao`, `AuditLog`

**Constantes exportadas:** `ETAPA_LABELS`, `ETAPA_ORDEM`, `PIPELINE_ETAPAS`, `CLASSIFICACAO_COLORS`, `PLANO_VALORES`, `ENTRADA_PADRAO`, `MATCH_LABELS`, `US_STATES`, `DOCUMENTO_TIPOS`, `FAQ_CATEGORIAS`
