import { type Lead } from "@/types/lead";
import { LeadStatusBadge } from "@/components/leads/LeadStatusBadge";
import { formatRelativeTime, getInitials, formatInvestmentRange } from "@/lib/utils";

interface RecentLeadsProps {
  leads: Lead[];
}

export function RecentLeads({ leads }: RecentLeadsProps) {
  const recent = leads.slice(0, 5);

  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Últimos Leads</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Entradas mais recentes</p>
        </div>
        <a
          href="/leads"
          className="text-xs font-medium text-indigo-400 transition-colors hover:text-indigo-300"
        >
          Ver todos →
        </a>
      </div>

      <div className="mt-4 space-y-1">
        {recent.map((lead) => (
          <div
            key={lead.id}
            className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/5"
          >
            {/* Avatar */}
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 text-xs font-bold text-zinc-300">
              {getInitials(lead.athlete_name)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-zinc-100">
                {lead.athlete_name}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {lead.position} • {lead.address_state}
                {lead.investment_range && (
                  <> • {formatInvestmentRange(lead.investment_range)}</>
                )}
              </p>
            </div>

            {/* Classificação + tempo */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <LeadStatusBadge classification={lead.qualification_classification} size="sm" />
              <span className="text-[10px] text-zinc-600">
                {formatRelativeTime(lead.submitted_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
