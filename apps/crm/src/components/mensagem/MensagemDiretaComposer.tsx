"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { FileText, Loader2, Mail, MessageSquare, Send, Upload, User, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button, Input, BrandTabs } from "@/components/ui";
import { MensagemPreview } from "@/components/automacoes/MensagemPreview";
import { uploadAutomacaoImagem } from "@/lib/actions/automacoes-media";
import { uploadMensagemArquivo } from "@/lib/actions/mensagem-media";
import { enviarMensagemDireta } from "@/lib/actions/mensagem-direta";

/**
 * MensagemDiretaComposer (I4) — o CEO envia mensagem automatizada (WhatsApp
 * ou e-mail) para UM lead, direto do detalhe do lead/deal. Abre como painel
 * sobreposto DENTRO do modal de detalhe. Sem placeholders: a mensagem é para
 * ESTE lead — o botão "Inserir nome" insere o primeiro nome literal. Preview
 * ao vivo via MensagemPreview com os nomes REAIS. Documento (PDF) entra na
 * mensagem como LINK (WhatsApp: card clicável · e-mail: botão).
 */

const MENSAGEM_MIN = 5;
const MENSAGEM_MAX = 2000;
const ASSUNTO_MAX = 150;
const LINK_TITULO_MAX = 120;

const FIELD_CLASS =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-placeholder outline-none focus:border-primary/40";

const CLASSIFICATION_BADGE: Record<string, string> = {
  QUENTE: "bg-sys-green/12 text-sys-green",
  MORNO: "bg-sys-orange/12 text-sys-orange",
  FRIO: "bg-sys-blue/12 text-sys-blue",
};

export type CanalMensagem = "whatsapp" | "email";

export interface MensagemDestinatario {
  /** Nome real do atleta. */
  nome: string;
  responsavelNome?: string | null;
  telefone?: string | null;
  email?: string | null;
  /** QUENTE/MORNO/FRIO — contexto exibido; NÃO bloqueia (envio manual). */
  classificacao?: string | null;
  /** form_submissions.id (detalhe do lead). */
  leadId?: string;
  /** deals.id (detalhe do deal). */
  dealId?: string;
}

interface MensagemDiretaComposerProps {
  canalInicial: CanalMensagem;
  destinatario: MensagemDestinatario;
  onClose: () => void;
}

export function MensagemDiretaComposer({
  canalInicial,
  destinatario,
  onClose,
}: MensagemDiretaComposerProps) {
  const [canal, setCanal] = useState<CanalMensagem>(canalInicial);
  const [mensagem, setMensagem] = useState("");
  const [assunto, setAssunto] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitulo, setLinkTitulo] = useState("");
  const [enviando, startEnvio] = useTransition();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Esc fecha SÓ o compositor (capture + stopPropagation impede o listener
  // do modal de detalhe, registrado em bubble no window, de fechar tudo).
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onEsc, true);
    return () => window.removeEventListener("keydown", onEsc, true);
  }, [onClose]);

  const primeiroNome = destinatario.nome.trim().split(/\s+/)[0] ?? "";
  const contato = canal === "whatsapp" ? destinatario.telefone : destinatario.email;
  const mensagemValida = mensagem.trim().length >= MENSAGEM_MIN && mensagem.trim().length <= MENSAGEM_MAX;
  const assuntoValido = canal !== "email" || assunto.trim().length > 0;
  const podeEnviar = Boolean(contato) && mensagemValida && assuntoValido && !enviando;

  const inserirNome = () => {
    const el = textareaRef.current;
    if (!el || !primeiroNome) return;
    const start = el.selectionStart ?? mensagem.length;
    const end = el.selectionEnd ?? mensagem.length;
    const next = `${mensagem.slice(0, start)}${primeiroNome}${mensagem.slice(end)}`;
    setMensagem(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + primeiroNome.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleEnviar = () => {
    if (!podeEnviar || !contato) return;
    const confirmado = window.confirm(
      `Enviar ${canal === "whatsapp" ? "WhatsApp" : "e-mail"} para ${destinatario.nome} (${contato})?`,
    );
    if (!confirmado) return;

    startEnvio(async () => {
      const r = await enviarMensagemDireta({
        canal,
        leadId: destinatario.leadId,
        dealId: destinatario.dealId,
        mensagem: mensagem.trim(),
        assunto: canal === "email" ? assunto.trim() : undefined,
        imagemUrl: imagemUrl.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
        linkTitulo: linkTitulo.trim() || undefined,
      });
      if (r.success) {
        toast.success(r.detalhe ?? "Mensagem enviada.");
        onClose();
      } else {
        toast.error(r.error ?? "Falha no envio.");
      }
    });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Mensagem direta para ${destinatario.nome}`}
          className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          {/* Header */}
          <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
            <Send className="h-3.5 w-3.5 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-[11px] font-semibold text-foreground">Mensagem direta</h2>
                {destinatario.classificacao && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-1.5 py-px text-[9px] font-semibold",
                      CLASSIFICATION_BADGE[destinatario.classificacao] ??
                        "bg-secondary text-muted-foreground",
                    )}
                    title="Classificação Gemini — contexto; não bloqueia envio manual"
                  >
                    {destinatario.classificacao}
                  </span>
                )}
              </div>
              <p className="truncate text-[10px] text-muted-foreground">
                Envio manual do CEO — a classificação não bloqueia.
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Fechar compositor"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </header>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <BrandTabs
              ariaLabel="Canal da mensagem"
              activeId={canal}
              onSelect={(id) => setCanal(id as CanalMensagem)}
              items={[
                { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
                { id: "email", label: "E-mail", icon: Mail },
              ]}
            />

            {/* Destinatário (read-only, resolvido de novo no server) */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2">
              <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">
                  {destinatario.nome}
                  {destinatario.responsavelNome && (
                    <span className="font-normal text-muted-foreground">
                      {" "}· resp. {destinatario.responsavelNome}
                    </span>
                  )}
                </p>
                <p className="truncate text-[10px] tabular-nums text-muted-foreground">
                  {canal === "whatsapp" ? "WhatsApp: " : "E-mail: "}
                  {contato ?? "— não cadastrado"}
                </p>
              </div>
            </div>
            {!contato && (
              <p className="rounded-md bg-sys-red/10 px-3 py-2 text-[11px] text-sys-red">
                Este lead não tem {canal === "whatsapp" ? "telefone" : "e-mail"} cadastrado —
                troque o canal ou complete o cadastro.
              </p>
            )}

            {canal === "email" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="msg-direta-assunto" className="text-[11px] font-semibold text-foreground">
                    Assunto
                  </label>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      assunto.trim().length > 0 && assunto.length <= ASSUNTO_MAX
                        ? "text-muted-foreground"
                        : "text-sys-red",
                    )}
                  >
                    {assunto.length}/{ASSUNTO_MAX}
                  </span>
                </div>
                <Input
                  id="msg-direta-assunto"
                  maxLength={ASSUNTO_MAX}
                  placeholder="Assunto do e-mail (obrigatório)"
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="msg-direta-texto" className="text-[11px] font-semibold text-foreground">
                  Mensagem
                </label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={inserirNome} disabled={!primeiroNome}>
                    Inserir nome ({primeiroNome || "—"})
                  </Button>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      mensagemValida ? "text-muted-foreground" : "text-sys-red",
                    )}
                  >
                    {mensagem.length}/{MENSAGEM_MAX}
                  </span>
                </div>
              </div>
              <textarea
                ref={textareaRef}
                id="msg-direta-texto"
                className={cn(FIELD_CLASS, "min-h-28 resize-y leading-relaxed")}
                placeholder={`Escreva a mensagem para ${primeiroNome || "o lead"}…${canal === "whatsapp" ? " Formatação WhatsApp: *negrito* e _itálico_." : ""}`}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                autoFocus
              />
            </div>

            {/* Link + título */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-foreground">Link (opcional)</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  type="url"
                  aria-label="URL do link (opcional)"
                  placeholder="URL do link (https://…)"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                <Input
                  aria-label="Título do link"
                  placeholder="Título do link/botão"
                  maxLength={LINK_TITULO_MAX}
                  value={linkTitulo}
                  onChange={(e) => setLinkTitulo(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {canal === "whatsapp"
                  ? "Com link, a mensagem sai como card clicável (URL anexada ao final quando não está no texto)."
                  : "No e-mail, o link vira um botão abaixo do texto."}
              </p>
            </div>

            {/* Imagem */}
            <UploadImagemField
              url={imagemUrl}
              onChange={setImagemUrl}
              hint={
                canal === "whatsapp"
                  ? "No WhatsApp, a imagem acompanha o card do link — exige o link acima."
                  : "No e-mail, a imagem entra no topo do corpo."
              }
            />

            {/* Documento → link */}
            <UploadDocumentoField
              onUploaded={(url, nome) => {
                setLinkUrl(url);
                if (!linkTitulo.trim()) setLinkTitulo(nome.replace(/\.[^.]+$/, "").slice(0, LINK_TITULO_MAX));
              }}
            />

            <MensagemPreview
              canal={canal}
              mensagem={mensagem}
              assunto={canal === "email" ? assunto : undefined}
              imagemUrl={imagemUrl}
              linkUrl={linkUrl}
              linkTitulo={linkTitulo}
              vars={{
                "{atleta_nome}": destinatario.nome,
                "{responsavel_nome}": destinatario.responsavelNome ?? "Responsável",
              }}
              className="pt-1"
            />
          </div>

          {/* Footer */}
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={enviando}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={handleEnviar} disabled={!podeEnviar}>
              {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {enviando ? "Enviando…" : `Enviar ${canal === "whatsapp" ? "WhatsApp" : "e-mail"}`}
            </Button>
          </footer>
        </div>
      </div>
    </>
  );
}

// ─── Upload de imagem (reusa uploadAutomacaoImagem — bucket público) ────────

function UploadImagemField({
  url,
  onChange,
  hint,
}: {
  url: string;
  onChange: (url: string) => void;
  hint: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();

  const handleFile = (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    startUpload(async () => {
      const r = await uploadAutomacaoImagem(fd);
      if (r.success) {
        onChange(r.url);
        toast.success("Imagem enviada");
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-foreground">Imagem (opcional)</p>
      {url.trim() && (
        <div className="relative overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Pré-visualização da imagem" className="max-h-28 w-full object-cover" />
          <button
            type="button"
            aria-label="Remover imagem"
            onClick={() => onChange("")}
            className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Enviando…" : "Enviar imagem"}
        </Button>
        <Input
          type="url"
          aria-label="URL da imagem"
          placeholder="ou cole uma URL https://…"
          value={url}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

// ─── Upload de documento (PDF → vira LINK na mensagem) ──────────────────────

function UploadDocumentoField({
  onUploaded,
}: {
  onUploaded: (url: string, nomeArquivo: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();

  const handleFile = (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    startUpload(async () => {
      const r = await uploadMensagemArquivo(fd);
      if (r.success) {
        onUploaded(r.url, r.nomeArquivo);
        toast.success("Documento enviado — adicionado como link da mensagem");
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-foreground">Documento (opcional)</p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <FileText className="h-3.5 w-3.5" />
          {uploading ? "Enviando…" : "Enviar documento (PDF)"}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          O documento vira <strong>link</strong> na mensagem (WhatsApp: card clicável · e-mail: botão).
        </p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
