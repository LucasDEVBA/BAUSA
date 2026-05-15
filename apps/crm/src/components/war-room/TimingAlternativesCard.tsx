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
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">
        Timing Alternativo
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Card 1: Aguardando timing (muito_cedo) */}
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-300/80">
                Aguardando Timing
              </p>
              <p className="mt-1 text-2xl font-bold text-purple-200">
                {data.aguardando_timing_count}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                atletas muito jovens — retomada agendada para nov/ano civil seguinte
              </p>
            </div>
            <Hourglass className="h-5 w-5 shrink-0 text-purple-400" />
          </div>
        </div>

        {/* Card 2: Fora do timing (tarde_demais) */}
        <div className="rounded-lg border border-zinc-700/40 bg-zinc-800/30 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Fora do Timing
              </p>
              <p className="mt-1 text-2xl font-bold text-zinc-200">{data.fora_timing_count}</p>
              <p className="mt-1 text-xs text-zinc-500">
                graduados há 2+ anos — leads alternativos (não exibidos no Kanban)
              </p>
            </div>
            <Clock className="h-5 w-5 shrink-0 text-zinc-500" />
          </div>
        </div>

        {/* Card 3: Próximo retorno agendado */}
        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300/80">
              Próximo Retorno
            </p>
            <p className="mt-1 text-2xl font-bold text-indigo-200">
              {formatNextDate(data.next_scheduled_followup_at)}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              data programada para retomar contato com o lead mais antigo
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 text-right">
        <Link
          href="/leads"
          className="text-xs text-purple-300 hover:text-purple-200 underline-offset-4 hover:underline"
        >
          Ver leads de timing alternativo →
        </Link>
      </div>
    </section>
  );
}
