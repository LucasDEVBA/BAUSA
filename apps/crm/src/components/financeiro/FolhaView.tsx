"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Pencil, Trash2, Wallet, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge, Card, EmptyState, ScrollList, StatCard, type BadgeTone } from "@/components/ui";
import { removerColaborador } from "@/lib/actions/colaboradores";
import { TIPO_CONTRATO_LABEL, type Colaborador } from "@/types/financeiro";
import { ColaboradorFormModal } from "./ColaboradorFormModal";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const TIPO_TONE: Record<Colaborador["tipo_contrato"], BadgeTone> = {
  clt: "blue",
  pj: "purple",
  socio: "burgundy",
  estagio: "neutral",
  outro: "neutral",
};

export function FolhaView({ colaboradores }: { colaboradores: Colaborador[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Colaborador | null>(null);

  const ativos = colaboradores.filter((c) => c.ativo);
  const folhaMensal = ativos.reduce((s, c) => s + c.custo_mensal_brl, 0);
  const custoMedio = ativos.length > 0 ? Math.round(folhaMensal / ativos.length) : 0;

  const openNew = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const openEdit = (c: Colaborador) => {
    setEditing(c);
    setSheetOpen(true);
  };

  const remover = (c: Colaborador) => {
    if (!window.confirm(`Remover ${c.nome} da folha?`)) return;
    startTransition(async () => {
      const result = await removerColaborador(c.id);
      if (result.success) {
        toast.success("Colaborador removido");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Folha mensal" value={formatBRL(folhaMensal)} icon={Wallet} accent="burgundy" context="custo total/mês" />
        <StatCard label="Colaboradores ativos" value={ativos.length} icon={UserCheck} accent="green" context={`${colaboradores.length} no total`} />
        <StatCard label="Custo médio" value={formatBRL(custoMedio)} icon={Users} accent="blue" context="por pessoa" />
      </div>

      <Card variant="plain" padding="none" className="flex h-[32rem] flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Colaboradores</h2>
            <p className="text-xs text-muted-foreground">Folha — custo mensal já com encargos</p>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Novo colaborador
          </button>
        </div>

        {colaboradores.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum colaborador na folha"
            description="Adicione as pessoas da equipe para compor o custo mensal da folha."
          />
        ) : (
          <ScrollList gutter={false} className="divide-y divide-border">
            {colaboradores.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{c.nome}</p>
                    <Badge tone={TIPO_TONE[c.tipo_contrato]} size="sm">
                      {TIPO_CONTRATO_LABEL[c.tipo_contrato]}
                    </Badge>
                    {!c.ativo && (
                      <Badge tone="neutral" size="sm">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  {c.cargo && <p className="truncate text-xs text-muted-foreground">{c.cargo}</p>}
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatBRL(c.custo_mensal_brl)}
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    aria-label={`Editar ${c.nome}`}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-fill-4 hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remover(c)}
                    disabled={isPending}
                    aria-label={`Remover ${c.nome}`}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-sys-red/10 hover:text-sys-red disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </ScrollList>
        )}
      </Card>

      <ColaboradorFormModal open={sheetOpen} onClose={() => setSheetOpen(false)} colaborador={editing} />
    </div>
  );
}
