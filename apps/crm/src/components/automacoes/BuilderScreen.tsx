"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, ListChecks, Plus, Trash2, Workflow, X } from "lucide-react";

import { BrandTabs, Button, Card } from "@/components/ui";
import { ACAO_CATALOG, type AutomacaoAcaoTipo } from "@/types/automacao";

import { AcaoForm, CondicaoForm, GatilhoForm } from "./BuilderForms";
import {
  CONDICAO_CAMPOS,
  SECTION_LABEL,
  camposCondicaoDoGatilho,
  defaultAcao,
  type BuilderState,
  type UsuarioRow,
} from "./builder-shared";
import { FlowCanvas, type FlowSelection, type GhostMenu } from "./FlowCanvas";

/**
 * BuilderScreen — builder de automações em tela cheia (substitui o modal).
 * Duas visões sobre o MESMO estado (alternar nunca perde nada):
 * - Fluxo (default): canvas estilo n8n + painel lateral com o form do nó
 * - Formulário: os mesmos forms empilhados (gatilho → condições → ações)
 */

type BuilderView = "fluxo" | "formulario";

interface BuilderScreenProps {
  builder: BuilderState;
  usuarios: UsuarioRow[];
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
  isPending,
  onChange,
  onClose,
  onSave,
}: BuilderScreenProps) {
  const [view, setView] = useState<BuilderView>("fluxo");
  const [selection, setSelection] = useState<FlowSelection | null>(null);
  const [ghostMenu, setGhostMenu] = useState<GhostMenu>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Snapshot inicial p/ detectar mudanças (confirmação ao fechar)
  const inicialRef = useRef<string | null>(null);
  if (inicialRef.current === null) inicialRef.current = JSON.stringify(builder);
  const isDirty = useCallback(
    () => JSON.stringify(builder) !== inicialRef.current,
    [builder],
  );

  const requestClose = useCallback(() => {
    if (isDirty() && !window.confirm("Descartar as alterações desta automação?")) return;
    onClose();
  }, [isDirty, onClose]);

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
        { campo, operador: "eq", valor: info?.opcoes?.[0]?.value ?? "" },
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
  };

  const salvarDesabilitado = isPending || !builder.nome || builder.acoes.length === 0;
  const camposDisponiveis = camposCondicaoDoGatilho(builder.gatilho);

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
              builder.acoes.length === 0
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

      {/* Corpo */}
      <div className="relative flex min-h-0 flex-1">
        {view === "fluxo" ? (
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
          /* Visão Formulário — mesmos forms, empilhados (mesmo estado) */
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
              <section className="space-y-2">
                <p className={SECTION_LABEL}>1 · Gatilho</p>
                <GatilhoForm builder={builder} onChange={onChange} />
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className={SECTION_LABEL}>2 · Condições (opcional)</p>
                  {camposDisponiveis.length > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => addCondicao(camposDisponiveis[0].value)}
                    >
                      <Plus className="h-3 w-3" />
                      Condição
                    </Button>
                  )}
                </div>
                {builder.condicoes.length === 0 ? (
                  <p className="text-[10px] text-label-tertiary">
                    {builder.gatilho === "agendamento"
                      ? "Agendamento não tem condições — não há lead/deal no contexto do disparo."
                      : "Sem condições — dispara para todo evento do gatilho."}
                  </p>
                ) : (
                  builder.condicoes.map((_, i) => (
                    <CondicaoForm
                      key={i}
                      builder={builder}
                      index={i}
                      onChange={onChange}
                      onRemove={() => removeCondicao(i)}
                    />
                  ))
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className={SECTION_LABEL}>3 · Ações</p>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {(Object.keys(ACAO_CATALOG) as AutomacaoAcaoTipo[]).map((tipo) => (
                      <Button key={tipo} variant="secondary" size="sm" onClick={() => addAcao(tipo)}>
                        <Plus className="h-3 w-3" />
                        {ACAO_CATALOG[tipo].label}
                      </Button>
                    ))}
                  </div>
                </div>

                {builder.acoes.length === 0 && (
                  <p className="text-[10px] text-label-tertiary">
                    Adicione pelo menos uma ação — é o que a automação FAZ quando dispara.
                  </p>
                )}

                {builder.acoes.map((acao, i) => (
                  <Card key={i} variant="plain" padding="sm" className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <ChevronRight className="h-3 w-3 text-primary" />
                        {ACAO_CATALOG[acao.tipo].label}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Remover ação"
                        onClick={() => removeAcao(i)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <AcaoForm builder={builder} index={i} usuarios={usuarios} onChange={onChange} />
                  </Card>
                ))}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
