import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { buildPageMetadata } from "@/config/seo";
import FormsContent from "@/components/FormsContent";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata("forms", locale);
}

export default async function FormsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FormsContent />;
}
