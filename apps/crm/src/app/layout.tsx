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
    <html lang="pt-BR" suppressHydrationWarning className={inter.variable}>
      <body className="antialiased">
        {/* Anti-FOUC: light e o padrao; so adiciona .dark se o usuario escolheu escuro. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('bausa-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
