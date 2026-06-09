"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  Layers,
  Percent,
  Calendar,
  CalendarCheck,
  Receipt,
  FileSignature,
  Trophy,
  XCircle,
  UserPlus,
  AlertTriangle,
  ChevronDown,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PipelineMetrics {
  totalPipelineBrl: number;
  activeCount: number;
  conversionRate: number;
  forecast30dBrl: number;
  reunioesMarcadas: number;
  ticketMedioBrl: number;
  contratosAssinados: number;
  ganhoBrl: number;
  perdidos: number;
  leadsNovos: number;
  acoesAtrasadas: number;
}

type Tone = "primary" | "blue" | "green" | "red" | "muted";

const TONE: Record<Tone, { icon: string; value: string }> = {
  primary: { icon: "bg-primary/10 text-primary", value: "text-foreground" },
  blue: { icon: "bg-sys-blue/10 text-sys-blue", value: "text-foreground" },
  green: { icon: "bg-sys-green/10 text-sys-green", value: "text-sys-green" },
  red: { icon: "bg-sys-red/10 text-sys-red", value: "text-sys-red" },
  muted: { icon: "bg-secondary text-muted-foreground", value: "text-foreground" },
};

const STORAGE_KEY = "bausa-pipeline-metrics";

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

function Chip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: Tone;
}) {
  const t = TONE[tone];
  return (
    <div className="glass-card flex items-center gap-3 rounded-xl border-transparent px-4 py-3">
      <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg", t.icon)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-sm font-bold", t.value)}>{value}</p>
      </div>
    </div>
  );
}

export function PipelineMetricsBar({ metrics }: { metrics: PipelineMetrics }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) === "open");
    } catch {
      /* localStorage indisponivel — mantem fechado */
    }
  }, []);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "open" : "closed");
      } catch {
        /* ignora erro de storage */
      }
      return next;
    });
  };

  const cards: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; tone: Tone }[] = [
    { icon: TrendingUp, label: "Total em pipeline", value: brl(metrics.totalPipelineBrl), tone: "primary" },
    { icon: Layers, label: "Deals ativos", value: String(metrics.activeCount), tone: "primary" },
    { icon: Receipt, label: "Ticket médio", value: brl(metrics.ticketMedioBrl), tone: "primary" },
    { icon: UserPlus, label: "Leads novos", value: String(metrics.leadsNovos), tone: "blue" },
    { icon: CalendarCheck, label: "Reuniões marcadas", value: String(metrics.reunioesMarcadas), tone: "blue" },
    { icon: FileSignature, label: "Contratos assinados", value: String(metrics.contratosAssinados), tone: "blue" },
    { icon: Percent, label: "Taxa de conversão", value: `${metrics.conversionRate}%`, tone: "green" },
    { icon: Trophy, label: "Ganho (concluído)", value: brl(metrics.ganhoBrl), tone: "green" },
    { icon: Calendar, label: "Previsão 30 dias", value: brl(metrics.forecast30dBrl), tone: "green" },
    { icon: XCircle, label: "Perdidos", value: String(metrics.perdidos), tone: "red" },
    {
      icon: AlertTriangle,
      label: "Ações atrasadas",
      value: String(metrics.acoesAtrasadas),
      tone: metrics.acoesAtrasadas > 0 ? "red" : "muted",
    },
  ];

  return (
    <div>
      {/* Barra de toggle */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="pipeline-metrics-panel"
        className="glass-card flex w-full items-center justify-between gap-3 rounded-xl border-transparent px-4 py-2.5 text-left transition-colors hover:shadow-md"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <BarChart3 className="h-4 w-4 text-primary" />
          Resumo do pipeline
        </span>
        <span className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {brl(metrics.totalPipelineBrl)} {"·"} {metrics.activeCount} ativos
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
          />
        </span>
      </button>

      {/* Painel colapsável (grid-rows truque p/ animar altura sem medir) */}
      <div
        id="pipeline-metrics-panel"
        className={cn("grid transition-all duration-300 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {cards.map((c) => (
              <Chip key={c.label} icon={c.icon} label={c.label} value={c.value} tone={c.tone} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
