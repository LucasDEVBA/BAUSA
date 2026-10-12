import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getMessages } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";

import { routing } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";
import { Providers } from "@/components/Providers";
import { GoogleTagManager } from "@/lib/tracking/gtm";
import AttributionCapture from "@/components/site/AttributionCapture";

import "../globals.css";
import "@/styles/brand.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bolsaatletausa.com"),
  title: {
    default: "Bolsa Atleta USA | Educação Esportiva Inteligente®",
    // Títulos do PAGE_SEO vêm SEM a marca; o template acrescenta uma vez só
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
    "theme-color": "#f5f7fb",
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
    <html lang={locale} suppressHydrationWarning>
      <body className={fontVariables}>
        <Providers locale={locale} messages={messages}>
          <AttributionCapture />
          {children}
        </Providers>
        <GoogleTagManager />
        <Analytics />
      </body>
    </html>
  );
}
