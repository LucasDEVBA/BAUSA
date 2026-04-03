"use client";

import { useState, useTransition } from "react";
import {
  FileText,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  Plus,
  Search,
  Upload,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  adicionarDocumento,
  atualizarStatusDocumento,
  atualizarArquivoDocumento,
} from "@/lib/actions/documentos";
import { uploadDocumento } from "@/lib/upload";
import { DOCUMENTO_TIPOS, type DocumentoAtleta } from "@/types/crm";

interface AtletaResumo {
  id: string;
  nome_completo: string;
  form_submission_id: string | null;
}

interface DocumentosClientProps {
  atletasIniciais: AtletaResumo[];
  documentosIniciais: Record<string, unknown>[];
}

const STATUS_CONFIG: Record<
  DocumentoAtleta["status"],
  { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }
> = {
  pendente: {
    label: "Pendente",
    color: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/20",
    icon: Clock,
  },
  enviado_atleta: {
    label: "Enviado",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    icon: Send,
  },
  revisado: {
    label: "Revisado",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    icon: Eye,
  },
  enviado_escola: {
    label: "Enviado Escola",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    icon: Send,
  },
  aprovado: {
    label: "Aprovado",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    icon: CheckCircle2,
  },
};

const STATUS_FLOW: DocumentoAtleta["status"][] = [
  "pendente",
  "enviado_atleta",
  "revisado",
  "enviado_escola",
  "aprovado",
];

function getNextStatus(current: DocumentoAtleta["status"]): DocumentoAtleta["status"] | null {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

function daysUntilDeadline(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function DocumentosClient({
  atletasIniciais,
  documentosIniciais,
}: DocumentosClientProps) {
  const [atletas] = useState(atletasIniciais);
  const [documentos, setDocumentos] = useState(documentosIniciais as unknown as DocumentoAtleta[]);
  const [selectedAtletaId, setSelectedAtletaId] = useState<string>(
    atletasIniciais[0]?.id ?? ""
  );
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [addingType, setAddingType] = useState<string | null>(null);
  const [addDeadline, setAddDeadline] = useState("");
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  const filteredAtletas = atletas.filter((a) =>
    a.nome_completo.toLowerCase().includes(search.toLowerCase())
  );

  const atletaDocs = documentos.filter((d) => d.atleta_id === selectedAtletaId);
  const selectedAtleta = atletas.find((a) => a.id === selectedAtletaId);

  const aprovados = atletaDocs.filter((d) => d.status === "aprovado").length;
  const total = atletaDocs.length;
  const progressPct = total > 0 ? Math.round((aprovados / total) * 100) : 0;

  async function handleAdvanceStatus(doc: DocumentoAtleta) {
    const next = getNextStatus(doc.status);
    if (!next) return;

    startTransition(async () => {
      const result = await atualizarStatusDocumento(doc.id, next);
      if (result.success) {
        setDocumentos((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, status: next } : d))
        );
        toast.success(`Status atualizado para "${STATUS_CONFIG[next].label}"`);
      } else {
        toast.error(result.error ?? "Erro ao atualizar status");
      }
    });
  }

  async function handleAddDocument() {
    if (!addingType || !selectedAtletaId) return;

    startTransition(async () => {
      const result = await adicionarDocumento(selectedAtletaId, {
        tipo: addingType,
        deadline: addDeadline || undefined,
      });
      if (result.success) {
        const newDoc: DocumentoAtleta = {
          id: result.documentoId!,
          atleta_id: selectedAtletaId,
          escola_id: null,
          tipo: addingType,
          status: "pendente",
          arquivo_url: null,
          arquivo_nome: null,
          data_upload: null,
          data_envio_escola: null,
          deadline: addDeadline || null,
          observacao: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        };
        setDocumentos((prev) => [...prev, newDoc]);
        setAddingType(null);
        setAddDeadline("");
        toast.success("Documento adicionado ao checklist");
      } else {
        toast.error(result.error ?? "Erro ao adicionar documento");
      }
    });
  }

  async function handleFileUpload(doc: DocumentoAtleta, file: File) {
    if (!file) return;
    setUploadingDocId(doc.id);
    try {
      const publicUrl = await uploadDocumento(doc.atleta_id, doc.tipo, file);
      const result = await atualizarArquivoDocumento(doc.id, publicUrl, file.name);
      if (result.success) {
        setDocumentos((prev) =>
          prev.map((d) =>
            d.id === doc.id
              ? { ...d, arquivo_url: publicUrl, arquivo_nome: file.name, data_upload: new Date().toISOString() }
              : d,
          ),
        );
        toast.success(`Arquivo "${file.name}" enviado com sucesso`);
      } else {
        toast.error(result.error ?? "Erro ao atualizar documento");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro no upload: ${message}`);
    } finally {
      setUploadingDocId(null);
    }
  }

  // Tipos que ainda nao tem doc para esse atleta
  const missingTypes = DOCUMENTO_TIPOS.filter(
    (t) => !atletaDocs.some((d) => d.tipo === t.value)
  );

  // Documents with deadline < 14 days and not approved
  const docsUrgentes = documentos.filter((d) => {
    if (d.status === "aprovado") return false;
    const days = daysUntilDeadline(d.deadline);
    return days !== null && days < 14;
  });

  const handleScrollToUrgent = () => {
    if (docsUrgentes.length > 0) {
      const firstUrgentAtletaId = docsUrgentes[0].atleta_id;
      setSelectedAtletaId(firstUrgentAtletaId);
    }
  };

  return (
    <div className="p-6">
      {/* Urgent documents banner */}
      {docsUrgentes.length > 0 && (
        <button
          onClick={handleScrollToUrgent}
          className="mb-4 flex w-full items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-left transition-colors hover:bg-amber-500/15"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-400">
              {docsUrgentes.length} documento{docsUrgentes.length !== 1 ? "s" : ""} com deadline proximo
            </p>
            <p className="text-xs text-amber-300/70">
              Documentos com prazo inferior a 14 dias e ainda nao aprovados
            </p>
          </div>
        </button>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-indigo-400" />
          <h1 className="text-xl font-bold text-white">Documentos</h1>
        </div>
        <p className="text-sm text-zinc-500">
          Checklist de documentos por atleta — acompanhe status e prazos
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar: lista de atletas */}
        <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar atleta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#1e2130] bg-[#0c0e16] pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500/50 focus:outline-none"
            />
          </div>

          <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto">
            {filteredAtletas.length === 0 && (
              <p className="py-4 text-center text-xs text-zinc-600">
                Nenhum atleta encontrado
              </p>
            )}
            {filteredAtletas.map((a) => {
              const aDocs = documentos.filter((d) => d.atleta_id === a.id);
              const aAprovados = aDocs.filter((d) => d.status === "aprovado").length;
              const aTotal = aDocs.length;
              const isSelected = a.id === selectedAtletaId;

              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAtletaId(a.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all",
                    isSelected
                      ? "bg-indigo-600/20 text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{a.nome_completo}</p>
                    <p className="text-[10px] text-zinc-600">
                      {aTotal > 0
                        ? `${aAprovados}/${aTotal} aprovados`
                        : "Sem documentos"}
                    </p>
                  </div>
                  {isSelected && (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-indigo-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main: checklist do atleta selecionado */}
        <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-6">
          {!selectedAtleta ? (
            <div className="flex h-40 items-center justify-center text-sm text-zinc-600">
              Selecione um atleta para ver o checklist
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {selectedAtleta.nome_completo}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {aprovados}/{total} documentos aprovados
                  </p>
                </div>
                {total > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 rounded-full bg-[#1e2130] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-zinc-400">
                      {progressPct}%
                    </span>
                  </div>
                )}
              </div>

              {/* Document list */}
              <div className="space-y-2 mb-6">
                {atletaDocs.length === 0 && (
                  <p className="py-8 text-center text-sm text-zinc-600">
                    Nenhum documento cadastrado. Adicione abaixo.
                  </p>
                )}
                {atletaDocs.map((doc) => {
                  const cfg = STATUS_CONFIG[doc.status];
                  const Icon = cfg.icon;
                  const next = getNextStatus(doc.status);
                  const days = daysUntilDeadline(doc.deadline);
                  const isUrgent = days !== null && days >= 0 && days < 14;
                  const isOverdue = days !== null && days < 0;
                  const tipoLabel =
                    DOCUMENTO_TIPOS.find((t) => t.value === doc.tipo)?.label ??
                    doc.tipo;

                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 rounded-lg border border-[#1e2130] bg-[#0c0e16] px-4 py-3"
                    >
                      <Icon className={cn("h-4 w-4 flex-shrink-0", cfg.color)} />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200">
                          {tipoLabel}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                              cfg.bg,
                              cfg.color
                            )}
                          >
                            {cfg.label}
                          </span>
                          {doc.deadline && (
                            <span
                              className={cn(
                                "text-[10px]",
                                isOverdue
                                  ? "text-red-400 font-semibold"
                                  : isUrgent
                                  ? "text-amber-400 font-semibold"
                                  : "text-zinc-600"
                              )}
                            >
                              {isOverdue && (
                                <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                              )}
                              Prazo: {new Date(doc.deadline).toLocaleDateString("pt-BR")}
                              {isOverdue && " (vencido)"}
                              {isUrgent && !isOverdue && ` (${days}d restantes)`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* File upload / download */}
                      <div className="flex items-center gap-2">
                        {doc.arquivo_url ? (
                          <>
                            <a
                              href={doc.arquivo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                              title={doc.arquivo_nome ?? "Arquivo"}
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span className="max-w-[80px] truncate">{doc.arquivo_nome ?? "Arquivo"}</span>
                            </a>
                            <label className="flex cursor-pointer items-center gap-1 rounded-md border border-[#1e2130] px-2 py-1 text-[10px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300">
                              <RefreshCw className="h-2.5 w-2.5" />
                              Substituir
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(doc, file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </>
                        ) : (
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[#1e2130] bg-[#141720] px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-indigo-600/10 hover:text-indigo-300 hover:border-indigo-500/30",
                              uploadingDocId === doc.id && "opacity-50 pointer-events-none",
                            )}
                          >
                            {uploadingDocId === doc.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Upload className="h-3 w-3" />
                            )}
                            Upload
                            <input
                              type="file"
                              className="hidden"
                              disabled={uploadingDocId === doc.id}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(doc, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>

                      {next && (
                        <button
                          onClick={() => handleAdvanceStatus(doc)}
                          disabled={isPending}
                          className="flex items-center gap-1.5 rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-indigo-600/20 hover:text-white hover:border-indigo-500/30 disabled:opacity-40"
                        >
                          <ChevronRight className="h-3 w-3" />
                          {STATUS_CONFIG[next].label}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add document */}
              {missingTypes.length > 0 && (
                <div className="rounded-lg border border-dashed border-[#1e2130] p-4">
                  <p className="mb-3 text-xs font-semibold text-zinc-500">
                    Adicionar documento
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {missingTypes.map((t) => (
                      <button
                        key={t.value}
                        onClick={() =>
                          setAddingType(addingType === t.value ? null : t.value)
                        }
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                          addingType === t.value
                            ? "border-indigo-500/30 bg-indigo-600/20 text-indigo-300"
                            : "border-[#1e2130] bg-[#0c0e16] text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                        )}
                      >
                        <Plus className="mr-1 inline h-3 w-3" />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {addingType && (
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="mb-1 block text-[10px] font-medium text-zinc-500">
                          Prazo (opcional)
                        </label>
                        <input
                          type="date"
                          value={addDeadline}
                          onChange={(e) => setAddDeadline(e.target.value)}
                          className="w-full rounded-lg border border-[#1e2130] bg-[#0c0e16] px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500/50 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={handleAddDocument}
                        disabled={isPending}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
                      >
                        Adicionar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
