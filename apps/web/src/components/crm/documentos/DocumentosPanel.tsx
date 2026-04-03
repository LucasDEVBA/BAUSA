"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, FileText, AlertTriangle } from "lucide-react";
import { listarDocumentos, adicionarDocumento, atualizarStatusDocumento } from "@/lib/crm/actions/documentos";
import { DOCUMENTO_TIPOS } from "@/types/crm";
import { cn } from "@/lib/utils";
import type { DocumentoAtleta } from "@/types/crm";
import { toast } from "sonner";

interface DocumentosPanelProps {
  atletaId: string;
}

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-[var(--crm-neutral-100)] text-[var(--crm-text-secondary)] border-[var(--crm-border)]",
  enviado_atleta: "bg-[var(--crm-info-subtle)] text-[var(--crm-info)] border-[var(--crm-info-border)]",
  revisado: "bg-[var(--crm-accent-bg)] text-[var(--crm-accent-text)] border-[var(--crm-accent-border)]",
  enviado_escola: "bg-[var(--crm-warning-subtle)] text-[var(--crm-warning)] border-[var(--crm-warning-border)]",
  aprovado: "bg-[var(--crm-success-subtle)] text-[var(--crm-success)] border-[var(--crm-success-border)]",
};

const STATUS_NEXT: Record<string, string> = {
  pendente: "enviado_atleta",
  enviado_atleta: "revisado",
  revisado: "enviado_escola",
  enviado_escola: "aprovado",
};

export function DocumentosPanel({ atletaId }: DocumentosPanelProps) {
  const router = useRouter();
  const [docs, setDocs] = useState<DocumentoAtleta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTipo, setNewTipo] = useState("historico_escolar");
  const [isPending, startTransition] = useTransition();

  useEffect(() => { loadDocs(); }, [atletaId]);

  const loadDocs = async () => {
    setLoading(true);
    const data = await listarDocumentos(atletaId);
    setDocs(data as DocumentoAtleta[]);
    setLoading(false);
  };

  const handleAdd = () => {
    startTransition(async () => {
      const result = await adicionarDocumento(atletaId, { tipo: newTipo });
      if (result.success) {
        toast.success("Documento adicionado!");
        await loadDocs();
        setShowAdd(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleStatus = (docId: string, currentStatus: string) => {
    const next = STATUS_NEXT[currentStatus];
    if (!next) return;
    startTransition(async () => {
      const result = await atualizarStatusDocumento(docId, next);
      if (result.success) {
        toast.success("Status atualizado!");
        await loadDocs();
      } else {
        toast.error(result.error);
      }
    });
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[var(--crm-text-tertiary)]" /></div>;

  const aprovados = docs.filter((d) => d.status === "aprovado").length;
  const hoje14d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">{aprovados}/{docs.length} aprovados</span>
        <button onClick={() => setShowAdd(!showAdd)} className="crm-btn crm-btn-secondary text-[var(--crm-text-xs)]">
          <Plus className="w-3 h-3" /> Adicionar
        </button>
      </div>

      {showAdd && (
        <div className="flex gap-2 items-end">
          <Select value={newTipo} onValueChange={setNewTipo}>
            <SelectTrigger className="crm-input flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOCUMENTO_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <button onClick={handleAdd} disabled={isPending} className="crm-btn crm-btn-primary">OK</button>
        </div>
      )}

      {docs.length === 0 ? (
        <div className="crm-empty-state py-6">
          <div className="crm-empty-state-icon">
            <FileText className="h-5 w-5" />
          </div>
          <p className="crm-empty-state-description">Nenhum documento.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const deadlineProxima = doc.deadline && doc.deadline <= hoje14d && doc.status !== "aprovado";
            const tipoLabel = DOCUMENTO_TIPOS.find((t) => t.value === doc.tipo)?.label || doc.tipo;
            return (
              <div key={doc.id} className={cn(
                "crm-card !p-2 !px-3",
                deadlineProxima && "border-[var(--crm-error-border)]",
              )}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-[var(--crm-text-tertiary)] shrink-0" />
                    <span className="text-[var(--crm-text-base)] text-[var(--crm-text-primary)] truncate">{tipoLabel}</span>
                    {deadlineProxima && <AlertTriangle className="w-3 h-3 text-[var(--crm-error)] shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("crm-badge crm-badge-no-dot text-[var(--crm-text-xs)]", STATUS_COLORS[doc.status] || "")}>
                      {doc.status.replace("_", " ")}
                    </span>
                    {STATUS_NEXT[doc.status] && (
                      <button
                        className="crm-btn crm-btn-ghost text-[var(--crm-text-xs)] !p-1 !px-2"
                        disabled={isPending}
                        onClick={() => handleStatus(doc.id, doc.status)}
                      >
                        {STATUS_NEXT[doc.status].replace("_", " ")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
