"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Pencil, Plus, Target, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { CurrencyInput } from "@/components/ui/NumericInputs";
import { FarolBadge, MetaBar } from "@/components/planejamento/MetaBar";
import { Campo, INPUT_CLS, ModalForm } from "@/components/planejamento/ModalForm";
import {
  registrarCheckin,
  removerRegistro,
  salvarMeta,
  type PlanejamentoCompleto,
} from "@/lib/actions/planejamento";
import {
  FONTE_LABEL,
  MESES,
  formatarValor,
  type FonteMeta,
  type MetaComProgresso,
  type PeriodoTipo,
  type UnidadeMeta,
} from "@/lib/planejamento-tipos";

type Rascunho = {
  id?: string;
  titulo: string;
  descricao: string;
  objetivo_id: string;
  responsavel_id: string;
  periodo_tipo: PeriodoTipo;
  ano: number;
  semestre: number;
  mes: number;
  unidade: UnidadeMeta;
  direcao: "maior_melhor" | "menor_melhor";
  alvo: number;
  fonte: FonteMeta;
  realizado_manual: number;
  peso: number;
  incentivo_tipo: "nenhum" | "valor_fixo" | "percentual_meta";
  incentivo_valor: number;
  incentivo_gatilho_pct: number;
};

const novoRascunho = (ano: number): Rascunho => ({
  titulo: "", descricao: "", objetivo_id: "", responsavel_id: "",
  periodo_tipo: "mes", ano, semestre: 1, mes: new Date().getMonth() + 1,
  unidade: "moeda", direcao: "maior_melhor", alvo: 0, fonte: "manual",
  realizado_manual: 0, peso: 1,
  incentivo_tipo: "nenhum", incentivo_valor: 0, incentivo_gatilho_pct: 100,
});

export function MetasClient({
  plano,
  podeEditar,
}: {
  plano: PlanejamentoCompleto;
  podeEditar: boolean;
}) {
  const { ciclo, objetivos, metas, pessoas } = plano;
  const [pendente, startTransition] = useTransition();
  const [filtroPeriodo, setFiltroPeriodo] = useState<"todos" | PeriodoTipo>("todos");
  const [filtroAno, setFiltroAno] = useState<number | "todos">("todos");
  const [filtroPessoa, setFiltroPessoa] = useState<string>("todos");
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [checkin, setCheckin] = useState<{ meta: MetaComProgresso; valor: number; nota: string } | null>(null);

  const anos = useMemo(
    () => [...new Set(metas.map((m) => m.ano))].sort(),
    [metas],
  );

  const visiveis = useMemo(
    () =>
      metas.filter(
        (m) =>
          (filtroPeriodo === "todos" || m.periodo_tipo === filtroPeriodo) &&
          (filtroAno === "todos" || m.ano === filtroAno) &&
          (filtroPessoa === "todos" || m.responsavel_id === filtroPessoa),
      ),
    [metas, filtroPeriodo, filtroAno, filtroPessoa],
  );

  const nomePessoa = (id: string | null) =>
    pessoas.find((p) => p.id === id)?.nome ?? "—";

  if (!ciclo) {
    return (
      <Card>
        <EmptyState
          icon={Target}
          title="Crie um ciclo antes das metas"
          description="As metas pertencem a um ciclo estratégico. Comece pela aba Estratégico."
        />
      </Card>
    );
  }

  const salvar = () => {
    if (!rascunho) return;
    startTransition(async () => {
      try {
        const r = await salvarMeta({
          ...rascunho,
          ciclo_id: ciclo.id,
          objetivo_id: rascunho.objetivo_id || null,
          responsavel_id: rascunho.responsavel_id || null,
          descricao: rascunho.descricao || null,
          mes: rascunho.periodo_tipo === "mes" ? rascunho.mes : null,
          semestre: rascunho.periodo_tipo === "semestre" ? rascunho.semestre : null,
          minimo: null,
          incentivo_valor: rascunho.incentivo_tipo === "nenhum" ? null : rascunho.incentivo_valor,
          incentivo_teto: null,
          realizado_manual: rascunho.fonte === "manual" ? rascunho.realizado_manual : null,
          status: "ativa" as const,
        });
        if (r.success) {
          toast.success(rascunho.id ? "Meta atualizada" : "Meta criada");
          setRascunho(null);
        } else {
          toast.error(r.error);
        }
      } catch {
        toast.error("Falha de conexão ao salvar. Tente de novo.");
      }
    });
  };

  const gravarCheckin = () => {
    if (!checkin) return;
    startTransition(async () => {
      try {
        const r = await registrarCheckin({
          meta_id: checkin.meta.id,
          valor: checkin.meta.automatico ? null : checkin.valor,
          farol: checkin.meta.farol,
          comentario: checkin.nota || null,
        });
        if (r.success) {
          toast.success("Check-in registrado");
          setCheckin(null);
        } else {
          toast.error(r.error);
        }
      } catch {
        toast.error("Falha de conexão ao registrar.");
      }
    });
  };

  const remover = (m: MetaComProgresso) => {
    startTransition(async () => {
      try {
        const r = await removerRegistro("metas_corporativas", m.id);
        if (r.success) toast.success("Meta removida");
        else toast.error(r.error);
      } catch {
        toast.error("Falha de conexão ao remover.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Sem `actions` no header: em modo dense elas viram um menu "…", e criar
          meta é a ação primária desta tela — fica na barra de filtros. */}
      <PageHeader dense eyebrow="TÁTICO" title="Metas corporativas" />

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Filtrar por período"
          value={filtroPeriodo}
          onChange={(e) => setFiltroPeriodo(e.target.value as typeof filtroPeriodo)}
          className="h-8 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
        >
          <option value="todos">Todos os períodos</option>
          <option value="ano">Anuais</option>
          <option value="semestre">Semestrais</option>
          <option value="mes">Mensais</option>
        </select>
        <select
          aria-label="Filtrar por ano"
          value={String(filtroAno)}
          onChange={(e) => setFiltroAno(e.target.value === "todos" ? "todos" : Number(e.target.value))}
          className="h-8 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
        >
          <option value="todos">Todos os anos</option>
          {anos.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar por responsável"
          value={filtroPessoa}
          onChange={(e) => setFiltroPessoa(e.target.value)}
          className="h-8 rounded-lg border border-input bg-card px-2 text-xs text-foreground"
        >
          <option value="todos">Todos os responsáveis</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-label-tertiary">
          {visiveis.length} de {metas.length}
        </span>
        {podeEditar && (
          <Button size="sm" onClick={() => setRascunho(novoRascunho(new Date().getFullYear()))}>
            <Plus />
            Nova meta
          </Button>
        )}
      </div>

      {visiveis.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="Nenhuma meta neste recorte"
            description="Ajuste os filtros ou crie a primeira meta do ciclo."
          />
        </Card>
      ) : (
        <>
          {/* Tabela — desktop */}
          <Card className="hidden overflow-x-auto p-0 lg:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {["Meta", "Período", "Responsável", "Alvo", "Progresso", "Bônus", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-label-tertiary">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 last:border-0">
                    <td className="max-w-[260px] px-4 py-3">
                      <p className="truncate font-medium text-foreground">{m.titulo}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-label-tertiary">
                        {m.automatico && <Zap aria-hidden className="size-3 text-sys-blue" />}
                        {FONTE_LABEL[m.fonte]}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{m.periodoLabel}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{nomePessoa(m.responsavel_id)}</td>
                    <td className="px-4 py-3 text-xs tabular-nums text-foreground">
                      {formatarValor(m.alvo, m.unidade)}
                    </td>
                    <td className="min-w-[180px] px-4 py-3">
                      <MetaBar meta={m} compacta />
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums text-foreground">
                      {m.bonusPrevisto > 0 ? formatarValor(m.bonusPrevisto, "moeda") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Acoes
                        meta={m}
                        podeEditar={podeEditar}
                        onCheckin={() => setCheckin({ meta: m, valor: m.realizado, nota: "" })}
                        onEditar={() => setRascunho(paraRascunho(m))}
                        onRemover={() => remover(m)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Cards — mobile */}
          <div className="space-y-3 lg:hidden">
            {visiveis.map((m) => (
              <Card key={m.id}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{m.titulo}</p>
                    <p className="mt-0.5 text-[11px] text-label-tertiary">
                      {m.periodoLabel} · {nomePessoa(m.responsavel_id)}
                    </p>
                  </div>
                  <FarolBadge farol={m.farol} />
                </div>
                <MetaBar meta={m} />
                <div className="mt-3 flex items-center justify-between gap-2">
                  {m.bonusPrevisto > 0 ? (
                    <Badge tone="purple" size="sm">
                      Bônus {formatarValor(m.bonusPrevisto, "moeda")}
                    </Badge>
                  ) : (
                    <span className="text-[11px] text-label-tertiary">{FONTE_LABEL[m.fonte]}</span>
                  )}
                  <Acoes
                    meta={m}
                    podeEditar={podeEditar}
                    onCheckin={() => setCheckin({ meta: m, valor: m.realizado, nota: "" })}
                    onEditar={() => setRascunho(paraRascunho(m))}
                    onRemover={() => remover(m)}
                  />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {rascunho && (
        <FormMeta
          rascunho={rascunho}
          setRascunho={setRascunho}
          objetivos={objetivos}
          pessoas={pessoas}
          onSalvar={salvar}
          salvando={pendente}
        />
      )}

      {checkin && (
        <ModalForm
          aberto
          titulo="Check-in da meta"
          descricao={checkin.meta.titulo}
          onFechar={() => setCheckin(null)}
          onSalvar={gravarCheckin}
          salvando={pendente}
        >
          <div className="space-y-4">
            {checkin.meta.automatico ? (
              <p className="rounded-lg border border-sys-blue/25 bg-sys-blue/8 px-3 py-2 text-xs text-sys-blue">
                Esta meta é medida pelo sistema ({FONTE_LABEL[checkin.meta.fonte]}). O realizado
                não é digitado — registre só o comentário do acompanhamento.
              </p>
            ) : (
              <Campo label="Realizado até agora" ajuda="Passa a valer como o número atual da meta.">
                <input
                  type="number"
                  className={INPUT_CLS}
                  value={checkin.valor}
                  onChange={(e) => setCheckin({ ...checkin, valor: Number(e.target.value) })}
                />
              </Campo>
            )}
            <Campo label="Comentário" ajuda="O que explica o número e o que muda até o próximo check-in.">
              <textarea
                rows={4}
                className={`${INPUT_CLS} h-auto py-2`}
                value={checkin.nota}
                onChange={(e) => setCheckin({ ...checkin, nota: e.target.value })}
              />
            </Campo>
          </div>
        </ModalForm>
      )}
    </div>
  );
}

function Acoes({
  meta,
  podeEditar,
  onCheckin,
  onEditar,
  onRemover,
}: {
  meta: MetaComProgresso;
  podeEditar: boolean;
  onCheckin: () => void;
  onEditar: () => void;
  onRemover: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={onCheckin}
        aria-label={`Check-in de ${meta.titulo}`}
        title="Registrar check-in"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-sys-green"
      >
        <CheckCircle2 className="size-4" />
      </button>
      {podeEditar && (
        <>
          <button
            type="button"
            onClick={onEditar}
            aria-label={`Editar ${meta.titulo}`}
            title="Editar"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onRemover}
            aria-label={`Remover ${meta.titulo}`}
            title="Remover"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-sys-red"
          >
            <Trash2 className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}

function paraRascunho(m: MetaComProgresso): Rascunho {
  return {
    id: m.id,
    titulo: m.titulo,
    descricao: m.descricao ?? "",
    objetivo_id: m.objetivo_id ?? "",
    responsavel_id: m.responsavel_id ?? "",
    periodo_tipo: m.periodo_tipo,
    ano: m.ano,
    semestre: m.semestre ?? 1,
    mes: m.mes ?? 1,
    unidade: m.unidade,
    direcao: m.direcao,
    alvo: Number(m.alvo),
    fonte: m.fonte,
    realizado_manual: Number(m.realizado_manual ?? 0),
    peso: m.peso,
    incentivo_tipo: m.incentivo_tipo,
    incentivo_valor: Number(m.incentivo_valor ?? 0),
    incentivo_gatilho_pct: m.incentivo_gatilho_pct,
  };
}

function FormMeta({
  rascunho,
  setRascunho,
  objetivos,
  pessoas,
  onSalvar,
  salvando,
}: {
  rascunho: Rascunho;
  setRascunho: (r: Rascunho | null) => void;
  objetivos: PlanejamentoCompleto["objetivos"];
  pessoas: PlanejamentoCompleto["pessoas"];
  onSalvar: () => void;
  salvando: boolean;
}) {
  const set = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) =>
    setRascunho({ ...rascunho, [k]: v });

  const bloqueio =
    rascunho.titulo.trim().length < 3
      ? "Descreva a meta em pelo menos 3 letras."
      : rascunho.alvo <= 0
        ? "O alvo precisa ser maior que zero."
        : rascunho.incentivo_tipo !== "nenhum" && rascunho.incentivo_valor <= 0
          ? "Informe o valor do incentivo."
          : null;

  return (
    <ModalForm
      aberto
      largura="max-w-2xl"
      titulo={rascunho.id ? "Editar meta" : "Nova meta"}
      descricao="O alvo é o número que define sucesso. O incentivo só é devido a partir do gatilho."
      onFechar={() => setRascunho(null)}
      onSalvar={onSalvar}
      salvando={salvando}
      bloqueio={bloqueio}
    >
      <div className="space-y-4">
        <Campo label="Título">
          <input
            className={INPUT_CLS}
            value={rascunho.titulo}
            onChange={(e) => set("titulo", e.target.value)}
            placeholder="Ex: Receita recebida do mês"
          />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Objetivo estratégico" ajuda="Opcional — liga a meta ao objetivo de 3 anos.">
            <select
              className={INPUT_CLS}
              value={rascunho.objetivo_id}
              onChange={(e) => set("objetivo_id", e.target.value)}
            >
              <option value="">Sem objetivo</option>
              {objetivos.map((o) => (
                <option key={o.id} value={o.id}>{o.titulo}</option>
              ))}
            </select>
          </Campo>
          <Campo label="Responsável" ajuda="Quem responde pela meta — e quem recebe o bônus.">
            <select
              className={INPUT_CLS}
              value={rascunho.responsavel_id}
              onChange={(e) => set("responsavel_id", e.target.value)}
            >
              <option value="">Sem responsável</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Período">
            <select
              className={INPUT_CLS}
              value={rascunho.periodo_tipo}
              onChange={(e) => set("periodo_tipo", e.target.value as PeriodoTipo)}
            >
              <option value="mes">Mensal</option>
              <option value="semestre">Semestral</option>
              <option value="ano">Anual</option>
            </select>
          </Campo>
          <Campo label="Ano">
            <input
              type="number"
              className={INPUT_CLS}
              value={rascunho.ano}
              onChange={(e) => set("ano", Number(e.target.value))}
            />
          </Campo>
          {rascunho.periodo_tipo === "mes" && (
            <Campo label="Mês">
              <select
                className={INPUT_CLS}
                value={rascunho.mes}
                onChange={(e) => set("mes", Number(e.target.value))}
              >
                {MESES.map((nome, i) => (
                  <option key={nome} value={i + 1}>{nome}</option>
                ))}
              </select>
            </Campo>
          )}
          {rascunho.periodo_tipo === "semestre" && (
            <Campo label="Semestre">
              <select
                className={INPUT_CLS}
                value={rascunho.semestre}
                onChange={(e) => set("semestre", Number(e.target.value))}
              >
                <option value={1}>1º semestre</option>
                <option value={2}>2º semestre</option>
              </select>
            </Campo>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Como medir" ajuda="Escolher uma fonte automática dispensa lançamento manual.">
            <select
              className={INPUT_CLS}
              value={rascunho.fonte}
              onChange={(e) => set("fonte", e.target.value as FonteMeta)}
            >
              {(Object.keys(FONTE_LABEL) as FonteMeta[]).map((f) => (
                <option key={f} value={f}>{FONTE_LABEL[f]}</option>
              ))}
            </select>
          </Campo>
          <Campo label="Direção" ajuda="Custo (CAC) é 'menor é melhor'.">
            <select
              className={INPUT_CLS}
              value={rascunho.direcao}
              onChange={(e) => set("direcao", e.target.value as Rascunho["direcao"])}
            >
              <option value="maior_melhor">Maior é melhor</option>
              <option value="menor_melhor">Menor é melhor</option>
            </select>
          </Campo>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Unidade">
            <select
              className={INPUT_CLS}
              value={rascunho.unidade}
              onChange={(e) => set("unidade", e.target.value as UnidadeMeta)}
            >
              <option value="moeda">Reais</option>
              <option value="quantidade">Quantidade</option>
              <option value="percentual">Percentual</option>
            </select>
          </Campo>
          {rascunho.unidade === "moeda" ? (
            <CurrencyInput label="Alvo" valor={rascunho.alvo} onChange={(v) => set("alvo", v)} />
          ) : (
            <Campo label="Alvo">
              <input
                type="number"
                className={INPUT_CLS}
                value={rascunho.alvo}
                onChange={(e) => set("alvo", Number(e.target.value))}
              />
            </Campo>
          )}
          <Campo label="Peso" ajuda="1 a 10 — pondera a média do objetivo.">
            <input
              type="number"
              min={1}
              max={10}
              className={INPUT_CLS}
              value={rascunho.peso}
              onChange={(e) => set("peso", Number(e.target.value))}
            />
          </Campo>
        </div>

        <div className="rounded-xl border border-border p-3">
          <p className="mb-3 text-xs font-semibold text-foreground">Incentivo</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo label="Tipo">
              <select
                className={INPUT_CLS}
                value={rascunho.incentivo_tipo}
                onChange={(e) => set("incentivo_tipo", e.target.value as Rascunho["incentivo_tipo"])}
              >
                <option value="nenhum">Sem bônus</option>
                <option value="valor_fixo">Valor fixo</option>
                <option value="percentual_meta">% do realizado</option>
              </select>
            </Campo>
            {rascunho.incentivo_tipo !== "nenhum" && (
              <>
                {rascunho.incentivo_tipo === "valor_fixo" ? (
                  <CurrencyInput
                    label="Valor do bônus"
                    valor={rascunho.incentivo_valor}
                    onChange={(v) => set("incentivo_valor", v)}
                  />
                ) : (
                  <Campo label="Percentual (%)">
                    <input
                      type="number"
                      className={INPUT_CLS}
                      value={rascunho.incentivo_valor}
                      onChange={(e) => set("incentivo_valor", Number(e.target.value))}
                    />
                  </Campo>
                )}
                <Campo label="Gatilho (%)" ajuda="100 = só paga com a meta cheia.">
                  <input
                    type="number"
                    min={1}
                    max={200}
                    className={INPUT_CLS}
                    value={rascunho.incentivo_gatilho_pct}
                    onChange={(e) => set("incentivo_gatilho_pct", Number(e.target.value))}
                  />
                </Campo>
              </>
            )}
          </div>
        </div>

        <Campo label="Descrição da meta" ajuda="O que exatamente conta como atingido, para não haver dúvida no fechamento.">
          <textarea
            rows={3}
            className={`${INPUT_CLS} h-auto py-2`}
            value={rascunho.descricao}
            onChange={(e) => set("descricao", e.target.value)}
          />
        </Campo>
      </div>
    </ModalForm>
  );
}
