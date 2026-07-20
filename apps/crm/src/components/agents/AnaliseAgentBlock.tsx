"use client";

import { useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { Button, InsightCard } from "@/components/ui";
import { analisarComAgent } from "@/lib/actions/agents-analise";
import type { AgentResumo } from "@/types/agent";

/**
 * AnaliseAgentBlock — "Analisar com agent" no painel da conversa (1:1 e grupo).
 * O CEO escolhe um agent com a capacidade `analise` e recebe uma ANÁLISE
 * INTERNA (nunca uma mensagem para enviar). Sem agents disponíveis, o bloco
 * não renderiza. Reset ao trocar de conversa via `key` no ponto de uso.
 */
export interface AnaliseAgentBlockProps {
  agents: AgentResumo[];
  phone?: string;
  grupoId?: string;
  leadNome?: string;
}

export function AnaliseAgentBlock({ agents, phone, grupoId, leadNome }: AnaliseAgentBlockProps) {
  const [agentId, setAgentId] = useState<string>(agents[0]?.id ?? "");
  const [analise, setAnalise] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (agents.length === 0) return null;

  const agentNome = agents.find((a) => a.id === agentId)?.nome ?? "Agent";

  const handleAnalisar = async () => {
    if (!agentId || loading) return;
    setLoading(true);
    try {
      const r = await analisarComAgent({ agentId, phone, grupoId, leadNome });
      if (!r.success) {
        toast.error(r.notConfigured ? "IA não configurada neste ambiente." : r.error);
        return;
      }
      setAnalise(r.analise);
    } catch {
      toast.error("Não foi possível gerar a análise agora.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-eyebrow text-label-tertiary">Analisar com agent</p>
        {analise && (
          <button
            type="button"
            onClick={() => setAnalise(null)}
            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            limpar
          </button>
        )}
      </div>

      <label className="block">
        <span className="sr-only">Agent de análise</span>
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          disabled={loading}
          aria-label="Agent de análise"
          className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      </label>

      {analise ? (
        <InsightCard
          eyebrow={`Análise — ${agentNome}`}
          footer="Análise interna para a equipe — nunca é enviada ao lead."
          className="p-3"
        >
          <p className="whitespace-pre-wrap text-xs leading-relaxed">{analise}</p>
        </InsightCard>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          O agent lê a conversa e produz uma análise interna para a equipe — nunca uma mensagem
          para o lead.
        </p>
      )}

      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={loading || !agentId}
        onClick={() => void handleAnalisar()}
      >
        {loading ? <Loader2 className="animate-spin" /> : <ScanSearch />}
        {analise ? "Analisar novamente" : "Analisar com agent"}
      </Button>
    </section>
  );
}
