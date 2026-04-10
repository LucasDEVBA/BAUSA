import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getMessages } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";

import { routing } from "@/i18n/routing";
import { inter } from "@/lib/fonts";
import { Providers } from "@/components/Providers";
import { CookieConsent } from "@/components/CookieConsent";
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
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preload" as="image" href="/hero-campus.jpg" fetchPriority="high" />
      </head>
      <body className={inter.variable}>
        <Providers locale={locale} messages={messages}>
          {children}
          <CookieConsent />
        </Providers>
        <GoogleTagManager />
        <Analytics />
      </body>
    </html>
  );
}
