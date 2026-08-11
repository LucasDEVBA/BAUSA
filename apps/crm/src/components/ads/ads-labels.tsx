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
