"use client";

import {
  Target,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { type Deal, DEAL_STAGE_CONFIG } from "@/types/deal";
import { cn } from "@/lib/utils";
import {
  MinimalCard,
  MinimalField,
  MinimalStat,
} from "@/components/shared/MinimalUI";
import { AcoesRapidasCard } from "@/components/mensagem/AcoesRapidasCard";
import { ClassificadorV2Resumo } from "@/components/leads/ClassificadorV2Resumo";

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
  // eslint-disable-next-line react-hooks/purity
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function VisaoExecutivaPanel({ deal }: Props) {
  const stageCfg = DEAL_STAGE_CONFIG[deal.stage];
  const diasEtapa = diasEntre(deal.stage_updated_at);
  const diasCriacao = diasEntre(deal.created_at);

  // Alertas
  const alertas: { icon: typeof AlertTriangle; texto: string; tone: "red" | "orange" }[] = [];
  if (!deal.next_action) {
    alertas.push({
      icon: AlertTriangle,
      texto: "Sem próxima ação definida",
      tone: "red",
    });
  }
  if (diasEtapa > 14) {
    alertas.push({
      icon: Clock,
      texto: `${diasEtapa}d parado nesta etapa`,
      tone: "orange",
    });
  }
  if (deal.next_action_date) {
    const atraso = diasEntre(deal.next_action_date);
    if (atraso > 0) {
      alertas.push({
        icon: Clock,
        texto: `Próxima ação atrasada em ${atraso}d`,
        tone: "red",
      });
    }
  }
  if (deal.flag_retrocedido) {
    alertas.push({
      icon: AlertTriangle,
      texto: `Retrocesso${deal.motivo_retrocesso ? `: ${deal.motivo_retrocesso}` : ""}`,
      tone: "orange",
    });
  }

  const positivos: string[] = [];
  if (deal.classificacao_gemini === "QUENTE")
    positivos.push("Qualificação Gemini QUENTE");
  if (deal.product_tier === "Legacy") positivos.push("Plano Legacy");
  if (stageCfg.isFinancial) positivos.push("Em fase financeira");

  return (
    <div className="flex flex-col gap-3">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MinimalStat label="Valor BRL" value={fmtBRL(deal.deal_value_brl)} />
        <MinimalStat
          label="Classificação"
          value={deal.classification ?? "—"}
          tone={
            deal.classification === "QUENTE"
              ? "green"
              : deal.classification === "MORNO"
                ? "orange"
                : deal.classification === "FRIO"
                  ? "blue"
                  : "default"
          }
        />
        <MinimalStat
          label="Dias na etapa"
          value={`${diasEtapa}d`}
          tone={diasEtapa > 14 ? "orange" : "default"}
        />
        <MinimalStat label="No pipeline" value={`${diasCriacao}d`} />
      </div>

      {/* Ações rápidas — mensagem direta (I4). Contato re-resolvido no server. */}
      <AcoesRapidasCard
        destinatario={{
          nome: deal.athlete_name,
          responsavelNome: deal.guardian_name || null,
          telefone: deal.whatsapp ?? null,
          email: deal.guardian_email ?? deal.email ?? null,
          classificacao: deal.classificacao_gemini ?? deal.classification ?? null,
          dealId: deal.id,
        }}
      />

      {/* Status comercial */}
      <MinimalCard
        title="Status comercial"
        icon={TrendingUp}
        action={
          <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span
              className={cn("h-1.5 w-1.5 rounded-full", stageCfg.dotColor)}
            />
            {stageCfg.label}
          </span>
        }
      >
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <MinimalField label="Próxima ação" value={deal.next_action} />
          <MinimalField
            label="Quando"
            value={
              deal.next_action_date
                ? new Date(deal.next_action_date).toLocaleDateString("pt-BR")
                : null
            }
          />
          <MinimalField label="Responsável" value={deal.consultant} />
          <MinimalField label="Plano" value={deal.product_tier} />
        </dl>
      </MinimalCard>

      {/* Qualificação Gemini */}
      {deal.qualificado_gemini != null && (
        <MinimalCard
          title="Qualificação IA"
          icon={Sparkles}
          iconColor="text-primary"
          action={
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold",
                deal.classificacao_gemini === "QUENTE"
                  ? "bg-sys-green/12 text-sys-green"
                  : deal.classificacao_gemini === "MORNO"
                    ? "bg-sys-orange/12 text-sys-orange"
                    : "bg-sys-blue/12 text-sys-blue",
              )}
            >
              {deal.classificacao_gemini ?? "—"}
            </span>
          }
        >
          {deal.motivo_gemini ? (
            <p className="text-xs leading-relaxed text-foreground/90">
              {deal.motivo_gemini}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sem justificativa registrada.
            </p>
          )}
          {/* Classificador v2 — some sozinho em leads pré-v2 (campos NULL) */}
          <ClassificadorV2Resumo dados={deal} compact />
        </MinimalCard>
      )}

      {/* Positivos + Alertas lado a lado */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {positivos.length > 0 && (
          <MinimalCard
            title="Sinais positivos"
            icon={CheckCircle2}
            iconColor="text-sys-green"
          >
            <ul className="space-y-0.5">
              {positivos.map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-1.5 text-xs text-foreground/90"
                >
                  <span className="h-1 w-1 rounded-full bg-sys-green" />
                  {p}
                </li>
              ))}
            </ul>
          </MinimalCard>
        )}

        {alertas.length > 0 && (
          <MinimalCard
            title="Pontos de atenção"
            icon={AlertTriangle}
            iconColor="text-sys-orange"
          >
            <ul className="space-y-0.5">
              {alertas.map((a, i) => {
                const Icon = a.icon;
                return (
                  <li
                    key={`${a.texto}-${i}`}
                    className="flex items-center gap-1.5 text-xs text-foreground/90"
                  >
                    <Icon
                      className={cn(
                        "h-3 w-3",
                        a.tone === "red" ? "text-sys-red" : "text-sys-orange",
                      )}
                    />
                    {a.texto}
                  </li>
                );
              })}
            </ul>
          </MinimalCard>
        )}
      </div>

      {/* Contexto curto */}
      <MinimalCard title="Contexto" icon={Target}>
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <MinimalField label="Esporte" value={deal.esporte} />
          <MinimalField label="Posição" value={deal.athlete_position} />
          <MinimalField label="Cidade/Estado" value={deal.cidade_estado} />
          <MinimalField label="Investimento" value={deal.investment_range} />
          <MinimalField label="WhatsApp" value={deal.whatsapp} />
          <MinimalField
            label="E-mail responsável"
            value={deal.guardian_email ?? deal.email}
          />
        </dl>
      </MinimalCard>

      {/* Stats financeiros (se houver) */}
      {(deal.signal_value_brl || deal.remaining_value_brl) && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <MinimalStat
            label="Sinal BRL"
            value={fmtBRL(deal.signal_value_brl)}
            tone="green"
          />
          <MinimalStat
            label="Saldo BRL"
            value={fmtBRL(deal.remaining_value_brl)}
            tone="blue"
          />
          <MinimalStat
            label="Desconto"
            value={
              deal.has_discount && deal.discount_pct
                ? `${deal.discount_pct}%`
                : "—"
            }
            tone={deal.has_discount ? "orange" : "default"}
          />
        </div>
      )}

    </div>
  );
}
