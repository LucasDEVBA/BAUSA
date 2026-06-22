import Link from "next/link";
import { Clock, Hourglass } from "lucide-react";
import type { TimingAlternativeSummary } from "@/lib/war-room-queries";

interface TimingAlternativesCardProps {
  data: TimingAlternativeSummary;
}

function formatNextDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export function TimingAlternativesCard({ data }: TimingAlternativesCardProps) {
  const total = data.aguardando_timing_count + data.fora_timing_count;
  if (total === 0) return null;

  return (
    <section className="mb-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-label-tertiary">
        Timing Alternativo
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Card 1: Aguardando timing (muito_cedo) */}
        <div className="rounded-lg border border-plan-legacy/20 bg-plan-legacy/5 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-plan-legacy/80">
                Aguardando Timing
              </p>
              <p className="mt-1 text-base font-semibold text-plan-legacy">
                {data.aguardando_timing_count}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                atletas muito jovens — retomada agendada para nov/ano civil seguinte
              </p>
            </div>
            <Hourglass className="h-5 w-5 shrink-0 text-plan-legacy" />
          </div>
        </div>

        {/* Card 2: Fora do timing (tarde_demais) */}
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fora do Timing
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">{data.fora_timing_count}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                graduados há 2+ anos — leads alternativos (não exibidos no Kanban)
              </p>
            </div>
            <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
          </div>
        </div>

        {/* Card 3: Próximo retorno agendado */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">
              Próximo Retorno
            </p>
            <p className="mt-1 text-base font-semibold text-primary">
              {formatNextDate(data.next_scheduled_followup_at)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              data programada para retomar contato com o lead mais antigo
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 text-right">
        <Link
          href="/leads"
          className="text-xs text-plan-legacy hover:text-plan-legacy/70 underline-offset-4 hover:underline"
        >
          Ver leads de timing alternativo →
        </Link>
      </div>
    </section>
  );
}
