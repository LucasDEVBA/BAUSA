"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import {
  FileText,
  Upload,
  Loader2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DOCUMENTO_TIPOS, type DocumentoAtleta } from "@/types/crm";
import {
  listarDocumentos,
  adicionarDocumento,
  atualizarStatusDocumento,
  atualizarArquivoDocumento,
} from "@/lib/actions/documentos";
import { uploadDocumento } from "@/lib/upload";

interface DealDocumentsTabProps {
  atletaId: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pendente: {
    label: "Pendente",
    color: "text-zinc-400",
    bgColor: "bg-zinc-500/10 border-zinc-500/20",
  },
  enviado_atleta: {
    label: "Enviado",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
  },
  revisado: {
    label: "Revisado",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
  },
  enviado_escola: {
    label: "Env. Escola",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
  },
  aprovado: {
    label: "Aprovado",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
  },
};

const STATUS_FLOW: string[] = [
  "pendente",
  "enviado_atleta",
  "revisado",
  "enviado_escola",
  "aprovado",
];

function getNextStatus(current: string): string | null {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

function isDeadlineUrgent(deadline: string | null): boolean {
  if (!deadline) return false;
  const diff = new Date(deadline).getTime() - Date.now();
  const daysDiff = diff / (1000 * 60 * 60 * 24);
  return daysDiff < 14 && daysDiff >= 0;
}

function isDeadlineOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline).getTime() < Date.now();
}

export function DealDocumentsTab({ atletaId }: DealDocumentsTabProps) {
  const [docs, setDocs] = useState<DocumentoAtleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTipo, setNewTipo] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchDocs = async () => {
    try {
      const data = await listarDocumentos(atletaId);
      setDocs(data as DocumentoAtleta[]);
    } catch {
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atletaId]);

  const approvedCount = docs.filter((d) => d.status === "aprovado").length;
  const totalTipos = DOCUMENTO_TIPOS.length;
  const progressPct = totalTipos > 0 ? Math.round((approvedCount / totalTipos) * 100) : 0;

  const handleAddDoc = () => {
    if (!newTipo) {
      toast.error("Selecione o tipo do documento");
      return;
    }
    startTransition(async () => {
      const result = await adicionarDocumento(atletaId, {
        tipo: newTipo,
        deadline: newDeadline || undefined,
      });
      if (result.success) {
        toast.success("Documento adicionado");
        setShowAddForm(false);
        setNewTipo("");
        setNewDeadline("");
        await fetchDocs();
      } else {
        toast.error(result.error ?? "Erro ao adicionar documento");
      }
    });
  };

  const handleAdvanceStatus = (docId: string, currentStatus: string) => {
    const next = getNextStatus(currentStatus);
    if (!next) return;
    startTransition(async () => {
      const result = await atualizarStatusDocumento(docId, next);
      if (result.success) {
        toast.success(`Status atualizado para ${STATUS_CONFIG[next]?.label ?? next}`);
        await fetchDocs();
      } else {
        toast.error(result.error ?? "Erro ao atualizar status");
      }
    });
  };

  const handleFileUpload = async (docId: string, file: File) => {
    setUploadingDocId(docId);
    try {
      const url = await uploadDocumento(atletaId, "documento", file);
      const result = await atualizarArquivoDocumento(docId, url, file.name);
      if (result.success) {
        toast.success("Arquivo enviado");
        await fetchDocs();
      } else {
        toast.error(result.error ?? "Erro ao atualizar arquivo");
      }
    } catch {
      toast.error("Erro ao fazer upload do arquivo");
    } finally {
      setUploadingDocId(null);
    }
  };

  const getTipoLabel = (value: string): string => {
    return DOCUMENTO_TIPOS.find((t) => t.value === value)?.label ?? value;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-400">
            Progresso dos documentos
          </span>
          <span className="text-xs font-bold text-zinc-200">
            {approvedCount}/{totalTipos} aprovados
          </span>
        </div>
        <div className="h-2 rounded-full bg-[#1e2130] overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Document list */}
      <div className="space-y-2">
        {docs.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-6">
            Nenhum documento cadastrado ainda.
          </p>
        ) : (
          docs.map((doc) => {
            const statusCfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.pendente;
            const nextStatus = getNextStatus(doc.status);
            const urgent = isDeadlineUrgent(doc.deadline);
            const overdue = isDeadlineOverdue(doc.deadline);

            return (
              <div
                key={doc.id}
                className="rounded-xl border border-[#1e2130] bg-[#141720] p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-zinc-500" />
                    <span className="text-sm font-medium text-zinc-200">
                      {getTipoLabel(doc.tipo)}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold",
                      statusCfg.bgColor,
                      statusCfg.color,
                    )}
                  >
                    {doc.status === "aprovado" && (
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                    )}
                    {statusCfg.label}
                  </span>
                </div>

                {/* Deadline */}
                {doc.deadline && (
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-xs",
                      overdue
                        ? "text-red-400"
                        : urgent
                          ? "text-amber-400"
                          : "text-zinc-500",
                    )}
                  >
                    {(overdue || urgent) && (
                      <AlertTriangle className="h-3 w-3" />
                    )}
                    {!overdue && !urgent && <Clock className="h-3 w-3" />}
                    Prazo:{" "}
                    {new Date(doc.deadline).toLocaleDateString("pt-BR")}
                    {overdue && " (vencido)"}
                    {urgent && !overdue && " (< 14 dias)"}
                  </div>
                )}

                {/* File section */}
                {doc.arquivo_url ? (
                  <div className="flex items-center justify-between">
                    <a
                      href={doc.arquivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {doc.arquivo_nome ?? "Arquivo"}
                    </a>
                    <button
                      onClick={() => fileInputRefs.current[doc.id]?.click()}
                      disabled={uploadingDocId === doc.id}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {uploadingDocId === doc.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Substituir"
                      )}
                    </button>
                    <input
                      ref={(el) => { fileInputRefs.current[doc.id] = el; }}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(doc.id, file);
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={() => fileInputRefs.current[doc.id]?.click()}
                      disabled={uploadingDocId === doc.id}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#1e2130] px-3 py-2 text-xs text-zinc-500 hover:border-indigo-500/30 hover:text-indigo-400 transition-colors w-full justify-center"
                    >
                      {uploadingDocId === doc.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      Enviar arquivo
                    </button>
                    <input
                      ref={(el) => { fileInputRefs.current[doc.id] = el; }}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(doc.id, file);
                      }}
                    />
                  </div>
                )}

                {/* Advance status button */}
                {nextStatus && (
                  <button
                    onClick={() => handleAdvanceStatus(doc.id, doc.status)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600/20 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-600/30 transition-colors w-full justify-center"
                  >
                    {isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    Avancar para {STATUS_CONFIG[nextStatus]?.label ?? nextStatus}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add document form */}
      {showAddForm ? (
        <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-4 space-y-3">
          <p className="text-xs font-semibold text-zinc-300">Novo documento</p>
          <div>
            <label className="text-xs font-medium text-zinc-400">Tipo</label>
            <select
              value={newTipo}
              onChange={(e) => setNewTipo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#1e2130] bg-[#0f1117] py-2 px-3 text-sm text-zinc-200 outline-none focus:border-indigo-500 appearance-none"
            >
              <option value="">Selecionar tipo...</option>
              {DOCUMENTO_TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">
              Prazo (opcional)
            </label>
            <input
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#1e2130] bg-[#0f1117] py-2 px-3 text-sm text-zinc-200 outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddDoc}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Adicionar
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewTipo("");
                setNewDeadline("");
              }}
              className="rounded-lg px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#1e2130] px-4 py-3 text-xs text-zinc-500 hover:border-indigo-500/30 hover:text-indigo-400 transition-colors w-full justify-center"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar documento
        </button>
      )}
    </div>
  );
}
