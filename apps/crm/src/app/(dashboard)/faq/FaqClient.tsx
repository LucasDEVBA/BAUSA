"use client";

import { useState, useTransition } from "react";
import {
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
import { PageHeader, Card, Input, Button, EmptyState } from "@/components/ui";

const CATEGORIAS_MAP = Object.fromEntries(
  FAQ_CATEGORIAS.map((c) => [c.value, c.label]),
);

const CATEGORIA_COLORS: Record<string, string> = {
  visto: "bg-sys-blue/15 text-sys-blue",
  documentacao: "bg-sys-orange/15 text-sys-orange",
  embarque: "bg-sys-green/15 text-sys-green",
  adaptacao: "bg-plan-legacy/15 text-plan-legacy",
  financeiro: "bg-sys-green/15 text-sys-green",
  escola: "bg-primary/15 text-primary",
  saude: "bg-sys-red/15 text-sys-red",
  outros: "bg-secondary text-muted-foreground",
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
        <PageHeader
          eyebrow="Sistema"
          title="FAQ / Base de Conhecimento"
          description="Artigos de suporte para atendimento as familias"
          actions={
            <Button
              size="sm"
              onClick={() => {
                setEditingId(null);
                setFormData({ titulo: "", categoria: "visto", conteudo: "" });
                setShowForm(true);
              }}
            >
              <Plus />
              Novo Artigo
            </Button>
          }
        />

        {/* Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por titulo ou conteudo..."
              value={busca}
              onChange={(e) => handleBusca(e.target.value)}
              className="pl-8"
              aria-label="Buscar artigos"
            />
          </div>

          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            aria-label="Filtrar por categoria"
            className="h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
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
            <EmptyState
              icon={FileText}
              title="Nenhum artigo encontrado"
              description="Ajuste a busca ou o filtro de categoria, ou crie um novo artigo."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {artigosFiltrados.map((artigo) => (
                <Card
                  key={artigo.id}
                  variant="plain"
                  padding="none"
                  interactive
                  accent="blue"
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedArtigo?.id === artigo.id}
                  onClick={() => handleOpenArtigo(artigo)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleOpenArtigo(artigo);
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-start px-4 py-3 text-left",
                    selectedArtigo?.id === artigo.id && "ring-2 ring-primary/40",
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
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-label-tertiary">
                      <Eye className="h-2.5 w-2.5" />
                      {artigo.acessos}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1 line-clamp-2">
                    {artigo.titulo}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {artigo.conteudo.slice(0, 150)}
                    {artigo.conteudo.length > 150 && "..."}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-primary">
                    Ler mais <ChevronRight className="h-3 w-3" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail sheet (right sidebar) */}
      {selectedArtigo && (
        <Card
          variant="plain"
          padding="none"
          className="ml-4 flex w-[400px] flex-shrink-0 flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground line-clamp-1">
              {selectedArtigo.titulo}
            </h2>
            <button
              onClick={() => setSelectedArtigo(null)}
              className="text-muted-foreground hover:text-foreground transition-colors"
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
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {selectedConteudo || selectedArtigo.conteudo}
              </p>
            </div>

            {/* Metadata */}
            <div className="mt-4 space-y-1.5 rounded-lg border border-border bg-background p-3">
              {selectedArtigo.criado_por && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>Criado por: <span className="text-foreground">{selectedArtigo.criado_por}</span></span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  Ultima atualizacao:{" "}
                  <span className="text-foreground">
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
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Eye className="h-3 w-3" />
                <span>
                  {selectedArtigo.acessos} {selectedArtigo.acessos === 1 ? "acesso" : "acessos"}
                </span>
              </div>
            </div>
          </div>
          <div className="border-t border-border px-4 py-3 space-y-2">
            <Button
              size="sm"
              onClick={handleCopyWhatsApp}
              className="w-full bg-sys-green text-white hover:bg-sys-green/90"
            >
              <Copy />
              Copiar para WhatsApp
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleEditar(selectedArtigo)}
                className="flex-1"
              >
                <FileText />
                Editar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleViewHistory(selectedArtigo.id)}
                className="flex-1"
              >
                <History />
                Historico
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Form sheet (novo artigo) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card
            variant="glass"
            padding="lg"
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? "Editar Artigo" : "Novo Artigo"}
            className="w-full max-w-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">
                {editingId ? "Editar Artigo" : "Novo Artigo"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fechar formulario"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="faq-titulo">
                  Titulo
                </label>
                <Input
                  id="faq-titulo"
                  type="text"
                  value={formData.titulo}
                  onChange={(e) => setFormData((p) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Como solicitar o visto F-1"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="faq-categoria">
                  Categoria
                </label>
                <select
                  id="faq-categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData((p) => ({ ...p, categoria: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                >
                  {FAQ_CATEGORIAS.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="faq-conteudo">
                  Conteudo
                </label>
                <textarea
                  id="faq-conteudo"
                  value={formData.conteudo}
                  onChange={(e) => setFormData((p) => ({ ...p, conteudo: e.target.value }))}
                  rows={8}
                  className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors placeholder:text-placeholder focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                  placeholder="Escreva o conteudo do artigo..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSalvar} disabled={isPending}>
                  {isPending ? "Salvando..." : "Salvar Artigo"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card
            variant="glass"
            padding="lg"
            role="dialog"
            aria-modal="true"
            aria-label="Historico de Alteracoes"
            className="flex max-h-[80vh] w-full max-w-lg flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">
                  Historico de Alteracoes
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryLogs([]);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Fechar historico"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : historyLogs.length === 0 ? (
                <p className="text-sm text-label-tertiary text-center py-8">
                  Nenhum historico de alteracoes encontrado.
                </p>
              ) : (
                historyLogs.map((log) => {
                  const campos = log.campos_alterados ?? [];
                  return (
                    <div
                      key={log.id}
                      className="rounded-lg border border-border bg-card px-4 py-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-primary" />
                          <span className="text-[10px] font-bold uppercase text-primary">
                            {log.operacao}
                          </span>
                        </div>
                        <span className="text-[10px] text-label-tertiary">
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
                                <p className="text-xs font-medium text-foreground mb-0.5">{label}</p>
                                {isConteudo ? (
                                  <div className="space-y-1">
                                    {anterior != null && (
                                      <p className="text-[10px] text-sys-red/70 line-clamp-3">
                                        - {String(anterior).slice(0, 200)}
                                        {String(anterior).length > 200 && "..."}
                                      </p>
                                    )}
                                    {novo != null && (
                                      <p className="text-[10px] text-sys-green/70 line-clamp-3">
                                        + {String(novo).slice(0, 200)}
                                        {String(novo).length > 200 && "..."}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground">
                                    {anterior != null && (
                                      <span className="text-sys-red/70">{String(anterior)}</span>
                                    )}
                                    {anterior != null && novo != null && (
                                      <span className="text-label-tertiary"> {"->"} </span>
                                    )}
                                    {novo != null && (
                                      <span className="text-sys-green">{String(novo)}</span>
                                    )}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : log.operacao === "INSERT" ? (
                        <p className="text-xs text-muted-foreground">Artigo criado</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Campos alterados: {campos.join(", ") || "N/A"}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
