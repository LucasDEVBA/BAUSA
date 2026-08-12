import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getEventosCalendar } from "@/lib/actions/agenda-calendar";
import { requirePapel } from "@/lib/auth";
import { AgendaClient } from "./client";
import type { AgendaEvento } from "./client";
import type { DealStage } from "@/types/deal";

interface AtletaEmbed {
  id: string;
  nome_completo: string;
  esporte: string | null;
  form_submission_id: string | null;
  lead_classificacao: string | null;
}

// Supabase sem types gerados (backlog) → o embed cai no ramo de erro do type.
interface DealRow {
  id: string;
  reuniao_data: string;
  reuniao_link: string | null;
  google_calendar_event_id: string | null;
  etapa: DealStage;
  valor_estimado: number | null;
  atleta: AtletaEmbed | AtletaEmbed[] | null;
}

export default async function AgendaPage() {
  await requirePapel(["ceo"]);
  const supabase = await createServerSupabaseClient();

  // Janela ampla: histórico recente + todos os futuros (o calendário navega).
  const desde = new Date();
  desde.setDate(desde.getDate() - 120);

  const { data: deals } = await supabase
    .from("deals")
    .select(
      "id, reuniao_data, reuniao_link, etapa, valor_estimado, google_calendar_event_id, " +
        "atleta:atletas(id, nome_completo, esporte, form_submission_id, lead_classificacao)",
    )
    .not("reuniao_data", "is", null)
    .is("deleted_at", null)
    .gte("reuniao_data", desde.toISOString())
    .order("reuniao_data", { ascending: true });

  const rows = (deals ?? []) as unknown as DealRow[];

  // Deals ativos p/ o "Novo compromisso" (qualquer etapa exceto perdido)
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

  // Indicador de transcrição capturada por deal.
  const dealIds = rows.map((d) => d.id);
  const comTranscricao = new Set<string>();
  if (dealIds.length > 0) {
    const { data: trans } = await supabase
      .from("reunioes_transcricoes")
      .select("deal_id")
      .in("deal_id", dealIds);
    for (const t of (trans ?? []) as unknown as Array<{ deal_id: string | null }>) {
      if (t.deal_id) comTranscricao.add(t.deal_id);
    }
  }

  const doBanco: AgendaEvento[] = rows.map((d) => {
    const atleta = Array.isArray(d.atleta) ? d.atleta[0] : d.atleta;
    return {
      dealId: d.id,
      reuniaoData: d.reuniao_data,
      reuniaoLink: d.reuniao_link ?? null,
      etapa: d.etapa,
      valorEstimado: d.valor_estimado ?? null,
      atletaId: atleta?.id ?? null,
      nome: atleta?.nome_completo ?? "—",
      esporte: atleta?.esporte ?? null,
      classificacao: atleta?.lead_classificacao ?? null,
      temTranscricao: comTranscricao.has(d.id),
      eventId: d.google_calendar_event_id ?? null,
    };
  });

  // ─── Calendar é a fonte da verdade da agenda ───────────────────
  // O banco só conhece reunião que virou deal. Quem agendou sem passar
  // pelo formulário — ou cuja notificação do Google se perdeu — não
  // existia nesta tela, e ela era lida como "minha agenda do dia".
  const ate = new Date();
  ate.setDate(ate.getDate() + 180);
  const calendario = await getEventosCalendar(desde.toISOString(), ate.toISOString());

  let eventos = doBanco;
  let avisoCalendar: string | null = null;

  if (calendario.success) {
    const jaNoBanco = new Set(doBanco.map((e) => e.eventId).filter(Boolean));
    const doCalendar: AgendaEvento[] = calendario.data
      .filter((ev) => ev.inicio && !jaNoBanco.has(ev.eventId))
      .map((ev) => ({
        dealId: ev.dealId ?? null,
        reuniaoData: ev.inicio as string,
        reuniaoLink: ev.meetLink ?? ev.htmlLink ?? null,
        etapa: (ev.etapa as DealStage) ?? null,
        valorEstimado: null,
        atletaId: null,
        nome: ev.athleteName ?? ev.guardianName ?? ev.titulo,
        esporte: null,
        classificacao: null,
        temTranscricao: false,
        eventId: ev.eventId,
        semLead: !ev.leadId,
        tituloEvento: ev.titulo,
        emails: ev.emails,
        telefone: ev.telefone,
        leadId: ev.leadId,
      }));
    eventos = [...doBanco, ...doCalendar].sort(
      (a, b) => new Date(a.reuniaoData).getTime() - new Date(b.reuniaoData).getTime(),
    );
  } else {
    // Degrada para o comportamento antigo (só banco) em vez de tela vazia.
    avisoCalendar = calendario.error;
  }

  // "Hoje" (BRT) + instante do servidor passados como props: server e client
  // renderizam idêntico (evita hydration mismatch por o servidor rodar em UTC
  // e o CEO em BRT — divergiria de 21h–00h BRT).
  const agoraDate = new Date();
  const nowMs = agoraDate.getTime();
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agoraDate);

  return (
    <AgendaClient
      eventos={eventos}
      hoje={hoje}
      nowMs={nowMs}
      dealsAgendaveis={dealsAgendaveis}
      avisoCalendar={avisoCalendar}
    />
  );
}
