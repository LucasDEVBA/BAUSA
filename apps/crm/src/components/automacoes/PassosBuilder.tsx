"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Diamond, Plus, Sparkles, X } from "lucide-react";

import { Badge, Button, Card, Input } from "@/components/ui";
import {
  ACAO_CATALOG,
  type AutomacaoAcao,
  type AutomacaoAcaoTipo,
  type AutomacaoCondicao,
  type AutomacaoPasso,
  PASSO_CATALOG,
  type AutomacaoPassoTipo,
} from "@/types/automacao";
import type { AgentResumo } from "@/types/agent";
import { cn } from "@/lib/utils";

import { AcaoFields, CondicaoFields } from "./BuilderForms";
import { ACAO_ICON } from "./FlowCanvas";
import {
  IA_CONDICAO_PROMPT_MAX,
  IA_CONDICAO_PROMPT_MIN,
  IA_CONDICAO_ROTULO_MAX,
  PASSOS_IA_MAX,
  PASSOS_MAX,
  WHATSAPP_CUSTOM_VARIAVEIS,
  camposCondicaoDoGatilho,
  contarPassosIA,
  defaultPasso,
  passoPendencia,
  resumoPasso,
  type BuilderState,
  type PassoNovoTipo,
  type UsuarioRow,
} from "./builder-shared";

/**
 * PassosBuilder — editor do FLUXO AVANÇADO (passos ordenados). Intercala
 * condições, condições-IA (ia_condicao) e ações em qualquer ordem numa lista
 * reordenável. Reusa os mesmos forms do modo simples (CondicaoFields/AcaoFields).
 * Quando `builder.passos` é não-vazio, a automação roda por passos (o modo
 * simples fica inativo — a engine ignora condicoes/acoes).
 */

const PASSO_TIPO_TONE: Record<AutomacaoPassoTipo, "blue" | "purple" | "brand"> = {
  condicao: "blue",
  ia_condicao: "purple",
  acao: "brand",
};

function PassoIcon({ passo, className }: { passo: AutomacaoPasso; className?: string }) {
  if (passo.tipo === "condicao") return <Diamond aria-hidden className={className} />;
  if (passo.tipo === "ia_condicao") return <Sparkles aria-hidden className={className} />;
  const Icon = ACAO_ICON[passo.acao.tipo];
  return <Icon aria-hidden className={className} />;
}

export function PassosBuilder({
  builder,
  usuarios,
  agents,
  onChange,
}: {
  builder: BuilderState;
  usuarios: UsuarioRow[];
  /** Agents custom (capacidade `automacao`) p/ os seletores dos passos de IA. */
  agents: AgentResumo[];
  onChange: (b: BuilderState) => void;
}) {
  const [aberto, setAberto] = useState<number | null>(null);

  const passos = builder.passos;
  const cheio = passos.length >= PASSOS_MAX;
  const iaCheio = contarPassosIA(passos) >= PASSOS_IA_MAX;
  const suportaCondicao = camposCondicaoDoGatilho(builder.gatilho).length > 0;

  const setPassos = (next: AutomacaoPasso[]) => onChange({ ...builder, passos: next });

  const addPasso = (kind: PassoNovoTipo, acaoTipo?: AutomacaoAcaoTipo) => {
    if (cheio) return;
    const next = [...passos, defaultPasso(kind, builder.gatilho, usuarios, acaoTipo)];
    setPassos(next);
    setAberto(next.length - 1); // novo passo abre para edição
  };

  const updatePasso = (i: number, passo: AutomacaoPasso) => {
    setPassos(passos.map((p, idx) => (idx === i ? passo : p)));
  };

  const removePasso = (i: number) => {
    setPassos(passos.filter((_, idx) => idx !== i));
    setAberto((cur) => (cur === null ? null : cur === i ? null : cur > i ? cur - 1 : cur));
  };

  const movePasso = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= passos.length) return;
    const next = [...passos];
    [next[i], next[j]] = [next[j], next[i]];
    setPassos(next);
    setAberto((cur) => (cur === i ? j : cur === j ? i : cur));
  };

  /** Converte o que já existe no modo simples em passos (condições → ações). */
  const importarModoSimples = () => {
    const importados: AutomacaoPasso[] = [
      ...builder.condicoes.map((c): AutomacaoPasso => ({ tipo: "condicao", condicao: c })),
      ...builder.acoes.map((a): AutomacaoPasso => ({ tipo: "acao", acao: a })),
    ];
    setPassos(importados.slice(0, PASSOS_MAX));
    setAberto(null);
  };

  const podeImportar = passos.length === 0 && (builder.condicoes.length > 0 || builder.acoes.length > 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-3 p-4 md:p-6">
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-foreground">
            Fluxo avançado — passos na ordem que você quiser
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Intercale <strong>condições</strong>, <strong>condições por IA</strong> (a IA decide
            SIM/NÃO para ramificar) e <strong>ações</strong>. A automação executa de cima para
            baixo — o fluxo <strong>para</strong> na primeira condição (ou decisão da IA) que não
            passar. Enquanto houver passos, o modo simples fica inativo.
          </p>
          {podeImportar && (
            <Button variant="secondary" size="sm" className="mt-2" onClick={importarModoSimples}>
              <Plus className="h-3 w-3" />
              Importar do modo simples ({builder.condicoes.length} cond. + {builder.acoes.length} ações)
            </Button>
          )}
        </div>

        {passos.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Nenhum passo ainda — comece adicionando uma condição, uma condição por IA ou uma ação.
          </p>
        )}

        {passos.map((passo, i) => {
          const abertoAqui = aberto === i;
          const pendencia = passoPendencia(passo);
          const tipoLabel = PASSO_CATALOG[passo.tipo].label;
          return (
            <div key={i} className="relative flex gap-3">
              <div aria-hidden className="flex flex-col items-center pt-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {i + 1}
                </span>
                {i < passos.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
              </div>

              <Card variant="plain" padding="sm" className="min-w-0 flex-1 space-y-0">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                  >
                    <PassoIcon passo={passo} className="h-3.5 w-3.5" />
                  </span>
                  <button
                    type="button"
                    aria-expanded={abertoAqui}
                    aria-label={`Passo ${i + 1}: ${tipoLabel} — ${abertoAqui ? "recolher" : "editar"}`}
                    onClick={() => setAberto(abertoAqui ? null : i)}
                    className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex items-center gap-1.5">
                      <Badge tone={PASSO_TIPO_TONE[passo.tipo]} size="sm">
                        {tipoLabel}
                      </Badge>
                    </span>
                    <p className="truncate text-[11px] text-muted-foreground">{resumoPasso(passo)}</p>
                  </button>
                  {pendencia && !abertoAqui && (
                    <Badge tone="orange" size="sm">
                      Incompleto
                    </Badge>
                  )}
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Mover passo ${i + 1} para cima`}
                      disabled={i === 0}
                      onClick={() => movePasso(i, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Mover passo ${i + 1} para baixo`}
                      disabled={i === passos.length - 1}
                      onClick={() => movePasso(i, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={abertoAqui ? `Recolher passo ${i + 1}` : `Editar passo ${i + 1}`}
                      onClick={() => setAberto(abertoAqui ? null : i)}
                    >
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          abertoAqui ? "rotate-180" : "rotate-0",
                        )}
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remover passo ${i + 1}`}
                      onClick={() => removePasso(i)}
                    >
                      <X className="h-3.5 w-3.5 text-sys-red" />
                    </Button>
                  </div>
                </div>

                {abertoAqui && (
                  <div className="mt-2 space-y-2 border-t border-border pt-3">
                    {passo.tipo === "condicao" && (
                      <CondicaoFields
                        gatilho={builder.gatilho}
                        cond={passo.condicao}
                        onChange={(cond: AutomacaoCondicao) =>
                          updatePasso(i, { tipo: "condicao", condicao: cond })
                        }
                      />
                    )}
                    {passo.tipo === "ia_condicao" && (
                      <IaCondicaoFields
                        index={i}
                        prompt={passo.prompt}
                        rotulo={passo.rotulo ?? ""}
                        agentId={passo.agent_id ?? ""}
                        agents={agents}
                        onChange={(patch) =>
                          updatePasso(i, {
                            tipo: "ia_condicao",
                            prompt: patch.prompt ?? passo.prompt,
                            rotulo: patch.rotulo ?? passo.rotulo,
                            agent_id:
                              patch.agent_id !== undefined ? patch.agent_id : passo.agent_id,
                          })
                        }
                      />
                    )}
                    {passo.tipo === "acao" && (
                      <AcaoFields
                        acao={passo.acao}
                        usuarios={usuarios}
                        agents={agents}
                        onChange={(acao: AutomacaoAcao) => updatePasso(i, { tipo: "acao", acao })}
                      />
                    )}
                    {pendencia && <p className="text-[11px] font-medium text-sys-red">{pendencia}</p>}
                  </div>
                )}
              </Card>
            </div>
          );
        })}

        {/* Adicionar passo */}
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">Adicionar passo</p>
            <span className="text-[11px] tabular-nums text-label-tertiary">
              {passos.length}/{PASSOS_MAX}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={cheio || !suportaCondicao}
              title={!suportaCondicao ? "Este gatilho não tem campos de contexto filtráveis" : undefined}
              onClick={() => addPasso("condicao")}
            >
              <Diamond className="h-3.5 w-3.5" />
              Condição
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={cheio || iaCheio}
              title={iaCheio ? `Máximo de ${PASSOS_IA_MAX} passos de IA por automação` : undefined}
              onClick={() => addPasso("ia_condicao")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Condição IA
            </Button>
          </div>

          <p className="mt-3 mb-1.5 text-[11px] font-medium text-muted-foreground">Ação</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(Object.keys(ACAO_CATALOG) as AutomacaoAcaoTipo[]).map((tipo) => {
              const Icon = ACAO_ICON[tipo];
              const bloqueadoIA = tipo === "ia_prompt" && iaCheio;
              return (
                <button
                  key={tipo}
                  type="button"
                  disabled={cheio || bloqueadoIA}
                  title={bloqueadoIA ? `Máximo de ${PASSOS_IA_MAX} passos de IA por automação` : undefined}
                  onClick={() => addPasso("acao", tipo)}
                  className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
      </div>
    </div>
  );
}

/** Editor de um passo ia_condicao: prompt DECISÓRIO (SIM/NÃO) + rótulo. */
function IaCondicaoFields({
  index,
  prompt,
  rotulo,
  agentId,
  agents,
  onChange,
}: {
  index: number;
  prompt: string;
  rotulo: string;
  agentId: string;
  agents: AgentResumo[];
  onChange: (patch: { prompt?: string; rotulo?: string; agent_id?: string }) => void;
}) {
  const foraDoLimite = prompt.length < IA_CONDICAO_PROMPT_MIN || prompt.length > IA_CONDICAO_PROMPT_MAX;
  return (
    <div className="space-y-1.5">
      {/* Agent plugável (F5): o prompt do agent substitui o inline na engine;
          o inline segue OBRIGATÓRIO — é o fallback garantido se o agent for
          desativado/excluído (o gate nunca quebra por agent). */}
      {agents.length > 0 && (
        <div className="space-y-1">
          <label
            htmlFor={`ia-condicao-agent-${index}`}
            className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary"
          >
            Agent (opcional)
          </label>
          <select
            id={`ia-condicao-agent-${index}`}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary/40"
            value={agentId}
            onChange={(e) => onChange({ agent_id: e.target.value })}
          >
            <option value="">Prompt inline</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center justify-between">
        <label htmlFor={`ia-condicao-${index}`} className="text-[11px] font-semibold text-foreground">
          {agentId
            ? "Prompt fallback (obrigatório — usado se o agent for desativado)"
            : "Critério da IA (decide SIM / NÃO)"}
        </label>
        <span
          className={cn(
            "text-[11px] tabular-nums",
            foraDoLimite ? "text-sys-red" : "text-muted-foreground",
          )}
        >
          {prompt.length}/{IA_CONDICAO_PROMPT_MAX}
        </span>
      </div>
      <textarea
        id={`ia-condicao-${index}`}
        className="w-full min-h-24 resize-y rounded-md border border-input bg-card px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-placeholder outline-none focus:border-primary/40"
        placeholder="Ex.: O responsável de {atleta_nome} demonstrou interesse real e o momento é adequado para avançar a proposta?"
        value={prompt}
        onChange={(e) => onChange({ prompt: e.target.value })}
      />
      <div className="space-y-1">
        <label
          htmlFor={`ia-condicao-rotulo-${index}`}
          className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary"
        >
          Rótulo (opcional — resumo do fluxo)
        </label>
        <Input
          id={`ia-condicao-rotulo-${index}`}
          maxLength={IA_CONDICAO_ROTULO_MAX}
          placeholder="Ex.: lead quente o suficiente"
          value={rotulo}
          onChange={(e) => onChange({ rotulo: e.target.value })}
        />
      </div>
      <p className="rounded-md bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Variáveis disponíveis:{" "}
        {WHATSAPP_CUSTOM_VARIAVEIS.map((v) => (
          <code key={v} className="mr-1.5 font-mono text-foreground">
            {v}
          </code>
        ))}
        — a engine anexa o <strong>contexto factual</strong> do registro (etapa, fase, nota NPS,
        parcela…). A IA responde só <strong>SIM</strong> ou <strong>NÃO</strong>; se NÃO (ou em caso
        de dúvida/erro), o fluxo <strong>para</strong> — <strong>fail-closed</strong>, a IA não age
        na incerteza. É <strong>interno</strong>: nunca envia WhatsApp/e-mail. Requer{" "}
        <code className="font-mono">GEMINI_API_KEY</code> na engine.
      </p>
    </div>
  );
}
