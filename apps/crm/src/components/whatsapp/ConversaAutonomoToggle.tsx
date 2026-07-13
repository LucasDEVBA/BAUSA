"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  getConversaAutonomoModo,
  setConversaAutonomoModo,
  type ConversaAutonomoModo,
} from "@/lib/actions/chatbot-autonomo";
import { cn } from "@/lib/utils";

// ════════════════════════════════════════════════════════════════════════
// Toggle do chatbot AUTÔNOMO por conversa (cabeçalho do espelho 1:1, CEO-only).
// Lê/grava o override em chatbot_autonomo_conversa; quem RESPONDE é a CF
// `chatbot-autonomo` — este controle NÃO envia mensagem.
//   • Segue global (padrao) → obedece o modo global.
//   • Ativo               → a IA responde ESTE lead sozinha, mesmo com o global
//                           em sombra (sem efeito enquanto o global estiver off).
//   • Desligado           → a IA nunca responde esta conversa.
// ════════════════════════════════════════════════════════════════════════

interface Opcao {
  id: ConversaAutonomoModo;
  label: string;
  title: string;
  danger?: boolean;
}

const OPCOES: Opcao[] = [
  {
    id: "padrao",
    label: "Segue global",
    title: "Esta conversa segue o modo global do copiloto autônomo.",
  },
  {
    id: "ativo",
    label: "Ativo",
    title:
      "Ativo aqui = a IA responde este lead sozinha, mesmo com o global em sombra. Sem efeito enquanto o global estiver desligado.",
    danger: true,
  },
  {
    id: "desligado",
    label: "Desligado",
    title: "A IA nunca responde esta conversa, mesmo com o global ativo.",
  },
];

const TOAST_OK: Record<ConversaAutonomoModo, string> = {
  padrao: "Esta conversa passou a seguir o modo global.",
  ativo: "Autônomo ativado nesta conversa — a IA pode responder este lead sozinha.",
  desligado: "Autônomo desligado nesta conversa.",
};

export function ConversaAutonomoToggle({ phone }: { phone: string }) {
  // null = carregando o estado atual desta conversa.
  const [modo, setModo] = useState<ConversaAutonomoModo | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setModo(null);
    void getConversaAutonomoModo(phone)
      .then((r) => {
        if (!active) return;
        setModo(r.success ? r.modo : "padrao");
      })
      .catch(() => {
        if (active) setModo("padrao");
      });
    return () => {
      active = false;
    };
  }, [phone]);

  const aplicar = async (novo: ConversaAutonomoModo) => {
    if (saving || modo === null || novo === modo) return;
    const anterior = modo;
    setSaving(true);
    setModo(novo); // otimista — reverte em falha
    try {
      const r = await setConversaAutonomoModo(phone, novo);
      if (!r.success) {
        setModo(anterior);
        toast.error(r.error ?? "Não foi possível salvar o modo desta conversa.");
        return;
      }
      toast.success(TOAST_OK[novo]);
    } catch {
      setModo(anterior);
      toast.error("Erro inesperado ao salvar o modo desta conversa.");
    } finally {
      setSaving(false);
    }
  };

  const carregando = modo === null;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span
        className="hidden items-center gap-1 text-[11px] font-medium text-muted-foreground sm:flex"
        title="Controla se a IA autônoma responde ESTA conversa. Ativo aqui = a IA responde este lead sozinha, mesmo com o global em sombra."
      >
        <Bot aria-hidden className="size-3.5" />
        Autônomo
      </span>
      <div
        role="radiogroup"
        aria-label="Modo do chatbot autônomo nesta conversa"
        className="flex items-center gap-0.5 rounded-lg border border-border bg-secondary/40 p-0.5"
      >
        {OPCOES.map((opt) => {
          const active = modo === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving || carregando}
              title={opt.title}
              onClick={() => void aplicar(opt.id)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                active
                  ? opt.danger
                    ? "bg-sys-red/12 text-sys-red"
                    : "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {saving && active ? <Loader2 aria-hidden className="size-3 animate-spin" /> : null}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
