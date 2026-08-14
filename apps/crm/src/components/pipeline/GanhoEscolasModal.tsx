"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Check, GraduationCap, Loader2, PartyPopper, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Input } from "@/components/ui";
import {
  getEscolasSugeridas,
  salvarShortlistEscolas,
  type EscolaSugerida,
} from "@/lib/actions/handoff-escolas";
import { cn } from "@/lib/utils";

/**
 * Abre logo depois do deal virar GANHO (Sinal pago).
 *
 * A jornada pós-venda começa em "Envio de opções": a shortlist é o primeiro
 * entregável da família e o que a Head precisa para trabalhar. Antes, a
 * família chegava na gestão dela sem nenhuma escola indicada.
 *
 * O deal JÁ avançou quando isto abre — fechar sem escolher não desfaz nada,
 * a shortlist pode ser montada depois em Matching.
 */

const PRIORIDADES = [
  { id: "primeira", label: "1ª opção", tom: "green" as const },
  { id: "segunda", label: "2ª opção", tom: "blue" as const },
  { id: "terceira", label: "3ª opção", tom: "purple" as const },
  { id: "safety", label: "Segurança", tom: "neutral" as const },
];

const TOM_CLASSIF: Record<string, "green" | "blue" | "orange" | "neutral"> = {
  excelente: "green",
  forte: "blue",
  possivel: "orange",
  fraco: "neutral",
};

export function GanhoEscolasModal({
  atletaId,
  athleteName,
  onClose,
}: {
  atletaId: string;
  athleteName: string;
  onClose: () => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const [escolas, setEscolas] = useState<EscolaSugerida[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [selecao, setSelecao] = useState<Record<string, string>>({});
  const [salvando, startSalvar] = useTransition();

  useEffect(() => {
    let vivo = true;
    getEscolasSugeridas(atletaId)
      .then((r) => {
        if (!vivo) return;
        if (r.success) {
          setEscolas(r.data);
          // Pré-marca o que já está na estratégia: reabrir o modal mostra o
          // estado real, em vez de parecer que nada foi escolhido.
          const jaEscolhidas: Record<string, string> = {};
          for (const e of r.data) if (e.jaEscolhida) jaEscolhidas[e.escolaId] = "segunda";
          setSelecao(jaEscolhidas);
        } else {
          setErro(r.error);
        }
      })
      .catch(() => vivo && setErro("Não foi possível carregar as sugestões."))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [atletaId]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", aoTeclar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const visiveis = escolas.filter((e) =>
    busca.trim().length < 2
      ? true
      : `${e.nome} ${e.estado ?? ""}`.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  const totalSelecionado = Object.keys(selecao).length;

  const alternar = (escolaId: string) => {
    setSelecao((atual) => {
      if (atual[escolaId]) {
        const { [escolaId]: _fora, ...resto } = atual;
        return resto;
      }
      // A ordem de clique sugere a prioridade — o CEO ajusta se quiser.
      const ordem = ["primeira", "segunda", "terceira", "safety"];
      const usados = new Set(Object.values(atual));
      const proxima = ordem.find((p) => !usados.has(p)) ?? "safety";
      return { ...atual, [escolaId]: proxima };
    });
  };

  const salvar = () => {
    const selecoes = Object.entries(selecao).map(([escolaId, prioridade]) => ({
      escolaId,
      prioridade,
    }));
    startSalvar(async () => {
      try {
        const r = await salvarShortlistEscolas({ atletaId, selecoes });
        if (r.success) {
          toast.success(`${r.data} escola(s) na estratégia de ${athleteName}`);
          onClose();
        } else {
          toast.error(r.error);
        }
      } catch {
        toast.error("Falha de conexão ao salvar.");
      }
    });
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Escolas sugeridas para ${athleteName}`}
          className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex min-w-0 gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sys-green/12 text-sys-green">
                <PartyPopper aria-hidden className="size-4.5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">
                  Contrato fechado — {athleteName}
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  A jornada da família começa no envio de opções. Escolha as escolas que a
                  Head vai trabalhar — dá para ajustar depois em Matching.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="border-b border-border px-5 py-2.5">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-label-tertiary" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Filtrar por nome ou estado…"
                aria-label="Filtrar escolas"
                className="pl-8"
              />
            </div>
          </div>

          <div className="crm-scroll min-h-0 flex-1 overflow-y-auto p-4">
            {carregando ? (
              <div className="flex items-center justify-center gap-2 py-14 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Calculando o match de cada escola…
              </div>
            ) : erro ? (
              <p className="rounded-lg border border-sys-red/25 bg-sys-red/8 px-3 py-2 text-xs text-sys-red">
                {erro}
              </p>
            ) : visiveis.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <GraduationCap aria-hidden className="size-8 text-label-tertiary" />
                <p className="text-xs text-muted-foreground">
                  {escolas.length === 0
                    ? "Nenhuma escola no banco casou com o perfil deste atleta."
                    : "Nenhuma escola corresponde ao filtro."}
                </p>
              </div>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {visiveis.map((e) => {
                  const escolhida = Boolean(selecao[e.escolaId]);
                  return (
                    <li key={e.escolaId}>
                      <button
                        type="button"
                        onClick={() => alternar(e.escolaId)}
                        aria-pressed={escolhida}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                          escolhida
                            ? "border-primary/40 bg-primary/5"
                            : "border-border hover:bg-accent",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                            escolhida
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input",
                          )}
                        >
                          {escolhida && <Check className="size-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-foreground">
                            {e.nome}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-label-tertiary">
                            {[e.estado, e.tipo].filter(Boolean).join(" · ") || "—"}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <Badge tone={TOM_CLASSIF[e.classificacao] ?? "neutral"} size="sm">
                              {e.score}% {e.classificacao}
                            </Badge>
                            {escolhida && (
                              <Badge
                                tone={PRIORIDADES.find((p) => p.id === selecao[e.escolaId])?.tom ?? "neutral"}
                                size="sm"
                              >
                                {PRIORIDADES.find((p) => p.id === selecao[e.escolaId])?.label}
                              </Badge>
                            )}
                          </span>
                        </span>
                      </button>

                      {escolhida && (
                        <div className="mt-1.5 flex flex-wrap gap-1 pl-7">
                          {PRIORIDADES.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() =>
                                setSelecao((a) => ({ ...a, [e.escolaId]: p.id }))
                              }
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                                selecao[e.escolaId] === p.id
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
            <p className="mr-auto text-[11px] text-label-tertiary">
              {totalSelecionado === 0
                ? "Nenhuma escola selecionada"
                : `${totalSelecionado} escola(s) selecionada(s)`}
            </p>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={salvando}>
              Escolher depois
            </Button>
            <Button size="sm" onClick={salvar} disabled={salvando || totalSelecionado === 0}>
              {salvando && <Loader2 className="animate-spin" />}
              Salvar shortlist
            </Button>
          </footer>
        </div>
      </div>
    </>,
    document.body,
  );
}
