import { createServerSupabaseClient } from "@/lib/supabase-server";

// ════════════════════════════════════════════════════════════════════════
// Re-marketing — audiências de leads QUENTE/MORNO ainda NÃO convertidos
// ════════════════════════════════════════════════════════════════════════
//
// Gera segmentos para subir na Meta como Custom Audience e re-impactar com
// anúncios os leads de maior valor que esfriaram no funil. Só leads
// qualificados (classificacao_gemini IN QUENTE/MORNO) que não fecharam.
//
// O cruzamento é deals (etapa) + atletas (classe + contato). Como a
// auto-promoção só cria atleta/deal para QUENTE/MORNO, o universo já é
// qualificado; ainda assim filtramos por classe por robustez.
// ════════════════════════════════════════════════════════════════════════

export interface RemarketingSegmentDef {
  key: string;
  label: string;
  descricao: string;
  etapas: string[];
  apenasReativaveis?: boolean;
}

// Etapas que contam como "fechado/ganho" (não entram em re-marketing)
const ETAPAS_GANHAS = ["contrato_assinado", "sinal_pago", "admission_process", "concluido"];

export const REMARKETING_SEGMENTS: RemarketingSegmentDef[] = [
  {
    key: "nao_agendaram",
    label: "Não agendaram reunião",
    descricao: "Qualificados que entraram mas ainda não marcaram a reunião estratégica.",
    etapas: ["lead", "aguardando_timing"],
  },
  {
    key: "reuniao_sem_fechar",
    label: "Reunião sem fechamento",
    descricao: "Tiveram reunião/diagnóstico mas o deal não avançou para proposta.",
    etapas: ["reuniao_marcada", "reuniao_realizada", "diagnostico_fit", "alinhamento_estrategico"],
  },
  {
    key: "proposta_sem_resposta",
    label: "Proposta sem resposta",
    descricao: "Receberam proposta/entraram em negociação mas não fecharam.",
    etapas: ["proposta_enviada", "followup_proposta", "negociacao", "contrato_enviado"],
  },
  {
    key: "perdidos_recuperaveis",
    label: "Perdidos recuperáveis",
    descricao: "Marcados como perdidos, mas sinalizados como reativáveis.",
    etapas: ["perdido"],
    apenasReativaveis: true,
  },
];

interface AtletaContato {
  nome_completo: string | null;
  email: string | null;
  whatsapp: string | null;
  classificacao_gemini: string | null;
  consentimento_lgpd: boolean | null;
}

interface DealRow {
  id: string;
  etapa: string;
  pode_reativar: boolean | null;
  atleta: AtletaContato | AtletaContato[] | null;
}

export interface RemarketingLead {
  nome: string;
  email: string;
  whatsapp: string;
  classe: string;
  consentimento: boolean;
}

export interface RemarketingSegment extends RemarketingSegmentDef {
  total: number;
  comConsentimento: number;
  leads: RemarketingLead[];
}

function normalizeAtleta(a: DealRow["atleta"]): AtletaContato | null {
  if (!a) return null;
  return Array.isArray(a) ? (a[0] ?? null) : a;
}

async function fetchDealsComAtleta(): Promise<DealRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("deals")
    .select(
      "id, etapa, pode_reativar, atleta:atletas!inner(nome_completo, email, whatsapp, classificacao_gemini, consentimento_lgpd)",
    )
    .is("deleted_at", null);
  return (data as DealRow[] | null) ?? [];
}

/** Retorna os 4 segmentos de re-marketing com contagem + leads. */
export async function fetchRemarketingSegments(): Promise<RemarketingSegment[]> {
  const deals = await fetchDealsComAtleta();

  return REMARKETING_SEGMENTS.map((def) => {
    const leads: RemarketingLead[] = [];
    for (const d of deals) {
      if (!def.etapas.includes(d.etapa)) continue;
      if (def.apenasReativaveis && d.pode_reativar !== true) continue;
      if (ETAPAS_GANHAS.includes(d.etapa)) continue;

      const atleta = normalizeAtleta(d.atleta);
      if (!atleta) continue;
      const classe = atleta.classificacao_gemini ?? "";
      if (!["QUENTE", "MORNO"].includes(classe)) continue;

      leads.push({
        nome: atleta.nome_completo ?? "",
        email: atleta.email ?? "",
        whatsapp: atleta.whatsapp ?? "",
        classe,
        consentimento: atleta.consentimento_lgpd === true,
      });
    }

    return {
      ...def,
      total: leads.length,
      comConsentimento: leads.filter((l) => l.consentimento).length,
      leads,
    };
  });
}
