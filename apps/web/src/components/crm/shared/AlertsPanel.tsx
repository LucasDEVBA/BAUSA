import { cn } from "@/lib/utils";
import { AlertTriangle, Info, TrendingDown, Clock } from "lucide-react";

/*
  COMPONENT: AlertsPanel
  IDENTITY:  BAUSA Elite — .crm-card base. Section header with alert count badge.
             Alert items: tinted bg per severity. Baixa uses neutral-100.
  CONTRAST:  Severity text on subtle background: all >5:1 AA
             Message text: --crm-text-secondary on subtle bg = ~7:1 AAA
*/

interface Alert {
  tipo: string;
  titulo: string;
  mensagem: string;
  severidade: string;
  deal_id?: string;
}

interface AlertsPanelProps {
  alertas: Alert[];
}

const SEV_STYLES: Record<string, { icon: React.ElementType; border: string; bg: string; text: string }> = {
  critica: {
    icon: AlertTriangle,
    border: "border-[var(--crm-error-border)]",
    bg: "bg-[var(--crm-error-subtle)]",
    text: "text-[var(--crm-error)]",
  },
  alta: {
    icon: TrendingDown,
    border: "border-[var(--crm-warning-border)]",
    bg: "bg-[var(--crm-warning-subtle)]",
    text: "text-[var(--crm-warning)]",
  },
  media: {
    icon: Clock,
    border: "border-[var(--crm-info-border)]",
    bg: "bg-[var(--crm-info-subtle)]",
    text: "text-[var(--crm-info)]",
  },
  baixa: {
    icon: Info,
    border: "border-[var(--crm-border)]",
    bg: "bg-[var(--crm-neutral-100)]",
    text: "text-[var(--crm-text-secondary)]",
  },
};

export function AlertsPanel({ alertas }: AlertsPanelProps) {
  if (alertas.length === 0) return null;

  return (
    <div className="crm-card">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 text-[var(--crm-error)]" />
        <p className="crm-section-label">Alertas e Gargalos</p>
        <span className="crm-badge crm-badge-error crm-badge-no-dot ml-auto">
          {alertas.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {alertas.map((alerta, i) => {
          const sev = SEV_STYLES[alerta.severidade] || SEV_STYLES.baixa;
          const Icon = sev.icon;
          return (
            <div key={i} className={cn(
              "flex items-start gap-3 rounded-[var(--crm-radius-xl)] border p-3.5",
              "transition-colors duration-[var(--crm-duration-fast)]",
              sev.border,
              sev.bg,
            )}>
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", sev.text)} />
              <div className="min-w-0">
                <p className={cn("text-[var(--crm-text-sm)] font-[var(--crm-weight-semibold)]", sev.text)}>
                  {alerta.titulo}
                </p>
                <p className="text-[var(--crm-text-sm)] text-[var(--crm-text-secondary)] mt-0.5 line-clamp-2">
                  {alerta.mensagem}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
