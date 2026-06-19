# DATA_MODEL.md — Modelo de Dados Implementado (CRM BAUSA)

> **Este documento reflete o schema real implementado nas migrations do Supabase.** Todas as tabelas, colunas, tipos, constraints, triggers, funcoes e policies listados aqui correspondem ao codigo SQL executado. Ultima atualizacao: 2026-04-01.

---

## Sumario

1. [Schemas e Ambientes](#schemas-e-ambientes)
2. [Diagrama de Relacionamentos](#diagrama-de-relacionamentos)
3. [Tipos Enum](#tipos-enum)
4. [Tabelas](#tabelas)
   - [form_submissions](#1-form_submissions)
   - [user_profiles](#2-user_profiles)
   - [audit_logs](#3-audit_logs)
   - [configuracoes_sistema](#4-configuracoes_sistema)
   - [enderecos](#5-enderecos)
   - [responsaveis](#6-responsaveis)
   - [atletas](#7-atletas)
   - [deals](#8-deals)
   - [contratos_financeiros](#9-contratos_financeiros)
   - [parcelas](#10-parcelas)
   - [crm_experiencia](#11-crm_experiencia)
   - [contatos_experiencia](#12-contatos_experiencia)
   - [tarefas](#13-tarefas)
   - [notificacoes](#14-notificacoes)
   - [escolas](#15-escolas)
   - [historico_contatos_escola](#16-historico_contatos_escola)
   - [estrategia_escolas](#17-estrategia_escolas)
   - [documentos_atleta](#18-documentos_atleta)
   - [faq_artigos](#19-faq_artigos)
   - [indicacoes](#20-indicacoes)
5. [Colunas Computadas (GENERATED ALWAYS)](#colunas-computadas)
6. [Funcoes de Banco](#funcoes-de-banco)
7. [Triggers](#triggers)
8. [Policies RLS](#policies-rls)
9. [Seed Data](#seed-data)
10. [LGPD — Campos Sensiveis](#lgpd--campos-sensiveis)

---

## Schemas e Ambientes

O banco possui tres schemas isolados. Os schemas `uat` e `dev` contem apenas a tabela `form_submissions` (replicada de `public`).

| Schema | Ambiente | Descricao |
|--------|----------|-----------|
| `public` | PRD | Schema principal. Contém todas as tabelas do CRM e do formulario publico. |
| `uat` | UAT | Apenas `form_submissions` (replicado via `LIKE public.form_submissions INCLUDING ALL`). |
| `dev` | DEV | Apenas `form_submissions` (replicado via `LIKE public.form_submissions INCLUDING ALL`). |
| `audit` | Interno | Schema auxiliar com funcoes de auditoria (`audit.log_change`, `audit.prevent_audit_mutation`). |

> Extensao habilitada: `pg_trgm` (busca fuzzy por trigram).

---

## Diagrama de Relacionamentos

```
auth.users (Supabase Auth)
    |
    └──< user_profiles (1:1, PK = auth.users.id)
              |
              ├──< deals.responsavel_id
              ├──< tarefas.responsavel_id
              └──< notificacoes.destinatario_id

form_submissions (formulario publico)
    |
    └──< atletas.form_submission_id (1:1 opcional)

responsaveis
    ├── endereco_id ──> enderecos
    ├──< atletas.responsavel_id (1:N — irmaos)
    ├──< atletas.indicado_por_id (quem indicou)
    └──< indicacoes.responsavel_indicador_id

atletas
    ├── responsavel_id ──> responsaveis
    ├── form_submission_id ──> form_submissions (UNIQUE, opcional)
    ├── indicado_por_id ──> responsaveis (opcional)
    ├──< deals (1:N)
    ├──< crm_experiencia (1:1 via UNIQUE)
    ├──< estrategia_escolas (1:N)
    ├──< documentos_atleta (1:N)
    ├──< tarefas (opcional)
    └──< indicacoes.atleta_indicado_id

deals
    ├── atleta_id ──> atletas
    ├── responsavel_id ──> user_profiles
    ├──< contratos_financeiros (1:1 via UNIQUE deal_id)
    ├──< tarefas (opcional)
    └──< notificacoes (opcional)

contratos_financeiros
    ├── deal_id ──> deals (UNIQUE)
    └──< parcelas.contrato_id (1:N)

crm_experiencia
    ├── atleta_id ──> atletas (UNIQUE)
    ├── deal_id ──> deals
    ├── escola_confirmada_id ──> escolas (FK adicionada)
    ├──< contatos_experiencia (1:N)
    └──< tarefas (opcional)

escolas
    ├──< historico_contatos_escola (1:N)
    ├──< estrategia_escolas (1:N)
    ├──< documentos_atleta (opcional)
    └──< crm_experiencia.escola_confirmada_id

configuracoes_sistema (chave-valor, standalone)
audit_logs (append-only, standalone)
notificacoes (imutavel apos criacao)
faq_artigos (standalone, base de conhecimento)
indicacoes (responsavel → atleta)
```

---

## Tipos Enum

Todos criados via `CREATE TYPE ... AS ENUM` com guard `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`.

| Tipo | Valores |
|------|---------|
| `papel_usuario` | `ceo`, `cto`, `head_sucesso`, `comercial` (`cto` = mesmas permissões do `ceo`) |
| `status_deal` | `lead`, `reuniao_marcada`, `reuniao_realizada`, `diagnostico_fit`, `alinhamento_estrategico`, `proposta_enviada`, `followup_proposta`, `negociacao`, `contrato_enviado`, `contrato_assinado`, `sinal_pago`, `admission_process`, `concluido`, `perdido`, `cancelamento_solicitado`, `projeto_futuro` |
| `classificacao_lead` | `hot`, `warm`, `cold` |
| `status_parcela` | `previsto`, `recebido`, `atrasado`, `cancelado` |
| `temperatura_familia` | `verde`, `amarelo`, `vermelho` |
| `fase_experiencia` | `admissao`, `aprovado`, `pre_embarque`, `embarcado_inicial`, `acompanhamento`, `encerrado` |
| `prioridade_tarefa` | `critica`, `alta`, `media`, `baixa` |
| `status_tarefa` | `pendente`, `em_andamento`, `concluida`, `atrasada`, `cancelada` |
| `status_documento` | `pendente`, `enviado_atleta`, `revisado`, `enviado_escola`, `aprovado` |
| `canal_comunicacao` | `whatsapp`, `email`, `ligacao`, `presencial` |
| `status_contrato_assinatura` | `nao_enviado`, `enviado`, `assinado`, `cancelado` |
| `plano_tipo` | `journey`, `legacy`, `start` |
| `nivel_ingles` | `nenhum`, `basico`, `intermediario`, `avancado`, `fluente` |
| `nivel_competitivo` | `escolar`, `escolinha`, `clube_social`, `base_baixo`, `base_medio`, `base_alto`, `selecao`, `apenas_academico` |
| `decisao_familiar` | `decidida`, `em_discussao`, `resistente` |
| `comprometimento_atleta` | `alto`, `medio`, `baixo`, `indefinido` |
| `desempenho_academico` | `excelente`, `bom`, `regular`, `fraco` |
| `origem_lead` | `formulario_web`, `indicacao`, `instagram`, `meta_ads`, `outro` |
| `tipo_crise` | `emocional`, `academica`, `financeira`, `familiar`, `bullying`, `saude` |
| `nivel_crise` | `baixo`, `medio`, `alto`, `critico` |
| `motivo_perda` | `financeiro`, `timing`, `desistencia_familia`, `atleta_nao_qualificado`, `concorrencia`, `outro` |
| `influencia_esporte` | `decisiva`, `forte`, `moderada`, `baixa` |
| `agressividade_bolsa` | `alta`, `media`, `baixa`, `rara` |

---

## Tabelas

### 1. form_submissions

Formulario publico de captacao de leads. Origem dos dados antes do CRM.

**Schema:** `public` (replicado em `uat` e `dev`)

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `submission_id` | TEXT | NULL | — | UNIQUE | ID gerado pelo cliente para prevenir duplicatas |
| `submitted_at` | TIMESTAMPTZ | NOT NULL | `now()` | — | Data/hora do envio |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | — | Atualizado automaticamente via trigger |
| `ip_address` | TEXT | NULL | — | — | IP do remetente |
| `user_agent` | TEXT | NULL | — | — | User agent do navegador |
| `email` | TEXT | NOT NULL | — | — | Email do responsavel |
| `athlete_name` | TEXT | NOT NULL | — | — | Nome completo do atleta |
| `birth_date` | TEXT | NULL | — | — | Data de nascimento |
| `gender` | TEXT | NULL | — | — | Genero |
| `city_state` | TEXT | NULL | — | — | Cidade/estado |
| `position` | TEXT | NULL | — | — | Posicao no esporte |
| `club_history` | TEXT | NULL | — | — | Historico de clubes |
| `achievements` | TEXT | NULL | — | — | Conquistas esportivas |
| `video_link` | TEXT | NULL | — | — | Link do video highlights |
| `instagram` | TEXT | NULL | — | — | Instagram do atleta |
| `is_high_school` | TEXT | NULL | — | — | Se esta no ensino medio |
| `school_year` | TEXT | NULL | — | — | Serie/ano escolar |
| `current_school` | TEXT | NULL | — | — | Escola atual |
| `english_level` | TEXT | NULL | — | — | Nivel de ingles |
| `english_exam` | TEXT | NULL | — | — | Exame de ingles realizado |
| `exam_result` | TEXT | NULL | — | — | Resultado do exame |
| `guardian_name` | TEXT | NULL | — | — | Nome do responsavel |
| `guardian_email` | TEXT | NULL | — | — | Email do responsavel |
| `guardian_whatsapp` | TEXT | NULL | — | — | WhatsApp do responsavel |
| `guardian_profession` | TEXT | NULL | — | — | Profissao do responsavel |
| `family_address` | TEXT | NULL | — | — | Endereco da familia |
| `investment_range` | TEXT | NULL | — | — | Faixa de investimento |
| `school_priorities` | TEXT[] | NULL | — | — | Prioridades da escola (array) |
| `how_did_you_find` | TEXT | NULL | — | — | Como conheceu o programa |
| `how_did_you_find_other` | TEXT | NULL | — | — | Detalhe se "outro" |
| `why_international` | TEXT | NULL | — | — | Motivacao para intercambio |
| `status` | TEXT | NOT NULL | `'new'` | — | Status do submission |
| `notes` | TEXT | NULL | — | — | Notas internas |
| `processed_at` | TIMESTAMPTZ | NULL | — | — | Data de processamento |
| `qualified` | BOOLEAN | NULL | — | — | Se foi qualificado |
| `qualification_classification` | TEXT | NULL | — | — | QUENTE / MORNO / FRIO |
| `qualification_reason` | TEXT | NULL | — | — | Justificativa da classificacao |
| `qualification_confidence` | TEXT | NULL | — | — | Confianca da classificacao |
| `qualified_at` | TIMESTAMPTZ | NULL | — | — | Data da qualificacao |
| `whatsapp_sent_at` | TIMESTAMPTZ | NULL | — | — | Data envio WhatsApp inicial |
| `followup_1_sent_at` | TIMESTAMPTZ | NULL | — | — | Data envio follow-up 48h |
| `followup_2_sent_at` | TIMESTAMPTZ | NULL | — | — | Data envio follow-up 7 dias |
| `meeting_scheduled` | BOOLEAN | NULL | `false` | — | Se reuniao foi detectada |
| `meeting_scheduled_at` | TIMESTAMPTZ | NULL | — | — | Data deteccao da reuniao |
| `address_country` | TEXT | NULL | `'BR'` | — | Pais do lead (ISO 3166-1 alfa-2) |

**Chave primaria:** `id`
**Unique constraints:** `UNIQUE(email, athlete_name)`, `UNIQUE(submission_id)`

**Indices:**

| Nome | Colunas | Tipo | Condicao |
|------|---------|------|----------|
| `idx_form_submissions_email` | `email` | B-tree | — |
| `idx_form_submissions_status` | `status` | B-tree | — |
| `idx_form_submissions_submitted_at` | `submitted_at DESC` | B-tree | — |
| `idx_form_submissions_submission_id` | `submission_id` | B-tree | — |
| `idx_form_submissions_classification` | `qualification_classification` | B-tree | — |
| `idx_form_submissions_qualified_at` | `qualified_at` | B-tree | — |
| `idx_form_submissions_whatsapp_sent_at` | `whatsapp_sent_at` | B-tree | — |
| `idx_form_submissions_followup_1` | `followup_1_sent_at` | B-tree | — |
| `idx_form_submissions_followup_2` | `followup_2_sent_at` | B-tree | — |
| `idx_form_submissions_meeting_scheduled` | `meeting_scheduled` | B-tree | — |

---

### 2. user_profiles

Perfis de usuarios do CRM vinculados ao Supabase Auth. Controle RBAC.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | — | PK, FK → `auth.users(id)` ON DELETE CASCADE | ID do usuario Supabase |
| `papel` | `papel_usuario` | NOT NULL | — | — | Papel RBAC: ceo, cto (= ceo em permissões), head_sucesso, comercial |
| `nome` | TEXT | NOT NULL | — | — | Nome do usuario |
| `email` | TEXT | NOT NULL | — | — | Email do usuario |
| `ativo` | BOOLEAN | NOT NULL | `true` | — | Se o usuario esta ativo |
| `avatar_url` | TEXT | NULL | — | — | URL do avatar |
| `preferencias_notificacao` | JSONB | NOT NULL | `'{}'` | — | Config de notificacoes (JSON) |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |

**Chave primaria:** `id`
**Nota:** Sem `deleted_at` — usuarios sao desativados (`ativo=false`), nao deletados.

**Indices:**

| Nome | Colunas | Condicao |
|------|---------|----------|
| `idx_user_profiles_papel` | `papel` | — |
| `idx_user_profiles_ativo` | `ativo` | `WHERE ativo = true` |

---

### 3. audit_logs

Log imutavel de auditoria. Append-only. Retencao minima: 5 anos. UPDATE e DELETE sao bloqueados por triggers.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `tabela` | TEXT | NOT NULL | — | — | Nome da tabela afetada |
| `registro_id` | UUID | NOT NULL | — | — | ID do registro afetado |
| `operacao` | TEXT | NOT NULL | — | `CHECK (operacao IN ('INSERT','UPDATE','DELETE'))` | Tipo de operacao |
| `dados_anteriores` | JSONB | NULL | — | — | OLD (NULL em INSERT) |
| `dados_novos` | JSONB | NULL | — | — | NEW (NULL em DELETE) |
| `campos_alterados` | TEXT[] | NULL | — | — | Lista de campos que mudaram (UPDATE) |
| `user_id` | UUID | NULL | — | FK → `auth.users(id)` | ID do usuario que realizou a acao |
| `user_papel` | TEXT | NULL | — | — | Papel do usuario no momento |
| `ip_address` | TEXT | NULL | — | — | IP do usuario |
| `justificativa` | TEXT | NULL | — | — | Obrigatoria em operacoes especiais |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data da acao |

**Chave primaria:** `id`
**Nota:** Sem `updated_at` e `deleted_at` — tabela imutavel.

**Indices:**

| Nome | Colunas |
|------|---------|
| `idx_audit_logs_tabela_registro` | `tabela, registro_id` |
| `idx_audit_logs_user_id` | `user_id` |
| `idx_audit_logs_created_at` | `created_at DESC` |
| `idx_audit_logs_operacao` | `operacao` |

---

### 4. configuracoes_sistema

Tabela chave-valor para configuracoes editaveis pelo CEO sem necessidade de deploy.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `chave` | TEXT | NOT NULL | — | PK | Identificador unico da configuracao |
| `valor` | JSONB | NOT NULL | — | — | Valor da configuracao (qualquer tipo JSON) |
| `descricao` | TEXT | NULL | — | — | Descricao legivel da configuracao |
| `editavel_ceo` | BOOLEAN | NOT NULL | `true` | — | Se o CEO pode editar via interface |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `updated_by` | UUID | NULL | — | FK → `auth.users(id)` | Quem editou por ultimo |

**Chave primaria:** `chave`

---

### 5. enderecos

Enderecos de responsaveis/familias.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `pais` | TEXT | NOT NULL | `'BR'` | — | Pais ISO 3166-1 alfa-2 |
| `cep` | TEXT | NULL | — | — | CEP (BR) ou postal code |
| `logradouro` | TEXT | NULL | — | — | Rua/avenida |
| `numero` | TEXT | NULL | — | — | Numero |
| `complemento` | TEXT | NULL | — | — | Complemento |
| `bairro` | TEXT | NULL | — | — | Bairro |
| `cidade` | TEXT | NOT NULL | — | — | Cidade |
| `estado` | TEXT | NULL | — | — | UF (BR) ou state (US) |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`

---

### 6. responsaveis

Responsaveis legais dos atletas. Entidade de deduplicacao. Multiplos atletas (irmaos) vinculam ao mesmo responsavel.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `nome` | TEXT | NOT NULL | — | — | Nome completo |
| `email` | TEXT | NOT NULL | — | UNIQUE (parcial, `WHERE deleted_at IS NULL`) | Email do responsavel |
| `whatsapp` | TEXT | NOT NULL | — | UNIQUE (parcial, `WHERE deleted_at IS NULL`) | WhatsApp E.164 — chave de dedup primaria |
| `telefone_alternativo` | TEXT | NULL | — | — | Telefone alternativo |
| `profissao` | TEXT | NULL | — | — | Profissao |
| `parentesco` | TEXT | NULL | — | `CHECK (parentesco IN ('pai','mae','outro'))` | Parentesco com o atleta |
| `endereco_id` | UUID | NULL | — | FK → `enderecos(id)` | Endereco da familia |
| `form_submission_ids` | UUID[] | NULL | `'{}'` | — | IDs de form_submissions vinculados |
| `consentimento_lgpd` | BOOLEAN | NOT NULL | `false` | — | Consentimento LGPD |
| `consentimento_lgpd_at` | TIMESTAMPTZ | NULL | — | — | Data do consentimento |
| `aceite_whatsapp` | BOOLEAN | NOT NULL | `false` | — | Aceite para comunicacao WhatsApp |
| `aceite_email` | BOOLEAN | NOT NULL | `false` | — | Aceite para comunicacao email |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`

**Indices:**

| Nome | Colunas | Tipo | Condicao |
|------|---------|------|----------|
| `idx_responsaveis_whatsapp` | `whatsapp` | B-tree UNIQUE | `WHERE deleted_at IS NULL` |
| `idx_responsaveis_email` | `email` | B-tree UNIQUE | `WHERE deleted_at IS NULL` |
| `idx_responsaveis_nome` | `nome` | GIN (gin_trgm_ops) | — |

---

### 7. atletas

Atletas (leads estruturados) do CRM. Fonte de verdade apos promocao do formulario publico.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `nome_completo` | TEXT | NOT NULL | — | — | Nome completo do atleta |
| `data_nascimento` | DATE | NOT NULL | — | — | Data de nascimento |
| `whatsapp` | TEXT | NOT NULL | — | — | WhatsApp do atleta |
| `email` | TEXT | NULL | — | — | Email do atleta |
| `instagram` | TEXT | NULL | — | — | Instagram |
| `esporte` | TEXT | NOT NULL | — | — | Esporte principal |
| `posicao` | TEXT | NULL | — | — | Posicao no esporte |
| `nivel_competitivo` | `nivel_competitivo` | NOT NULL | — | — | Nivel competitivo esportivo |
| `historico_clubes` | TEXT | NULL | — | — | Historico de clubes |
| `conquistas` | TEXT | NULL | — | — | Conquistas esportivas |
| `video_highlights_url` | TEXT | NULL | — | — | URL do video highlights |
| `serie_escolar` | TEXT | NOT NULL | — | `CHECK (serie_escolar IN ('9th','10th','11th','12th','pg_year'))` | Serie escolar |
| `nivel_ingles` | `nivel_ingles` | NOT NULL | — | — | Nivel de ingles |
| `desempenho_academico` | `desempenho_academico` | NOT NULL | — | — | Desempenho academico |
| `escola_atual` | TEXT | NULL | — | — | Escola atual |
| `cidade_estado` | TEXT | NOT NULL | — | — | Cidade e estado |
| `modelo_educacional` | TEXT | NULL | — | — | Modelo educacional |
| `momento_inicio` | TEXT | NOT NULL | — | `CHECK (momento_inicio IN ('proximo_semestre','proximo_ano','dois_mais_anos'))` | Timing do projeto |
| `comprometimento` | `comprometimento_atleta` | NOT NULL | — | — | Nivel de comprometimento |
| `decisao_familiar` | `decisao_familiar` | NOT NULL | — | — | Decisao da familia |
| `faixa_investimento` | TEXT | NOT NULL | — | `CHECK (faixa_investimento IN ('ate_20k','20k_30k','30k_40k','40k_mais'))` | Faixa de investimento |
| `direcao_projeto` | TEXT | NULL | — | — | Direcao do projeto |
| `safra` | TEXT | NOT NULL | — | — | Safra (ex: `fall_2026`, `spring_2027`) |
| `lead_score` | INTEGER | NULL | — | `CHECK (lead_score >= 0 AND lead_score <= 100)` | Score calculado automaticamente |
| `lead_classificacao` | `classificacao_lead` | NULL | — | — | hot / warm / cold (calculado) |
| `lead_score_calculado_at` | TIMESTAMPTZ | NULL | — | — | Data do ultimo calculo |
| `responsavel_id` | UUID | NOT NULL | — | FK → `responsaveis(id)` | Responsavel legal |
| `form_submission_id` | UUID | NULL | — | FK → `form_submissions(id)`, UNIQUE | Origem do formulario (NULL se manual) |
| `origem` | `origem_lead` | NOT NULL | `'formulario_web'` | — | Canal de origem |
| `indicado_por_id` | UUID | NULL | — | FK → `responsaveis(id)` | Quem indicou (responsavel) |
| `consentimento_lgpd` | BOOLEAN | NOT NULL | `false` | — | Consentimento LGPD |
| `qualificado_gemini` | BOOLEAN | NOT NULL | `false` | — | Aprovado pela IA Gemini |
| `classificacao_gemini` | TEXT | NULL | — | — | QUENTE/MORNO/FRIO original |
| `motivo_gemini` | TEXT | NULL | — | — | Justificativa da IA |
| `confianca_gemini` | TEXT | NULL | — | — | Nível de confiança |
| `qualificado_gemini_at` | TIMESTAMPTZ | NULL | — | — | Data da qualificação |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`
**Unique constraints:** `form_submission_id` (impede promocao duplicada)

**Indices:**

| Nome | Colunas | Tipo | Condicao |
|------|---------|------|----------|
| `idx_atletas_responsavel` | `responsavel_id` | B-tree | — |
| `idx_atletas_lead_score` | `lead_score DESC NULLS LAST` | B-tree | `WHERE deleted_at IS NULL` |
| `idx_atletas_classificacao` | `lead_classificacao` | B-tree | `WHERE deleted_at IS NULL` |
| `idx_atletas_safra` | `safra` | B-tree | `WHERE deleted_at IS NULL` |
| `idx_atletas_form_submission` | `form_submission_id` | B-tree | `WHERE form_submission_id IS NOT NULL` |
| `idx_atletas_origem` | `origem` | B-tree | — |
| `idx_atletas_nome_completo` | `nome_completo` | GIN (gin_trgm_ops) | — |
| `idx_atletas_created_at` | `created_at DESC` | B-tree | `WHERE deleted_at IS NULL` |

---

### 8. deals

Oportunidades comerciais do pipeline. 16 etapas (14 regulares + projeto_futuro + cancelamento_solicitado).

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `atleta_id` | UUID | NOT NULL | — | FK → `atletas(id)` | Atleta vinculado |
| `etapa` | `status_deal` | NOT NULL | `'lead'` | — | Etapa atual do pipeline |
| `etapa_anterior` | `status_deal` | NULL | — | — | Etapa anterior (setada por trigger) |
| `responsavel_id` | UUID | NOT NULL | — | FK → `user_profiles(id)` | Usuario responsavel pelo deal |
| `valor_estimado` | NUMERIC(10,2) | NULL | — | — | Valor estimado da negociacao |
| `probabilidade_fechamento` | INTEGER | NULL | — | `CHECK (>= 0 AND <= 100)` | Probabilidade de fechamento (%) |
| `status_decisao_familia` | `decisao_familiar` | NULL | — | — | Status da decisao familiar |
| `notas_reuniao` | TEXT | NULL | — | — | Notas de reuniao |
| `next_action` | TEXT | NULL | — | — | Proxima acao (obrigatoria para avancar) |
| `data_proxima_acao` | DATE | NULL | — | — | Data da proxima acao |
| `motivo_perda` | `motivo_perda` | NULL | — | — | Motivo se deal perdido |
| `detalhe_perda` | TEXT | NULL | — | — | Detalhe da perda |
| `pode_reativar` | BOOLEAN | NULL | — | — | Se pode ser reativado |
| `data_reativacao` | DATE | NULL | — | — | Data planejada de reativacao |
| `motivo_retrocesso` | TEXT | NULL | — | — | Obrigatorio quando etapa retrocede |
| `flag_retrocedido` | BOOLEAN | NOT NULL | `false` | — | Se a etapa ja retrocedeu |
| `flag_valores_customizados` | BOOLEAN | NOT NULL | `false` | — | Se valores foram customizados |
| `reuniao_realizada_at` | TIMESTAMPTZ | NULL | — | — | Data da reuniao realizada (auto) |
| `contrato_enviado_at` | TIMESTAMPTZ | NULL | — | — | Data de envio do contrato (auto) |
| `contrato_assinado_at` | TIMESTAMPTZ | NULL | — | — | Data de assinatura (auto) |
| `sinal_pago_at` | TIMESTAMPTZ | NULL | — | — | Data de pagamento do sinal (auto) |
| `sinal_pago_confirmado_por` | UUID | NULL | — | FK → `auth.users(id)` | Quem confirmou o sinal |
| `docusign_envelope_id` | TEXT | NULL | — | — | ID do envelope DocuSign |
| `docusign_status` | `status_contrato_assinatura` | NULL | `'nao_enviado'` | — | Status da assinatura digital |
| `google_calendar_event_id` | TEXT | NULL | — | — | ID do evento no Google Calendar |
| `reuniao_agendada_at` | TIMESTAMPTZ | NULL | — | — | Quando a reunião foi detectada |
| `reuniao_link` | TEXT | NULL | — | — | Link do Calendar/Meet |
| `reuniao_data` | TIMESTAMPTZ | NULL | — | — | Data/hora da reunião marcada |
| `projeto_futuro_ano` | INTEGER | NULL | — | — | Ano do projeto futuro |
| `projeto_futuro_data_reativacao` | DATE | NULL | — | — | Data de reativacao do projeto futuro |
| `safra` | TEXT | NULL | — | — | Safra do deal |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`

**Indices:**

| Nome | Colunas | Condicao |
|------|---------|----------|
| `idx_deals_atleta` | `atleta_id` | — |
| `idx_deals_etapa` | `etapa` | `WHERE deleted_at IS NULL` |
| `idx_deals_responsavel` | `responsavel_id` | — |
| `idx_deals_data_proxima_acao` | `data_proxima_acao` | `WHERE deleted_at IS NULL` |
| `idx_deals_sinal_pago` | `sinal_pago_at` | `WHERE sinal_pago_at IS NOT NULL` |
| `idx_deals_safra` | `safra` | `WHERE deleted_at IS NULL` |
| `idx_deals_ativos` | `etapa, data_proxima_acao` | `WHERE deleted_at IS NULL AND etapa NOT IN ('perdido','concluido','cancelamento_solicitado')` |
| `idx_deals_sem_next_action` | `created_at` | `WHERE next_action IS NULL AND deleted_at IS NULL AND etapa NOT IN ('perdido','concluido','cancelamento_solicitado')` |
| `idx_deals_created_at` | `created_at DESC` | `WHERE deleted_at IS NULL` |

---

### 9. contratos_financeiros

Contrato financeiro vinculado 1:1 ao deal. Apenas CEO pode criar/editar.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `deal_id` | UUID | NOT NULL | — | FK → `deals(id)`, UNIQUE | Deal vinculado (1:1) |
| `plano` | `plano_tipo` | NOT NULL | — | — | Plano: journey, legacy, start |
| `forma_pagamento_plano` | TEXT | NOT NULL | — | `CHECK IN ('padrao','pix_avista')` | Forma de pagamento do plano |
| `valor_total` | NUMERIC(10,2) | NOT NULL | — | — | Valor total do contrato |
| `valor_customizado` | NUMERIC(10,2) | NULL | — | — | Valor customizado (se diferente do padrao) |
| `justificativa_customizacao` | TEXT | NULL | — | — | Obrigatoria se customizado (Regra 3) |
| `entrada_valor` | NUMERIC(10,2) | NOT NULL | `4500.00` | — | Valor da entrada (sinal) |
| `entrada_forma` | TEXT | NOT NULL | — | `CHECK IN ('pix','getnet_parcelado')` | Forma de pagamento da entrada |
| `entrada_parcelas` | INTEGER | NOT NULL | `1` | — | Numero de parcelas da entrada |
| `entrada_paga` | BOOLEAN | NOT NULL | `false` | — | Se a entrada foi paga |
| `entrada_paga_at` | TIMESTAMPTZ | NULL | — | — | Data do pagamento da entrada |
| `saldo_remanescente` | NUMERIC(10,2) | NOT NULL | — | **GENERATED ALWAYS AS** (`valor_total - entrada_valor`) STORED | Saldo calculado automaticamente |
| `saldo_forma` | TEXT | NULL | — | `CHECK IN ('pix_avista','getnet_parcelado')` | Forma de pagamento do saldo |
| `saldo_parcelas` | INTEGER | NULL | — | — | Numero de parcelas do saldo |
| `inclui_psicologa` | BOOLEAN | NOT NULL | `false` | — | Se inclui psicóloga intercultural |
| `custo_psicologa` | NUMERIC(10,2) | NULL | `1200.00` | — | Custo da psicóloga por cliente |
| `lucro_estimado` | NUMERIC(10,2) | NULL | — | — | Lucro estimado (atualizado por aplicacao) |
| `nf_status` | TEXT | NOT NULL | `'pendente'` | `CHECK IN ('pendente','emitida','nao_aplicavel')` | Status da nota fiscal |
| `nf_numero` | TEXT | NULL | — | — | Numero da NF |
| `nf_emitida_at` | TIMESTAMPTZ | NULL | — | — | Data de emissao da NF |
| `nf_valor` | NUMERIC(10,2) | NULL | — | — | Valor da NF |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`
**Unique constraints:** `deal_id` (garante 1:1 com deals)

**Indices:**

| Nome | Colunas |
|------|---------|
| `idx_contratos_deal` | `deal_id` |

---

### 10. parcelas

Agenda de recebiveis. Gerada ao criar contrato. CEO confirma recebimento.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `contrato_id` | UUID | NOT NULL | — | FK → `contratos_financeiros(id)` | Contrato vinculado |
| `tipo` | TEXT | NOT NULL | — | `CHECK IN ('entrada','saldo')` | Tipo da parcela |
| `numero_parcela` | TEXT | NOT NULL | — | — | Numero (ex: '1/6') |
| `valor` | NUMERIC(10,2) | NOT NULL | — | — | Valor da parcela |
| `vencimento` | DATE | NOT NULL | — | — | Data de vencimento |
| `metodo` | TEXT | NOT NULL | — | `CHECK IN ('pix','getnet')` | Metodo de pagamento |
| `status` | `status_parcela` | NOT NULL | `'previsto'` | — | Status: previsto, recebido, atrasado, cancelado |
| `recebido_at` | TIMESTAMPTZ | NULL | — | — | Data do recebimento |
| `comprovante_url` | TEXT | NULL | — | — | URL do comprovante |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`

**Indices:**

| Nome | Colunas | Condicao |
|------|---------|----------|
| `idx_parcelas_contrato` | `contrato_id` | — |
| `idx_parcelas_vencimento` | `vencimento` | `WHERE deleted_at IS NULL` |
| `idx_parcelas_status` | `status` | `WHERE deleted_at IS NULL` |
| `idx_parcelas_atrasadas` | `vencimento, contrato_id` | `WHERE status = 'atrasado' AND deleted_at IS NULL` |
| `idx_parcelas_proximas` | `vencimento` | `WHERE status = 'previsto' AND deleted_at IS NULL` |

---

### 11. crm_experiencia

Registro de experiencia pos-venda. 1:1 com atleta. Handoff automatico quando sinal e pago.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `atleta_id` | UUID | NOT NULL | — | FK → `atletas(id)`, UNIQUE | Atleta vinculado (1:1) |
| `deal_id` | UUID | NOT NULL | — | FK → `deals(id)` | Deal de origem |
| `fase` | `fase_experiencia` | NOT NULL | `'admissao'` | — | Fase da jornada pos-venda |
| `temperatura` | `temperatura_familia` | NOT NULL | `'verde'` | — | Temperatura automatica da familia |
| `ansiedade` | INTEGER | NULL | `3` | `CHECK (>= 1 AND <= 5)` | Nivel de ansiedade (1-5) |
| `satisfacao` | INTEGER | NULL | `5` | `CHECK (>= 1 AND <= 5)` | Nivel de satisfacao (1-5) |
| `risco_percebido` | INTEGER | NULL | `1` | `CHECK (>= 1 AND <= 5)` | Risco percebido (1-5) |
| `tipos_risco` | TEXT[] | NULL | `'{}'` | — | Tipos de risco identificados |
| `status` | TEXT | NOT NULL | `'satisfeita'` | `CHECK IN ('satisfeita','atencao','crise')` | Status da familia |
| `descricao_problema` | TEXT | NULL | — | — | Descricao do problema (se houver) |
| `acao_em_andamento` | TEXT | NULL | — | — | Acao sendo tomada |
| `tipo_crise` | `tipo_crise` | NULL | — | — | Tipo de crise (se aplicavel) |
| `nivel_crise` | `nivel_crise` | NULL | — | — | Nivel da crise |
| `psicologa_acionada` | BOOLEAN | NOT NULL | `false` | — | Se a psicologa foi acionada |
| `psicologa_acionada_at` | TIMESTAMPTZ | NULL | — | — | Data do acionamento |
| `data_ultimo_contato` | TIMESTAMPTZ | NULL | — | — | Data do ultimo contato |
| `tipo_ultimo_contato` | `canal_comunicacao` | NULL | — | — | Canal do ultimo contato |
| `proximo_contato` | TIMESTAMPTZ | NULL | — | — | Data do proximo contato planejado |
| `data_prevista_embarque` | DATE | NULL | — | — | Data prevista de embarque |
| `escola_confirmada_id` | UUID | NULL | — | FK → `escolas(id)` (adicionada em migration posterior) | Escola confirmada |
| `nps_6meses` | INTEGER | NULL | — | `CHECK (>= 1 AND <= 10)` | NPS 6 meses |
| `nps_enviado_at` | TIMESTAMPTZ | NULL | — | — | Data de envio do NPS |
| `retencao_segundo_ano` | BOOLEAN | NULL | — | — | Se reteve para segundo ano |
| `indicacoes_geradas` | INTEGER | NOT NULL | `0` | — | Numero de indicacoes geradas |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`
**Unique constraints:** `atleta_id` (garante 1:1 com atletas)

**Indices:**

| Nome | Colunas | Condicao |
|------|---------|----------|
| `idx_crm_experiencia_atleta` | `atleta_id` | — |
| `idx_crm_experiencia_fase` | `fase` | `WHERE deleted_at IS NULL` |
| `idx_crm_experiencia_temperatura` | `temperatura` | `WHERE deleted_at IS NULL` |
| `idx_crm_experiencia_status` | `status` | `WHERE deleted_at IS NULL` |

---

### 12. contatos_experiencia

Historico de contatos realizados com a familia no pos-venda.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `experiencia_id` | UUID | NOT NULL | — | FK → `crm_experiencia(id)` | Experiencia vinculada |
| `tipo` | `canal_comunicacao` | NOT NULL | — | — | Canal do contato |
| `resumo` | TEXT | NOT NULL | — | — | Resumo do contato |
| `proximo_contato` | TIMESTAMPTZ | NULL | — | — | Data do proximo contato |
| `registrado_por` | UUID | NULL | — | FK → `auth.users(id)` | Quem registrou |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`

**Indices:**

| Nome | Colunas |
|------|---------|
| `idx_contatos_exp_experiencia` | `experiencia_id` |

---

### 13. tarefas

Tarefas manuais ou automaticas vinculadas a deals, atletas ou experiencias.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `titulo` | TEXT | NOT NULL | — | — | Titulo da tarefa |
| `descricao` | TEXT | NULL | — | — | Descricao detalhada |
| `responsavel_id` | UUID | NOT NULL | — | FK → `user_profiles(id)` | Usuario responsavel |
| `prazo` | TIMESTAMPTZ | NOT NULL | — | — | Prazo de conclusao |
| `prioridade` | `prioridade_tarefa` | NOT NULL | `'media'` | — | Prioridade: critica, alta, media, baixa |
| `status` | `status_tarefa` | NOT NULL | `'pendente'` | — | Status: pendente, em_andamento, concluida, atrasada, cancelada |
| `deal_id` | UUID | NULL | — | FK → `deals(id)` | Deal vinculado (opcional) |
| `atleta_id` | UUID | NULL | — | FK → `atletas(id)` | Atleta vinculado (opcional) |
| `experiencia_id` | UUID | NULL | — | FK → `crm_experiencia(id)` | Experiencia vinculada (opcional) |
| `modulo_origem` | TEXT | NOT NULL | `'comercial'` | `CHECK IN ('comercial','experiencia','financeiro','admissao')` | Modulo que gerou a tarefa |
| `criada_automaticamente` | BOOLEAN | NOT NULL | `false` | — | Se foi criada por automacao |
| `recorrencia` | TEXT | NOT NULL | `'nenhuma'` | `CHECK IN ('nenhuma','diaria','semanal','mensal')` | Frequencia de recorrencia |
| `completed_at` | TIMESTAMPTZ | NULL | — | — | Data de conclusao |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`

**Indices:**

| Nome | Colunas | Condicao |
|------|---------|----------|
| `idx_tarefas_responsavel` | `responsavel_id` | `WHERE deleted_at IS NULL` |
| `idx_tarefas_status` | `status` | `WHERE deleted_at IS NULL` |
| `idx_tarefas_prazo` | `prazo` | `WHERE deleted_at IS NULL AND status != 'concluida'` |
| `idx_tarefas_deal` | `deal_id` | `WHERE deal_id IS NOT NULL` |

---

### 14. notificacoes

Notificacoes in-app. Imutavel apos criacao (sem `updated_at` nem `deleted_at`). Toda notificacao e espelhada ao CEO.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `destinatario_id` | UUID | NOT NULL | — | FK → `auth.users(id)` | Usuario destinatario |
| `titulo` | TEXT | NOT NULL | — | — | Titulo da notificacao |
| `mensagem` | TEXT | NOT NULL | — | — | Mensagem completa |
| `tipo` | TEXT | NOT NULL | — | — | Tipo da notificacao |
| `severidade` | TEXT | NOT NULL | — | `CHECK IN ('critica','alta','media','baixa')` | Nivel de severidade |
| `lida` | BOOLEAN | NOT NULL | `false` | — | Se foi lida |
| `lida_at` | TIMESTAMPTZ | NULL | — | — | Data da leitura |
| `deal_id` | UUID | NULL | — | FK → `deals(id)` | Deal vinculado (opcional) |
| `link` | TEXT | NULL | — | — | Link para navegacao |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |

**Chave primaria:** `id`

**Indices:**

| Nome | Colunas | Condicao |
|------|---------|----------|
| `idx_notif_destinatario` | `destinatario_id, lida, created_at DESC` | — |
| `idx_notif_deal` | `deal_id` | `WHERE deal_id IS NOT NULL` |
| `idx_notif_severidade` | `severidade` | `WHERE lida = false` |

---

### 15. escolas

Base institucional de boarding schools americanas. Cadastro manual pelo CEO.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `nome` | TEXT | NOT NULL | — | — | Nome da escola |
| `estado_us` | TEXT | NOT NULL | — | — | Estado americano |
| `cidade` | TEXT | NOT NULL | — | — | Cidade |
| `tipo` | TEXT | NOT NULL | — | `CHECK IN ('boarding','day','mista')` | Tipo de escola |
| `status` | TEXT | NOT NULL | `'ativa'` | `CHECK IN ('ativa','inativa','em_analise')` | Status da escola |
| `website` | TEXT | NULL | — | — | URL do site |
| `notas_internas` | TEXT | NULL | — | — | Notas internas |
| `budget_minimo_usd` | NUMERIC(10,2) | NULL | — | — | Budget minimo exigido (USD) |
| `budget_forte_usd` | NUMERIC(10,2) | NULL | — | — | Budget forte/desejavel (USD) |
| `agressividade_bolsa` | `agressividade_bolsa` | NULL | — | — | Nivel de agressividade na bolsa |
| `regra_pratica` | TEXT | NULL | — | — | Regras praticas de bolsa |
| `ingles_minimo` | `nivel_ingles` | NULL | `'intermediario'` | — | Nivel minimo de ingles |
| `testes_exigidos` | TEXT[] | NULL | `'{}'` | — | Testes exigidos |
| `nota_minima_duolingo` | INTEGER | NULL | — | — | Nota minima Duolingo |
| `nota_minima_psat` | INTEGER | NULL | — | — | Nota minima PSAT |
| `nota_minima_ssat` | INTEGER | NULL | — | — | Nota minima SSAT |
| `gpa_minimo` | NUMERIC(3,2) | NULL | — | — | GPA minimo exigido |
| `esportes_oferecidos` | TEXT[] | NULL | `'{}'` | — | Esportes oferecidos |
| `influencia_esporte` | `influencia_esporte` | NULL | `'moderada'` | — | Influencia do esporte na admissao |
| `aceita_excecao_elite` | BOOLEAN | NULL | `false` | — | Se aceita excecao para atletas de elite |
| `nota_esporte` | TEXT | NULL | — | — | Notas sobre esporte |
| `series_preferenciais` | TEXT[] | NULL | `'{}'` | — | Series preferenciais |
| `serie_maxima` | TEXT | NULL | `'12th'` | — | Serie maxima aceita |
| `nota_series` | TEXT | NULL | — | — | Notas sobre series |
| `deadline_fall` | DATE | NULL | — | — | Deadline para Fall |
| `deadline_spring` | DATE | NULL | — | — | Deadline para Spring |
| `rolling_admission` | BOOLEAN | NULL | `false` | — | Se aceita rolling admission |
| `tempo_medio_resposta` | INTEGER | NULL | — | — | Tempo medio de resposta (dias) |
| `total_aplicados` | INTEGER | NOT NULL | `0` | — | Total de atletas BAUSA aplicados |
| `total_aceitos` | INTEGER | NOT NULL | `0` | — | Total de atletas BAUSA aceitos |
| `taxa_aceitacao` | NUMERIC(5,2) | NOT NULL | — | **GENERATED ALWAYS AS** (`CASE WHEN total_aplicados > 0 THEN total_aceitos / total_aplicados * 100 ELSE 0 END`) STORED | Taxa de aceitacao calculada |
| `bolsa_media_obtida` | NUMERIC(5,2) | NULL | — | — | Bolsa media obtida (%) |
| `admissions_officer_nome` | TEXT | NULL | — | — | Nome do officer de admissao |
| `admissions_officer_email` | TEXT | NULL | — | — | Email do officer |
| `admissions_officer_telefone` | TEXT | NULL | — | — | Telefone do officer |
| `temperatura_relacionamento` | TEXT | NULL | `'neutro'` | `CHECK IN ('forte','bom','neutro','frio')` | Temperatura do relacionamento |
| `ultimo_contato_at` | DATE | NULL | — | — | Data do ultimo contato |
| `proximo_contato_at` | DATE | NULL | — | — | Data do proximo contato |
| `tipo_ultimo_contato` | TEXT | NULL | — | — | Tipo do ultimo contato |
| `notas_relacionamento` | TEXT | NULL | — | — | Notas do relacionamento |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`

**Indices:**

| Nome | Colunas | Tipo | Condicao |
|------|---------|------|----------|
| `idx_escolas_status` | `status` | B-tree | `WHERE deleted_at IS NULL` |
| `idx_escolas_estado` | `estado_us` | B-tree | `WHERE deleted_at IS NULL` |
| `idx_escolas_tipo` | `tipo` | B-tree | `WHERE deleted_at IS NULL` |
| `idx_escolas_nome` | `nome` | GIN (gin_trgm_ops) | — |

---

### 16. historico_contatos_escola

Timeline de interacoes com escolas (officer de admissao).

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `escola_id` | UUID | NOT NULL | — | FK → `escolas(id)` | Escola vinculada |
| `data` | DATE | NOT NULL | — | — | Data do contato |
| `tipo` | TEXT | NOT NULL | — | — | Tipo do contato |
| `resumo` | TEXT | NOT NULL | — | — | Resumo do contato |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`

**Indices:**

| Nome | Colunas |
|------|---------|
| `idx_hist_escola` | `escola_id` |

---

### 17. estrategia_escolas

Escolas-alvo por atleta. Vinculo N:N entre atletas e escolas com metadados de match e aplicacao.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `atleta_id` | UUID | NOT NULL | — | FK → `atletas(id)` | Atleta |
| `escola_id` | UUID | NOT NULL | — | FK → `escolas(id)` | Escola alvo |
| `match_score` | INTEGER | NULL | — | `CHECK (>= 0 AND <= 100)` | Score de match calculado |
| `prioridade` | TEXT | NULL | — | `CHECK IN ('primeira','segunda','terceira','safety')` | Prioridade da escola |
| `status` | TEXT | NOT NULL | `'planejamento'` | `CHECK IN ('pre_acordada','rede_ativa','planejamento','observacao_futura')` | Status da estrategia |
| `bolsa_estimada_pct` | NUMERIC(5,2) | NULL | — | — | Bolsa estimada (%) |
| `bolsa_estimada_valor` | NUMERIC(10,2) | NULL | — | — | Bolsa estimada (USD) |
| `bolsa_obtida_pct` | NUMERIC(5,2) | NULL | — | — | Bolsa obtida (%) |
| `bolsa_obtida_valor` | NUMERIC(10,2) | NULL | — | — | Bolsa obtida (USD) |
| `data_aplicacao` | DATE | NULL | — | — | Data da aplicacao |
| `data_resposta` | DATE | NULL | — | — | Data da resposta |
| `resultado` | TEXT | NOT NULL | `'nao_aplicado'` | `CHECK IN ('aceito','recusado','waitlist','pendente','nao_aplicado')` | Resultado da aplicacao |
| `observacao` | TEXT | NULL | — | — | Observacoes |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`
**Unique constraints:** `UNIQUE(atleta_id, escola_id)`

**Indices:**

| Nome | Colunas | Condicao |
|------|---------|----------|
| `idx_estrategia_atleta` | `atleta_id` | — |
| `idx_estrategia_escola` | `escola_id` | — |
| `idx_estrategia_resultado` | `resultado` | `WHERE deleted_at IS NULL` |

---

### 18. documentos_atleta

Documentos do atleta para processo de admissao. Checklist por escola.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `atleta_id` | UUID | NOT NULL | — | FK → `atletas(id)` | Atleta |
| `escola_id` | UUID | NULL | — | FK → `escolas(id)` | Escola (opcional) |
| `tipo` | TEXT | NOT NULL | — | — | Tipo do documento (livre) |
| `status` | `status_documento` | NOT NULL | `'pendente'` | — | Status do documento |
| `arquivo_url` | TEXT | NULL | — | — | URL do arquivo no storage |
| `arquivo_nome` | TEXT | NULL | — | — | Nome do arquivo |
| `data_upload` | TIMESTAMPTZ | NULL | — | — | Data do upload |
| `data_envio_escola` | DATE | NULL | — | — | Data de envio para a escola |
| `deadline` | DATE | NULL | — | — | Prazo de envio |
| `observacao` | TEXT | NULL | — | — | Observacoes |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`

**Indices:**

| Nome | Colunas | Condicao |
|------|---------|----------|
| `idx_docs_atleta` | `atleta_id` | `WHERE deleted_at IS NULL` |
| `idx_docs_escola` | `escola_id` | `WHERE escola_id IS NOT NULL` |
| `idx_docs_status` | `status` | `WHERE deleted_at IS NULL` |

---

### 19. faq_artigos

Base de conhecimento interna. Artigos informativos com busca rapida e copia para WhatsApp.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `titulo` | TEXT | NOT NULL | — | — | Titulo do artigo |
| `categoria` | TEXT | NOT NULL | — | `CHECK IN ('visto','documentacao','embarque','adaptacao','financeiro','escola','saude','outros')` | Categoria |
| `conteudo` | TEXT | NOT NULL | — | — | Conteudo do artigo (rich text) |
| `fases_aplicaveis` | TEXT[] | NULL | `'{}'` | — | Fases aplicaveis (ex: admissao, pre_embarque) |
| `acessos` | INTEGER | NOT NULL | `0` | — | Contador de acessos |
| `arquivado` | BOOLEAN | NOT NULL | `false` | — | Se esta arquivado |
| `criado_por` | UUID | NULL | — | FK → `auth.users(id)` | Quem criou |
| `atualizado_por` | UUID | NULL | — | FK → `auth.users(id)` | Quem atualizou |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |

**Chave primaria:** `id`
**Nota:** Sem `deleted_at` — artigos sao arquivados (`arquivado=true`), nao deletados.

**Indices:**

| Nome | Colunas | Tipo | Condicao |
|------|---------|------|----------|
| `idx_faq_categoria` | `categoria` | B-tree | `WHERE arquivado = false` |
| `idx_faq_titulo` | `titulo` | GIN (gin_trgm_ops) | — |
| `idx_faq_conteudo` | `conteudo` | GIN (gin_trgm_ops) | — |
| `idx_faq_acessos` | `acessos DESC` | B-tree | `WHERE arquivado = false` |

---

### 20. indicacoes

Programa de indicacao. Responsavel existente indica novo atleta.

| Coluna | Tipo | Nullable | Default | Constraint | Descricao |
|--------|------|----------|---------|------------|-----------|
| `id` | UUID | NOT NULL | `gen_random_uuid()` | PK | Identificador unico |
| `responsavel_indicador_id` | UUID | NOT NULL | — | FK → `responsaveis(id)` | Responsavel que indicou |
| `atleta_indicado_id` | UUID | NOT NULL | — | FK → `atletas(id)` | Atleta indicado |
| `status` | TEXT | NOT NULL | `'pendente'` | `CHECK IN ('pendente','em_negociacao','convertido','perdido')` | Status da indicacao |
| `recompensa_devida` | BOOLEAN | NOT NULL | `false` | — | Se a recompensa e devida |
| `recompensa_entregue` | BOOLEAN | NOT NULL | `false` | — | Se a recompensa foi entregue |
| `recompensa_entregue_at` | TIMESTAMPTZ | NULL | — | — | Data da entrega da recompensa |
| `recompensa_descricao` | TEXT | NULL | — | — | Descricao da recompensa |
| `observacao` | TEXT | NULL | — | — | Observacoes |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Data de criacao |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | — | Atualizado via trigger |
| `deleted_at` | TIMESTAMPTZ | NULL | — | — | Soft delete |
| `created_by` | UUID | NULL | — | FK → `auth.users(id)` | Criador |

**Chave primaria:** `id`

**Indices:**

| Nome | Colunas | Condicao |
|------|---------|----------|
| `idx_indicacoes_indicador` | `responsavel_indicador_id` | — |
| `idx_indicacoes_atleta` | `atleta_indicado_id` | — |
| `idx_indicacoes_status` | `status` | `WHERE deleted_at IS NULL` |

---

## Colunas Computadas

Colunas com `GENERATED ALWAYS AS ... STORED` que sao calculadas automaticamente pelo PostgreSQL.

| Tabela | Coluna | Formula | Descricao |
|--------|--------|---------|-----------|
| `contratos_financeiros` | `saldo_remanescente` | `valor_total - entrada_valor` | Saldo apos entrada |
| `escolas` | `taxa_aceitacao` | `CASE WHEN total_aplicados > 0 THEN (total_aceitos / total_aplicados * 100) ELSE 0 END` | Taxa de aceitacao BAUSA (%) |

---

## Funcoes de Banco

### Funcoes Utilitarias

| Funcao | Parametros | Retorno | Descricao |
|--------|-----------|---------|-----------|
| `public.set_updated_at()` | — | TRIGGER | Trigger generico que seta `NEW.updated_at = NOW()`. Usado em todas as tabelas CRM. |
| `public.update_form_submissions_updated_at()` | — | TRIGGER | Trigger de `updated_at` especifico para `form_submissions`. |
| `public.update_updated_at_column()` | — | TRIGGER | Variante de `updated_at` para schemas `uat` e `dev`. |
| `public.get_user_papel()` | — | TEXT | Retorna o papel EFETIVO de autorização (`ceo`/`head_sucesso`/`comercial`) do usuario autenticado (`auth.uid()`). **`cto` resolve para `ceo`** (mesmas permissões; por isso policies `= 'ceo'` não mudam). `SECURITY DEFINER STABLE`. Usada em todas as policies RLS. |
| `public.set_audit_user()` | — | VOID | Seta `audit.user_id` e `audit.user_papel` no contexto da transacao via `set_config`. Chamada via RPC antes de operacoes com audit trail. `SECURITY DEFINER`. |
| `audit.log_change()` | — | TRIGGER | Trigger generico de audit. Captura tabela, id, operacao, OLD, NEW, campos alterados, user_id, papel, IP. Aplicado em todas as tabelas CRM. `SECURITY DEFINER`. |
| `audit.prevent_audit_mutation()` | — | TRIGGER | Bloqueia UPDATE e DELETE na tabela `audit_logs`. Lanca excecao. |

### Funcoes de Negocio — Lead Score

| Funcao | Parametros | Retorno | Descricao |
|--------|-----------|---------|-----------|
| `public.calcular_lead_score(UUID)` | `p_atleta_id` | INTEGER (0-100) | Calcula Lead Score com base nos pesos lidos de `configuracoes_sistema.lead_score_pesos`. Fatores: investimento (25), timing (20), ingles (15), academico (15), competitivo (10), comprometimento+decisao (10), video (5). `STABLE SECURITY DEFINER`. |
| `public.trg_calcular_lead_score()` | — | TRIGGER | Calcula lead_score, lead_classificacao e lead_score_calculado_at automaticamente ao inserir/atualizar colunas relevantes do atleta. Usa faixas de `configuracoes_sistema.lead_score_faixas`. |

### Funcoes de Negocio — Motor de Match

| Funcao | Parametros | Retorno | Descricao |
|--------|-----------|---------|-----------|
| `public.serie_ordem(TEXT)` | serie | INTEGER | Mapeia serie escolar para inteiro: 9th=9, 10th=10, 11th=11, 12th=12, pg_year=13. `IMMUTABLE`. |
| `public.faixa_para_usd(TEXT)` | faixa | NUMERIC | Mapeia faixa de investimento para USD: ate_20k=15000, 20k_30k=25000, 30k_40k=35000, 40k_mais=45000. `IMMUTABLE`. |
| `public.ingles_score(TEXT)` | nivel | INTEGER | Mapeia nivel de ingles para score 0-100: nenhum=0, basico=30, intermediario=60, avancado=80, fluente=100. `IMMUTABLE`. |
| `public.competitivo_score(TEXT)` | nivel | INTEGER | Mapeia nivel competitivo para score 0-100: escolar=10, escolinha=20, clube_social=30, base_baixo=40, base_medio=60, base_alto=80, selecao=100, apenas_academico=0. `IMMUTABLE`. |
| `public.influencia_mult(TEXT)` | influencia | NUMERIC | Mapeia influencia do esporte para multiplicador 0-1: baixa=0.25, moderada=0.50, forte=0.75, decisiva=1.0. `IMMUTABLE`. |
| `public.calcular_match_score(UUID, UUID)` | `p_atleta_id`, `p_escola_id` | INTEGER (0-100) | Motor de Match completo. Filtros eliminatorios: escola inativa, serie acima do maximo, budget insuficiente (exceto atleta elite), esporte nao oferecido. Scoring: financeiro (30), academico (25), esportivo (25), serie (10), historico BAUSA (10). Regra especial Apenas Academico redistribui: acad=50, esp=0. `STABLE SECURITY DEFINER`. |
| `public.sugerir_escolas(UUID, INTEGER)` | `p_atleta_id`, `p_limite` (default 10) | TABLE(escola_id, escola_nome, estado, tipo, score, classificacao) | Retorna top N escolas por match score. Classificacao: >=85 excelente, >=70 forte, >=50 possivel, <50 fraco. `STABLE SECURITY DEFINER`. |

### Funcoes de Negocio — CRM Experiencia

| Funcao | Parametros | Retorno | Descricao |
|--------|-----------|---------|-----------|
| `public.trg_experiencia_temperatura()` | — | TRIGGER | Calcula temperatura automatica: ansiedade>=4 OR satisfacao<=2 → vermelho; ansiedade<=2 AND satisfacao>=4 AND status=satisfeita → verde; demais → amarelo. |
| `public.familias_em_alerta_inatividade()` | — | TABLE(experiencia_id, atleta_nome, dias, fase, threshold) | Retorna familias com dias sem contato acima do threshold por fase: admissao=7, pre_embarque=15, embarcado_inicial=7, acompanhamento=30. `STABLE SECURITY DEFINER`. |

### Funcoes de Negocio — Pipeline

| Funcao | Parametros | Retorno | Descricao |
|--------|-----------|---------|-----------|
| `public.ordem_etapa(status_deal)` | `p_etapa` | INTEGER | Mapeia etapa do pipeline para inteiro (1-16) para detectar retrocesso. `IMMUTABLE`. |
| `public.trg_deals_check_etapa()` | — | TRIGGER | Ao mudar etapa: salva etapa_anterior, detecta retrocesso (flag_retrocedido=true), seta timestamps de marcos (reuniao_realizada_at, contrato_enviado_at, contrato_assinado_at, sinal_pago_at). |

---

## Triggers

### Triggers de updated_at

Todas as tabelas CRM usam `public.set_updated_at()`. A `form_submissions` usa `public.update_form_submissions_updated_at()`.

| Trigger | Tabela | Evento | Funcao |
|---------|--------|--------|--------|
| `update_form_submissions_updated_at` | `form_submissions` | BEFORE UPDATE | `update_form_submissions_updated_at()` |
| `trg_user_profiles_updated_at` | `user_profiles` | BEFORE UPDATE | `set_updated_at()` |
| `trg_configuracoes_updated_at` | `configuracoes_sistema` | BEFORE UPDATE | `set_updated_at()` |
| `trg_enderecos_updated_at` | `enderecos` | BEFORE UPDATE | `set_updated_at()` |
| `trg_responsaveis_updated_at` | `responsaveis` | BEFORE UPDATE | `set_updated_at()` |
| `trg_atletas_updated_at` | `atletas` | BEFORE UPDATE | `set_updated_at()` |
| `trg_deals_updated_at` | `deals` | BEFORE UPDATE | `set_updated_at()` |
| `trg_contratos_updated_at` | `contratos_financeiros` | BEFORE UPDATE | `set_updated_at()` |
| `trg_parcelas_updated_at` | `parcelas` | BEFORE UPDATE | `set_updated_at()` |
| `trg_crm_experiencia_updated_at` | `crm_experiencia` | BEFORE UPDATE | `set_updated_at()` |
| `trg_contatos_exp_updated_at` | `contatos_experiencia` | BEFORE UPDATE | `set_updated_at()` |
| `trg_tarefas_updated_at` | `tarefas` | BEFORE UPDATE | `set_updated_at()` |
| `trg_escolas_updated_at` | `escolas` | BEFORE UPDATE | `set_updated_at()` |
| `trg_hist_escola_updated_at` | `historico_contatos_escola` | BEFORE UPDATE | `set_updated_at()` |
| `trg_estrategia_updated_at` | `estrategia_escolas` | BEFORE UPDATE | `set_updated_at()` |
| `trg_docs_updated_at` | `documentos_atleta` | BEFORE UPDATE | `set_updated_at()` |
| `trg_faq_updated_at` | `faq_artigos` | BEFORE UPDATE | `set_updated_at()` |
| `trg_indicacoes_updated_at` | `indicacoes` | BEFORE UPDATE | `set_updated_at()` |

### Triggers de Negocio

| Trigger | Tabela | Evento | Funcao | Descricao |
|---------|--------|--------|--------|-----------|
| `trg_atletas_lead_score` | `atletas` | BEFORE INSERT OR UPDATE OF (colunas relevantes) | `trg_calcular_lead_score()` | Recalcula lead_score e lead_classificacao automaticamente |
| `trg_deals_check_etapa` | `deals` | BEFORE UPDATE | `trg_deals_check_etapa()` | Detecta retrocesso, salva etapa anterior, seta timestamps de marcos |
| `trg_experiencia_temp` | `crm_experiencia` | BEFORE INSERT OR UPDATE OF ansiedade, satisfacao, status | `trg_experiencia_temperatura()` | Calcula temperatura automatica (verde/amarelo/vermelho) |

### Triggers de Auditoria

Todas aplicam `audit.log_change()` com evento `AFTER INSERT OR UPDATE OR DELETE`.

| Trigger | Tabela |
|---------|--------|
| `trg_audit_user_profiles` | `user_profiles` |
| `trg_audit_configuracoes` | `configuracoes_sistema` |
| `trg_audit_enderecos` | `enderecos` |
| `trg_audit_responsaveis` | `responsaveis` |
| `trg_audit_atletas` | `atletas` |
| `trg_audit_deals` | `deals` |
| `trg_audit_contratos` | `contratos_financeiros` |
| `trg_audit_parcelas` | `parcelas` |
| `trg_audit_crm_experiencia` | `crm_experiencia` |
| `trg_audit_contatos_exp` | `contatos_experiencia` |
| `trg_audit_tarefas` | `tarefas` |
| `trg_audit_escolas` | `escolas` |
| `trg_audit_hist_escola` | `historico_contatos_escola` |
| `trg_audit_estrategia` | `estrategia_escolas` |
| `trg_audit_docs` | `documentos_atleta` |
| `trg_audit_faq` | `faq_artigos` |
| `trg_audit_indicacoes` | `indicacoes` |

### Triggers de Protecao

| Trigger | Tabela | Evento | Funcao | Descricao |
|---------|--------|--------|--------|-----------|
| `trg_audit_logs_prevent_update` | `audit_logs` | BEFORE UPDATE | `audit.prevent_audit_mutation()` | Bloqueia UPDATE (imutavel) |
| `trg_audit_logs_prevent_delete` | `audit_logs` | BEFORE DELETE | `audit.prevent_audit_mutation()` | Bloqueia DELETE (imutavel) |

---

## Policies RLS

Legenda: **S** = SELECT, **I** = INSERT, **U** = UPDATE, **D** = DELETE, **A** = ALL (SELECT+INSERT+UPDATE+DELETE)

### Resumo por Tabela e Role

| Tabela | anon | authenticated (todos) | CEO | head_sucesso | comercial | service_role |
|--------|------|----------------------|-----|--------------|-----------|--------------|
| `form_submissions` | I | S | S | S | S | A |
| `user_profiles` | — | S (proprio) / S (CEO: todos) | A | S+U (proprio) | S+U (proprio) | A |
| `audit_logs` | — | — | S | — | — | A |
| `configuracoes_sistema` | — | S | A | S | S | A |
| `enderecos` | — | A (`deleted_at IS NULL`) | A | A | A | A |
| `responsaveis` | — | S | S+I+U+D | S+I+U | S | A |
| `atletas` | — | S | A | S+U | S | A |
| `deals` | — | S | A | S | S | A |
| `contratos_financeiros` | — | S | A | S | S | A |
| `parcelas` | — | S | A | S | S | A |
| `crm_experiencia` | — | S | A | S+U | S | A |
| `contatos_experiencia` | — | S+I | S+I+U | S+I | S+I | A |
| `tarefas` | — | S (proprio) / I | A | S+I+U (proprio) | S+I+U (proprio) | A |
| `notificacoes` | — | S (proprio) / I / U (proprio) | S (todos) / I / U | S+I+U (proprio) | S+I+U (proprio) | A |
| `escolas` | — | S | A | S | S | A |
| `historico_contatos_escola` | — | S | A | S | S | A |
| `estrategia_escolas` | — | S | A | S | S | A |
| `documentos_atleta` | — | S+I+U | A | S+I+U | S+I+U | A |
| `faq_artigos` | — | S+I+U | A | S+I+U | S+I+U | A |
| `indicacoes` | — | S | A | S | S | A |

### Policies de Schemas uat/dev (form_submissions)

| Schema | Role | Operacao | Policy |
|--------|------|----------|--------|
| `uat` | `anon` | INSERT | `anon_can_insert_uat` |
| `uat` | `anon` | SELECT | `anon_can_select_uat` |
| `uat` | `anon` | UPDATE | `anon_can_update_uat` |
| `uat` | `service_role` | ALL | `service_role_full_access_uat` |
| `dev` | `anon` | INSERT | `anon_can_insert_dev` |
| `dev` | `anon` | SELECT | `anon_can_select_dev` |
| `dev` | `anon` | UPDATE | `anon_can_update_dev` |
| `dev` | `service_role` | ALL | `service_role_full_access_dev` |

> **Nota de seguranca:** SELECT para anon em `uat` e `dev` existe apenas para permitir upsert via PostgREST (`ON CONFLICT` requer visibilidade). Em `public` (PRD), anon **nao** tem SELECT.

---

## Seed Data

### configuracoes_sistema

Valores inseridos via seed na migration `20260401000300`:

| Chave | Tipo | Descricao |
|-------|------|-----------|
| `lead_score_pesos` | JSONB | Pesos: investimento=25, timing=20, ingles=15, academico=15, competitivo=10, comprometimento=10, video=5. Soma=100. |
| `lead_score_faixas` | JSONB | Faixas: hot>=70, warm>=40, abaixo=cold. |
| `match_pesos` | JSONB | Pesos: financeiro=30, academico=25, esportivo=25, serie=10, historico_bausa=10. Soma=100. |
| `match_faixas` | JSONB | Faixas: excelente>=85, forte>=70, possivel>=50, abaixo=fraco. |
| `timers_automacao` | JSONB | Convite=22h, followup=24h, alerta_sem_acao=48h, reuniao_sem_proposta=12h, alinhamento_sem_avanco=3d, proposta_sem_followup=48h, negociacao_parada=4d, contrato_sem_assinatura=48h, contrato_sem_sinal=48h, horario_seguro=21-8h, fallback_canal=1h. |
| `regua_cobranca` | JSONB (array) | 6 etapas: dia -3 (whatsapp, lembrete), dia 0 (whatsapp+email, dados pagamento), dia 1 (whatsapp, alerta atraso), dia 3 (email, 2a notificacao), dia 7 (whatsapp+email, alerta War Room), dia 15 (email, critico CEO notificado). |
| `planos` | JSONB | Journey: R$26000 (pix R$23000, psicologa inclusa). Legacy: R$32000 (pix R$28500, psicologa inclusa). Start: R$18000 (pix R$16000, sem psicologa). |
| `entrada_padrao` | JSONB | R$ 4.500 |
| `psicologa_custo_padrao` | JSONB | R$ 1.200 por cliente |
| `meta_anual` | JSONB | R$ 1.500.000 |
| `meta_mensal_padrao` | JSONB | R$ 125.000 |
| `ticket_medio_alvo` | JSONB | R$ 23.000 |
| `contratos_mes_alvo` | JSONB | 6 contratos/mes |
| `pipeline_health_ratio` | JSONB | min=3, max=5 (ratio pipeline/meta) |
| `thresholds_experiencia` | JSONB | ansiedade_vermelho=4, satisfacao_vermelho=2 |
| `inatividade_por_fase` | JSONB | admissao=7d, pre_embarque=15d, embarcado_inicial=7d, acompanhamento=30d |
| `digest_horario` | JSONB | "09:00" |
| `probabilidade_por_etapa` | JSONB | lead=10%, reuniao_marcada=20%, reuniao_realizada=35%, diagnostico_fit=45%, alinhamento_estrategico=50%, proposta_enviada=55%, followup_proposta=60%, negociacao=65%, contrato_enviado=75%, contrato_assinado=85%, sinal_pago=95%, admission_process=98%, concluido=100%, perdido=0%, cancelamento_solicitado=10%, projeto_futuro=5%. |

### faq_artigos

10 artigos informativos inseridos via seed na migration `20260401001900`:

| Titulo | Categoria | Fases |
|--------|-----------|-------|
| Como funciona o visto F-1 para estudantes? | visto | admissao, pre_embarque |
| Quais documentos sao necessarios para o consulado? | visto | admissao, pre_embarque |
| Checklist de documentos para aplicacao na escola | documentacao | admissao |
| O que levar na mala? Lista completa | embarque | pre_embarque |
| Como funciona o seguro saude nos EUA? | embarque | pre_embarque |
| Primeiras semanas: o que esperar? | adaptacao | embarcado_inicial |
| Saudade de casa: como os pais podem ajudar? | adaptacao | embarcado_inicial, acompanhamento |
| Como funcionam os custos adicionais na escola? | financeiro | admissao, pre_embarque |
| Como funciona o sistema de notas americano (GPA)? | escola | admissao, embarcado_inicial |
| Vacinas obrigatorias para boarding schools | saude | pre_embarque |

---

## LGPD — Campos Sensiveis

| Tabela | Campos Sensiveis | Nivel |
|--------|-----------------|-------|
| `form_submissions` | email, athlete_name, birth_date, guardian_name, guardian_email, guardian_whatsapp, guardian_profession, family_address, ip_address | Dados pessoais |
| `atletas` | nome_completo, data_nascimento, whatsapp, email, instagram | Dados pessoais |
| `responsaveis` | nome, email, whatsapp, telefone_alternativo, profissao | Dados pessoais |
| `enderecos` | cep, logradouro, numero, complemento, bairro, cidade, estado | Dados pessoais |
| `crm_experiencia` | ansiedade, satisfacao, risco_percebido, tipo_crise, nivel_crise | Dados de saude de menor (sensivel) |
| `contratos_financeiros` | valor_total, entrada_valor, saldo_remanescente, lucro_estimado | Dados financeiros |
| `parcelas` | valor, comprovante_url | Dados financeiros |
| `documentos_atleta` | arquivo_url, arquivo_nome (passaporte, historico escolar) | Documentos pessoais |

> Dados de saude emocional de menores (`crm_experiencia`) requerem consentimento do responsavel legal. O campo `consentimento_lgpd` esta presente em `responsaveis` e `atletas`.
