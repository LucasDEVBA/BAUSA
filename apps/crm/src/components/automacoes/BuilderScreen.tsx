"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Clock,
  Diamond,
  GitBranch,
  ListChecks,
  Plus,
  Trash2,
  Workflow,
  X,
  Zap,
} from "lucide-react";

import { Badge, BrandTabs, Button, Card, useConfirm } from "@/components/ui";
import { ACAO_CATALOG, GATILHO_CATALOG, type AutomacaoAcaoTipo } from "@/types/automacao";
import type { AgentResumo } from "@/types/agent";
import { cn } from "@/lib/utils";

import { AcaoForm, CondicaoForm, GatilhoForm } from "./BuilderForms";
import { PassosBuilder } from "./PassosBuilder";
import {
  CONDICAO_CAMPOS,
  acaoPendencia,
  builderTemAcao,
  camposCondicaoDoGatilho,
  defaultAcao,
  resumoAcao,
  resumoAutomacao,
  type BuilderState,
  type UsuarioRow,
} from "./builder-shared";
import { ACAO_ICON, FlowCanvas, type FlowSelection, type GhostMenu } from "./FlowCanvas";

/**
 * BuilderScreen — builder de automações em tela cheia (substitui o modal).
 * Duas visões sobre o MESMO estado (alternar nunca perde nada):
 * - Fluxo (default): canvas estilo n8n + painel lateral com o form do nó
 * - Formulário: os mesmos forms empilhados (gatilho → condições → ações)
 */

type BuilderView = "fluxo" | "formulario" | "passos";

interface BuilderScreenProps {
  builder: BuilderState;
  usuarios: UsuarioRow[];
  /** Agents custom (capacidade `automacao`) p/ o seletor das ações de IA. */
  agents: AgentResumo[];
  isPending: boolean;
  onChange: (b: BuilderState) => void;
  onClose: () => void;
  onSave: () => void;
}

function tituloSelecao(sel: FlowSelection, builder: BuilderState): string {
  if (sel.kind === "gatilho") return "Gatilho";
  if (sel.kind === "condicao") return `Condição ${sel.index + 1}`;
  const acao = builder.acoes[sel.index];
  return acao ? `Ação ${sel.index + 1} · ${ACAO_CATALOG[acao.tipo].label}` : "Ação";
}

export function BuilderScreen({
  builder,
  usuarios,
  agents,
  isPending,
  onChange,
  onClose,
  onSave,
}: BuilderScreenProps) {
  const confirm = useConfirm();
  // Automação já em modo por passos abre direto na visão Passos.
  const [view, setView] = useState<BuilderView>(builder.passos.length > 0 ? "passos" : "fluxo");
  const [selection, setSelection] = useState<FlowSelection | null>(null);
  const [ghostMenu, setGhostMenu] = useState<GhostMenu>(null);
  /** Ação expandida na visão Fluxo vertical (formulário) — null = todas recolhidas. */
  const [acaoAberta, setAcaoAberta] = useState<number | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Snapshot inicial p/ detectar mudanças (confirmação ao fechar)
  const inicialRef = useRef<string | null>(null);
  if (inicialRef.current === null) inicialRef.current = JSON.stringify(builder);
  const isDirty = useCallback(
    () => JSON.stringify(builder) !== inicialRef.current,
    [builder],
  );

  const requestClose = useCallback(async () => {
    if (
      isDirty() &&
      !(await confirm({
        title: "Descartar alterações?",
        description: "As alterações não salvas desta automação serão perdidas.",
        confirmLabel: "Descartar",
        tone: "danger",
      }))
    )
      return;
    onClose();
  }, [isDirty, onClose, confirm]);

  // ESC: fecha menu fantasma → painel lateral → (com confirmação) o builder
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (ghostMenu) {
        setGhostMenu(null);
        return;
      }
      if (selection) {
        setSelection(null);
        return;
      }
      requestClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [ghostMenu, selection, requestClose]);

  // Tela cheia: trava o scroll da página atrás
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  // Painel lateral recebe foco ao abrir (a11y)
  useEffect(() => {
    if (selection) panelRef.current?.focus();
  }, [selection]);

  // ─── Mutações (compartilhadas pelas duas visões) ───────────────────────────

  const addCondicao = (campo: string) => {
    const info = CONDICAO_CAMPOS.find((c) => c.value === campo);
    const next: BuilderState = {
      ...builder,
      condicoes: [
        ...builder.condicoes,
        // Campo numérico (ex.: nota NPS) nasce com 0 — o Zod exige number/string≥1
        { campo, operador: "eq", valor: info?.opcoes?.[0]?.value ?? (info?.tipo === "numero" ? 0 : "") },
      ],
    };
    onChange(next);
    setGhostMenu(null);
    setSelection({ kind: "condicao", index: next.condicoes.length - 1 });
  };

  const addAcao = (tipo: AutomacaoAcaoTipo) => {
    const next: BuilderState = { ...builder, acoes: [...builder.acoes, defaultAcao(tipo, usuarios)] };
    onChange(next);
    setGhostMenu(null);
    setSelection({ kind: "acao", index: next.acoes.length - 1 });
    setAcaoAberta(next.acoes.length - 1); // nova ação abre para edição na visão vertical
  };

  /** Reordena a ação i com a vizinha (setas ↑/↓ do card na visão vertical). */
  const moveAcao = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= builder.acoes.length) return;
    const acoes = [...builder.acoes];
    [acoes[i], acoes[j]] = [acoes[j], acoes[i]];
    onChange({ ...builder, acoes });
    setAcaoAberta((cur) => (cur === i ? j : cur === j ? i : cur));
    setSelection((sel) => {
      if (sel?.kind !== "acao") return sel;
      if (sel.index === i) return { kind: "acao", index: j };
      if (sel.index === j) return { kind: "acao", index: i };
      return sel;
    });
  };

  const removeCondicao = (i: number) => {
    onChange({ ...builder, condicoes: builder.condicoes.filter((_, idx) => idx !== i) });
    setSelection((sel) => {
      if (sel?.kind !== "condicao") return sel;
      if (sel.index === i) return null;
      return sel.index > i ? { kind: "condicao", index: sel.index - 1 } : sel;
    });
  };

  const removeAcao = (i: number) => {
    onChange({ ...builder, acoes: builder.acoes.filter((_, idx) => idx !== i) });
    setSelection((sel) => {
      if (sel?.kind !== "acao") return sel;
      if (sel.index === i) return null;
      return sel.index > i ? { kind: "acao", index: sel.index - 1 } : sel;
    });
    setAcaoAberta((cur) => {
      if (cur === null) return null;
      if (cur === i) return null;
      return cur > i ? cur - 1 : cur;
    });
  };

  const temAcao = builderTemAcao(builder);
  const salvarDesabilitado = isPending || !builder.nome || !temAcao;
  const camposDisponiveis = camposCondicaoDoGatilho(builder.gatilho);
  // Modo por passos ativo: o modelo simples (Fluxo/Formulário) fica inativo.
  const passosMode = builder.passos.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={builder.id ? "Editar automação" : "Nova automação"}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Header compacto */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-card px-4 py-2.5 md:px-6">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-label-tertiary">
            {builder.id ? "Editar automação" : "Nova automação"}
          </p>
          <input
            aria-label="Nome da automação"
            placeholder="Nome da automação (ex.: Régua D-3 — lembrete de parcela)"
            className="w-full bg-transparent text-base font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-placeholder"
            value={builder.nome}
            onChange={(e) => onChange({ ...builder, nome: e.target.value })}
          />
          <input
            aria-label="Descrição da automação"
            placeholder="Descrição (opcional)"
            className="w-full bg-transparent text-xs text-muted-foreground outline-none placeholder:text-placeholder"
            value={builder.descricao}
            onChange={(e) => onChange({ ...builder, descricao: e.target.value })}
          />
        </div>

        <BrandTabs
          variant="segmented"
          items={[
            { id: "fluxo", label: "Fluxo", icon: Workflow },
            { id: "formulario", label: "Formulário", icon: ListChecks },
            { id: "passos", label: "Passos", icon: GitBranch },
          ]}
          activeId={view}
          onSelect={(id) => setView(id as BuilderView)}
          ariaLabel="Visão do builder"
        />

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" onClick={requestClose}>
            Cancelar
          </Button>
          <Button
            onClick={onSave}
            disabled={salvarDesabilitado}
            title={
              !temAcao
                ? "Adicione pelo menos uma ação"
                : !builder.nome
                  ? "Dê um nome à automação"
                  : undefined
            }
          >
            {builder.id ? "Salvar alterações" : "Criar automação"}
          </Button>
        </div>
      </header>

      {/* Aviso: modo por passos ativo, mas o CEO está numa visão do modo simples */}
      {passosMode && view !== "passos" && (
        <div className="shrink-0 border-b border-border bg-sys-orange/10 px-4 py-2 md:px-6">
          <p className="text-[11px] leading-relaxed text-foreground">
            Esta automação usa o <strong>fluxo avançado (Passos)</strong> — edite na aba{" "}
            <strong>Passos</strong>. As condições e ações do modo simples abaixo estão{" "}
            <strong>inativas</strong> (serão descartadas ao salvar).{" "}
            <button
              type="button"
              onClick={() => setView("passos")}
              className="font-semibold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ir para Passos
            </button>
          </p>
        </div>
      )}

      {/* Corpo */}
      <div className="relative flex min-h-0 flex-1">
        {view === "passos" ? (
          <PassosBuilder builder={builder} usuarios={usuarios} agents={agents} onChange={onChange} />
        ) : view === "fluxo" ? (
          <>
            <FlowCanvas
              builder={builder}
              selection={selection}
              onSelect={(sel) => {
                setGhostMenu(null);
                setSelection(sel);
              }}
              ghostMenu={ghostMenu}
              onGhostMenu={setGhostMenu}
              onAddCondicao={addCondicao}
              onAddAcao={addAcao}
              onRemoveCondicao={removeCondicao}
              onRemoveAcao={removeAcao}
            />

            {/* Painel lateral — form do nó selecionado */}
            {selection && (
              <aside
                ref={panelRef}
                role="dialog"
                aria-label={`Editar ${tituloSelecao(selection, builder)}`}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[360px] flex-col border-l border-border bg-card shadow-xl outline-none"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {tituloSelecao(selection, builder)}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Fechar painel"
                    onClick={() => setSelection(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                  {selection.kind === "gatilho" && (
                    <GatilhoForm builder={builder} onChange={onChange} />
                  )}
                  {selection.kind === "condicao" && (
                    <CondicaoForm builder={builder} index={selection.index} onChange={onChange} />
                  )}
                  {selection.kind === "acao" && (
                    <AcaoForm
                      builder={builder}
                      index={selection.index}
                      usuarios={usuarios}
                      agents={agents}
                      onChange={onChange}
                    />
                  )}
                </div>

                {selection.kind !== "gatilho" && (
                  <div className="border-t border-border p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-sys-red"
                      onClick={() =>
                        selection.kind === "condicao"
                          ? removeCondicao(selection.index)
                          : removeAcao(selection.index)
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remover {selection.kind === "condicao" ? "condição" : "ação"}
                    </Button>
                  </div>
                )}
              </aside>
            )}
          </>
        ) : (
          /* Visão Formulário — FLUXO VERTICAL: 3 blocos numerados e conectados
             (Gatilho → Condições → Ações), mesmos forms/estado da visão canvas. */
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl p-4 md:p-6">
              <FlowStep
                numero={1}
                icon={GATILHO_CATALOG[builder.gatilho].origem === "evento" ? Zap : Clock}
                titulo="Gatilho"
                descricao="Quando isto acontecer…"
              >
                <Card variant="plain" padding="sm">
                  <GatilhoForm builder={builder} onChange={onChange} />
                </Card>
              </FlowStep>

              <FlowStep
                numero={2}
                icon={Diamond}
                titulo="Condições (opcional)"
                descricao="…e todas estas condições valerem (E)…"
              >
                {builder.condicoes.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {camposDisponiveis.length === 0
                      ? "Este gatilho não tem condições — não há campos de contexto filtráveis."
                      : "Sem condições — dispara para todo evento do gatilho."}
                  </p>
                )}
                {builder.condicoes.map((_, i) => (
                  <Card key={i} variant="plain" padding="sm">
                    <CondicaoForm
                      builder={builder}
                      index={i}
                      onChange={onChange}
                      onRemove={() => removeCondicao(i)}
                    />
                  </Card>
                ))}
                {camposDisponiveis.length > 0 && (
                  <button
                    type="button"
                    onClick={() => addCondicao(camposDisponiveis[0].value)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-card/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus aria-hidden className="h-3.5 w-3.5" />
                    Adicionar condição
                  </button>
                )}
              </FlowStep>

              <FlowStep
                numero={3}
                icon={ListChecks}
                titulo="Ações"
                descricao="…então a automação faz isto (na ordem dos cards)."
                ultima
              >
                {builder.acoes.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Adicione pelo menos uma ação — é o que a automação FAZ quando dispara.
                  </p>
                )}

                {builder.acoes.map((acao, i) => {
                  const Icon = ACAO_ICON[acao.tipo];
                  const pendencia = acaoPendencia(acao);
                  const aberta = acaoAberta === i;
                  return (
                    <Card key={i} variant="plain" padding="sm" className="space-y-0">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <button
                          type="button"
                          aria-expanded={aberta}
                          aria-label={`Ação ${i + 1}: ${ACAO_CATALOG[acao.tipo].label} — ${
                            aberta ? "recolher" : "editar"
                          }`}
                          onClick={() => setAcaoAberta(aberta ? null : i)}
                          className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <p className="text-xs font-semibold text-foreground">
                            {ACAO_CATALOG[acao.tipo].label}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {resumoAcao(acao)}
                          </p>
                        </button>
                        {pendencia && !aberta && (
                          <Badge tone="orange" size="sm">
                            Incompleta
                          </Badge>
                        )}
                        <div className="flex shrink-0 items-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Mover ação ${i + 1} para cima`}
                            disabled={i === 0}
                            onClick={() => moveAcao(i, -1)}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Mover ação ${i + 1} para baixo`}
                            disabled={i === builder.acoes.length - 1}
                            onClick={() => moveAcao(i, 1)}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={aberta ? `Recolher ação ${i + 1}` : `Editar ação ${i + 1}`}
                            onClick={() => setAcaoAberta(aberta ? null : i)}
                          >
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 transition-transform",
                                aberta ? "rotate-180" : "rotate-0",
                              )}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Remover ação ${i + 1}`}
                            onClick={() => removeAcao(i)}
                          >
                            <X className="h-3.5 w-3.5 text-sys-red" />
                          </Button>
                        </div>
                      </div>
                      {aberta && (
                        <div className="mt-2 space-y-2 border-t border-border pt-3">
                          <AcaoForm
                            builder={builder}
                            index={i}
                            usuarios={usuarios}
                            agents={agents}
                            onChange={onChange}
                          />
                          {pendencia && (
                            <p className="text-[11px] font-medium text-sys-red">{pendencia}</p>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}

                {/* Adicionar ação — todos os tipos do catálogo, com descrição */}
                <div className="rounded-xl border border-dashed border-border bg-card/60 p-3">
                  <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                    Adicionar ação
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {(Object.keys(ACAO_CATALOG) as AutomacaoAcaoTipo[]).map((tipo) => {
                      const Icon = ACAO_ICON[tipo];
                      return (
                        <button
                          key={tipo}
                          type="button"
                          onClick={() => addAcao(tipo)}
                          className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Icon aria-hidden className="h-3 w-3" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-foreground">
                              {ACAO_CATALOG[tipo].label}
                            </span>
                            <span className="block text-[11px] leading-snug text-muted-foreground">
                              {ACAO_CATALOG[tipo].descricao}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </FlowStep>
            </div>
          </div>
        )}
      </div>

      {/* Resumo em linguagem natural — atualizado ao vivo (as duas visões) */}
      <footer className="border-t border-border bg-card px-4 py-2 md:px-6">
        <p aria-live="polite" className="text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground/80">Resumo: </span>
          {resumoAutomacao(builder)}
        </p>
      </footer>
    </div>
  );
}

/** Bloco do fluxo vertical: rail com círculo numerado + conector, título com
 *  ícone e conteúdo. `ultima` omite o conector abaixo do círculo. */
function FlowStep({
  numero,
  icon: Icon,
  titulo,
  descricao,
  ultima,
  children,
}: {
  numero: number;
  icon: typeof Zap;
  titulo: string;
  descricao: string;
  ultima?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="relative flex gap-3">
      <div aria-hidden className="flex flex-col items-center">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {numero}
        </span>
        {!ultima && <span className="my-1 w-px flex-1 bg-border" />}
      </div>
      <div className={cn("min-w-0 flex-1 space-y-2", ultima ? "pb-2" : "pb-6")}>
        <div className="flex items-center gap-1.5 pt-1">
          <Icon aria-hidden className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-foreground">
            {titulo}
          </h3>
          <span className="text-[11px] text-muted-foreground">· {descricao}</span>
        </div>
        {children}
      </div>
    </section>
  );
}
