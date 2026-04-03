# Elite Portal USA

Sistema de automação de leads para a Bolsa Atleta USA.

## Estrutura

```
src/          → Frontend (Vite + React + TS + Tailwind)
functions/    → Cloud Functions (Google Cloud)
supabase/     → Edge Functions + Migrations
infra/        → Scripts de infraestrutura
docs/         → Documentação técnica
```

## Stack

- **Frontend:** Vite, React, TypeScript, Tailwind CSS, shadcn-ui
- **Backend:** Google Cloud Functions Gen2 (Node.js 20)
- **Database:** Supabase (PostgreSQL)
- **Email:** Resend + Brevo (fallback)
- **WhatsApp:** Z-API
- **IA:** Gemini 2.5 Flash
- **CI/CD:** GitHub Actions
- **Deploy:** Vercel (frontend), GCP (functions)

## Desenvolvimento

```bash
npm install
npm run dev
```

## Variáveis de Ambiente

Ver [.env.example](.env.example)

## Deploy

Ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
