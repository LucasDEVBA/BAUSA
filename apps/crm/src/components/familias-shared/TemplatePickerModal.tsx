"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, MessageSquare, X, Copy, Send, Sparkles } from "lucide-react";
import {
  listarTemplates,
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
}: TemplatePickerModalProps) {
  const [templates, setTemplates] = useState<MensagemTemplate[]>([]);
  const [loadPending, startLoadTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editedBody, setEditedBody] = useState<string | null>(null);

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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] rounded-2xl border border-[#1e2130] bg-[#0f1117] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e2130] px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/30">
              <Sparkles className="h-4 w-4 text-indigo-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Escolher template</p>
              <p className="text-[10px] text-zinc-500">
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
            className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Lista */}
          <div className="w-1/2 border-r border-[#1e2130] overflow-y-auto p-4">
            {loadPending ? (
              <div className="flex items-center justify-center py-12 text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Carregando...
              </div>
            ) : templates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#1e2130] py-10 text-center">
                <MessageSquare className="h-6 w-6 mx-auto text-zinc-600 mb-2" />
                <p className="text-xs text-zinc-500">Nenhum template disponível</p>
                <p className="text-[10px] text-zinc-600 mt-1">
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
                      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        <span>{cfg.emoji}</span> {cfg.label}
                      </p>
                      <div className="space-y-1">
                        {list.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelected(t)}
                            className={cn(
                              "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                              selected?.id === t.id
                                ? "border-indigo-500/40 bg-indigo-500/10"
                                : "border-[#1e2130] bg-[#141720] hover:border-indigo-500/30",
                            )}
                          >
                            <p className="text-xs font-semibold text-white">
                              {t.nome}
                            </p>
                            <p className="mt-0.5 text-[10px] text-zinc-500 line-clamp-2">
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
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Preview
                  </p>
                  {previewSubject && (
                    <div className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 mb-2">
                      <p className="text-[10px] text-zinc-500 mb-0.5">Assunto</p>
                      <p className="text-xs font-semibold text-zinc-200">
                        {previewSubject}
                      </p>
                    </div>
                  )}
                  <div className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-3">
                    <textarea
                      value={previewBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      rows={10}
                      className="w-full bg-transparent text-xs text-zinc-200 outline-none resize-none whitespace-pre-wrap"
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-zinc-600">
                    Você pode editar antes de enviar.
                  </p>
                </div>

                {/* Ações */}
                <div className="grid grid-cols-1 gap-2 pt-2 border-t border-[#1e2130]">
                  {(canal === "whatsapp" || selected.canal === "whatsapp" ||
                    selected.canal === "ambos") && (
                    <button
                      type="button"
                      onClick={handleSendWhatsApp}
                      disabled={!cleanPhone}
                      className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Enviar via WhatsApp
                    </button>
                  )}
                  {(canal === "email" || selected.canal === "email" ||
                    selected.canal === "ambos") && (
                    <button
                      type="button"
                      onClick={handleSendEmail}
                      disabled={!email}
                      className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Enviar via Email
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center justify-center gap-2 rounded-lg border border-[#1e2130] bg-[#141720] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-[#1a1d2a]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar mensagem
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-xs">Selecione um template à esquerda</p>
                <p className="text-[10px] text-zinc-600 mt-1">
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
