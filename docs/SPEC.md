# SPEC.md — CRM Bolsa Atleta USA (BAUSA)

> Especificacao completa do sistema CRM. Cada modulo e um H2 independente.
> Referencia cruzada: `BUSINESS_RULES.md` (scoring/match), `CONTEXT.md` (produto).

---

## Modulo 1: Entrada de Leads

### Origens

| Origem | Fase | Tipo |
|---|---|---|
| Formulario web (webhook) | MVP | Automatico |
| Instagram / Meta Ads | Fase 2 | Automatico |
| Indicacao | MVP | Manual |
| Outros | MVP | Manual |

### Dados do Lead — Atleta

| Campo | Tipo | Obrigatorio | Regra / Observacao |
|---|---|---|---|
| Nome completo | Texto | Sim | |
| Data de nascimento | Data | Sim | Idade calculada automaticamente |
| WhatsApp | Telefone | Sim | Formato E.164 (+55...) |
| Email | Email | Nao | |
| Instagram | Texto | Nao | Handle sem `@` |
| Serie / Ano | Select | Sim | 9th, 10th, 11th, 12th, PG Year |
| Video highlights | URL | Nao | YouTube / Hudl / Drive |

### Dados do Lead — Educacao

| Campo | Tipo | Obrigatorio |
|---|---|---|
| Escola atual | Texto | Nao |
| Cidade / Estado | Texto | Sim |
| Modelo educacional | Select | Nao |
| Desempenho academico | Select (Excelente / Bom / Regular / Fraco) | Sim |
| Nivel de ingles | Select (Nenhum / Basico / Intermediario / Avancado / Fluente) | Sim |

### Dados do Lead — Esporte

| Campo | Tipo | Obrigatorio |
|---|---|---|
| Esporte | Select (lista fixa + "Apenas Academico") | Sim |
| Posicao | Texto | Nao |
| Historico de clubes | Texto longo | Nao |
| Conquistas | Texto longo | Nao |
| Nivel competitivo | Select (Escolar / Escolinha / Clube Social / Base Baixo / Base Medio / Base Alto / Selecao) | Sim |

### Dados do Lead — Projeto

| Campo | Tipo | Obrigatorio | Regra / Observacao |
|---|---|---|---|
| Momento de inicio | Select (Proximo semestre / Proximo ano / 2+ anos) | Sim | |
| Direcao do projeto | Texto | Nao | |
| Comprometimento | Select (Alto / Medio / Baixo / Indefinido) | Sim | |
| Decisao familiar | Select (Decidida / Em discussao / Resistente) | Sim | |
| Faixa de investimento | Select (Ate 20k / 20-30k / 30-40k / 40k+) | Sim | |
| Safra (embarque) | Select (Fall 2026 / Spring 2027 / Fall 2027 / ...) | Sim | |

### Dados do Lead — Responsavel

| Campo | Tipo | Obrigatorio |
|---|---|---|
| Nome completo | Texto | Sim |
| Profissao | Texto | Nao |
| Telefone | Telefone | Sim |
| Email | Email | Sim |
| Parentesco | Select (Pai / Mae / Outro) | Nao |

### Dados do Lead — Endereco

| Campo | Tipo | Obrigatorio | Regra / Observacao |
|---|---|---|---|
| CEP | Texto | Nao | Auto-fill via ViaCEP / BrasilAPI |
| Cidade | Texto | Sim | |
| Estado | Select (UFs) | Sim | |
| Rua | Texto | Nao | |

### Dados do Lead — Indicacao

| Campo | Tipo | Obrigatorio | Regra / Observacao |
|---|---|---|---|
| Indicado por | Relacao (lead/cliente) | Se origem = Indicacao | |
| Tipo indicador | Select | Se origem = Indicacao | |

### Dados do Lead — LGPD

| Campo | Tipo | Obrigatorio | Regra / Observacao |
|---|---|---|---|
| Consentimento LGPD | Checkbox + data | Sim | Timestamp do aceite |
| Aceite WhatsApp | Checkbox | Sim | |
| Aceite email | Checkbox | Sim | |

### Automacao: Convite de Agendamento (22h)

| Item | Valor |
|---|---|
| **Delay** | 22 horas apos criacao do lead |
| **Canal primario** | WhatsApp Business API |
| **Fallback** | Email (se WhatsApp falhar em 1h) |
| **Conteudo** | Nome atleta, esporte, link Calendly customizado |
| **Horario seguro** | Se 22h cair entre 21h-08h → agendar para 09h do dia seguinte |

### Automacao: Follow-up

| Gatilho | Tempo | Acao |
|---|---|---|
| Nao marcou reuniao apos convite | 24h | Tarefa "Follow-up agendamento" ao CEO |
| Lead qualificado sem reuniao | 24h | Alerta War Room |
| Sem resposta ao primeiro follow-up (WhatsApp) | 48h | Segundo follow-up via email |

---

## Modulo 2: Pipeline Comercial

### 14 Etapas

| # | Etapa | Criterio de Transicao | Conversao Esperada |
|---|---|---|---|
| 1 | Lead | Lead cadastrado e qualificado | — |
| 2 | Reuniao Marcada | Calendly confirmou | 60-70% |
| 3 | Reuniao Realizada | Manual ou webhook | 80-90% |
| 4 | Diagnostico / Fit Confirmado | Perfil compativel | 70-80% |
| 5 | Alinhamento Estrategico | Familia + CEO alinham escolas | — |
| 6 | Proposta Enviada | Proposta formal com plano | 60-70% |
| 7 | Follow-up Proposta | Follow-up realizado | — |
| 8 | Negociacao | Familia avaliando / ajustando | — |
| 9 | Contrato Enviado | ClickSign / DocuSign enviado | — |
| 10 | Contrato Assinado | Assinatura confirmada | 40-50% (do 6) |
| 11 | Sinal Pago | Entrada confirmada (Pix / GetNet) | 90-95% |
| 12 | Admission Process | Processo de admissao iniciado | — |
| 13 | Concluido | Atleta embarcou | — |
| 14 | Perdido | Desistiu / desqualificado | — |

### Campos do Negocio (Deal)

| Campo | Tipo | Obrigatorio | Regra |
|---|---|---|---|
| Valor estimado | R$ | Sim | Auto-preenchido pelo plano |
| Probabilidade | % | Sim | Sugerida pela etapa |
| Status decisao familia | Select | Sim | Decidida / Discussao / Resistente |
| Notas reuniao | Texto longo | Se reuniao realizada | Obrigatorio apos reuniao |
| Next Action | Texto | Sempre | Bloqueia transicao se vazio |
| Data proxima acao | Data | Sempre | Alerta se vazio ou vencida |
| Motivo de perda | Select + texto | Se Perdido | Categorizado |

### Motivos de Perda

| Campo | Tipo | Regra |
|---|---|---|
| Motivo principal | Select | Financeiro / Timing / Desistencia / Nao qualificado / Concorrencia / Outro |
| Detalhe | Texto | Livre |
| Pode reativar? | Booleano | Se Sim → data de reativacao obrigatoria |

### Automacoes Comerciais

| Gatilho | Tempo | Acao |
|---|---|---|
| Lead sem acao (Next Action vazio ou vencido) | 48h | Alerta in-app + email |
| Reuniao realizada sem proposta | 12h | Tarefa: "Preparar proposta" |
| Alinhamento sem avanco | 3 dias | Alerta + tarefa |
| Proposta sem follow-up | 48h | Tarefa: "Follow-up proposta" |
| Negociacao parada | 4 dias | Alerta War Room + tarefa |
| Contrato enviado sem assinatura | 48h | Alerta + follow-up WhatsApp |
| Contrato assinado sem sinal | 48h | Alerta + tarefa cobranca |
| Deal sem Next Action | Imediato | Bloqueia transicao de etapa |

### Leads Futuros (Arquivo)

| Campo | Tipo | Regra |
|---|---|---|
| Status | Fixo | "Arquivado — Projeto Futuro" |
| Ano do projeto | Select | Obrigatorio |
| Data de reativacao | Data | Obrigatoria — cria tarefa automatica |
| Observacao | Texto | Livre |

---

## Modulo 3: Gestao Financeira

### Planos

| Plano | Valor Padrao | Valor Pix | Psicologia Inclusa |
|---|---|---|---|
| Journey | R$ 26.000 | R$ 23.000 | Sim |
| Legacy | R$ 32.000 | R$ 28.500 | Sim |
| Start | R$ 18.000 | R$ 16.000 | Nao |

> Entrada padrao: R$ 4.500 (editavel pelo CEO).
> Metodos de pagamento: Pix ou GetNet.

### Contrato Financeiro

| Campo | Tipo | Regra |
|---|---|---|
| Plano | Select (Journey / Legacy / Start) | Obrigatorio |
| Forma pagamento | Select (Pix / GetNet) | Obrigatorio |
| Valor total | R$ (calculado) | Auto — plano x forma pagamento |
| Entrada | R$ | Padrao R$ 4.500, editavel |
| Forma entrada | Select (Pix / GetNet) | Obrigatorio |
| Entrada paga? | Booleano | |
| Saldo | R$ (calculado) | Valor total - Entrada |
| Forma saldo | Select (Pix / GetNet) | Obrigatorio |
| Parcelamento saldo | Numero | Quantidade de parcelas |
| Status ClickSign | Select | Pendente / Enviado / Assinado |

### Agenda de Recebiveis

| Campo | Tipo | Regra |
|---|---|---|
| Cliente | Relacao (deal) | |
| Tipo | Select | Entrada / Parcela |
| Parcela | Numero (#) | |
| Valor | R$ | |
| Vencimento | Data | |
| Metodo | Select | Pix / GetNet |
| Status | Select | Previsto / Recebido / Atrasado |
| Data recebimento | Data | |
| Comprovante | Arquivo | |

### Controle de NF

| Campo | Tipo | Regra |
|---|---|---|
| Status NF | Select | Pendente / Emitida / N/A |
| Numero NF | Texto | |
| Data emissao | Data | |
| Valor | R$ | |
| Observacao | Texto | |

### Custos Fixos (editaveis pelo CEO)

| Item | Descricao |
|---|---|
| Head | Salario / pro-labore |
| IA | Ferramentas de IA |
| Designer | Design / marketing |
| Outros | Custos administrativos |

### Custos Variaveis

| Item | Valor | Regra |
|---|---|---|
| Psicologa | R$ 1.200 (editavel) | Apenas planos Journey e Legacy |

### Lucro por Cliente

```
Lucro estimado = Receita do deal
               - Custos variaveis do deal
               - (Custos fixos mensais / contratos ativos no mes)
```

### Customizacao por Deal

> Apenas CEO. Todas as alteracoes exigem justificativa e geram audit trail.

| Campo customizavel | Regra |
|---|---|
| Valor total | Desconto em R$ ou % |
| Entrada | Valor diferente do padrao |
| Parcelas | Quantidade customizada |
| Forma pagamento | Diferente do padrao |
| Servicos adicionais | Incluir/remover |
| Datas vencimento | Ajustar calendario |

> Flag visual "Valores customizados" exibida no deal.

### Servicos Adicionais Avulsos

| Campo | Tipo |
|---|---|
| Nome | Texto |
| Valor | R$ |
| Recorrencia | Select (Unico / Mensal / Semestre) |
| Ativo? | Booleano |

### Cancelamento e Reembolso

**Workflow (7 etapas):**

1. Solicitacao de cancelamento registrada
2. Analise pelo CEO (motivo + documentacao)
3. Calculo de reembolso (proporcional, conforme contrato)
4. Aprovacao CEO
5. Execucao financeira (estorno)
6. Atualizacao de status do deal → Perdido
7. Registro completo no audit trail

| Campo | Tipo | Regra |
|---|---|---|
| Motivo cancelamento | Select + texto | Obrigatorio |
| Data solicitacao | Data | Auto |
| Valor reembolso | R$ | Calculado |
| Status reembolso | Select | Pendente / Aprovado / Executado / Negado |
| Data execucao | Data | |
| Comprovante estorno | Arquivo | |
| Aprovado por | Usuario | Auto (CEO) |

---

## Modulo 4: Banco de Escolas

### Dados Institucionais

| Campo | Tipo | Obrigatorio |
|---|---|---|
| Nome | Texto | Sim |
| Estado US | Select (50 estados) | Sim |
| Cidade | Texto | Sim |
| Tipo | Select (Boarding / Day / Mista) | Sim |
| Status | Select (Ativa / Inativa / Em analise) | Sim |
| Website | URL | Nao |
| Contato principal | Texto | Nao |
| Notas internas | Texto longo | Nao |

### Regras Financeiras

| Campo | Tipo |
|---|---|
| Budget minimo (USD) | Numero |
| Budget forte (USD) | Numero |
| Agressividade de bolsa | Select (Alta / Media / Baixa / Rara) |
| Regra pratica BAUSA | Texto |

### Regras Academicas

| Campo | Tipo |
|---|---|
| Ingles minimo | Select |
| Testes exigidos | Multi-select (Duolingo / PSAT / SSAT / TOEFL / etc.) |
| Nota minima Duolingo | Numero |
| Nota minima PSAT | Numero |
| Nota minima SSAT | Numero |
| GPA minimo | Numero |

### Regras Esportivas

| Campo | Tipo |
|---|---|
| Esportes oferecidos | Multi-select |
| Influencia esporte | Select (Decisiva / Forte / Moderada / Baixa) |
| Aceita excecao elite? | Booleano |
| Nota | Texto |

### Regras por Serie

| Campo | Tipo |
|---|---|
| Serie preferencial | Multi-select (9th / 10th / 11th / 12th / PG) |
| Serie maxima | Select |
| Nota | Texto |

### Deadlines e Calendario

| Campo | Tipo |
|---|---|
| Deadline fall | Data |
| Deadline spring | Data |
| Rolling admission? | Booleano |
| Tempo medio resposta | Numero (dias) |

### Historico Institucional (automatico)

| Metrica | Tipo | Regra |
|---|---|---|
| Atletas aplicados | Numero | Calculado automaticamente |
| Taxa aceitacao | % | Calculado |
| Bolsa media | USD | Calculado |
| Tempo medio resposta | Dias | Calculado |

### Relacionamento BAUSA <-> Escola

| Campo | Tipo |
|---|---|
| Officer name | Texto |
| Officer email | Email |
| Officer phone | Telefone |
| Temperatura relacionamento | Select (Forte / Bom / Neutro / Frio) |
| Ultimo contato | Data |
| Proximo contato | Data |
| Tipo contato | Select |
| Timeline de contatos | Lista (automatica) |
| Notas | Texto longo |

### Alertas de Relacionamento

| Gatilho | Acao |
|---|---|
| Sem contato ha 90 dias | Alerta ao CEO |
| Deadline em 30 dias sem atleta aplicado | Alerta ao CEO |
| Novo officer detectado | Lembrete para atualizar contato |

---

## Modulo 5: Motor de Match

> Referencia completa de scoring: `BUSINESS_RULES.md`

### Estrategia por Atleta (pos-sinal)

| Campo | Tipo | Regra |
|---|---|---|
| Escola | Relacao (banco de escolas) | |
| Match score | Numero (calculado) | Algoritmo em `BUSINESS_RULES.md` |
| Prioridade | Select | 1a Opcao / 2a Opcao / 3a Opcao / Safety |
| Status | Select | Planejada / Aplicada / Em analise / Aceita / Rejeitada |
| Bolsa estimada | USD | |
| Bolsa obtida | USD | |
| Data aplicacao | Data | |
| Data resposta | Data | |
| Resultado | Select | Aceito / Rejeitado / Waitlist / Withdrawn |
| Observacao | Texto | |

---

## Modulo 6: CRM Experiencia da Familia

### Handoff Comercial → Experiencia (5 etapas)

1. Deal atinge etapa "Sinal Pago"
2. Sistema cria registro de Experiencia automaticamente
3. Dados herdados: Atleta, Educacao, Responsavel, Endereco, Plano, Escolas-alvo, Historico de interacoes, Documentos, Indicacao
4. Head de experiencia e notificado
5. Primeira tarefa automatica: "Contato de boas-vindas"

### Fases da Experiencia

| Fase | Descricao | Alerta inatividade |
|---|---|---|
| Admissao | Aplicacao em andamento | 7 dias |
| Aprovado | Aceito em 1+ escola | — |
| Pre-embarque | Preparacao (visto, passagem, documentos) | 15 dias |
| Embarcado (0-90d) | Adaptacao critica | 7 dias |
| Acompanhamento | Apos 90 dias | 30 dias |
| Encerrado | Contrato finalizado | — |

### Controle de Contato

| Campo | Tipo | Regra |
|---|---|---|
| Data ultimo contato | Data | Auto |
| Tipo | Select | WhatsApp / Email / Ligacao / Reuniao |
| Resumo | Texto | Obrigatorio |
| Proximo contato | Data | Obrigatorio |
| Dias sem contato | Numero (calculado) | Alerta conforme fase |

### Indicadores Pos-Embarque

| Indicador | Tipo | Regra |
|---|---|---|
| Retencao 2o ano | Booleano | |
| Transferencia? | Booleano | |
| NPS 6 meses | Numero (0-10) | Envio automatico |
| Indicacoes geradas | Numero (calculado) | |
| Testemunho | Texto | Solicitado automaticamente se NPS >= 9 |

### Dashboard do Head

> ⚠️ **UX CRITICA:** tela mais simples da aplicacao. Abrir → ver o que fazer → registrar em 3 cliques → sair.

| Bloco | Conteudo |
|---|---|
| Tarefas do dia | Lista ordenada por prioridade |
| Familias precisando contato | Ordenadas por dias sem contato (desc) |
| Atencao / crise | Flags vermelhos |
| Proximos contatos | Visao semanal |
| Admissoes ativas | Status por atleta |
| Meu desempenho | Metricas do Head |

### Notas Internas CEO <-> Head

| Campo | Regra |
|---|---|
| Timestamp + autor | Automatico |
| Visibilidade | Restrita (CEO + Head) |
| Mencoes | @CEO / @Head |
| Anexos | Permitidos |

### Relatorio Semanal Automatico (segunda 8h)

| Secao | Conteudo |
|---|---|
| Saude geral | Resumo por fase |
| Atencao / crise | Familias em risco |
| Contatos pendentes | Lista |
| Tarefas | Pendentes + atrasadas |
| Indicadores | NPS, retencao, indicacoes |
| Admissoes | Status atualizado |
| NPS | Media e distribuicao |

---

## Modulo 7: War Room Executivo

### Layout (topo para baixo)

| Posicao | Bloco | Conteudo |
|---|---|---|
| Topo (fixo) | Banner alertas criticos | Vermelho. Crises, inadimplencia D+7, deals travados. Clicavel. |
| Linha 1 | Receita vs Meta (4 cards) | Fechada, recebida, pipeline provavel, gap |
| Linha 2 esq | Proximas acoes | Top 15 tarefas: atrasadas → criticas → alta |
| Linha 2 dir | Receita em risco | Sem sinal, atrasadas, negociacao travada, propostas, NFs |
| Linha 3 esq | Pipeline health | Total, provavel, ratio vs meta, deals sem action |
| Linha 3 dir | Funil conversao | Taxa real vs meta por etapa |
| Linha 4 | Leads prioritarios | Top 10: score x probabilidade x next action |
| Linha 5 | Saude experiencia | 5 cards: verde / amarelo / vermelho, medias |
| Abaixo dobra | Financeiro resumido | Receita bruta, inadimplencia, NFs, previsao 30d |

### Calculos de KPIs

**Receita:**

```
Receita fechada     = SUM(valor) WHERE etapa >= Contrato Assinado AND mes = atual
Receita recebida    = SUM(recebiveis) WHERE status = Recebido AND mes = atual
Pipeline provavel   = SUM(valor * probabilidade) WHERE etapa IN (2..9)
Gap                 = Meta mensal - Receita fechada
```

**Pipeline health:**

```
Total pipeline      = COUNT(deals) WHERE etapa IN (1..11)
Pipeline provavel   = SUM(valor * probabilidade)
Ratio vs meta       = Pipeline provavel / Meta mensal
Deals sem action    = COUNT(deals) WHERE next_action IS NULL OR data_proxima_acao < NOW()
```

**Receita em risco:**

| Item | Calculo |
|---|---|
| Sem sinal | Deals etapa 10 (contrato assinado) com sinal pendente ha 48h+ |
| Atrasadas | Recebiveis com status = Atrasado |
| Negociacao travada | Deals etapa 8 sem avanco ha 4+ dias |
| Propostas | Deals etapa 6-7 sem follow-up ha 48h+ |
| NFs pendentes | Contratos com NF status = Pendente |

**Leads prioritarios:**

```
Ranking = lead_score * probabilidade_etapa * urgencia_next_action
Top 10 exibidos
```

**Saude experiencia:**

| Card | Logica cor |
|---|---|
| Verde | Dias sem contato <= limite fase |
| Amarelo | Dias sem contato entre limite e 2x limite |
| Vermelho | Dias sem contato > 2x limite OU flag crise |

### Metas (editaveis pelo CEO)

| Metrica | Valor Padrao | Editavel |
|---|---|---|
| Meta anual | R$ 1.500.000 | Sim |
| Meta mensal | R$ 125.000 | Sim (por mes) |
| Ticket medio | R$ 23.000 | Sim |
| Contratos / mes | 6 | Sim |

---

## Modulo 8: Tarefas

### Campos

| Campo | Tipo | Regra |
|---|---|---|
| Titulo | Texto | Obrigatorio |
| Descricao | Texto longo | |
| Responsavel | Usuario | Obrigatorio |
| Prazo | Data | Obrigatorio |
| Prioridade | Select | Critica / Alta / Media / Baixa |
| Status | Select | Pendente / Em andamento / Concluida / Atrasada / Cancelada |
| Lead / Familia | Relacao | |
| Modulo origem | Select | Auto-preenchido |
| Criada por | Select | Auto (sistema) / Manual |
| Recorrencia | Select | Nenhuma / Diaria / Semanal / Mensal |
| Comentarios | Lista | Timestamp + autor |

---

## Modulo 9: Documentos

### Checklist por Atleta x Escola

| Campo | Tipo | Regra |
|---|---|---|
| Tipo | Select | Transcrito / Passaporte / Visto / Teste / Carta / Formulario / Outro |
| Status | Select | Pendente / Enviado / Revisado / Enviado a escola / Aprovado |
| Arquivo | Upload | |
| Data upload | Data | Auto |
| Data envio escola | Data | |
| Observacao | Texto | |

### Alertas de Documentos

| Gatilho | Acao |
|---|---|
| Documento pendente ha 7 dias | Alerta ao responsavel |
| Deadline da escola em 14 dias | Alerta ao CEO + Head |
| Todos documentos enviados | Notifica CEO |

---

## Modulo 10: Notificacoes

### Canais

| Canal | Audiencia |
|---|---|
| In-app | Todos os usuarios |
| Email | Digest 9h + criticos imediatos |
| WhatsApp | Familias (comunicacao externa) |

### Matriz de Severidade

| Severidade | Entrega |
|---|---|
| Critica | Imediato: in-app + email |
| Alta | Imediato: in-app + email |
| Media | Digest 9h |
| Baixa | Digest 9h |

> Apenas CEO pode silenciar notificacoes.

### Fallback

| Falha | Acao |
|---|---|
| WhatsApp falha em 1h | Envia por email |
| Email bounce | Cria tarefa para contato telefonico |

### Templates

| # | Template | Canal | Variaveis |
|---|---|---|---|
| 1 | Convite agendamento | WhatsApp + Email | nome_atleta, esporte, link_calendly |
| 2 | Follow-up agendamento | WhatsApp | nome_atleta, esporte |
| 3 | Follow-up agendamento (email) | Email | nome_atleta, esporte, link_calendly |
| 4 | Proposta enviada | Email | nome_responsavel, plano, valor |
| 5 | Contrato enviado | Email + WhatsApp | nome_responsavel, link_clicksign |
| 6 | Pagamento confirmado | Email + WhatsApp | nome_responsavel, valor, parcela |
| 7 | Lembrete pagamento | WhatsApp + Email | nome_responsavel, valor, vencimento |
| 8 | NPS 6 meses | Email | nome_responsavel, nome_atleta, link_nps |

---

## Modulo 11: Audit Trail

### Eventos Rastreados

| Evento | Dados registrados |
|---|---|
| Criacao | Entidade, campos, usuario, timestamp |
| Alteracao de campo | Campo, valor anterior, valor novo, usuario, timestamp |
| Transicao de etapa | Etapa anterior, etapa nova, usuario, timestamp |
| Alteracao financeira | Campo, valor anterior, valor novo, justificativa, usuario |
| Comunicacao | Canal, destinatario, template, status, timestamp |
| Login / logout | Usuario, IP, timestamp |
| Exclusao (soft) | Entidade, usuario, motivo, timestamp |

### Regras

| Regra | Descricao |
|---|---|
| Append-only | Registros nunca sao editados ou excluidos |
| Retencao | 5 anos |
| Timeline | Visualizacao por lead / familia |
| Exportacao | CSV |

---

## Modulo 12: Configuracoes Admin

### Planos e Valores

| Configuracao | Editavel por |
|---|---|
| Planos (nome, valor, valor Pix) | CEO |
| Entrada padrao | CEO |
| Custos fixos | CEO |
| Custos variaveis | CEO |
| Servicos adicionais | CEO |

### Lead Scoring — Pesos

| Dimensao | Peso padrao | Editavel |
|---|---|---|
| Investimento | 30% | Sim |
| Comprometimento | 25% | Sim |
| Decisao familiar | 20% | Sim |
| Momento inicio | 15% | Sim |
| Nivel competitivo | 10% | Sim |

### Match — Pesos

| Dimensao | Peso padrao | Editavel |
|---|---|---|
| Financeiro | 35% | Sim |
| Academico | 25% | Sim |
| Esportivo | 25% | Sim |
| Serie | 15% | Sim |

### Timers (automacoes)

| Timer | Valor padrao | Editavel |
|---|---|---|
| Convite agendamento | 22h | Sim |
| Follow-up agendamento | 24h | Sim |
| Follow-up proposta | 48h | Sim |
| Negociacao parada | 4 dias | Sim |
| Contrato sem assinatura | 48h | Sim |
| Sinal pendente | 48h | Sim |

### Regua de Cobranca

| Evento | Dias apos vencimento | Acao padrao | Editavel |
|---|---|---|---|
| Lembrete pre | -3 dias | WhatsApp | Sim |
| Vencimento | D+0 | WhatsApp + Email | Sim |
| 1o aviso | D+3 | WhatsApp | Sim |
| 2o aviso | D+7 | WhatsApp + Email + Alerta War Room | Sim |
| Inadimplencia | D+15 | Tarefa CEO | Sim |

### Alertas Experiencia

| Fase | Dias sem contato para alerta | Editavel |
|---|---|---|
| Admissao | 7 | Sim |
| Pre-embarque | 15 | Sim |
| Embarcado (0-90d) | 7 | Sim |
| Acompanhamento | 30 | Sim |

### Metas War Room

| Metrica | Editavel |
|---|---|
| Meta anual | Sim |
| Meta mensal (por mes) | Sim |
| Ticket medio | Sim |
| Contratos / mes | Sim |

### Notificacoes

| Configuracao | Editavel |
|---|---|
| Horario digest | Sim (padrao 9h) |
| Silenciar por tipo | Apenas CEO |
| Canais por template | Sim |

### Pipeline — Etapas

| Configuracao | Editavel |
|---|---|
| Nome da etapa | Sim |
| Conversao esperada | Sim |
| Probabilidade padrao | Sim |
| Campos obrigatorios por etapa | Sim |

### Listas e Selects

| Lista | Editavel |
|---|---|
| Esportes | Sim |
| Series | Sim |
| Motivos de perda | Sim |
| Tipos de documento | Sim |
| Estados US | Nao (fixo) |
| UFs Brasil | Nao (fixo) |

---

## Extras: FAQ Interna

### Campos

| Campo | Tipo | Regra |
|---|---|---|
| Titulo | Texto | Obrigatorio |
| Categoria | Select | Admissao / Financeiro / Esportivo / Academico / Visto / Embarque / Familia / Geral |
| Conteudo | Rich text | Obrigatorio |
| Fase aplicavel | Multi-select | Fases da experiencia |
| Atualizado em | Data | Auto |
| Atualizado por | Usuario | Auto |

### Funcionalidades

| Feature | Descricao |
|---|---|
| Busca | Full-text search |
| Copiar/colar WhatsApp | Botao para copiar resposta formatada |
| Ranking por uso | Mais acessadas no topo |
| Versionamento | Historico de alteracoes |

---

## Extras: Programa de Indicacao

### Campos

| Campo | Tipo | Regra |
|---|---|---|
| Indicado por | Relacao (lead/cliente) | |
| Status | Select | Acompanha status do deal |
| Recompensa devida? | Booleano | Trigger: contrato assinado |
| Recompensa entregue? | Booleano | |

### Metricas

| Metrica | Descricao |
|---|---|
| Taxa de conversao | Indicacoes → contratos |
| CAC por canal | Custo de aquisicao por origem |
| Top indicadores | Ranking por indicacoes convertidas |

### Automacoes

| Gatilho | Acao |
|---|---|
| Contrato assinado (lead indicado) | Notifica indicador + CEO |
| NPS >= 8 | Solicita indicacoes automaticamente |

---

## Extras: LGPD

### Requisitos

| Requisito | Implementacao |
|---|---|
| Consentimento | Checkbox + timestamp em todos os formularios |
| Menor de idade | Consentimento do responsavel legal obrigatorio |
| Exclusao | Direito ao esquecimento — soft delete + anonimizacao |
| Retencao — perdidos | 2 anos apos perda |
| Retencao — clientes | 5 anos apos encerramento |
| Criptografia | Dados sensiveis criptografados em repouso |
| Backup | Diario, retencao 30 dias |
| RBAC | Controle de acesso por papel (CEO / Head / Visualizador) |

### Campos Sensiveis (criptografia obrigatoria)

- Saude emocional (indicadores pos-embarque)
- Dados financeiros (valores, parcelas, comprovantes)
- Documentos (passaporte, visto, transcrito)
- Endereco completo

---

## Extras: Relatorios

| Relatorio | Frequencia | Conteudo | Formato |
|---|---|---|---|
| Comercial | Mensal | Receita, pipeline, conversao, ticket medio, leads por origem | Tela + PDF |
| Escolas | Trimestral | Ranking escolas, bolsas obtidas, tempo resposta, match accuracy | Tela + PDF |
| Experiencia | Mensal | Satisfacao, indicadores ansiedade, crises, NPS, retencao | Tela + PDF |
| Financeiro | Mensal | Receita bruta/liquida, inadimplencia, custos, lucro, NFs | Tela + CSV + PDF |
| Safra | Semestral | Resultado consolidado por ano de embarque | Tela + PDF |
