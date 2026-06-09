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
    template: "%s | BAUSA Engine",
    default: "BAUSA Engine — Bolsa Atleta USA",
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
    <html lang="pt-BR" className={`${inter.variable} dark`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
