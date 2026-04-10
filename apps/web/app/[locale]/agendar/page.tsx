import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import AgendarContent from "./client";

const TITLES: Record<string, string> = {
  pt: "Agendar Reunião Estratégica",
  en: "Schedule Strategic Meeting",
  es: "Agendar Reunión Estratégica",
};

const DESCRIPTIONS: Record<string, string> = {
  pt: "Agende sua Reunião Estratégica Individual com Leandro Ribeiro — Bolsa Atleta USA.",
  en: "Schedule your Individual Strategic Meeting with Leandro Ribeiro — Bolsa Atleta USA.",
  es: "Agende su Reunión Estratégica Individual con Leandro Ribeiro — Bolsa Atleta USA.",
};

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: TITLES[locale] ?? TITLES.pt,
    description: DESCRIPTIONS[locale] ?? DESCRIPTIONS.pt,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function AgendarPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <AgendarContent />
    </Suspense>
  );
}
