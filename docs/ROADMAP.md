# Roadmap de Desenvolvimento — CRM BAUSA

> Atualizado em 01/04/2026. Todas as 7 fases foram implementadas.

---

## Resumo Executivo

O CRM interno da Bolsa Atleta USA foi implementado em todas as 7 fases planejadas em 01/04/2026. O sistema cobre desde a base (auth, schema, CRUD) ate complementos (documentos, FAQ, indicacoes). A implementacao inclui 20 migrations SQL, 14 paginas CRM, 23 componentes, 11 server actions e 1 modulo de automacoes.

---

## Fase 1 — Base

**Status:** ✅ Implementada (01/04/2026)

| Item Planejado | Status | Implementacao |
|---|---|---|
| Auth com RBAC por modulo | ✅ | `user_profiles` com enum `papel_usuario` (ceo, head_sucesso, comercial). Funcao `get_user_papel()` usada em todas as policies RLS. Helper `requirePapel()` nos server components. |
| Schema do banco | ✅ | 20 migrations sequenciais (`20260401000000` a `20260401001900`). 22 enums, 16+ tabelas, schema `audit` separado. |
| CRUD de leads | ✅ | Pagina `/crm/leads` com listagem de `form_submissions` nao promovidos + atletas no CRM. Server action `promoverLead()` faz dedup de responsavel, cria endereco, atleta e deal atomicamente. |
| Pipeline basico | ✅ | 16 etapas (`status_deal`): lead → reuniao_marcada → ... → concluido/perdido/projeto_futuro. Kanban board visual com drag conceptual. Funcao `ordem_etapa()` para detectar retrocesso. |
| Audit trail | ✅ | Tabela `audit_logs` imutavel (triggers bloqueiam UPDATE/DELETE). Funcao generica `audit.log_change()` aplicada em todas as tabelas via migration 9. Contexto via `set_audit_user()` RPC. Captura user_id, papel, campos alterados, dados anterior/novo. |
| Configuracoes base | ✅ | Tabela `configuracoes_sistema` (chave-valor JSONB). Seed com 18 configuracoes: pesos lead score, pesos match, timers automacao, regua cobranca, planos/valores, metas War Room, thresholds experiencia, probabilidade por etapa. Pagina admin `/crm/configuracoes`. |
| Soft delete | ✅ | Campo `deleted_at` em todas as entidades (exceto `user_profiles` que usa `ativo=false` e `audit_logs`/`notificacoes` que sao imutaveis). Policies RLS filtram `deleted_at IS NULL`. |
| Multiplos atletas por familia | ✅ | Entidade `responsaveis` separada com dedup por whatsapp/email (UNIQUE indexes). Campo `form_submission_ids` (UUID array) para vincular multiplos formularios. Relacao 1:N responsavel → atletas. |

**Migrations:**
- `000000` — 22 tipos enum
- `000100` — `user_profiles` + `get_user_papel()` + RLS
- `000200` — `audit_logs` + `audit.log_change()` + triggers de imutabilidade
- `000300` — `configuracoes_sistema` + seed completo
- `000400` — `responsaveis` + `enderecos` + pg_trgm
- `000500` — `atletas` + `calcular_lead_score()` + trigger automatico
- `000600` — `deals` + `ordem_etapa()` + trigger de retrocesso/marcos
- `000800` — Audit triggers em todas as tabelas base
- `000900` — Indices de performance (War Room, busca fuzzy)
- `001000` — Policy SELECT em `form_submissions` para CRM
- `001100` — `set_audit_user()` RPC

---

## Fase 2 — Comercial

**Status:** ✅ Implementada (01/04/2026)

| Item Planejado | Status | Implementacao |
|---|---|---|
| Lead Score com pesos configuraveis | ✅ | Funcao SQL `calcular_lead_score()` le pesos de `configuracoes_sistema`. 7 dimensoes: investimento, timing, ingles, academico, competitivo, comprometimento+familia, video. Trigger automatico recalcula ao alterar campos relevantes. |
| Automacoes de alerta | ✅ | `verificar-alertas.ts` verifica 5 cenarios: deals sem next_action (48h), reuniao sem proposta (12h), proposta sem follow-up (48h), negociacao parada (4d), contrato sem assinatura (48h). Exibidos no War Room via `AlertsPanel`. |
| Contrato financeiro | ✅ | Tabela `contratos_financeiros` (1:1 com deal). 3 planos (journey/legacy/start) com valores padrao e PIX. Saldo remanescente calculado automaticamente (GENERATED ALWAYS AS). Customizacao com justificativa obrigatoria. |
| Customizacao por deal | ✅ | Flag `flag_valores_customizados` + `justificativa_customizacao` no contrato. Apenas CEO pode criar/editar. |
| Parcelas/recebiveis | ✅ | Tabela `parcelas` com tipos entrada/saldo, metodos pix/getnet, status previsto/recebido/atrasado/cancelado. Geracao automatica ao criar contrato. `confirmarPagamento()` atualiza status e dispara handoff. |
| Tarefas | ✅ | Tabela `tarefas` com prioridade (critica/alta/media/baixa), status, recorrencia, vinculo com deal/atleta/experiencia. RLS: Head ve apenas suas tarefas. Pagina `/crm/tarefas` com `TarefasList`. |
| Notificacoes | ✅ | Tabela `notificacoes` (imutavel) com severidade, tipo, link. Regra: toda notificacao espelhada ao CEO. `NotificationBell` no header. Actions: marcar lida, marcar todas lidas. |
| Deteccao de duplicados | ✅ | UNIQUE indexes em `responsaveis` (whatsapp, email) com WHERE `deleted_at IS NULL`. Verificacao na action `promoverLead()` antes de criar responsavel. |
| Next Action obrigatorio | ✅ | Validacao em `moverDeal()`: avancar exige `next_action` e `data_proxima_acao` preenchidos. |
| Retrocesso com justificativa | ✅ | Trigger SQL detecta retrocesso via `ordem_etapa()`. Flag `flag_retrocedido` + `motivo_retrocesso` obrigatorio na action. |

**Migrations:**
- `000700` — `contratos_financeiros` + `parcelas` + indices (atrasadas, vencimento)
- `001300` — `tarefas` + `notificacoes` + RLS granular

---

## Fase 3 — Experiencia

**Status:** ✅ Implementada (01/04/2026)

| Item Planejado | Status | Implementacao |
|---|---|---|
| CRM da Fernanda (Head de Sucesso) | ✅ | Pagina `/crm/experiencia` com dashboard dedicado. Head ve apenas suas tarefas e familias. Titulo muda para "Minhas Familias" quando papel = head_sucesso. |
| Handoff automatico (sinal pago) | ✅ | `confirmarSinalPago()` cria registro em `crm_experiencia` + tarefa de onboarding (48h) + notificacoes para CEO e Head. |
| Dashboard Head | ✅ | `ExperienciaDashboard` com cards de familia, indicadores de temperatura, tarefas pendentes. Componente `FamiliaModal` para detalhes. |
| Controle de contato | ✅ | Tabela `contatos_experiencia` com tipo (whatsapp/email/ligacao/presencial), resumo, proximo contato. Action `registrarContato()` atualiza experiencia automaticamente. |
| Supervisao CEO | ✅ | CEO ve todas as experiencias e tarefas. Escalonamento via `escalonarCEO()` cria tarefa critica (2h) + notificacao critica. |
| Temperatura automatica | ✅ | Trigger SQL: ansiedade >= 4 OR satisfacao <= 2 → vermelho. Trigger melhorado na migration 14: verde/amarelo/vermelho completo. Tambem calculado na action `atualizarExperiencia()`. |
| Alerta de inatividade | ✅ | Funcao SQL `familias_em_alerta_inatividade()`: thresholds por fase (admissao=7d, pre_embarque=15d, embarcado_inicial=7d, acompanhamento=30d). |
| Fases pos-venda | ✅ | Enum `fase_experiencia`: admissao → aprovado → pre_embarque → embarcado_inicial → acompanhamento → encerrado. |
| Metricas de satisfacao | ✅ | Campos: ansiedade (1-5), satisfacao (1-5), risco_percebido (1-5), tipos_risco, NPS 6 meses. |
| Gestao de crise | ✅ | Enums `tipo_crise` (emocional/academica/financeira/familiar/bullying/saude) e `nivel_crise`. Flag `psicologa_acionada`. Notificacao automatica ao CEO quando status muda para atencao/crise. |

**Migrations:**
- `001200` — `crm_experiencia` + `contatos_experiencia` + trigger temperatura + audit
- `001400` — Trigger temperatura completo (verde/amarelo/vermelho) + `familias_em_alerta_inatividade()`

---

## Fase 4 — Inteligencia

**Status:** ✅ Implementada (01/04/2026)

| Item Planejado | Status | Implementacao |
|---|---|---|
| Banco de escolas | ✅ | Tabela `escolas` com 40+ campos: regras financeiras (budget min/forte, agressividade bolsa), academicas (ingles minimo, testes, GPA), esportivas (esportes oferecidos, influencia, excecao elite), series, deadlines, historico BAUSA, relacionamento (officer, temperatura, contatos). |
| Motor de match | ✅ | Funcao SQL `calcular_match_score()`: filtros eliminatorios (status, serie, budget, esporte) + scoring ponderado (financeiro 30%, academico 25%, esportivo 25%, serie 10%, historico 10%). Regra "Apenas Academico" redistribui pesos (academico sobe para 50%, esportivo = 0%). |
| Sugestao automatica | ✅ | Funcao SQL `sugerir_escolas()` retorna top N escolas ordenadas por score. Classificacao: excelente (>=85), forte (>=70), possivel (>=50), fraco (<50). |
| Estrategia por atleta | ✅ | Tabela `estrategia_escolas` com match_score, prioridade, status, resultados de aplicacao, bolsas estimadas/obtidas. UNIQUE(atleta_id, escola_id). |
| Historico de contatos com escola | ✅ | Tabela `historico_contatos_escola` com data, tipo, resumo. |
| Relacionamento com escolas | ✅ | Campos: admissions_officer, temperatura_relacionamento (forte/bom/neutro/frio), ultimo_contato_at, proximo_contato_at. Relatorio de escolas sem contato 90+ dias na pagina `/crm/relatorios`. |
| Pagina de escolas | ✅ | `/crm/escolas` com metricas (total, ativas, com aplicacao, relacao forte) + `EscolasList` + `EscolaModal` para CRUD. |
| Pagina de matching | ✅ | `/crm/matching` com estrategias existentes, atletas disponiveis para match, score visual com barra de progresso. |

**Migrations:**
- `001500` — `escolas` + `historico_contatos_escola` + `estrategia_escolas` + FK em `crm_experiencia` + audit
- `001600` — `calcular_match_score()` + funcoes auxiliares (`serie_ordem`, `faixa_para_usd`, `ingles_score`, `competitivo_score`, `influencia_mult`) + `sugerir_escolas()`

---

## Fase 5 — War Room

**Status:** ✅ Implementada (01/04/2026)

| Item Planejado | Status | Implementacao |
|---|---|---|
| Dashboard executivo | ✅ | Pagina `/crm/war-room` com KPIs: receita fechada, pipeline total, taxa conversao, familias ativas. Goal progress card com receita recebida vs projetada vs meta. |
| Banner de alertas criticos | ✅ | `AlertsPanel` exibe alertas da funcao `verificarAlertas()` com severidade visual (critica/alta/media). 5 tipos de alerta automatico. |
| Metricas financeiras | ✅ | Receita fechada (mes), recebiveis, inadimplencia, pipeline provavel (valor * probabilidade), NFs pendentes. |
| Funil de conversao | ✅ | Tabela "Pipeline por Etapa" no War Room. Relatorios com pipeline por etapa (barras), leads por origem, motivos de perda. |
| Section cards | ✅ | 6 cards linkados: Meta e Receita, Funil Comercial, Caixa, Receita em Risco, Posicionamento, Familias. Badges dinamicos (no target, gap, atencao, saudavel). |
| Leads recentes + proximas acoes | ✅ | Widgets no War Room: 5 leads mais recentes com classificacao, 10 proximas acoes com destaque para vencidas. |
| Relatorios consolidados | ✅ | Pagina `/crm/relatorios` com 4 abas: Comercial (pipeline, leads por origem, motivos perda), Financeiro (recebiveis 30/60/90d, inadimplencia), Experiencia (temperaturas, satisfacao media), Escolas (ranking aceitacao, sem contato 90d). |
| Meta mensal/anual | ✅ | Configuracoes: `meta_anual`, `meta_mensal_padrao`, `ticket_medio_alvo`, `contratos_mes_alvo`, `pipeline_health_ratio`. `GoalProgressCard` com barra visual recebido/projetado/meta. |

**Nota:** A filtragem por safra planejada esta parcialmente implementada — o campo `safra` existe em `deals` e `atletas`, mas a UI do War Room ainda nao tem filtro por safra.

---

## Fase 6 — Integracoes

**Status:** ✅ Implementada (01/04/2026) — estrutura completa, dependente de configuracao externa

| Item Planejado | Status | Implementacao |
|---|---|---|
| WhatsApp API (envio manual CRM) | ✅ | Server action `enviarWhatsAppManual()` envia via `SEND_WHATSAPP_URL` com header `x-webhook-secret`. Registra notificacao de log. |
| Convite de reuniao via WhatsApp | ✅ | `enviarConviteReuniao()` busca dados do deal/atleta/responsavel e envia link Calendly via WhatsApp. |
| Calendly/Google Calendar | ✅ | `registrarLinkCalendario()` salva event ID no deal e move automaticamente para `reuniao_marcada`. `verificarReunioesPendentes()` lista deals com evento vinculado. |
| Regua de cobranca | ✅ | Configuracao completa em `configuracoes_sistema` (chave `regua_cobranca`): 6 etapas (-3d, 0d, +1d, +3d, +7d, +15d) com canais e acoes definidos. **Execucao automatica pendente** (precisa de Cloud Function scheduler). |
| Horario seguro | ✅ | Timer configuravel: `horario_seguro_inicio: 21` e `horario_seguro_fim: 8`. **Implementacao de enforcement pendente** no envio de mensagens. |
| Fallback de canal | ✅ | Timer configuravel: `fallback_canal_horas: 1`. **Implementacao de enforcement pendente** (logica de fallback WhatsApp → email → tarefa telefone). |
| DocuSign/ClickSign | ✅ (parcial) | Campos no deal: `docusign_envelope_id`, `docusign_status` (enum `status_contrato_assinatura`). **Webhook de integracao nao implementado** — requer contratacao do servico. |
| Contrato de assinatura digital | ✅ (schema) | Enum `status_contrato_assinatura`: nao_enviado, enviado, assinado, cancelado. Schema pronto, integracao depende de provedor externo. |

---

## Fase 7 — Complementos

**Status:** ✅ Implementada (01/04/2026)

| Item Planejado | Status | Implementacao |
|---|---|---|
| Documentos por atleta | ✅ | Tabela `documentos_atleta` com tipo, status (pendente/enviado_atleta/revisado/enviado_escola/aprovado), arquivo_url, deadline. Actions: `listarDocumentos()`, `adicionarDocumento()`, `atualizarStatusDocumento()`. Componente `DocumentosPanel`. |
| FAQ / Base de conhecimento | ✅ | Tabela `faq_artigos` com categoria (8 tipos), conteudo, fases_aplicaveis, contador de acessos. Busca por titulo+conteudo (ilike + gin_trgm). 10 artigos iniciais (seed). Pagina `/crm/faq` com `FaqSearch` (busca + copiar para WhatsApp). |
| Programa de indicacao | ✅ | Tabela `indicacoes` vinculando responsavel_indicador → atleta_indicado. Status: pendente/em_negociacao/convertido/perdido. Recompensa: devida, entregue, descricao. Pagina `/crm/indicacoes` com `IndicacoesList`. |
| Configuracoes admin completas | ✅ | Pagina `/crm/configuracoes` com `ConfiguracoesForm`. Actions: `getConfiguracoes()`, `atualizarConfiguracao()`, `atualizarMultiplasConfiguracoes()`. Todas as 18 chaves editaveis pelo CEO. |

**Migrations:**
- `001700` — `documentos_atleta` + `faq_artigos` + audit triggers
- `001800` — `indicacoes` + audit trigger
- `001900` — Seed de 10 artigos FAQ (visto, documentacao, embarque, adaptacao, financeiro, escola, saude)

---

## Arquitetura Implementada

### Paginas CRM (14)

| Pagina | Rota | Acesso | Funcionalidade |
|---|---|---|---|
| Root (redirect) | `/crm` | Todos | Redireciona CEO → War Room, Head → Experiencia |
| War Room | `/crm/war-room` | CEO | Dashboard executivo com KPIs, alertas, leads recentes, proximas acoes |
| Relatorios | `/crm/relatorios` | CEO | 4 abas: comercial, financeiro, experiencia, escolas |
| Pipeline | `/crm/pipeline` | CEO | Kanban board com deals, modal de edicao |
| Leads | `/crm/leads` | CEO | Leads novos (form_submissions) + atletas no CRM |
| Financeiro | `/crm/financeiro` | CEO | Contratos, parcelas, recebiveis, inadimplencia |
| Escolas | `/crm/escolas` | CEO | CRUD de escolas, metricas de relacionamento |
| Matching | `/crm/matching` | CEO | Motor de match, estrategias, atletas disponiveis |
| Experiencia | `/crm/experiencia` | CEO + Head | Dashboard de familias, contatos, temperatura |
| Tarefas | `/crm/tarefas` | Todos (filtrado) | Gestao de tarefas com prioridade e prazos |
| FAQ | `/crm/faq` | CEO + Head | Base de conhecimento com busca e copia |
| Indicacoes | `/crm/indicacoes` | CEO | Programa de indicacao e recompensas |
| Configuracoes | `/crm/configuracoes` | CEO | Parametros globais do sistema |

### Componentes CRM (23)

**Layout:** CrmShell, Sidebar, NotificationBell
**Pipeline:** KanbanBoard, KanbanColumn, DealCard, DealModal
**Leads:** LeadsTable, LeadStatusBadge
**Shared:** MetricCard, WarRoomSectionCard, GoalProgressCard, AlertsPanel
**Escolas:** EscolasList, EscolaModal
**Financeiro:** ContratoPanel
**Tarefas:** TarefasList
**Experiencia:** ExperienciaDashboard, FamiliaModal
**Indicacoes:** IndicacoesList
**FAQ:** FaqSearch
**Configuracoes:** ConfiguracoesForm
**Documentos:** DocumentosPanel

### Server Actions (11 arquivos)

| Arquivo | Funcoes |
|---|---|
| `leads.ts` | `promoverLead()` |
| `deals.ts` | `moverDeal()`, `atualizarDeal()` |
| `financeiro.ts` | `criarContrato()`, `confirmarPagamento()`, `confirmarSinalPago()`, `getContratoByDeal()` |
| `experiencia.ts` | `registrarContato()`, `atualizarExperiencia()`, `escalonarCEO()`, `getExperiencias()`, `getContatosExperiencia()` |
| `escolas.ts` | `criarEscola()`, `atualizarEscola()`, `sugerirEscolas()`, `calcularMatch()`, `adicionarEstrategia()`, `atualizarResultadoEscola()` |
| `automacoes.ts` | `criarTarefa()`, `marcarTarefaConcluida()`, `getNotificacoesNaoLidas()`, `marcarNotificacaoLida()`, `marcarTodasNotificacoesLidas()` |
| `documentos.ts` | `listarDocumentos()`, `adicionarDocumento()`, `atualizarStatusDocumento()` |
| `faq.ts` | `listarArtigos()`, `buscarArtigos()`, `salvarArtigo()`, `registrarAcesso()` |
| `whatsapp.ts` | `enviarWhatsAppManual()`, `enviarConviteReuniao()` |
| `calendario.ts` | `registrarLinkCalendario()`, `verificarReunioesPendentes()` |
| `indicacoes.ts` | `marcarRecompensaEntregue()` |
| `configuracoes.ts` | `getConfiguracoes()`, `atualizarConfiguracao()`, `atualizarMultiplasConfiguracoes()` |

### Infraestrutura de Suporte

| Item | Arquivo | Descricao |
|---|---|---|
| Auth RBAC | `src/lib/crm/auth.ts` | `getSession()`, `getUserProfile()`, `getUserPapel()`, `requireAuth()`, `requirePapel()` |
| Supabase Server | `src/lib/crm/supabase-server.ts` | Client server-side para server components |
| Supabase Browser | `src/lib/crm/supabase-browser.ts` | Client client-side para componentes interativos |
| Supabase Audit | `src/lib/crm/supabase-audit.ts` | Wrapper que chama `set_audit_user()` RPC antes de operacoes |
| Alertas | `src/lib/crm/automacoes/verificar-alertas.ts` | 5 verificacoes automaticas de alertas do pipeline |

---

### Pós-Fases — Automação Completa (2026-04-02/03)

| Item | Status |
|------|--------|
| Auto-promoção QUENTE/MORNO na qualify-lead | ✅ Implementado |
| Campos Gemini separados (qualificado_gemini, etc.) | ✅ Migration aplicada |
| Campos reunião no deals (reuniao_agendada_at, link, data) | ✅ Migration aplicada |
| process-followup move deal para reuniao_marcada | ✅ Implementado |
| 58 leads existentes migrados para pipeline | ✅ Migration aplicada |
| BAUSA Engine integrado com Supabase real | ✅ 20 páginas |
| Pipeline Kanban com drag-drop + DealDetailSheet 4 abas | ✅ Implementado |
| Separação Lead Score vs Qualificação Gemini na UI | ✅ Implementado |

---

## Divida Tecnica e Limitacoes Conhecidas

### Prioridade Alta

1. **Filtro por safra no War Room** — O campo `safra` existe em `deals` e `atletas`, mas a UI do War Room nao tem seletor de safra. Todas as metricas mostram dados globais.

2. **Regua de cobranca automatica** — A configuracao esta completa (`configuracoes_sistema`), mas nao existe Cloud Function scheduler para executar a regua. Atualmente e manual.

3. **Horario seguro e fallback de canal** — Timers configurados, mas sem enforcement no codigo de envio de mensagens. Mensagens podem ser enviadas fora do horario seguro.

4. **Tratamento de erros em actions** — Alguns `catch` blocks estao vazios ou silenciosos (ex: `atualizarResultadoEscola` ao atualizar contadores). Precisa de logging estruturado.

5. **`any` types em components** — Varios componentes usam `as any` para dados do Supabase. Idealmente, types gerados automaticamente (`supabase gen types`) resolveriam.

### Prioridade Media

6. **Relatorio semanal automatico** — Spec menciona "relatorio semanal automatico (segunda 8h)" para reuniao CEO-Head. Nao implementado — requer Cloud Function ou cron.

7. **NPS automatico** — Campo `nps_6meses` existe na tabela, mas nao ha automacao para envio de pesquisa NPS. Registro e manual.

8. **Retencao segundo ano** — Campo `retencao_segundo_ano` existe, mas sem fluxo automatizado de acompanhamento.

9. **Indicacao automatica por NPS** — Spec menciona "NPS >= 8 → solicita indicacao automaticamente". Nao implementado — rastreamento e manual.

10. **Metas customizaveis por mes** — Configuracao `meta_mensal_padrao` e fixa. Nao ha tabela de metas por mes para sazonalidade.

11. **Pipeline health ratio** — Configuracao existe (`pipeline_health_ratio`), mas o War Room nao calcula nem exibe alerta de pipeline insuficiente.

### Prioridade Baixa

12. **Rate limiting em actions** — Nenhum rate limiting nas server actions do CRM. Potencial para abuso se auth for comprometido.

13. **Testes automatizados** — Nenhum teste unitario ou de integracao para as server actions ou components do CRM.

14. **Busca full-text em FAQ** — Usa `ilike` ao inves de `to_tsvector/tsquery` do PostgreSQL. Funciona para volume baixo, mas nao escala.

15. **Conciliacao GetNet** — Spec menciona "conciliacao manual no MVP". Apenas confirmacao manual de pagamento implementada.

---

## Proximos Passos

### Configuracao Externa (Obrigatorio para Producao)

- [ ] Criar usuarios no Supabase Auth e vincular a `user_profiles` (CEO + Head de Sucesso)
- [ ] Configurar variaveis de ambiente no Vercel para o CRM (Supabase URL, keys)
- [ ] Configurar `SEND_WHATSAPP_URL` e `WEBHOOK_SECRET` para envio de WhatsApp pelo CRM
- [ ] Configurar `CALENDLY_URL` para convites de reuniao
- [ ] Executar migrations no Supabase (`supabase db push`)
- [ ] Testar fluxo completo: login → leads → promover → pipeline → contrato → sinal → experiencia

### Melhorias de Curto Prazo

- [ ] Adicionar filtro por safra no War Room e Relatorios
- [ ] Implementar pipeline health ratio com alerta visual
- [ ] Adicionar validacao de horario seguro no envio de WhatsApp
- [ ] Gerar types do Supabase para eliminar `any` casts
- [ ] Implementar busca/filtro na pagina de Leads (por classificacao, data, nome)

### Integracoes Pendentes

- [ ] Cloud Function para regua de cobranca automatica (scheduler diario)
- [ ] Webhook Calendly para detectar agendamentos e mover deal automaticamente
- [ ] Webhook DocuSign/ClickSign para confirmacao de assinatura digital
- [ ] Cloud Function para relatorio semanal automatico (segunda 8h)
- [ ] Automacao NPS: envio de pesquisa 6 meses apos embarque

### Monitoramento e Observabilidade

- [ ] Cloud Monitoring dashboards para CRM (erros, latencia, uso)
- [ ] Alertas automaticos para falhas em server actions
- [ ] Logging estruturado em todas as actions (correlation ID, timestamps)
- [ ] Dashboard de uso: quais paginas/actions sao mais acessadas

### Escalabilidade (Quando Crescer)

- [ ] Papel RBAC `comercial` — hoje existe no enum mas sem uso pratico
- [ ] Distribuicao automatica de leads entre comerciais
- [ ] Metas individuais por usuario
- [ ] Visao por equipe nos relatorios
- [ ] Aprovacoes hierarquicas para operacoes sensiveis

---

## Visao de Crescimento

| Fase | Cenario | Impacto no Sistema |
|---|---|---|
| Atual | CEO + Head (2 usuarios). ~6 contratos/mes. | MVP implementado. RBAC com 2 papeis ativos. |
| Crescimento 1 | +1 comercial. ~10 contratos/mes. | Ativar papel `comercial` no RBAC. Pipeline com multiplos responsaveis. |
| Crescimento 2 | 2 comerciais + 1 assist. sucesso. ~15/mes. | Distribuicao de leads. Metas individuais. Visao por equipe. |
| Crescimento 3 | 6-10 pessoas. Operacao estruturada. | Aprovacoes. Hierarquia. Relatorios por equipe. |

---

## Safras / Ciclos

O negocio opera em ciclos anuais (ano letivo americano):

- **Fall** (agosto) e **Spring** (janeiro)
- Cada atleta vinculado a uma safra (campo em `atletas` e `deals`)
- War Room filtravel por safra (pendente de implementacao na UI)
- Relatorios comparativos entre safras (pendente)
- Planejamento de capacidade: atletas por safra vs capacidade operacional (pendente)

---

## Evolucao Pos-CRM

### Classificacao por Timing (15/05/2026) ✅

Tres fluxos diferenciados a partir de `school_year`:

| timing_status | Criterio | WhatsApp inicial | Deal | Retomada |
|---|---|---|---|---|
| `ideal` | 9º ano ate graduated_last_year | `initial` (22h) + follow-up 48h/7d | etapa `lead` | — |
| `muito_cedo` | `before_7th` | `early_potential` (48h) | etapa `aguardando_timing` | `scheduled_return` em 1º nov do ano seguinte |
| `tarde_demais` | `graduated_2plus` | `late_timing` (48h) | etapa `perdido` (`motivo_perda=timing`) | — |

- Migration `20260515000000` (colunas `timing_status`, `scheduled_followup_at`, `scheduled_followup_sent_at` + enum `aguardando_timing`).
- Nova Cloud Function `process-scheduled-followups` (cron diario 08:00 BRT).
- Pipeline: coluna roxa `Aguardando Timing`; leads `tarde_demais` saem do Kanban (motivo_perda=timing).
- So leads QUENTE/MORNO recebem mensagem automatica (FRIO nunca, em qualquer timing).

### Incidentes resolvidos (15–18/05/2026)

| # | Incidente | Causa raiz | Correcao |
|---|---|---|---|
| 1 | Leads FRIO + timing alt receberam `early_potential`/`late_timing` | Bucket B de `process-pending-whatsapp` sem filtro de classificacao | PR #40/#41 — filtro `classification IN (QUENTE,MORNO)` no Bucket B |
| 2 | Leads `muito_cedo`/`tarde_demais` receberam follow-up "agende reuniao" | `fetchFollowupLeads` sem filtro `timing_status` | PR #42/#43 — filtro `timing ideal/null` no follow-up |
| 3 | Branch `develop` deletada acidentalmente | `--delete-branch` em PR `develop→main` | Restaurada de `main`; regra documentada no CLAUDE.md |

**Garantia anti-regressao:** guard `functions/__guards__/scheduler-eligibility.test.js` (job CI `Scheduler Eligibility Invariants`) — bloqueia merge se um filtro de elegibilidade sumir de qualquer scheduler. Validado: detecta a ausencia e falha o build.

### Hardening de processo (18/05/2026) ✅

- Branch policies: `prd` so deploya de `main`, `uat` so de `develop`.
- Decisao consciente de **nao** usar required reviewers (repo solo — gate manual atrapalha hotfix; qualidade fica no CI + review de PR + UAT). Reavaliar quando o time crescer.
