"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { Campo, INPUT_CLS, ModalForm } from "@/components/planejamento/ModalForm";
import {
  registrarExecucaoRotina,
  removerRegistro,
  salvarRotina,
} from "@/lib/actions/planejamento";
import type { Frequencia } from "@/lib/planejamento-tipos";

interface Rotina {
  id: string;
  nome: string;
  descricao: string | null;
  frequencia: Frequencia;
  dia_semana: number | null;
  dia_mes: number | null;
  escopo: string;
  participantes: string[];
  pauta: string | null;
  ativa: boolean;
  proxima_em: string | null;
}

interface Execucao {
  id: string;
  rotina_id: string;
  data: string;
  notas: string | null;
  decisoes: string | null;
}

const FREQ: Record<Frequencia, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  trimestral: "Trimestral",
};

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const hoje = () => new Date().toISOString().slice(0, 10);

export function RotinasClient({
  rotinas,
  execucoes,
  pessoas,
  podeEditar,
}: {
  rotinas: Rotina[];
  execucoes: Execucao[];
  pessoas: { id: string; nome: string }[];
  podeEditar: boolean;
}) {
  const [pendente, startTransition] = useTransition();
  const [form, setForm] = useState<Partial<Rotina> | null>(null);
  const [registro, setRegistro] = useState<null | {
    rotina: Rotina; data: string; notas: string; decisoes: string;
  }>(null);

  const acao = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string, fechar: () => void) => {
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.success) { toast.success(ok); fechar(); }
        else toast.error(r.error);
      } catch {
        toast.error("Falha de conexão. Tente de novo.");
      }
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader dense eyebrow="ACOMPANHAMENTO" title="Rotinas" />

      <Card className="border-primary/20 bg-primary/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-foreground">
            Rotina é o que transforma meta em resultado: sem cadência de revisão, o número só
            aparece quando já não dá para reagir. Cada execução registrada vira histórico do
            que foi decidido.
          </p>
          {podeEditar && (
            <Button
              size="sm"
              className="shrink-0"
              onClick={() =>
                setForm({ frequencia: "semanal", escopo: "ciclo", ativa: true, participantes: [] })
              }
            >
              <Plus />
              Nova rotina
            </Button>
          )}
        </div>
      </Card>

      {rotinas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Repeat}
            title="Nenhuma rotina definida"
            description="Comece por uma revisão semanal de metas e uma mensal de objetivos."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rotinas.map((r) => {
            const minhas = execucoes.filter((e) => e.rotina_id === r.id);
            return (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{r.nome}</h3>
                      <Badge tone={r.ativa ? "green" : "neutral"} size="sm">
                        {r.ativa ? "Ativa" : "Pausada"}
                      </Badge>
                      <Badge tone="brand" size="sm">{FREQ[r.frequencia]}</Badge>
                    </div>
                    {r.descricao && (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.descricao}</p>
                    )}
                    <p className="mt-1 text-[11px] text-label-tertiary">
                      {r.dia_semana !== null && r.dia_semana !== undefined ? `Toda ${DIAS[r.dia_semana]}` : null}
                      {r.dia_mes ? `Todo dia ${r.dia_mes}` : null}
                      {minhas.length > 0 && ` · ${minhas.length} encontro(s) registrado(s)`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setRegistro({ rotina: r, data: hoje(), notas: "", decisoes: "" })
                      }
                    >
                      <CalendarCheck />
                      Registrar
                    </Button>
                    {podeEditar && (
                      <>
                        <button
                          type="button"
                          onClick={() => setForm(r)}
                          aria-label={`Editar ${r.nome}`}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            acao(() => removerRegistro("rotinas_acompanhamento", r.id), "Rotina removida", () => {})
                          }
                          aria-label={`Remover ${r.nome}`}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-sys-red"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {minhas.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-border pt-3">
                    {minhas.slice(0, 3).map((e) => (
                      <li key={e.id} className="text-xs">
                        <span className="font-medium text-foreground">
                          {new Date(`${e.data}T12:00:00`).toLocaleDateString("pt-BR")}
                        </span>
                        {e.decisoes && (
                          <span className="text-muted-foreground"> — {e.decisoes}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {form && (
        <FormRotina
          valor={form}
          setValor={setForm}
          salvando={pendente}
          onSalvar={() => acao(() => salvarRotina(form), "Rotina salva", () => setForm(null))}
        />
      )}

      {registro && (
        <ModalForm
          aberto
          titulo="Registrar encontro"
          descricao={registro.rotina.nome}
          onFechar={() => setRegistro(null)}
          onSalvar={() =>
            acao(
              () =>
                registrarExecucaoRotina({
                  rotina_id: registro.rotina.id,
                  data: registro.data,
                  notas: registro.notas || null,
                  decisoes: registro.decisoes || null,
                  participantes: [],
                }),
              "Encontro registrado",
              () => setRegistro(null),
            )
          }
          salvando={pendente}
        >
          <div className="space-y-4">
            <Campo label="Data">
              <input
                type="date"
                className={INPUT_CLS}
                value={registro.data}
                onChange={(e) => setRegistro({ ...registro, data: e.target.value })}
              />
            </Campo>
            <Campo label="Notas" ajuda="O que foi discutido.">
              <textarea
                rows={4}
                className={`${INPUT_CLS} h-auto py-2`}
                value={registro.notas}
                onChange={(e) => setRegistro({ ...registro, notas: e.target.value })}
              />
            </Campo>
            <Campo label="Decisões" ajuda="O que muda a partir daqui — é isso que aparece no histórico.">
              <textarea
                rows={3}
                className={`${INPUT_CLS} h-auto py-2`}
                value={registro.decisoes}
                onChange={(e) => setRegistro({ ...registro, decisoes: e.target.value })}
              />
            </Campo>
          </div>
        </ModalForm>
      )}

      {pessoas.length === 0 && null}
    </div>
  );
}

function FormRotina({
  valor, setValor, onSalvar, salvando,
}: {
  valor: Partial<Rotina>;
  setValor: (v: Partial<Rotina> | null) => void;
  onSalvar: () => void;
  salvando: boolean;
}) {
  const set = (patch: Partial<Rotina>) => setValor({ ...valor, ...patch });
  const bloqueio = (valor.nome ?? "").trim().length < 3 ? "Dê um nome à rotina." : null;
  const semanal = valor.frequencia === "semanal" || valor.frequencia === "quinzenal";

  return (
    <ModalForm
      aberto
      titulo={valor.id ? "Editar rotina" : "Nova rotina"}
      descricao="Cadência de revisão do planejamento."
      onFechar={() => setValor(null)}
      onSalvar={onSalvar}
      salvando={salvando}
      bloqueio={bloqueio}
    >
      <div className="space-y-4">
        <Campo label="Nome">
          <input
            className={INPUT_CLS}
            value={valor.nome ?? ""}
            onChange={(e) => set({ nome: e.target.value })}
            placeholder="Ex: Revisão semanal de metas"
          />
        </Campo>
        <Campo label="Descrição">
          <textarea rows={2} className={`${INPUT_CLS} h-auto py-2`} value={valor.descricao ?? ""}
            onChange={(e) => set({ descricao: e.target.value })} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Frequência">
            <select className={INPUT_CLS} value={valor.frequencia ?? "semanal"}
              onChange={(e) => set({ frequencia: e.target.value as Frequencia })}>
              {(Object.keys(FREQ) as Frequencia[]).map((f) => (
                <option key={f} value={f}>{FREQ[f]}</option>
              ))}
            </select>
          </Campo>
          {semanal ? (
            <Campo label="Dia da semana">
              <select className={INPUT_CLS} value={valor.dia_semana ?? 1}
                onChange={(e) => set({ dia_semana: Number(e.target.value), dia_mes: null })}>
                {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </Campo>
          ) : (
            <Campo label="Dia do mês">
              <input type="number" min={1} max={31} className={INPUT_CLS} value={valor.dia_mes ?? 1}
                onChange={(e) => set({ dia_mes: Number(e.target.value), dia_semana: null })} />
            </Campo>
          )}
        </div>
        <Campo label="Pauta padrão" ajuda="O roteiro do encontro — evita reunião sem foco.">
          <textarea rows={4} className={`${INPUT_CLS} h-auto py-2`} value={valor.pauta ?? ""}
            onChange={(e) => set({ pauta: e.target.value })}
            placeholder={"1. Metas em risco\n2. O que travou\n3. Decisões da semana"} />
        </Campo>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input type="checkbox" checked={valor.ativa ?? true}
            onChange={(e) => set({ ativa: e.target.checked })} className="size-4 accent-primary" />
          Rotina ativa
        </label>
      </div>
    </ModalForm>
  );
}
