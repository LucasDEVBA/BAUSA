import { cn } from "@/lib/utils";

type NfStatus = "pendente" | "emitida" | "nao_aplicavel";

const NF_STATUS_CONFIG: Record<NfStatus, { label: string; color: string; bg: string }> = {
  pendente: { label: "Pendente", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  emitida: { label: "Emitida", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  nao_aplicavel: { label: "N/A", color: "text-zinc-500", bg: "bg-zinc-500/10 border-zinc-500/20" },
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
