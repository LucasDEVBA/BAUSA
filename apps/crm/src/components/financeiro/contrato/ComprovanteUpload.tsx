"use client";

import { useId, useState } from "react";
import { CheckCircle2, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { uploadDocumento } from "@/lib/upload";

const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];

/**
 * Comprovante opcional (T11/T9). Reusa o bucket "documentos" do atleta (mesmo
 * helper do contrato assinado) em `<atleta>/comprovante_financeiro/<timestamp>-<nome>`
 * — o timestamp evita sobrescrever outro comprovante com o mesmo nome.
 */
export function ComprovanteUpload({
  atletaId,
  valor,
  onChange,
}: {
  atletaId: string | null | undefined;
  valor: string | null;
  onChange: (url: string | null) => void;
}) {
  const id = useId();
  const [enviando, setEnviando] = useState(false);
  if (!atletaId) return null;

  const enviar = async (file: File) => {
    if (file.size > MAX_BYTES) return void toast.error("Arquivo maior que 10 MB.");
    if (!TIPOS.includes(file.type)) return void toast.error("Envie PDF ou imagem (JPG, PNG, WEBP, HEIC).");
    setEnviando(true);
    try {
      const nome = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      onChange(await uploadDocumento(atletaId, "comprovante_financeiro", new File([file], nome, { type: file.type })));
    } catch (err) {
      console.error({ level: "error", action: "comprovante_upload", error: String(err) });
      toast.error("Não foi possível enviar o comprovante.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">Comprovante (opcional)</label>
      <div className="flex items-center gap-2">
        <input id={id} type="file" accept=".pdf,image/*" disabled={enviando}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void enviar(f); }}
          className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-secondary file:px-2.5 file:py-1.5 file:text-xs file:font-medium" />
        {enviando && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Enviando" />}
        {valor && !enviando && <CheckCircle2 className="size-4 text-sys-green" aria-label="Comprovante enviado" />}
      </div>
      {valor && (
        <a href={valor} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary">
          <Paperclip className="size-3" aria-hidden />Ver comprovante
        </a>
      )}
    </div>
  );
}
