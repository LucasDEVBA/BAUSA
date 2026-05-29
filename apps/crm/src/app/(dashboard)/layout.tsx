import { redirect } from "next/navigation";
import { Toaster } from "sonner";

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
      {/* Toaster global — sonner. richColors ativa verde/vermelho semântico. */}
      <Toaster
        theme="dark"
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast:
              "border border-[#1e2130] bg-[#141720] text-zinc-100 shadow-2xl",
            description: "text-zinc-400",
            actionButton: "bg-indigo-600 text-white hover:bg-indigo-500",
            cancelButton: "bg-zinc-700 text-white hover:bg-zinc-600",
          },
        }}
      />
    </div>
  );
}
