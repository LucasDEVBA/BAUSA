import { NextIntlClientProvider } from "next-intl";

import { fontVariables } from "@/lib/fonts";

import "../globals.css";

/**
 * Root layout próprio de /debug.
 *
 * As rotas de debug vivem FORA de `app/[locale]`, então não herdam o
 * `<html>`/`<body>` de `app/[locale]/layout.tsx` — o App Router exige um root
 * layout por árvore que não compartilha ancestral.
 *
 * O `NextIntlClientProvider` existe porque as primitivas de `components/bau/`
 * usam o `Link` de `@/i18n/navigation`, que lê o locale do contexto. Sem ele a
 * galeria quebraria em runtime. Locale fixo em pt: é ferramenta interna.
 */
export const metadata = {
  robots: { index: false, follow: false },
};

export default function DebugLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={fontVariables} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider locale="pt" messages={{}}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
