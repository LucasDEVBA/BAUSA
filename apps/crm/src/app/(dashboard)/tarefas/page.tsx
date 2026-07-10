import { requirePapel, getUserPapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { TarefasClient } from "./TarefasClient";
import { getSession } from "@/lib/auth";
import type { Tarefa, Sprint } from "@/types/crm";

export default async function TarefasPage() {
  await requirePapel(["ceo", "head_sucesso"]);

  const supabase = await createServerSupabaseClient();
  const user = await getSession();
  const papel = await getUserPapel();

  const [{ data: tarefas }, { data: sprints }, { data: usuarios }] = await Promise.all([
    supabase
      .from("tarefas")
      .select("*")
      .is("deleted_at", null)
      .neq("status", "cancelada") // canceladas não entram no quadro
      .order("prazo", { ascending: true }),
    supabase
      .from("sprints")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_profiles")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome"),
  ]);

  return (
    <TarefasClient
      tarefasIniciais={(tarefas ?? []) as Tarefa[]}
      sprintsIniciais={(sprints ?? []) as Sprint[]}
      currentUserId={user?.id ?? ""}
      isCeo={papel === "ceo"}
      usuarios={(usuarios ?? []).map((u) => ({ id: u.id as string, nome: u.nome as string }))}
    />
  );
}
