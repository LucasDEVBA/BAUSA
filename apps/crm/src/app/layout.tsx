import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Stack de sistema (SF Pro nativo em Apple) com Inter como fallback web.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | BAU Global",
    default: "BAU Global — Bolsa Atleta USA",
  },
  description: "Sistema de gestão de leads para o programa Bolsa Atleta USA.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} dark`}>
      <body className="antialiased">
        {/* Anti-FOUC: aplica tema salvo antes da pintura. Dark e o padrao;
            so remove a classe se o usuario escolheu o tema claro. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('bausa-theme')==='light'){document.documentElement.classList.remove('dark')}}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
