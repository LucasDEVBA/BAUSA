import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getMessages } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";

import { routing } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";
import { Providers } from "@/components/Providers";
import { GoogleTagManager } from "@/lib/tracking/gtm";

import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bolsaatletausa.com"),
  title: {
    default: "Bolsa Atleta USA | Educação Esportiva Inteligente®",
    template: "%s | Bolsa Atleta USA",
  },
  description:
    "Projetos de vida estruturados para jovens atletas no sistema educacional americano. High School. Universidade. Direção estratégica com o Método S.A.F.E.®",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    siteName: "Bolsa Atleta USA",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Bolsa Atleta USA — Educação Esportiva Inteligente®",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@BolsaAtletaUSA",
    creator: "@BolsaAtletaUSA",
  },
  other: {
    "theme-color": "#0a1128",
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    // As variáveis de fonte ficam no <html>, não no <body>: os tokens
    // --font-bau-* são declarados em :root e referenciam estas variáveis.
    // No <body> elas não existiriam no escopo de :root e o Caslon cairia
    // silenciosamente para sans-serif.
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        <link rel="preload" as="image" href="/hero-campus.jpg" fetchPriority="high" />
      </head>
      <body>
        <Providers locale={locale} messages={messages}>
          {children}
        </Providers>
        <GoogleTagManager />
        <Analytics />
      </body>
    </html>
  );
}
