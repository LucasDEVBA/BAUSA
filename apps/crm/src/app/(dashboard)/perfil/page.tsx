import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuth, getUserProfile } from "@/lib/auth";
import { PerfilClient } from "./client";

export const metadata: Metadata = { title: "Meu Perfil" };

export default async function PerfilPage() {
  await requireAuth();
  const profile = await getUserProfile();
  if (!profile) redirect("/login");

  return <PerfilClient profile={profile} />;
}
