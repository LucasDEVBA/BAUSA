import Link from "next/link";
import { Clock, Hourglass, CalendarClock } from "lucide-react";
import { StatCard } from "@/components/ui";
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

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-eyebrow text-label-tertiary">Timing Alternativo</p>
        <Link
          href="/leads"
          className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Ver leads →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Aguardando timing"
          value={data.aguardando_timing_count}
          context="muito jovens · retoma em nov"
          icon={Hourglass}
          accent="purple"
        />
        <StatCard
          label="Fora do timing"
          value={data.fora_timing_count}
          context="graduados há 2+ anos"
          icon={Clock}
          accent="orange"
        />
        <StatCard
          label="Próximo retorno"
          value={formatNextDate(data.next_scheduled_followup_at)}
          context="retomar o lead mais antigo"
          icon={CalendarClock}
          accent="blue"
        />
      </div>
    </section>
  );
}
