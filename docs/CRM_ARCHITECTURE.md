# CRM Architecture — Bolsa Atleta USA

> Documento de arquitetura técnica para o CRM interno.
> Pré-requisito: leia `BUSINESS_RULES.md`, `SPEC.md`, `DATA_MODEL.md` antes de implementar.

---

## 1. Aproveitamento do que Existe

### 1.1 O que `form_submissions` oferece ao CRM

A tabela atual captura leads do formulário público e contém:

| Categoria | Campos | Aproveitável? |
|---|---|---|
| Atleta | `athlete_name`, `birth_date`, `city_state`, `position`, `club_history`, `achievements`, `video_link`, `instagram` | Sim — migram para `atletas` |
| Acadêmico | `school_year`, `current_school`, `english_level` | Sim — migram para `atletas` |
| Responsável | `guardian_name`, `guardian_email`, `guardian_whatsapp`, `guardian_profession` | Sim — migram para `responsaveis` |
| Endereço | `family_address`, `address_country` | Parcial — campo único, precisa ser decomposto |
| Financeiro | `investment_range` | Sim — migra para `atletas.faixa_investimento` |
| Qualificação | `qualified`, `qualification_classification`, `qualification_reason` | Referência — o CRM recalcula com Lead Score próprio |
| WhatsApp/Follow-up | `whatsapp_sent_at`, `followup_1_sent_at`, `followup_2_sent_at`, `meeting_scheduled` | Referência — controle migra para `tarefas` + `notificacoes` |

### 1.2 O que precisa ser migrado/transformado

```
form_submissions (flat, tudo em 1 registro)
      ↓ normalização
responsaveis  (1 registro por responsável, dedup por telefone+email)
atletas       (1 registro por atleta, FK → responsável)
enderecos     (1 registro, FK ← atleta)
deals         (1 registro por oportunidade, FK → atleta)
```

**Transformações necessárias:**
- `guardian_*` → entidade `responsaveis` separada (dedup por `guardian_whatsapp` + `guardian_email`)
- `family_address` (texto livre) → campos estruturados em `enderecos` (cidade, estado, CEP)
- `qualification_classification` (QUENTE/MORNO/FRIO) → `lead_score` numérico (0–100) recalculado com critérios da spec
- `school_year` → normalizar para enum `9th/10th/11th/12th/PG`

### 1.3 O que NÃO tocar

> ⚠️ **`form_submissions` continua existindo e funcionando.** O formulário público (`/forms`) insere nela diretamente via Supabase anon key. As Cloud Functions (qualify-lead, sync-leads, send-whatsapp, etc.) dependem dela. Não alterar a tabela, não remover colunas, não mudar RLS.

### 1.4 Convivência: formulário público + CRM

```
[Formulário público] → form_submissions (anon INSERT)
                              ↓
                    Cloud Function (qualify-lead)
                              ↓
                    form_submissions.qualified = true
                              ↓
                    [CRM] CEO revisa lead qualificado
                              ↓
                    CEO clica "Promover para CRM"
                              ↓
                    Cria responsavel + atleta + deal (dados normalizados)
                    atleta.form_submission_id = FK → form_submissions.id
```

A promoção é **manual** (CEO decide). Alternativa futura: automática para leads Hot.

### 1.5 Estratégia de Schema

**Decisão: tudo em `public`** (ver ADR-001 abaixo).

- Tabelas do CRM coexistem com `form_submissions` no schema `public`
- Prefixo de namespace não necessário (nomes são distintos: `atletas`, `deals`, `escolas` vs `form_submissions`)
- Schemas `uat` e `dev` continuam existindo para o formulário público (não replicar CRM neles no MVP)
- CRM em UAT/DEV: variável de ambiente ou feature flag no frontend

---

## 2. Stack do CRM

### 2.1 Decisões

| Aspecto | Decisão | Justificativa |
|---|---|---|
| **Rota base** | `/crm` dentro do Next.js existente | Evita overhead de 2 apps. Auth compartilhada. Deploy único. (ver ADR-004) |
| **Auth** | Supabase Auth + tabela `user_profiles` + RLS | Já disponível no projeto. JWT com custom claims para papel. |
| **RBAC** | Custom claims no JWT via hook Supabase `custom_access_token` | 4 papéis: `ceo`, `cto` (= ceo), `head`, `comercial`. Claims consultados pelo RLS. |
| **State** | TanStack Query (já no projeto) | Cache, invalidação, optimistic updates. |
| **UI** | shadcn/ui + Radix (já no projeto) | Consistência visual. |
| **Tabelas/Data grids** | `@tanstack/react-table` | Necessário para pipeline, leads, financeiro. shadcn/ui já tem wrapper. |
| **Charts** | `recharts` (já no projeto) | War Room precisa de gráficos (funil, receita). |
| **Drag & drop** | `@dnd-kit/core` | Pipeline Kanban exige drag entre colunas. |
| **Real-time** | Supabase Realtime (subscriptions) | Notificações in-app, atualização de pipeline quando outro user move deal. |
| **Cron/Schedulers** | `pg_cron` (extensão Supabase) ou Cloud Scheduler existente | Automações de alerta (lead sem ação 48h, cobrança D+N). |
| **File storage** | Supabase Storage | Documentos do atleta (passaporte, histórico). Buckets com RLS. |

### 2.2 Autenticação e RBAC

```
1. Login: Supabase Auth (email/password — convite pelo CEO)
2. Hook custom_access_token: injeta { papel: "ceo" } no JWT
3. RLS policies: auth.jwt() -> 'papel' para filtrar acesso
4. Middleware Next.js: valida sessão, redireciona se não autenticado
5. Componente <RoleGate>: esconde UI baseado no papel
```

**Tabela `user_profiles`:**
| Campo | Tipo | Constraint |
|---|---|---|
| id | UUID | PK, FK → auth.users.id |
| nome | texto | NOT NULL |
| papel | enum (ceo/cto/head/comercial) | NOT NULL |
| ativo | boolean | default true |
| created_at | timestamptz | |

---

## 3. Schema do Banco — Modelo Completo

### Convenções

- Todas as tabelas: `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`
- Todas (exceto `audit_trail`): `created_at`, `updated_at`, `deleted_at`, `created_by`
- Trigger `update_updated_at` em todas as tabelas
- Enum types criados separadamente (ex: `CREATE TYPE etapa_pipeline AS ENUM (...)`)
- RLS habilitado em todas as tabelas

---

### 3.1 `user_profiles`

**Propósito:** Perfis de usuários do CRM, vinculados ao Supabase Auth.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK, FK → auth.users(id) ON DELETE CASCADE |
| nome | text | NOT NULL |
| papel | user_papel_enum | NOT NULL (ceo / cto / head / comercial) |
| ativo | boolean | NOT NULL DEFAULT true |
| avatar_url | text | |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**RLS:** Todos podem SELECT. Apenas CEO pode UPDATE/INSERT.

---

### 3.2 `responsaveis`

**Propósito:** Responsáveis legais (pais/mães). Entidade de dedup. Múltiplos atletas vinculam ao mesmo.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| nome_completo | text | NOT NULL |
| profissao | text | |
| telefone | text | NOT NULL |
| email | text | NOT NULL |
| parentesco | text | |
| created_at / updated_at / deleted_at | timestamptz | |
| created_by | uuid | FK → user_profiles(id) |

**Índices:** UNIQUE(telefone), UNIQUE(email), idx_nome_completo (busca fuzzy)
**RLS:** CEO = full. Head = SELECT onde atleta vinculado está no CRM Experiência. Comercial = SELECT seus leads.

---

### 3.3 `enderecos`

**Propósito:** Endereço do responsável/família.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| pais | text | NOT NULL DEFAULT 'BR' |
| cep | text | |
| logradouro | text | |
| numero | text | |
| complemento | text | |
| bairro | text | |
| cidade | text | NOT NULL |
| estado | text | |
| created_at / updated_at | timestamptz | |

**RLS:** Herda do atleta vinculado.

---

### 3.4 `atletas`

**Propósito:** Dados do atleta (lead estruturado no CRM). Fonte de verdade após promoção do form_submissions.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| form_submission_id | uuid | FK → form_submissions(id), nullable, UNIQUE |
| responsavel_id | uuid | FK → responsaveis(id) NOT NULL |
| endereco_id | uuid | FK → enderecos(id) |
| nome_completo | text | NOT NULL |
| data_nascimento | date | NOT NULL |
| whatsapp | text | NOT NULL |
| email | text | |
| instagram | text | |
| serie_ano | serie_ano_enum | NOT NULL |
| video_highlights | text | |
| escola_atual | text | |
| cidade_estado | text | NOT NULL |
| modelo_educacional | text | |
| desempenho_academico | desempenho_enum | NOT NULL |
| nivel_ingles | nivel_ingles_enum | NOT NULL |
| esporte | text | NOT NULL |
| posicao | text | |
| historico_clubes | text | |
| conquistas | text | |
| nivel_competitivo | nivel_competitivo_enum | NOT NULL |
| momento_inicio | momento_enum | NOT NULL |
| direcao_projeto | text | |
| comprometimento | comprometimento_enum | NOT NULL |
| decisao_familiar | decisao_enum | NOT NULL |
| faixa_investimento | faixa_investimento_enum | NOT NULL |
| safra | text | NOT NULL |
| lead_score | smallint | CHECK (0–100) |
| classificacao_score | classificacao_enum | (hot/warm/cold) |
| origem | origem_enum | NOT NULL |
| indicado_por_atleta_id | uuid | FK → atletas(id) nullable |
| consentimento_lgpd_at | timestamptz | NOT NULL |
| aceite_whatsapp | boolean | NOT NULL DEFAULT false |
| aceite_email | boolean | NOT NULL DEFAULT false |
| created_at / updated_at / deleted_at | timestamptz | |
| created_by | uuid | FK → user_profiles(id) |

**Índices:** idx_responsavel_id, idx_safra, idx_classificacao_score, idx_lead_score DESC, UNIQUE(form_submission_id)
**RLS:** CEO = full. Head = SELECT onde existe ExperienciaFamilia vinculada. Comercial = seus leads.

---

### 3.5 `deals`

**Propósito:** Oportunidade comercial. 1 atleta pode ter N deals (reativação), mas normalmente 1:1.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| atleta_id | uuid | FK → atletas(id) NOT NULL |
| etapa_pipeline | etapa_pipeline_enum | NOT NULL DEFAULT 'lead' |
| valor_estimado | numeric(12,2) | NOT NULL |
| probabilidade | smallint | NOT NULL CHECK (0–100) |
| status_decisao_familia | decisao_enum | NOT NULL |
| notas_reuniao | text | |
| next_action | text | |
| data_proxima_acao | date | |
| motivo_perda | motivo_perda_enum | |
| detalhe_perda | text | |
| pode_reativar | boolean | |
| data_reativacao | date | |
| responsavel_usuario_id | uuid | FK → user_profiles(id) NOT NULL |
| safra | text | |
| flag_retrocedido | boolean | NOT NULL DEFAULT false |
| flag_valores_customizados | boolean | NOT NULL DEFAULT false |
| created_at / updated_at / deleted_at | timestamptz | |
| created_by | uuid | FK → user_profiles(id) |

**Índices:** idx_atleta_id, idx_etapa_pipeline, idx_responsavel_usuario, idx_data_proxima_acao, idx_safra
**RLS:** CEO = full. Head = SELECT only. Comercial = full nos seus deals.

> ⚠️ Transição de etapa bloqueada se `next_action` ou `data_proxima_acao` forem NULL. Validação no frontend + database function.

---

### 3.6 `contratos_financeiros`

**Propósito:** Contrato financeiro de um deal. 1:1 com deal.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| deal_id | uuid | FK → deals(id) NOT NULL, UNIQUE |
| plano | plano_enum | NOT NULL |
| forma_pagamento_plano | forma_pagamento_enum | NOT NULL |
| valor_total | numeric(12,2) | NOT NULL |
| valor_entrada | numeric(12,2) | NOT NULL DEFAULT 4500.00 |
| forma_pagamento_entrada | metodo_pagamento_enum | NOT NULL |
| entrada_paga | boolean | NOT NULL DEFAULT false |
| data_pagamento_entrada | timestamptz | |
| saldo_remanescente | numeric(12,2) | GENERATED ALWAYS AS (valor_total - valor_entrada) STORED |
| forma_pagamento_saldo | metodo_pagamento_enum | |
| parcelas_saldo | smallint | |
| status_contrato_digital | status_contrato_enum | |
| justificativa_customizacao | text | |
| created_at / updated_at | timestamptz | |
| created_by | uuid | FK → user_profiles(id) |

**RLS:** Apenas CEO (full). Head e Comercial sem acesso.

---

### 3.7 `parcelas`

**Propósito:** Agenda de recebíveis. Gerada automaticamente ao criar contrato.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| contrato_id | uuid | FK → contratos_financeiros(id) NOT NULL |
| tipo | tipo_parcela_enum | NOT NULL (entrada / parcela_saldo) |
| numero | smallint | NOT NULL |
| valor | numeric(12,2) | NOT NULL |
| vencimento | date | NOT NULL |
| metodo | metodo_pagamento_enum | NOT NULL |
| status | status_parcela_enum | NOT NULL DEFAULT 'previsto' |
| data_recebimento | timestamptz | |
| comprovante_url | text | |
| nf_status | nf_status_enum | DEFAULT 'pendente' |
| nf_numero | text | |
| nf_data | date | |
| nf_valor | numeric(12,2) | |
| created_at / updated_at | timestamptz | |

**Índices:** idx_contrato_id, idx_vencimento, idx_status
**RLS:** Apenas CEO.

---

### 3.8 `planos`

**Propósito:** Catálogo de planos editável pelo CEO. Seed com Journey/Legacy/Start.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| nome | text | NOT NULL UNIQUE |
| valor_padrao | numeric(12,2) | NOT NULL |
| valor_pix | numeric(12,2) | NOT NULL |
| inclui_psicologa | boolean | NOT NULL DEFAULT false |
| ativo | boolean | NOT NULL DEFAULT true |
| created_at / updated_at | timestamptz | |

**RLS:** CEO = full. Todos = SELECT (para popular selects no frontend).

---

### 3.9 `escolas`

**Propósito:** Base institucional de escolas. Cadastro manual pelo CEO.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| nome | text | NOT NULL |
| estado_us | text | NOT NULL |
| cidade | text | NOT NULL |
| tipo | tipo_escola_enum | NOT NULL |
| status | status_escola_enum | NOT NULL DEFAULT 'ativa' |
| website | text | |
| budget_minimo_usd | numeric(10,2) | |
| budget_forte_usd | numeric(10,2) | |
| agressividade_bolsa | agressividade_enum | |
| regra_pratica | text | |
| ingles_minimo | nivel_ingles_enum | |
| testes_exigidos | text[] | |
| nota_minima_duolingo | smallint | |
| nota_minima_psat | smallint | |
| nota_minima_ssat | smallint | |
| gpa_minimo | numeric(3,2) | |
| esportes_oferecidos | text[] | |
| influencia_esporte | influencia_enum | |
| aceita_excecao_elite | boolean | DEFAULT false |
| serie_preferencial | text[] | |
| serie_maxima | serie_ano_enum | |
| deadline_fall | date | |
| deadline_spring | date | |
| rolling_admission | boolean | DEFAULT false |
| tempo_medio_resposta_dias | smallint | |
| notas_internas | text | |
| created_at / updated_at / deleted_at | timestamptz | |
| created_by | uuid | FK → user_profiles(id) |

**Índices:** idx_status, idx_estado_us, GIN(esportes_oferecidos), GIN(testes_exigidos)
**RLS:** CEO = full CRUD. Head/Comercial = SELECT only.

---

### 3.10 `relacionamentos_escola`

**Propósito:** Relacionamento BAUSA ↔ admissions officer de cada escola.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| escola_id | uuid | FK → escolas(id) NOT NULL |
| officer_nome | text | NOT NULL |
| officer_email | text | |
| officer_telefone | text | |
| temperatura | temperatura_rel_enum | NOT NULL DEFAULT 'novo' |
| ultimo_contato | timestamptz | |
| proximo_contato | date | |
| notas | text | |
| created_at / updated_at | timestamptz | |

**RLS:** CEO only.

---

### 3.11 `contatos_escola`

**Propósito:** Timeline de interações com admissions officers.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| relacionamento_id | uuid | FK → relacionamentos_escola(id) NOT NULL |
| data | timestamptz | NOT NULL |
| tipo | tipo_contato_enum | NOT NULL |
| resumo | text | NOT NULL |
| created_at | timestamptz | |
| created_by | uuid | FK → user_profiles(id) |

**RLS:** CEO only.

---

### 3.12 `estrategia_escolas`

**Propósito:** Escolas-alvo por atleta. Criada após sinal pago.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| atleta_id | uuid | FK → atletas(id) NOT NULL |
| escola_id | uuid | FK → escolas(id) NOT NULL |
| match_score | smallint | CHECK (0–100) |
| prioridade | prioridade_enum | NOT NULL |
| status | status_estrategia_enum | NOT NULL DEFAULT 'planejada' |
| bolsa_estimada_pct | numeric(5,2) | |
| bolsa_estimada_valor | numeric(10,2) | |
| bolsa_obtida_pct | numeric(5,2) | |
| bolsa_obtida_valor | numeric(10,2) | |
| data_aplicacao | date | |
| data_resposta | date | |
| resultado | resultado_enum | |
| observacao | text | |
| created_at / updated_at | timestamptz | |

**Índices:** UNIQUE(atleta_id, escola_id), idx_status
**RLS:** CEO = full. Head = SELECT.

---

### 3.13 `crm_experiencia`

**Propósito:** Registro de experiência pós-venda. 1:1 com atleta. Criado automaticamente no handoff.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| atleta_id | uuid | FK → atletas(id) NOT NULL, UNIQUE |
| responsavel_id | uuid | FK → responsaveis(id) NOT NULL |
| deal_id | uuid | FK → deals(id) NOT NULL |
| fase | fase_experiencia_enum | NOT NULL DEFAULT 'admissao' |
| temperatura | temperatura_exp_enum | NOT NULL DEFAULT 'verde' |
| ansiedade | smallint | CHECK (1–5) |
| satisfacao | smallint | CHECK (1–5) |
| risco_percebido | smallint | CHECK (1–5) |
| tipos_risco | text[] | |
| status | status_experiencia_enum | NOT NULL DEFAULT 'ativo' |
| escola_confirmada_id | uuid | FK → escolas(id) |
| data_embarque_prevista | date | |
| data_embarque_real | date | |
| created_at / updated_at / deleted_at | timestamptz | |
| created_by | uuid | FK → user_profiles(id) |

**Índices:** idx_temperatura, idx_fase, idx_status
**RLS:** Head = full CRUD (suas famílias). CEO = SELECT all.

> ⚠️ Trigger: se `ansiedade >= 4` ou `satisfacao <= 2` → `temperatura = 'vermelho'` automaticamente.

---

### 3.14 `contatos_experiencia`

**Propósito:** Registro de cada contato com a família. Obrigatório: resumo + próximo contato.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| experiencia_id | uuid | FK → crm_experiencia(id) NOT NULL |
| data | timestamptz | NOT NULL DEFAULT now() |
| tipo | tipo_contato_exp_enum | NOT NULL |
| resumo | text | NOT NULL |
| proximo_contato | date | NOT NULL |
| created_at | timestamptz | |
| created_by | uuid | FK → user_profiles(id) NOT NULL |

**Índices:** idx_experiencia_id, idx_proximo_contato
**RLS:** Head = INSERT/SELECT. CEO = SELECT.

---

### 3.15 `crises`

**Propósito:** Registro de crises de famílias. Alerta imediato ao CEO.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| experiencia_id | uuid | FK → crm_experiencia(id) NOT NULL |
| descricao | text | NOT NULL |
| tipo_crise | tipo_crise_enum | NOT NULL |
| nivel | nivel_crise_enum | NOT NULL |
| acao_tomada | text | NOT NULL |
| psicologa_acionada | boolean | NOT NULL DEFAULT false |
| data_psicologa | timestamptz | |
| resolvida | boolean | NOT NULL DEFAULT false |
| data_resolucao | timestamptz | |
| created_at | timestamptz | |
| created_by | uuid | FK → user_profiles(id) |

**RLS:** Head = INSERT/SELECT. CEO = SELECT.

---

### 3.16 `tarefas`

**Propósito:** Tarefas manuais ou automáticas, vinculadas a lead/deal/família.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| titulo | text | NOT NULL |
| descricao | text | |
| prioridade | prioridade_enum | NOT NULL DEFAULT 'media' |
| status | status_tarefa_enum | NOT NULL DEFAULT 'pendente' |
| data_vencimento | timestamptz | NOT NULL |
| responsavel_usuario_id | uuid | FK → user_profiles(id) NOT NULL |
| atleta_id | uuid | FK → atletas(id) |
| deal_id | uuid | FK → deals(id) |
| experiencia_id | uuid | FK → crm_experiencia(id) |
| modulo_origem | modulo_enum | NOT NULL |
| origem_automatica | boolean | NOT NULL DEFAULT false |
| recorrente | boolean | NOT NULL DEFAULT false |
| regra_recorrencia | text | |
| completed_at | timestamptz | |
| created_at / updated_at / deleted_at | timestamptz | |
| created_by | uuid | FK → user_profiles(id) |

**Índices:** idx_responsavel_usuario, idx_status, idx_data_vencimento, idx_prioridade
**RLS:** CEO = full. Cada usuário = full nas suas. Head/Comercial = não vê de outros.

---

### 3.17 `documentos`

**Propósito:** Documentos do atleta (passaporte, histórico, etc.). Armazenamento no Supabase Storage.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| atleta_id | uuid | FK → atletas(id) NOT NULL |
| escola_id | uuid | FK → escolas(id) |
| tipo | tipo_documento_enum | NOT NULL |
| nome_arquivo | text | NOT NULL |
| storage_path | text | NOT NULL |
| tamanho_bytes | integer | |
| status | status_documento_enum | NOT NULL DEFAULT 'pendente' |
| data_validade | date | |
| notas | text | |
| created_at / updated_at | timestamptz | |
| created_by | uuid | FK → user_profiles(id) |

**Índices:** idx_atleta_id, idx_status
**RLS:** CEO = full. Head = SELECT/INSERT para seus atletas.

---

### 3.18 `notificacoes`

**Propósito:** Centro de notificações in-app. Toda notificação é espelhada ao CEO.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| usuario_destino_id | uuid | FK → user_profiles(id) NOT NULL |
| tipo | tipo_notificacao_enum | NOT NULL |
| severidade | severidade_enum | NOT NULL |
| titulo | text | NOT NULL |
| corpo | text | |
| modulo_origem | modulo_enum | NOT NULL |
| entidade_tipo | text | |
| entidade_id | uuid | |
| lida | boolean | NOT NULL DEFAULT false |
| silenciada | boolean | NOT NULL DEFAULT false |
| created_at | timestamptz | DEFAULT now() |

**Índices:** idx_usuario_destino, idx_lida, idx_created_at DESC
**RLS:** Cada usuário vê apenas suas notificações. CEO vê todas (espelhamento via INSERT trigger).

> ⚠️ Trigger on INSERT: duplicar para CEO se `usuario_destino_id != ceo_id`.

---

### 3.19 `audit_trail`

**Propósito:** Log imutável de todas as alterações. Append-only. 5 anos de retenção.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| usuario_id | uuid | FK → user_profiles(id) |
| acao | acao_audit_enum | NOT NULL |
| modulo | modulo_enum | NOT NULL |
| entidade_tipo | text | NOT NULL |
| entidade_id | uuid | |
| campo | text | |
| valor_anterior | jsonb | |
| valor_novo | jsonb | |
| justificativa | text | |
| ip | text | |
| created_at | timestamptz | DEFAULT now() |

**Índices:** idx_entidade_id, idx_modulo, idx_created_at, idx_usuario_id

> ⚠️ **RLS especial:** CEO = SELECT only. Ninguém pode UPDATE ou DELETE. Sem policy de INSERT via app — apenas via triggers/functions.

> ⚠️ Implementar via `REVOKE UPDATE, DELETE ON audit_trail FROM service_role` + GRANT INSERT apenas para função específica.

---

### 3.20 `cancelamentos`

**Propósito:** Registro de cancelamento de deal. 1:1 com deal cancelado.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| deal_id | uuid | FK → deals(id) NOT NULL, UNIQUE |
| motivo | motivo_cancelamento_enum | NOT NULL |
| detalhe | text | |
| data_solicitacao | timestamptz | NOT NULL |
| fase_cancelou | text | NOT NULL |
| valor_pago | numeric(12,2) | |
| valor_reembolso | numeric(12,2) | |
| justificativa_reembolso | text | |
| reembolso_pago | boolean | NOT NULL DEFAULT false |
| retencao_tentada | boolean | NOT NULL DEFAULT false |
| created_at | timestamptz | |
| created_by | uuid | FK → user_profiles(id) |

**RLS:** CEO only.

---

### 3.21 `faq_artigos`

**Propósito:** Base de conhecimento interna para a Head.

| Coluna | Tipo | Constraint |
|---|---|---|
| id | uuid | PK |
| titulo | text | NOT NULL |
| categoria | categoria_faq_enum | NOT NULL |
| conteudo | text | NOT NULL |
| fase_aplicavel | text | |
| acessos | integer | NOT NULL DEFAULT 0 |
| created_at / updated_at | timestamptz | |
| updated_by | uuid | FK → user_profiles(id) |

**RLS:** CEO/Head = full CRUD. Comercial = SELECT.

---

### 3.22 `configuracoes_sistema`

**Propósito:** Chave-valor para configurações editáveis pelo CEO.

| Coluna | Tipo | Constraint |
|---|---|---|
| chave | text | PK |
| valor | jsonb | NOT NULL |
| descricao | text | |
| updated_at | timestamptz | |
| updated_by | uuid | FK → user_profiles(id) |

**RLS:** CEO = full. Todos = SELECT (para ler configurações).

**Seed inicial:** pesos do Lead Score, faixas (Hot/Warm/Cold), pesos do Match, timers de automação, régua de cobrança, thresholds de experiência, metas do War Room, etapas do pipeline.

---

## 4. Fluxos de Dados Críticos

### 4.a Lead do Formulário → CRM

```
1. Visitante preenche formulário em /forms
2. INSERT em form_submissions (via Supabase anon key) ── [NÃO MUDA]
3. Cloud Function qualify-lead calcula QUENTE/MORNO/FRIO ── [NÃO MUDA]
4. Cloud Function send-whatsapp envia convite 22h ── [NÃO MUDA]
5. CEO abre CRM → aba "Leads Novos" → vê form_submissions qualificados
6. CEO clica "Promover para CRM" em um lead
7. Server Action / API Route:
   a. Busca responsável por telefone/email → se existe, vincula; senão, cria
   b. Cria registro em enderecos (parseia family_address)
   c. Cria registro em atletas (copia campos normalizados)
   d. Calcula lead_score (regras do BUSINESS_RULES.md)
   e. Cria deal com etapa = 'lead'
   f. Marca atletas.form_submission_id = form_submissions.id
   g. INSERT em audit_trail
8. Lead aparece no pipeline do CRM
```

**Decisão:** Promoção manual pelo CEO. Não automática — CEO precisa revisar antes de criar deal.

### 4.b Sinal Pago → CRM Experiência

```
1. CEO marca entrada_paga = true no contrato financeiro
2. Trigger PostgreSQL (ou Server Action):
   a. Cria registro em crm_experiencia com dados herdados:
      - atleta_id, responsavel_id, deal_id
      - fase = 'admissao', temperatura = 'verde'
   b. Cria tarefa automática:
      - "Reunião de onboarding com família"
      - responsavel = Head de Sucesso
      - prazo = NOW() + 48h
      - prioridade = 'alta'
   c. Cria notificação para Head: "Nova família para onboarding"
   d. Espelha notificação para CEO
   e. INSERT em audit_trail
3. Head vê na dashboard → realiza onboarding → registra contato
4. Se onboarding não realizado em 48h → alerta ao CEO (via cron)
```

**Decisão:** Via database function chamada pelo Server Action (não trigger puro, para ter controle de erro).

### 4.c Audit Trail

```
Opção escolhida: Triggers PostgreSQL (ver ADR-002)

1. Trigger AFTER INSERT/UPDATE/DELETE em cada tabela do CRM
2. Trigger function genérica: audit_trigger_func()
   - Captura: OLD vs NEW, tabela, operação, campo alterado
   - INSERT em audit_trail com JSONB diff
   - created_at = now(), usuario via current_setting('app.current_user_id')
3. Aplicação seta current_setting antes de cada operação:
   SET LOCAL app.current_user_id = '<uuid>';
   SET LOCAL app.current_ip = '<ip>';
4. audit_trail: REVOKE UPDATE, DELETE para todos os roles
```

### 4.d Notificações

```
1. Ação no sistema (ex: crise registrada)
2. Database function ou Server Action cria registro em notificacoes:
   - usuario_destino = Head
   - severidade = 'critical'
3. Trigger on INSERT em notificacoes:
   - Se usuario_destino != CEO → duplica notificação para CEO (espelhamento)
4. Frontend: Supabase Realtime subscription na tabela notificacoes
   - Filtra: usuario_destino_id = user.id AND lida = false
   - Atualiza badge/toast em tempo real
5. Digest diário (9h): Cloud Scheduler → Cloud Function
   - SELECT notificacoes WHERE lida = false AND severidade IN ('media', 'baixa')
   - Agrupa e envia email via Resend
6. Alertas críticos: enviados imediatamente via email (no momento da criação)
```

**Decisão:** INSERT síncrono (in-process). Email crítico assíncrono via Cloud Function (fila não necessária com volume atual de 2–3 users).

---

## 5. Estrutura de Pastas do CRM no Next.js

```
app/
└── [locale]/
    ├── (public)/              ← Rotas públicas (site, forms, links)
    │   ├── page.tsx           ← Homepage
    │   ├── acesso/page.tsx
    │   └── forms/page.tsx
    │
    └── crm/                   ← Rota protegida (auth guard)
        ├── layout.tsx         ← Auth check + Sidebar + Realtime provider
        ├── page.tsx           ← Redirect → war-room (CEO) ou dashboard (Head)
        ├── war-room/
        │   └── page.tsx
        ├── leads/
        │   ├── page.tsx       ← Lista + filtros + promoção
        │   └── [id]/page.tsx  ← Detalhe do lead
        ├── pipeline/
        │   └── page.tsx       ← Kanban board (drag & drop)
        ├── financeiro/
        │   ├── page.tsx       ← Visão geral + recebíveis
        │   └── [dealId]/page.tsx
        ├── escolas/
        │   ├── page.tsx       ← Lista + busca
        │   └── [id]/page.tsx  ← Detalhe + relacionamento
        ├── experiencia/
        │   ├── page.tsx       ← Dashboard do Head / lista CEO
        │   └── [id]/page.tsx  ← Detalhe da família
        ├── tarefas/
        │   └── page.tsx
        ├── documentos/
        │   └── page.tsx
        ├── faq/
        │   └── page.tsx
        ├── configuracoes/
        │   └── page.tsx       ← CEO only
        └── notificacoes/
            └── page.tsx

src/
└── components/
    ├── crm/                   ← Componentes do CRM (isolados do site público)
    │   ├── layout/
    │   │   ├── Sidebar.tsx
    │   │   ├── TopBar.tsx
    │   │   └── RoleGate.tsx
    │   ├── pipeline/
    │   │   ├── KanbanBoard.tsx
    │   │   ├── DealCard.tsx
    │   │   └── DealDetail.tsx
    │   ├── leads/
    │   │   ├── LeadTable.tsx
    │   │   └── PromoteLeadDialog.tsx
    │   ├── financeiro/
    │   │   ├── ContratoForm.tsx
    │   │   └── ParcelasTable.tsx
    │   ├── experiencia/
    │   │   ├── HeadDashboard.tsx
    │   │   ├── FamiliaCard.tsx
    │   │   ├── RegistroContatoForm.tsx
    │   │   └── CriseForm.tsx
    │   ├── war-room/
    │   │   ├── AlertBanner.tsx
    │   │   ├── ReceitaCards.tsx
    │   │   ├── PipelineHealth.tsx
    │   │   └── FunilConversao.tsx
    │   └── shared/
    │       ├── AuditTimeline.tsx
    │       ├── NotificationBell.tsx
    │       └── EntitySearch.tsx
    │
    └── ui/                    ← shadcn/ui (compartilhado entre site e CRM)

src/
└── lib/
    └── crm/
        ├── supabase-server.ts ← Supabase client server-side com service role
        ├── supabase-client.ts ← Supabase client browser com auth
        ├── lead-score.ts      ← Cálculo do Lead Score
        ├── match-engine.ts    ← Motor de Match Atleta–Escola
        ├── permissions.ts     ← Helpers de RBAC
        └── hooks/
            ├── use-deals.ts
            ├── use-atletas.ts
            ├── use-experiencia.ts
            └── use-notifications.ts
```

---

## 6. Decisões de Arquitetura (ADRs)

### ADR-001: Schema separado (`crm`) vs tudo em `public`

| Opção | Prós | Contras |
|---|---|---|
| Schema `crm` separado | Isolamento lógico, nomes de tabela sem conflito | Complexidade de cross-schema queries, RLS duplicado, migrations mais complexas |
| Tudo em `public` | Simples, queries diretas, RLS unificado, sem configuração extra | Tabelas do CRM e do form convivem no mesmo namespace |

**Decisão:** Tudo em `public`.

**Justificativa:** O projeto é interno (2–3 users), sem multi-tenancy. Os nomes de tabela são distintos (`form_submissions` vs `atletas`, `deals`, etc.). Cross-schema queries são custosos em Supabase (precisa de `search_path` ou schema prefix em toda query). O overhead de schema separado não justifica com esse volume.

**Consequências:** Cuidado com naming. Não criar tabelas com nomes genéricos (`users` → `user_profiles`).

---

### ADR-002: Audit trail via trigger PostgreSQL vs camada de aplicação

| Opção | Prós | Contras |
|---|---|---|
| Triggers PostgreSQL | Captura TUDO (inclusive operações diretas no banco), impossível de contornar | Sem contexto de aplicação (IP, user) sem `SET LOCAL`. Debugging mais difícil. |
| Camada de aplicação | Mais contexto (IP, user, justificativa), fácil de debugar | Pode ser contornado se alguém editar direto no banco. Precisa lembrar de chamar em todo lugar. |

**Decisão:** Triggers PostgreSQL com `SET LOCAL` para contexto.

**Justificativa:** Regra 9 exige audit trail imutável e abrangente. Triggers garantem que NENHUMA alteração escape do log, mesmo operações diretas no banco. O `SET LOCAL` resolve o problema de contexto (user, IP) — a aplicação seta essas variáveis antes de cada operação.

**Consequências:** Toda operação no banco precisa ser precedida de `SET LOCAL app.current_user_id`. Implementar wrapper no Supabase client server-side.

---

### ADR-003: Notificações síncronas vs fila

| Opção | Prós | Contras |
|---|---|---|
| Síncrona (INSERT direto) | Simples, sem infra adicional | Pode atrasar a operação principal se tiver muitas notificações |
| Fila (Cloud Tasks / pg_cron) | Desacoplado, não bloqueia operação | Mais complexidade, mais infra, delay na entrega |

**Decisão:** INSERT síncrono para notificações in-app. Cloud Function assíncrona para emails.

**Justificativa:** Com 2–3 usuários, o volume de notificações é baixo. INSERT de 1–2 registros não impacta performance. Emails são naturalmente assíncronos (Resend API). O digest diário já usa Cloud Scheduler existente. Não justifica infra de fila.

**Consequências:** Se o volume crescer (10+ users), revisitar com fila. O Supabase Realtime cuida da entrega in-app em tempo real.

---

### ADR-004: CRM dentro do Next.js existente vs app separado

| Opção | Prós | Contras |
|---|---|---|
| Dentro do Next.js existente (`/crm`) | Deploy único, auth compartilhada, sem overhead de infra | Formulário público e CRM no mesmo bundle. Risco de quebrar um ao mexer no outro. |
| App separado (novo repo) | Isolamento total, deploy independente, bundles separados | 2 deploys, 2 configs Vercel, auth duplicada, mais overhead. |

**Decisão:** Dentro do Next.js existente, na rota `/crm`.

**Justificativa:** O site público é leve (3 rotas, estático). O CRM é dinâmico mas protegido por auth. Next.js App Router isola naturalmente os bundles por rota (code splitting automático). O formulário público não carrega nada do CRM e vice-versa. Deploy único simplifica operação. Se no futuro o bundle ficar grande, pode-se separar.

**Consequências:** Organizar componentes em `src/components/crm/` (isolados). Middleware de auth só na rota `/crm`.

---

### ADR-005: Relacionamento `form_submissions` ↔ CRM

| Opção | Prós | Contras |
|---|---|---|
| FK direto (`atletas.form_submission_id`) | Rastreabilidade, pode consultar dados originais | Acoplamento entre sistemas. form_submissions não pode ser alterada. |
| Cópia completa (sem FK) | Independência total | Sem rastreabilidade da origem. Dados duplicados. |
| View materializada | Dados sempre atualizados, sem duplicação | Complexidade de manutenção, performance de views. |

**Decisão:** FK direto (`atletas.form_submission_id`), nullable, UNIQUE.

**Justificativa:** Rastreabilidade é essencial (saber de onde veio o lead). A FK é nullable (leads criados manualmente não têm form_submission). UNIQUE garante que não se promova o mesmo form_submission 2 vezes. Os dados são COPIADOS para as tabelas do CRM (não lidos via FK) — a FK serve apenas como referência de origem.

**Consequências:** form_submissions não pode ser dropada. Pode ser arquivada/limpa desde que os IDs referenciados não sejam deletados.

---

## 7. Migrations — Ordem de Criação

| # | Migration | Cria | Depende de |
|---|---|---|---|
| 1 | `create_enum_types` | Todos os enum types (etapa_pipeline, papel, severidade, etc.) | — |
| 2 | `create_user_profiles` | `user_profiles` + trigger updated_at + RLS | #1 |
| 3 | `create_audit_trail` | `audit_trail` + REVOKE UPDATE/DELETE + trigger function genérica | #2 |
| 4 | `create_configuracoes` | `configuracoes_sistema` + seed inicial (pesos, timers, planos) | #2 |
| 5 | `create_responsaveis_enderecos` | `responsaveis` + `enderecos` + índices + RLS | #2, #3 |
| 6 | `create_atletas` | `atletas` + FK para responsaveis/enderecos/form_submissions + RLS | #5 |
| 7 | `create_deals` | `deals` + FK para atletas/user_profiles + RLS | #6 |
| 8 | `create_planos` | `planos` + seed (Journey/Legacy/Start) | #2 |
| 9 | `create_contratos_financeiros` | `contratos_financeiros` + `parcelas` + RLS | #7, #8 |
| 10 | `create_escolas` | `escolas` + `relacionamentos_escola` + `contatos_escola` + RLS | #2, #3 |
| 11 | `create_estrategia_escolas` | `estrategia_escolas` + RLS | #6, #10 |
| 12 | `create_crm_experiencia` | `crm_experiencia` + `contatos_experiencia` + `crises` + RLS + trigger temperatura | #6, #5 |
| 13 | `create_tarefas` | `tarefas` + RLS | #2, #6 |
| 14 | `create_documentos` | `documentos` + RLS | #6, #10 |
| 15 | `create_notificacoes` | `notificacoes` + trigger espelhamento CEO + RLS | #2 |
| 16 | `create_cancelamentos` | `cancelamentos` + RLS | #7 |
| 17 | `create_faq` | `faq_artigos` + RLS | #2 |
| 18 | `attach_audit_triggers` | Attach audit trigger em TODAS as tabelas CRM | #3, #5–#17 |
| 19 | `create_supabase_auth_hook` | Hook `custom_access_token` para injetar papel no JWT | #2 |
| 20 | `seed_initial_data` | Seed: configurações padrão, planos, enums de listas | #4, #8 |

---

## 8. Riscos e Pontos de Atenção

### Riscos Técnicos

| Risco | Impacto | Mitigação |
|---|---|---|
| Audit triggers impactam performance de writes | Lentidão em operações batch | Volume baixo (2–3 users). Monitorar. Se necessário, fazer audit async. |
| Supabase Realtime com muitas subscriptions | Desconexões, delays | Limitar subscriptions por tela. Usar channels específicos (não tabela inteira). |
| `SET LOCAL` esquecido → audit trail sem user | Logs órfãos | Wrapper obrigatório no Supabase client. Lint rule para não usar client raw. |
| RLS complexo (14 tabelas × 3 papéis) | Queries lentas, policies erradas | Testar RLS exaustivamente com cada papel. Usar `auth.jwt() ->> 'papel'` consistente. |
| form_submissions diverge do schema do CRM | Dados promovidos ficam desatualizados | Promoção é cópia, não sincronização. Após promover, CRM é a fonte de verdade. |

### Convivência Formulário Público + CRM

| Preocupação | Status |
|---|---|
| form_submissions continua recebendo INSERT via anon | OK — não muda |
| Cloud Functions continuam lendo form_submissions | OK — não muda |
| CRM lê form_submissions para "Leads Novos" | Precisa de SELECT policy para authenticated (nova) |
| CRM cria FK de atletas → form_submissions | Precisa da coluna form_submission_id estar preenchida |
| Schemas `uat` e `dev` não precisam de tabelas CRM no MVP | OK — CRM roda em public apenas |

### Limitações do Supabase

| Limitação | Impacto | Workaround |
|---|---|---|
| `custom_access_token` hook requer plano Pro | Sem RBAC via JWT no plano Free | Usar tabela `user_profiles` consultada no RLS (mais lento mas funcional) |
| Realtime máximo de 100 concurrent connections (Free) | Suficiente para 2–3 users | Monitorar |
| Storage limites (1GB Free, 100GB Pro) | Documentos de atletas | Monitorar. Se necessário, migrar para S3/GCS. |
| pg_cron não disponível em todos os planos | Automações de alerta | Usar Cloud Scheduler existente (já configurado). |
| Edge Functions com cold start | Latência em notificações email | Usar Cloud Functions existentes (warm). |

### Decisões Pendentes

> ⚠️ Resolver ANTES de escrever a primeira migration:

1. **Plano Supabase:** Free ou Pro? Impacta: `custom_access_token` hook, Storage, Realtime limits.
2. **GetNet:** Conciliação manual confirmada para MVP? Ou há API disponível?
3. **Calendly:** Qual plano? Tem API de webhook? Ou será link manual?
4. **ClickSign vs DocuSign:** Qual será usado? Webhook disponível?
5. **Templates WhatsApp:** Já foram submetidos à Meta? Status de aprovação?

---

## Próximos Passos

### 1. Decisões pendentes (precisam de resposta antes de codar)

- [ ] Confirmar plano Supabase (Free vs Pro) — define RBAC approach
- [ ] Confirmar integrações externas (Calendly, ClickSign, GetNet) — define webhooks
- [ ] Aprovar esta arquitetura — qualquer ajuste antes de criar migrations

### 2. Validar no Supabase antes de começar

- [ ] Verificar se extensões necessárias estão habilitadas: `pg_cron`, `pgsodium` (criptografia LGPD)
- [ ] Verificar limite de tabelas/políticas RLS no plano atual
- [ ] Testar `custom_access_token` hook (se plano Pro)
- [ ] Configurar Supabase Storage bucket para documentos
- [ ] Verificar se Supabase Realtime está habilitado

### 3. Ordem de implementação — Fase 1

1. **Migration #1–#3:** Enum types + user_profiles + audit_trail (fundação)
2. **Migration #4:** Configurações do sistema com seed
3. **Migration #5–#7:** Responsáveis + Endereços + Atletas + Deals (core CRM)
4. **Migration #18:** Audit triggers em tudo
5. **Migration #19:** Hook de auth (RBAC)
6. **Frontend:** `/crm/layout.tsx` com auth guard + sidebar
7. **Frontend:** `/crm/leads` com listagem de form_submissions + botão "Promover"
8. **Frontend:** `/crm/pipeline` com Kanban básico (mover deals entre etapas)
9. **Teste end-to-end:** formulário público → qualify → CEO promove → deal no pipeline
