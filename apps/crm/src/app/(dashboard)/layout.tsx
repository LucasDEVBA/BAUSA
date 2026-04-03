import { redirect } from "next/navigation";

import { getUserProfile } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0c0e16]">
      <Sidebar papel={profile.papel} nome={profile.nome} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header nome={profile.nome} />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
