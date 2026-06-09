import { AlertCircle, AlertTriangle, Info, Search } from "lucide-react";
import { type Alert, type Bottleneck } from "@/types/revenue";

const ALERT_STYLES = {
  critical: {
    wrapper: "border-sys-red/20 bg-sys-red/5",
    icon: "text-sys-red",
    title: "text-sys-red",
    badge: "bg-sys-red/20 text-sys-red border-sys-red/30",
    badgeLabel: "Crítico",
    IconComponent: AlertCircle,
  },
  warning: {
    wrapper: "border-sys-orange/20 bg-sys-orange/5",
    icon: "text-sys-orange",
    title: "text-sys-orange",
    badge: "bg-sys-orange/20 text-sys-orange border-sys-orange/30",
    badgeLabel: "Atenção",
    IconComponent: AlertTriangle,
  },
  info: {
    wrapper: "border-sys-blue/20 bg-sys-blue/5",
    icon: "text-sys-blue",
    title: "text-sys-blue",
    badge: "bg-sys-blue/20 text-sys-blue border-sys-blue/30",
    badgeLabel: "Info",
    IconComponent: Info,
  },
} as const;

const IMPACT_STYLES = {
  alto: "bg-sys-red/10 text-sys-red border border-sys-red/20",
  medio: "bg-sys-orange/10 text-sys-orange border border-sys-orange/20",
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
          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{alert.description}</p>
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
    <div className="rounded-lg border border-border bg-card p-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-foreground leading-tight">{bottleneck.title}</p>
            <span
              className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${IMPACT_STYLES[bottleneck.impact]}`}
            >
              {bottleneck.impact === "alto" ? "Alto impacto" : "Médio impacto"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{bottleneck.description}</p>
          <div className="mt-2 flex items-start gap-1.5 rounded-md bg-primary/5 border border-primary/20 px-2 py-1.5">
            <Search className="mt-0.5 h-3 w-3 flex-shrink-0 text-primary" />
            <p className="text-[10px] text-primary/80 leading-relaxed">{bottleneck.suggestion}</p>
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
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Alertas Ativos
          <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sys-red/20 text-[10px] font-bold text-sys-red">
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
        <h3 className="mb-3 text-sm font-semibold text-foreground">Top Gargalos Identificados</h3>
        <div className="space-y-2">
          {bottlenecks.map((b, i) => (
            <BottleneckCard key={b.id} bottleneck={b} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
