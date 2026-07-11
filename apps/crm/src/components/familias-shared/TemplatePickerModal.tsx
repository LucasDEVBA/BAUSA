"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Loader2, MessageSquare, X, Copy, Send, Sparkles } from "lucide-react";
import {
  enviarTemplateWhatsApp,
  listarTemplates,
  resolverDestinoTemplate,
  type DestinoTemplate,
  type MensagemTemplate,
  type TemplateCanal,
  type TemplateCategoria,
} from "@/lib/actions/templates";
import { renderTemplate } from "@/lib/template-render";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORIA_LABELS: Record<TemplateCategoria, { label: string; emoji: string }> = {
  onboarding: { label: "Onboarding", emoji: "👋" },
  checkin: { label: "Check-in", emoji: "🩺" },
  pre_embarque: { label: "Pré-embarque", emoji: "✈️" },
  pos_embarque: { label: "Pós-embarque", emoji: "🇺🇸" },
  documento: { label: "Documento", emoji: "📄" },
  crise: { label: "Crise", emoji: "🚨" },
  celebracao: { label: "Celebração", emoji: "🎉" },
  follow_up: { label: "Follow-up", emoji: "💬" },
  outro: { label: "Outro", emoji: "📝" },
};

interface TemplatePickerModalProps {
  open: boolean;
  onClose: () => void;
  canal: TemplateCanal;
  // Variáveis pra substituição
  vars: {
    atleta_nome?: string | null;
    responsavel_nome?: string | null;
    plano?: string | null;
    esporte?: string | null;
    data_embarque?: string | null;
    dias_sem_contato?: number | null;
  };
  // Destinos: phone (para WhatsApp) ou email
  phone?: string | null;
  email?: string | null;
  /** crm_experiencia.id — habilita o envio DIRETO via Z-API com registro na
   *  timeline. Quando ausente, a família é resolvida server-side pelo
   *  telefone + nome do atleta (resolverDestinoTemplate). */
  experienciaId?: string | null;
}

function sanitizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits;
}

export function TemplatePickerModal({
  open,
  onClose,
  canal,
  vars,
  phone,
  email,
  experienciaId,
}: TemplatePickerModalProps) {
  const [templates, setTemplates] = useState<MensagemTemplate[]>([]);
  const [loadPending, startLoadTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedBody, setEditedBody] = useState<string | null>(null);
  const [destino, setDestino] = useState<DestinoTemplate | null>(null);
  const [sendPending, startSendTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    startLoadTransition(async () => {
      const data = await listarTemplates({ canal });
      if (!cancelled) setTemplates(data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, canal]);

  // Resolve a família/número de destino do envio direto (server-side).
  const atletaNomeHint = vars.atleta_nome ?? null;
  useEffect(() => {
    if (!open || canal === "email") return;
    if (!experienciaId && !phone) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await resolverDestinoTemplate({
          experienciaId: experienciaId ?? null,
          telefone: phone ?? null,
          atletaNome: atletaNomeHint,
        });
        if (!cancelled) setDestino(result.success ? result.destino : null);
      } catch {
        if (!cancelled) setDestino(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, canal, experienciaId, phone, atletaNomeHint]);

  // Derivados durante render — evita cascading renders
  const selected = selectedId
    ? (templates.find((t) => t.id === selectedId) ?? null)
    : null;
  const defaultBody = selected ? renderTemplate(selected.corpo, vars) : "";
  const previewSubject = selected?.assunto
    ? renderTemplate(selected.assunto, vars)
    : "";
  const previewBody = editedBody ?? defaultBody;

  const setSelected = (t: MensagemTemplate | null) => {
    setSelectedId(t?.id ?? null);
    setEditedBody(null);
  };

  if (!open) return null;

  const cleanPhone = sanitizePhone(phone);

  const handleSendWhatsApp = () => {
    if (!cleanPhone) {
      toast.error("WhatsApp não cadastrado para esta família");
      return;
    }
    const encoded = encodeURIComponent(previewBody);
    window.open(
      `https://wa.me/${cleanPhone}?text=${encoded}`,
      "_blank",
      "noopener,noreferrer",
    );
    toast.success("WhatsApp aberto");
    onClose();
  };

  // Envio DIRETO via Z-API (CF send-whatsapp) + registro na timeline.
  const handleSendDireto = () => {
    if (!selected || !previewBody.trim()) return;
    if (!destino) {
      toast.error("Família não identificada para envio direto", {
        description: "Use \"Abrir no WhatsApp\" ou copie a mensagem.",
      });
      return;
    }
    const confirmado = window.confirm(
      `Enviar agora via WhatsApp para ${destino.telefoneDestino} (família de ${destino.atletaNome})?\n\nO contato será registrado na timeline da família.`,
    );
    if (!confirmado) return;

    startSendTransition(async () => {
      const result = await enviarTemplateWhatsApp(
        destino.experienciaId,
        selected.id,
        previewBody,
      );
      if (result.success) {
        toast.success("Mensagem enviada via WhatsApp", {
          description: result.detalhe,
        });
        onClose();
      } else {
        toast.error("Falha no envio via WhatsApp", {
          description: result.error ?? "Tente novamente.",
        });
      }
    });
  };

  const handleSendEmail = () => {
    if (!email) {
      toast.error("Email não cadastrado para esta família");
      return;
    }
    const s = encodeURIComponent(previewSubject || `Bolsa Atleta USA`);
    const b = encodeURIComponent(previewBody);
    window.location.href = `mailto:${email}?subject=${s}&body=${b}`;
    toast.success("Email aberto");
    onClose();
  };

  const handleCopy = () => {
    if (!previewBody) return;
    navigator.clipboard.writeText(previewBody);
    toast.success("Mensagem copiada");
  };

  // Agrupar por categoria
  const grouped = templates.reduce<Record<string, MensagemTemplate[]>>(
    (acc, t) => {
      if (!acc[t.categoria]) acc[t.categoria] = [];
      acc[t.categoria].push(t);
      return acc;
    },
    {},
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] rounded-2xl flex flex-col liquid-glass"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-plan-legacy/30">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Escolher template</p>
              <p className="text-[10px] text-muted-foreground">
                {canal === "whatsapp"
                  ? "Mensagens para WhatsApp"
                  : canal === "email"
                    ? "Mensagens para Email"
                    : "Todos os canais"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-fill-4 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Lista */}
          <div className="w-1/2 border-r border-border overflow-y-auto p-4">
            {loadPending ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Carregando...
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center">
                <MessageSquare className="h-6 w-6 mx-auto text-label-tertiary mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum template disponível</p>
                <p className="text-[10px] text-label-tertiary mt-1">
                  Crie templates em Configurações
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([cat, list]) => {
                  const cfg =
                    CATEGORIA_LABELS[cat as TemplateCategoria] ??
                    CATEGORIA_LABELS.outro;
                  return (
                    <div key={cat}>
                      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <span>{cfg.emoji}</span> {cfg.label}
                      </p>
                      <div className="space-y-1">
                        {list.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelected(t)}
                            className={cn(
                              "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                              selected?.id === t.id
                                ? "border-primary/40 bg-primary/10"
                                : "border-border bg-card hover:border-primary/30",
                            )}
                          >
                            <p className="text-xs font-semibold text-foreground">
                              {t.nome}
                            </p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
                              {t.corpo.slice(0, 80)}
                              {t.corpo.length > 80 ? "..." : ""}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="w-1/2 overflow-y-auto p-4">
            {selected ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Preview
                  </p>
                  {previewSubject && (
                    <div className="rounded-xl px-3 py-2 mb-2 border border-border/70 bg-card/60">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Assunto</p>
                      <p className="text-xs font-semibold text-foreground">
                        {previewSubject}
                      </p>
                    </div>
                  )}
                  <div className="rounded-xl px-3 py-3 border border-border/70 bg-card/60">
                    <textarea
                      value={previewBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      rows={10}
                      className="w-full bg-transparent text-xs text-foreground outline-none resize-none whitespace-pre-wrap"
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-label-tertiary">
                    Você pode editar antes de enviar.
                  </p>
                </div>

                {/* Ações */}
                <div className="grid grid-cols-1 gap-2 pt-2 border-t border-border">
                  {(canal === "whatsapp" || selected.canal === "whatsapp" ||
                    selected.canal === "ambos") && (
                    <>
                      <button
                        type="button"
                        onClick={handleSendDireto}
                        disabled={!destino || sendPending || !previewBody.trim()}
                        title={
                          destino
                            ? `Envio direto para ${destino.telefoneDestino}`
                            : "Família não identificada para envio direto"
                        }
                        className="flex items-center justify-center gap-2 rounded-md bg-sys-green px-4 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {sendPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {sendPending ? "Enviando..." : "Enviar via WhatsApp"}
                      </button>
                      {destino && (
                        <p className="text-center text-[10px] text-label-tertiary">
                          Envio direto para {destino.telefoneDestino} — registra o contato
                          na timeline da família.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={handleSendWhatsApp}
                        disabled={!cleanPhone}
                        className="flex items-center justify-center gap-2 rounded-md border border-sys-green/40 bg-sys-green/10 px-4 py-2 text-xs font-semibold text-sys-green hover:bg-sys-green/20 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Abrir no WhatsApp
                      </button>
                    </>
                  )}
                  {(canal === "email" || selected.canal === "email" ||
                    selected.canal === "ambos") && (
                    <button
                      type="button"
                      onClick={handleSendEmail}
                      disabled={!email}
                      className="flex items-center justify-center gap-2 rounded-md bg-sys-blue px-4 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Enviar via Email
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar mensagem
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-xs">Selecione um template à esquerda</p>
                <p className="text-[10px] text-label-tertiary mt-1">
                  para ver o preview com os dados da família
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
