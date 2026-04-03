import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/crm/auth";
import { CrmShell } from "@/components/crm/layout/CrmShell";
import "../../crm.css";

interface CrmLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function CrmLayout({ children, params }: CrmLayoutProps) {
  const { locale } = await params;
  const profile = await getUserProfile();

  if (!profile) {
    const loginPath = locale === "pt" ? "/login" : `/${locale}/login`;
    redirect(loginPath);
  }

  return (
    <CrmShell papel={profile.papel} nome={profile.nome}>
      {children}
    </CrmShell>
  );
}
