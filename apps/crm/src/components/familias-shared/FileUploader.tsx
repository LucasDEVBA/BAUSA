"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Upload, X, FileText, Image as ImageIcon } from "lucide-react";
import { uploadFile, getFileSignedUrl, type UploadedFile } from "@/lib/actions/uploads";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FileUploaderProps {
  scope: "contatos" | "documentos" | "experiencia";
  scopeId: string;
  // Arquivos já anexados (controlled)
  attachments: UploadedFile[];
  onAttachmentsChange: (next: UploadedFile[]) => void;
  // UX
  multiple?: boolean;
  accept?: string;
  label?: string;
  compact?: boolean;
}

export function FileUploader({
  scope,
  scopeId,
  attachments,
  onAttachmentsChange,
  multiple = true,
  accept = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv",
  label = "Anexar arquivos",
  compact = false,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    startTransition(async () => {
      const uploaded: UploadedFile[] = [];
      for (const file of list) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("scope", scope);
        fd.append("scopeId", scopeId);
        const result = await uploadFile(fd);
        if (result.success) {
          uploaded.push(result.file);
        } else {
          toast.error(`Falha no upload de ${file.name}`, {
            description: result.error,
          });
        }
      }
      if (uploaded.length > 0) {
        onAttachmentsChange([...attachments, ...uploaded]);
        toast.success(
          uploaded.length === 1
            ? "Arquivo anexado"
            : `${uploaded.length} arquivos anexados`,
        );
      }
    });
  };

  const handleRemove = (idx: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== idx));
  };

  const handleOpen = (path: string) => {
    startTransition(async () => {
      const result = await getFileSignedUrl(path);
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Não foi possível abrir o arquivo", {
          description: result.error,
        });
      }
    });
  };

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed cursor-pointer transition-all",
          compact ? "p-3" : "p-5",
          dragOver
            ? "border-primary/60 bg-primary/10"
            : "border-border bg-card hover:border-primary/40 hover:bg-primary/5",
        )}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <Upload className="h-4 w-4 text-muted-foreground" />
        )}
        <p className="text-[11px] font-medium text-muted-foreground">
          {isPending ? "Enviando..." : label}
        </p>
        {!compact && (
          <p className="text-[10px] text-label-tertiary">
            Arraste ou clique • Máx 20MB • PNG, JPG, PDF, DOC, XLS, TXT
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Lista de anexos */}
      {attachments.length > 0 && (
        <div className="space-y-1">
          {attachments.map((file, idx) => {
            const isImage = file.type.startsWith("image/");
            const Icon = isImage ? ImageIcon : FileText;
            return (
              <div
                key={`${file.path}-${idx}`}
                className="group flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5 hover:border-primary/30 transition-colors"
              >
                <div
                  className={cn(
                    "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md",
                    isImage
                      ? "bg-plan-legacy/15 text-plan-legacy"
                      : "bg-sys-blue/15 text-sys-blue",
                  )}
                >
                  <Icon className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB ·{" "}
                    {new Date(file.uploaded_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpen(file.path);
                  }}
                  disabled={isPending}
                  className="rounded-md border border-border bg-background px-2 py-1 text-[10px] text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  Abrir
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(idx);
                  }}
                  disabled={isPending}
                  className="rounded-md p-1 text-muted-foreground hover:text-sys-red disabled:opacity-50"
                  aria-label="Remover anexo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Versão somente-leitura para exibir anexos sem permitir edição.
 */
export function AttachmentList({ attachments }: { attachments: UploadedFile[] }) {
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!attachments?.length) return null;

  const handleOpen = (path: string) => {
    setPendingPath(path);
    startTransition(async () => {
      const result = await getFileSignedUrl(path);
      setPendingPath(null);
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Não foi possível abrir", { description: result.error });
      }
    });
  };

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {attachments.map((file, idx) => {
        const isImage = file.type.startsWith("image/");
        const Icon = isImage ? ImageIcon : FileText;
        const loading = pendingPath === file.path;
        return (
          <button
            type="button"
            key={`${file.path}-${idx}`}
            onClick={() => handleOpen(file.path)}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <Icon className="h-2.5 w-2.5" />
            )}
            <span className="max-w-[140px] truncate">{file.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// Re-export do tipo para conveniência
export type { UploadedFile };
