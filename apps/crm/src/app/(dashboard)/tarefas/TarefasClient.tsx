"use client";

import { useState, useTransition, useEffect } from "react";
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  Search,
  Zap,
  Square,
  CheckCircle2,
  Plus,
  X,
  Save,
  Pencil,
  MessageCircle,
  Send,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { criarTarefa, marcarTarefaConcluida } from "@/lib/actions/automacoes";
import { atualizarTarefa } from "@/lib/actions/tarefas";
import { cn } from "@/lib/utils";
import type { Tarefa, PrioridadeTarefa, StatusTarefa } from "@/types/crm";

const STATUS_TABS: { value: StatusTarefa | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluida" },
  { value: "atrasada", label: "Atrasada" },
];

const PRIORIDADE_TABS: { value: PrioridadeTarefa | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "critica", label: "Critica" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baixa", label: "Baixa" },
];

const MODULO_TABS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "comercial", label: "Comercial" },
  { value: "experiencia", label: "Experiencia" },
  { value: "financeiro", label: "Financeiro" },
  { value: "admissao", label: "Admissao" },
];

const PRIORIDADE_ORDER: Record<PrioridadeTarefa, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

const PRIORIDADE_CONFIG: Record<PrioridadeTarefa, { label: string; bg: string; text: string }> = {
  critica: { label: "Critica", bg: "bg-sys-red/15", text: "text-sys-red" },
  alta: { label: "Alta", bg: "bg-sys-orange/15", text: "text-sys-orange" },
  media: { label: "Media", bg: "bg-sys-blue/15", text: "text-sys-blue" },
  baixa: { label: "Baixa", bg: "bg-secondary", text: "text-muted-foreground" },
};

const MODULO_CONFIG: Record<string, { label: string; color: string }> = {
  comercial: { label: "Comercial", color: "text-primary" },
  experiencia: { label: "Experiencia", color: "text-plan-legacy" },
  financeiro: { label: "Financeiro", color: "text-sys-green" },
  admissao: { label: "Admissao", color: "text-sys-orange" },
};

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < -1) return `${Math.abs(diffDays)} dias atrasada`;
  if (diffDays === -1) return "Ontem";
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanha";
  return `Em ${diffDays} dias`;
}

function isOverdue(tarefa: Tarefa): boolean {
  if (tarefa.status === "concluida" || tarefa.status === "cancelada") return false;
  return new Date(tarefa.prazo) < new Date();
}

type RecorrenciaTarefa = "nenhuma" | "diaria" | "semanal" | "mensal";

const RECORRENCIA_LABELS: Record<RecorrenciaTarefa, string> = {
  nenhuma: "Nenhuma",
  diaria: "Diaria",
  semanal: "Semanal",
  mensal: "Mensal",
};

interface TarefaFormData {
  titulo: string;
  descricao: string;
  prazo: string;
  prioridade: PrioridadeTarefa;
  modulo_origem: "comercial" | "experiencia" | "financeiro" | "admissao";
  recorrencia: RecorrenciaTarefa;
}

const EMPTY_FORM: TarefaFormData = {
  titulo: "",
  descricao: "",
  prazo: "",
  prioridade: "media",
  modulo_origem: "comercial",
  recorrencia: "nenhuma",
};

interface TarefasClientProps {
  tarefasIniciais: Tarefa[];
  currentUserId: string;
  usuarios: { id: string; nome: string }[];
}

export function TarefasClient({ tarefasIniciais, currentUserId, usuarios }: TarefasClientProps) {
  const [tarefas, setTarefas] = useState<Tarefa[]>(tarefasIniciais);
  const [statusFiltro, setStatusFiltro] = useState<StatusTarefa | "todas">("todas");
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<PrioridadeTarefa | "todas">("todas");
  const [moduloFiltro, setModuloFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null);
  const [form, setForm] = useState<TarefaFormData>(EMPTY_FORM);
  const [responsavelId, setResponsavelId] = useState(currentUserId);

  // Comment state
  const [expandedTarefaId, setExpandedTarefaId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");

  // Mapa de nomes de usuarios
  const usuarioNomeMap = new Map(usuarios.map((u) => [u.id, u.nome]));

  const COMMENT_REGEX = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) - (.+?)\] (.+)$/;

  function parseComments(descricao: string | null): { date: string; author: string; text: string }[] {
    if (!descricao) return [];
    return descricao.split("\n").reduce<{ date: string; author: string; text: string }[]>((acc, line) => {
      const match = line.match(COMMENT_REGEX);
      if (match) {
        acc.push({ date: match[1], author: match[2], text: match[3] });
      }
      return acc;
    }, []);
  }

  function getDescriptionWithoutComments(descricao: string | null): string {
    if (!descricao) return "";
    return descricao.split("\n").filter((line) => !COMMENT_REGEX.test(line)).join("\n").trim();
  }

  const handleAddComment = (tarefaId: string) => {
    if (!newComment.trim()) return;
    const currentUserName = usuarioNomeMap.get(currentUserId) ?? "Usuario";
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const commentLine = `[${dateStr} - ${currentUserName}] ${newComment.trim()}`;

    const tarefa = tarefas.find((t) => t.id === tarefaId);
    if (!tarefa) return;

    const updatedDescricao = tarefa.descricao
      ? `${tarefa.descricao}\n${commentLine}`
      : commentLine;

    startTransition(async () => {
      const result = await atualizarTarefa(tarefaId, { descricao: updatedDescricao });
      if (result.success) {
        setTarefas((prev) =>
          prev.map((t) => (t.id === tarefaId ? { ...t, descricao: updatedDescricao } : t)),
        );
        setNewComment("");
        toast.success("Comentario adicionado");
      } else {
        toast.error(result.error ?? "Erro ao adicionar comentario");
      }
    });
  };

  useEffect(() => {
    if (editingTarefa) {
      setForm({
        titulo: editingTarefa.titulo,
        descricao: editingTarefa.descricao ?? "",
        prazo: editingTarefa.prazo ? new Date(editingTarefa.prazo).toISOString().slice(0, 16) : "",
        prioridade: editingTarefa.prioridade,
        modulo_origem: editingTarefa.modulo_origem,
        recorrencia: editingTarefa.recorrencia ?? "nenhuma",
      });
      setResponsavelId(editingTarefa.responsavel_id);
    } else {
      setForm(EMPTY_FORM);
      setResponsavelId(currentUserId);
    }
  }, [editingTarefa, currentUserId]);

  const openCreateModal = () => {
    setEditingTarefa(null);
    setForm(EMPTY_FORM);
    setResponsavelId(currentUserId);
    setShowModal(true);
  };

  const openEditModal = (tarefa: Tarefa) => {
    setEditingTarefa(tarefa);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTarefa(null);
  };

  const handleSubmit = () => {
    if (!form.titulo.trim()) {
      toast.error("Titulo e obrigatorio");
      return;
    }
    if (!form.prazo) {
      toast.error("Prazo e obrigatorio");
      return;
    }

    startTransition(async () => {
      if (editingTarefa) {
        const result = await atualizarTarefa(editingTarefa.id, {
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          prazo: new Date(form.prazo).toISOString(),
          prioridade: form.prioridade,
          modulo_origem: form.modulo_origem,
          responsavel_id: responsavelId,
          recorrencia: form.recorrencia,
        });
        if (result.success) {
          setTarefas((prev) =>
            prev.map((t) =>
              t.id === editingTarefa.id
                ? {
                    ...t,
                    titulo: form.titulo,
                    descricao: form.descricao || null,
                    prazo: new Date(form.prazo).toISOString(),
                    prioridade: form.prioridade,
                    modulo_origem: form.modulo_origem,
                    responsavel_id: responsavelId,
                    recorrencia: form.recorrencia,
                  }
                : t,
            ),
          );
          toast.success("Tarefa atualizada com sucesso");
          closeModal();
        } else {
          toast.error(result.error ?? "Erro ao atualizar tarefa");
        }
      } else {
        const result = await criarTarefa({
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          prazo: new Date(form.prazo).toISOString(),
          prioridade: form.prioridade,
          modulo_origem: form.modulo_origem,
          responsavel_id: responsavelId,
          recorrencia: form.recorrencia,
        });
        if (result.success && result.tarefaId) {
          const novaTarefa: Tarefa = {
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
            completed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          };
          setTarefas((prev) => [novaTarefa, ...prev]);
          toast.success("Tarefa criada com sucesso");
          closeModal();
        } else {
          toast.error(result.error ?? "Erro ao criar tarefa");
        }
      }
    });
  };

  const handleConcluir = (tarefaId: string) => {
    startTransition(async () => {
      const result = await marcarTarefaConcluida(tarefaId);
      if (result.success) {
        setTarefas((prev) =>
          prev.map((t) =>
            t.id === tarefaId
              ? { ...t, status: "concluida" as const, completed_at: new Date().toISOString() }
              : t,
          ),
        );
        toast.success("Tarefa concluida com sucesso");
      } else {
        toast.error(result.error ?? "Erro ao concluir tarefa");
      }
    });
  };

  const tarefasFiltradas = tarefas
    .filter((t) => {
      if (statusFiltro === "todas") return true;
      if (statusFiltro === "atrasada") return isOverdue(t);
      return t.status === statusFiltro;
    })
    .filter((t) => {
      if (prioridadeFiltro === "todas") return true;
      return t.prioridade === prioridadeFiltro;
    })
    .filter((t) => {
      if (moduloFiltro === "todos") return true;
      return t.modulo_origem === moduloFiltro;
    })
    .filter((t) => {
      if (!busca.trim()) return true;
      return t.titulo.toLowerCase().includes(busca.toLowerCase());
    })
    .sort((a, b) => {
      const prioA = PRIORIDADE_ORDER[a.prioridade] ?? 2;
      const prioB = PRIORIDADE_ORDER[b.prioridade] ?? 2;
      if (prioA !== prioB) return prioA - prioB;
      return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
    });

  const countByStatus = (status: StatusTarefa | "todas") => {
    if (status === "todas") return tarefas.length;
    if (status === "atrasada") return tarefas.filter(isOverdue).length;
    return tarefas.filter((t) => t.status === status).length;
  };

  const countByPrioridade = (prio: PrioridadeTarefa | "todas") => {
    if (prio === "todas") return tarefas.length;
    return tarefas.filter((t) => t.prioridade === prio).length;
  };

  const countByModulo = (modulo: string) => {
    if (modulo === "todos") return tarefas.length;
    return tarefas.filter((t) => t.modulo_origem === modulo).length;
  };

  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary focus:ring-1 focus:ring-primary/30";
  const labelClass = "text-xs font-medium text-muted-foreground";
  const selectClass =
    "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 appearance-none";

  return (
    <div className="flex h-full flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <CheckSquare className="h-5 w-5 text-primary" />
            <h1 className="text-title-2 text-foreground">Tarefas</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Gerencie tarefas manuais e automaticas do CRM
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova Tarefa
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
            {STATUS_TABS.map((tab) => {
              const count = countByStatus(tab.value);
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFiltro(tab.value)}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFiltro === tab.value
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className="rounded-full bg-secondary px-1.5 text-[10px]">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar tarefa..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="bg-transparent text-sm text-foreground placeholder:text-placeholder outline-none w-48"
            />
          </div>
        </div>

        {/* Prioridade + Modulo Tabs */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="text-[10px] font-medium uppercase tracking-wider text-label-tertiary mr-1">Prioridade:</span>
          <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5">
            {PRIORIDADE_TABS.map((tab) => {
              const count = countByPrioridade(tab.value);
              return (
                <button
                  key={tab.value}
                  onClick={() => setPrioridadeFiltro(tab.value)}
                  className={cn(
                    "flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    prioridadeFiltro === tab.value
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className="rounded-full bg-secondary px-1.5 text-[10px]">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          <span className="text-[10px] font-medium uppercase tracking-wider text-label-tertiary ml-2 mr-1">Modulo:</span>
          <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5">
            {MODULO_TABS.map((tab) => {
              const count = countByModulo(tab.value);
              return (
                <button
                  key={tab.value}
                  onClick={() => setModuloFiltro(tab.value)}
                  className={cn(
                    "flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    moduloFiltro === tab.value
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className="rounded-full bg-secondary px-1.5 text-[10px]">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tarefa list */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {tarefasFiltradas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-label-tertiary">
            <CheckSquare className="mb-3 h-10 w-10" />
            <p className="text-sm">Nenhuma tarefa encontrada</p>
          </div>
        )}

        {tarefasFiltradas.map((tarefa) => {
          const overdue = isOverdue(tarefa);
          const prio = PRIORIDADE_CONFIG[tarefa.prioridade];
          const modulo = MODULO_CONFIG[tarefa.modulo_origem] ?? {
            label: tarefa.modulo_origem,
            color: "text-muted-foreground",
          };
          const done = tarefa.status === "concluida";
          const responsavelNome = usuarioNomeMap.get(tarefa.responsavel_id);

          return (
            <div
              key={tarefa.id}
              className={cn(
                "rounded-xl border transition-colors",
                overdue
                  ? "border-sys-red/30 bg-sys-red/5"
                  : "border-border bg-card",
                done && "opacity-60",
              )}
            >
            <div className="flex items-start gap-3 px-4 py-3">
              {/* Checkbox */}
              <button
                onClick={() => !done && handleConcluir(tarefa.id)}
                disabled={done || isPending}
                className={cn(
                  "mt-0.5 flex-shrink-0 transition-colors",
                  done ? "text-sys-green" : "text-label-tertiary hover:text-primary",
                )}
                aria-label={done ? "Tarefa concluida" : "Marcar como concluida"}
              >
                {done ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Square className="h-5 w-5" />
                )}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => openEditModal(tarefa)}
                    className={cn(
                      "text-sm font-medium text-left hover:text-primary transition-colors",
                      done ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                    title="Clique para editar"
                  >
                    {tarefa.titulo}
                  </button>

                  {/* Prioridade badge */}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      prio.bg,
                      prio.text,
                    )}
                  >
                    {prio.label}
                  </span>

                  {/* Auto badge */}
                  {tarefa.criada_automaticamente && (
                    <span className="flex items-center gap-0.5 rounded-full bg-plan-legacy/15 px-2 py-0.5 text-[10px] font-semibold text-plan-legacy">
                      <Zap className="h-2.5 w-2.5" />
                      Auto
                    </span>
                  )}

                  {/* Recorrencia badge */}
                  {tarefa.recorrencia && tarefa.recorrencia !== "nenhuma" && (
                    <span className="flex items-center gap-0.5 rounded-full bg-sys-teal/15 px-2 py-0.5 text-[10px] font-semibold text-sys-teal">
                      <RefreshCw className="h-2.5 w-2.5" />
                      {RECORRENCIA_LABELS[tarefa.recorrencia as RecorrenciaTarefa] ?? tarefa.recorrencia}
                    </span>
                  )}
                </div>

                {/* Meta */}
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                  {/* Prazo */}
                  <span className={cn("flex items-center gap-1", overdue && "text-sys-red")}>
                    {overdue ? (
                      <AlertTriangle className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {getRelativeTime(tarefa.prazo)}
                  </span>

                  {/* Modulo */}
                  <span className={modulo.color}>{modulo.label}</span>

                  {/* Responsavel */}
                  {responsavelNome && (
                    <span className="text-muted-foreground">{responsavelNome}</span>
                  )}
                </div>

                {tarefa.descricao && (
                  <p className="mt-1 text-xs text-label-tertiary line-clamp-1">
                    {getDescriptionWithoutComments(tarefa.descricao) || (parseComments(tarefa.descricao).length > 0 ? `${parseComments(tarefa.descricao).length} comentario(s)` : tarefa.descricao)}
                  </p>
                )}
              </div>

              {/* Comment toggle */}
              <button
                onClick={() => {
                  setExpandedTarefaId(expandedTarefaId === tarefa.id ? null : tarefa.id);
                  setNewComment("");
                }}
                className="mt-0.5 flex-shrink-0 text-label-tertiary hover:text-primary transition-colors"
                aria-label="Comentarios"
              >
                <MessageCircle className="h-4 w-4" />
              </button>

              {/* Edit button */}
              {!done && (
                <button
                  onClick={() => openEditModal(tarefa)}
                  className="mt-0.5 flex-shrink-0 text-label-tertiary hover:text-primary transition-colors"
                  aria-label="Editar tarefa"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Expanded comment section */}
            {expandedTarefaId === tarefa.id && (
              <div className="border-t border-border pt-3 pb-3 mx-4 ml-12">
                {/* Existing comments */}
                {(() => {
                  const comments = parseComments(tarefa.descricao);
                  if (comments.length === 0) {
                    return (
                      <p className="text-xs text-label-tertiary mb-3">Nenhum comentario ainda.</p>
                    );
                  }
                  return (
                    <div className="space-y-2 mb-3">
                      {comments.map((c, i) => (
                        <div key={i} className="rounded-md bg-background px-3 py-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-primary">{c.author}</span>
                            <span className="text-[10px] text-label-tertiary">{c.date}</span>
                          </div>
                          <p className="text-xs text-foreground">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Add comment */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment(tarefa.id);
                      }
                    }}
                    placeholder="Adicionar comentario..."
                    className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-placeholder outline-none focus:border-primary/40"
                  />
                  <button
                    onClick={() => handleAddComment(tarefa.id)}
                    disabled={isPending || !newComment.trim()}
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                    aria-label="Enviar comentario"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
            </div>
          );
        })}
      </div>

      {/* Modal de criacao/edicao */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="liquid-glass w-full max-w-md rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="text-base font-semibold text-foreground">
                  {editingTarefa ? "Editar Tarefa" : "Nova Tarefa"}
                </h2>
                <button
                  onClick={closeModal}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-fill-4 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal body */}
              <div className="space-y-4 px-6 py-5">
                <div className="space-y-1.5">
                  <label className={labelClass}>Titulo *</label>
                  <input
                    value={form.titulo}
                    onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                    placeholder="Ex: Ligar para responsavel..."
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Descricao</label>
                  <textarea
                    value={form.descricao}
                    onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                    placeholder="Detalhes da tarefa..."
                    rows={3}
                    className={cn(inputClass, "resize-none")}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Prazo *</label>
                  <input
                    type="datetime-local"
                    value={form.prazo}
                    onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Prioridade</label>
                    <select
                      value={form.prioridade}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          prioridade: e.target.value as PrioridadeTarefa,
                        }))
                      }
                      className={selectClass}
                    >
                      <option value="critica">Critica</option>
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baixa">Baixa</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className={labelClass}>Modulo</label>
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
                      <option value="experiencia">Experiencia</option>
                      <option value="financeiro">Financeiro</option>
                      <option value="admissao">Admissao</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Recorrencia</label>
                  <select
                    value={form.recorrencia}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        recorrencia: e.target.value as RecorrenciaTarefa,
                      }))
                    }
                    className={selectClass}
                  >
                    <option value="nenhuma">Nenhuma</option>
                    <option value="diaria">Diaria</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                  </select>
                </div>

                {usuarios.length > 1 && (
                  <div className="space-y-1.5">
                    <label className={labelClass}>Responsavel</label>
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

              {/* Modal footer */}
              <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
                <button
                  onClick={closeModal}
                  className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isPending ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editingTarefa ? "Salvar" : "Criar Tarefa"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
