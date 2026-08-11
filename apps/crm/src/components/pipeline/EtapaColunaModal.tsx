"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bot,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Settings2,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, EmptyState, Skeleton } from "@/components/ui";
import { SeusAgentsSection } from "@/components/agents/SeusAgentsSection";
import { BuilderScreen } from "@/components/automacoes/BuilderScreen";
import {
  builderFromAutomacao,
  builderParaInput,
  emptyBuilder,
  type BuilderState,
} from "@/components/automacoes/builder-shared";
import {
  alternarAtivoAutomacao,
  atualizarAutomacao,
  criarAutomacao,
} from "@/lib/actions/automacoes-builder";
import {
  carregarContextoColuna,
  salvarEtapaPipeline,
  type ContextoColuna,
} from "@/lib/actions/etapas-pipeline";
import {
  ETAPA_ACCENTS,
  ETAPA_ACCENT_DOT,
  ETAPA_ACCENT_LABEL,
  ETAPA_DEAL_LABEL_MAX,
  type DealStageConfigMap,
  type EtapaDealAccent,
} from "@/lib/etapas-deal";
import type { DealStage } from "@/types/deal";
import { cn } from "@/lib/utils";

/**
 * Modal da COLUNA do Kanban (estilo Trello): clicar no nome da coluna abre
 * aqui. Três abas sobre a mesma etapa:
 *   • Coluna     — rótulo, cor, probabilidade, ocultar (etapas_deal_config)
 *   • Automações — as que já disparam nesta coluna (gatilho deal_etapa_mudou
 *                  + etapa_para) e criação pré-configurada com esse gatilho
 *   • Agents     — CRUD dos agents de automação (o mesmo de /agents)
 *
 * Tudo que é criado aqui continua aparecendo em /automacoes e /agents — não há
 * schema paralelo: o vínculo com a coluna É o gatilho da automação.
 *
 * Renderizado via portal no <body>: a coluna vive dentro do board com
 * overflow/transform, que prendem `position: fixed` (mesma lição do modal de
 * aprovações).
 */

type Aba = "coluna" | "automacoes" | "agents";

interface EtapaColunaModalProps {
  stage: DealStage;
  stageConfig: DealStageConfigMap;
  probabilidade: number | null;
  onClose: () => void;
}

export function EtapaColunaModal({
  stage,
  stageConfig,
  probabilidade,
  onClose,
}: EtapaColunaModalProps) {
  const router = useRouter();
  const config = stageConfig[stage];

  const [aba, setAba] = useState<Aba>("coluna");
  const [ctx, setCtx] = useState<ContextoColuna | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [pending, startTransition] = useTransition();

  // Aba Coluna
  const [label, setLabel] = useState(config.label);
  const [accent, setAccent] = useState<EtapaDealAccent | "">(
    (ETAPA_ACCENTS.find((a) => ETAPA_ACCENT_DOT[a] === config.dotColor) ?? "") as EtapaDealAccent | "",
  );
  const [oculta, setOculta] = useState(config.oculta);
  const [prob, setProb] = useState<string>(probabilidade === null ? "" : String(probabilidade));

  // Builder de automação (tela cheia própria) — o modal se esconde enquanto ele está aberto
  const [builder, setBuilder] = useState<BuilderState | null>(null);

  const carregar = useCallback(async () => {
    const r = await carregarContextoColuna(stage);
    if (r.success) setCtx(r.data);
    else toast.error(r.error);
    setCarregando(false);
  }, [stage]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !builder) onClose();
    };
    window.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [onClose, builder]);

  const salvarColuna = () => {
    startTransition(async () => {
      const r = await salvarEtapaPipeline({
        stage,
        label,
        accent,
        oculta,
        probabilidade: prob.trim() === "" ? null : Number(prob),
      });
      if (r.success) {
        toast.success("Coluna atualizada");
        router.refresh();
        onClose();
      } else {
        toast.error(r.error);
      }
    });
  };

  const salvarBuilder = () => {
    if (!builder) return;
    startTransition(async () => {
      // Montagem CANÔNICA (mesma da tela /automacoes): preserva o gatilho real
      // — editar uma automação de tempo (D+N da cadência) pela coluna não pode
      // convertê-la em gatilho de evento nem perder o `dias`.
      const input = builderParaInput(builder);
      const r = builder.id
        ? await atualizarAutomacao(builder.id, input)
        : await criarAutomacao(input);
      if (r.success) {
        toast.success(builder.id ? "Automação atualizada" : "Automação criada (pausada)");
        setBuilder(null);
        setCarregando(true);
        void carregar();
        router.refresh();
      } else {
        toast.error(r.error ?? "Não foi possível salvar a automação.");
      }
    });
  };

  const alternarAtivo = (id: string, ativo: boolean) => {
    startTransition(async () => {
      const r = await alternarAtivoAutomacao(id, ativo);
      if (r.success) {
        setCtx((c) =>
          c ? { ...c, automacoes: c.automacoes.map((a) => (a.id === id ? { ...a, ativo } : a)) } : c,
        );
        toast.success(ativo ? "Automação ativada" : "Automação pausada");
        router.refresh();
      } else {
        toast.error(r.error ?? "Não foi possível alterar.");
      }
    });
  };

  const automacoes = ctx?.automacoes ?? [];
  const ativas = useMemo(() => automacoes.filter((a) => a.ativo).length, [automacoes]);

  // Builder aberto: entrega a tela cheia dele (o modal volta ao fechar)
  if (builder) {
    return createPortal(
      <div className="fixed inset-0 z-[110]">
        <BuilderScreen
          builder={builder}
          usuarios={ctx?.usuarios ?? []}
          agents={ctx?.agents ?? []}
          isPending={pending}
          onChange={setBuilder}
          onClose={() => setBuilder(null)}
          onSave={salvarBuilder}
        />
      </div>,
      document.body,
    );
  }

  const conteudo = (
    <>
      <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Coluna ${config.label}`}
          className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={cn("size-2.5 shrink-0 rounded-full", config.dotColor)} aria-hidden />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-foreground">{config.label}</h2>
                <p className="text-xs text-muted-foreground">
                  Coluna do pipeline · {automacoes.length} automação(ões){ativas > 0 ? ` · ${ativas} ativa(s)` : ""}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar" autoFocus>
              <X />
            </Button>
          </div>

          {/* Abas */}
          <div className="flex shrink-0 gap-1 border-b border-border px-3 py-2">
            {([
              { id: "coluna" as const, label: "Coluna", icon: Settings2 },
              { id: "automacoes" as const, label: "Automações", icon: Workflow },
              { id: "agents" as const, label: "Agents", icon: Bot },
            ]).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setAba(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  aba === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Corpo */}
          <div className="crm-scroll min-h-0 flex-1 overflow-y-auto p-5">
            {aba === "coluna" && (
              <div className="space-y-5">
                <div>
                  <label htmlFor="etapa-label" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Nome da coluna
                  </label>
                  <input
                    id="etapa-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    maxLength={ETAPA_DEAL_LABEL_MAX}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="mt-1 text-[11px] text-label-tertiary">
                    Só o rótulo muda — o histórico, os relatórios e as automações continuam
                    apontando para a mesma etapa.
                  </p>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Cor</p>
                  <div className="flex flex-wrap gap-2">
                    {ETAPA_ACCENTS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAccent(a)}
                        aria-pressed={accent === a}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                          accent === a
                            ? "border-primary bg-primary/5 font-medium text-foreground"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        <span className={cn("size-2.5 rounded-full", ETAPA_ACCENT_DOT[a])} aria-hidden />
                        {ETAPA_ACCENT_LABEL[a]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="etapa-prob" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Probabilidade de fechamento (%)
                    </label>
                    <input
                      id="etapa-prob"
                      type="number"
                      min={0}
                      max={100}
                      value={prob}
                      onChange={(e) => setProb(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <p className="mt-1 text-[11px] text-label-tertiary">
                      Aplicada ao deal quando ele entra nesta coluna.
                    </p>
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Visibilidade</p>
                    <button
                      type="button"
                      onClick={() => setOculta((v) => !v)}
                      className={cn(
                        "inline-flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        oculta
                          ? "border-sys-orange/30 bg-sys-orange/10 text-sys-orange"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {oculta ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      {oculta ? "Oculta no board" : "Visível no board"}
                    </button>
                    <p className="mt-1 text-[11px] text-label-tertiary">
                      Uma coluna oculta só desaparece quando fica vazia — nenhum deal é escondido.
                    </p>
                  </div>
                </div>

                <p className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  Para mudar a <strong>posição</strong>, arraste a coluna pelo cabeçalho direto no board.
                </p>
              </div>
            )}

            {aba === "automacoes" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Disparam quando um deal <strong>entra nesta coluna</strong>. Toda automação criada
                    aqui também aparece em Automações.
                  </p>
                  <Button
                    size="sm"
                    disabled={pending || carregando}
                    onClick={() =>
                      setBuilder({
                        ...emptyBuilder(),
                        gatilho: "deal_etapa_mudou",
                        gatilhoEtapaPara: stage,
                        nome: `Ao entrar em ${config.label}`,
                      })
                    }
                  >
                    <Plus />
                    Nova automação
                  </Button>
                </div>

                {carregando ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-2/3" />
                  </div>
                ) : automacoes.length === 0 ? (
                  <EmptyState
                    icon={Workflow}
                    title="Nenhuma automação nesta coluna"
                    description="Crie uma para disparar tarefas, mensagens ou IA assim que um deal chegar aqui."
                  />
                ) : (
                  <ul className="space-y-2">
                    {automacoes.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground">{a.nome}</p>
                            <Badge tone={a.ativo ? "green" : "neutral"} size="sm">
                              {a.ativo ? "Ativa" : "Pausada"}
                            </Badge>
                          </div>
                          {a.descricao && (
                            <p className="truncate text-[11px] text-muted-foreground">{a.descricao}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => alternarAtivo(a.id, !a.ativo)}
                          aria-label={a.ativo ? "Pausar automação" : "Ativar automação"}
                        >
                          {a.ativo ? <Pause /> : <Play />}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={pending}
                          onClick={() => setBuilder(builderFromAutomacao(a))}
                        >
                          <Pencil />
                          Editar
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <a
                  href="/automacoes"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Ver todas as automações
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}

            {aba === "agents" && (
              <div className="space-y-3">
                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                  <Sparkles aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  Agents com a capacidade <strong>automação</strong> podem ser usados nas ações de IA
                  das automações desta coluna. São os mesmos da tela Agents.
                </p>
                {carregando ? (
                  <div className="space-y-2">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <SeusAgentsSection agents={ctx?.agentsCompletos ?? []} />
                )}
              </div>
            )}
          </div>

          {/* Rodapé (só a aba Coluna salva) */}
          {aba === "coluna" && (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border p-4">
              <Button variant="ghost" size="md" disabled={pending} onClick={onClose}>
                Cancelar
              </Button>
              <Button size="md" disabled={pending || label.trim().length === 0} onClick={salvarColuna}>
                {pending ? <Loader2 className="animate-spin" /> : null}
                Salvar coluna
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(conteudo, document.body);
}
