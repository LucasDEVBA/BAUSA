import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAgendaDoMes } from "@/lib/actions/agenda-calendar";
import { requirePapel } from "@/lib/auth";
import { AgendaClient } from "./client";
import type { AgendaEvento } from "./client";
import type { DealStage } from "@/types/deal";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requirePapel(["ceo"]);

  // "Hoje" e o mês corrente em BRT, calculados no servidor: ele roda em UTC e
  // o CEO está em BRT — entre 21h e 00h os dois discordariam do dia (e do mês,
  // na virada), causando hydration mismatch e mês errado ao abrir a tela.
  const agoraDate = new Date();
  const nowMs = agoraDate.getTime();
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agoraDate);

  const { mes } = await searchParams;
  const mesInicial = /^\d{4}-(0[1-9]|1[0-2])$/.test(mes ?? "") ? (mes as string) : hoje.slice(0, 7);

  // Só o mês pedido. Antes eram 300 dias (−120/+180) numa tacada: 681 eventos
  // trafegados para desenhar ~30.
  const { eventos: doMes, aviso } = await getAgendaDoMes(mesInicial);

  // Deals ativos p/ o "Novo compromisso" (qualquer etapa exceto perdido)
  const supabase = await createServerSupabaseClient();
  const { data: agendaveis } = await supabase
    .from("deals")
    .select("id, etapa, atleta:atletas(nome_completo)")
    .is("deleted_at", null)
    .neq("etapa", "perdido")
    .order("created_at", { ascending: false })
    .limit(500);
  const dealsAgendaveis = ((agendaveis ?? []) as unknown as Array<{
    id: string;
    etapa: DealStage;
    atleta: { nome_completo: string } | { nome_completo: string }[] | null;
  }>)
    .map((d) => {
      const a = Array.isArray(d.atleta) ? d.atleta[0] : d.atleta;
      return { dealId: d.id, etapa: d.etapa, nome: a?.nome_completo ?? "" };
    })
    .filter((d) => d.nome);

  return (
    <AgendaClient
      eventos={doMes as AgendaEvento[]}
      hoje={hoje}
      nowMs={nowMs}
      mesInicial={mesInicial}
      dealsAgendaveis={dealsAgendaveis}
      avisoCalendar={aviso}
    />
  );
}
