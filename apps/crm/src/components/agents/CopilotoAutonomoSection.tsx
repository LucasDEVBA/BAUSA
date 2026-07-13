"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Eye,
  Inbox,
  Loader2,
  MinusCircle,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Card, EmptyState, ScrollList, useConfirm, type BadgeTone } from "@/components/ui";
import { InstrucoesIAEditor } from "@/components/agents/InstrucoesIAEditor";
import { CHATBOT_AUTONOMO_CRITERIO_DEFAULT } from "@/lib/automacoes/chatbot-autonomo-criterio";
import {
  atualizarChatbotAutonomoCriterio,
  atualizarChatbotAutonomoModo,
  listarChatbotAutonomoLog,
  type ChatbotAutonomoDecisao,
  type ChatbotAutonomoLogItem,
  type ChatbotAutonomoModo,
} from "@/lib/actions/chatbot-autonomo";
import { cn, formatRelativeTime } from "@/lib/utils";

// ════════════════════════════════════════════════════════════════════════
// /agents → família "Copiloto Autônomo" (CEO-only). A UI só edita a config e
// mostra o log — quem RESPONDE leads é a CF `chatbot-autonomo` (nasce off).
//   1. Modo global (off/sombra/ativo) — confirmação explícita ao ligar ativo.
//   2. Critério do gate de intenção (fail-open p/ default do código).
//   3. Monitor — as últimas decisões do bot (o que o CEO revisa na sombra).
// ════════════════════════════════════════════════════════════════════════

const CRITERIO_MAX = 4000;

interface ModeOption {
  id: ChatbotAutonomoModo;
  label: string;
  risco: string;
  icon: LucideIcon;
  danger?: boolean;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    id: "off",
    label: "Desligado",
    risco: "A IA não faz nada nas conversas. Estado seguro (padrão de nascimento).",
    icon: PowerOff,
  },
  {
    id: "sombra",
    label: "Sombra",
    risco: "A IA gera um rascunho para você revisar no monitor. NÃO envia nada ao lead.",
    icon: Eye,
  },
  {
    id: "ativo",
    label: "Ativo",
    risco: "A IA responde sozinha os leads reais nas categorias seguras. Preço, negociação e reclamação são escalados a você.",
    icon: Zap,
    danger: true,
  },
];

const MODO_TOAST: Record<ChatbotAutonomoModo, string> = {
  off: "Chatbot autônomo desligado.",
  sombra: "Modo sombra ativado — a IA gera rascunhos para você revisar.",
  ativo: "Modo ativo — a IA passa a responder leads sozinha nas categorias seguras.",
};

const DECISAO_CONFIG: Record<
  ChatbotAutonomoDecisao,
  { label: string; tone: BadgeTone; icon: LucideIcon }
> = {
  respondeu: { label: "Respondeu", tone: "green", icon: Send },
  sombra: { label: "Sombra", tone: "blue", icon: Eye },
  escalou: { label: "Escalou", tone: "orange", icon: ArrowUpRight },
  ignorou: { label: "Ignorou", tone: "neutral", icon: MinusCircle },
  erro: { label: "Erro", tone: "red", icon: AlertTriangle },
};

/** Mascara parcial: mantém DDI+DDD e os 4 últimos dígitos, oculta o miolo. */
function mascararTelefone(phone: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 0) return "sem telefone";
  if (digits.length <= 4) return `••••${digits.slice(-2)}`;
  return `${digits.slice(0, Math.min(4, digits.length - 4))} ••••• ${digits.slice(-4)}`;
}

// ─── Card 1: modo global ─────────────────────────────────────────────────

function ModoCard({
  modo,
  onChange,
}: {
  modo: ChatbotAutonomoModo;
  onChange: (modo: ChatbotAutonomoModo) => void;
}) {
  const confirm = useConfirm();
  const [saving, setSaving] = useState<ChatbotAutonomoModo | null>(null);

  const aplicarModo = async (novo: ChatbotAutonomoModo) => {
    if (novo === modo || saving !== null) return;

    if (novo === "ativo") {
      const ok = await confirm({
        title: "Ativar respostas automáticas a leads reais?",
        description:
          "No modo Ativo a IA passa a RESPONDER sozinha os leads no WhatsApp, sem revisão humana, nas categorias que o critério considera seguras. Preço, negociação, reclamação e pedidos de falar com uma pessoa são escalados a você. Dá para voltar a Sombra ou Desligado quando quiser.",
        confirmLabel: "Ativar envio automático",
        cancelLabel: "Cancelar",
        tone: "danger",
      });
      if (!ok) return;
    }

    setSaving(novo);
    try {
      const r = await atualizarChatbotAutonomoModo(novo);
      if (!r.success) {
        toast.error(r.error ?? "Não foi possível salvar o modo.");
        return;
      }
      onChange(novo);
      toast.success(MODO_TOAST[novo]);
    } catch {
      toast.error("Erro inesperado ao salvar o modo.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card accent={modo === "ativo" ? "red" : modo === "sombra" ? "blue" : "neutral"} className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Zap aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Modo do chatbot autônomo</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Controla o que a IA faz nas conversas de WhatsApp. Nasce desligado — só o Ativo envia
            mensagens a leads reais.
          </p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Modo do chatbot autônomo"
        className="grid gap-2 sm:grid-cols-3"
      >
        {MODE_OPTIONS.map((opt) => {
          const active = opt.id === modo;
          const isSaving = saving === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving !== null}
              onClick={() => void aplicarModo(opt.id)}
              className={cn(
                "flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                active
                  ? opt.danger
                    ? "border-sys-red/40 bg-sys-red/5"
                    : "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-lg",
                    active
                      ? opt.danger
                        ? "bg-sys-red/12 text-sys-red"
                        : "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {isSaving ? (
                    <Loader2 aria-hidden className="size-3.5 animate-spin" />
                  ) : (
                    <Icon aria-hidden className="size-3.5" />
                  )}
                </span>
                <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                {active && (
                  <Badge tone={opt.danger ? "red" : "brand"} size="sm" className="ml-auto">
                    Atual
                  </Badge>
                )}
              </span>
              <span className="text-[11px] leading-relaxed text-muted-foreground">{opt.risco}</span>
            </button>
          );
        })}
      </div>

      {modo === "ativo" ? (
        <p className="flex items-start gap-1.5 rounded-md bg-sys-red/10 px-3 py-2 text-[11px] leading-relaxed text-sys-red">
          <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />A IA está respondendo leads
          reais sozinha neste número. Revise as decisões no monitor abaixo.
        </p>
      ) : modo === "sombra" ? (
        <p className="flex items-start gap-1.5 rounded-md bg-sys-blue/10 px-3 py-2 text-[11px] leading-relaxed text-sys-blue">
          <Eye aria-hidden className="mt-px size-3.5 shrink-0" />A IA está gerando rascunhos para
          revisão — nada é enviado ao lead. Acompanhe no monitor abaixo.
        </p>
      ) : (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck aria-hidden className="mt-px size-3.5 shrink-0 text-primary" />A IA não toca nas
          conversas enquanto estiver desligada.
        </p>
      )}
    </Card>
  );
}

// ─── Card 2: critério do gate ────────────────────────────────────────────

function CriterioCard({ criterioInicial }: { criterioInicial: string }) {
  const [texto, setTexto] = useState(criterioInicial || CHATBOT_AUTONOMO_CRITERIO_DEFAULT);
  const [saving, setSaving] = useState(false);
  const excedeu = texto.length > CRITERIO_MAX;
  const igualDefault = texto.trim() === CHATBOT_AUTONOMO_CRITERIO_DEFAULT.trim();

  const persistir = async (valor: string, ok: string) => {
    // Igual ao default → grava vazio (remove o override; fail-open na CF).
    const payload = valor.trim() === CHATBOT_AUTONOMO_CRITERIO_DEFAULT.trim() ? "" : valor.trim();
    setSaving(true);
    try {
      const r = await atualizarChatbotAutonomoCriterio(payload);
      if (!r.success) {
        toast.error(r.error ?? "Não foi possível salvar o critério.");
        return;
      }
      toast.success(ok);
    } catch {
      toast.error("Erro inesperado ao salvar o critério.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sys-purple/12 text-sys-purple">
          <ShieldCheck aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Critério de segurança</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Define QUANDO é seguro responder sozinho × quando escalar a um humano. Apagar tudo volta
            ao padrão do sistema.
          </p>
        </div>
      </div>

      <InstrucoesIAEditor
        id="chatbot-autonomo-criterio"
        titulo="Critério (Gemini)"
        rotulo="O que é seguro responder × o que escalar"
        valor={texto}
        onChange={setTexto}
        defaultTexto={CHATBOT_AUTONOMO_CRITERIO_DEFAULT}
        rodape="A última mensagem do lead e o formato de saída (JSON) são fixos — só o critério acima é editável. Apagar tudo volta ao padrão do sistema."
      />

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        O tom e a identidade das respostas vêm da persona do{" "}
        <a href="#copilotos-conversa" className="font-medium text-primary hover:underline">
          Copiloto de Conversa
        </a>{" "}
        (acima) — este critério define apenas o que é seguro responder.
      </p>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={saving || igualDefault}
          onClick={() => {
            setTexto(CHATBOT_AUTONOMO_CRITERIO_DEFAULT);
            void persistir(CHATBOT_AUTONOMO_CRITERIO_DEFAULT, "Critério restaurado para o padrão.");
          }}
        >
          <RotateCcw />
          Restaurar padrão
        </Button>
        <Button
          size="sm"
          disabled={saving || excedeu}
          onClick={() => void persistir(texto, "Critério salvo.")}
        >
          {saving ? <Loader2 className="animate-spin" /> : null}
          Salvar
        </Button>
      </div>
    </Card>
  );
}

// ─── Card 3: monitor ─────────────────────────────────────────────────────

function LogRow({ item }: { item: ChatbotAutonomoLogItem }) {
  const cfg = DECISAO_CONFIG[item.decisao];
  const Icon = cfg.icon;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge tone={cfg.tone} size="sm">
            <Icon aria-hidden className="size-3" />
            {cfg.label}
          </Badge>
          {item.enviado && (
            <Badge tone="green" size="sm">
              enviado
            </Badge>
          )}
          {item.categoria && (
            <span className="truncate text-[11px] text-muted-foreground">{item.categoria}</span>
          )}
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {formatRelativeTime(item.created_at)}
        </span>
      </div>

      <p className="mt-1 text-[11px] tabular-nums text-label-tertiary">
        {mascararTelefone(item.phone)}
        {item.modo_efetivo ? <span className="not-italic"> · modo {item.modo_efetivo}</span> : null}
      </p>

      {item.mensagem_lead ? (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Lead:</span> {item.mensagem_lead}
        </p>
      ) : null}

      {item.resposta_gerada ? (
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-foreground">
          {item.resposta_gerada}
        </p>
      ) : item.motivo ? (
        <p className="mt-1 text-[11px] italic leading-relaxed text-muted-foreground">{item.motivo}</p>
      ) : null}
    </div>
  );
}

function MonitorCard({ logInicial }: { logInicial: ChatbotAutonomoLogItem[] }) {
  const [items, setItems] = useState<ChatbotAutonomoLogItem[]>(logInicial);
  const [refreshing, setRefreshing] = useState(false);

  const atualizar = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const r = await listarChatbotAutonomoLog({ limit: 50 });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      setItems(r.items);
    } catch {
      toast.error("Não foi possível atualizar o monitor.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card padding="none" className="flex h-[26rem] flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Monitor</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Últimas decisões do bot — o que você revisa no modo sombra.
          </p>
        </div>
        <Button variant="secondary" size="sm" disabled={refreshing} onClick={() => void atualizar()}>
          <RefreshCw className={cn(refreshing && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={Inbox}
            title="Nenhuma atividade ainda"
            description="Ative o modo sombra e aguarde mensagens de leads — cada decisão do bot aparece aqui para você revisar."
          />
        </div>
      ) : (
        <ScrollList className="space-y-2 p-3">
          {items.map((item) => (
            <LogRow key={item.id} item={item} />
          ))}
        </ScrollList>
      )}
    </Card>
  );
}

// ─── Seção ───────────────────────────────────────────────────────────────

export interface CopilotoAutonomoSectionProps {
  seeded: boolean;
  modoInicial: ChatbotAutonomoModo;
  criterioInicial: string;
  logInicial: ChatbotAutonomoLogItem[];
}

export function CopilotoAutonomoSection({
  seeded,
  modoInicial,
  criterioInicial,
  logInicial,
}: CopilotoAutonomoSectionProps) {
  const [modo, setModo] = useState<ChatbotAutonomoModo>(modoInicial);

  if (!seeded) {
    return (
      <Card>
        <p className="rounded-md border border-dashed border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Configuração indisponível neste ambiente (seed{" "}
          <code className="font-mono">chatbot_autonomo</code> pendente) — o motor segue desligado
          até a migration ser aplicada.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ModoCard modo={modo} onChange={setModo} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CriterioCard criterioInicial={criterioInicial} />
        <MonitorCard logInicial={logInicial} />
      </div>
    </div>
  );
}
