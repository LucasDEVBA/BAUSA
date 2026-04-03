# Regras de Negocio — CRM Bolsa Atleta USA (BAUSA)

> Documento atualizado com status de implementacao real do codigo.
> Ultima revisao: 2026-04-01

---

## 1. Regras Criticas (Inviolaveis)

### Regra 1: Notificacoes espelhadas ao CEO

> **TODA notificacao gerada para qualquer usuario e espelhada ao CEO. 100% de visibilidade. Sem excecao.**

**Status:** ⚠️ Parcialmente implementado

**Implementacao:**
- A tabela `notificacoes` possui RLS que permite ao CEO ver TODAS as notificacoes (`notif_select` policy em `20260401001300`): `destinatario_id = auth.uid() OR public.get_user_papel() = 'ceo'`.
- O CEO ve tudo via leitura, mas **nao ha duplicacao automatica** (copia espelho como INSERT separado para o CEO). Se a notificacao e destinada apenas ao Head de Sucesso, ela aparece para o CEO via RLS, mas nao como notificacao propria.
- Em `experiencia.ts > confirmarSinalPago()`, notificacoes sao enviadas explicitamente ao CEO e ao Head, mas isso e caso a caso, nao um mecanismo generico.

**O que falta:** Trigger ou middleware que insira automaticamente uma copia de toda notificacao para o `user_id` do CEO (quando `destinatario_id != ceo_id`), garantindo que o CEO receba notificacoes in-app mesmo sem consultar a lista completa.

---

### Regra 2: Next Action obrigatoria para avancar etapa

> **Todo deal DEVE ter "Next Action" e "Data da proxima acao" preenchidos para avancar de etapa. Bloqueia transicao se vazio.**

**Status:** ✅ Implementado

**Implementacao:**
- **Server action `moverDeal()`** em `src/lib/crm/actions/deals.ts` (linhas 38-44): verifica `deal.next_action` e `deal.data_proxima_acao` antes de permitir avanco (`ordemNova > ordemAtual`). Retorna erro se vazio.
- **Trigger `trg_deals_check_etapa`** em `20260401000600`: detecta mudancas de etapa e seta timestamps de marcos, mas a validacao de `next_action` e feita na camada de aplicacao (server action), nao no banco.
- A coluna `next_action` e `data_proxima_acao` estao definidas como nullable na tabela `deals`, com a validacao obrigatoria feita programaticamente.

---

### Regra 3: Apenas CEO customiza valores financeiros

> **So o CEO pode customizar valores financeiros de um deal. Justificativa obrigatoria + audit trail.**

**Status:** ✅ Implementado

**Implementacao:**
- **RLS em `contratos_financeiros`** (`20260401000700`): policies `contratos_ceo` restringe INSERT/UPDATE/DELETE a `get_user_papel() = 'ceo'`.
- **Server action `criarContrato()`** em `src/lib/crm/actions/financeiro.ts` (linha 17): verifica `papel !== "ceo"`.
- **Server action `confirmarPagamento()`** em `financeiro.ts` (linha 139): mesma verificacao.
- **Tabela `contratos_financeiros`**: colunas `valor_customizado` e `justificativa_customizacao` existem. Comentario na migration: "Obrigatoria quando valor difere do padrao do plano (Regra 3)".
- **Flag `flag_valores_customizados`** na tabela `deals` para sinalizar customizacao.
- **Audit trail**: trigger `trg_audit_contratos` em `20260401000800` registra toda alteracao em `audit_logs`.

**Observacao:** A validacao de justificativa obrigatoria quando `valor_customizado != NULL` nao e feita via CHECK constraint no banco — depende da camada de aplicacao. Atualmente o `criarContrato()` nao aceita `valor_customizado` como parametro (usa sempre os valores padrao do plano), entao a customizacao ainda nao tem fluxo de UI implementado.

---

### Regra 4: Apenas CEO pode silenciar notificacoes

> **So o CEO pode silenciar notificacoes. Fernanda nao pode.**

**Status:** ✅ Implementado

**Implementacao:**
- **RLS em `notificacoes`** (`20260401001300`): policy `notif_update` permite UPDATE apenas por `destinatario_id = auth.uid()`. Isso significa que cada usuario so marca como lida as proprias notificacoes.
- **Silenciar** (no sentido de desabilitar notificacoes) seria feito via `preferencias_notificacao` em `user_profiles`. A tabela existe mas o mecanismo de silenciamento nao esta implementado na UI.
- Na pratica, a Head de Sucesso nao tem opcao de silenciar notificacoes no sistema — apenas marcar como lida suas proprias.

---

### Regra 5: Retrocesso de etapa exige justificativa

> **Retrocesso de etapa no pipeline exige justificativa obrigatoria.**

**Status:** ✅ Implementado

**Implementacao:**
- **Server action `moverDeal()`** em `src/lib/crm/actions/deals.ts` (linhas 48-53): detecta retrocesso (`ordemNova < ordemAtual`, excluindo `perdido`, `cancelamento_solicitado`, `projeto_futuro`) e exige `motivo`.
- **Trigger `trg_deals_check_etapa`** em `20260401000600` (linhas 96-100): detecta retrocesso no banco e seta `flag_retrocedido = true`. O comentario na migration diz: "motivo_retrocesso e validado na camada de aplicacao".
- **Campos no banco**: `motivo_retrocesso TEXT` e `flag_retrocedido BOOLEAN NOT NULL DEFAULT false` na tabela `deals`.
- **Audit trail**: trigger `trg_audit_deals` registra a mudanca com `dados_anteriores` e `dados_novos`.

---

### Regra 6: Status Atencao/Crise gera campos obrigatorios + alerta CEO

> **Status "Atencao" ou "Crise" no CRM Experiencia → campos obrigatorios + alerta imediato ao CEO.**

**Status:** ✅ Implementado

**Implementacao:**
- **Server action `atualizarExperiencia()`** em `src/lib/crm/actions/experiencia.ts`:
  - Linhas 80-83: `status === "atencao" || status === "crise"` exige `descricao_problema` nao vazio.
  - Linhas 86-88: `status === "crise"` exige `tipo_crise`.
  - Linhas 127-153: Cria notificacao para o CEO com `severidade: "critica"` (crise) ou `"alta"` (atencao).
- **Funcao `escalonarCEO()`** em `experiencia.ts` (linhas 159-221): permite Head de Sucesso escalonar ao CEO com tarefa critica (prazo 2h) e notificacao.
- **Tabela `crm_experiencia`** (`20260401001200`): campos `descricao_problema`, `acao_em_andamento`, `tipo_crise`, `nivel_crise`, `psicologa_acionada` existem.

---

### Regra 7: Handoff automatico (sinal pago → CRM Experiencia)

> **Quando sinal e pago, registro no CRM Experiencia e criado automaticamente com TODOS os dados do deal.**

**Status:** ✅ Implementado

**Implementacao:**
- **Server action `confirmarSinalPago()`** em `src/lib/crm/actions/financeiro.ts` (linhas 179-290):
  1. Atualiza deal para `etapa: "sinal_pago"` e seta `sinal_pago_at`.
  2. Verifica se ja existe registro em `crm_experiencia` para o atleta.
  3. Se nao existe, cria registro com: `fase: "admissao"`, `temperatura: "verde"`, `ansiedade: 3`, `satisfacao: 5`, `risco_percebido: 1`, `status: "satisfeita"`.
  4. Cria tarefa automatica de onboarding para o Head de Sucesso (prazo 48h, prioridade alta).
  5. Envia notificacoes para CEO e Head de Sucesso.
- **Trigger `confirmarPagamento()`** em `financeiro.ts` (linhas 169-174): ao confirmar parcela de entrada, chama `confirmarSinalPago()` automaticamente.
- **Constraint UNIQUE** em `crm_experiencia.atleta_id` (`20260401001200`) garante 1:1 atleta-experiencia.

---

### Regra 8: Temperatura vermelha automatica

> **Se ansiedade >= 4 ou satisfacao <= 2 → temperatura muda para vermelho automaticamente.**

**Status:** ✅ Implementado (dupla camada)

**Implementacao:**
- **Trigger no banco `trg_experiencia_temp`** em `20260401001400` (versao final, substitui `20260401001200`):
  ```sql
  IF NEW.ansiedade >= 4 OR NEW.satisfacao <= 2 THEN
    NEW.temperatura := 'vermelho';
  ELSIF NEW.ansiedade <= 2 AND NEW.satisfacao >= 4 AND NEW.status = 'satisfeita' THEN
    NEW.temperatura := 'verde';
  ELSE
    NEW.temperatura := 'amarelo';
  END IF;
  ```
  Dispara em `BEFORE INSERT OR UPDATE OF ansiedade, satisfacao, status`.
- **Server action `atualizarExperiencia()`** em `experiencia.ts` (linhas 96-115): replica a mesma logica na aplicacao, calculando temperatura antes do UPDATE. Dupla validacao (aplicacao + banco).
- **Thresholds**: fixos no trigger (4 e 2). Configuracoes em `configuracoes_sistema` (`thresholds_experiencia`) existem para referencia, mas o trigger nao le esses valores dinamicamente por performance.

---

### Regra 9: Audit trail imutavel

> **Audit trail imutavel (append-only). Ninguem edita ou apaga logs. Retencao 5 anos.**

**Status:** ✅ Implementado

**Implementacao:**
- **Tabela `audit_logs`** em `20260401000200`: sem colunas `updated_at` e `deleted_at` (imutavel by design).
- **Triggers de protecao** em `20260401000200`:
  - `trg_audit_logs_prevent_update`: `RAISE EXCEPTION 'audit_logs e imutavel'` em qualquer UPDATE.
  - `trg_audit_logs_prevent_delete`: mesma protecao para DELETE.
  - Funcao `audit.prevent_audit_mutation()` garante imutabilidade mesmo para `service_role`.
- **Funcao generica `audit.log_change()`** em `20260401000200`: captura `tabela`, `registro_id`, `operacao`, `dados_anteriores`, `dados_novos`, `campos_alterados`, `user_id`, `user_papel`.
- **Triggers aplicados** em `20260401000800` para: `user_profiles`, `configuracoes_sistema`, `enderecos`, `responsaveis`, `atletas`, `deals`, `contratos_financeiros`, `parcelas`.
- **Triggers adicionais** em `20260401001200`: `crm_experiencia`, `contatos_experiencia`.
- **Triggers adicionais** em `20260401001300`: `tarefas`.
- **RLS**: apenas CEO pode ler logs (`audit_logs_select`).
- **Retencao 5 anos**: documentada mas sem mecanismo automatico de cleanup (nenhum job de purge implementado).

---

### Regra 10: Deteccao de leads duplicados

> **Deteccao de leads duplicados por WhatsApp/email do responsavel antes de criar novo lead.**

**Status:** ✅ Implementado

**Implementacao:**
- **Server action `promoverLead()`** em `src/lib/crm/actions/leads.ts` (linhas 83-91): verifica se `form_submission_id` ja esta vinculado a algum atleta (impede dupla promocao).
- **Server action `promoverLead()`** em `leads.ts` (linhas 96-106): busca responsavel existente por `whatsapp` antes de criar novo (dedup por WhatsApp).
- **Unique index `idx_responsaveis_whatsapp`** em `20260401000400`: `CREATE UNIQUE INDEX ... ON responsaveis(whatsapp) WHERE deleted_at IS NULL` — impede duplicata no banco.
- **Unique index `idx_responsaveis_email`** em `20260401000400`: mesma protecao por email.
- **Unique constraint `atletas.form_submission_id`** em `20260401000500`: `UNIQUE REFERENCES public.form_submissions(id)` — impede vincular mesmo formulario a dois atletas.
- **Indice trgm `idx_responsaveis_nome`** em `20260401000400`: `USING gin (nome gin_trgm_ops)` — habilitado para busca fuzzy por nome (base para deteccao de similaridade).

**O que falta:**
- Deteccao por `nome_atleta + data_nascimento` (exato) nao esta implementada como constraint.
- Deteccao fuzzy por `nome_responsavel + cidade` nao esta implementada como fluxo de UI.
- Fluxo de UI de "merge", "novo atleta da mesma familia" e "force-create" nao existe ainda.

---

## 2. Lead Score (0–100)

**Status:** ✅ Implementado

**Implementacao principal:** Funcao `public.calcular_lead_score(p_atleta_id UUID)` em `20260401000500_crm_atletas.sql`.

### Algoritmo de Calculo

Os pesos sao lidos dinamicamente de `configuracoes_sistema` (chave `lead_score_pesos`):

| Criterio | Chave no JSON | Peso Padrao | Logica de Calculo |
|---|---|---|---|
| Faixa de investimento | `investimento` | 25 | `40k_mais` = 100% / `30k_40k` = 80% / `20k_30k` = 48% / `ate_20k` = 20% do peso |
| Timing do projeto | `timing` | 20 | `proximo_semestre` = 100% / `proximo_ano` = 60% / `dois_mais_anos` = 25% do peso |
| Nivel de ingles | `ingles` | 15 | `fluente` = 100% / `avancado` = 80% / `intermediario` = 53% / `basico` = 20% / `nenhum` = 0 |
| Desempenho academico | `academico` | 15 | `excelente` = 100% / `bom` = 67% / `regular` = 33% / `fraco` = 0 |
| Nivel competitivo | `competitivo` | 10 | `selecao` = 100% / `base_alto` = 80% / `base_medio` = 60% / `base_baixo` = 40% / `clube_social` = 30% / `escolinha` = 20% / `escolar` = 10% / `apenas_academico` = 0 |
| Comprometimento + familia | `comprometimento` | 10 | `alto+decidida` = 100% / `alto+em_discussao` = 70% / `medio` = 40% / `baixo` = 10% |
| Video highlights | `video` | 5 | Presente e nao vazio = 100% / ausente = 0 |

**Soma dos pesos padrao:** 25 + 20 + 15 + 15 + 10 + 10 + 5 = **100**

### Classificacao

Faixas lidas de `configuracoes_sistema` (chave `lead_score_faixas`):

| Faixa | Threshold Padrao | Classificacao |
|---|---|---|
| >= 70 | `hot` | Hot |
| >= 40 | `warm` | Warm |
| < 40 | — | Cold |

### Trigger Automatico

**Trigger `trg_atletas_lead_score`** em `20260401000500`:
- Dispara em `BEFORE INSERT OR UPDATE OF faixa_investimento, momento_inicio, nivel_ingles, desempenho_academico, nivel_competitivo, comprometimento, decisao_familiar, video_highlights_url`.
- Calcula score, determina classificacao e seta `lead_score`, `lead_classificacao`, `lead_score_calculado_at`.
- Recalcula automaticamente sempre que qualquer campo relevante muda.

### Configurabilidade

Pesos e faixas sao editaveis pelo CEO via tabela `configuracoes_sistema` (seed em `20260401000300`). A funcao le os valores em tempo real (nao hardcoded). Alteracao dos pesos reflete imediatamente em novos calculos.

---

## 3. Motor de Match Atleta–Escola

**Status:** ✅ Implementado

**Implementacao principal:** Funcao `public.calcular_match_score(p_atleta_id UUID, p_escola_id UUID)` em `20260401001600_crm_match_function.sql`.

### 3.1 Filtros Eliminatorios (Hard Filters)

Se qualquer filtro elimina, `RETURN 0` imediatamente.

| Filtro | Implementacao | Codigo |
|---|---|---|
| Escola inativa | `IF _e.status != 'ativa' THEN RETURN 0` | Linha 86 |
| Serie | `IF serie_ordem(atleta) > serie_ordem(escola.serie_maxima) THEN RETURN 0` | Linha 88-89 |
| Budget | `IF faixa_para_usd(atleta) < budget_minimo AND NOT is_elite THEN RETURN 0` | Linha 93-94. Elite = `base_alto` ou `selecao` |
| Esporte | `IF NOT apenas_academico AND esporte NOT IN esportes_oferecidos THEN RETURN 0` | Linhas 96-99. **Excecao Apenas Academico implementada.** |

### 3.2 Scoring Ponderado

| Dimensao | Peso Normal | Peso Apenas Academico | Logica |
|---|---|---|---|
| Financeiro | 30% | 30% | Se `atleta_usd >= budget_forte` → 100. Se entre min e forte → proporcional (20-100). Se `budget_forte <= 0` → 70 (neutro). |
| Academico | 25% | **50%** | Compara `ingles_score(atleta)` vs `ingles_score(escola.ingles_minimo)`. Acima = 100. Abaixo = proporcional. |
| Esportivo | 25% | **0%** | `competitivo_score(nivel) * influencia_mult(escola)`. Valores: decisiva=1.0, forte=0.75, moderada=0.50, baixa=0.25. |
| Serie | 10% | 10% | Preferencial = 100. Aceita = 60. |
| Historico BAUSA | 10% | 10% | `taxa_aceitacao * 1.4`, cap 100. Sem historico (0 aplicados) = 50 (neutro). |

### Funcoes auxiliares

| Funcao | Arquivo | Finalidade |
|---|---|---|
| `serie_ordem(TEXT)` | `20260401001600` | Mapeia serie para inteiro (9th→9, 10th→10, ..., pg_year→13) |
| `faixa_para_usd(TEXT)` | `20260401001600` | Mapeia faixa para valor USD (ate_20k→15000, 20k_30k→25000, 30k_40k→35000, 40k_mais→45000) |
| `ingles_score(TEXT)` | `20260401001600` | Score de ingles 0-100 (nenhum→0, basico→30, intermediario→60, avancado→80, fluente→100) |
| `competitivo_score(TEXT)` | `20260401001600` | Score competitivo 0-100 (apenas_academico→0, escolar→10, ..., selecao→100) |
| `influencia_mult(TEXT)` | `20260401001600` | Multiplicador 0-1 (baixa→0.25, moderada→0.50, forte→0.75, decisiva→1.0) |
| `sugerir_escolas(UUID, INT)` | `20260401001600` | Retorna top N escolas ordenadas por match score |

### Classificacao de Match

| Score | Classificacao |
|---|---|
| 85–100 | Excelente |
| 70–84 | Forte |
| 50–69 | Possivel |
| 0–49 | Fraco |

Constantes definidas em `src/types/crm.ts` (`MATCH_LABELS`) e na funcao `sugerir_escolas`.

---

## 4. CRM Experiencia — Temperatura Automatica

**Status:** ✅ Implementado

### Logica Completa (Trigger `trg_experiencia_temperatura`)

**Migration:** `20260401001400_crm_temperatura_inatividade.sql` (substitui versao simplificada de `20260401001200`).

| Condicao | Temperatura Resultante |
|---|---|
| `ansiedade >= 4 OR satisfacao <= 2` | Vermelho |
| `ansiedade <= 2 AND satisfacao >= 4 AND status = 'satisfeita'` | Verde |
| Qualquer outro caso | Amarelo |

**Trigger:** `BEFORE INSERT OR UPDATE OF ansiedade, satisfacao, status` em `crm_experiencia`.

**Dupla validacao:** A mesma logica e replicada em `src/lib/crm/actions/experiencia.ts > atualizarExperiencia()` (linhas 96-115), garantindo consistencia mesmo se houver divergencia entre camadas.

### Alertas de Inatividade

**Funcao:** `public.familias_em_alerta_inatividade()` em `20260401001400`.

| Fase | Threshold (dias sem contato) |
|---|---|
| admissao | 7 |
| pre_embarque | 15 |
| embarcado_inicial | 7 |
| acompanhamento | 30 |

Retorna: `experiencia_id, atleta_nome, dias_sem_contato, fase, threshold`.

**Nota:** Thresholds tambem configurados em `configuracoes_sistema` (chave `inatividade_por_fase`), mas a funcao SQL usa valores fixos por performance.

---

## 5. Pipeline — Regras de Movimentacao

### Permissoes

**Status:** ✅ Implementado

| Usuario | Permissao | Implementacao |
|---|---|---|
| CEO | Mover qualquer etapa, qualquer direcao | RLS `deals_update` em `20260401000600`: `get_user_papel() = 'ceo'`. Server action `moverDeal()` e `atualizarDeal()` verificam `papel !== "ceo"`. |
| Head de Sucesso | Somente leitura no pipeline | RLS `deals_select` permite SELECT. Nenhuma policy de UPDATE para `head_sucesso` em deals. Server actions retornam erro. |
| Head de Sucesso | Move fases no CRM Experiencia | RLS `exp_update` em `20260401001200`: `get_user_papel() IN ('ceo', 'head_sucesso')`. Server action `atualizarExperiencia()` permite `ceo` e `head_sucesso`. |

### Regras obrigatorias

| Regra | Status | Implementacao |
|---|---|---|
| Next Action + Data para avancar | ✅ | `moverDeal()` em `deals.ts` (linhas 38-44) |
| Retrocesso exige justificativa | ✅ | `moverDeal()` em `deals.ts` (linhas 48-53) + trigger `trg_deals_check_etapa` seta `flag_retrocedido` |
| Perdido exige motivo | ✅ | `moverDeal()` em `deals.ts` (linhas 56-59) |
| Contrato Assinado exige contrato financeiro | ⚠️ | Nao validado em `moverDeal()`. A coluna `contrato_assinado_at` e setada pelo trigger, mas nao ha verificacao de que `contratos_financeiros` existe para o deal. |
| Toda transicao no audit trail | ✅ | Trigger `trg_audit_deals` em `20260401000800` |

### Movimentacoes automaticas

| Gatilho | Status | Implementacao |
|---|---|---|
| Calendly confirma agendamento → "Reuniao Marcada" | 🔜 Pendente | Campo `google_calendar_event_id` existe no deal (`20260401000600`), mas nao ha webhook Calendly integrado. |
| ClickSign/DocuSign contrato assinado → "Contrato Assinado" | 🔜 Pendente | Campos `docusign_envelope_id` e `docusign_status` existem no deal, mas nao ha webhook DocuSign/ClickSign integrado. |

---

## 6. Deteccao de Duplicados

**Status:** ⚠️ Parcialmente implementado

| Criterio | Status | Implementacao |
|---|---|---|
| WhatsApp do responsavel identico | ✅ | Unique index `idx_responsaveis_whatsapp` em `20260401000400`. Dedup em `promoverLead()` (`leads.ts` linhas 96-106). |
| Email do responsavel identico | ✅ | Unique index `idx_responsaveis_email` em `20260401000400`. |
| Nome atleta + data nascimento | ⚠️ | Nao ha UNIQUE constraint em `(nome_completo, data_nascimento)` na tabela `atletas`. |
| Nome responsavel similar + cidade | ⚠️ | Indice trgm `idx_responsaveis_nome` habilitado para busca fuzzy, mas sem fluxo de UI que execute a busca. |

**Acoes disponiveis (merge/novo atleta/force-create):** 🔜 Nenhuma implementada na UI. O fluxo atual e: se o WhatsApp ja existe, o responsavel e reutilizado silenciosamente; nao ha tela de decisao para o CEO.

---

## 7. Cancelamento e Reembolso

**Status:** ⚠️ Parcialmente implementado

**O que existe:**
- Etapa `cancelamento_solicitado` no enum `status_deal` (`20260401000000`).
- Server action `moverDeal()` pode mover para `cancelamento_solicitado`.
- Audit trail registra a transicao.

**O que falta:**
- Fluxo dedicado de cancelamento com campos obrigatorios (motivo, categoria, tentativa de retencao).
- Campos especificos de cancelamento nao existem na tabela `deals` (apenas `motivo_perda` e `detalhe_perda`).
- Calculo e registro de reembolso.
- Atualizacao automatica do registro em `crm_experiencia` para status "Cancelado".
- Registro de comprovante de reembolso.

---

## 8. Regua de Cobranca

**Status:** 🔜 Pendente de integracao externa

**O que existe:**
- Configuracao completa da regua em `configuracoes_sistema` (chave `regua_cobranca`) com 6 pontos de contato (D-3 a D+15), incluindo canal e acao por etapa.
- Tabela `parcelas` com `vencimento DATE` e `status status_parcela` (previsto/recebido/atrasado/cancelado).
- Indice parcial `idx_parcelas_atrasadas` para consulta rapida de parcelas atrasadas.

**O que falta:**
- Job/scheduler que verifique parcelas proximas do vencimento e dispare a regua.
- Integracao com WhatsApp (Z-API) e Email (Resend/Brevo) para envio automatico.
- Transicao automatica de status para "atrasado" em D+1.
- Alerta automatico ao War Room em D+7.
- Notificacao critica ao CEO em D+15.

---

## 9. Sistema de Alertas Automaticos

**Status:** ✅ Implementado

**Implementacao:** `src/lib/crm/automacoes/verificar-alertas.ts`

### Regras de Deteccao

| Alerta | Condicao | Severidade | Query |
|---|---|---|---|
| Deal sem next_action | `next_action IS NULL` + `updated_at < 48h` + etapa ativa | Alta | Exclui `perdido, concluido, cancelamento_solicitado, admission_process` |
| Reuniao sem proposta | `etapa = reuniao_realizada` + `reuniao_realizada_at < 12h` | Alta | — |
| Proposta sem follow-up | `etapa = proposta_enviada` + `updated_at < 48h` | Media | — |
| Negociacao parada | `etapa = negociacao` + `updated_at < 4 dias` | Critica | — |
| Contrato sem assinatura | `etapa = contrato_enviado` + `updated_at < 48h` | Alta | — |

**Observacao:** Esta funcao retorna um array de alertas mas nao insere notificacoes automaticamente. Precisa ser chamada por um job/scheduler ou pela UI para gerar notificacoes.

---

## 10. Detalhes de Implementacao por Camada

### Migrations (Banco de Dados)

| Migration | Conteudo | Regras Enforced |
|---|---|---|
| `20260401000000` | Enums (status_deal, classificacao_lead, etc.) | Tipos restritos |
| `20260401000100` | user_profiles + get_user_papel() | Base de permissoes |
| `20260401000200` | audit_logs + audit.log_change() | Regra 9 (imutabilidade) |
| `20260401000300` | configuracoes_sistema + seed | Pesos configuraveis |
| `20260401000400` | responsaveis + enderecos + dedup indexes | Regra 10 (duplicados) |
| `20260401000500` | atletas + calcular_lead_score() + trigger | Lead Score automatico |
| `20260401000600` | deals + trg_deals_check_etapa + RLS | Regras 2, 5 (pipeline) |
| `20260401000700` | contratos_financeiros + parcelas + RLS | Regra 3 (financeiro CEO-only) |
| `20260401000800` | audit triggers em todas as tabelas | Regra 9 (audit trail) |
| `20260401001200` | crm_experiencia + trigger temperatura v1 | Regras 6, 7, 8 |
| `20260401001300` | tarefas + notificacoes + RLS | Regras 1, 4 |
| `20260401001400` | trigger temperatura v2 + inatividade | Regra 8 (completo) |
| `20260401001500` | escolas | Base para match |
| `20260401001600` | calcular_match_score() + sugerir_escolas() | Motor de Match |

### Server Actions (Aplicacao)

| Arquivo | Funcoes | Regras Enforced |
|---|---|---|
| `src/lib/crm/actions/deals.ts` | `moverDeal()`, `atualizarDeal()` | Regras 2, 5 (pipeline), permissoes CEO |
| `src/lib/crm/actions/financeiro.ts` | `criarContrato()`, `confirmarPagamento()`, `confirmarSinalPago()` | Regras 3, 7 (financeiro + handoff) |
| `src/lib/crm/actions/experiencia.ts` | `atualizarExperiencia()`, `escalonarCEO()`, `registrarContato()` | Regras 6, 8 (experiencia + temperatura) |
| `src/lib/crm/actions/leads.ts` | `promoverLead()` | Regra 10 (dedup na promocao) |
| `src/lib/crm/automacoes/verificar-alertas.ts` | `verificarAlertas()` | Alertas automaticos do pipeline |

---

## Resumo Geral de Status

| # | Regra | Status |
|---|---|---|
| 1 | Notificacoes espelhadas ao CEO | ⚠️ Parcial — CEO ve via RLS, mas nao recebe copia propria |
| 2 | Next Action obrigatoria | ✅ Server action + validacao |
| 3 | CEO-only para valores financeiros | ✅ RLS + server action + audit |
| 4 | CEO-only para silenciar notificacoes | ✅ RLS restringe UPDATE |
| 5 | Retrocesso exige justificativa | ✅ Server action + trigger + flag |
| 6 | Atencao/Crise → campos + alerta CEO | ✅ Server action com validacao + notificacao |
| 7 | Handoff automatico (sinal → experiencia) | ✅ confirmarSinalPago() completo |
| 8 | Temperatura vermelha automatica | ✅ Trigger banco + server action |
| 9 | Audit trail imutavel | ✅ Tabela + triggers protecao + audit em todas tabelas |
| 10 | Deteccao duplicados | ⚠️ Parcial — WhatsApp/email OK, fuzzy e merge pendentes |
| — | Lead Score | ✅ Funcao + trigger + pesos configuraveis |
| — | Motor de Match | ✅ Funcao completa + filtros + pesos + apenas academico |
| — | Temperatura automatica | ✅ Trigger verde/amarelo/vermelho |
| — | Alertas automaticos | ✅ 5 regras implementadas |
| — | Regua de cobranca | 🔜 Config existe, execucao pendente |
| — | Cancelamento/reembolso | ⚠️ Etapa existe, fluxo dedicado pendente |
| — | Movimentacao automatica (Calendly/DocuSign) | 🔜 Campos existem, webhooks pendentes |
