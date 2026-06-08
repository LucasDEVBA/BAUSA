import { createServerSupabaseClient } from "@/lib/supabase-server";

// ════════════════════════════════════════════════════════════════════════
// Re-marketing (Fase 1) — audiências inteligentes de leads QUENTE/MORNO
// não convertidos, para campanhas segmentadas. SEM disparo automático:
// export CSV (Meta Custom Audience) + copiar mensagem p/ envio manual.
//
// Estimativas de conversão são HEURÍSTICAS (por posição no funil), com
// aviso na UI. Conversão real por segmento virá com win rate (task #8).
// Receita potencial = conversão estimada × ticket médio real.
//
// O NOME vai ao client para exibição/identificação na lista (ferramenta
// CEO-only, mesmo dado já visível em /leads e /pipeline). Contato sensível
// (email/telefone) NUNCA vai ao client — só é reconstruído server-side
// (fetchSegmentoLeadsFull) no momento do export/disparo.
// ════════════════════════════════════════════════════════════════════════

const ETAPAS_GANHAS = ["contrato_assinado", "sinal_pago", "admission_process", "concluido"];
const DIAS_INATIVO = 90;
const SCORE_ALTO = 75;
const TICKET_MEDIO_FALLBACK = 23000; // BRL — média histórica BAUSA se sem contratos

export interface RemarketingSegmentDef {
  key: string;
  label: string;
  descricao: string;
  /** Taxa de conversão estimada (heurística por etapa do funil). */
  taxaEstimada: number;
}

export const REMARKETING_SEGMENTS: RemarketingSegmentDef[] = [
  { key: "nao_agendaram", label: "Não agendaram reunião", descricao: "Qualificados que ainda não marcaram a reunião estratégica.", taxaEstimada: 0.15 },
  { key: "reuniao_sem_fechar", label: "Reunião sem fechamento", descricao: "Tiveram reunião/diagnóstico mas não avançaram para proposta.", taxaEstimada: 0.25 },
  { key: "proposta_sem_resposta", label: "Proposta sem resposta", descricao: "Receberam proposta/negociaram mas não fecharam.", taxaEstimada: 0.30 },
  { key: "perdidos_recuperaveis", label: "Perdidos recuperáveis", descricao: "Marcados como perdidos, mas sinalizados como reativáveis.", taxaEstimada: 0.10 },
  { key: "inativos_90d", label: "Inativos há 90+ dias", descricao: "Sem movimentação no funil há mais de 3 meses.", taxaEstimada: 0.12 },
  { key: "alto_score_sem_followup", label: "Alto score sem follow-up", descricao: "Lead score ≥ 75 ainda no funil — alta propensão.", taxaEstimada: 0.28 },
  { key: "aniversariantes", label: "Aniversariantes do mês", descricao: "Atletas que fazem aniversário neste mês — gancho de contato.", taxaEstimada: 0.18 },
];

export interface RemarketingLeadAnon {
  dealId: string;
  nome: string;
  idade: number | null;
  esporte: string;
  classe: string;
  etapa: string;
  score: number;
  cidade: string;
  consentimento: boolean;
}

export interface RemarketingSegment extends RemarketingSegmentDef {
  total: number;
  comConsentimento: number;
  conversaoEstimada: number;
  receitaPotencial: number;
  leads: RemarketingLeadAnon[];
}

export interface RemarketingData {
  segments: RemarketingSegment[];
  ticketMedio: number;
  esportes: string[];
}

interface AtletaRow {
  nome_completo: string | null;
  email: string | null;
  whatsapp: string | null;
  classificacao_gemini: string | null;
  consentimento_lgpd: boolean | null;
  lead_score: number | null;
  data_nascimento: string | null;
  esporte: string | null;
  cidade_estado: string | null;
}

interface DealRow {
  id: string;
  etapa: string;
  pode_reativar: boolean | null;
  updated_at: string | null;
  atleta: AtletaRow | AtletaRow[] | null;
}

function normAtleta(a: DealRow["atleta"]): AtletaRow | null {
  if (!a) return null;
  return Array.isArray(a) ? (a[0] ?? null) : a;
}

function idadeDe(dataNascimento: string | null): number | null {
  if (!dataNascimento) return null;
  const nasc = new Date(dataNascimento);
  if (Number.isNaN(nasc.getTime())) return null;
  const diff = Date.now() - nasc.getTime();
  const anos = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return anos >= 0 && anos < 120 ? anos : null;
}

/** Busca deals ativos/perdidos com atleta (QUENTE/MORNO). Fonte única. */
async function fetchRemarketingDeals(): Promise<DealRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("deals")
    .select(
      "id, etapa, pode_reativar, updated_at, atleta:atletas!inner(nome_completo, email, whatsapp, classificacao_gemini, consentimento_lgpd, lead_score, data_nascimento, esporte, cidade_estado)",
    )
    .is("deleted_at", null);
  return (data as DealRow[] | null) ?? [];
}

async function fetchTicketMedio(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("contratos_financeiros")
    .select("valor_total")
    .is("deleted_at", null);
  const valores = (data ?? []).map((c) => Number(c.valor_total)).filter((v) => v > 0);
  if (valores.length === 0) return TICKET_MEDIO_FALLBACK;
  return Math.round(valores.reduce((s, v) => s + v, 0) / valores.length);
}

/** True se o deal+atleta pertence ao segmento. */
function pertenceAoSegmento(key: string, d: DealRow, a: AtletaRow, agora: Date): boolean {
  const etapa = d.etapa;
  const ganho = ETAPAS_GANHAS.includes(etapa);
  const perdido = etapa === "perdido";
  const ativoNaoGanho = !ganho && !perdido;

  switch (key) {
    case "nao_agendaram":
      return ["lead", "aguardando_timing"].includes(etapa);
    case "reuniao_sem_fechar":
      return ["reuniao_marcada", "reuniao_realizada", "diagnostico_fit", "alinhamento_estrategico"].includes(etapa);
    case "proposta_sem_resposta":
      return ["proposta_enviada", "followup_proposta", "negociacao", "contrato_enviado"].includes(etapa);
    case "perdidos_recuperaveis":
      return perdido && d.pode_reativar === true;
    case "inativos_90d": {
      if (!ativoNaoGanho) return false;
      if (!d.updated_at) return false;
      const dias = (agora.getTime() - new Date(d.updated_at).getTime()) / (24 * 60 * 60 * 1000);
      return dias >= DIAS_INATIVO;
    }
    case "alto_score_sem_followup":
      return ativoNaoGanho && (a.lead_score ?? 0) >= SCORE_ALTO;
    case "aniversariantes": {
      if (ganho) return false;
      if (!a.data_nascimento) return false;
      return new Date(a.data_nascimento).getUTCMonth() === agora.getUTCMonth();
    }
    default:
      return false;
  }
}

/** Dados para a página (anônimo). */
export async function fetchRemarketingData(): Promise<RemarketingData> {
  const [deals, ticketMedio] = await Promise.all([fetchRemarketingDeals(), fetchTicketMedio()]);
  const agora = new Date();
  const esportesSet = new Set<string>();

  const segments: RemarketingSegment[] = REMARKETING_SEGMENTS.map((def) => {
    const leads: RemarketingLeadAnon[] = [];
    for (const d of deals) {
      const a = normAtleta(d.atleta);
      if (!a) continue;
      const classe = a.classificacao_gemini ?? "";
      if (!["QUENTE", "MORNO"].includes(classe)) continue;
      if (!pertenceAoSegmento(def.key, d, a, agora)) continue;

      const esporte = (a.esporte ?? "").trim() || "—";
      esportesSet.add(esporte);
      leads.push({
        dealId: d.id,
        nome: (a.nome_completo ?? "").trim() || "Sem nome",
        idade: idadeDe(a.data_nascimento),
        esporte,
        classe,
        etapa: d.etapa,
        score: a.lead_score ?? 0,
        cidade: (a.cidade_estado ?? "").trim() || "—",
        consentimento: a.consentimento_lgpd === true,
      });
    }
    const conversaoEstimada = Math.round(leads.length * def.taxaEstimada);
    return {
      ...def,
      total: leads.length,
      comConsentimento: leads.filter((l) => l.consentimento).length,
      conversaoEstimada,
      receitaPotencial: conversaoEstimada * ticketMedio,
      leads,
    };
  });

  return { segments, ticketMedio, esportes: Array.from(esportesSet).sort() };
}

// ─── Para export server-side (com PII) ─────────────────────────────────
export interface RemarketingLeadFull {
  dealId: string;
  nome: string;
  email: string;
  whatsapp: string;
  idade: number | null;
  esporte: string;
  classe: string;
  consentimento: boolean;
}

export const FAIXAS_IDADE: { key: string; min: number; max: number }[] = [
  { key: "até 15", min: 0, max: 15 },
  { key: "16-18", min: 16, max: 18 },
  { key: "19-21", min: 19, max: 21 },
  { key: "22+", min: 22, max: 200 },
];

export function faixaDaIdade(idade: number | null): string | null {
  if (idade == null) return null;
  return FAIXAS_IDADE.find((f) => idade >= f.min && idade <= f.max)?.key ?? null;
}

export interface RemarketingFiltros {
  faixasIdade?: string[];
  esportes?: string[];
  classes?: string[];
}

function passaFiltros(l: { idade: number | null; esporte: string; classe: string }, f?: RemarketingFiltros): boolean {
  if (!f) return true;
  if (f.faixasIdade?.length) {
    const faixa = faixaDaIdade(l.idade);
    if (!faixa || !f.faixasIdade.includes(faixa)) return false;
  }
  if (f.esportes?.length && !f.esportes.includes(l.esporte)) return false;
  if (f.classes?.length && !f.classes.includes(l.classe)) return false;
  return true;
}

/** Leads completos (PII) de um segmento, aplicando filtros. Só server-side. */
export async function fetchSegmentoLeadsFull(
  segmentKey: string,
  filtros?: RemarketingFiltros,
): Promise<RemarketingLeadFull[]> {
  const def = REMARKETING_SEGMENTS.find((s) => s.key === segmentKey);
  if (!def) return [];
  const deals = await fetchRemarketingDeals();
  const agora = new Date();
  const out: RemarketingLeadFull[] = [];

  for (const d of deals) {
    const a = normAtleta(d.atleta);
    if (!a) continue;
    const classe = a.classificacao_gemini ?? "";
    if (!["QUENTE", "MORNO"].includes(classe)) continue;
    if (!pertenceAoSegmento(segmentKey, d, a, agora)) continue;

    const lead = {
      idade: idadeDe(a.data_nascimento),
      esporte: (a.esporte ?? "").trim() || "—",
      classe,
    };
    if (!passaFiltros(lead, filtros)) continue;

    out.push({
      dealId: d.id,
      nome: a.nome_completo ?? "",
      email: a.email ?? "",
      whatsapp: a.whatsapp ?? "",
      idade: lead.idade,
      esporte: lead.esporte,
      classe,
      consentimento: a.consentimento_lgpd === true,
    });
  }
  return out;
}
