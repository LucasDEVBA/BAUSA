import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { TarefasClient } from "./TarefasClient";
import { getSession } from "@/lib/auth";

export default async function TarefasPage() {
  await requirePapel(["ceo", "head_sucesso"]);

  const supabase = await createServerSupabaseClient();
  const user = await getSession();

  const { data: tarefas } = await supabase
    .from("tarefas")
    .select("*")
    .is("deleted_at", null)
    .order("prazo", { ascending: true });

  const { data: usuarios } = await supabase
    .from("user_profiles")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  return (
    <TarefasClient
      tarefasIniciais={tarefas ?? []}
      currentUserId={user?.id ?? ""}
      usuarios={(usuarios ?? []).map((u) => ({ id: u.id as string, nome: u.nome as string }))}
    />
  );
}
