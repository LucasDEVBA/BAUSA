"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Workflow,
  Plus,
  Zap,
  Clock,
  Pencil,
  Trash2,
  X,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  History,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  EmptyState,
  BrandTabs,
  StatCard,
  type BadgeTone,
} from "@/components/ui";
import {
  GATILHO_CATALOG,
  ACAO_CATALOG,
  OPERADOR_LABEL,
  type Automacao,
  type AutomacaoComStats,
  type AutomacaoGatilho,
  type AutomacaoCondicao,
  type AutomacaoAcao,
  type AutomacaoAcaoTipo,
  type AutomacaoRunDetalhado,
  type AutomacaoRunStatus,
  type CondicaoOperador,
} from "@/types/automacao";
import { ETAPA_LABELS } from "@/types/crm";
import {
  criarAutomacao,
  atualizarAutomacao,
  alternarAtivoAutomacao,
  excluirAutomacao,
  reprocessarRun,
  type AutomacaoInput,
} from "@/lib/actions/automacoes-builder";
import { cn } from "@/lib/utils";

// ─── Constantes de UI ────────────────────────────────────────────────────────

const FIELD_CLASS =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-placeholder outline-none focus:border-primary/40";
const SECTION_LABEL = "text-eyebrow text-label-tertiary";

const ETAPA_OPCOES = Object.entries(ETAPA_LABELS).map(([value, label]) => ({ value, label }));

/** Campos de condição disponíveis por gatilho (contexto que a engine resolve). */
const CONDICAO_CAMPOS: {
  value: string;
  label: string;
  gatilhos: AutomacaoGatilho[];
  opcoes?: { value: string; label: string }[];
}[] = [
  {
    value: "classificacao",
    label: "Classificação Gemini",
    gatilhos: ["lead_qualificado", "deal_etapa_mudou", "reuniao_marcada", "deal_parado_etapa"],
    opcoes: [
      { value: "QUENTE", label: "QUENTE" },
      { value: "MORNO", label: "MORNO" },
      { value: "FRIO", label: "FRIO" },
    ],
  },
  {
    value: "etapa_para",
    label: "Etapa de destino",
    gatilhos: ["deal_etapa_mudou"],
    opcoes: ETAPA_OPCOES,
  },
  {
    value: "etapa",
    label: "Etapa atual",
    gatilhos: ["deal_parado_etapa"],
    opcoes: ETAPA_OPCOES,
  },
  {
    value: "plano",
    label: "Plano contratado",
    gatilhos: ["parcela_vencendo", "parcela_atrasada", "familia_sem_contato"],
    opcoes: [
      { value: "Legacy", label: "Legacy" },
      { value: "Journey", label: "Journey" },
      { value: "Start", label: "Start" },
    ],
  },
  {
    value: "fase",
    label: "Fase da experiência",
    gatilhos: ["familia_sem_contato", "temperatura_vermelha"],
    opcoes: [
      { value: "admissao", label: "Admissão" },
      { value: "aprovado", label: "Aprovado" },
      { value: "pre_embarque", label: "Pré-embarque" },
      { value: "embarcado_inicial", label: "Embarcado" },
      { value: "acompanhamento", label: "Acompanhamento" },
    ],
  },
  {
    value: "prioridade",
    label: "Prioridade da tarefa",
    gatilhos: ["tarefa_vencida"],
    opcoes: [
      { value: "critica", label: "Crítica" },
      { value: "alta", label: "Alta" },
      { value: "media", label: "Média" },
      { value: "baixa", label: "Baixa" },
    ],
  },
];

const TEMPLATE_OPCOES: { value: string; label: string }[] = [
  { value: "initial", label: "Mensagem inicial (agendamento)" },
  { value: "followup_1", label: "Follow-up 1 (48h)" },
  { value: "followup_2", label: "Follow-up 2 (7 dias)" },
  { value: "early_potential", label: "Timing cedo (early potential)" },
  { value: "late_timing", label: "Timing tarde (late timing)" },
  { value: "scheduled_return", label: "Retomada agendada (novembro)" },
];

interface UsuarioRow {
  id: string;
  nome: string;
  papel: string;
}

// ─── Formulário (estado do builder) ─────────────────────────────────────────

interface BuilderState {
  id: string | null;
  nome: string;
  descricao: string;
  gatilho: AutomacaoGatilho;
  gatilhoDias: number;
  condicoes: AutomacaoCondicao[];
  acoes: AutomacaoAcao[];
}

function emptyBuilder(): BuilderState {
  return {
    id: null,
    nome: "",
    descricao: "",
    gatilho: "lead_qualificado",
    gatilhoDias: 3,
    condicoes: [],
    acoes: [],
  };
}

function builderFromAutomacao(a: Automacao): BuilderState {
  const dias = a.gatilho_config?.dias;
  return {
    id: a.id,
    nome: a.nome,
    descricao: a.descricao ?? "",
    gatilho: a.gatilho,
    gatilhoDias: typeof dias === "number" ? dias : GATILHO_CATALOG[a.gatilho].configDias?.padrao ?? 3,
    condicoes: a.condicoes,
    acoes: a.acoes,
  };
}

function defaultAcao(tipo: AutomacaoAcaoTipo, usuarios: UsuarioRow[]): AutomacaoAcao {
  switch (tipo) {
    case "criar_tarefa":
      return {
        tipo,
        parametros: {
          titulo: "",
          prioridade: "alta",
          prazo_dias: 2,
          responsavel_id: usuarios[0]?.id ?? "",
        },
      };
    case "criar_notificacao":
      return {
        tipo,
        parametros: { titulo: "", mensagem: "", severidade: "alta", destinatario: "ceo" },
      };
    case "enviar_whatsapp":
      return { tipo, parametros: { template: "followup_1" } };
    case "mover_deal":
      return {
        tipo,
        parametros: { etapa_destino: "reuniao_marcada", next_action: "", proxima_acao_dias: 2 },
      };
  }
}

// ─── Componente principal ────────────────────────────────────────────────────

const RUN_STATUS_TONE: Record<AutomacaoRunStatus, BadgeTone> = {
  pendente: "blue",
  executando: "blue",
  sucesso: "green",
  erro: "red",
  ignorado: "neutral",
};

const RUN_STATUS_LABEL: Record<AutomacaoRunStatus, string> = {
  pendente: "Na fila",
  executando: "Executando",
  sucesso: "Sucesso",
  erro: "Erro",
  ignorado: "Ignorado",
};

export function AutomacoesClient({
  automacoes,
  usuarios,
  runsRecentes,
  agora,
}: {
  automacoes: AutomacaoComStats[];
  usuarios: UsuarioRow[];
  runsRecentes: AutomacaoRunDetalhado[];
  agora: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [activeTab, setActiveTab] = useState<"automacoes" | "execucoes">("automacoes");

  const salvar = () => {
    if (!builder) return;
    const gatilhoInfo = GATILHO_CATALOG[builder.gatilho];
    const input: AutomacaoInput = {
      nome: builder.nome,
      descricao: builder.descricao || undefined,
      gatilho: builder.gatilho,
      gatilho_config: gatilhoInfo.configDias ? { dias: builder.gatilhoDias } : {},
      condicoes: builder.condicoes,
      acoes: builder.acoes,
    };
    startTransition(async () => {
      const result = builder.id
        ? await atualizarAutomacao(builder.id, input)
        : await criarAutomacao(input);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao salvar automação");
        return;
      }
      toast.success(builder.id ? "Automação atualizada" : "Automação criada (pausada — ative quando quiser)");
      setBuilder(null);
      router.refresh();
    });
  };

  const alternar = (a: AutomacaoComStats) => {
    startTransition(async () => {
      const result = await alternarAtivoAutomacao(a.id, !a.ativo);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao alterar status");
        return;
      }
      toast.success(!a.ativo ? `“${a.nome}” ativada` : `“${a.nome}” pausada`);
      router.refresh();
    });
  };

  const excluir = (a: AutomacaoComStats) => {
    if (!window.confirm(`Excluir a automação “${a.nome}”? Os runs históricos são preservados.`)) return;
    startTransition(async () => {
      const result = await excluirAutomacao(a.id);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao excluir");
        return;
      }
      toast.success("Automação excluída");
      router.refresh();
    });
  };

  const replay = (runId: string) => {
    startTransition(async () => {
      const result = await reprocessarRun(runId);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao reprocessar");
        return;
      }
      toast.success("Run reenfileirado — a engine reprocessa no próximo tick");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistema"
        title="Automações"
        description="Crie fluxos gatilho → condições → ações e acompanhe cada execução."
        actions={
          <Button onClick={() => setBuilder(emptyBuilder())}>
            <Plus className="h-4 w-4" />
            Nova automação
          </Button>
        }
      />

      <BrandTabs
        variant="segmented"
        items={[
          { id: "automacoes", label: "Automações", icon: Workflow },
          { id: "execucoes", label: "Execuções", icon: History },
        ]}
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as "automacoes" | "execucoes")}
        ariaLabel="Visões de automações"
      />

      {activeTab === "execucoes" && (
        <ExecucoesView runs={runsRecentes} agora={agora} isPending={isPending} onReplay={replay} />
      )}

      {activeTab === "automacoes" && (automacoes.length === 0 ? (
        <Card variant="plain" padding="none">
          <EmptyState
            icon={Workflow}
            title="Nenhuma automação criada"
            description="Monte seu primeiro fluxo: escolha um gatilho, adicione condições e defina as ações."
            action={
              <Button onClick={() => setBuilder(emptyBuilder())}>
                <Plus className="h-4 w-4" />
                Criar automação
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {automacoes.map((a) => {
            const gatilho = GATILHO_CATALOG[a.gatilho];
            const OrigemIcon = gatilho.origem === "evento" ? Zap : Clock;
            return (
              <Card key={a.id} padding="md" accent={a.ativo ? "green" : "neutral"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{a.nome}</p>
                      <Badge tone={a.ativo ? "green" : "neutral"} size="sm">
                        {a.ativo ? "Ativa" : "Pausada"}
                      </Badge>
                      <Badge tone="brand" size="sm">
                        <OrigemIcon className="h-2.5 w-2.5" />
                        {gatilho.label}
                      </Badge>
                    </div>
                    {a.descricao && (
                      <p className="mt-1 text-xs text-muted-foreground">{a.descricao}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-label-tertiary">
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className="h-3 w-3" />
                        {a.condicoes.length} condição{a.condicoes.length !== 1 ? "es" : ""} ·{" "}
                        {a.acoes.map((ac) => ACAO_CATALOG[ac.tipo].label).join(" + ")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-sys-green" />
                        {a.runs_sucesso} sucesso{a.runs_sucesso !== 1 ? "s" : ""}
                      </span>
                      {a.runs_erro > 0 && (
                        <span className="inline-flex items-center gap-1 text-sys-red">
                          <AlertTriangle className="h-3 w-3" />
                          {a.runs_erro} erro{a.runs_erro !== 1 ? "s" : ""}
                        </span>
                      )}
                      {a.runs_pendente > 0 && <span>{a.runs_pendente} na fila</span>}
                      {a.ultimo_run_at && (
                        <span>
                          Último disparo: {new Date(a.ultimo_run_at).toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {/* Toggle ativo/pausada */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={a.ativo}
                      aria-label={a.ativo ? `Pausar ${a.nome}` : `Ativar ${a.nome}`}
                      disabled={isPending}
                      onClick={() => alternar(a)}
                      className={cn(
                        "relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                        a.ativo ? "bg-sys-green" : "bg-fill-2",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
                          a.ativo ? "translate-x-4" : "translate-x-0.5",
                        )}
                      />
                    </button>
                    <Button variant="ghost" size="sm" aria-label={`Editar ${a.nome}`} onClick={() => setBuilder(builderFromAutomacao(a))}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Excluir ${a.nome}`} onClick={() => excluir(a)}>
                      <Trash2 className="h-3.5 w-3.5 text-sys-red" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ))}

      {builder && (
        <BuilderModal
          builder={builder}
          usuarios={usuarios}
          isPending={isPending}
          onChange={setBuilder}
          onClose={() => setBuilder(null)}
          onSave={salvar}
        />
      )}
    </div>
  );
}

// ─── Execuções (acompanhamento real por run) ────────────────────────────────

function resumoResultado(run: AutomacaoRunDetalhado): string {
  const r = run.resultado as {
    motivo?: string;
    acoes?: { tipo: string; status: string; detalhe?: string }[];
  };
  if (r?.motivo) return r.motivo;
  if (Array.isArray(r?.acoes) && r.acoes.length > 0) {
    return r.acoes
      .map((a) => `${ACAO_CATALOG[a.tipo as AutomacaoAcaoTipo]?.label ?? a.tipo}: ${a.status}`)
      .join(" · ");
  }
  return "—";
}

function ExecucoesView({
  runs,
  agora,
  isPending,
  onReplay,
}: {
  runs: AutomacaoRunDetalhado[];
  agora: number;
  isPending: boolean;
  onReplay: (runId: string) => void;
}) {
  const seteDiasAtras = agora - 7 * 86400000;
  const recentes = runs.filter((r) => new Date(r.created_at).getTime() >= seteDiasAtras);
  const kpi = {
    total: recentes.length,
    sucesso: recentes.filter((r) => r.status === "sucesso").length,
    erro: recentes.filter((r) => r.status === "erro").length,
    fila: recentes.filter((r) => r.status === "pendente" || r.status === "executando").length,
  };

  return (
    <div className="space-y-5">
      {/* KPI strip — últimos 7 dias */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Execuções (7d)" value={kpi.total} icon={History} accent="brand" />
        <StatCard label="Sucesso" value={kpi.sucesso} icon={CheckCircle2} accent="green" />
        <StatCard
          label="Erro"
          value={kpi.erro}
          icon={AlertTriangle}
          accent={kpi.erro > 0 ? "red" : "green"}
        />
        <StatCard label="Na fila" value={kpi.fila} icon={Clock} accent="blue" />
      </div>

      {runs.length === 0 ? (
        <Card variant="plain" padding="none">
          <EmptyState
            icon={History}
            title="Nenhuma execução ainda"
            description="Ative uma automação — os disparos aparecem aqui com status, tentativas e resultado."
          />
        </Card>
      ) : (
        <Card variant="plain" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="py-2.5 pl-4 pr-3 text-left text-eyebrow text-muted-foreground">Quando</th>
                  <th className="px-3 py-2.5 text-left text-eyebrow text-muted-foreground">Automação</th>
                  <th className="px-3 py-2.5 text-left text-eyebrow text-muted-foreground">Origem</th>
                  <th className="px-3 py-2.5 text-left text-eyebrow text-muted-foreground">Status</th>
                  <th className="px-3 py-2.5 text-left text-eyebrow text-muted-foreground">Tent.</th>
                  <th className="px-3 py-2.5 text-left text-eyebrow text-muted-foreground">Resultado</th>
                  <th className="px-3 py-2.5 text-right text-eyebrow text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const gatilho = run.automacoes ? GATILHO_CATALOG[run.automacoes.gatilho] : null;
                  return (
                    <tr key={run.id} className="border-b border-border transition-colors hover:bg-accent">
                      <td className="py-2.5 pl-4 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(run.created_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-medium text-foreground">
                          {run.automacoes?.nome ?? "(removida)"}
                        </p>
                        {gatilho && (
                          <p className="text-[10px] text-label-tertiary">{gatilho.label}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {run.gatilho_origem_tabela ?? "—"}
                        {run.gatilho_origem_id ? ` · ${run.gatilho_origem_id.slice(0, 8)}` : ""}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={RUN_STATUS_TONE[run.status]} size="sm">
                          {RUN_STATUS_LABEL[run.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{run.tentativas}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[320px] truncate">
                        {resumoResultado(run)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {run.status === "erro" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isPending}
                            aria-label="Reprocessar run"
                            onClick={() => onReplay(run.id)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reprocessar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Builder modal (gatilho → condições → ações) ────────────────────────────

function BuilderModal({
  builder,
  usuarios,
  isPending,
  onChange,
  onClose,
  onSave,
}: {
  builder: BuilderState;
  usuarios: UsuarioRow[];
  isPending: boolean;
  onChange: (b: BuilderState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const gatilhoInfo = GATILHO_CATALOG[builder.gatilho];
  const camposDisponiveis = CONDICAO_CAMPOS.filter((c) => c.gatilhos.includes(builder.gatilho));

  const setCondicao = (i: number, patch: Partial<AutomacaoCondicao>) => {
    const next = builder.condicoes.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    onChange({ ...builder, condicoes: next });
  };

  const setAcaoParametro = (i: number, campo: string, valor: string | number) => {
    const next = builder.acoes.map((a, idx) =>
      idx === i ? ({ ...a, parametros: { ...a.parametros, [campo]: valor } } as AutomacaoAcao) : a,
    );
    onChange({ ...builder, acoes: next });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/20 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={builder.id ? "Editar automação" : "Nova automação"}
        className="liquid-glass my-8 w-full max-w-2xl rounded-2xl p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-title-3 text-foreground">
            {builder.id ? "Editar automação" : "Nova automação"}
          </h2>
          <Button variant="ghost" size="sm" aria-label="Fechar" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5">
          {/* Identificação */}
          <section className="space-y-2">
            <p className={SECTION_LABEL}>Identificação</p>
            <Input
              placeholder="Nome da automação (ex.: Régua D-3 — lembrete de parcela)"
              value={builder.nome}
              onChange={(e) => onChange({ ...builder, nome: e.target.value })}
            />
            <Input
              placeholder="Descrição (opcional)"
              value={builder.descricao}
              onChange={(e) => onChange({ ...builder, descricao: e.target.value })}
            />
          </section>

          {/* Gatilho */}
          <section className="space-y-2">
            <p className={SECTION_LABEL}>1 · Gatilho</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                aria-label="Gatilho"
                className={FIELD_CLASS}
                value={builder.gatilho}
                onChange={(e) => {
                  const gatilho = e.target.value as AutomacaoGatilho;
                  onChange({
                    ...builder,
                    gatilho,
                    gatilhoDias: GATILHO_CATALOG[gatilho].configDias?.padrao ?? builder.gatilhoDias,
                    condicoes: [], // catálogo de campos muda com o gatilho
                  });
                }}
              >
                {Object.entries(GATILHO_CATALOG).map(([value, info]) => (
                  <option key={value} value={value}>
                    {info.origem === "evento" ? "⚡" : "⏱"} {info.label}
                  </option>
                ))}
              </select>
              {gatilhoInfo.configDias && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    aria-label={gatilhoInfo.configDias.label}
                    value={String(builder.gatilhoDias)}
                    onChange={(e) => onChange({ ...builder, gatilhoDias: Number(e.target.value) })}
                  />
                  <span className="shrink-0 text-[10px] text-label-tertiary">
                    {gatilhoInfo.configDias.label}
                  </span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-label-tertiary">{gatilhoInfo.descricao}</p>
          </section>

          {/* Condições */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className={SECTION_LABEL}>2 · Condições (opcional)</p>
              {camposDisponiveis.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...builder,
                      condicoes: [
                        ...builder.condicoes,
                        {
                          campo: camposDisponiveis[0].value,
                          operador: "eq",
                          valor: camposDisponiveis[0].opcoes?.[0]?.value ?? "",
                        },
                      ],
                    })
                  }
                >
                  <Plus className="h-3 w-3" />
                  Condição
                </Button>
              )}
            </div>
            {builder.condicoes.length === 0 ? (
              <p className="text-[10px] text-label-tertiary">
                Sem condições — dispara para todo evento do gatilho.
              </p>
            ) : (
              builder.condicoes.map((cond, i) => {
                const campoInfo = CONDICAO_CAMPOS.find((c) => c.value === cond.campo);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      aria-label="Campo"
                      className={FIELD_CLASS}
                      value={cond.campo}
                      onChange={(e) => {
                        const novo = CONDICAO_CAMPOS.find((c) => c.value === e.target.value);
                        setCondicao(i, {
                          campo: e.target.value,
                          valor: novo?.opcoes?.[0]?.value ?? "",
                        });
                      }}
                    >
                      {camposDisponiveis.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Operador"
                      className={cn(FIELD_CLASS, "max-w-24")}
                      value={cond.operador}
                      onChange={(e) => setCondicao(i, { operador: e.target.value as CondicaoOperador })}
                    >
                      {(["eq", "neq", "in"] as CondicaoOperador[]).map((op) => (
                        <option key={op} value={op}>
                          {OPERADOR_LABEL[op]}
                        </option>
                      ))}
                    </select>
                    {campoInfo?.opcoes ? (
                      <select
                        aria-label="Valor"
                        className={FIELD_CLASS}
                        value={String(cond.valor)}
                        onChange={(e) => setCondicao(i, { valor: e.target.value })}
                      >
                        {campoInfo.opcoes.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        aria-label="Valor"
                        value={String(cond.valor)}
                        onChange={(e) => setCondicao(i, { valor: e.target.value })}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Remover condição"
                      onClick={() =>
                        onChange({ ...builder, condicoes: builder.condicoes.filter((_, idx) => idx !== i) })
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </section>

          {/* Ações */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className={SECTION_LABEL}>3 · Ações</p>
              <div className="flex gap-1.5">
                {(Object.keys(ACAO_CATALOG) as AutomacaoAcaoTipo[]).map((tipo) => (
                  <Button
                    key={tipo}
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      onChange({ ...builder, acoes: [...builder.acoes, defaultAcao(tipo, usuarios)] })
                    }
                  >
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
                    onClick={() =>
                      onChange({ ...builder, acoes: builder.acoes.filter((_, idx) => idx !== i) })
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {acao.tipo === "criar_tarefa" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Título da tarefa"
                      value={acao.parametros.titulo}
                      onChange={(e) => setAcaoParametro(i, "titulo", e.target.value)}
                    />
                    <select
                      aria-label="Responsável"
                      className={FIELD_CLASS}
                      value={acao.parametros.responsavel_id}
                      onChange={(e) => setAcaoParametro(i, "responsavel_id", e.target.value)}
                    >
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Prioridade"
                      className={FIELD_CLASS}
                      value={acao.parametros.prioridade}
                      onChange={(e) => setAcaoParametro(i, "prioridade", e.target.value)}
                    >
                      <option value="critica">Crítica</option>
                      <option value="alta">Alta</option>
                      <option value="media">Média</option>
                      <option value="baixa">Baixa</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        aria-label="Prazo em dias"
                        value={String(acao.parametros.prazo_dias)}
                        onChange={(e) => setAcaoParametro(i, "prazo_dias", Number(e.target.value))}
                      />
                      <span className="shrink-0 text-[10px] text-label-tertiary">dias de prazo</span>
                    </div>
                  </div>
                )}

                {acao.tipo === "criar_notificacao" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Título"
                      value={acao.parametros.titulo}
                      onChange={(e) => setAcaoParametro(i, "titulo", e.target.value)}
                    />
                    <select
                      aria-label="Destinatário"
                      className={FIELD_CLASS}
                      value={acao.parametros.destinatario}
                      onChange={(e) => setAcaoParametro(i, "destinatario", e.target.value)}
                    >
                      <option value="ceo">CEO</option>
                      <option value="head_sucesso">Head de Sucesso</option>
                      <option value="responsavel">Responsável do registro</option>
                    </select>
                    <Input
                      className="sm:col-span-2"
                      placeholder="Mensagem"
                      value={acao.parametros.mensagem}
                      onChange={(e) => setAcaoParametro(i, "mensagem", e.target.value)}
                    />
                    <select
                      aria-label="Severidade"
                      className={FIELD_CLASS}
                      value={acao.parametros.severidade}
                      onChange={(e) => setAcaoParametro(i, "severidade", e.target.value)}
                    >
                      <option value="critica">Crítica</option>
                      <option value="alta">Alta</option>
                      <option value="media">Média</option>
                      <option value="baixa">Baixa</option>
                    </select>
                  </div>
                )}

                {acao.tipo === "enviar_whatsapp" && (
                  <div className="space-y-1.5">
                    <select
                      aria-label="Template"
                      className={FIELD_CLASS}
                      value={acao.parametros.template}
                      onChange={(e) => setAcaoParametro(i, "template", e.target.value)}
                    >
                      {TEMPLATE_OPCOES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-label-tertiary">
                      A engine reaplica a elegibilidade (QUENTE/MORNO, anti-ban) — FRIO nunca recebe.
                    </p>
                  </div>
                )}

                {acao.tipo === "mover_deal" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      aria-label="Etapa de destino"
                      className={FIELD_CLASS}
                      value={acao.parametros.etapa_destino}
                      onChange={(e) => setAcaoParametro(i, "etapa_destino", e.target.value)}
                    >
                      {ETAPA_OPCOES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        aria-label="Próxima ação em dias"
                        value={String(acao.parametros.proxima_acao_dias)}
                        onChange={(e) => setAcaoParametro(i, "proxima_acao_dias", Number(e.target.value))}
                      />
                      <span className="shrink-0 text-[10px] text-label-tertiary">dias p/ próxima ação</span>
                    </div>
                    <Input
                      className="sm:col-span-2"
                      placeholder="Próxima ação (obrigatória — regra do pipeline)"
                      value={acao.parametros.next_action}
                      onChange={(e) => setAcaoParametro(i, "next_action", e.target.value)}
                    />
                  </div>
                )}
              </Card>
            ))}
          </section>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={isPending || !builder.nome || builder.acoes.length === 0}>
            {builder.id ? "Salvar alterações" : "Criar automação"}
          </Button>
        </div>
      </div>
    </div>
  );
}
