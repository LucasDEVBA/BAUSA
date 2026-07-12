"use client";

import { Fragment, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Workflow,
  Plus,
  Zap,
  Clock,
  Copy,
  Pencil,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  History,
  RotateCcw,
  Info,
  ChevronDown,
  ExternalLink,
  GitBranch,
  Shield,
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
  useConfirm,
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
  normalizarAcaoParaSalvar,
  normalizarPassoParaSalvar,
  type BuilderState,
  type UsuarioRow,
} from "@/components/automacoes/builder-shared";
import {
  criarAutomacao,
  atualizarAutomacao,
  alternarAtivoAutomacao,
  duplicarAutomacao,
  excluirAutomacao,
  reprocessarRun,
  atualizarIntervalosScheduler,
  atualizarMensagensScheduler,
  atualizarAtivasSistema,
  atualizarEmailConfig,
  atualizarNpsMensagem,
  atualizarQualificacaoPrompt,
  type AutomacaoInput,
  type NpsMensagemCfg,
  type SchedulerIntervalos,
  type SchedulerMensagens,
  type SistemaAtivas,
  type SistemaEmailConfig,
} from "@/lib/actions/automacoes-builder";
import {
  NPS_MENSAGEM_DEFAULT,
  NPS_MENSAGEM_VARIAVEIS,
} from "@/lib/automacoes/nps-mensagem-default";
import {
  QUALIFICACAO_PROMPT_DEFAULTS,
  QUALIFICACAO_PROMPT_LABELS,
  type QualificacaoPromptCfg,
} from "@/lib/automacoes/qualificacao-prompt-defaults";
import { atualizarInsightsConversaPrompt } from "@/lib/actions/whatsapp-insights";
import { atualizarInstrucoesIA } from "@/lib/actions/prompts-ia";
import { TRANSCRICAO_RESUMO_INSTRUCOES_DEFAULT } from "@/lib/automacoes/transcricao-resumo-prompt";
import { CAC_INSIGHTS_INSTRUCOES_DEFAULT } from "@/lib/automacoes/cac-insights-prompt";
import { INSIGHTS_CONVERSA_INSTRUCOES_DEFAULT } from "@/lib/automacoes/insights-conversa-prompt";

/** Config do prompt de insights de conversa (chave insights_conversa_prompt). */
interface InsightsPromptCfg {
  instrucoes?: string;
}
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
  ativas,
  emailCfg,
  promptCfg,
  insightsCfg,
  transcricaoCfg,
  cacCfg,
  npsCfg,
  agora,
}: {
  automacoes: AutomacaoComStats[];
  usuarios: UsuarioRow[];
  runsRecentes: AutomacaoRunDetalhado[];
  leadNomes: Record<string, string>;
  intervalos: SchedulerIntervalos;
  mensagens: SchedulerMensagens | null;
  ativas: SistemaAtivas | null;
  emailCfg: SistemaEmailConfig | null;
  promptCfg: QualificacaoPromptCfg | null;
  insightsCfg: InsightsPromptCfg | null;
  transcricaoCfg: InsightsPromptCfg | null;
  cacCfg: InsightsPromptCfg | null;
  npsCfg: NpsMensagemCfg | null;
  agora: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [builder, setBuilder] = useState<BuilderState | null>(null);
  const [activeTab, setActiveTab] = useState<"automacoes" | "execucoes">("automacoes");
  // Modal das automações de SISTEMA — içado: abre pelos cards E pela lista.
  const [sistemaAberto, setSistemaAberto] = useState<SistemaCard | null>(null);
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
    } else if (gatilhoInfo.configEtapa && builder.gatilhoEtapaPara) {
      // Filtro por etapa do deal_etapa_mudou — vazio = qualquer transição
      gatilhoConfig.etapa_para = builder.gatilhoEtapaPara;
    }
    // Modo por passos ativo → o modelo simples é zerado (mutuamente exclusivo;
    // a action revalida e força a exclusividade server-side também).
    const temPassos = builder.passos.length > 0;
    const input: AutomacaoInput = {
      nome: builder.nome,
      descricao: builder.descricao || undefined,
      gatilho: builder.gatilho,
      gatilho_config: gatilhoConfig,
      condicoes: temPassos ? [] : builder.condicoes,
      // Link/mídia das ações custom: "" nos forms = ausente no payload
      acoes: temPassos ? [] : builder.acoes.map(normalizarAcaoParaSalvar),
      passos: temPassos ? builder.passos.map(normalizarPassoParaSalvar) : [],
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

  const duplicar = (a: AutomacaoComStats) => {
    startTransition(async () => {
      const result = await duplicarAutomacao(a.id);
      if (!result.success) {
        toast.error(result.error ?? "Erro ao duplicar automação");
        return;
      }
      toast.success(`Cópia de “${a.nome}” criada (pausada — edite e ative quando quiser)`);
      router.refresh();
    });
  };

  const excluir = async (a: AutomacaoComStats) => {
    const ok = await confirm({
      title: "Excluir automação?",
      description: `“${a.nome}” será excluída. Os runs históricos são preservados.`,
      confirmLabel: "Excluir",
      tone: "danger",
    });
    if (!ok) return;
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
        eyebrow="Comercial"
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

      {/* Automações do sistema em CARDS (apresentação da H4, restaurada a
          pedido do CEO) + "Suas automações" em lista logo abaixo. */}
      {activeTab === "automacoes" && (
        <div className="space-y-4">
          <SistemaAutomacoesSection
            cardAberto={sistemaAberto}
            onCardAberto={setSistemaAberto}
            intervalos={intervalos}
            mensagens={mensagens}
            ativas={ativas}
            emailCfg={emailCfg}
            promptCfg={promptCfg}
            insightsCfg={insightsCfg}
            transcricaoCfg={transcricaoCfg}
            cacCfg={cacCfg}
            npsCfg={npsCfg}
            isPending={isPending}
            onMontarRegua={() => setBuilder({ ...emptyBuilder(), gatilho: "parcela_vencendo" })}
          />

          <section className="space-y-3">
            <p className="text-eyebrow text-label-tertiary">Suas automações</p>

            {/* Sem automações CUSTOM: dica compacta (as de sistema seguem
                logo abaixo na mesma lista — um estado vazio gigante aqui
                mentiria "nenhuma automação" com a lista cheia). */}
            {automacoes.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-secondary/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Você ainda não criou automações personalizadas — abaixo estão as automações
                  nativas do sistema.
                </p>
                <Button size="sm" onClick={() => setBuilder(emptyBuilder())}>
                  <Plus className="h-3.5 w-3.5" />
                  Criar automação
                </Button>
              </div>
            ) : (
              automacoes.map((a) => {
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
                          {a.passos && a.passos.length > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              {a.passos.length} passo{a.passos.length !== 1 ? "s" : ""} ·{" "}
                              {a.passos
                                .flatMap((p) => (p.tipo === "acao" ? [ACAO_CATALOG[p.acao.tipo].label] : []))
                                .join(" + ")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <ListChecks className="h-3 w-3" />
                              {a.condicoes.length} condição{a.condicoes.length !== 1 ? "es" : ""} ·{" "}
                              {a.acoes.map((ac) => ACAO_CATALOG[ac.tipo].label).join(" + ")}
                            </span>
                          )}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Duplicar ${a.nome}`}
                          title="Duplicar (a cópia nasce pausada)"
                          disabled={isPending}
                          onClick={() => duplicar(a)}
                        >
                          <Copy className="h-3.5 w-3.5" />
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
              })
            )}

            {/* Automações de SISTEMA na mesma lista (badge Sistema) — a gestão
                completa (toggles/prompts/textos) abre o mesmo modal dos cards. */}
            {SISTEMA_AUTOMACOES.map((card) => {
              const ativa =
                !card.toggles?.length || !ativas
                  ? true
                  : card.toggles.some((t) => ativas[t.chave] !== false);
              return (
                <Card key={`sistema-${card.id}`} padding="md" accent={ativa ? "green" : "neutral"}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{card.nome}</p>
                        <Badge tone={ativa ? "green" : "neutral"} size="sm">
                          {ativa ? "Ativa" : "Desativada"}
                        </Badge>
                        <Badge tone="purple" size="sm">
                          <Shield className="h-2.5 w-2.5" />
                          Sistema
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{card.descricao}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Configurar ${card.nome}`}
                        onClick={() => setSistemaAberto(card)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Configurar
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>
        </div>
      )}

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

/** Card de automação nativa. `intervaloChave`/`templates`/`editaReuniao`/
 *  `toggles`/`editaEmailDestino`/`editaPrompt` definem o que o modal permite
 *  editar — cards sem nada disso abrem um modal "Detalhes" só de leitura
 *  (sem UI falsa). */
interface SistemaCard {
  id: string;
  nome: string;
  descricao: string;
  /** Descrição do fluxo exibida no modal (uma linha por parágrafo). */
  fluxo: string[];
  intervaloChave?: keyof SchedulerIntervalos;
  templates?: MensagemTemplate[];
  editaReuniao?: boolean;
  /** On/off persistidos em sistema_automacoes_ativas (ausente = ativa —
   *  fail-open nas CFs). Aviso opcional exibido ao desligar. */
  toggles?: { chave: keyof SistemaAtivas; label: string; avisoDesligar?: string }[];
  /** Card de e-mails: edita o destino do e-mail interno (email_config). */
  editaEmailDestino?: boolean;
  /** Card da qualificação: edita as seções do prompt Gemini. */
  editaPrompt?: boolean;
  /** Card de insights de conversa: edita as instruções do prompt. */
  editaInsightsPrompt?: boolean;
  /** Card do resumo de transcrição (Meet): edita as instruções do prompt. */
  editaTranscricaoPrompt?: boolean;
  /** Card de insights do CAC: edita as instruções do prompt. */
  editaCacPrompt?: boolean;
  /** Card da pesquisa NPS: edita o texto do WhatsApp (nps_mensagem). */
  editaNpsTexto?: boolean;
}

/** Automações nativas, na ordem dos cards: as 4 com intervalo editável
 *  (persistem em scheduler_intervalos; as CFs leem no próximo tick, com clamp
 *  1h–720h próprio — `templates` são os textos editáveis em
 *  scheduler_mensagens), depois retomada/confirmação (textos editáveis) e as
 *  3 informativas. Sempre ativas — sem toggle nem exclusão. */
const SISTEMA_AUTOMACOES: SistemaCard[] = [
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
    toggles: [{
      chave: "whatsapp_inicial",
      label: "Envio do WhatsApp inicial",
      avisoDesligar: "Leads qualificados NÃO receberão o convite de agendamento enquanto desligado — acumulam e disparam quando reativar.",
    }],
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
    toggles: [{
      chave: "whatsapp_timing_alt",
      label: "Envio das mensagens de timing",
      avisoDesligar: "Leads muito cedo/tarde demais NÃO receberão a mensagem de timing enquanto desligado — acumulam e disparam quando reativar.",
    }],
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
    toggles: [{
      chave: "followup_1",
      label: "Envio do Follow-up 1",
      avisoDesligar: "Sem o FU1, o FU2 também não sai (depende do FU1 enviado). Ao reativar após dias, o FU1 sai tardio e o FU2 respeita espaçamento mínimo de 24h.",
    }],
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
    toggles: [{ chave: "followup_2", label: "Envio do Follow-up 2" }],
  },
  {
    id: "retomada_novembro",
    nome: "Retomada de novembro",
    descricao: "Leads muito cedo recebem scheduled_return em 1º/nov (automático).",
    fluxo: [
      "Roda diariamente (08:00 BRT): leads muito cedo têm a retomada materializada para 1º de novembro do ano civil seguinte ao cadastro.",
      "Na data, atleta e responsável recebem o template scheduled_return — envio único por lead. A data da retomada não é configurável.",
    ],
    templates: ["scheduled_return"],
    toggles: [{ chave: "scheduled_return", label: "Envio da retomada de novembro" }],
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
    toggles: [{
      chave: "confirmacao_reuniao",
      label: "Notificações de reunião (lead + CEO)",
      avisoDesligar: "Só as notificações param — a detecção da reunião, o pipeline e o Sheets continuam funcionando.",
    }],
  },
  {
    id: "qualificacao_gemini",
    nome: "Qualificação Gemini",
    descricao: "Todo lead novo é classificado (QUENTE/MORNO/FRIO) na entrada.",
    fluxo: [
      "Dispara no cadastro de cada formulário (webhook Supabase) e classifica o lead como QUENTE, MORNO ou FRIO via Google Gemini.",
      "QUENTE/MORNO entram automaticamente no pipeline (atleta + deal na etapa Lead) e seguem para o WhatsApp inicial.",
      "Falhas de qualificação são reprocessadas automaticamente 1x/dia. As seções do prompt são editáveis abaixo — seção vazia volta ao padrão do sistema.",
    ],
    editaPrompt: true,
    toggles: [{
      chave: "qualificacao",
      label: "Qualificação automática",
      avisoDesligar: "Leads novos ficam PENDENTES (sem classe, sem pipeline, sem WhatsApp) até reativar — o reprocesso é automático na reativação.",
    }],
  },
  {
    id: "emails_confirmacao",
    nome: "E-mails de confirmação",
    descricao: "Envio automático no cadastro do formulário (Resend/Brevo).",
    fluxo: [
      "Dispara no cadastro do formulário e envia os e-mails de confirmação (família + cópia interna).",
      "Resend é o provedor primário, com fallback automático para Brevo em caso de falha.",
      "O destinatário do e-mail interno é editável abaixo; o remetente (FROM_EMAIL) segue nas variáveis da função no GCP.",
    ],
    editaEmailDestino: true,
    toggles: [
      {
        chave: "email_confirmacao",
        label: "E-mails automáticos ao lead (confirmação + timing)",
        avisoDesligar: "Cobre confirmação de candidatura E as mensagens de timing por e-mail. Envios manuais (mensagem direta) não são afetados.",
      },
      { chave: "email_interno", label: "E-mail interno de novo lead" },
    ],
  },
  {
    id: "insights_conversa",
    nome: "Insights de IA (WhatsApp)",
    descricao: "Análise da conversa sob demanda no espelho WhatsApp (Gemini).",
    fluxo: [
      "No espelho do WhatsApp, o botão \"Insights IA\" analisa a conversa aberta e devolve: resumo, sentimento, nível de interesse, próxima ação e sinais concretos.",
      "É sob demanda (não dispara sozinho) e só o CEO usa. As instruções da análise são editáveis abaixo — vazio volta ao padrão do sistema.",
    ],
    editaInsightsPrompt: true,
  },
  {
    id: "transcricao_resumo",
    nome: "Resumo de transcrição (Meet)",
    descricao: "Transcrições de reunião capturadas e resumidas pelo Gemini (a cada 2h).",
    fluxo: [
      "A cada 2h, a função captura a transcrição nativa do Google Meet das reuniões realizadas (Doc anexado ao evento do Calendar) e grava no detalhe do lead/deal.",
      "Com o resumo ligado, o Gemini condensa cada transcrição em 5–8 linhas (contexto, objeções, sinais, próximos passos). As instruções do resumo são editáveis abaixo — vazio volta ao padrão do sistema.",
      "Desligar o resumo NÃO para a captura: a transcrição completa continua sendo salva.",
    ],
    editaTranscricaoPrompt: true,
    toggles: [{
      chave: "resumo_transcricao",
      label: "Resumo automático via Gemini",
      avisoDesligar: "A transcrição continua sendo capturada — só o resumo deixa de ser gerado.",
    }],
  },
  {
    id: "cac_insights",
    nome: "Insights de IA (CAC)",
    descricao: "Análise de aquisição sob demanda na tela de CAC/ROI (Gemini).",
    fluxo: [
      "Na tela Analytics → CAC, o botão de insights analisa gasto, CAC, ROI por canal e por campanha do período e devolve recomendações acionáveis.",
      "É sob demanda (não dispara sozinho) e só o CEO usa. As instruções da análise são editáveis abaixo — vazio volta ao padrão do sistema.",
    ],
    editaCacPrompt: true,
  },
  {
    id: "monitor_health",
    nome: "Monitor de saúde (alertas)",
    descricao: "Watchdog do funil a cada 30 min — avisa o CEO quando algo trava.",
    fluxo: [
      "A cada 30 minutos verifica: leads sem qualificação Gemini há 2h+, fila do WhatsApp inicial presa além do intervalo configurado, e 3+ erros de automação nas últimas 6h.",
      "Problema detectado → WhatsApp ao CEO + notificação no Engine, com pausa de 6h entre alertas do mesmo tipo (sem spam).",
      "Desligar cala só os ALERTAS — as verificações continuam rodando e aparecem no Monitor de automações.",
    ],
    toggles: [{
      chave: "monitor_alertas",
      label: "Alertas de saúde do funil (WhatsApp + in-app)",
      avisoDesligar: "Sem alertas, uma falha silenciosa (ex.: qualificação parada) só será notada manualmente.",
    }],
  },
  {
    id: "nps_automatico",
    nome: "Pesquisa NPS (6 meses)",
    descricao: "Pós-venda: WhatsApp único pedindo a nota 0–10 às famílias com 6 meses de jornada.",
    fluxo: [
      "Roda diariamente (10:00 BRT): famílias embarcadas (fases Embarcado inicial e Acompanhamento) há 180+ dias recebem UM WhatsApp perguntando, de 0 a 10, o quanto recomendariam a BAUSA.",
      "O envio é único por família (marcado antes de enviar — nunca duplica). A resposta chega pelo WhatsApp normal e a nota é registrada manualmente na aba Indicadores do detalhe da família.",
      "O texto da mensagem é editável abaixo — vazio volta ao padrão do sistema.",
    ],
    editaNpsTexto: true,
    toggles: [{
      chave: "nps_automatico",
      label: "Envio automático da pesquisa NPS",
      avisoDesligar: "Famílias que completarem 6 meses NÃO receberão a pesquisa enquanto desligado — acumulam e disparam quando reativar.",
    }],
  },
  {
    id: "alerta_inatividade",
    nome: "Alerta de inatividade (famílias)",
    descricao: "Pós-venda: família sem contato além do limite da fase gera notificação + tarefa.",
    fluxo: [
      "Roda diariamente (10:00 BRT): famílias sem contato acima do limite da fase (Admissão 7d, Pré-embarque 15d, Embarcado inicial 7d, Acompanhamento 30d) geram alerta ATIVO.",
      "A Head e o CEO recebem notificação in-app e a Head ganha a tarefa \"Contatar família\" (prazo 24h, prioridade alta). Cada família alerta no máximo 1x por semana.",
    ],
    toggles: [{
      chave: "alerta_inatividade",
      label: "Notificação + tarefa de inatividade",
      avisoDesligar: "Sem o alerta ativo, a inatividade só aparece nos painéis de famílias — ninguém é notificado nem ganha tarefa.",
    }],
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

/** Grids da seção (apresentação H4): editáveis = as 4 com intervalo (cards
 *  grandes 2-col, botão Editar único); informativas = as demais (cards
 *  menores 3-col). Deriva da MESMA fonte SISTEMA_AUTOMACOES. */
const SISTEMA_EDITAVEIS = SISTEMA_AUTOMACOES.filter((c) => c.intervaloChave);
const SISTEMA_INFORMATIVAS = SISTEMA_AUTOMACOES.filter((c) => !c.intervaloChave);

/** Payload do modal de edição — sempre convertido em objetos COMPLETOS antes
 *  de chamar as actions (que reescrevem cada config inteira). */
interface SistemaSavePayload {
  intervalo?: { chave: keyof SchedulerIntervalos; valor: number };
  textos?: Partial<Record<MensagemTemplate, MensagemPar>>;
  reuniao?: MensagemParReuniao;
  /** Mudanças de toggle deste card (mescladas ao objeto completo na section). */
  ativas?: Partial<SistemaAtivas>;
  /** Destino do e-mail interno ('' limpa o override → volta ao padrão env). */
  emailDestino?: string;
  /** Overrides das seções do prompt ('' numa seção volta ao padrão do código). */
  promptCfg?: QualificacaoPromptCfg;
  /** Instruções do prompt de insights de conversa ('' volta ao padrão). */
  insightsInstrucoes?: string;
  /** Instruções do resumo de transcrição ('' volta ao padrão). */
  transcricaoInstrucoes?: string;
  /** Instruções dos insights de CAC ('' volta ao padrão). */
  cacInstrucoes?: string;
  /** Texto do WhatsApp da pesquisa NPS ('' volta ao padrão do código). */
  npsTexto?: string;
}

/** Seção "Automações do sistema" em CARDS (apresentação H4): grid 2-col para
 *  as editáveis (botão Editar único abre o SistemaModal com intervalo +
 *  textos) + grid 3-col de cards menores para as informativas + card
 *  tracejado da régua de cobrança (atalho "Montar no builder"). */
function SistemaAutomacoesSection({
  intervalos,
  mensagens,
  ativas,
  emailCfg,
  promptCfg,
  insightsCfg,
  transcricaoCfg,
  cacCfg,
  npsCfg,
  isPending,
  onMontarRegua,
  cardAberto,
  onCardAberto,
}: {
  intervalos: SchedulerIntervalos;
  mensagens: SchedulerMensagens | null;
  ativas: SistemaAtivas | null;
  emailCfg: SistemaEmailConfig | null;
  promptCfg: QualificacaoPromptCfg | null;
  insightsCfg: InsightsPromptCfg | null;
  transcricaoCfg: InsightsPromptCfg | null;
  cacCfg: InsightsPromptCfg | null;
  npsCfg: NpsMensagemCfg | null;
  isPending: boolean;
  onMontarRegua: () => void;
  cardAberto: SistemaCard | null;
  onCardAberto: (card: SistemaCard | null) => void;
}) {
  const router = useRouter();
  const [salvando, startTransition] = useTransition();
  const ocupado = isPending || salvando;

  /** Algo do card é editável neste ambiente? Sem seed → só "Detalhes". */
  const cardEditavel = (card: SistemaCard): boolean =>
    Boolean(card.intervaloChave) ||
    Boolean(card.templates?.length && mensagens) ||
    Boolean(card.editaReuniao && mensagens?.meeting_confirmed) ||
    Boolean(card.toggles?.length && ativas) ||
    Boolean(card.editaEmailDestino && emailCfg) ||
    Boolean(card.editaPrompt && promptCfg) ||
    Boolean(card.editaInsightsPrompt && insightsCfg) ||
    Boolean(card.editaTranscricaoPrompt && transcricaoCfg) ||
    Boolean(card.editaCacPrompt && cacCfg) ||
    Boolean(card.editaNpsTexto && npsCfg);

  /** Card está ativo? Ausente na config = ATIVA (fail-open, como nas CFs).
   *  Cards com vários toggles: desativado só se TODOS estiverem off. */
  const cardAtivo = (card: SistemaCard): boolean => {
    if (!card.toggles?.length || !ativas) return true;
    return card.toggles.some((t) => ativas[t.chave] !== false);
  };

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
      if (payload.ativas && ativas) {
        // Objeto completo: toggles dos DEMAIS cards seguem inalterados.
        // Campos undefined (opcionais não setados) saem — o schema catchall
        // exige boolean estrito nas chaves presentes.
        const mesclado: Record<string, boolean> = {};
        for (const [k, v] of Object.entries({ ...ativas, ...payload.ativas })) {
          if (typeof v === "boolean") mesclado[k] = v;
        }
        const result = await atualizarAtivasSistema(mesclado);
        if (!result.success) {
          toast.error(result.error ?? "Erro ao salvar status");
          router.refresh();
          return;
        }
      }
      if (payload.emailDestino !== undefined) {
        const result = await atualizarEmailConfig({ destino_interno: payload.emailDestino });
        if (!result.success) {
          toast.error(result.error ?? "Erro ao salvar e-mail de destino");
          router.refresh();
          return;
        }
      }
      if (payload.promptCfg) {
        const result = await atualizarQualificacaoPrompt(payload.promptCfg);
        if (!result.success) {
          toast.error(result.error ?? "Erro ao salvar o prompt");
          router.refresh();
          return;
        }
      }
      if (payload.insightsInstrucoes !== undefined) {
        const result = await atualizarInsightsConversaPrompt({
          instrucoes: payload.insightsInstrucoes,
        });
        if (!result.success) {
          toast.error(result.error ?? "Erro ao salvar as instruções");
          router.refresh();
          return;
        }
      }
      if (payload.transcricaoInstrucoes !== undefined) {
        const result = await atualizarInstrucoesIA({
          chave: "transcricao_resumo_prompt",
          instrucoes: payload.transcricaoInstrucoes,
        });
        if (!result.success) {
          toast.error(result.error ?? "Erro ao salvar as instruções");
          router.refresh();
          return;
        }
      }
      if (payload.cacInstrucoes !== undefined) {
        const result = await atualizarInstrucoesIA({
          chave: "cac_insights_prompt",
          instrucoes: payload.cacInstrucoes,
        });
        if (!result.success) {
          toast.error(result.error ?? "Erro ao salvar as instruções");
          router.refresh();
          return;
        }
      }
      if (payload.npsTexto !== undefined) {
        const result = await atualizarNpsMensagem({ texto: payload.npsTexto });
        if (!result.success) {
          toast.error(result.error ?? "Erro ao salvar o texto do NPS");
          router.refresh();
          return;
        }
      }
      toast.success("Automação atualizada — vale a partir do próximo tick/envio");
      onCardAberto(null);
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
                  {/* Badge reflete o toggle (sistema_automacoes_ativas) */}
                  {cardAtivo(card) ? (
                    <Badge tone="green" size="sm">Ativa</Badge>
                  ) : (
                    <Badge tone="red" size="sm">Desativada</Badge>
                  )}
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
                  onClick={() => onCardAberto(card)}
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
                {/* Com toggle → badge reflete o status; sem toggle → informativo */}
                {!card.toggles?.length ? (
                  <Badge tone="neutral" size="sm">Automática</Badge>
                ) : cardAtivo(card) ? (
                  <Badge tone="green" size="sm">Ativa</Badge>
                ) : (
                  <Badge tone="red" size="sm">Desativada</Badge>
                )}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {card.descricao}
              </p>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={ocupado}
                  aria-label={editavel ? `Editar ${card.nome}` : `Detalhes de ${card.nome}`}
                  onClick={() => onCardAberto(card)}
                >
                  {editavel ? <Pencil className="h-3 w-3" /> : <Info className="h-3 w-3" />}
                  {editavel ? "Editar" : "Detalhes"}
                </Button>
              </div>
            </Card>
          );
        })}
        {/* Régua de cobrança ainda não é nativa — nasce pelo builder (sem UI
            falsa de automação pronta); atalho pré-seleciona o gatilho. */}
        <Card variant="ghost" padding="sm" className="border border-dashed border-border">
          <p className="text-[11px] font-semibold text-foreground">Régua de cobrança</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Monte com o builder: gatilho <em>Parcela vencendo/atrasada</em> (D−3, D+1, D+7,
            D+15) + ações de tarefa, notificação ou WhatsApp.
          </p>
          <div className="mt-2">
            <Button variant="secondary" size="sm" onClick={onMontarRegua}>
              <Plus className="h-3 w-3" />
              Montar no builder
            </Button>
          </div>
        </Card>
      </div>

      {cardAberto && (
        <SistemaModal
          card={cardAberto}
          intervalos={intervalos}
          mensagens={mensagens}
          ativas={ativas}
          emailCfg={emailCfg}
          promptCfg={promptCfg}
          insightsCfg={insightsCfg}
          transcricaoCfg={transcricaoCfg}
          cacCfg={cacCfg}
          npsCfg={npsCfg}
          isPending={ocupado}
          onClose={() => onCardAberto(null)}
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
/** Editor genérico de instruções de prompt de IA (textarea + contagem +
 *  badge "Personalizada" quando difere do default do código). */
function InstrucoesIAEditor({
  id,
  titulo,
  rotulo,
  valor,
  onChange,
  defaultTexto,
  rodape,
}: {
  id: string;
  titulo: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  defaultTexto: string;
  rodape: string;
}) {
  const personalizada = valor.trim() !== defaultTexto.trim() && valor.trim() !== "";
  return (
    <section className="space-y-2">
      <p className={SECTION_LABEL}>{titulo}</p>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[11px] font-semibold text-foreground">
          {rotulo}
          {personalizada && (
            <Badge tone="blue" size="sm" className="ml-1.5">
              Personalizada
            </Badge>
          )}
        </label>
        <span
          className={cn(
            "text-[11px] tabular-nums",
            valor.length > 4000 ? "text-sys-red" : "text-muted-foreground",
          )}
        >
          {valor.length}/4000
        </span>
      </div>
      <textarea
        id={id}
        className={cn(FIELD_CLASS, "min-h-40 resize-y font-mono text-[11px] leading-relaxed")}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-[11px] text-muted-foreground">{rodape}</p>
    </section>
  );
}

function SistemaModal({
  card,
  intervalos,
  mensagens,
  ativas,
  emailCfg,
  promptCfg,
  insightsCfg,
  transcricaoCfg,
  cacCfg,
  npsCfg,
  isPending,
  onClose,
  onSave,
}: {
  card: SistemaCard;
  intervalos: SchedulerIntervalos;
  mensagens: SchedulerMensagens | null;
  ativas: SistemaAtivas | null;
  emailCfg: SistemaEmailConfig | null;
  promptCfg: QualificacaoPromptCfg | null;
  insightsCfg: InsightsPromptCfg | null;
  transcricaoCfg: InsightsPromptCfg | null;
  cacCfg: InsightsPromptCfg | null;
  npsCfg: NpsMensagemCfg | null;
  isPending: boolean;
  onClose: () => void;
  onSave: (payload: SistemaSavePayload) => void;
}) {
  // Textos editáveis só quando o seed existe no ambiente (sem UI falsa)
  const templatesEditaveis = mensagens ? card.templates ?? [] : [];
  // Toggles/e-mail/prompt: idem — null (migration pendente) desabilita
  const togglesEditaveis = ativas ? card.toggles ?? [] : [];
  const emailEditavel = Boolean(card.editaEmailDestino && emailCfg);
  const promptEditavel = Boolean(card.editaPrompt && promptCfg);
  const insightsEditavel = Boolean(card.editaInsightsPrompt && insightsCfg);
  const transcricaoEditavel = Boolean(card.editaTranscricaoPrompt && transcricaoCfg);
  const cacEditavel = Boolean(card.editaCacPrompt && cacCfg);
  const npsEditavel = Boolean(card.editaNpsTexto && npsCfg);
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
  // Toggles deste card (ausente na config = ATIVA — fail-open, como nas CFs)
  const [toggleValores, setToggleValores] = useState<Record<string, boolean>>(() => {
    const inicial: Record<string, boolean> = {};
    if (ativas) {
      for (const t of card.toggles ?? []) inicial[t.chave] = ativas[t.chave] !== false;
    }
    return inicial;
  });
  const [emailDestino, setEmailDestino] = useState<string>(
    emailCfg?.destino_interno ?? "",
  );
  // Seções do prompt: config ?? default do código (o CEO vê o texto que roda)
  const [promptSecoes, setPromptSecoes] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    if (card.editaPrompt && promptCfg) {
      for (const chave of Object.keys(QUALIFICACAO_PROMPT_DEFAULTS) as (keyof QualificacaoPromptCfg)[]) {
        inicial[chave] = promptCfg[chave] ?? QUALIFICACAO_PROMPT_DEFAULTS[chave];
      }
    }
    return inicial;
  });
  // Instruções do prompt de insights de conversa (config ?? default do código)
  const [insightsInstrucoes, setInsightsInstrucoes] = useState<string>(() =>
    card.editaInsightsPrompt && insightsCfg
      ? insightsCfg.instrucoes ?? INSIGHTS_CONVERSA_INSTRUCOES_DEFAULT
      : "",
  );
  // Instruções do resumo de transcrição e dos insights de CAC (mesmo padrão)
  const [transcricaoInstrucoes, setTranscricaoInstrucoes] = useState<string>(() =>
    card.editaTranscricaoPrompt && transcricaoCfg
      ? transcricaoCfg.instrucoes ?? TRANSCRICAO_RESUMO_INSTRUCOES_DEFAULT
      : "",
  );
  const [cacInstrucoes, setCacInstrucoes] = useState<string>(() =>
    card.editaCacPrompt && cacCfg
      ? cacCfg.instrucoes ?? CAC_INSIGHTS_INSTRUCOES_DEFAULT
      : "",
  );
  // Texto do WhatsApp da pesquisa NPS (config ?? default do código)
  const [npsTexto, setNpsTexto] = useState<string>(() =>
    card.editaNpsTexto && npsCfg ? npsCfg.texto ?? NPS_MENSAGEM_DEFAULT : "",
  );

  const temEdicao =
    Boolean(card.intervaloChave) ||
    templatesEditaveis.length > 0 ||
    reuniao !== null ||
    togglesEditaveis.length > 0 ||
    emailEditavel ||
    promptEditavel ||
    insightsEditavel ||
    transcricaoEditavel ||
    cacEditavel ||
    npsEditavel;

  const intervaloValido =
    !card.intervaloChave || (Number.isInteger(intervalo) && intervalo >= 1 && intervalo <= 720);
  const emailValido =
    !emailEditavel || emailDestino.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDestino.trim());
  const textosValidos = templatesEditaveis.every((t) => {
    const par = textos[t];
    return par !== undefined && mensagemValida(par.atleta) && mensagemValida(par.responsavel);
  });
  const reuniaoValida = !reuniao || (mensagemValida(reuniao.lead) && mensagemValida(reuniao.ceo));
  // Prompt: seção pode ficar vazia (= volta ao padrão), mas não estourar 4000
  const promptValido =
    !promptEditavel || Object.values(promptSecoes).every((v) => v.length <= 4000);
  const insightsValido = !insightsEditavel || insightsInstrucoes.length <= 4000;
  const transcricaoValido = !transcricaoEditavel || transcricaoInstrucoes.length <= 4000;
  const cacValido = !cacEditavel || cacInstrucoes.length <= 4000;
  // NPS: vazio = volta ao padrão do código; senão 10–2000 chars
  const npsValido = !npsEditavel || npsTexto.trim() === "" || mensagemValida(npsTexto.trim());
  const valido =
    intervaloValido && textosValidos && reuniaoValida && emailValido && promptValido &&
    insightsValido && transcricaoValido && cacValido && npsValido;

  const setTexto = (template: MensagemTemplate, campo: keyof MensagemPar, valor: string) => {
    setTextos((prev) => {
      const par = prev[template] ?? { atleta: "", responsavel: "" };
      return { ...prev, [template]: { ...par, [campo]: valor } };
    });
  };

  const salvar = () => {
    // Prompt: grava só OVERRIDES — seção igual ao default do código é enviada
    // vazia (a action a omite; a CF segue no default, que evolui sem congelar)
    let promptOverrides: QualificacaoPromptCfg | undefined;
    if (promptEditavel) {
      promptOverrides = {};
      for (const [chave, valor] of Object.entries(promptSecoes)) {
        const k = chave as keyof QualificacaoPromptCfg;
        const texto = valor.trim();
        (promptOverrides as Record<string, string>)[k] =
          texto && texto !== QUALIFICACAO_PROMPT_DEFAULTS[k] ? texto : "";
      }
    }
    onSave({
      ...(card.intervaloChave
        ? { intervalo: { chave: card.intervaloChave, valor: intervalo } }
        : {}),
      ...(templatesEditaveis.length > 0 ? { textos } : {}),
      ...(reuniao ? { reuniao } : {}),
      ...(togglesEditaveis.length > 0 ? { ativas: toggleValores } : {}),
      ...(emailEditavel ? { emailDestino: emailDestino.trim() } : {}),
      ...(promptOverrides ? { promptCfg: promptOverrides } : {}),
      // Igual ao default → '' (limpa o override; o default do código evolui)
      ...(insightsEditavel
        ? {
            insightsInstrucoes:
              insightsInstrucoes.trim() === INSIGHTS_CONVERSA_INSTRUCOES_DEFAULT.trim()
                ? ""
                : insightsInstrucoes.trim(),
          }
        : {}),
      ...(transcricaoEditavel
        ? {
            transcricaoInstrucoes:
              transcricaoInstrucoes.trim() === TRANSCRICAO_RESUMO_INSTRUCOES_DEFAULT.trim()
                ? ""
                : transcricaoInstrucoes.trim(),
          }
        : {}),
      ...(cacEditavel
        ? {
            cacInstrucoes:
              cacInstrucoes.trim() === CAC_INSIGHTS_INSTRUCOES_DEFAULT.trim()
                ? ""
                : cacInstrucoes.trim(),
          }
        : {}),
      // Igual ao default → '' (limpa o override; o default do código evolui)
      ...(npsEditavel
        ? {
            npsTexto:
              npsTexto.trim() === NPS_MENSAGEM_DEFAULT.trim() ? "" : npsTexto.trim(),
          }
        : {}),
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

          {/* Status (on/off) — persiste em sistema_automacoes_ativas */}
          {togglesEditaveis.length > 0 && (
            <section className="space-y-2">
              <p className={SECTION_LABEL}>Status</p>
              {togglesEditaveis.map((t) => {
                const ligado = toggleValores[t.chave] !== false;
                return (
                  <div key={t.chave} className="space-y-1">
                    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-foreground">
                      <input
                        type="checkbox"
                        checked={ligado}
                        onChange={(e) =>
                          setToggleValores((prev) => ({ ...prev, [t.chave]: e.target.checked }))
                        }
                        className="size-4 accent-primary"
                      />
                      <span className="font-medium">{t.label}</span>
                      <Badge tone={ligado ? "green" : "red"} size="sm">
                        {ligado ? "Ativa" : "Desativada"}
                      </Badge>
                    </label>
                    {!ligado && t.avisoDesligar && (
                      <p className="rounded-md bg-sys-orange/10 px-3 py-2 text-[11px] leading-relaxed text-sys-orange">
                        {t.avisoDesligar}
                      </p>
                    )}
                  </div>
                );
              })}
            </section>
          )}
          {(card.toggles?.length ?? 0) > 0 && !ativas && (
            <p className="rounded-md border border-dashed border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Status indisponível neste ambiente (seed{" "}
              <code className="font-mono">sistema_automacoes_ativas</code> pendente) — a
              automação segue ativa com o comportamento padrão.
            </p>
          )}

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

          {/* E-mail interno (destino editável — email_config) */}
          {emailEditavel && (
            <section className="space-y-1.5">
              <p className={SECTION_LABEL}>Destino do e-mail interno</p>
              <Input
                type="email"
                aria-label="E-mail de destino da notificação interna de novo lead"
                placeholder="Vazio = padrão da função (INTERNAL_EMAIL)"
                value={emailDestino}
                onChange={(e) => setEmailDestino(e.target.value)}
              />
              <p className={cn("text-[11px]", emailValido ? "text-muted-foreground" : "text-sys-red")}>
                {emailValido
                  ? "Recebe a notificação '🎯 Novo Lead' com os dados completos. Vazio volta ao padrão configurado no GCP."
                  : "E-mail inválido."}
              </p>
            </section>
          )}
          {card.editaEmailDestino && !emailCfg && (
            <p className="rounded-md border border-dashed border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Destino indisponível neste ambiente (seed{" "}
              <code className="font-mono">email_config</code> pendente) — envios seguem para o
              padrão da função (INTERNAL_EMAIL).
            </p>
          )}

          {/* Prompt de qualificação (seções editáveis — qualificacao_prompt) */}
          {promptEditavel && (
            <section className="space-y-3">
              <p className={SECTION_LABEL}>Prompt de qualificação (Gemini)</p>
              <p className="rounded-md bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Edite as seções abaixo com cuidado — elas definem QUEM vira QUENTE/MORNO/FRIO
                (e, portanto, quem entra no pipeline e recebe WhatsApp). Os rótulos{" "}
                <code className="font-mono">QUENTE</code>/<code className="font-mono">MORNO</code>/
                <code className="font-mono">FRIO</code> devem continuar presentes nos critérios. No
                critério MORNO, <code className="font-mono">{"{criterio_endereco}"}</code> é
                substituído pela variante BR/internacional. Apagar uma seção volta ao padrão do
                sistema. O formato de saída (JSON) não é editável.
              </p>
              {(Object.keys(QUALIFICACAO_PROMPT_DEFAULTS) as (keyof QualificacaoPromptCfg)[]).map(
                (chave) => {
                  const valor = promptSecoes[chave] ?? "";
                  const ehDefault =
                    valor.trim() === "" || valor.trim() === QUALIFICACAO_PROMPT_DEFAULTS[chave];
                  return (
                    <div key={chave} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor={`prompt-${chave}`}
                          className="text-[11px] font-semibold text-foreground"
                        >
                          {QUALIFICACAO_PROMPT_LABELS[chave]}
                          {!ehDefault && (
                            <Badge tone="blue" size="sm" className="ml-1.5">
                              Personalizada
                            </Badge>
                          )}
                        </label>
                        <span
                          className={cn(
                            "text-[11px] tabular-nums",
                            valor.length > 4000 ? "text-sys-red" : "text-muted-foreground",
                          )}
                        >
                          {valor.length}/4000
                        </span>
                      </div>
                      <textarea
                        id={`prompt-${chave}`}
                        className={cn(FIELD_CLASS, "min-h-24 resize-y font-mono text-[11px] leading-relaxed")}
                        value={valor}
                        onChange={(e) =>
                          setPromptSecoes((prev) => ({ ...prev, [chave]: e.target.value }))
                        }
                      />
                    </div>
                  );
                },
              )}
            </section>
          )}
          {card.editaPrompt && !promptCfg && (
            <p className="rounded-md border border-dashed border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Prompt indisponível neste ambiente (seed{" "}
              <code className="font-mono">qualificacao_prompt</code> pendente) — a qualificação
              segue com o prompt padrão do sistema.
            </p>
          )}

          {/* Instruções do prompt de Insights de Conversa (WhatsApp) */}
          {insightsEditavel && (
            <section className="space-y-2">
              <p className={SECTION_LABEL}>Instruções da análise (Gemini)</p>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="insights-instrucoes"
                  className="text-[11px] font-semibold text-foreground"
                >
                  O que a IA deve avaliar na conversa
                  {insightsInstrucoes.trim() !== INSIGHTS_CONVERSA_INSTRUCOES_DEFAULT.trim() &&
                    insightsInstrucoes.trim() !== "" && (
                      <Badge tone="blue" size="sm" className="ml-1.5">
                        Personalizada
                      </Badge>
                    )}
                </label>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    insightsInstrucoes.length > 4000 ? "text-sys-red" : "text-muted-foreground",
                  )}
                >
                  {insightsInstrucoes.length}/4000
                </span>
              </div>
              <textarea
                id="insights-instrucoes"
                className={cn(FIELD_CLASS, "min-h-40 resize-y font-mono text-[11px] leading-relaxed")}
                value={insightsInstrucoes}
                onChange={(e) => setInsightsInstrucoes(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                O transcript da conversa e o formato de saída (JSON) são fixos — só as instruções
                acima são editáveis. Apagar tudo volta ao padrão do sistema.
              </p>
            </section>
          )}
          {card.editaInsightsPrompt && !insightsCfg && (
            <p className="rounded-md border border-dashed border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Instruções indisponíveis neste ambiente (seed{" "}
              <code className="font-mono">insights_conversa_prompt</code> pendente) — a análise
              segue com as instruções padrão do sistema.
            </p>
          )}

          {/* Instruções do resumo de transcrição (Meet) */}
          {transcricaoEditavel && (
            <InstrucoesIAEditor
              id="transcricao-instrucoes"
              titulo="Instruções do resumo (Gemini)"
              rotulo="Como a IA deve resumir a transcrição"
              valor={transcricaoInstrucoes}
              onChange={setTranscricaoInstrucoes}
              defaultTexto={TRANSCRICAO_RESUMO_INSTRUCOES_DEFAULT}
              rodape="A transcrição e o formato de saída (JSON) são fixos — só as instruções acima são editáveis. Apagar tudo volta ao padrão do sistema. Vale para as próximas capturas (a cada 2h)."
            />
          )}
          {card.editaTranscricaoPrompt && !transcricaoCfg && (
            <p className="rounded-md border border-dashed border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Instruções indisponíveis neste ambiente (seed{" "}
              <code className="font-mono">transcricao_resumo_prompt</code> pendente) — o resumo
              segue com as instruções padrão do sistema.
            </p>
          )}

          {/* Instruções dos insights de CAC */}
          {cacEditavel && (
            <InstrucoesIAEditor
              id="cac-instrucoes"
              titulo="Instruções da análise (Gemini)"
              rotulo="O que a IA deve avaliar nos dados de aquisição"
              valor={cacInstrucoes}
              onChange={setCacInstrucoes}
              defaultTexto={CAC_INSIGHTS_INSTRUCOES_DEFAULT}
              rodape="Os dados (totais, ROI por canal/campanha, tendência) e o formato de saída (JSON) são fixos — só as instruções acima são editáveis. Apagar tudo volta ao padrão do sistema."
            />
          )}
          {card.editaCacPrompt && !cacCfg && (
            <p className="rounded-md border border-dashed border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Instruções indisponíveis neste ambiente (seed{" "}
              <code className="font-mono">cac_insights_prompt</code> pendente) — a análise
              segue com as instruções padrão do sistema.
            </p>
          )}

          {/* Texto do WhatsApp da pesquisa NPS (nps_mensagem) */}
          {npsEditavel && (
            <section className="space-y-2">
              <p className={SECTION_LABEL}>Mensagem — Pesquisa NPS</p>
              <VariaveisLegenda variaveis={NPS_MENSAGEM_VARIAVEIS} />
              <div className="flex items-center justify-between">
                <label htmlFor="nps-texto" className="text-[11px] font-semibold text-foreground">
                  Mensagem para o responsável
                  {npsTexto.trim() !== NPS_MENSAGEM_DEFAULT.trim() && npsTexto.trim() !== "" && (
                    <Badge tone="blue" size="sm" className="ml-1.5">
                      Personalizada
                    </Badge>
                  )}
                </label>
                <span
                  className={cn(
                    "text-[11px] tabular-nums",
                    npsValido ? "text-muted-foreground" : "text-sys-red",
                  )}
                >
                  {npsTexto.length}/{MENSAGEM_MAX_CHARS}
                </span>
              </div>
              <textarea
                id="nps-texto"
                className={cn(FIELD_CLASS, "min-h-32 resize-y leading-relaxed")}
                value={npsTexto}
                onChange={(e) => setNpsTexto(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                A pergunta da nota (0–10) deve permanecer no texto — a resposta chega pelo
                WhatsApp normal. Apagar tudo volta ao padrão do sistema.
              </p>
            </section>
          )}
          {card.editaNpsTexto && !npsCfg && (
            <p className="rounded-md border border-dashed border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              Texto indisponível neste ambiente (seed{" "}
              <code className="font-mono">nps_mensagem</code> pendente) — os envios seguem com
              o texto padrão do sistema.
            </p>
          )}

          {/* Card 100% informativo: nada editável (sem UI falsa) */}
          {!card.intervaloChave &&
            !card.templates?.length &&
            !card.editaReuniao &&
            !card.toggles?.length &&
            !card.editaEmailDestino &&
            !card.editaPrompt &&
            !card.editaInsightsPrompt &&
            !card.editaTranscricaoPrompt &&
            !card.editaCacPrompt &&
            !card.editaNpsTexto && (
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

/** Tom do badge para o status de UMA ação (mais granular que o status do run). */
function acaoStatusTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (/(sucesso|enviad|ok|conclu|criad)/.test(s)) return "green";
  if (/(erro|falh|reject)/.test(s)) return "red";
  if (/(pulad|ignorad|skip|bloque)/.test(s)) return "neutral";
  return "blue";
}

function DetalheLinha({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-28 shrink-0 text-eyebrow text-muted-foreground">{label}</span>
      <span className="min-w-0 text-xs text-foreground/90">{children}</span>
    </div>
  );
}

/** Detalhe expandido de um run: ações (tipo·status·detalhe), motivo, contexto e link ao lead. */
function RunDetalhe({
  run,
  leadNome,
  leadHref,
}: {
  run: AutomacaoRunDetalhado;
  leadNome?: string;
  leadHref: string | null;
}) {
  const resultado = run.resultado as {
    motivo?: string;
    erro?: string;
    acoes?: { tipo: string; status: string; detalhe?: string }[];
  };
  const contexto = run.contexto as {
    atleta_id?: string;
    periodo?: string;
    athlete_name?: string;
  };
  const acoes = Array.isArray(resultado?.acoes) ? resultado.acoes : [];
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
        })
      : "—";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      {/* Ações executadas */}
      <div className="space-y-2">
        <p className="text-eyebrow text-muted-foreground">Ações</p>
        {acoes.length > 0 ? (
          <ul className="space-y-1.5">
            {acoes.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-1.5"
              >
                <Badge tone={acaoStatusTone(a.status)} size="sm">
                  {a.status}
                </Badge>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    {ACAO_CATALOG[a.tipo as AutomacaoAcaoTipo]?.label ?? a.tipo}
                  </p>
                  {a.detalhe && (
                    <p className="text-[11px] leading-relaxed text-muted-foreground break-words">
                      {a.detalhe}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : resultado?.motivo ? (
          <p className="text-xs text-muted-foreground">{resultado.motivo}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Sem ações registradas.</p>
        )}
        {resultado?.erro && (
          <p className="rounded-md border border-sys-red/20 bg-sys-red/5 px-2.5 py-1.5 text-[11px] text-sys-red break-words">
            {resultado.erro}
          </p>
        )}
      </div>

      {/* Contexto + link ao lead */}
      <div className="space-y-1.5">
        <p className="text-eyebrow text-muted-foreground">Contexto</p>
        {leadNome && (
          <DetalheLinha label="Lead">
            {leadHref ? (
              <Link
                href={leadHref}
                className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
              >
                {leadNome}
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            ) : (
              leadNome
            )}
          </DetalheLinha>
        )}
        {run.gatilho_origem_tabela && (
          <DetalheLinha label="Origem">
            <span className="font-mono text-[11px]">
              {run.gatilho_origem_tabela}
              {run.gatilho_origem_id ? ` · ${run.gatilho_origem_id.slice(0, 8)}` : ""}
            </span>
          </DetalheLinha>
        )}
        {contexto?.periodo && (
          <DetalheLinha label="Período">
            <span className="font-mono text-[11px]">{contexto.periodo}</span>
          </DetalheLinha>
        )}
        <DetalheLinha label="Tentativas">{run.tentativas}</DetalheLinha>
        {run.proxima_tentativa_at && (
          <DetalheLinha label="Próx. tentativa">{fmt(run.proxima_tentativa_at)}</DetalheLinha>
        )}
        <DetalheLinha label="Executado">{fmt(run.executado_at)}</DetalheLinha>
        <DetalheLinha label="Run ID">
          <span className="font-mono text-[10px] text-muted-foreground">{run.id.slice(0, 8)}</span>
        </DetalheLinha>
      </div>
    </div>
  );
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

  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set());
  const toggleExpandido = (id: string) =>
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
                  // "sistema" (âncoras nativas) não está no catálogo do builder
                  const gatilho =
                    run.automacoes && run.automacoes.gatilho !== "sistema"
                      ? GATILHO_CATALOG[run.automacoes.gatilho]
                      : null;
                  const contexto = run.contexto as {
                    atleta_id?: string;
                    periodo?: string;
                    athlete_name?: string;
                  };
                  const atletaId = contexto?.atleta_id;
                  // Runs de SISTEMA gravam athlete_name direto no contexto
                  const leadNome =
                    (atletaId ? leadNomes[atletaId] : undefined) ?? contexto?.athlete_name;
                  // Link para os dados do lead: por id (runs custom) ou por
                  // busca de nome (runs de sistema não carregam atleta_id).
                  const leadHref = atletaId
                    ? `/leads?atleta=${atletaId}`
                    : contexto?.athlete_name
                      ? `/leads?q=${encodeURIComponent(contexto.athlete_name)}`
                      : null;
                  const aberto = expandidos.has(run.id);
                  return (
                    <Fragment key={run.id}>
                      <tr
                        className={cn(
                          "border-b border-border transition-colors hover:bg-accent cursor-pointer",
                          aberto && "bg-accent/60",
                        )}
                        onClick={() => toggleExpandido(run.id)}
                      >
                        <td className="py-2.5 pl-4 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                                aberto ? "rotate-0" : "-rotate-90",
                              )}
                            />
                            {new Date(run.created_at).toLocaleString("pt-BR", {
                              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
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
                            leadHref ? (
                              <Link
                                href={leadHref}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                              >
                                {leadNome}
                                <ExternalLink className="h-3 w-3 opacity-60" />
                              </Link>
                            ) : (
                              <p className="text-xs font-medium text-foreground">{leadNome}</p>
                            )
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
                        <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          {/* Runs de SISTEMA não são reprocessáveis (a action
                              também bloqueia server-side) — sem UI falsa. */}
                          {run.status === "erro" && run.automacoes?.gatilho !== "sistema" && (
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
                      {aberto && (
                        <tr className="border-b border-border bg-accent/30">
                          <td colSpan={7} className="px-4 py-3">
                            <RunDetalhe run={run} leadNome={leadNome} leadHref={leadHref} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
