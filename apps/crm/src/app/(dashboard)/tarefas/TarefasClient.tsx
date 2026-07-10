"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Plus,
  X,
  Save,
  Search,
  Layers,
  Pencil,
  Send,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card, Button, Badge, Input } from "@/components/ui";
import { criarTarefa } from "@/lib/actions/automacoes";
import { atualizarTarefa } from "@/lib/actions/tarefas";
import { moverTarefaQuadro, atribuirSprintTarefa } from "@/lib/actions/tarefas-kanban";
import { cn } from "@/lib/utils";
import type { Tarefa, Sprint, PrioridadeTarefa, QuadroColuna, StatusTarefa } from "@/types/crm";
import { TarefaCard } from "@/components/tarefas/TarefaCard";
import { TarefaColuna } from "@/components/tarefas/TarefaColuna";
import { SprintModal } from "@/components/tarefas/SprintModal";
import {
  COLUNAS_CONFIG,
  PRIORIDADE_ORDER,
  type RecorrenciaTarefa,
  parseComments,
  getDescriptionWithoutComments,
  getCommentLines,
  buildCommentLine,
} from "@/components/tarefas/tarefa-utils";

const PRIORIDADE_TABS: { value: PrioridadeTarefa | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "critica", label: "Crítica" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Média" },
  { value: "baixa", label: "Baixa" },
];

const MODULO_TABS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "comercial", label: "Comercial" },
  { value: "experiencia", label: "Experiência" },
  { value: "financeiro", label: "Financeiro" },
  { value: "admissao", label: "Admissão" },
];

const SPRINT_STATUS_TONE: Record<Sprint["status"], "neutral" | "green" | "blue"> = {
  planejada: "neutral",
  ativa: "blue",
  concluida: "green",
};

// Filtro de sprint: "todas" | "sem_sprint" | <sprintId>
type SprintFiltro = string;

interface TarefaFormData {
  titulo: string;
  descricao: string;
  prazo: string;
  prioridade: PrioridadeTarefa;
  modulo_origem: "comercial" | "experiencia" | "financeiro" | "admissao";
  recorrencia: RecorrenciaTarefa;
  sprint_id: string | "";
}

const EMPTY_FORM: TarefaFormData = {
  titulo: "",
  descricao: "",
  prazo: "",
  prioridade: "media",
  modulo_origem: "comercial",
  recorrencia: "nenhuma",
  sprint_id: "",
};

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary focus:ring-1 focus:ring-primary/30";
const labelClass = "text-xs font-medium text-muted-foreground";
const selectClass = cn(inputClass, "appearance-none");

function statusDaColuna(coluna: QuadroColuna): StatusTarefa {
  if (coluna === "feito") return "concluida";
  if (coluna === "fazendo") return "em_andamento";
  return "pendente";
}

function fmtData(iso: string | null): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

interface TarefasClientProps {
  tarefasIniciais: Tarefa[];
  sprintsIniciais: Sprint[];
  currentUserId: string;
  isCeo: boolean;
  usuarios: { id: string; nome: string }[];
}

export function TarefasClient({
  tarefasIniciais,
  sprintsIniciais,
  currentUserId,
  isCeo,
  usuarios,
}: TarefasClientProps) {
  const [tarefas, setTarefas] = useState<Tarefa[]>(tarefasIniciais);
  const [sprints, setSprints] = useState<Sprint[]>(sprintsIniciais);

  const sprintAtivaId = useMemo(
    () => sprints.find((s) => s.status === "ativa")?.id ?? null,
    [sprints],
  );
  const [sprintFiltro, setSprintFiltro] = useState<SprintFiltro>(sprintAtivaId ?? "todas");
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<PrioridadeTarefa | "todas">("todas");
  const [moduloFiltro, setModuloFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modal de tarefa
  const [showModal, setShowModal] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null);
  const [form, setForm] = useState<TarefaFormData>(EMPTY_FORM);
  const [responsavelId, setResponsavelId] = useState(currentUserId);
  const [newComment, setNewComment] = useState("");

  // Modal de sprint
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);

  // Drag
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const usuarioNomeMap = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nome])), [usuarios]);
  const sprintNomeMap = useMemo(() => new Map(sprints.map((s) => [s.id, s.nome])), [sprints]);

  // Form inicializado no clique (evento) — não em effect.
  const openCreateModal = () => {
    setForm({
      ...EMPTY_FORM,
      // Nova tarefa herda a sprint atualmente filtrada (se específica).
      sprint_id: sprintFiltro !== "todas" && sprintFiltro !== "sem_sprint" ? sprintFiltro : "",
    });
    setResponsavelId(currentUserId);
    setNewComment("");
    setEditingTarefa(null);
    setShowModal(true);
  };
  const openEditModal = (tarefa: Tarefa) => {
    setForm({
      titulo: tarefa.titulo,
      descricao: getDescriptionWithoutComments(tarefa.descricao),
      prazo: tarefa.prazo ? new Date(tarefa.prazo).toISOString().slice(0, 16) : "",
      prioridade: tarefa.prioridade,
      modulo_origem: tarefa.modulo_origem,
      recorrencia: tarefa.recorrencia ?? "nenhuma",
      sprint_id: tarefa.sprint_id ?? "",
    });
    setResponsavelId(tarefa.responsavel_id);
    setNewComment("");
    setEditingTarefa(tarefa);
    setShowModal(true);
  };
  const closeModal = () => {
    setShowModal(false);
    setEditingTarefa(null);
  };

  // ── Filtro + agrupamento por coluna ────────────────────────────────
  const tarefasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return tarefas
      .filter((t) => {
        if (sprintFiltro === "todas") return true;
        if (sprintFiltro === "sem_sprint") return !t.sprint_id;
        return t.sprint_id === sprintFiltro;
      })
      .filter((t) => prioridadeFiltro === "todas" || t.prioridade === prioridadeFiltro)
      .filter((t) => moduloFiltro === "todos" || t.modulo_origem === moduloFiltro)
      .filter((t) => !q || t.titulo.toLowerCase().includes(q));
  }, [tarefas, sprintFiltro, prioridadeFiltro, moduloFiltro, busca]);

  const tarefasPorColuna = useMemo(() => {
    const map: Record<QuadroColuna, Tarefa[]> = {
      backlog: [],
      a_fazer: [],
      fazendo: [],
      feito: [],
    };
    for (const t of tarefasFiltradas) map[t.quadro_coluna]?.push(t);
    for (const col of Object.keys(map) as QuadroColuna[]) {
      map[col].sort((a, b) => {
        const pa = PRIORIDADE_ORDER[a.prioridade] ?? 2;
        const pb = PRIORIDADE_ORDER[b.prioridade] ?? 2;
        if (pa !== pb) return pa - pb;
        return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
      });
    }
    return map;
  }, [tarefasFiltradas]);

  const sprintSelecionada =
    sprintFiltro !== "todas" && sprintFiltro !== "sem_sprint"
      ? sprints.find((s) => s.id === sprintFiltro) ?? null
      : null;

  // Progresso da sprint selecionada (concluídas / total, ignorando filtros de prioridade/módulo).
  const progressoSprint = useMemo(() => {
    if (!sprintSelecionada) return null;
    const daSprint = tarefas.filter((t) => t.sprint_id === sprintSelecionada.id);
    const feito = daSprint.filter((t) => t.quadro_coluna === "feito").length;
    return { feito, total: daSprint.length };
  }, [sprintSelecionada, tarefas]);

  // ── Drag & drop ────────────────────────────────────────────────────
  const activeTarefa = activeId ? tarefas.find((t) => t.id === activeId) ?? null : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const tarefaId = active.id as string;
    const novaColuna = over.id as QuadroColuna;
    const tarefa = tarefas.find((t) => t.id === tarefaId);
    if (!tarefa || tarefa.quadro_coluna === novaColuna) return;

    const snapshot = tarefa; // objeto anterior completo, p/ revert fiel
    const agora = new Date().toISOString();
    setTarefas((prev) =>
      prev.map((t) =>
        t.id === tarefaId
          ? {
              ...t,
              quadro_coluna: novaColuna,
              status: statusDaColuna(novaColuna),
              completed_at: novaColuna === "feito" ? agora : null,
            }
          : t,
      ),
    );

    startTransition(async () => {
      const result = await moverTarefaQuadro(tarefaId, novaColuna);
      if (result.success) {
        toast.success(`Movida para ${COLUNAS_CONFIG.find((c) => c.key === novaColuna)?.label}`);
      } else {
        setTarefas((prev) => prev.map((t) => (t.id === tarefaId ? snapshot : t)));
        toast.error(result.error ?? "Erro ao mover tarefa");
      }
    });
  };

  // ── Criar / editar tarefa ──────────────────────────────────────────
  const handleSubmit = () => {
    if (!form.titulo.trim()) return toast.error("Título é obrigatório");
    if (!form.prazo) return toast.error("Prazo é obrigatório");

    const sprintId = form.sprint_id || null;

    startTransition(async () => {
      if (editingTarefa) {
        // Preserva os comentários embutidos ao regravar a descrição.
        const comentarios = getCommentLines(editingTarefa.descricao);
        const descricaoFinal =
          [form.descricao.trim(), ...comentarios].filter(Boolean).join("\n") || undefined;

        const result = await atualizarTarefa(editingTarefa.id, {
          titulo: form.titulo,
          descricao: descricaoFinal,
          prazo: new Date(form.prazo).toISOString(),
          prioridade: form.prioridade,
          modulo_origem: form.modulo_origem,
          responsavel_id: responsavelId,
          recorrencia: form.recorrencia,
        });
        if (!result.success) {
          toast.error(result.error ?? "Erro ao atualizar tarefa");
          return;
        }

        // Sprint é alterada por action própria (fora do atualizarTarefa).
        if ((editingTarefa.sprint_id ?? null) !== sprintId) {
          await atribuirSprintTarefa(editingTarefa.id, sprintId);
        }

        setTarefas((prev) =>
          prev.map((t) =>
            t.id === editingTarefa.id
              ? {
                  ...t,
                  titulo: form.titulo,
                  descricao: descricaoFinal ?? null,
                  prazo: new Date(form.prazo).toISOString(),
                  prioridade: form.prioridade,
                  modulo_origem: form.modulo_origem,
                  responsavel_id: responsavelId,
                  recorrencia: form.recorrencia,
                  sprint_id: sprintId,
                }
              : t,
          ),
        );
        toast.success("Tarefa atualizada");
        closeModal();
      } else {
        const result = await criarTarefa({
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          prazo: new Date(form.prazo).toISOString(),
          prioridade: form.prioridade,
          modulo_origem: form.modulo_origem,
          responsavel_id: responsavelId,
          recorrencia: form.recorrencia,
          sprint_id: sprintId,
          quadro_coluna: sprintId ? "a_fazer" : "backlog",
        });
        if (!result.success || !result.tarefaId) {
          toast.error(result.error ?? "Erro ao criar tarefa");
          return;
        }
        const now = new Date().toISOString();
        const nova: Tarefa = {
          id: result.tarefaId,
          titulo: form.titulo,
          descricao: form.descricao || null,
          responsavel_id: responsavelId,
          prazo: new Date(form.prazo).toISOString(),
          prioridade: form.prioridade,
          status: "pendente",
          deal_id: null,
          atleta_id: null,
          experiencia_id: null,
          modulo_origem: form.modulo_origem,
          criada_automaticamente: false,
          recorrencia: form.recorrencia,
          sprint_id: sprintId,
          quadro_coluna: sprintId ? "a_fazer" : "backlog",
          completed_at: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        };
        setTarefas((prev) => [nova, ...prev]);
        toast.success("Tarefa criada");
        closeModal();
      }
    });
  };

  const handleAddComment = () => {
    if (!editingTarefa || !newComment.trim()) return;
    const autor = usuarioNomeMap.get(currentUserId) ?? "Usuário";
    const linha = buildCommentLine(autor, newComment.trim());
    const novaDescricao = editingTarefa.descricao
      ? `${editingTarefa.descricao}\n${linha}`
      : linha;

    startTransition(async () => {
      const result = await atualizarTarefa(editingTarefa.id, { descricao: novaDescricao });
      if (result.success) {
        setEditingTarefa((prev) => (prev ? { ...prev, descricao: novaDescricao } : prev));
        setTarefas((prev) =>
          prev.map((t) => (t.id === editingTarefa.id ? { ...t, descricao: novaDescricao } : t)),
        );
        setNewComment("");
        toast.success("Comentário adicionado");
      } else {
        toast.error(result.error ?? "Erro ao adicionar comentário");
      }
    });
  };

  // ── Sprint modal ───────────────────────────────────────────────────
  const openNovaSprint = () => {
    setEditingSprint(null);
    setShowSprintModal(true);
  };
  const openEditSprint = (sprint: Sprint) => {
    setEditingSprint(sprint);
    setShowSprintModal(true);
  };
  const handleSprintSaved = (sprint: Sprint) => {
    setSprints((prev) => {
      const existe = prev.some((s) => s.id === sprint.id);
      return existe ? prev.map((s) => (s.id === sprint.id ? sprint : s)) : [sprint, ...prev];
    });
    setSprintFiltro(sprint.id);
    setShowSprintModal(false);
  };
  const handleSprintDeleted = (sprintId: string) => {
    setSprints((prev) => prev.filter((s) => s.id !== sprintId));
    setTarefas((prev) =>
      prev.map((t) => (t.sprint_id === sprintId ? { ...t, sprint_id: null } : t)),
    );
    if (sprintFiltro === sprintId) setSprintFiltro("todas");
    setShowSprintModal(false);
  };

  const comentariosEdicao = editingTarefa ? parseComments(editingTarefa.descricao) : [];

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        eyebrow="Sistema"
        title="Tarefas"
        description="Quadro Kanban por sprint — arraste os cartões entre as colunas."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={openNovaSprint}>
              <Layers className="h-4 w-4" />
              Nova sprint
            </Button>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Nova tarefa
            </Button>
          </div>
        }
      />

      {/* Barra de sprints */}
      <Card padding="sm" className="flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <SprintChip
            ativo={sprintFiltro === "todas"}
            onClick={() => setSprintFiltro("todas")}
            label="Todas"
          />
          <SprintChip
            ativo={sprintFiltro === "sem_sprint"}
            onClick={() => setSprintFiltro("sem_sprint")}
            label="Sem sprint"
          />
          {sprints.map((s) => (
            <SprintChip
              key={s.id}
              ativo={sprintFiltro === s.id}
              onClick={() => setSprintFiltro(s.id)}
              label={s.nome}
              tone={SPRINT_STATUS_TONE[s.status]}
            />
          ))}
        </div>

        {sprintSelecionada && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-2.5">
            <div className="flex items-center gap-2">
              <Badge tone={SPRINT_STATUS_TONE[sprintSelecionada.status]} size="sm">
                {sprintSelecionada.status}
              </Badge>
              {sprintSelecionada.objetivo && (
                <span className="text-xs text-muted-foreground">{sprintSelecionada.objetivo}</span>
              )}
            </div>
            {(sprintSelecionada.data_inicio || sprintSelecionada.data_fim) && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {fmtData(sprintSelecionada.data_inicio)}
                {sprintSelecionada.data_fim ? ` – ${fmtData(sprintSelecionada.data_fim)}` : ""}
              </span>
            )}
            {progressoSprint && progressoSprint.total > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-sys-green"
                    style={{
                      width: `${Math.round((progressoSprint.feito / progressoSprint.total) * 100)}%`,
                    }}
                    aria-hidden
                  />
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {progressoSprint.feito}/{progressoSprint.total} feito
                </span>
              </div>
            )}
            <button
              onClick={() => openEditSprint(sprintSelecionada)}
              className="ml-auto flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <Pencil className="h-3 w-3" />
              Editar sprint
            </button>
          </div>
        )}
      </Card>

      {/* Filtros compactos */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-lg border border-border bg-card p-0.5">
            {PRIORIDADE_TABS.map((tab) => (
              <FiltroBtn
                key={tab.value}
                ativo={prioridadeFiltro === tab.value}
                onClick={() => setPrioridadeFiltro(tab.value)}
                label={tab.label}
              />
            ))}
          </div>
          <div className="flex gap-0.5 rounded-lg border border-border bg-card p-0.5">
            {MODULO_TABS.map((tab) => (
              <FiltroBtn
                key={tab.value}
                ativo={moduloFiltro === tab.value}
                onClick={() => setModuloFiltro(tab.value)}
                label={tab.label}
              />
            ))}
          </div>
        </div>
        <div className="relative lg:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar tarefa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Kanban */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
          {COLUNAS_CONFIG.map((coluna) => (
            <TarefaColuna
              key={coluna.key}
              coluna={coluna}
              count={tarefasPorColuna[coluna.key].length}
            >
              {tarefasPorColuna[coluna.key].map((tarefa) => (
                <TarefaCard
                  key={tarefa.id}
                  tarefa={tarefa}
                  responsavelNome={usuarioNomeMap.get(tarefa.responsavel_id)}
                  sprintNome={tarefa.sprint_id ? sprintNomeMap.get(tarefa.sprint_id) : null}
                  onClick={() => openEditModal(tarefa)}
                />
              ))}
            </TarefaColuna>
          ))}
        </div>
        <DragOverlay>
          {activeTarefa ? (
            <TarefaCard
              tarefa={activeTarefa}
              responsavelNome={usuarioNomeMap.get(activeTarefa.responsavel_id)}
              sprintNome={activeTarefa.sprint_id ? sprintNomeMap.get(activeTarefa.sprint_id) : null}
              isDragging
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal de tarefa */}
      {showModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="liquid-glass flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-foreground">
                  {editingTarefa ? "Editar tarefa" : "Nova tarefa"}
                </h2>
                <button
                  onClick={closeModal}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-fill-4 hover:text-foreground"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto px-6 py-5">
                <div className="space-y-1.5">
                  <label className={labelClass}>Título *</label>
                  <input
                    value={form.titulo}
                    onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                    placeholder="Ex: Ligar para responsável..."
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Descrição</label>
                  <textarea
                    value={form.descricao}
                    onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                    placeholder="Detalhes da tarefa..."
                    rows={3}
                    className={cn(inputClass, "resize-none")}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Prazo *</label>
                    <input
                      type="datetime-local"
                      value={form.prazo}
                      onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Sprint</label>
                    <select
                      value={form.sprint_id}
                      onChange={(e) => setForm((f) => ({ ...f, sprint_id: e.target.value }))}
                      className={selectClass}
                    >
                      <option value="">Backlog (sem sprint)</option>
                      {sprints.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Prioridade</label>
                    <select
                      value={form.prioridade}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, prioridade: e.target.value as PrioridadeTarefa }))
                      }
                      className={selectClass}
                    >
                      <option value="critica">Crítica</option>
                      <option value="alta">Alta</option>
                      <option value="media">Média</option>
                      <option value="baixa">Baixa</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Módulo</label>
                    <select
                      value={form.modulo_origem}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          modulo_origem: e.target.value as TarefaFormData["modulo_origem"],
                        }))
                      }
                      className={selectClass}
                    >
                      <option value="comercial">Comercial</option>
                      <option value="experiencia">Experiência</option>
                      <option value="financeiro">Financeiro</option>
                      <option value="admissao">Admissão</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Recorrência</label>
                    <select
                      value={form.recorrencia}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, recorrencia: e.target.value as RecorrenciaTarefa }))
                      }
                      className={selectClass}
                    >
                      <option value="nenhuma">Nenhuma</option>
                      <option value="diaria">Diária</option>
                      <option value="semanal">Semanal</option>
                      <option value="mensal">Mensal</option>
                    </select>
                  </div>
                  {usuarios.length > 1 && (
                    <div className="space-y-1.5">
                      <label className={labelClass}>Responsável</label>
                      <select
                        value={responsavelId}
                        onChange={(e) => setResponsavelId(e.target.value)}
                        className={selectClass}
                      >
                        {usuarios.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Comentários (só na edição) */}
                {editingTarefa && (
                  <div className="space-y-2 border-t border-border pt-4">
                    <label className={labelClass}>Comentários</label>
                    {comentariosEdicao.length === 0 ? (
                      <p className="text-xs text-label-tertiary">Nenhum comentário ainda.</p>
                    ) : (
                      <div className="space-y-2">
                        {comentariosEdicao.map((c, i) => (
                          <div key={i} className="rounded-md bg-background px-3 py-2">
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-primary">
                                {c.author}
                              </span>
                              <span className="text-[10px] text-label-tertiary">{c.date}</span>
                            </div>
                            <p className="text-xs text-foreground">{c.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment();
                          }
                        }}
                        placeholder="Adicionar comentário..."
                        className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-placeholder outline-none focus:border-primary/40"
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={isPending || !newComment.trim()}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                        aria-label="Enviar comentário"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
                <Button variant="ghost" onClick={closeModal}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isPending}>
                  {isPending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingTarefa ? "Salvar" : "Criar tarefa"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal de sprint */}
      {showSprintModal && (
        <SprintModal
          sprint={editingSprint}
          canDelete={isCeo}
          onClose={() => setShowSprintModal(false)}
          onSaved={handleSprintSaved}
          onDeleted={handleSprintDeleted}
        />
      )}
    </div>
  );
}

function SprintChip({
  ativo,
  onClick,
  label,
  tone,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
  tone?: "neutral" | "green" | "blue";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        ativo
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {tone && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "blue" && "bg-sys-blue",
            tone === "green" && "bg-sys-green",
            tone === "neutral" && "bg-label-tertiary",
          )}
        />
      )}
      {label}
    </button>
  );
}

function FiltroBtn({
  ativo,
  onClick,
  label,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
        ativo ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
