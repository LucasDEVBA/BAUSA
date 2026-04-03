import { redirect } from "next/navigation";

import { getUserProfile } from "@/lib/auth";

export default async function RootPage() {
  const profile = await getUserProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.papel === "head_sucesso") {
    redirect("/minha-area");
  }

  redirect("/war-room");
}
