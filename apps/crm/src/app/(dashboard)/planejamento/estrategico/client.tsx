"use client";

import { useMemo, useState, useTransition } from "react";
import { Compass, FolderKanban, Pencil, Plus, Target, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { CurrencyInput } from "@/components/ui/NumericInputs";
import { Campo, INPUT_CLS, ModalForm } from "@/components/planejamento/ModalForm";
import {
  removerRegistro,
  salvarCiclo,
  salvarObjetivo,
  salvarProjecao,
  salvarProjeto,
  type PlanejamentoCompleto,
} from "@/lib/actions/planejamento";
import {
  STATUS_LABEL,
  formatarValor,
  type MetaComProgresso,
  type Objetivo,
  type Projecao,
  type Projeto,
  type StatusObjetivo,
} from "@/lib/planejamento-tipos";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<StatusObjetivo, "green" | "blue" | "orange" | "neutral" | "red"> = {
  concluido: "green",
  em_andamento: "blue",
  pausado: "orange",
  nao_iniciado: "neutral",
  cancelado: "red",
};

const PRIORIDADE_TONE = { alta: "red", media: "orange", baixa: "neutral" } as const;
const PRIORIDADE_LABEL = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;

type Aba = "objetivos" | "projecoes";

export function EstrategicoClient({
  plano,
  podeEditar,
}: {
  plano: PlanejamentoCompleto;
  podeEditar: boolean;
}) {
  const { ciclo, objetivos, projetos, projecoes, metas, pessoas } = plano;
  const [aba, setAba] = useState<Aba>("objetivos");
  const [pendente, startTransition] = useTransition();
  const [formCiclo, setFormCiclo] = useState<null | {
    id?: string; nome: string; ano_inicio: number; ano_fim: number; visao: string;
    status: "rascunho" | "ativo" | "encerrado";
  }>(null);
  const [formObjetivo, setFormObjetivo] = useState<null | Partial<Objetivo>>(null);
  const [formProjeto, setFormProjeto] = useState<null | Partial<Projeto>>(null);
  const [formProjecao, setFormProjecao] = useState<null | Partial<Projecao>>(null);

  const anosDoCiclo = useMemo(() => {
    if (!ciclo) return [];
    const anos: number[] = [];
    for (let a = ciclo.ano_inicio; a <= ciclo.ano_fim; a++) anos.push(a);
    return anos;
  }, [ciclo]);

  const acao = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string, fechar: () => void) => {
    startTransition(async () => {
      try {
        const r = await fn();
        if (r.success) {
          toast.success(ok);
          fechar();
        } else {
          toast.error(r.error);
        }
      } catch {
        toast.error("Falha de conexão. Tente de novo.");
      }
    });
  };

  if (!ciclo) {
    return (
      <>
        <Card>
          <EmptyState
            icon={Compass}
            title="Comece pelo ciclo de 3 anos"
            description="O ciclo define a janela e a visão. Objetivos, projetos, projeções e metas penduram nele."
            action={
              podeEditar ? (
                <Button
                  size="sm"
                  onClick={() =>
                    setFormCiclo({
                      nome: `Ciclo ${new Date().getFullYear()}–${new Date().getFullYear() + 2}`,
                      ano_inicio: new Date().getFullYear(),
                      ano_fim: new Date().getFullYear() + 2,
                      visao: "",
                      status: "ativo",
                    })
                  }
                >
                  <Plus />
                  Criar ciclo
                </Button>
              ) : undefined
            }
          />
        </Card>
        {formCiclo && (
          <FormCiclo
            valor={formCiclo}
            setValor={setFormCiclo}
            salvando={pendente}
            onSalvar={() => acao(() => salvarCiclo(formCiclo), "Ciclo criado", () => setFormCiclo(null))}
          />
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        dense
        eyebrow="ESTRATÉGICO"
        // O nome do ciclo normalmente já traz os anos — não repetir.
        title={
          ciclo.nome.includes(String(ciclo.ano_inicio))
            ? ciclo.nome
            : `${ciclo.nome} · ${ciclo.ano_inicio}–${ciclo.ano_fim}`
        }
        actions={
          podeEditar ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setFormCiclo({
                  id: ciclo.id,
                  nome: ciclo.nome,
                  ano_inicio: ciclo.ano_inicio,
                  ano_fim: ciclo.ano_fim,
                  visao: ciclo.visao ?? "",
                  status: ciclo.status,
                })
              }
            >
              <Pencil />
              Editar ciclo
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2">
        {(["objetivos", "projecoes"] as Aba[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              aba === a ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            {a === "objetivos" ? "Objetivos e projetos" : "Projeções financeiras"}
          </button>
        ))}
        {podeEditar && (
          <Button
            size="sm"
            className="ml-auto"
            onClick={() =>
              aba === "objetivos"
                ? setFormObjetivo({ ciclo_id: ciclo.id, status: "nao_iniciado", accent: "blue", ordem: objetivos.length })
                : setFormProjecao({ ciclo_id: ciclo.id, ano: anosDoCiclo[0] })
            }
          >
            <Plus />
            {aba === "objetivos" ? "Novo objetivo" : "Nova projeção"}
          </Button>
        )}
      </div>

      {aba === "objetivos" ? (
        <ListaObjetivos
          objetivos={objetivos}
          projetos={projetos}
          metas={metas}
          pessoas={pessoas}
          podeEditar={podeEditar}
          onEditar={setFormObjetivo}
          onNovoProjeto={(objetivoId) =>
            setFormProjeto({ objetivo_id: objetivoId, status: "nao_iniciado", prioridade: "media", progresso: 0 })
          }
          onEditarProjeto={setFormProjeto}
          onRemover={(id) => acao(() => removerRegistro("planejamento_objetivos", id), "Objetivo removido", () => {})}
        />
      ) : (
        <TabelaProjecoes
          projecoes={projecoes}
          anos={anosDoCiclo}
          podeEditar={podeEditar}
          onEditar={(p) => setFormProjecao(p)}
          onNovo={(ano) => setFormProjecao({ ciclo_id: ciclo.id, ano })}
        />
      )}

      {formCiclo && (
        <FormCiclo
          valor={formCiclo}
          setValor={setFormCiclo}
          salvando={pendente}
          onSalvar={() => acao(() => salvarCiclo(formCiclo), "Ciclo salvo", () => setFormCiclo(null))}
        />
      )}
      {formObjetivo && (
        <FormObjetivo
          valor={formObjetivo}
          setValor={setFormObjetivo}
          pessoas={pessoas}
          salvando={pendente}
          onSalvar={() =>
            acao(
              () => salvarObjetivo({ ...formObjetivo, ciclo_id: ciclo.id }),
              "Objetivo salvo",
              () => setFormObjetivo(null),
            )
          }
        />
      )}
      {formProjeto && (
        <FormProjeto
          valor={formProjeto}
          setValor={setFormProjeto}
          pessoas={pessoas}
          salvando={pendente}
          onSalvar={() => acao(() => salvarProjeto(formProjeto), "Projeto salvo", () => setFormProjeto(null))}
        />
      )}
      {formProjecao && (
        <FormProjecao
          valor={formProjecao}
          setValor={setFormProjecao}
          salvando={pendente}
          onSalvar={() =>
            acao(
              () => salvarProjecao({ ...formProjecao, ciclo_id: ciclo.id }),
              "Projeção salva",
              () => setFormProjecao(null),
            )
          }
        />
      )}
    </div>
  );
}

function ListaObjetivos({
  objetivos,
  projetos,
  metas,
  pessoas,
  podeEditar,
  onEditar,
  onNovoProjeto,
  onEditarProjeto,
  onRemover,
}: {
  objetivos: Objetivo[];
  projetos: Projeto[];
  metas: MetaComProgresso[];
  pessoas: PlanejamentoCompleto["pessoas"];
  podeEditar: boolean;
  onEditar: (o: Objetivo) => void;
  onNovoProjeto: (objetivoId: string) => void;
  onEditarProjeto: (p: Projeto) => void;
  onRemover: (id: string) => void;
}) {
  if (!objetivos.length) {
    return (
      <Card>
        <EmptyState
          icon={Target}
          title="Nenhum objetivo neste ciclo"
          description="Objetivo é o resultado qualitativo de 3 anos. As metas numéricas penduram nele."
        />
      </Card>
    );
  }

  const nome = (id: string | null) => pessoas.find((p) => p.id === id)?.nome ?? "sem responsável";

  return (
    <div className="space-y-3">
      {objetivos.map((o) => {
        const meus = projetos.filter((p) => p.objetivo_id === o.id);
        const minhasMetas = metas.filter((m) => m.objetivo_id === o.id);
        return (
          <Card key={o.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{o.titulo}</h3>
                  <Badge tone={STATUS_TONE[o.status]} size="sm">{STATUS_LABEL[o.status]}</Badge>
                </div>
                {o.descricao && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{o.descricao}</p>
                )}
                <p className="mt-1 text-[11px] text-label-tertiary">
                  {nome(o.responsavel_id)} · {minhasMetas.length} meta(s) · {meus.length} projeto(s)
                </p>
              </div>
              {podeEditar && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onNovoProjeto(o.id)}
                    aria-label={`Novo projeto em ${o.titulo}`}
                    title="Novo projeto"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Plus className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditar(o)}
                    aria-label={`Editar ${o.titulo}`}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemover(o.id)}
                    aria-label={`Remover ${o.titulo}`}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-sys-red"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>

            {meus.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-border pt-3">
                {meus.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <FolderKanban aria-hidden className="size-3.5 shrink-0 text-label-tertiary" />
                    <button
                      type="button"
                      onClick={() => podeEditar && onEditarProjeto(p)}
                      className="min-w-0 flex-1 truncate text-left text-xs text-foreground hover:underline disabled:no-underline"
                      disabled={!podeEditar}
                    >
                      {p.nome}
                    </button>
                    <Badge tone={PRIORIDADE_TONE[p.prioridade]} size="sm">
                      {PRIORIDADE_LABEL[p.prioridade]}
                    </Badge>
                    <div className="hidden h-1 w-24 overflow-hidden rounded-full bg-secondary sm:block">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${p.progresso}%` }} />
                    </div>
                    <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                      {p.progresso}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function TabelaProjecoes({
  projecoes,
  anos,
  podeEditar,
  onEditar,
  onNovo,
}: {
  projecoes: Projecao[];
  anos: number[];
  podeEditar: boolean;
  onEditar: (p: Projecao) => void;
  onNovo: (ano: number) => void;
}) {
  const linhas: { rotulo: string; get: (p: Projecao) => string }[] = [
    { rotulo: "Receita", get: (p) => formatarValor(Number(p.receita), "moeda") },
    { rotulo: "Contratos", get: (p) => String(p.contratos) },
    { rotulo: "Ticket médio", get: (p) => formatarValor(Number(p.ticket_medio), "moeda") },
    { rotulo: "Investimento em marketing", get: (p) => formatarValor(Number(p.investimento_marketing), "moeda") },
    { rotulo: "Custo fixo", get: (p) => formatarValor(Number(p.custo_fixo), "moeda") },
    {
      rotulo: "Resultado projetado",
      get: (p) =>
        formatarValor(
          Number(p.receita) - Number(p.investimento_marketing) - Number(p.custo_fixo),
          "moeda",
        ),
    },
  ];

  return (
    <Card className="overflow-x-auto">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp aria-hidden className="size-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Projeções do ciclo</h2>
      </div>
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-label-tertiary">
              Indicador
            </th>
            {anos.map((a) => (
              <th key={a} className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-label-tertiary">
                {a}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.rotulo} className="border-b border-border/60 last:border-0">
              <td className="px-2 py-2.5 text-xs text-muted-foreground">{l.rotulo}</td>
              {anos.map((a) => {
                const p = projecoes.find((x) => x.ano === a);
                return (
                  <td key={a} className="px-2 py-2.5 text-right text-xs tabular-nums text-foreground">
                    {p ? l.get(p) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
          {podeEditar && (
            <tr>
              <td className="px-2 py-2.5" />
              {anos.map((a) => {
                const p = projecoes.find((x) => x.ano === a);
                return (
                  <td key={a} className="px-2 py-2.5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => (p ? onEditar(p) : onNovo(a))}>
                      {p ? "Editar" : "Preencher"}
                    </Button>
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

// ─── Formulários ─────────────────────────────────────────────────────────

function FormCiclo({
  valor, setValor, onSalvar, salvando,
}: {
  valor: NonNullable<Parameters<typeof salvarCiclo>[0]> & { visao: string };
  setValor: (v: never) => void;
  onSalvar: () => void;
  salvando: boolean;
}) {
  const v = valor as { id?: string; nome: string; ano_inicio: number; ano_fim: number; visao: string; status: string };
  const set = (patch: Record<string, unknown>) => setValor({ ...v, ...patch } as never);
  const bloqueio =
    v.nome.trim().length < 3 ? "Dê um nome ao ciclo."
      : v.ano_fim < v.ano_inicio ? "O ano final não pode ser antes do inicial." : null;

  return (
    <ModalForm
      aberto
      titulo={v.id ? "Editar ciclo" : "Novo ciclo estratégico"}
      descricao="A janela de 3 anos e a visão que orienta objetivos, projeções e metas."
      onFechar={() => setValor(null as never)}
      onSalvar={onSalvar}
      salvando={salvando}
      bloqueio={bloqueio}
    >
      <div className="space-y-4">
        <Campo label="Nome do ciclo">
          <input className={INPUT_CLS} value={v.nome} onChange={(e) => set({ nome: e.target.value })} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Ano inicial">
            <input type="number" className={INPUT_CLS} value={v.ano_inicio}
              onChange={(e) => set({ ano_inicio: Number(e.target.value) })} />
          </Campo>
          <Campo label="Ano final">
            <input type="number" className={INPUT_CLS} value={v.ano_fim}
              onChange={(e) => set({ ano_fim: Number(e.target.value) })} />
          </Campo>
          <Campo label="Situação" ajuda="Só um ciclo fica ativo por vez.">
            <select className={INPUT_CLS} value={v.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="rascunho">Rascunho</option>
              <option value="ativo">Ativo</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </Campo>
        </div>
        <Campo label="Visão" ajuda="Onde a BAUSA quer estar ao fim do ciclo.">
          <textarea rows={4} className={`${INPUT_CLS} h-auto py-2`} value={v.visao}
            onChange={(e) => set({ visao: e.target.value })} />
        </Campo>
      </div>
    </ModalForm>
  );
}

function FormObjetivo({
  valor, setValor, pessoas, onSalvar, salvando,
}: {
  valor: Partial<Objetivo>;
  setValor: (v: Partial<Objetivo> | null) => void;
  pessoas: PlanejamentoCompleto["pessoas"];
  onSalvar: () => void;
  salvando: boolean;
}) {
  const set = (patch: Partial<Objetivo>) => setValor({ ...valor, ...patch });
  const bloqueio = (valor.titulo ?? "").trim().length < 3 ? "Descreva o objetivo." : null;

  return (
    <ModalForm
      aberto
      titulo={valor.id ? "Editar objetivo" : "Novo objetivo"}
      descricao="Resultado qualitativo do ciclo. As metas numéricas vêm depois."
      onFechar={() => setValor(null)}
      onSalvar={onSalvar}
      salvando={salvando}
      bloqueio={bloqueio}
    >
      <div className="space-y-4">
        <Campo label="Título">
          <input className={INPUT_CLS} value={valor.titulo ?? ""}
            onChange={(e) => set({ titulo: e.target.value })}
            placeholder="Ex: Ser referência nacional em bolsas esportivas" />
        </Campo>
        <Campo label="Descrição">
          <textarea rows={3} className={`${INPUT_CLS} h-auto py-2`} value={valor.descricao ?? ""}
            onChange={(e) => set({ descricao: e.target.value })} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Responsável">
            <select className={INPUT_CLS} value={valor.responsavel_id ?? ""}
              onChange={(e) => set({ responsavel_id: e.target.value || null })}>
              <option value="">Sem responsável</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Situação">
            <select className={INPUT_CLS} value={valor.status ?? "nao_iniciado"}
              onChange={(e) => set({ status: e.target.value as StatusObjetivo })}>
              {(Object.keys(STATUS_LABEL) as StatusObjetivo[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Campo>
        </div>
      </div>
    </ModalForm>
  );
}

function FormProjeto({
  valor, setValor, pessoas, onSalvar, salvando,
}: {
  valor: Partial<Projeto>;
  setValor: (v: Partial<Projeto> | null) => void;
  pessoas: PlanejamentoCompleto["pessoas"];
  onSalvar: () => void;
  salvando: boolean;
}) {
  const set = (patch: Partial<Projeto>) => setValor({ ...valor, ...patch });
  const bloqueio =
    (valor.nome ?? "").trim().length < 3 ? "Dê um nome ao projeto."
      : valor.inicio && valor.fim && valor.fim < valor.inicio ? "O fim não pode ser antes do início." : null;

  return (
    <ModalForm
      aberto
      titulo={valor.id ? "Editar projeto" : "Novo projeto"}
      descricao="A execução que faz o objetivo acontecer."
      onFechar={() => setValor(null)}
      onSalvar={onSalvar}
      salvando={salvando}
      bloqueio={bloqueio}
    >
      <div className="space-y-4">
        <Campo label="Nome">
          <input className={INPUT_CLS} value={valor.nome ?? ""} onChange={(e) => set({ nome: e.target.value })} />
        </Campo>
        <Campo label="Descrição">
          <textarea rows={3} className={`${INPUT_CLS} h-auto py-2`} value={valor.descricao ?? ""}
            onChange={(e) => set({ descricao: e.target.value })} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Responsável">
            <select className={INPUT_CLS} value={valor.responsavel_id ?? ""}
              onChange={(e) => set({ responsavel_id: e.target.value || null })}>
              <option value="">Sem responsável</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Prioridade">
            <select className={INPUT_CLS} value={valor.prioridade ?? "media"}
              onChange={(e) => set({ prioridade: e.target.value as Projeto["prioridade"] })}>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Início">
            <input type="date" className={INPUT_CLS} value={valor.inicio ?? ""}
              onChange={(e) => set({ inicio: e.target.value || null })} />
          </Campo>
          <Campo label="Fim">
            <input type="date" className={INPUT_CLS} value={valor.fim ?? ""}
              onChange={(e) => set({ fim: e.target.value || null })} />
          </Campo>
          <Campo label="Progresso (%)">
            <input type="number" min={0} max={100} className={INPUT_CLS} value={valor.progresso ?? 0}
              onChange={(e) => set({ progresso: Number(e.target.value) })} />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Situação">
            <select className={INPUT_CLS} value={valor.status ?? "nao_iniciado"}
              onChange={(e) => set({ status: e.target.value as StatusObjetivo })}>
              {(Object.keys(STATUS_LABEL) as StatusObjetivo[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </Campo>
          <CurrencyInput
            label="Orçamento"
            valor={Number(valor.orcamento ?? 0)}
            onChange={(v) => set({ orcamento: v })}
          />
        </div>
      </div>
    </ModalForm>
  );
}

function FormProjecao({
  valor, setValor, onSalvar, salvando,
}: {
  valor: Partial<Projecao>;
  setValor: (v: Partial<Projecao> | null) => void;
  onSalvar: () => void;
  salvando: boolean;
}) {
  const set = (patch: Partial<Projecao>) => setValor({ ...valor, ...patch });
  const num = (k: keyof Projecao) => Number(valor[k] ?? 0);
  const resultado = num("receita") - num("investimento_marketing") - num("custo_fixo");

  return (
    <ModalForm
      aberto
      titulo={`Projeção ${valor.ano ?? ""}`}
      descricao="O cenário planejado para o ano. Serve de referência contra o realizado."
      onFechar={() => setValor(null)}
      onSalvar={onSalvar}
      salvando={salvando}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <CurrencyInput label="Receita" valor={num("receita")} onChange={(v) => set({ receita: v })} />
          <Campo label="Contratos">
            <input type="number" className={INPUT_CLS} value={num("contratos")}
              onChange={(e) => set({ contratos: Number(e.target.value) })} />
          </Campo>
          <CurrencyInput label="Ticket médio" valor={num("ticket_medio")} onChange={(v) => set({ ticket_medio: v })} />
          <CurrencyInput label="Investimento em marketing" valor={num("investimento_marketing")}
            onChange={(v) => set({ investimento_marketing: v })} />
          <CurrencyInput label="Custo fixo" valor={num("custo_fixo")} onChange={(v) => set({ custo_fixo: v })} />
        </div>
        <div className={cn(
          "rounded-lg border px-3 py-2 text-xs font-medium",
          resultado >= 0 ? "border-sys-green/25 bg-sys-green/8 text-sys-green" : "border-sys-red/25 bg-sys-red/8 text-sys-red",
        )}>
          Resultado projetado: {formatarValor(resultado, "moeda")}
        </div>
        <Campo label="Premissas" ajuda="O que precisa ser verdade para esse número acontecer.">
          <textarea rows={3} className={`${INPUT_CLS} h-auto py-2`} value={valor.premissas ?? ""}
            onChange={(e) => set({ premissas: e.target.value })} />
        </Campo>
      </div>
    </ModalForm>
  );
}
