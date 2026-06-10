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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar papel={profile.papel} nome={profile.nome} avatarUrl={profile.avatar_url} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header nome={profile.nome} avatarUrl={profile.avatar_url} />
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
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
              "border border-border bg-popover text-foreground shadow-lg",
            description: "text-muted-foreground",
            actionButton: "bg-primary text-primary-foreground hover:bg-primary/90",
            cancelButton: "bg-secondary text-secondary-foreground hover:bg-accent",
          },
        }}
      />
    </div>
  );
}
