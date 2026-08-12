"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Compass,
  Flag,
  Gauge,
  Repeat,
  Target,
  Trophy,
} from "lucide-react";

import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { FarolBadge, MetaBar } from "@/components/planejamento/MetaBar";
import type { PlanejamentoCompleto } from "@/lib/actions/planejamento";
import {
  STATUS_LABEL,
  formatarValor,
  type MetaComProgresso,
  type Objetivo,
} from "@/lib/planejamento-tipos";
import { cn } from "@/lib/utils";

interface Rotina {
  id: string;
  nome: string;
  frequencia: string;
  ativa: boolean;
  proxima_em: string | null;
}

const FREQ_LABEL: Record<string, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  trimestral: "Trimestral",
};

/** Progresso do objetivo = média simples do atingimento das metas dele. */
function progressoObjetivo(objetivoId: string, metas: MetaComProgresso[]): number | null {
  const minhas = metas.filter((m) => m.objetivo_id === objetivoId && m.status === "ativa");
  if (!minhas.length) return null;
  const soma = minhas.reduce((s, m) => s + Math.min(100, m.pct) * m.peso, 0);
  const pesos = minhas.reduce((s, m) => s + m.peso, 0);
  return Math.round(soma / pesos);
}

export function PainelClient({
  plano,
  rotinas,
}: {
  plano: PlanejamentoCompleto;
  rotinas: Rotina[];
}) {
  const router = useRouter();
  const { ciclo, ciclos, objetivos, metas } = plano;

  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const mesAtual = agora.getMonth() + 1;

  const resumo = useMemo(() => {
    const ativas = metas.filter((m) => m.status === "ativa");
    return {
      ativas,
      doMes: ativas.filter(
        (m) => m.periodo_tipo === "mes" && m.ano === anoAtual && m.mes === mesAtual,
      ),
      noAlvo: ativas.filter((m) => m.farol === "verde").length,
      emRisco: ativas.filter((m) => m.farol === "vermelho").length,
      bonus: ativas.reduce((s, m) => s + m.bonusPrevisto, 0),
      media: ativas.length
        ? Math.round(ativas.reduce((s, m) => s + Math.min(100, m.pct), 0) / ativas.length)
        : 0,
    };
  }, [metas, anoAtual, mesAtual]);

  if (!ciclo) {
    return (
      <Card>
        <EmptyState
          icon={Compass}
          title="Nenhum ciclo estratégico criado"
          description="O planejamento começa por um ciclo de 3 anos: a janela, a visão e os objetivos que sustentam tudo o mais."
          action={
            <Link
              href="/planejamento/estrategico"
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
            >
              Criar ciclo
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        dense
        eyebrow="PLANEJAMENTO"
        title={ciclo.nome}
        actions={
          ciclos.length > 1 ? (
            <select
              aria-label="Trocar de ciclo"
              value={ciclo.id}
              onChange={(e) => router.push(`/planejamento?ciclo=${e.target.value}`)}
              className="h-8 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
            >
              {ciclos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {ciclo.visao && (
        <Card className="border-primary/20 bg-primary/5">
          <div className="flex gap-3">
            <Flag aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-eyebrow text-primary">VISÃO {ciclo.ano_inicio}–{ciclo.ano_fim}</p>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{ciclo.visao}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Metas no alvo"
          value={`${resumo.noAlvo}/${resumo.ativas.length}`}
          icon={Target}
          accent="green"
          context="atingimento ≥ 90%"
        />
        <StatCard
          label="Em risco"
          value={resumo.emRisco}
          icon={Flag}
          accent={resumo.emRisco > 0 ? "red" : "green"}
          context={resumo.emRisco > 0 ? "precisam de ação" : "nenhuma abaixo de 70%"}
        />
        <StatCard
          label="Atingimento médio"
          value={`${resumo.media}%`}
          icon={Gauge}
          accent="blue"
          context="média ponderada pelo peso"
        />
        <StatCard
          label="Bônus previsto"
          value={formatarValor(resumo.bonus, "moeda")}
          icon={Trophy}
          accent="purple"
          context="metas que já batem o gatilho"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <MetasDoMes metas={resumo.doMes} />
        <div className="space-y-4">
          <ObjetivosResumo objetivos={objetivos} metas={metas} />
          <RotinasResumo rotinas={rotinas} />
        </div>
      </div>
    </div>
  );
}

function MetasDoMes({ metas }: { metas: MetaComProgresso[] }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Metas deste mês</h2>
        <Link href="/planejamento/metas" className="text-xs font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </div>
      {metas.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma meta mensal para este mês"
          description="Crie metas mensais para acompanhar o ritmo sem esperar o fechamento do ano."
        />
      ) : (
        <ul className="space-y-3">
          {metas.map((m) => (
            <li key={m.id} className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{m.titulo}</p>
                  <p className="mt-0.5 text-[11px] text-label-tertiary">
                    {m.automatico ? "medida pelo sistema" : "lançamento manual"}
                    {m.bonusPrevisto > 0 && ` · bônus ${formatarValor(m.bonusPrevisto, "moeda")}`}
                  </p>
                </div>
                <FarolBadge farol={m.farol} />
              </div>
              <MetaBar meta={m} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ObjetivosResumo({
  objetivos,
  metas,
}: {
  objetivos: Objetivo[];
  metas: MetaComProgresso[];
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Objetivos do ciclo</h2>
        <Link
          href="/planejamento/estrategico"
          className="text-xs font-medium text-primary hover:underline"
        >
          Abrir
        </Link>
      </div>
      {objetivos.length === 0 ? (
        <p className="py-6 text-center text-xs text-label-tertiary">
          Nenhum objetivo cadastrado ainda.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {objetivos.map((o) => {
            const pct = progressoObjetivo(o.id, metas);
            return (
              <li key={o.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-medium text-foreground">{o.titulo}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {pct === null ? "—" : `${pct}%`}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      pct !== null && pct >= 90 ? "bg-sys-green"
                        : pct !== null && pct >= 70 ? "bg-sys-orange"
                        : pct !== null ? "bg-sys-red" : "bg-transparent",
                    )}
                    style={{ width: `${Math.min(100, pct ?? 0)}%` }}
                  />
                </div>
                <Badge tone="neutral" size="sm">{STATUS_LABEL[o.status]}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function RotinasResumo({ rotinas }: { rotinas: Rotina[] }) {
  const ativas = rotinas.filter((r) => r.ativa);
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Rotinas ativas</h2>
        <Link href="/planejamento/rotinas" className="text-xs font-medium text-primary hover:underline">
          Abrir
        </Link>
      </div>
      {ativas.length === 0 ? (
        <p className="py-6 text-center text-xs text-label-tertiary">
          Nenhuma rotina ativa. Sem cadência, meta vira intenção.
        </p>
      ) : (
        <ul className="space-y-2">
          {ativas.map((r) => (
            <li key={r.id} className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2">
              <Repeat aria-hidden className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">{r.nome}</span>
              <Badge tone="brand" size="sm">{FREQ_LABEL[r.frequencia] ?? r.frequencia}</Badge>
              {r.proxima_em && (
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-label-tertiary">
                  <CalendarClock aria-hidden className="size-3" />
                  {new Date(`${r.proxima_em}T12:00:00`).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
