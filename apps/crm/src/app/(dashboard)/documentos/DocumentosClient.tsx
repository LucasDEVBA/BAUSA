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
    color: "text-muted-foreground",
    bg: "bg-secondary border-border",
    icon: Clock,
  },
  enviado_atleta: {
    label: "Enviado",
    color: "text-sys-blue",
    bg: "bg-sys-blue/15 border-sys-blue/20",
    icon: Send,
  },
  revisado: {
    label: "Revisado",
    color: "text-sys-orange",
    bg: "bg-sys-orange/15 border-sys-orange/20",
    icon: Eye,
  },
  enviado_escola: {
    label: "Enviado Escola",
    color: "text-plan-legacy",
    bg: "bg-plan-legacy/15 border-plan-legacy/20",
    icon: Send,
  },
  aprovado: {
    label: "Aprovado",
    color: "text-sys-green",
    bg: "bg-sys-green/15 border-sys-green/20",
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
          className="mb-4 flex w-full items-center gap-3 rounded-xl border border-sys-orange/30 bg-sys-orange/10 px-5 py-3 text-left transition-colors hover:bg-sys-orange/15"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sys-orange/20">
            <AlertTriangle className="h-4 w-4 text-sys-orange" />
          </div>
          <div>
            <p className="text-sm font-bold text-sys-orange">
              {docsUrgentes.length} documento{docsUrgentes.length !== 1 ? "s" : ""} com deadline proximo
            </p>
            <p className="text-xs text-sys-orange/70">
              Documentos com prazo inferior a 14 dias e ainda nao aprovados
            </p>
          </div>
        </button>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-title-2 text-foreground">Documentos</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Checklist de documentos por atleta — acompanhe status e prazos
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Sidebar: lista de atletas */}
        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar atleta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-placeholder focus:border-primary/50 focus:outline-none"
            />
          </div>

          <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto">
            {filteredAtletas.length === 0 && (
              <p className="py-4 text-center text-xs text-label-tertiary">
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
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all",
                    isSelected
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-fill-4 hover:text-foreground"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{a.nome_completo}</p>
                    <p className="text-[10px] text-label-tertiary">
                      {aTotal > 0
                        ? `${aAprovados}/${aTotal} aprovados`
                        : "Sem documentos"}
                    </p>
                  </div>
                  {isSelected && (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main: checklist do atleta selecionado */}
        <div className="rounded-lg border border-border/70 bg-card/60 p-4">
          {!selectedAtleta ? (
            <div className="flex h-40 items-center justify-center text-sm text-label-tertiary">
              Selecione um atleta para ver o checklist
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {selectedAtleta.nome_completo}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {aprovados}/{total} documentos aprovados
                  </p>
                </div>
                {total > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sys-green transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {progressPct}%
                    </span>
                  </div>
                )}
              </div>

              {/* Document list */}
              <div className="space-y-2 mb-6">
                {atletaDocs.length === 0 && (
                  <p className="py-8 text-center text-sm text-label-tertiary">
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
                      className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3"
                    >
                      <Icon className={cn("h-4 w-4 flex-shrink-0", cfg.color)} />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
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
                                  ? "text-sys-red font-semibold"
                                  : isUrgent
                                  ? "text-sys-orange font-semibold"
                                  : "text-label-tertiary"
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
                              className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                              title={doc.arquivo_nome ?? "Arquivo"}
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span className="max-w-[80px] truncate">{doc.arquivo_nome ?? "Arquivo"}</span>
                            </a>
                            <label className="flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-fill-4 hover:text-foreground">
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
                              "flex cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary/30",
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
                          className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-primary/15 hover:text-foreground hover:border-primary/30 disabled:opacity-40"
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
                <div className="rounded-xl border border-dashed border-border p-4">
                  <p className="mb-3 text-xs font-semibold text-muted-foreground">
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
                            ? "border-primary/30 bg-primary/15 text-primary"
                            : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-fill-4"
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
                        <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                          Prazo (opcional)
                        </label>
                        <input
                          type="date"
                          value={addDeadline}
                          onChange={(e) => setAddDeadline(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={handleAddDocument}
                        disabled={isPending}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-40"
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
