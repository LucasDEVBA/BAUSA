# Melhorias Planejadas — BAUSA

---

## 1. CAC Automático via Meta Marketing API

**Prioridade:** Alta
**Estimativa:** 2-3 sessões
**Status:** Planejado

### O que é

Integração com a Meta Marketing API para puxar gastos de anúncios automaticamente e calcular o CAC (Custo de Aquisição de Cliente) por canal, campanha e período.

### Tipos de CAC

| Tipo | Fórmula | Responde |
|------|---------|----------|
| CAC por Lead | Investimento / Total Leads | Quanto custa gerar um lead |
| CAC por Lead Qualificado | Investimento / Leads QUENTE+MORNO | Quanto custa um lead bom |
| CAC por Cliente | Investimento / Contratos Assinados | Quanto custa fechar um cliente |

### Dados que já temos

- Total de leads por mês (`form_submissions.submitted_at`)
- Leads por fonte/UTM (`form_submissions.utm_source`)
- Leads qualificados (`form_submissions.qualification_classification`)
- Contratos fechados (`contratos_financeiros.created_at`)
- Valor dos contratos (`contratos_financeiros.valor_total`)

### O que falta

- **Investimento em marketing por canal/mês** — vem da Meta Marketing API

### Pré-requisitos (configuração manual)

1. **Ad Account ID** — Em [business.facebook.com/settings](https://business.facebook.com/settings) → Contas → Contas de anúncios → copiar ID
2. **Meta App** — Criar em [developers.facebook.com/apps](https://developers.facebook.com/apps) → tipo Empresarial → nome `BAUSA API` → copiar App ID + App Secret
3. **Access Token (longa duração)** — Via Graph API Explorer com permissões `ads_read` + `business_management` → estender para 60 dias

### Implementação técnica

1. **Tabela Supabase:** `investimentos_marketing` (mes, canal, valor_gasto, impressoes, cliques, leads_gerados, source: manual|meta_api)
2. **Cloud Function:** `sync-meta-spend` — roda diariamente via Cloud Scheduler, puxa gastos da Meta Marketing API e salva no Supabase
3. **API Route no Engine:** `/api/meta/sync` — endpoint para sync manual
4. **Dashboard CAC no Engine:** `/analytics/cac` — gráficos de CAC por canal, tendência mensal, comparativo de ROI por campanha
5. **Env vars (GCP):** `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`

### Endpoints Meta API

```
GET https://graph.facebook.com/v21.0/act_{AD_ACCOUNT_ID}/insights
  ?fields=spend,impressions,clicks,actions
  &time_range={"since":"2026-04-01","until":"2026-04-30"}
  &level=campaign
  &access_token={TOKEN}
```

### Alternativa (fallback manual)

Se a Meta API não estiver disponível, implementar input manual no Engine:
- Formulário: "Em abril gastei R$X no Instagram e R$Y no Google"
- Mesma tabela `investimentos_marketing` com `source: 'manual'`
- CAC calculado da mesma forma

---

## 2. Migrar `<img>` para `next/image`

**Prioridade:** Média
**Estimativa:** 1 sessão
**Status:** Planejado

### Componentes afetados

| Componente | Imagens | Impacto |
|-----------|---------|---------|
| HeroSection | 1 campus bg + 11 watermarks | LCP (hero é above-fold) |
| FounderSection | 1 foto + 11 watermarks | CLS |
| WhatIsEEISection | 1 logo + 11 watermarks | Compressão |
| LinksContent | 3 imagens + 11 watermarks | Lazy loading |
| UniversityCarousel | 35 logos + 9 watermarks | Compressão em massa |

### Benefícios

- Compressão automática (AVIF/WebP)
- Responsive srcset
- Lazy loading nativo
- Melhora LCP e CLS (Core Web Vitals)

---

## 3. Vercel Speed Insights

**Prioridade:** Baixa
**Estimativa:** 15 min
**Status:** Planejado

- Instalar `@vercel/speed-insights`
- Adicionar `<SpeedInsights />` no layout
- Dashboard de Web Vitals detalhado na Vercel

---

## 4. Scroll Depth Tracking

**Prioridade:** Baixa
**Estimativa:** 1 hora
**Status:** Planejado

- Eventos 25%, 50%, 75%, 100% de scroll na landing page
- Push para dataLayer → GA4 captura via GTM
- Permite entender até onde os leads rolam antes de clicar no CTA

---

## 5. Integração Google Ads (AW-)

**Prioridade:** Média (quando começar Google Ads)
**Estimativa:** 1 sessão
**Status:** Futuro

- Google Ads Conversion Tracking via GTM
- Remarketing tag para público de visitantes
- Importar conversões de leads qualificados (offline conversions)

---

## 6. TikTok Pixel

**Prioridade:** Média (quando começar TikTok Ads)
**Estimativa:** 30 min
**Status:** Futuro

- Instalar via GTM (HTML personalizado)
- Eventos: PageView + Lead (form_submit)

---

## 7. Confirmação de Reunião via WhatsApp (pós-agendamento)

**Prioridade:** Alta
**Estimativa:** 1 sessão
**Status:** Planejado (V2)

### Contexto

Página custom `/agendar` foi implementada mas a integração Google Calendar API via Vercel apresentou problemas de autenticação com Service Account. Pivotamos para usar o Google Calendar nativo com campo de telefone obrigatório.

### Solução V2

1. **Google Calendar Appointment Schedule** com pergunta obrigatória: "Número de WhatsApp"
2. **Webhook do Google Calendar** (ou polling via Cloud Function) detecta novo evento
3. Extrai o telefone da resposta do formulário de agendamento
4. Dispara WhatsApp de confirmação para o lead com link Meet + data/hora
5. Dispara WhatsApp para o CEO com dados do lead + link Meet

### Implementação

- **Opção A (webhook):** Google Calendar Push Notifications → Cloud Function → WhatsApp
- **Opção B (polling — já existe):** `process-followup-whatsapp` já roda a cada hora e detecta reuniões. Basta adicionar envio de WhatsApp de confirmação quando detecta

### Código já pronto (reutilizar)

- `send-whatsapp`: messageType `meeting_confirmed` com `customMessage` já funciona
- Templates de confirmação (lead + CEO) já escritos no API route `/api/agendar`
- Basta extrair o telefone do evento e chamar send-whatsapp

### Página /agendar

A página custom pode ser reativada futuramente quando a Service Account estiver corretamente configurada para a Vercel, ou pode redirecionar para o Google Calendar Appointment Schedule.

---
