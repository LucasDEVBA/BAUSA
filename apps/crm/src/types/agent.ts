import type { BadgeTone } from "@/components/ui/Badge";

/**
 * Plataforma de Agents — agents de IA CUSTOM criados pelo CEO (tabela `agents`).
 * Cada agent tem um prompt próprio e declara em quais superfícies de IA do
 * Engine ele pluga (capacidades). Os agents NATIVOS do sistema continuam nas
 * chaves de configuracoes_sistema — esta tipagem cobre só os custom.
 */

export const AGENT_CAPACIDADES = [
  "conversa",
  "automacao",
  "analise",
  "chatbot_autonomo",
] as const;

export type AgentCapacidade = (typeof AGENT_CAPACIDADES)[number];

export interface Agent {
  id: string;
  nome: string;
  descricao: string | null;
  prompt: string;
  capacidades: AgentCapacidade[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** Projeção segura para o client (o prompt NUNCA vai ao browser nas listas). */
export interface AgentResumo {
  id: string;
  nome: string;
  descricao: string | null;
}

export const AGENT_CAPACIDADE_LABEL: Record<
  AgentCapacidade,
  { label: string; tone: BadgeTone }
> = {
  conversa: { label: "Conversa", tone: "blue" },
  automacao: { label: "Automações", tone: "purple" },
  analise: { label: "Análise", tone: "green" },
  chatbot_autonomo: { label: "Chatbot autônomo", tone: "red" },
};
