import { AlertCircle, AlertTriangle, Info, Search } from "lucide-react";
import { type Alert, type Bottleneck } from "@/types/revenue";

const ALERT_STYLES = {
  critical: {
    wrapper: "border-red-500/20 bg-red-500/5",
    icon: "text-red-400",
    title: "text-red-300",
    badge: "bg-red-500/20 text-red-400 border-red-500/30",
    badgeLabel: "Crítico",
    IconComponent: AlertCircle,
  },
  warning: {
    wrapper: "border-amber-500/20 bg-amber-500/5",
    icon: "text-amber-400",
    title: "text-amber-300",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    badgeLabel: "Atenção",
    IconComponent: AlertTriangle,
  },
  info: {
    wrapper: "border-blue-500/20 bg-blue-500/5",
    icon: "text-blue-400",
    title: "text-blue-300",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    badgeLabel: "Info",
    IconComponent: Info,
  },
} as const;

const IMPACT_STYLES = {
  alto: "bg-red-500/10 text-red-400 border border-red-500/20",
  medio: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
};

interface AlertCardProps {
  alert: Alert;
}

function AlertCard({ alert }: AlertCardProps) {
  const styles = ALERT_STYLES[alert.type];
  const Icon = styles.IconComponent;

  return (
    <div className={`rounded-lg border p-3.5 ${styles.wrapper}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${styles.icon}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-xs font-semibold leading-tight ${styles.title}`}>{alert.title}</p>
            <span
              className={`flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${styles.badge}`}
            >
              {styles.badgeLabel}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">{alert.description}</p>
          {alert.action_label && (
            <button className={`mt-2 text-[10px] font-semibold underline-offset-2 hover:underline ${styles.icon}`}>
              {alert.action_label} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface BottleneckCardProps {
  bottleneck: Bottleneck;
  index: number;
}

function BottleneckCard({ bottleneck, index }: BottleneckCardProps) {
  return (
    <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-bold text-indigo-400">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-zinc-200 leading-tight">{bottleneck.title}</p>
            <span
              className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${IMPACT_STYLES[bottleneck.impact]}`}
            >
              {bottleneck.impact === "alto" ? "Alto impacto" : "Médio impacto"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed">{bottleneck.description}</p>
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-indigo-500/5 border border-indigo-500/20 px-2 py-1.5">
            <Search className="mt-0.5 h-3 w-3 flex-shrink-0 text-indigo-400" />
            <p className="text-[10px] text-indigo-300 leading-relaxed">{bottleneck.suggestion}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AlertsPanelProps {
  alerts: Alert[];
  bottlenecks: Bottleneck[];
}

export function AlertsPanel({ alerts, bottlenecks }: AlertsPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-5">
      {/* Alertas */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-zinc-100">
          Alertas Ativos
          <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-[10px] font-bold text-red-400">
            {alerts.filter((a) => a.type === "critical").length}
          </span>
        </h3>
        <div className="space-y-2">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      </div>

      {/* Gargalos */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-zinc-100">Top Gargalos Identificados</h3>
        <div className="space-y-2">
          {bottlenecks.map((b, i) => (
            <BottleneckCard key={b.id} bottleneck={b} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
