import Link from "next/link";
import { cn } from "@/lib/utils";
import type { TimingAlternativeSummary } from "@/lib/war-room-queries";

interface TimingAlternativesCardProps {
  data: TimingAlternativeSummary;
}

function formatNextDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const mes = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${mes}/${date.getFullYear()}`;
}

export function TimingAlternativesCard({ data }: TimingAlternativesCardProps) {
  const total = data.aguardando_timing_count + data.fora_timing_count;
  if (total === 0) return null;

  const items: Array<{ label: string; value: number | string; context: string; tone: string }> = [
    { label: "Aguardando timing", value: data.aguardando_timing_count, context: "muito jovens · retoma em nov", tone: "text-plan-legacy" },
    { label: "Fora do timing", value: data.fora_timing_count, context: "graduados há 2+ anos", tone: "text-sys-orange" },
    { label: "Próximo retorno", value: formatNextDate(data.next_scheduled_followup_at), context: "lead mais antigo", tone: "text-primary" },
  ];

  return (
    <div className="glass-card relative rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-eyebrow text-muted-foreground">Timing Alternativo</p>
        <Link
          href="/leads"
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver leads →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.label}>
            <p className="text-eyebrow text-label-tertiary">{it.label}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className={cn("text-xl font-bold tabular-nums", it.tone)}>{it.value}</span>
              <span className="text-[11px] text-muted-foreground">{it.context}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
