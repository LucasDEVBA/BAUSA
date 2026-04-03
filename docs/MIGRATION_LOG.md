# Migration Log — CRM Bolsa Atleta USA

> Registro de todas as migrations do CRM. Status atualizado após cada deploy.

---

## Fase 1 — Fundação do CRM

| # | Migration | Arquivo | Tabelas / Objetos Criados | Depende de | Status |
|---|---|---|---|---|---|
| 1 | Enum Types | `20260401000000_crm_enum_types.sql` | 23 enum types + função `set_updated_at()` | — | Pendente deploy |
| 2 | User Profiles + RBAC | `20260401000100_crm_user_profiles.sql` | `user_profiles` + função `auth.papel()` + RLS | #1 | Pendente deploy |
| 3 | Audit Trail | `20260401000200_crm_audit_trail.sql` | Schema `audit` + `audit_logs` + função `audit.log_change()` + triggers proteção | #2 | Pendente deploy |
| 4 | Configurações | `20260401000300_crm_configuracoes.sql` | `configuracoes_sistema` + seed (18 chaves) | #2 | Pendente deploy |
| 5 | Responsáveis + Endereços | `20260401000400_crm_responsaveis.sql` | `enderecos` + `responsaveis` + índices dedup + RLS | #2 | Pendente deploy |
| 6 | Atletas + Lead Score | `20260401000500_crm_atletas.sql` | `atletas` + função `calcular_lead_score()` + trigger auto-score | #1, #4, #5 | Pendente deploy |
| 7 | Deals (Pipeline) | `20260401000600_crm_deals.sql` | `deals` + função `ordem_etapa()` + trigger retrocesso + RLS | #1, #2, #6 | Pendente deploy |
| 8 | Financeiro | `20260401000700_crm_financeiro.sql` | `contratos_financeiros` + `parcelas` + coluna calculada `saldo_remanescente` | #7 | Pendente deploy |
| 9 | Audit Triggers | `20260401000800_crm_audit_triggers.sql` | Triggers `audit.log_change()` em 8 tabelas CRM | #3, #5–#8 | Pendente deploy |
| 10 | Índices Performance | `20260401000900_crm_indexes.sql` | Extensão `pg_trgm` + índices para War Room, busca fuzzy, parcelas | #5–#8 | Pendente deploy |

---

## Objetos Criados — Resumo

### Tabelas (8)
| Tabela | Registros esperados | Soft Delete | Audit Trigger |
|---|---|---|---|
| `user_profiles` | 2–10 | Não (desativa via `ativo`) | Sim |
| `configuracoes_sistema` | ~20 chaves | Não | Sim |
| `enderecos` | ~100 | Sim | Sim |
| `responsaveis` | ~100 | Sim | Sim |
| `atletas` | ~200 | Sim | Sim |
| `deals` | ~200 | Sim | Sim |
| `contratos_financeiros` | ~100 | Sim | Sim |
| `parcelas` | ~600 | Sim | Sim |
| `audit_logs` | Crescente (append-only) | Não (imutável) | Não (recursão) |

### Functions (5)
| Função | Tipo | Propósito |
|---|---|---|
| `public.set_updated_at()` | Trigger | Atualiza `updated_at` em qualquer tabela |
| `auth.papel()` | Helper RLS | Retorna papel do user autenticado |
| `audit.log_change()` | Trigger | Registra alterações no audit_logs |
| `audit.prevent_audit_mutation()` | Trigger | Impede UPDATE/DELETE em audit_logs |
| `public.calcular_lead_score(UUID)` | Cálculo | Lead Score 0–100 com pesos configuráveis |
| `public.trg_calcular_lead_score()` | Trigger | Auto-recalcula score ao alterar atleta |
| `public.ordem_etapa(status_deal)` | Helper | Retorna ordem numérica da etapa (para detectar retrocesso) |
| `public.trg_deals_check_etapa()` | Trigger | Detecta retrocesso + seta timestamps de marcos |

### Enum Types (23)
`papel_usuario`, `status_deal`, `classificacao_lead`, `status_parcela`, `temperatura_familia`, `fase_experiencia`, `prioridade_tarefa`, `status_tarefa`, `status_documento`, `canal_comunicacao`, `status_contrato_assinatura`, `plano_tipo`, `nivel_ingles`, `nivel_competitivo`, `decisao_familiar`, `comprometimento_atleta`, `desempenho_academico`, `origem_lead`, `tipo_crise`, `nivel_crise`, `motivo_perda`, `influencia_esporte`, `agressividade_bolsa`

---

## Migrations Existentes (pré-CRM)

| Arquivo | Propósito | Tabela |
|---|---|---|
| `20260131041522_*.sql` | Schema inicial form_submissions | `form_submissions` |
| `20260308131630_*.sql` | Colunas follow-up | `form_submissions` |
| `20260309000000_*.sql` | Schemas UAT/DEV | `uat.form_submissions`, `dev.form_submissions` |
| `20260310000000_*.sql` | Fix permissões UAT/DEV | RLS policies |
| `20260311000000_*.sql` | SELECT policy UAT/DEV | RLS policies |
| `20260314000000_*.sql` | Coluna address_country | `form_submissions` (3 schemas) |

> ⚠️ As migrations do CRM NÃO alteram `form_submissions`. O formulário público continua funcionando normalmente.
