"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  getConversaAutonomoModo,
  setConversaAutonomoAgent,
  setConversaAutonomoModo,
  type ConversaAutonomoModo,
} from "@/lib/actions/chatbot-autonomo";
import { useConfirm } from "@/components/ui";
import type { AgentResumo } from "@/types/agent";
import { cn } from "@/lib/utils";

// ════════════════════════════════════════════════════════════════════════
// Toggle do chatbot AUTÔNOMO por conversa (cabeçalho do espelho 1:1, CEO-only).
// Lê/grava o override em chatbot_autonomo_conversa; quem RESPONDE é a CF
// `chatbot-autonomo` — este controle NÃO envia mensagem.
//   • Segue global (padrao) → obedece o modo global.
//   • Ativo               → a IA responde ESTE lead sozinha, mesmo com o global
//                           em sombra (sem efeito enquanto o global estiver off).
//   • Desligado           → a IA nunca responde esta conversa.
// Agent do chatbot (opcional, F5): substitui SÓ a PERSONA do bot NESTA
// conversa — o critério de segurança é GLOBAL e intocável. Agent desativado
// depois → a CF cai na persona padrão (fallback vivo).
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

export function ConversaAutonomoToggle({
  phone,
  agents = [],
}: {
  phone: string;
  /** Agents custom (capacidade `chatbot_autonomo`) p/ o seletor de persona. */
  agents?: AgentResumo[];
}) {
  // null = carregando o estado atual desta conversa.
  const [modo, setModo] = useState<ConversaAutonomoModo | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    let active = true;
    setModo(null);
    setAgentId(null);
    void getConversaAutonomoModo(phone)
      .then((r) => {
        if (!active) return;
        setModo(r.success ? r.modo : "padrao");
        setAgentId(r.success ? r.agentId : null);
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
    if (novo === "ativo") {
      const ok = await confirm({
        title: "Ativar o autônomo nesta conversa?",
        description:
          "A IA passará a RESPONDER este lead sozinha no WhatsApp (quando o modo global estiver em Sombra ou Ativo), sem revisão humana, nas categorias seguras. Preço, negociação, reclamação e pedidos de falar com uma pessoa são escalados a você. Dá para voltar a Segue global ou Desligado quando quiser.",
        confirmLabel: "Ativar nesta conversa",
        cancelLabel: "Cancelar",
        tone: "danger",
      });
      if (!ok) return;
    }
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

  // Agent da conversa (F5): grava via setConversaAutonomoAgent (CEO-only,
  // valida capacidade server-side). Otimista com reversão em falha.
  const aplicarAgent = async (novo: string | null) => {
    if (savingAgent || modo === null || novo === agentId) return;
    const anterior = agentId;
    setSavingAgent(true);
    setAgentId(novo);
    try {
      const r = await setConversaAutonomoAgent(phone, novo);
      if (!r.success) {
        setAgentId(anterior);
        toast.error(r.error ?? "Não foi possível salvar o agent desta conversa.");
        return;
      }
      toast.success(
        novo
          ? "Agent aplicado — ele define a persona do bot nesta conversa."
          : "Agent removido — o bot volta à persona padrão nesta conversa.",
      );
    } catch {
      setAgentId(anterior);
      toast.error("Erro inesperado ao salvar o agent desta conversa.");
    } finally {
      setSavingAgent(false);
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
      {/* Agent do chatbot (opcional, F5): troca SÓ a persona desta conversa —
          o critério de segurança segue global. Sem agents, o select some. */}
      {agents.length > 0 && (
        <select
          value={agentId ?? ""}
          disabled={saving || savingAgent || carregando}
          aria-label="Agent do chatbot nesta conversa"
          title="Agent que define a PERSONA do bot nesta conversa. O critério de segurança (quando pode responder) é global e não muda."
          onChange={(e) => void aplicarAgent(e.target.value || null)}
          className="h-7 max-w-[8.5rem] shrink-0 rounded-md border border-border bg-card px-1.5 text-[11px] text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">Agent: Padrão</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
