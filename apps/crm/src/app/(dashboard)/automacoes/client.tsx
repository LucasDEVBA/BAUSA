"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Workflow,
  Plus,
  Zap,
  Clock,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  History,
  RotateCcw,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  EmptyState,
  BrandTabs,
  StatCard,
  type BadgeTone,
} from "@/components/ui";
import {
  GATILHO_CATALOG,
  ACAO_CATALOG,
  type AutomacaoComStats,
  type AutomacaoAcaoTipo,
  type AutomacaoRunDetalhado,
  type AutomacaoRunStatus,
} from "@/types/automacao";
import { BuilderScreen } from "@/components/automacoes/BuilderScreen";
import {
  FIELD_CLASS,
  SECTION_LABEL,
  builderFromAutomacao,
  emptyBuilder,
  type BuilderState,
  type UsuarioRow,
} from "@/components/automacoes/builder-shared";
import {
  criarAutomacao,
  atualizarAutomacao,
  alternarAtivoAutomacao,
  excluirAutomacao,
  reprocessarRun,
  atualizarIntervalosScheduler,
  atualizarMensagensScheduler,
  type AutomacaoInput,
  type SchedulerIntervalos,
  type SchedulerMensagens,
} from "@/lib/actions/automacoes-builder";
import { cn } from "@/lib/utils";

// ─── Componente principal ────────────────────────────────────────────────────

const RUN_STATUS_TONE: Record<AutomacaoRunStatus, BadgeTone> = {
  pendente: "blue",
  executando: "blue",
  sucesso: "green",
  erro: "red",
  ignorado: "neutral",
};

const RUN_STATUS_LABEL: Record<AutomacaoRunStatus, string> = {
  pendente: "Na fila",
  executando: "Executando",
  sucesso: "Sucesso",
  erro: "Erro",
  ignorado: "Ignorado",
};

export function AutomacoesClient({
  automacoes,
  usuarios,
  runsRecentes,
  leadNomes,
  intervalos,
  mensagens,
  agora,
}: {
  automacoes: AutomacaoComStats[];
  usuarios: UsuarioRow[];
  runsRecentes: AutomacaoRunDetalhado[];
  leadNomes: Record<string, string>;
  intervalos: SchedulerIntervalos;
  mensagens: SchedulerMensagens | null;
  agora: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [activeTab, setActiveTab] = useState<"automacoes" | "execucoes">("automacoes");
  // Filtro da aba Execuções — setado ao clicar "Ver execuções" numa automação
  const [filtroAutomacaoId, setFiltroAutomacaoId] = useState<string | null>(null);

  const verExecucoes = (automacaoId: string | null) => {
    setFiltroAutomacaoId(automacaoId);
    setActiveTab("execucoes");
  };

  const salvar = () => {
    if (!builder) return;
    const gatilhoInfo = GATILHO_CATALOG[builder.gatilho];
    const gatilhoConfig: Record<string, string | number> = {};
    if (gatilhoInfo.configAgendamento) {
      gatilhoConfig.frequencia = builder.agFrequencia;
      gatilhoConfig.hora = builder.agHora;
      if (builder.agFrequencia === "semanal") gatilhoConfig.dia_semana = builder.agDiaSemana;
      if (builder.agFrequencia === "mensal") gatilhoConfig.dia_mes = builder.agDiaMes;
    } else if (gatilhoInfo.configDias) {
      gatilhoConfig.dias = builder.gatilhoDias;
    }
    const input: AutomacaoInput = {
      nome: builder.nome,
      descricao: builder.descricao || undefined,
      gatilho: builder.gatilho,
      gatilho_config: gatilhoConfig,
      condicoes: builder.condicoes,
      acoes: builder.acoes,
    };
    startTransition(async () => {
      const result = builder.id
        ? await atualizarAutomacao(builder.id, input)
        : await criarAutomacao(input);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao salvar automação");
        return;
      }
      toast.success(builder.id ? "Automação atualizada" : "Automação criada (pausada — ative quando quiser)");
      setBuilder(null);
      router.refresh();
    });
  };

  const alternar = (a: AutomacaoComStats) => {
    startTransition(async () => {
      const result = await alternarAtivoAutomacao(a.id, !a.ativo);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao alterar status");
        return;
      }
      toast.success(!a.ativo ? `“${a.nome}” ativada` : `“${a.nome}” pausada`);
      router.refresh();
    });
  };

  const excluir = (a: AutomacaoComStats) => {
    if (!window.confirm(`Excluir a automação “${a.nome}”? Os runs históricos são preservados.`)) return;
    startTransition(async () => {
      const result = await excluirAutomacao(a.id);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao excluir");
        return;
      }
      toast.success("Automação excluída");
      router.refresh();
    });
  };

  const replay = (runId: string) => {
    startTransition(async () => {
      const result = await reprocessarRun(runId);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao reprocessar");
        return;
      }
      toast.success("Run reenfileirado — a engine reprocessa no próximo tick");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistema"
        title="Automações"
        description="Crie fluxos gatilho → condições → ações e acompanhe cada execução."
        actions={
          <Button onClick={() => setBuilder(emptyBuilder())}>
            <Plus className="h-4 w-4" />
            Nova automação
          </Button>
        }
      />

      <BrandTabs
        variant="segmented"
        items={[
          { id: "automacoes", label: "Automações", icon: Workflow },
          { id: "execucoes", label: "Execuções", icon: History },
        ]}
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as "automacoes" | "execucoes")}
        ariaLabel="Visões de automações"
      />

      {activeTab === "execucoes" && (
        <ExecucoesView
          runs={runsRecentes}
          leadNomes={leadNomes}
          automacoes={automacoes}
          filtroAutomacaoId={filtroAutomacaoId}
          onFiltroChange={setFiltroAutomacaoId}
          agora={agora}
          isPending={isPending}
          onReplay={replay}
        />
      )}

      {activeTab === "automacoes" && (
        <SistemaAutomacoesSection
          intervalos={intervalos}
          mensagens={mensagens}
          isPending={isPending}
        />
      )}

      {activeTab === "automacoes" && (
        <p className="text-eyebrow text-label-tertiary">Suas automações</p>
      )}

      {activeTab === "automacoes" && (automacoes.length === 0 ? (
        <Card variant="plain" padding="none">
          <EmptyState
            icon={Workflow}
            title="Nenhuma automação criada"
            description="Monte seu primeiro fluxo: escolha um gatilho, adicione condições e defina as ações."
            action={
              <Button onClick={() => setBuilder(emptyBuilder())}>
                <Plus className="h-4 w-4" />
                Criar automação
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {automacoes.map((a) => {
            const gatilho = GATILHO_CATALOG[a.gatilho];
            const OrigemIcon = gatilho.origem === "evento" ? Zap : Clock;
            return (
              <Card key={a.id} padding="md" accent={a.ativo ? "green" : "neutral"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{a.nome}</p>
                      <Badge tone={a.ativo ? "green" : "neutral"} size="sm">
                        {a.ativo ? "Ativa" : "Pausada"}
                      </Badge>
                      <Badge tone="brand" size="sm">
                        <OrigemIcon className="h-2.5 w-2.5" />
                        {gatilho.label}
                      </Badge>
                    </div>
                    {a.descricao && (
                      <p className="mt-1 text-xs text-muted-foreground">{a.descricao}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className="h-3 w-3" />
                        {a.condicoes.length} condição{a.condicoes.length !== 1 ? "es" : ""} ·{" "}
                        {a.acoes.map((ac) => ACAO_CATALOG[ac.tipo].label).join(" + ")}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-sys-green" />
                        {a.runs_sucesso} sucesso{a.runs_sucesso !== 1 ? "s" : ""}
                      </span>
                      {a.runs_erro > 0 && (
                        <span className="inline-flex items-center gap-1 text-sys-red">
                          <AlertTriangle className="h-3 w-3" />
                          {a.runs_erro} erro{a.runs_erro !== 1 ? "s" : ""}
                        </span>
                      )}
                      {a.runs_pendente > 0 && <span>{a.runs_pendente} na fila</span>}
                      {a.ultimo_run_at && (
                        <span>
                          Último disparo: {new Date(a.ultimo_run_at).toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {/* Toggle ativo/pausada */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={a.ativo}
                      aria-label={a.ativo ? `Pausar ${a.nome}` : `Ativar ${a.nome}`}
                      disabled={isPending}
                      onClick={() => alternar(a)}
                      className={cn(
                        "relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                        a.ativo ? "bg-sys-green" : "bg-fill-2",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
                          a.ativo ? "translate-x-4" : "translate-x-0.5",
                        )}
                      />
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Ver execuções de ${a.nome}`}
                      title="Ver execuções (quem recebeu)"
                      onClick={() => verExecucoes(a.id)}
                    >
                      <History className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Editar ${a.nome}`} onClick={() => setBuilder(builderFromAutomacao(a))}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Excluir ${a.nome}`} onClick={() => excluir(a)}>
                      <Trash2 className="h-3.5 w-3.5 text-sys-red" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ))}

      {builder && (
        <BuilderScreen
          builder={builder}
          usuarios={usuarios}
          isPending={isPending}
          onChange={setBuilder}
          onClose={() => setBuilder(null)}
          onSave={salvar}
        />
      )}
    </div>
  );
}

// ─── Automações do sistema (nativas — schedulers e webhooks) ────────────────

/** Templates de mensagem com par {atleta, responsavel} (CF send-whatsapp).
 *  meeting_confirmed fica de fora — o par dele é {lead, ceo} (calendar-webhook). */
type MensagemTemplate = Exclude<keyof SchedulerMensagens, "meeting_confirmed">;
type MensagemPar = { atleta: string; responsavel: string };
type MensagemParReuniao = { lead: string; ceo: string };

/** Variáveis suportadas pela CF send-whatsapp em cada template (legenda do
 *  modal). Espelham buildTemplateVars de functions/send-whatsapp/index.js. */
const TEMPLATE_VARIAVEIS: Record<MensagemTemplate, string[]> = {
  initial: ["{atleta_nome}", "{responsavel_nome}", "{agenda_url}"],
  followup_1: ["{atleta_nome}", "{responsavel_nome}", "{agenda_url}"],
  followup_2: ["{atleta_nome}", "{responsavel_nome}", "{agenda_url}"],
  early_potential: ["{atleta_nome}", "{responsavel_nome}", "{proximo_ano}"],
  late_timing: ["{atleta_nome}", "{responsavel_nome}"],
  scheduled_return: ["{atleta_nome}", "{responsavel_nome}", "{agenda_url}"],
};

/** Variáveis do par meeting_confirmed — espelham buildMeetingVars de
 *  functions/calendar-webhook/index.js. {meet_link} é opcional: o link do
 *  Meet sempre vai anexado como preview do WhatsApp, independente do texto. */
const MEETING_VARIAVEIS = [
  "{atleta_nome}",
  "{responsavel_nome}",
  "{telefone}",
  "{email}",
  "{meet_link}",
  "{data_reuniao}",
  "{hora_reuniao}",
];

const TEMPLATE_TITULO: Record<MensagemTemplate, string> = {
  initial: "Mensagem inicial (agendamento)",
  followup_1: "Follow-up 1",
  followup_2: "Follow-up 2",
  early_potential: "Timing cedo (early_potential)",
  late_timing: "Timing tarde (late_timing)",
  scheduled_return: "Retomada agendada (scheduled_return)",
};

/** Card de automação nativa. `intervaloChave`/`templates`/`editaReuniao`
 *  definem o que o modal permite editar — cards sem nada disso abrem um
 *  modal "Detalhes" só de leitura (sem UI falsa). */
interface SistemaCard {
  id: string;
  nome: string;
  descricao: string;
  /** Descrição do fluxo exibida no modal (uma linha por parágrafo). */
  fluxo: string[];
  intervaloChave?: keyof SchedulerIntervalos;
  templates?: MensagemTemplate[];
  editaReuniao?: boolean;
}

/** As 4 nativas com intervalo editável (persistem em scheduler_intervalos;
 *  as CFs leem no próximo tick, com clamp 1h–720h próprio). `templates` são
 *  os textos de mensagem editáveis (scheduler_mensagens) de cada scheduler. */
const SISTEMA_EDITAVEIS: SistemaCard[] = [
  {
    id: "whatsapp_inicial",
    nome: "WhatsApp inicial (timing ideal)",
    descricao: "Convite de agendamento após a qualificação Gemini (QUENTE/MORNO).",
    fluxo: [
      "O scheduler roda 1x/hora e envia o convite de agendamento (template initial) para leads QUENTE/MORNO com timing ideal, N horas após a qualificação Gemini.",
      "Atleta e responsável recebem textos próprios — o responsável recebe o link de agendamento. O envio é único por lead.",
    ],
    intervaloChave: "whatsapp_inicial_horas",
    templates: ["initial"],
  },
  {
    id: "whatsapp_timing_alt",
    nome: "WhatsApp timing alternativo",
    descricao: "Mensagem early_potential/late_timing p/ leads muito cedo ou tarde demais.",
    fluxo: [
      "Mesmo scheduler: N horas após a qualificação, leads QUENTE/MORNO fora do timing ideal recebem a mensagem de timing (FRIO nunca recebe).",
      "Muito cedo (antes do 8º ano) → template early_potential e o deal vai para Aguardando timing, com retomada em novembro. Tarde demais (2+ anos formado) → template late_timing e o deal vai para Perdido (motivo: timing).",
    ],
    intervaloChave: "whatsapp_timing_alt_horas",
    templates: ["early_potential", "late_timing"],
  },
  {
    id: "followup_1",
    nome: "Follow-up 1",
    descricao: "Primeiro follow-up após o WhatsApp inicial, se não agendou reunião.",
    fluxo: [
      "O scheduler de follow-up roda 1x/hora: N horas após o WhatsApp inicial sem reunião marcada, envia o follow-up 1 (só timing ideal).",
      "Quem já agendou reunião nunca recebe.",
    ],
    intervaloChave: "followup_1_horas",
    templates: ["followup_1"],
  },
  {
    id: "followup_2",
    nome: "Follow-up 2",
    descricao: "Segundo follow-up (após o FU1), se ainda não agendou reunião.",
    fluxo: [
      "N horas após o WhatsApp inicial — e somente depois do Follow-up 1 — envia o último lembrete do ciclo, se a reunião segue sem agendamento.",
      "O intervalo precisa ser maior que o do Follow-up 1 (os dois contam a partir do WhatsApp inicial).",
    ],
    intervaloChave: "followup_2_horas",
    templates: ["followup_2"],
  },
];

const SISTEMA_INFORMATIVAS: SistemaCard[] = [
  {
    id: "retomada_novembro",
    nome: "Retomada de novembro",
    descricao: "Leads muito cedo recebem scheduled_return em 1º/nov (automático).",
    fluxo: [
      "Roda diariamente (08:00 BRT): leads muito cedo têm a retomada materializada para 1º de novembro do ano civil seguinte ao cadastro.",
      "Na data, atleta e responsável recebem o template scheduled_return — envio único por lead. A data da retomada não é configurável.",
    ],
    templates: ["scheduled_return"],
  },
  {
    id: "confirmacao_reuniao",
    nome: "Confirmação de reunião",
    descricao: "Agendou no Calendar → WhatsApp instantâneo p/ lead e CEO (webhook).",
    fluxo: [
      "O webhook do Google Calendar avisa na hora em que uma reunião é criada. O lead é localizado por e-mail ou telefone (últimos dígitos, qualquer DDI).",
      "Envia a confirmação à família e a notificação ao CEO, marca a reunião no lead, move o deal para Reunião marcada e sincroniza o Google Sheets.",
      "O link do Meet é anexado automaticamente como preview do WhatsApp — não precisa constar no texto.",
    ],
    editaReuniao: true,
  },
  {
    id: "qualificacao_gemini",
    nome: "Qualificação Gemini",
    descricao: "Todo lead novo é classificado (QUENTE/MORNO/FRIO) na entrada.",
    fluxo: [
      "Dispara no cadastro de cada formulário (webhook Supabase) e classifica o lead como QUENTE, MORNO ou FRIO via Google Gemini.",
      "QUENTE/MORNO entram automaticamente no pipeline (atleta + deal na etapa Lead) e seguem para o WhatsApp inicial.",
      "Falhas de qualificação são reprocessadas automaticamente 1x/dia. Critérios do prompt: docs/BUSINESS_RULES.md (ajuste via código).",
    ],
  },
  {
    id: "emails_confirmacao",
    nome: "E-mails de confirmação",
    descricao: "Envio automático no cadastro do formulário (Resend/Brevo).",
    fluxo: [
      "Dispara no cadastro do formulário e envia os e-mails de confirmação (família + cópia interna).",
      "Resend é o provedor primário, com fallback automático para Brevo em caso de falha.",
      "Remetente e destinatário interno são configurados nas variáveis da função no GCP (FROM_EMAIL, INTERNAL_EMAIL).",
    ],
  },
  {
    id: "sync_sheets",
    nome: "Sync Google Sheets",
    descricao: "Todo lead e atualização espelhados na planilha (cols A–BG).",
    fluxo: [
      "Espelha todo lead novo — e cada atualização de status — na planilha do Google Sheets (colunas A–BG, incluindo tracking UTM).",
      "É reacionada pela qualificação, pelos schedulers de WhatsApp e pela confirmação de reunião a cada mudança relevante.",
      "Planilha e credenciais são configuradas nas variáveis da função no GCP (SPREADSHEET_ID, SERVICE_ACCOUNT_*).",
    ],
  },
];

/** Payload do modal de edição — sempre convertido em objetos COMPLETOS antes
 *  de chamar as actions (que reescrevem cada config inteira). */
interface SistemaSavePayload {
  intervalo?: { chave: keyof SchedulerIntervalos; valor: number };
  textos?: Partial<Record<MensagemTemplate, MensagemPar>>;
  reuniao?: MensagemParReuniao;
}

function SistemaAutomacoesSection({
  intervalos,
  mensagens,
  isPending,
}: {
  intervalos: SchedulerIntervalos;
  mensagens: SchedulerMensagens | null;
  isPending: boolean;
}) {
  const router = useRouter();
  const [salvando, startTransition] = useTransition();
  const [cardAberto, setCardAberto] = useState<SistemaCard | null>(null);
  const ocupado = isPending || salvando;

  /** Algo do card é editável neste ambiente? Sem seed → só "Detalhes". */
  const cardEditavel = (card: SistemaCard): boolean =>
    Boolean(card.intervaloChave) ||
    Boolean(card.templates?.length && mensagens) ||
    Boolean(card.editaReuniao && mensagens?.meeting_confirmed);

  const salvar = (payload: SistemaSavePayload) => {
    startTransition(async () => {
      if (payload.intervalo) {
        // Objeto completo com o campo alterado — a action reescreve a config
        const completo = { ...intervalos, [payload.intervalo.chave]: payload.intervalo.valor };
        // Pré-validação do refine do servidor (erro claro antes do round-trip)
        if (completo.followup_2_horas <= completo.followup_1_horas) {
          toast.error("Follow-up 2 deve ter intervalo maior que o Follow-up 1");
          return;
        }
        const result = await atualizarIntervalosScheduler(completo);
        if (!result.success) {
          toast.error(result.error ?? "Erro ao salvar intervalo");
          return;
        }
      }
      if ((payload.textos || payload.reuniao) && mensagens) {
        // O objeto inteiro é reescrito — os demais templates seguem inalterados
        const completo: SchedulerMensagens = {
          ...mensagens,
          ...(payload.textos ?? {}),
          ...(payload.reuniao ? { meeting_confirmed: payload.reuniao } : {}),
        };
        const result = await atualizarMensagensScheduler(completo);
        if (!result.success) {
          toast.error(result.error ?? "Erro ao salvar mensagens");
          // Falha PARCIAL: o intervalo pode já ter sido salvo acima — refresh
          // para o card refletir o estado real do banco (evita "Cancelar" enganoso)
          router.refresh();
          return;
        }
      }
      toast.success("Automação atualizada — vale a partir do próximo tick/envio");
      setCardAberto(null);
      router.refresh();
    });
  };

  return (
    <section className="space-y-2">
      <p className="text-eyebrow text-label-tertiary">Automações do sistema</p>

      {!mensagens && (
        <p className="rounded-md border border-dashed border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Textos das mensagens indisponíveis neste ambiente (seed{" "}
          <code className="font-mono">scheduler_mensagens</code> pendente) — a edição fica
          desabilitada e os envios seguem com os textos padrão do sistema.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {SISTEMA_EDITAVEIS.map((card) => (
          <Card key={card.id} variant="plain" padding="sm" accent="brand">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Zap className="h-3 w-3 text-primary" />
                  {card.nome}
                  <Badge tone="green" size="sm">Ativa</Badge>
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {card.descricao}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {card.intervaloChave && (
                  <span className="text-[11px] text-muted-foreground">
                    dispara após{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      {intervalos[card.intervaloChave]}h
                    </span>
                  </span>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={ocupado}
                  aria-label={`Editar ${card.nome}`}
                  onClick={() => setCardAberto(card)}
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SISTEMA_INFORMATIVAS.map((card) => {
          const editavel = cardEditavel(card);
          return (
            <Card key={card.id} variant="ghost" padding="sm">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <Clock className="h-3 w-3 text-label-tertiary" />
                {card.nome}
                <Badge tone="neutral" size="sm">Automática</Badge>
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{card.descricao}</p>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={ocupado}
                  aria-label={editavel ? `Editar ${card.nome}` : `Detalhes de ${card.nome}`}
                  onClick={() => setCardAberto(card)}
                >
                  {editavel ? <Pencil className="h-3 w-3" /> : <Info className="h-3 w-3" />}
                  {editavel ? "Editar" : "Detalhes"}
                </Button>
              </div>
            </Card>
          );
        })}
        <Card variant="ghost" padding="sm" className="border border-dashed border-border">
          <p className="text-[11px] font-semibold text-foreground">Régua de cobrança</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Monte pela aba builder: gatilho <em>Parcela vencendo/atrasada</em> (D−3, D+1, D+7, D+15) + ações.
          </p>
        </Card>
      </div>

      {cardAberto && (
        <SistemaModal
          card={cardAberto}
          intervalos={intervalos}
          mensagens={mensagens}
          isPending={ocupado}
          onClose={() => setCardAberto(null)}
          onSave={salvar}
        />
      )}
    </section>
  );
}

// ─── Modal da automação do sistema (fluxo + intervalo + textos juntos) ──────

const MENSAGEM_MIN_CHARS = 10;
const MENSAGEM_MAX_CHARS = 2000;

function mensagemValida(texto: string): boolean {
  return texto.length >= MENSAGEM_MIN_CHARS && texto.length <= MENSAGEM_MAX_CHARS;
}

function CampoMensagem({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const invalido = !mensagemValida(value);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[11px] font-semibold text-foreground">
          {label}
        </label>
        <span
          className={cn(
            "text-[11px] tabular-nums",
            invalido ? "text-sys-red" : "text-muted-foreground",
          )}
        >
          {value.length}/{MENSAGEM_MAX_CHARS}
        </span>
      </div>
      <textarea
        id={id}
        className={cn(FIELD_CLASS, "min-h-44 resize-y leading-relaxed")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function VariaveisLegenda({ variaveis }: { variaveis: string[] }) {
  return (
    <p className="rounded-md bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      Variáveis disponíveis:{" "}
      {variaveis.map((v) => (
        <code key={v} className="mr-1.5 font-mono text-foreground">
          {v}
        </code>
      ))}
      — substituídas no envio. Formatação WhatsApp: *negrito* e _itálico_.
    </p>
  );
}

/** Modal único por card: descrição do fluxo + intervalo + TODOS os textos do
 *  card juntos. Cards sem nada editável viram "Detalhes" (só leitura). */
function SistemaModal({
  card,
  intervalos,
  mensagens,
  isPending,
  onClose,
  onSave,
}: {
  card: SistemaCard;
  intervalos: SchedulerIntervalos;
  mensagens: SchedulerMensagens | null;
  isPending: boolean;
  onClose: () => void;
  onSave: (payload: SistemaSavePayload) => void;
}) {
  // Textos editáveis só quando o seed existe no ambiente (sem UI falsa)
  const templatesEditaveis = mensagens ? card.templates ?? [] : [];
  const [intervalo, setIntervalo] = useState<number>(
    card.intervaloChave ? intervalos[card.intervaloChave] : 0,
  );
  const [textos, setTextos] = useState<Partial<Record<MensagemTemplate, MensagemPar>>>(() => {
    const inicial: Partial<Record<MensagemTemplate, MensagemPar>> = {};
    if (mensagens) {
      for (const t of card.templates ?? []) inicial[t] = { ...mensagens[t] };
    }
    return inicial;
  });
  const [reuniao, setReuniao] = useState<MensagemParReuniao | null>(
    card.editaReuniao && mensagens?.meeting_confirmed
      ? { ...mensagens.meeting_confirmed }
      : null,
  );

  const temEdicao =
    Boolean(card.intervaloChave) || templatesEditaveis.length > 0 || reuniao !== null;

  const intervaloValido =
    !card.intervaloChave || (Number.isInteger(intervalo) && intervalo >= 1 && intervalo <= 720);
  const textosValidos = templatesEditaveis.every((t) => {
    const par = textos[t];
    return par !== undefined && mensagemValida(par.atleta) && mensagemValida(par.responsavel);
  });
  const reuniaoValida = !reuniao || (mensagemValida(reuniao.lead) && mensagemValida(reuniao.ceo));
  const valido = intervaloValido && textosValidos && reuniaoValida;

  const setTexto = (template: MensagemTemplate, campo: keyof MensagemPar, valor: string) => {
    setTextos((prev) => {
      const par = prev[template] ?? { atleta: "", responsavel: "" };
      return { ...prev, [template]: { ...par, [campo]: valor } };
    });
  };

  const salvar = () => {
    onSave({
      ...(card.intervaloChave
        ? { intervalo: { chave: card.intervaloChave, valor: intervalo } }
        : {}),
      ...(templatesEditaveis.length > 0 ? { textos } : {}),
      ...(reuniao ? { reuniao } : {}),
    });
  };

  const titulo = temEdicao ? "Editar automação" : "Detalhes";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/20 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${titulo} — ${card.nome}`}
        className="liquid-glass my-8 w-full max-w-2xl rounded-2xl p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-title-3 text-foreground">
            {titulo} — {card.nome}
          </h2>
          <Button variant="ghost" size="sm" aria-label="Fechar" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5">
          {/* Como funciona */}
          <section className="space-y-1.5">
            <p className={SECTION_LABEL}>Como funciona</p>
            {card.fluxo.map((linha) => (
              <p key={linha} className="text-[11px] leading-relaxed text-muted-foreground">
                {linha}
              </p>
            ))}
          </section>

          {/* Intervalo de disparo */}
          {card.intervaloChave && (
            <section className="space-y-1.5">
              <p className={SECTION_LABEL}>Intervalo de disparo</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">dispara após</span>
                <Input
                  type="number"
                  min={1}
                  max={720}
                  aria-label={`Intervalo de ${card.nome} em horas`}
                  className="w-20 text-center tabular-nums"
                  value={String(intervalo)}
                  onChange={(e) => setIntervalo(Number(e.target.value))}
                />
                <span className="text-[11px] font-medium text-muted-foreground">h</span>
              </div>
              <p className={cn("text-[11px]", intervaloValido ? "text-muted-foreground" : "text-sys-red")}>
                Entre 1 e 720 horas — vale a partir do próximo tick do scheduler (1x/hora).
              </p>
            </section>
          )}

          {/* Seed pendente: sem UI falsa de textos */}
          {(card.templates?.length ?? 0) > 0 && !mensagens && (
            <p className="rounded-md border border-dashed border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Textos indisponíveis neste ambiente (seed{" "}
              <code className="font-mono">scheduler_mensagens</code> pendente) — os envios
              seguem com os textos padrão do sistema.
            </p>
          )}

          {/* Textos por template (par atleta/responsável) */}
          {templatesEditaveis.map((template) => {
            const par = textos[template] ?? { atleta: "", responsavel: "" };
            return (
              <section key={template} className="space-y-3">
                <p className={SECTION_LABEL}>Mensagens — {TEMPLATE_TITULO[template]}</p>
                <VariaveisLegenda variaveis={TEMPLATE_VARIAVEIS[template]} />
                <CampoMensagem
                  id={`mensagem-atleta-${template}`}
                  label="Mensagem para o atleta"
                  value={par.atleta}
                  onChange={(v) => setTexto(template, "atleta", v)}
                />
                <CampoMensagem
                  id={`mensagem-responsavel-${template}`}
                  label="Mensagem para o responsável"
                  value={par.responsavel}
                  onChange={(v) => setTexto(template, "responsavel", v)}
                />
              </section>
            );
          })}

          {/* Confirmação de reunião (par lead/CEO — calendar-webhook) */}
          {card.editaReuniao &&
            (reuniao ? (
              <section className="space-y-3">
                <p className={SECTION_LABEL}>Mensagens — Confirmação de reunião</p>
                <VariaveisLegenda variaveis={MEETING_VARIAVEIS} />
                <CampoMensagem
                  id="mensagem-reuniao-lead"
                  label="Confirmação para a família (lead)"
                  value={reuniao.lead}
                  onChange={(v) => setReuniao({ ...reuniao, lead: v })}
                />
                <CampoMensagem
                  id="mensagem-reuniao-ceo"
                  label="Notificação para o CEO"
                  value={reuniao.ceo}
                  onChange={(v) => setReuniao({ ...reuniao, ceo: v })}
                />
              </section>
            ) : (
              <p className="rounded-md border border-dashed border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Edição dos textos indisponível neste ambiente (chave{" "}
                <code className="font-mono">meeting_confirmed</code> pendente no seed) — os
                envios seguem com os textos padrão do sistema.
              </p>
            ))}

          {/* Card 100% informativo: nada editável (sem UI falsa) */}
          {!card.intervaloChave && !card.templates?.length && !card.editaReuniao && (
            <p className="rounded-md bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Parâmetros editáveis: em breve.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-border pt-4">
          {temEdicao ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={isPending || !valido}>
                Salvar alterações
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Execuções (acompanhamento real por run) ────────────────────────────────

function resumoResultado(run: AutomacaoRunDetalhado): string {
  const r = run.resultado as {
    motivo?: string;
    acoes?: { tipo: string; status: string; detalhe?: string }[];
  };
  if (r?.motivo) return r.motivo;
  if (Array.isArray(r?.acoes) && r.acoes.length > 0) {
    return r.acoes
      .map((a) => `${ACAO_CATALOG[a.tipo as AutomacaoAcaoTipo]?.label ?? a.tipo}: ${a.status}`)
      .join(" · ");
  }
  return "—";
}

function ExecucoesView({
  runs,
  leadNomes,
  automacoes,
  filtroAutomacaoId,
  onFiltroChange,
  agora,
  isPending,
  onReplay,
}: {
  runs: AutomacaoRunDetalhado[];
  leadNomes: Record<string, string>;
  automacoes: AutomacaoComStats[];
  filtroAutomacaoId: string | null;
  onFiltroChange: (id: string | null) => void;
  agora: number;
  isPending: boolean;
  onReplay: (runId: string) => void;
}) {
  const visiveis = filtroAutomacaoId
    ? runs.filter((r) => r.automacao_id === filtroAutomacaoId)
    : runs;
  const seteDiasAtras = agora - 7 * 86400000;
  const recentes = visiveis.filter((r) => new Date(r.created_at).getTime() >= seteDiasAtras);
  const kpi = {
    total: recentes.length,
    sucesso: recentes.filter((r) => r.status === "sucesso").length,
    erro: recentes.filter((r) => r.status === "erro").length,
    fila: recentes.filter((r) => r.status === "pendente" || r.status === "executando").length,
  };

  return (
    <div className="space-y-5">
      {/* KPI strip — últimos 7 dias */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Execuções (7d)" value={kpi.total} icon={History} accent="brand" />
        <StatCard label="Sucesso" value={kpi.sucesso} icon={CheckCircle2} accent="green" />
        <StatCard
          label="Erro"
          value={kpi.erro}
          icon={AlertTriangle}
          accent={kpi.erro > 0 ? "red" : "green"}
        />
        <StatCard label="Na fila" value={kpi.fila} icon={Clock} accent="blue" />
      </div>

      {/* Filtro por automação (setado também pelo "Ver execuções" do card) */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Automação:</span>
        <select
          aria-label="Filtrar por automação"
          className={cn(FIELD_CLASS, "max-w-xs")}
          value={filtroAutomacaoId ?? ""}
          onChange={(e) => onFiltroChange(e.target.value || null)}
        >
          <option value="">Todas</option>
          {automacoes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      </div>

      {visiveis.length === 0 ? (
        <Card variant="plain" padding="none">
          <EmptyState
            icon={History}
            title="Nenhuma execução ainda"
            description="Ative uma automação — os disparos aparecem aqui com status, tentativas e resultado."
          />
        </Card>
      ) : (
        <Card variant="plain" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="py-2.5 pl-4 pr-3 text-left text-eyebrow text-muted-foreground">Quando</th>
                  <th className="px-3 py-2.5 text-left text-eyebrow text-muted-foreground">Automação</th>
                  <th className="px-3 py-2.5 text-left text-eyebrow text-muted-foreground">Origem</th>
                  <th className="px-3 py-2.5 text-left text-eyebrow text-muted-foreground">Status</th>
                  <th className="px-3 py-2.5 text-left text-eyebrow text-muted-foreground">Tent.</th>
                  <th className="px-3 py-2.5 text-left text-eyebrow text-muted-foreground">Resultado</th>
                  <th className="px-3 py-2.5 text-right text-eyebrow text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((run) => {
                  const gatilho = run.automacoes ? GATILHO_CATALOG[run.automacoes.gatilho] : null;
                  const contexto = run.contexto as { atleta_id?: string; periodo?: string };
                  const atletaId = contexto?.atleta_id;
                  const leadNome = atletaId ? leadNomes[atletaId] : undefined;
                  return (
                    <tr key={run.id} className="border-b border-border transition-colors hover:bg-accent">
                      <td className="py-2.5 pl-4 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(run.created_at).toLocaleString("pt-BR", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-medium text-foreground">
                          {run.automacoes?.nome ?? "(removida)"}
                        </p>
                        {gatilho && (
                          <p className="text-[11px] text-muted-foreground">{gatilho.label}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {leadNome ? (
                          <p className="text-xs font-medium text-foreground">{leadNome}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground font-mono">
                            {run.gatilho_origem_tabela ?? contexto?.periodo ?? "—"}
                            {run.gatilho_origem_id ? ` · ${run.gatilho_origem_id.slice(0, 8)}` : ""}
                          </p>
                        )}
                        {leadNome && (
                          <p className="text-[11px] text-muted-foreground">{run.gatilho_origem_tabela}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={RUN_STATUS_TONE[run.status]} size="sm">
                          {RUN_STATUS_LABEL[run.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{run.tentativas}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[320px] truncate">
                        {resumoResultado(run)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {run.status === "erro" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isPending}
                            aria-label="Reprocessar run"
                            onClick={() => onReplay(run.id)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reprocessar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
