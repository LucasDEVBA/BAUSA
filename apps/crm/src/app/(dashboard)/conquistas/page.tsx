import { getUserProfile, requireAuth } from "@/lib/auth";
import { fetchPerfilGamificacao, fetchRanking } from "@/lib/gamificacao-queries";
import { createServerSupabaseClient } from "@/lib/supabase-server";

import { ConquistasClient } from "./client";

/**
 * /conquistas — gamificação do Engine: nível, XP, streak, ranking CEO × Head,
 * galeria de selos e atividade recente. Acesso: TODOS os papéis autenticados
 * (ranking é público interno — cada um vê o próprio perfil em destaque).
 */
export default async function ConquistasPage() {
  const user = await requireAuth();
  const profile = await getUserProfile();
  const supabase = await createServerSupabaseClient();

  const [perfil, ranking] = await Promise.all([
    fetchPerfilGamificacao(supabase, user.id),
    fetchRanking(supabase),
  ]);

  return (
    <ConquistasClient
      userId={user.id}
      nome={profile?.nome ?? "Você"}
      avatarUrl={profile?.avatar_url ?? null}
      perfil={perfil}
      ranking={ranking}
    />
  );
}
