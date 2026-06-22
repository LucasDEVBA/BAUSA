"use client";

import {
  Award,
  Target,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Calendar,
  Phone,
  Mail,
  Sparkles,
  CircleAlert,
} from "lucide-react";
import { type Deal, DEAL_STAGE_CONFIG } from "@/types/deal";
import { cn } from "@/lib/utils";

interface Props {
  deal: Deal;
}

function fmtBRL(value: number | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function diasEntre(iso: string | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function VisaoExecutivaPanel({ deal }: Props) {
  const stageCfg = DEAL_STAGE_CONFIG[deal.stage];
  const diasEtapa = diasEntre(deal.stage_updated_at);
  const diasCriacao = diasEntre(deal.created_at);
  const classBadgeColor =
    deal.classification === "QUENTE"
      ? "bg-sys-green/15 text-sys-green border-sys-green/30"
      : deal.classification === "MORNO"
        ? "bg-sys-orange/15 text-sys-orange border-sys-orange/30"
        : "bg-sys-blue/15 text-sys-blue border-sys-blue/30";

  // Saúde comercial do deal
  const alertas: { icon: typeof AlertTriangle; texto: string; cor: string }[] = [];
  if (!deal.next_action) {
    alertas.push({
      icon: AlertTriangle,
      texto: "Sem próxima ação definida",
      cor: "text-sys-red",
    });
  }
  if (diasEtapa > 14) {
    alertas.push({
      icon: Clock,
      texto: `${diasEtapa}d parado nesta etapa`,
      cor: "text-sys-orange",
    });
  }
  if (deal.next_action_date) {
    const atraso = Math.floor(
      // eslint-disable-next-line react-hooks/purity
      (Date.now() - new Date(deal.next_action_date).getTime()) / 86400000,
    );
    if (atraso > 0) {
      alertas.push({
        icon: Clock,
        texto: `Próxima ação atrasada em ${atraso}d`,
        cor: "text-sys-red",
      });
    }
  }
  if ((deal.lead_score ?? 0) > 0 && (deal.lead_score ?? 0) < 50) {
    alertas.push({
      icon: CircleAlert,
      texto: `Lead Score baixo: ${deal.lead_score}`,
      cor: "text-sys-orange",
    });
  }
  if (deal.flag_retrocedido) {
    alertas.push({
      icon: AlertTriangle,
      texto: `Deal sofreu retrocesso${deal.motivo_retrocesso ? `: ${deal.motivo_retrocesso}` : ""}`,
      cor: "text-sys-orange",
    });
  }

  const positivos: string[] = [];
  if ((deal.lead_score ?? 0) >= 80) positivos.push("Lead Score alto (top-tier)");
  if (deal.classificacao_gemini === "QUENTE")
    positivos.push("Qualificação Gemini QUENTE");
  if (deal.product_tier === "Legacy") positivos.push("Plano Legacy");
  if (stageCfg.isFinancial)
    positivos.push("Deal já em fase financeira/admissão");

  return (
    <div className="space-y-3">
      {/* Hero do deal */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-card to-card/60 p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Visão Executiva
            </p>
            <h2 className="mt-0.5 text-xl font-semibold text-foreground">
              {deal.athlete_name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {deal.esporte ?? "esporte —"} ·{" "}
              {deal.athlete_position ?? "posição —"}
              {deal.cidade_estado && ` · ${deal.cidade_estado}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                classBadgeColor,
              )}
            >
              {deal.classification}
            </span>
            {deal.product_tier && (
              <span className="inline-flex items-center rounded-md border border-plan-legacy/30 bg-plan-legacy/10 px-2 py-0.5 text-xs font-medium text-plan-legacy">
                {deal.product_tier}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              Valor BRL
            </p>
            <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
              {fmtBRL(deal.deal_value_brl)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Award className="h-3 w-3" />
              Lead Score
            </p>
            <p
              className={cn(
                "mt-1 text-base font-semibold tabular-nums",
                (deal.lead_score ?? 0) >= 75
                  ? "text-sys-green"
                  : (deal.lead_score ?? 0) >= 50
                    ? "text-sys-orange"
                    : "text-muted-foreground",
              )}
            >
              {deal.lead_score ?? "—"}
              {deal.lead_score != null && (
                <span className="text-sm text-muted-foreground">/100</span>
              )}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Clock className="h-3 w-3" />
              Dias na etapa
            </p>
            <p
              className={cn(
                "mt-1 text-base font-semibold tabular-nums",
                diasEtapa > 14
                  ? "text-sys-orange"
                  : diasEtapa > 7
                    ? "text-foreground"
                    : "text-sys-green",
              )}
            >
              {diasEtapa}d
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
            <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              <Calendar className="h-3 w-3" />
              No pipeline
            </p>
            <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
              {diasCriacao}d
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline status */}
      <div className="rounded-xl border border-border bg-card p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Status do pipeline
          </h3>
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", stageCfg.dotColor)} />
            {stageCfg.label}
          </span>
        </div>
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Próxima ação
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {deal.next_action ?? "— não definida"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Quando
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {deal.next_action_date
                ? new Date(deal.next_action_date).toLocaleDateString("pt-BR")
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Responsável
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {deal.consultant ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">
              Última movimentação
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {new Date(deal.stage_updated_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </dd>
          </div>
        </dl>
      </div>

      {/* Qualificação Gemini destacada */}
      {deal.qualificado_gemini != null && (
        <div
          className={cn(
            "rounded-xl border bg-card p-5",
            deal.classificacao_gemini === "QUENTE"
              ? "border-sys-green/30"
              : deal.classificacao_gemini === "MORNO"
                ? "border-sys-orange/30"
                : "border-border",
          )}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Qualificação IA (Gemini)
            </h3>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                deal.classificacao_gemini === "QUENTE"
                  ? "border-sys-green/30 bg-sys-green/15 text-sys-green"
                  : deal.classificacao_gemini === "MORNO"
                    ? "border-sys-orange/30 bg-sys-orange/15 text-sys-orange"
                    : "border-sys-blue/30 bg-sys-blue/15 text-sys-blue",
              )}
            >
              <Sparkles className="h-3 w-3" />
              {deal.classificacao_gemini ?? "—"}
            </span>
          </div>
          {deal.motivo_gemini && (
            <p className="text-sm leading-relaxed text-foreground/90">
              {deal.motivo_gemini}
            </p>
          )}
          {deal.qualificado_gemini_at && (
            <p className="mt-2 text-xs text-muted-foreground">
              Classificado em{" "}
              {new Date(deal.qualificado_gemini_at).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
      )}

      {/* Pontos positivos + alertas */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {positivos.length > 0 && (
          <div className="rounded-xl border border-sys-green/20 bg-sys-green/5 p-5">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-sys-green" />
              <h3 className="text-sm font-semibold text-foreground">
                Sinais positivos
              </h3>
            </div>
            <ul className="space-y-1 text-sm text-foreground/90">
              {positivos.map((p) => (
                <li key={p}>· {p}</li>
              ))}
            </ul>
          </div>
        )}

        {alertas.length > 0 && (
          <div className="rounded-xl border border-sys-orange/30 bg-sys-orange/5 p-5">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-sys-orange" />
              <h3 className="text-sm font-semibold text-foreground">
                Pontos de atenção
              </h3>
            </div>
            <ul className="space-y-1.5 text-sm">
              {alertas.map((a, i) => {
                const Icon = a.icon;
                return (
                  <li
                    key={`${a.texto}-${i}`}
                    className="flex items-center gap-2 text-foreground/90"
                  >
                    <Icon className={cn("h-3.5 w-3.5", a.cor)} />
                    {a.texto}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Contato rápido */}
      <div className="rounded-xl border border-border bg-card p-3.5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Contato direto
        </h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="flex items-center gap-3 rounded-md border border-border bg-background/60 px-3 py-2">
            <Phone className="h-4 w-4 text-sys-blue" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                WhatsApp responsável
              </p>
              <p className="truncate text-sm text-foreground">
                {deal.whatsapp ?? "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-border bg-background/60 px-3 py-2">
            <Mail className="h-4 w-4 text-sys-blue" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                E-mail responsável
              </p>
              <p className="truncate text-sm text-foreground">
                {deal.guardian_email ?? deal.email ?? "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-border bg-background/60 px-3 py-2">
            <Target className="h-4 w-4 text-sys-purple" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Investimento
              </p>
              <p className="truncate text-sm text-foreground">
                {deal.investment_range}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-border bg-background/60 px-3 py-2">
            <TrendingUp className="h-4 w-4 text-sys-green" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Etapa atual
              </p>
              <p className="truncate text-sm text-foreground">
                {stageCfg.label}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
