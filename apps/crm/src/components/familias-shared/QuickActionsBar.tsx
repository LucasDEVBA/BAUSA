"use client";

import {
  MessageCircle,
  Mail,
  Phone,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TemplatePickerModal } from "./TemplatePickerModal";

interface QuickActionsBarProps {
  athleteName: string;
  guardianName: string;
  whatsapp_responsavel: string | null;
  whatsapp_atleta: string | null;
  email: string | null;
  email_responsavel: string | null;
  // Para templates
  plano?: string | null;
  esporte?: string | null;
  data_embarque?: string | null;
  dias_sem_contato?: number | null;
}

function sanitizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits;
}

function buildWhatsAppUrl(phone: string, message: string): string {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encoded}`;
}

function buildMailtoUrl(email: string, subject: string, body: string): string {
  const s = encodeURIComponent(subject);
  const b = encodeURIComponent(body);
  return `mailto:${email}?subject=${s}&body=${b}`;
}

interface ActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel?: string;
  href?: string;
  onClick?: () => void;
  variant: "whatsapp" | "email" | "phone" | "copy";
  disabled?: boolean;
}

function ActionButton({
  icon: Icon,
  label,
  sublabel,
  href,
  onClick,
  variant,
  disabled,
}: ActionButtonProps) {
  const styles = {
    whatsapp:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50",
    email:
      "border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:border-blue-500/50",
    phone:
      "border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50",
    copy: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300 hover:bg-zinc-500/20 hover:border-zinc-500/50",
  };

  const baseClass = cn(
    "group flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all duration-200",
    !disabled && styles[variant],
    disabled && "opacity-40 cursor-not-allowed border-[#1e2130] bg-[#141720]",
    !disabled && "hover:scale-[1.02] active:scale-[0.98]",
  );

  const content = (
    <>
      <div
        className={cn(
          "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md",
          variant === "whatsapp" && "bg-emerald-500/20",
          variant === "email" && "bg-blue-500/20",
          variant === "phone" && "bg-purple-500/20",
          variant === "copy" && "bg-zinc-500/20",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold leading-tight">{label}</p>
        {sublabel && (
          <p className="text-[10px] text-zinc-500 truncate leading-tight mt-0.5">
            {sublabel}
          </p>
        )}
      </div>
    </>
  );

  if (disabled) {
    return <div className={baseClass}>{content}</div>;
  }

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={baseClass}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={baseClass}>
      {content}
    </button>
  );
}

export function QuickActionsBar({
  athleteName,
  guardianName,
  whatsapp_responsavel,
  whatsapp_atleta,
  email,
  email_responsavel,
  plano,
  esporte,
  data_embarque,
  dias_sem_contato,
}: QuickActionsBarProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [templatePicker, setTemplatePicker] = useState<{
    open: boolean;
    canal: "whatsapp" | "email";
    phone: string | null;
    email: string | null;
  } | null>(null);

  const respPhone = sanitizePhone(whatsapp_responsavel);
  const athPhone = sanitizePhone(whatsapp_atleta);

  const templateVars = {
    atleta_nome: athleteName,
    responsavel_nome: guardianName,
    plano: plano ?? null,
    esporte: esporte ?? null,
    data_embarque: data_embarque ?? null,
    dias_sem_contato: dias_sem_contato ?? null,
  };

  const respMessage = `Olá ${guardianName.split(" ")[0]}, tudo bem? Aqui é o time da Bolsa Atleta USA — passando para falar sobre o processo do ${athleteName.split(" ")[0]}.`;
  const athMessage = `Olá ${athleteName.split(" ")[0]}! Aqui é o time da Bolsa Atleta USA. Tudo bem?`;

  const emailSubject = `Bolsa Atleta USA — ${athleteName}`;
  const emailBody = `Olá!\n\nEspero que esteja tudo bem com a família.\n\nEstou entrando em contato sobre o processo de ${athleteName} na Bolsa Atleta USA.\n\n—\nTime BAUSA`;

  const handleCopy = (text: string | null, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copiado!", { description: text });
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="rounded-xl border border-[#1e2130] bg-gradient-to-br from-[#141720] to-[#0f1117] p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Ações rápidas de contato
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setTemplatePicker({
                open: true,
                canal: "whatsapp",
                phone: whatsapp_responsavel ?? whatsapp_atleta,
                email: email_responsavel ?? email,
              })
            }
            className="flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            Usar template
          </button>
          <span className="text-[10px] text-zinc-600">
            {[respPhone, athPhone, email, email_responsavel].filter(Boolean).length}{" "}
            canais
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {/* WhatsApp Responsável */}
        <ActionButton
          icon={MessageCircle}
          variant="whatsapp"
          label="WhatsApp Responsável"
          sublabel={whatsapp_responsavel ?? "Não cadastrado"}
          href={
            respPhone ? buildWhatsAppUrl(respPhone, respMessage) : undefined
          }
          disabled={!respPhone}
        />

        {/* WhatsApp Atleta (só se diferente do responsável) */}
        <ActionButton
          icon={MessageCircle}
          variant="whatsapp"
          label="WhatsApp Atleta"
          sublabel={whatsapp_atleta ?? "Não cadastrado"}
          href={athPhone ? buildWhatsAppUrl(athPhone, athMessage) : undefined}
          disabled={!athPhone || athPhone === respPhone}
        />

        {/* Email Responsável */}
        <ActionButton
          icon={Mail}
          variant="email"
          label="Email Responsável"
          sublabel={email_responsavel ?? "Não cadastrado"}
          href={
            email_responsavel
              ? buildMailtoUrl(email_responsavel, emailSubject, emailBody)
              : undefined
          }
          disabled={!email_responsavel}
        />

        {/* Email Atleta */}
        <ActionButton
          icon={Mail}
          variant="email"
          label="Email Atleta"
          sublabel={email ?? "Não cadastrado"}
          href={email ? buildMailtoUrl(email, emailSubject, emailBody) : undefined}
          disabled={!email || email === email_responsavel}
        />

        {/* Ligar Responsável */}
        <ActionButton
          icon={Phone}
          variant="phone"
          label="Ligar Responsável"
          sublabel={whatsapp_responsavel ?? "Não cadastrado"}
          href={respPhone ? `tel:+${respPhone}` : undefined}
          disabled={!respPhone}
        />

        {/* Ligar Atleta */}
        <ActionButton
          icon={Phone}
          variant="phone"
          label="Ligar Atleta"
          sublabel={whatsapp_atleta ?? "Não cadastrado"}
          href={athPhone ? `tel:+${athPhone}` : undefined}
          disabled={!athPhone || athPhone === respPhone}
        />

        {/* Copiar WhatsApp */}
        <ActionButton
          icon={copiedField === "whatsapp" ? Check : Copy}
          variant="copy"
          label="Copiar WhatsApp"
          sublabel={whatsapp_responsavel ?? whatsapp_atleta ?? "—"}
          onClick={() =>
            handleCopy(whatsapp_responsavel ?? whatsapp_atleta, "whatsapp")
          }
          disabled={!whatsapp_responsavel && !whatsapp_atleta}
        />

        {/* Copiar Email */}
        <ActionButton
          icon={copiedField === "email" ? Check : Copy}
          variant="copy"
          label="Copiar Email"
          sublabel={email_responsavel ?? email ?? "—"}
          onClick={() => handleCopy(email_responsavel ?? email, "email")}
          disabled={!email_responsavel && !email}
        />
      </div>

      {/* Template picker modal */}
      {templatePicker?.open && (
        <TemplatePickerModal
          open
          onClose={() => setTemplatePicker(null)}
          canal={templatePicker.canal}
          vars={templateVars}
          phone={templatePicker.phone}
          email={templatePicker.email}
        />
      )}
    </div>
  );
}
