"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2, Pencil, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Card, EmptyState, useConfirm } from "@/components/ui";
import { InstrucoesIAEditor } from "@/components/agents/InstrucoesIAEditor";
import { FIELD_CLASS } from "@/components/automacoes/builder-shared";
import { atualizarAgent, criarAgent, excluirAgent } from "@/lib/actions/agents";
import {
  AGENT_CAPACIDADES,
  AGENT_CAPACIDADE_LABEL,
  type Agent,
  type AgentCapacidade,
} from "@/types/agent";
import { cn } from "@/lib/utils";

/**
 * SeusAgentsSection — CRUD dos agents CUSTOM do CEO (hub /agents, 1ª seção).
 * Cards (nome, descrição, capacidades, toggle ativo, excluir com confirm) +
 * form criar/editar com InstrucoesIAEditor p/ o prompt e checkboxes das 4
 * capacidades (chatbot_autonomo com aviso de sensibilidade).
 */

const NOME_MAX = 120;
const DESCRICAO_MAX = 500;

const CAPACIDADE_HINT: Record<AgentCapacidade, string> = {
  conversa: "Vira uma opção de copiloto na sugestão de resposta do WhatsApp (1:1 e grupo).",
  automacao: "Reservada para o builder de automações (integração no próximo release).",
  analise: "Habilita o botão “Analisar com agent” no painel da conversa (análise interna).",
  chatbot_autonomo: "Reservada para o copiloto autônomo (integração no próximo release).",
};

interface FormState {
  id: string | null; // null = criando
  nome: string;
  descricao: string;
  prompt: string;
  capacidades: AgentCapacidade[];
  ativo: boolean;
}

const FORM_VAZIO: FormState = {
  id: null,
  nome: "",
  descricao: "",
  prompt: "",
  capacidades: [],
  ativo: true,
};

function formFromAgent(agent: Agent): FormState {
  return {
    id: agent.id,
    nome: agent.nome,
    descricao: agent.descricao ?? "",
    prompt: agent.prompt,
    capacidades: agent.capacidades,
    ativo: agent.ativo,
  };
}

function AgentCard({
  agent,
  pending,
  onEditar,
  onToggleAtivo,
  onExcluir,
}: {
  agent: Agent;
  pending: boolean;
  onEditar: (agent: Agent) => void;
  onToggleAtivo: (agent: Agent) => void;
  onExcluir: (agent: Agent) => void;
}) {
  return (
    <Card accent={agent.ativo ? "brand" : "neutral"} className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bot aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold text-foreground" title={agent.nome}>
              {agent.nome}
            </h3>
            <Badge tone={agent.ativo ? "green" : "neutral"} size="sm">
              {agent.ativo ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          {agent.descricao && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {agent.descricao}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {agent.capacidades.map((cap) => {
          const cfg = AGENT_CAPACIDADE_LABEL[cap];
          return (
            <Badge key={cap} tone={cfg.tone} size="sm">
              {cfg.label}
            </Badge>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        {/* Toggle ativo/inativo */}
        <button
          type="button"
          role="switch"
          aria-checked={agent.ativo}
          aria-label={agent.ativo ? `Desativar ${agent.nome}` : `Ativar ${agent.nome}`}
          disabled={pending}
          onClick={() => onToggleAtivo(agent)}
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            agent.ativo ? "bg-sys-green" : "bg-fill-2",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
              agent.ativo ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Editar ${agent.nome}`}
            disabled={pending}
            onClick={() => onEditar(agent)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Excluir ${agent.nome}`}
            disabled={pending}
            onClick={() => onExcluir(agent)}
          >
            <Trash2 className="h-3.5 w-3.5 text-sys-red" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function SeusAgentsSection({ agents }: { agents: Agent[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [form, setForm] = useState<FormState | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const salvar = () => {
    if (!form) return;
    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || undefined,
      prompt: form.prompt,
      capacidades: form.capacidades,
    };
    startTransition(() => {
      const acao = form.id
        ? atualizarAgent({ ...payload, id: form.id, ativo: form.ativo })
        : criarAgent(payload);
      void acao
        .then((r) => {
          if (!r.success) {
            toast.error(r.error ?? "Não foi possível salvar o agent.");
            return;
          }
          toast.success(form.id ? "Agent atualizado." : "Agent criado.");
          setForm(null);
          router.refresh();
        })
        .catch(() => toast.error("Erro inesperado ao salvar o agent."));
    });
  };

  const toggleAtivo = (agent: Agent) => {
    setPendingId(agent.id);
    startTransition(() => {
      void atualizarAgent({
        id: agent.id,
        nome: agent.nome,
        descricao: agent.descricao ?? undefined,
        prompt: agent.prompt,
        capacidades: agent.capacidades,
        ativo: !agent.ativo,
      })
        .then((r) => {
          if (!r.success) {
            toast.error(r.error ?? "Não foi possível alterar o agent.");
            return;
          }
          toast.success(!agent.ativo ? "Agent ativado." : "Agent desativado.");
          router.refresh();
        })
        .catch(() => toast.error("Erro inesperado ao alterar o agent."))
        .finally(() => setPendingId(null));
    });
  };

  const excluir = async (agent: Agent) => {
    const ok = await confirm({
      title: `Excluir o agent “${agent.nome}”?`,
      description:
        "Ele sai das superfícies onde estava plugado (copiloto, análise). A exclusão pode ser revertida pelo suporte (soft delete).",
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
    setPendingId(agent.id);
    startTransition(() => {
      void excluirAgent(agent.id)
        .then((r) => {
          if (!r.success) {
            toast.error(r.error ?? "Não foi possível excluir o agent.");
            return;
          }
          toast.success("Agent excluído.");
          if (form?.id === agent.id) setForm(null);
          router.refresh();
        })
        .catch(() => toast.error("Erro inesperado ao excluir o agent."))
        .finally(() => setPendingId(null));
    });
  };

  const toggleCapacidade = (cap: AgentCapacidade) => {
    setForm((f) => {
      if (!f) return f;
      const tem = f.capacidades.includes(cap);
      return {
        ...f,
        capacidades: tem ? f.capacidades.filter((c) => c !== cap) : [...f.capacidades, cap],
      };
    });
  };

  const salvarDesabilitado =
    isPending ||
    !form ||
    form.nome.trim().length < 3 ||
    form.nome.trim().length > NOME_MAX ||
    form.descricao.trim().length > DESCRICAO_MAX ||
    form.prompt.trim().length < 10 ||
    form.prompt.length > 4000 ||
    form.capacidades.length === 0;

  return (
    <div className="space-y-3">
      {agents.length === 0 && !form ? (
        <Card>
          <EmptyState
            icon={Bot}
            title="Nenhum agent criado ainda"
            description="Crie um agent com prompt próprio e escolha onde ele pluga: copiloto de conversa, análise sob demanda e (em breve) automações."
            action={
              <Button size="sm" onClick={() => setForm(FORM_VAZIO)}>
                <Plus />
                Criar agent
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                pending={isPending && pendingId === agent.id}
                onEditar={(a) => setForm(formFromAgent(a))}
                onToggleAtivo={toggleAtivo}
                onExcluir={(a) => void excluir(a)}
              />
            ))}
          </div>
          {!form && (
            <Button variant="secondary" size="sm" onClick={() => setForm(FORM_VAZIO)}>
              <Plus />
              Criar agent
            </Button>
          )}
        </>
      )}

      {form && (
        <Card accent="brand" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {form.id ? "Editar agent" : "Novo agent"}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Fechar formulário"
              disabled={isPending}
              onClick={() => setForm(null)}
            >
              <X />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-foreground">Nome</span>
              <input
                type="text"
                className={FIELD_CLASS}
                value={form.nome}
                maxLength={NOME_MAX}
                placeholder="Ex.: Analista de objeções"
                onChange={(e) => setForm((f) => (f ? { ...f, nome: e.target.value } : f))}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-semibold text-foreground">
                Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
              </span>
              <input
                type="text"
                className={FIELD_CLASS}
                value={form.descricao}
                maxLength={DESCRICAO_MAX}
                placeholder="Para que serve este agent"
                onChange={(e) => setForm((f) => (f ? { ...f, descricao: e.target.value } : f))}
              />
            </label>
          </div>

          <InstrucoesIAEditor
            id={`agent-prompt-${form.id ?? "novo"}`}
            titulo="Prompt do agent"
            rotulo="Instruções (identidade + o que fazer)"
            valor={form.prompt}
            onChange={(v) => setForm((f) => (f ? { ...f, prompt: v } : f))}
            defaultTexto=""
            rodape="Na conversa, o agent substitui APENAS a persona — o histórico, a tarefa e o formato continuam fixos no código (com anti-injeção). Mín 10, máx 4000 caracteres."
          />

          <fieldset className="space-y-2">
            <legend className="text-[11px] font-semibold text-foreground">Capacidades</legend>
            {AGENT_CAPACIDADES.map((cap) => {
              const cfg = AGENT_CAPACIDADE_LABEL[cap];
              const marcado = form.capacidades.includes(cap);
              return (
                <label
                  key={cap}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition-colors",
                    marcado ? "border-primary/30 bg-primary/5" : "border-border hover:bg-secondary/40",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => toggleCapacidade(cap)}
                    className="mt-0.5 size-3.5 accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <Badge tone={cfg.tone} size="sm">
                        {cfg.label}
                      </Badge>
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                      {CAPACIDADE_HINT[cap]}
                    </span>
                    {cap === "chatbot_autonomo" && (
                      <span className="mt-1 flex items-start gap-1.5 rounded-md border border-sys-red/20 bg-sys-red/5 px-2 py-1.5 text-[11px] leading-relaxed text-sys-red">
                        <ShieldAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        Capacidade SENSÍVEL: quando integrada, este agent poderá responder leads
                        sozinho (respeitando o modo global do Copiloto Autônomo, que nasce
                        desligado).
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" disabled={isPending} onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={salvarDesabilitado} onClick={salvar}>
              {isPending && <Loader2 className="animate-spin" />}
              {form.id ? "Salvar alterações" : "Criar agent"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
