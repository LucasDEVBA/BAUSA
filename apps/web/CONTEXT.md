# CONTEXT.md — Bolsa Atleta USA

> Contexto completo do produto, modelo de negocio, historico de decisoes e visao estrategica.
> Atualizado em: 2026-04-01

---

## O que e a Bolsa Atleta USA

**Bolsa Atleta USA (BAUSA)** e uma assessoria exclusiva que estrutura projetos de vida para jovens atletas brasileiros no sistema educacional americano. O produto combina:

- **Direcionamento estrategico** para bolsas esportivas em High Schools e Universidades dos EUA
- **Metodo S.A.F.E.** (Scouting, Analysis, Fit, Execution) — metodologia propria
- **Acompanhamento completo** — desde a triagem ate o embarque e adaptacao do atleta

**URL:** https://bolsaatletausa.com
**Fundador:** Leandro Ribeiro (CEO)

---

## Modelo de Negocio

### Planos

| Plano | Valor Padrao | Valor Pix a Vista | Inclui Psicologa |
|-------|-------------|-------------------|-----------------|
| Journey | R$ 26.000 | R$ 23.000 | Sim (R$ 1.200) |
| Legacy | R$ 32.000 | R$ 28.500 | Sim (R$ 1.200) |
| Start | R$ 18.000 | R$ 16.000 | Nao |

### Fluxo de Receita

1. **Entrada** (sinal): R$ 4.500 padrao (Pix ou GetNet parcelado)
2. **Saldo**: Valor total - entrada, parcelado via Pix ou GetNet
3. **Customizacao**: CEO pode ajustar valores com justificativa obrigatoria + audit trail

### Ciclos (Safras)

- **Fall** (Outono USA): Embarques agosto-setembro
- **Spring** (Primavera USA): Embarques janeiro-fevereiro
- Cada ciclo anual atende ~6 familias (meta atual: crescer para 10-15/ano)

---

## Usuarios do Sistema

### Papeis

| Papel | Pessoa | Responsabilidades |
|-------|--------|------------------|
| **CEO** | Leandro Ribeiro | Estrategia, vendas, financeiro, escolas, configuracoes. Ve tudo. |
| **Head de Sucesso** | A definir | Acompanhamento pos-venda, contato com familias, escalonamento |
| **Comercial** | Futuro | Tarefas comerciais delegadas pelo CEO |

### Cenario Atual

- **Operacao**: CEO + Head (2 pessoas)
- **Volume**: ~6 familias/safra
- **Meta**: Escalar para 10-15 familias/safra com eficiencia operacional

---

## Ecossistema Tecnico

### Site Publico (bolsaatletausa.com)

- Landing page com 13 secoes (lazy loading)
- Formulario multi-etapas (14 steps, Zod validation, i18n PT/EN/ES)
- Suporte internacional (E.164 telefone, country select, endereco adaptativo)
- Hub de links (Instagram, YouTube)

### Cloud Functions (Backend)

6 funcoes GCP Gen2 que processam leads automaticamente:
1. **messenger-service**: Emails de confirmacao (Resend/Brevo fallback)
2. **sync-elite-leads**: Sync com Google Sheets (colunas A-AV)
3. **lead-qualifier**: Qualificacao IA via Gemini (QUENTE/MORNO/FRIO)
4. **send-whatsapp**: Templates WhatsApp via Z-API
5. **whatsapp-scheduler**: Fila de WhatsApp inicial (22h apos qualificacao)
6. **followup-scheduler**: Follow-ups 48h e 7 dias sem agendamento

### CRM Interno (BAUSA CRM)

Sistema completo de gestao implementado em 2026-04-01:
- 14 paginas (War Room, Pipeline, Leads, Financeiro, Escolas, Matching, Experiencia, Tarefas, FAQ, Indicacoes, Relatorios, Configuracoes)
- 23 componentes React com design system proprio (light theme, tokens CSS)
- 20 tabelas PostgreSQL com RLS, triggers de auditoria e funcoes SQL
- Lead Score automatico (7 criterios, 0-100 pontos)
- Motor de Match atleta-escola (filtros eliminatorios + scoring ponderado)
- Audit trail imutavel (append-only, 5 anos retencao)

---

## Fluxo Completo do Lead

```
1. Atleta/familia preenche formulario no site
2. form_submissions INSERT → Webhook Supabase
3. Cloud Functions processam em paralelo:
   a. messenger-service → Email de confirmacao
   b. sync-elite-leads → Google Sheets
   c. lead-qualifier → Gemini classifica (QUENTE/MORNO/FRIO)
4. WhatsApp scheduler (22h depois): Envia convite inicial
5. Follow-ups automaticos: 48h e 7 dias se sem reuniao
6. CEO ve leads qualificados na pagina /crm/leads
7. CEO promove lead para CRM → Cria atleta + deal no pipeline
8. Deal avanca pelo Kanban (12 etapas visiveis)
9. Contrato assinado → Sinal pago → Handoff automatico para CRM Experiencia
10. Head de Sucesso acompanha familia ate embarque e adaptacao
```

---

## Decisoes Arquiteturais (Historico)

| Data | Decisao | Motivo |
|------|---------|--------|
| 2026-01 | Supabase como BaaS | PostgreSQL + RLS + Auth + Realtime + Storage em um so servico |
| 2026-01 | GCP Cloud Functions | Projeto ja tinha GCP configurado, custo zero no free tier |
| 2026-03 | Next.js 16 | Necessidade de SSR para CRM + SEO para site publico |
| 2026-03 | Tailwind CSS 4 | Projeto migrado junto com Next.js |
| 2026-04 | CRM em public schema | Simplicidade; nao justifica schema separado com 2 usuarios |
| 2026-04 | Audit via triggers SQL | Garantia de captura mesmo com bypass de RLS (service_role) |
| 2026-04 | Light theme CRM | Profissionalismo + contraste superior + identidade Apple-clean |
| 2026-04 | Lead Score em SQL | Calculo server-side garante consistencia; pesos configuraveis |
| 2026-04 | Match Engine em SQL | Performance + atomicidade; filtros eliminatorios + scoring |

---

## Metricas de Sucesso

| Metrica | Alvo |
|---------|------|
| Meta anual | R$ 1.500.000 |
| Meta mensal | R$ 125.000 |
| Ticket medio | R$ 23.000 |
| Contratos/mes | ~5 |
| Taxa conversao pipeline | > 30% |
| Familias satisfeitas (verde) | > 80% |
| Tempo medio ciclo venda | 30-60 dias |

---

## Documentacao Relacionada

| Documento | Conteudo |
|-----------|---------|
| `CLAUDE.md` | Instrucoes para o agente, stack, regras, referencia rapida |
| `docs/BUSINESS_RULES.md` | 10 regras inviolaveis + algoritmos de scoring + automacoes |
| `docs/SPEC.md` | Especificacao completa por modulo (campos, tipos, fluxos) |
| `docs/DATA_MODEL.md` | Schema implementado: 20 tabelas, enums, triggers, RLS, funcoes |
| `docs/MODULES.md` | 14 modulos com rotas, componentes, actions, permissoes |
| `docs/INTEGRATIONS.md` | Integracoes externas: WhatsApp, Email, Calendly, ClickSign |
| `docs/ROADMAP.md` | 7 fases implementadas + divida tecnica + proximos passos |
| `docs/CRM_ARCHITECTURE.md` | Arquitetura tecnica: ADRs, fluxos de dados, migrations |
| `docs/ENVIRONMENTS.md` | 3 ambientes: DEV/UAT/PRD com schemas isolados |

---

## Evolução Abril 2026

### Auto-promoção de Leads (2026-04-01 a 2026-04-03)

O fluxo de leads foi automatizado completamente:
- Leads QUENTES e MORNOS agora entram automaticamente no pipeline CRM
- O botão "Promover Lead" do CEO foi eliminado
- A Cloud Function `qualify-lead` cria atleta + deal quando classifica QUENTE/MORNO
- A Cloud Function `process-followup-whatsapp` move deals para `reuniao_marcada` quando detecta reunião no Calendar

### Separação Lead Score vs Qualificação Gemini

Dois conceitos distintos coexistem:
- **Qualificação Gemini** (`qualificado_gemini`, `classificacao_gemini`, `motivo_gemini`): Avaliação fixa da IA baseada em profissão, investimento e contexto socioeconômico. Não muda.
- **Lead Score** (`lead_score` 0-100): Score dinâmico calculado por trigger SQL com 7 critérios ponderados. Melhora conforme o CEO preenche dados do atleta (inglês, série, desempenho, etc).

### elite-crm — Frontend de Gestão

Um segundo projeto (`../elite-crm`) foi integrado como frontend do CRM:
- Dark theme com Recharts (gráficos), @dnd-kit (drag-and-drop no Pipeline)
- Todas as 20 páginas migradas de mock data para Supabase real
- Auth via Supabase com RBAC (CEO/Head/Comercial)
- Pipeline Kanban com DealDetailSheet de 4 abas (Resumo, Reunião, Dados, Histórico)
- 58 leads qualificados promovidos para o pipeline (46 QUENTE + 12 MORNO, 9 com reunião)

### Campos adicionados ao banco (2026-04-02)

**atletas:** `qualificado_gemini`, `classificacao_gemini`, `motivo_gemini`, `confianca_gemini`, `qualificado_gemini_at`
**deals:** `reuniao_agendada_at`, `reuniao_link`, `reuniao_data`
