"use client";

import { useState, useTransition } from "react";
import {
  BookOpen,
  Search,
  Plus,
  Eye,
  Copy,
  X,
  ChevronRight,
  FileText,
  Clock,
  User,
  History,
  Loader2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { buscarArtigos, salvarArtigo, registrarAcesso } from "@/lib/actions/faq";
import { getAuditLogs } from "@/lib/actions/audit";
import { cn } from "@/lib/utils";
import { FAQ_CATEGORIAS } from "@/types/crm";
import type { FaqArtigo, AuditLog } from "@/types/crm";

const CATEGORIAS_MAP = Object.fromEntries(
  FAQ_CATEGORIAS.map((c) => [c.value, c.label]),
);

const CATEGORIA_COLORS: Record<string, string> = {
  visto: "bg-blue-500/15 text-blue-400",
  documentacao: "bg-amber-500/15 text-amber-400",
  embarque: "bg-emerald-500/15 text-emerald-400",
  adaptacao: "bg-purple-500/15 text-purple-400",
  financeiro: "bg-green-500/15 text-green-400",
  escola: "bg-indigo-500/15 text-indigo-400",
  saude: "bg-red-500/15 text-red-400",
  outros: "bg-zinc-500/15 text-zinc-400",
};

interface FaqClientProps {
  artigosIniciais: FaqArtigo[];
}

export function FaqClient({ artigosIniciais }: FaqClientProps) {
  const [artigos, setArtigos] = useState<FaqArtigo[]>(artigosIniciais);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [selectedArtigo, setSelectedArtigo] = useState<FaqArtigo | null>(null);
  const [selectedConteudo, setSelectedConteudo] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ titulo: "", categoria: "visto", conteudo: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<AuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleBusca = (termo: string) => {
    setBusca(termo);
    if (termo.trim().length >= 2) {
      startTransition(async () => {
        const resultados = await buscarArtigos(termo);
        setArtigos(resultados as FaqArtigo[]);
      });
    } else if (termo.trim() === "") {
      setArtigos(artigosIniciais);
    }
  };

  const handleOpenArtigo = (artigo: FaqArtigo) => {
    setSelectedArtigo(artigo);
    startTransition(async () => {
      const conteudo = await registrarAcesso(artigo.id);
      setSelectedConteudo(conteudo || artigo.conteudo);
    });
  };

  const handleCopyWhatsApp = () => {
    if (!selectedArtigo) return;
    const text = `*${selectedArtigo.titulo}*\n\n${selectedConteudo || selectedArtigo.conteudo}`;
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Conteudo copiado para o clipboard");
    }).catch(() => {
      toast.error("Erro ao copiar");
    });
  };

  const handleEditar = (artigo: FaqArtigo) => {
    setEditingId(artigo.id);
    setFormData({
      titulo: artigo.titulo,
      categoria: artigo.categoria,
      conteudo: artigo.conteudo,
    });
    setShowForm(true);
  };

  const handleViewHistory = async (artigoId: string) => {
    setHistoryLoading(true);
    setShowHistoryModal(true);
    try {
      const logs = await getAuditLogs("faq_artigos", artigoId);
      setHistoryLogs(logs);
    } catch {
      toast.error("Erro ao carregar historico");
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSalvar = () => {
    if (!formData.titulo.trim() || !formData.conteudo.trim()) {
      toast.error("Preencha titulo e conteudo");
      return;
    }
    startTransition(async () => {
      const result = await salvarArtigo(
        {
          titulo: formData.titulo,
          categoria: formData.categoria,
          conteudo: formData.conteudo,
        },
        editingId ?? undefined,
      );
      if (result.success) {
        toast.success(editingId ? "Artigo atualizado com sucesso" : "Artigo salvo com sucesso");
        setShowForm(false);
        setEditingId(null);
        setFormData({ titulo: "", categoria: "visto", conteudo: "" });
        const novos = await buscarArtigos("");
        setArtigos(novos.length > 0 ? (novos as FaqArtigo[]) : artigosIniciais);
        if (selectedArtigo && editingId === selectedArtigo.id) {
          setSelectedArtigo(null);
        }
      } else {
        toast.error(result.error ?? "Erro ao salvar artigo");
      }
    });
  };

  const artigosFiltrados = categoriaFiltro === "todas"
    ? artigos
    : artigos.filter((a) => a.categoria === categoriaFiltro);

  return (
    <div className="flex h-full gap-0">
      {/* Main content */}
      <div className={cn("flex flex-1 flex-col gap-5", selectedArtigo && "pr-0")}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <BookOpen className="h-5 w-5 text-indigo-400" />
              <h1 className="text-xl font-bold text-zinc-100">FAQ / Base de Conhecimento</h1>
            </div>
            <p className="text-sm text-zinc-500">
              Artigos de suporte para atendimento as familias
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ titulo: "", categoria: "visto", conteudo: "" });
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Artigo
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 flex-1 max-w-sm">
            <Search className="h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por titulo ou conteudo..."
              value={busca}
              onChange={(e) => handleBusca(e.target.value)}
              className="bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none w-full"
            />
          </div>

          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-sm text-zinc-300 outline-none"
          >
            <option value="todas">Todas as categorias</option>
            {FAQ_CATEGORIAS.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Grid de artigos */}
        <div className="flex-1 overflow-y-auto">
          {artigosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
              <FileText className="mb-3 h-10 w-10" />
              <p className="text-sm">Nenhum artigo encontrado</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {artigosFiltrados.map((artigo) => (
                <button
                  key={artigo.id}
                  onClick={() => handleOpenArtigo(artigo)}
                  className={cn(
                    "flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors",
                    selectedArtigo?.id === artigo.id
                      ? "border-indigo-500/40 bg-indigo-500/10"
                      : "border-[#1e2130] bg-[#141720] hover:border-zinc-700",
                  )}
                >
                  <div className="flex items-center gap-2 mb-2 w-full">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        CATEGORIA_COLORS[artigo.categoria] ?? CATEGORIA_COLORS.outros,
                      )}
                    >
                      {CATEGORIAS_MAP[artigo.categoria] ?? artigo.categoria}
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-600">
                      <Eye className="h-2.5 w-2.5" />
                      {artigo.acessos}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-100 mb-1 line-clamp-2">
                    {artigo.titulo}
                  </h3>
                  <p className="text-xs text-zinc-500 line-clamp-3">
                    {artigo.conteudo.slice(0, 150)}
                    {artigo.conteudo.length > 150 && "..."}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-indigo-400">
                    Ler mais <ChevronRight className="h-3 w-3" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail sheet (right sidebar) */}
      {selectedArtigo && (
        <div className="ml-4 w-[400px] flex-shrink-0 rounded-xl border border-[#1e2130] bg-[#141720] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#1e2130] px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-100 line-clamp-1">
              {selectedArtigo.titulo}
            </h2>
            <button
              onClick={() => setSelectedArtigo(null)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <span
              className={cn(
                "mb-3 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                CATEGORIA_COLORS[selectedArtigo.categoria] ?? CATEGORIA_COLORS.outros,
              )}
            >
              {CATEGORIAS_MAP[selectedArtigo.categoria] ?? selectedArtigo.categoria}
            </span>
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {selectedConteudo || selectedArtigo.conteudo}
              </p>
            </div>

            {/* Metadata */}
            <div className="mt-4 space-y-1.5 rounded-lg border border-[#1e2130] bg-[#0c0e16] p-3">
              {selectedArtigo.criado_por && (
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                  <User className="h-3 w-3" />
                  <span>Criado por: <span className="text-zinc-400">{selectedArtigo.criado_por}</span></span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <Clock className="h-3 w-3" />
                <span>
                  Ultima atualizacao:{" "}
                  <span className="text-zinc-400">
                    {new Date(selectedArtigo.updated_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <Eye className="h-3 w-3" />
                <span>
                  {selectedArtigo.acessos} {selectedArtigo.acessos === 1 ? "acesso" : "acessos"}
                </span>
              </div>
            </div>
          </div>
          <div className="border-t border-[#1e2130] px-4 py-3 space-y-2">
            <button
              onClick={handleCopyWhatsApp}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar para WhatsApp
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => handleEditar(selectedArtigo)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#1e2130] px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                <FileText className="h-3.5 w-3.5" />
                Editar
              </button>
              <button
                onClick={() => handleViewHistory(selectedArtigo.id)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#1e2130] px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                <History className="h-3.5 w-3.5" />
                Historico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form sheet (novo artigo) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[#1e2130] bg-[#0f1117] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-zinc-100">
                {editingId ? "Editar Artigo" : "Novo Artigo"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label="Fechar formulario"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="faq-titulo">
                  Titulo
                </label>
                <input
                  id="faq-titulo"
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData((p) => ({ ...p, titulo: e.target.value }))}
                  className="w-full rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
                  placeholder="Ex: Como solicitar o visto F-1"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="faq-categoria">
                  Categoria
                </label>
                <select
                  id="faq-categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData((p) => ({ ...p, categoria: e.target.value }))}
                  className="w-full rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-sm text-zinc-300 outline-none focus:border-indigo-500"
                >
                  {FAQ_CATEGORIAS.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="faq-conteudo">
                  Conteudo
                </label>
                <textarea
                  id="faq-conteudo"
                  value={formData.conteudo}
                  onChange={(e) => setFormData((p) => ({ ...p, conteudo: e.target.value }))}
                  rows={8}
                  className="w-full rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500 resize-none"
                  placeholder="Escreva o conteudo do artigo..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="rounded-lg border border-[#1e2130] px-4 py-2 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvar}
                  disabled={isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isPending ? "Salvando..." : "Salvar Artigo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[#1e2130] bg-[#0f1117] p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-indigo-400" />
                <h2 className="text-base font-semibold text-zinc-100">
                  Historico de Alteracoes
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryLogs([]);
                }}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label="Fechar historico"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                </div>
              ) : historyLogs.length === 0 ? (
                <p className="text-sm text-zinc-600 text-center py-8">
                  Nenhum historico de alteracoes encontrado.
                </p>
              ) : (
                historyLogs.map((log) => {
                  const campos = log.campos_alterados ?? [];
                  return (
                    <div
                      key={log.id}
                      className="rounded-lg border border-[#1e2130] bg-[#141720] px-4 py-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-indigo-400" />
                          <span className="text-[10px] font-bold uppercase text-indigo-400">
                            {log.operacao}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-600">
                          {new Date(log.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {log.operacao === "UPDATE" && campos.length > 0 ? (
                        <div className="space-y-1">
                          {campos.map((campo) => {
                            const anterior = log.dados_anteriores?.[campo];
                            const novo = log.dados_novos?.[campo];
                            const label = campo === "titulo" ? "Titulo" : campo === "conteudo" ? "Conteudo" : campo === "categoria" ? "Categoria" : campo;
                            const isConteudo = campo === "conteudo";
                            return (
                              <div key={campo}>
                                <p className="text-xs font-medium text-zinc-300 mb-0.5">{label}</p>
                                {isConteudo ? (
                                  <div className="space-y-1">
                                    {anterior != null && (
                                      <p className="text-[10px] text-red-400/70 line-clamp-3">
                                        - {String(anterior).slice(0, 200)}
                                        {String(anterior).length > 200 && "..."}
                                      </p>
                                    )}
                                    {novo != null && (
                                      <p className="text-[10px] text-emerald-400/70 line-clamp-3">
                                        + {String(novo).slice(0, 200)}
                                        {String(novo).length > 200 && "..."}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-zinc-400">
                                    {anterior != null && (
                                      <span className="text-red-400/70">{String(anterior)}</span>
                                    )}
                                    {anterior != null && novo != null && (
                                      <span className="text-zinc-600"> {"->"} </span>
                                    )}
                                    {novo != null && (
                                      <span className="text-emerald-400">{String(novo)}</span>
                                    )}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : log.operacao === "INSERT" ? (
                        <p className="text-xs text-zinc-500">Artigo criado</p>
                      ) : (
                        <p className="text-xs text-zinc-500">
                          Campos alterados: {campos.join(", ") || "N/A"}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
