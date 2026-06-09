import { cn } from "@/lib/utils";

type NfStatus = "pendente" | "emitida" | "nao_aplicavel";

const NF_STATUS_CONFIG: Record<NfStatus, { label: string; color: string; bg: string }> = {
  pendente: { label: "Pendente", color: "text-sys-orange", bg: "bg-sys-orange/15 border-sys-orange/20" },
  emitida: { label: "Emitida", color: "text-sys-green", bg: "bg-sys-green/15 border-sys-green/20" },
  nao_aplicavel: { label: "N/A", color: "text-muted-foreground", bg: "bg-secondary border-border" },
};

interface NfBadgeProps {
  status: NfStatus;
}

export function NfBadge({ status }: NfBadgeProps) {
  const cfg = NF_STATUS_CONFIG[status] || NF_STATUS_CONFIG.nao_aplicavel;
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold", cfg.bg, cfg.color)}>
      {cfg.label}
    </span>
  );
}
