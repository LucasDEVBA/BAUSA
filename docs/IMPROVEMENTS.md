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

- Instalar via GTM (HTML personalizado) — infraestrutura GTM já pronta (ver item 7)
- Eventos: PageView + Lead (form_submit)

---

## 7. ~~Google Tag Manager + GA4 + Meta Pixel~~ ✅ IMPLEMENTADO (2026-04-21)

Stack de tracking implementada via GTM container `GTM-5J87JXSR`:

**Tags publicadas (versão 2 — 2026-04-21):**
- **Tag do Google** (GA4 `G-3GP7EFN0P9`) — pageviews, dispara em `Initialization - All Pages`
- **Meta Pixel - Base** (`1521863919289394`) — fbevents.js + PageView, dispara em `All Pages`
- **GA4 - Lead Conversion** — evento `generate_lead`, dispara em `Trigger - Form Submit`
- **Meta Pixel - Lead** — `fbq('track','Lead')`, dispara em `Trigger - Form Submit`
- **GA4 - CTA Click** — evento `cta_click` com parâmetro `cta_source`, dispara em `Trigger - CTA Click`

**Acionadores (eventos personalizados do dataLayer):**
- `Trigger - Form Submit` (event: `form_submit`)
- `Trigger - CTA Click` (event: `cta_click`)

**Variáveis:**
- `cta_source` — variável da camada de dados (lê `cta_source` do dataLayer)

**Integração no código** ([apps/web/src/lib/tracking/events.ts](../apps/web/src/lib/tracking/events.ts)):
```ts
trackFormSubmit(submissionId)        // → dataLayer.push({event: 'form_submit', ...})
trackCtaClick('hero'|'final'|...)    // → dataLayer.push({event: 'cta_click', cta_source})
```

**Env var Vercel:** `NEXT_PUBLIC_GTM_ID=GTM-5J87JXSR` em Production, Preview e Development.

**Pendências de validação (pós-deploy):**
- Marcar `generate_lead` como conversão (Key Event) no GA4 Admin
- Verificar Lead chegando em Meta Events Manager → Test Events
- Configurar Domain Verification do Meta Pixel para `bolsaatletausa.com` (importante para iOS 14+)
- Considerar Conversions API (CAPI) para melhorar match rate iOS

---

## 8. ~~Confirmação de Reunião via WhatsApp~~ ✅ IMPLEMENTADO (2026-04-10)

Implementado via Google Calendar Push Notifications:
- `calendar-webhook`: recebe push do Google Calendar, busca lead por email/telefone, envia WhatsApp confirmação (lead + CEO) com link Meet + preview
- `renew-calendar-watch`: renova watch channel a cada 6 dias (Cloud Scheduler)
- Match por últimos 10 dígitos do telefone (funciona com qualquer DDI)
- Fallback: `process-followup-whatsapp` continua rodando a cada hora
- Página `/agendar` redireciona para Google Calendar Appointment Schedule (com campo de telefone obrigatório)

---

## 9. Página Custom /agendar (V2)

**Prioridade:** Baixa (webhook já resolve)
**Estimativa:** 1 sessão
**Status:** Código preservado no git history

Página custom com seletor de horários + pré-preenchimento via Base64 token na URL. Implementada mas revertida por problemas de autenticação da Service Account no Vercel. Pode ser reativada quando:
- Service Account configurada corretamente no Vercel
- Ou migrada para Cloud Function em vez de API route

---
