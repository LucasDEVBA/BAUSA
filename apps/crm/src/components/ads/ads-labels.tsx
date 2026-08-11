import { Badge, type BadgeTone } from "@/components/ui/Badge";

// Rótulos compartilhados da seção Ads (cards, detalhe, tabelas).

export const STATUS_CONFIG: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Ativa", tone: "green" },
  PAUSED: { label: "Pausada", tone: "neutral" },
  CAMPAIGN_PAUSED: { label: "Pausada", tone: "neutral" },
  ADSET_PAUSED: { label: "Conjunto pausado", tone: "orange" },
  IN_PROCESS: { label: "Processando", tone: "blue" },
  WITH_ISSUES: { label: "Com problemas", tone: "red" },
  PENDING_REVIEW: { label: "Em revisão", tone: "blue" },
  DISAPPROVED: { label: "Reprovado", tone: "red" },
  ARCHIVED: { label: "Arquivada", tone: "neutral" },
  DELETED: { label: "Excluída", tone: "neutral" },
};

export const OBJETIVO_LABEL: Record<string, string> = {
  OUTCOME_LEADS: "Leads",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_AWARENESS: "Reconhecimento",
  OUTCOME_SALES: "Vendas",
  OUTCOME_APP_PROMOTION: "App",
  // Objetivos legados (campanhas antigas / boosts)
  LINK_CLICKS: "Tráfego",
  POST_ENGAGEMENT: "Engajamento",
  LEAD_GENERATION: "Leads",
  CONVERSIONS: "Vendas",
  MESSAGES: "Mensagens",
  VIDEO_VIEWS: "Vídeo",
  REACH: "Alcance",
  BRAND_AWARENESS: "Reconhecimento",
};

export function AdsStatusBadge({ status, size, className }: { status: string; size?: "sm" | "md"; className?: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, tone: "neutral" as BadgeTone };
  return (
    <Badge tone={cfg.tone} size={size} className={className}>
      {cfg.label}
    </Badge>
  );
}

// ─── Veiculação (o que "Ativa" esconde) ─────────────────────────────────
// A Meta NUNCA desliga o toggle de boost encerrado: 88 das 89 "ativas" da
// conta eram boosts com stop_time no passado (auditoria 2026-08-11). O
// badge de veiculação separa status (toggle) de ENTREGA real:
//   entregando  = ACTIVE, sem fim (ou fim futuro) E gastou nos últimos 7d
//   sem_entrega = ACTIVE, sem fim, mas R$ 0 em 7d (ex.: pagamento bloqueado)
//   encerrada   = ACTIVE com stop_time no passado (boost que acabou)
// Determinístico — gasto 7d vem do NOSSO meta_ads_campanha (sync diário).

export type Veiculacao = "entregando" | "sem_entrega" | "encerrada" | null;

export function veiculacaoDe(status: string, fimEm: string | null, gasto7d: number): Veiculacao {
  if (status !== "ACTIVE") return null; // Pausada/etc. — o badge de status já explica
  if (fimEm && Date.parse(fimEm) < Date.now()) return "encerrada";
  return gasto7d > 0 ? "entregando" : "sem_entrega";
}

const VEICULACAO_CONFIG: Record<Exclude<Veiculacao, null>, { label: string; tone: BadgeTone; hint: string }> = {
  entregando: { label: "Entregando", tone: "green", hint: "Gastou nos últimos 7 dias — veiculando de verdade" },
  sem_entrega: {
    label: "Sem entrega 7d",
    tone: "orange",
    hint: "Status ativo, mas R$ 0 nos últimos 7 dias — verifique pagamento/veiculação no Gerenciador",
  },
  encerrada: {
    label: "Encerrada",
    tone: "neutral",
    hint: "Boost com período encerrado — a Meta mantém o status \"Ativa\", mas não veicula mais",
  },
};

export function VeiculacaoBadge({
  status,
  fimEm,
  gasto7d,
  size,
  className,
}: {
  status: string;
  fimEm: string | null;
  gasto7d: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const veic = veiculacaoDe(status, fimEm, gasto7d);
  if (!veic) return null;
  const cfg = VEICULACAO_CONFIG[veic];
  const fim =
    veic === "encerrada" && fimEm
      ? ` ${new Date(fimEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}`
      : "";
  return (
    <Badge tone={cfg.tone} size={size} className={className} title={cfg.hint}>
      {cfg.label}
      {fim}
    </Badge>
  );
}
