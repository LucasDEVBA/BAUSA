# Integrações Externas

> ⚠️ **Aviso de drift:** As seções abaixo de Calendly, ClickSign/DocuSign, Typeform/JotForm e SendGrid refletem o **plano original do CRM (pré-migração monorepo)** e foram **substituídas** na implementação atual. O sistema produtivo usa: formulário Next.js custom, Resend/Brevo, Google Calendar Appointment Schedule, e (futuramente) Stripe/GetNet. Este arquivo precisa de revisão estrutural — ver `apps/web/src/` e `functions/` para fonte da verdade.

## Mapa de Integrações (estado atual — 2026-04-21)

| Serviço | Direção | Status | O que faz |
|---|---|---|---|
| **Google Tag Manager** (`GTM-5J87JXSR`) | OUT (browser) | ✅ Produção | Container que orquestra GA4 + Meta Pixel |
| **Google Analytics 4** (`G-3GP7EFN0P9`) | OUT (browser) | ✅ Produção | Pageviews, eventos, conversão `generate_lead` |
| **Meta Pixel** (`1521863919289394`) | OUT (browser) | ✅ Produção | Base + evento `Lead` no submit do formulário |
| **Vercel Analytics** | OUT (browser) | ✅ Produção | Web vitals, audience |
| **Supabase** (PostgreSQL + RLS + webhooks) | IN/OUT | ✅ Produção | DB principal + webhooks INSERT |
| **Resend** | OUT (API) | ✅ Produção | E-mails transacionais (primário) |
| **Brevo** | OUT (API) | ✅ Produção | E-mails transacionais (fallback) |
| **Z-API (WhatsApp)** | OUT (API) | ✅ Produção | Convites, follow-ups, confirmações |
| **Google Calendar API** | IN/OUT | ✅ Produção | `/agendar` redirect + push notifications de reunião |
| **Google Sheets** | OUT (API) | ✅ Produção | Sync de leads (cols A–BG) |
| **Gemini 2.5 Flash** | OUT (API) | ✅ Produção | Qualificação IA (QUENTE/MORNO/FRIO) |
| **GetNet** | Manual | MVP | CEO confirma recebimento. Automação futura. |
| **Meta Ads API / Instagram** | IN (API) | 🔮 Roadmap | CAC automático — ver `IMPROVEMENTS.md#1` |
| **Google Drive** | IN/OUT (API) | 🔮 Roadmap | Armazenamento de documentos do atleta |

---

## Tracking & Analytics (Browser)

### Google Tag Manager — `GTM-5J87JXSR`

Container `bolsaatletausa.com` (versão 2 — publicada em 2026-04-21).

**Tags:**

| Tag | Tipo | Acionador | Função |
|---|---|---|---|
| Tag do Google G-3GP7EFN0P9 | Tag do Google | Initialization - All Pages | Carrega GA4 |
| Meta Pixel - Base | HTML personalizado | All Pages | Carrega `fbevents.js` + `PageView` |
| GA4 - Lead Conversion | GA4 Event | Trigger - Form Submit | Dispara `generate_lead` |
| Meta Pixel - Lead | HTML personalizado | Trigger - Form Submit | `fbq('track','Lead')` |
| GA4 - CTA Click | GA4 Event | Trigger - CTA Click | Dispara `cta_click` com `cta_source` |

**Acionadores (eventos personalizados do dataLayer):**
- `Trigger - Form Submit` — escuta `form_submit`
- `Trigger - CTA Click` — escuta `cta_click`

**Variáveis:**
- `cta_source` — variável de camada de dados, lê `cta_source` do evento

**Carregamento no app web:**
- Componente `<GoogleTagManager />` em [`apps/web/app/[locale]/layout.tsx`](../apps/web/app/[locale]/layout.tsx)
- Env var: `NEXT_PUBLIC_GTM_ID` (Production, Preview, Development na Vercel)

**Push de eventos no código:**
```ts
// apps/web/src/lib/tracking/events.ts
trackFormSubmit(submissionId)              // → form_submit
trackCtaClick('hero'|'final'|'header'|...) // → cta_click + cta_source
trackFormStart(sessionId)                  // → form_start
trackFormStep(step, stepName)              // → form_step_completed
trackFormError(step, errorMessage)         // → form_error
```

### GA4 — `G-3GP7EFN0P9`

Propriedade GA4 do `bolsaatletausa.com`.

**Conversões / Key Events:**
- `generate_lead` — dispara no submit do formulário (deve ser marcado como Key Event no GA4 Admin)

**Eventos custom monitorados:**
- `cta_click` (com parâmetro `cta_source`)
- `form_start`, `form_step_completed`, `form_error`

### Meta Pixel — `1521863919289394`

Eventos:
- `PageView` — automático em todas as páginas via tag base
- `Lead` — dispara no submit do formulário

**Pendências:**
- Domain Verification de `bolsaatletausa.com` no Meta Business Manager (necessário para iOS 14+ ATT)
- Conversions API (CAPI) — aumentar match rate iOS — ver `IMPROVEMENTS.md`

---

## Mapa LEGADO (CRM pré-migração — pode ter sido substituído)

> A tabela abaixo é o desenho original do CRM e cita ferramentas que **não estão necessariamente em uso**. Mantida como referência histórica.

| Serviço | Direção | Fase | O que faz |
|---|---|---|---|
| Formulário web (Typeform/JotForm) | IN (webhook) | MVP | Recebe dados do formulário → cria lead |
| WhatsApp Business API | OUT (API) | MVP | Convites, follow-ups, cobrança para famílias |
| Email transacional (Resend/SendGrid) | OUT (API) | MVP | Digest, alertas, régua de cobrança |
| Calendly | IN (webhook) | MVP | Confirma agendamento → move deal |
| ClickSign / DocuSign | IN (webhook) | MVP | Confirma assinatura → move deal |
| GetNet | Manual (MVP) | MVP | CEO confirma recebimento. Automação em fase futura. |
| Meta Ads API / Instagram | IN (API) | Fase 2 | Captura automática de leads de campanhas |
| Google Drive | IN/OUT (API) | Fase 2 | Armazenamento de documentos do atleta |

---

## Detalhamento por Integração

### Formulário Web → CRM (Webhook IN)

| Aspecto | Detalhe |
|---|---|
| **Trigger** | Formulário submetido (Typeform/JotForm) |
| **Payload** | Todos os campos do lead (atleta, educação, esporte, projeto, responsável, endereço, LGPD) |
| **Ação no sistema** | 1. Detecta duplicados (WhatsApp/email) → 2. Cria lead → 3. Calcula lead score → 4. Agenda convite 22h |
| **Fallback** | Se webhook falhar: fila de retry (3 tentativas, backoff exponencial). Alerta ao CEO se falhar 3x. |

### WhatsApp Business API (OUT)

| Aspecto | Detalhe |
|---|---|
| **Provider** | WhatsApp Business API (Cloud API) |
| **Uso** | Convites para reunião, follow-ups, régua de cobrança, alertas para famílias |
| **Fallback** | Se não entregue em 1h → email automático. Se email bounce → tarefa telefone manual. |
| **Log** | Todas as tentativas com status: enviado / entregue / lido / falhou / fallback |

> ⚠️ **Templates precisam de aprovação da Meta (1–4 semanas).** Iniciar processo IMEDIATAMENTE, antes da implementação.

### Email Transacional (Resend/SendGrid) (OUT)

| Aspecto | Detalhe |
|---|---|
| **Uso interno** | Digest diário 9h, alertas críticos imediatos |
| **Uso externo** | Fallback do WhatsApp, propostas, régua de cobrança |
| **Fallback** | Se bounce → tarefa manual |

### Calendly (Webhook IN)

| Aspecto | Detalhe |
|---|---|
| **Trigger** | Lead confirma agendamento no Calendly |
| **Payload esperado** | `event_type`, `invitee_email`, `scheduled_at`, UTM params |
| **Ação no sistema** | Move deal para "Reunião Marcada". Preenche data/hora. Notifica CEO. |
| **Matching** | Link Calendly customizado com UTM params para vincular ao lead |
| **Fallback** | Se webhook falhar: CEO move manualmente |

### ClickSign / DocuSign (Webhook IN)

| Aspecto | Detalhe |
|---|---|
| **Trigger** | Contrato assinado digitalmente |
| **Payload esperado** | `document_id`, `signer_email`, `signed_at`, `status` |
| **Ação no sistema** | Move deal para "Contrato Assinado". Registra data. Notifica CEO. |
| **Pré-requisito** | Contrato financeiro deve estar preenchido no deal |
| **Fallback** | Se webhook falhar: CEO confirma manualmente |

### GetNet (Conciliação Manual — MVP)

| Aspecto | Detalhe |
|---|---|
| **Fluxo MVP** | CEO recebe confirmação de pagamento → marca parcela como "Recebida" no sistema |
| **Fase futura** | Integração automática via API GetNet para conciliação |
| **Dados registrados** | Valor, data, comprovante (upload) |

### Meta Ads API (Fase 2)

| Aspecto | Detalhe |
|---|---|
| **Trigger** | Lead preenche formulário na campanha Meta/Instagram |
| **Ação** | Captura automática → cria lead com origem "Meta Ads" |
| **Dados** | Nome, telefone, email (campos limitados do Meta Lead Forms) |

### Google Drive (Fase 2)

| Aspecto | Detalhe |
|---|---|
| **Uso** | Armazenamento de documentos do atleta (passaporte, histórico, etc.) |
| **Integração** | Upload do CRM → pasta organizada por atleta no Drive |

---

## Templates de WhatsApp

> ⚠️ Todos os templates abaixo precisam ser submetidos à Meta para aprovação **antes** da implementação.

| Template | Canal | Variáveis |
|---|---|---|
| `initial` (timing ideal) | WhatsApp | `{{nome_atleta}}`, `{{nome_responsavel}}`, link agendamento |
| `early_potential` (timing `muito_cedo`) | WhatsApp | `{{nome_atleta}}`, `{{nome_responsavel}}`, `{{nextYear}}` — "retomamos em nov/{ano+1}" |
| `late_timing` (timing `tarde_demais`) | WhatsApp | `{{nome_atleta}}`, `{{nome_responsavel}}` — janela NCAA/NAIA encerrada |
| `scheduled_return` (retomada novembro) | WhatsApp + Email | `{{nome_atleta}}`, `{{nome_responsavel}}` — disparado por `process-scheduled-followups` |
| Convite para reunião | WhatsApp + Email | `{{nome_atleta}}`, `{{esporte}}`, `{{link_calendly}}` |
| Follow-up pós-convite (`followup_1`/`followup_2`, **só timing ideal**) | WhatsApp | `{{nome_responsavel}}`, `{{nome_atleta}}` |
| Proposta enviada | Email | `{{nome_responsavel}}`, `{{plano}}`, `{{valor}}` |
| Contrato para assinatura | Email | `{{nome_responsavel}}`, `{{link_clicksign}}` |
| Lembrete de pagamento | WhatsApp | `{{nome_responsavel}}`, `{{parcela}}`, `{{valor}}`, `{{vencimento}}` |
| Cobrança atrasada | WhatsApp + Email | `{{nome_responsavel}}`, `{{dias_atraso}}`, `{{valor}}` |
| Boas-vindas (contrato assinado) | WhatsApp + Email | `{{nome_atleta}}`, `{{plano}}` |
| Solicitação de NPS | Email | `{{nome_responsavel}}`, `{{link_pesquisa}}` |

---

## Regras Globais de Comunicação

- **Canal primário famílias:** WhatsApp Business API
- **Fallback:** WhatsApp fail (1h sem entrega) → Email → Tarefa telefone manual
- **Horário seguro:** Convites não enviados entre 21h–08h. Se cair nesse range → agenda 09h dia seguinte.
- **Log obrigatório:** Toda tentativa de envio registrada com status (enviado/entregue/lido/falhou/fallback)
- **Digest interno:** Email às 9h com notificações agrupadas (Média/Baixa severidade)
- **Alertas críticos:** In-app + email imediato (Crítica/Alta severidade)
