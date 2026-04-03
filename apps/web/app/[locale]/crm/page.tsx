import { redirect } from "next/navigation";
import { getUserPapel } from "@/lib/crm/auth";

interface CrmPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CrmRootPage({ params }: CrmPageProps) {
  const { locale } = await params;
  const papel = await getUserPapel();

  const prefix = locale === "pt" ? "" : `/${locale}`;

  if (papel === "head_sucesso") {
    redirect(`${prefix}/crm/experiencia`);
  }

  redirect(`${prefix}/crm/war-room`);
}
