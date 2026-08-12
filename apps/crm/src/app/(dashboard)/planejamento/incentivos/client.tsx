"use client";

import { useMemo, useState, useTransition } from "react";
import { BadgeCheck, Calculator, Trophy, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import {
  apurarIncentivos,
  mudarStatusApuracao,
  type PlanejamentoCompleto,
} from "@/lib/actions/planejamento";
import { formatarValor, periodoLabel, type StatusApuracao } from "@/lib/planejamento-tipos";

interface Apuracao {
  id: string;
  meta_id: string;
  pessoa_id: string;
  pct_atingido: number;
  valor_apurado: number;
  status: StatusApuracao;
  metas_corporativas: {
    titulo: string;
    periodo_tipo: "ano" | "semestre" | "mes";
    ano: number;
    semestre: number | null;
    mes: number | null;
  } | null;
  user_profiles: { nome: string } | null;
}

const STATUS_TONE: Record<StatusApuracao, "neutral" | "blue" | "green" | "red"> = {
  previsto: "neutral",
  aprovado: "blue",
  pago: "green",
  cancelado: "red",
};

const STATUS_LABEL: Record<StatusApuracao, string> = {
  previsto: "Previsto",
  aprovado: "Aprovado",
  pago: "Pago",
  cancelado: "Cancelado",
};

export function IncentivosClient({
  plano,
  apuracoes,
  podeEditar,
}: {
  plano: PlanejamentoCompleto;
  apuracoes: Apuracao[];
  podeEditar: boolean;
}) {
  const [pendente, startTransition] = useTransition();
  const [aba, setAba] = useState<"apuracao" | "previsao">("apuracao");
  const { ciclo, metas } = plano;

  const totais = useMemo(() => {
    const soma = (s: StatusApuracao) =>
      apuracoes.filter((a) => a.status === s).reduce((t, a) => t + Number(a.valor_apurado), 0);
    return {
      previsto: soma("previsto"),
      aprovado: soma("aprovado"),
      pago: soma("pago"),
      elegiveisAgora: metas
        .filter((m) => m.bonusPrevisto > 0)
        .reduce((t, m) => t + m.bonusPrevisto, 0),
    };
  }, [apuracoes, metas]);

  const comIncentivo = metas.filter((m) => m.incentivo_tipo !== "nenhum");

  const acao = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => {
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.success) toast.success(ok);
        else toast.error(r.error);
      } catch {
        toast.error("Falha de conexão. Tente de novo.");
      }
    });
  };

  if (!ciclo) {
    return (
      <Card>
        <EmptyState icon={Trophy} title="Sem ciclo ativo" description="Crie um ciclo e metas com incentivo." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader dense eyebrow="INCENTIVO" title="Bônus por meta" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Elegível hoje" value={formatarValor(totais.elegiveisAgora, "moeda")}
          icon={Trophy} accent="purple" context="metas que já batem o gatilho" />
        <StatCard label="Previsto" value={formatarValor(totais.previsto, "moeda")}
          icon={Calculator} accent="blue" context="apurado, aguardando aprovação" />
        <StatCard label="Aprovado" value={formatarValor(totais.aprovado, "moeda")}
          icon={BadgeCheck} accent="orange" context="liberado para pagamento" />
        <StatCard label="Pago" value={formatarValor(totais.pago, "moeda")}
          icon={Wallet} accent="green" context="já quitado" />
      </div>

      <div className="flex items-center gap-2">
        {(["apuracao", "previsao"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={
              aba === a
                ? "rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                : "rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {a === "apuracao" ? "Apuração" : "Regras por meta"}
          </button>
        ))}
        {podeEditar && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={pendente}
            onClick={() =>
              acao(async () => {
                const r = await apurarIncentivos(ciclo.id);
                return r.success
                  ? { success: true as const }
                  : { success: false as const, error: r.error };
              }, "Apuração atualizada")
            }
          >
            <Calculator />
            Apurar agora
          </Button>
        )}
      </div>

      {aba === "apuracao" ? (
        apuracoes.length === 0 ? (
          <Card>
            <EmptyState
              icon={Calculator}
              title="Nada apurado ainda"
              description="Apurar congela o bônus das metas que já bateram o gatilho, por pessoa. O valor não muda depois — o realizado continua andando, o que foi aprovado não."
            />
          </Card>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Pessoa", "Meta", "Período", "Atingido", "Bônus", "Situação", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-label-tertiary">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apuracoes.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 text-xs font-medium text-foreground">
                      {a.user_profiles?.nome ?? "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {a.metas_corporativas?.titulo ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {a.metas_corporativas ? periodoLabel(a.metas_corporativas) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-foreground">
                      {Number(a.pct_atingido).toLocaleString("pt-BR")}%
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold tabular-nums text-foreground">
                      {formatarValor(Number(a.valor_apurado), "moeda")}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[a.status]} size="sm">{STATUS_LABEL[a.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {podeEditar && a.status === "previsto" && (
                        <Button variant="ghost" size="sm" disabled={pendente}
                          onClick={() => acao(() => mudarStatusApuracao({ id: a.id, status: "aprovado" }), "Aprovado")}>
                          Aprovar
                        </Button>
                      )}
                      {podeEditar && a.status === "aprovado" && (
                        <Button variant="ghost" size="sm" disabled={pendente}
                          onClick={() => acao(() => mudarStatusApuracao({ id: a.id, status: "pago" }), "Marcado como pago")}>
                          Marcar pago
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      ) : comIncentivo.length === 0 ? (
        <Card>
          <EmptyState
            icon={Trophy}
            title="Nenhuma meta com bônus"
            description="Configure o incentivo ao criar ou editar a meta, na aba Metas."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {comIncentivo.map((m) => (
            <Card key={m.id}>
              <p className="truncate text-sm font-medium text-foreground">{m.titulo}</p>
              <p className="mt-0.5 text-[11px] text-label-tertiary">{m.periodoLabel}</p>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Regra</dt>
                  <dd className="font-medium text-foreground">
                    {m.incentivo_tipo === "valor_fixo"
                      ? formatarValor(Number(m.incentivo_valor), "moeda")
                      : `${m.incentivo_valor}% do realizado`}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Gatilho</dt>
                  <dd className="font-medium text-foreground">{m.incentivo_gatilho_pct}% da meta</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Hoje</dt>
                  <dd className={m.bonusPrevisto > 0 ? "font-semibold text-sys-green" : "text-label-tertiary"}>
                    {m.bonusPrevisto > 0 ? formatarValor(m.bonusPrevisto, "moeda") : "ainda não elegível"}
                  </dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
