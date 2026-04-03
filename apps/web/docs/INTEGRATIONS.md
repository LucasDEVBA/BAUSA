# Integrações Externas

## Mapa de Integrações

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
| Convite para reunião | WhatsApp + Email | `{{nome_atleta}}`, `{{esporte}}`, `{{link_calendly}}` |
| Follow-up pós-convite | Email | `{{nome_responsavel}}`, `{{nome_atleta}}` |
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
