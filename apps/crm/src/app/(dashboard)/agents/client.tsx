"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Bot,
  MessageCircle,
  Users,
  Sparkles,
  GraduationCap,
  FileText,
  BarChart3,
  Star,
  MessageSquareText,
  Workflow,
  ExternalLink,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, Card, Button, Badge, EmptyState } from "@/components/ui";
import { InstrucoesIAEditor } from "@/components/agents/InstrucoesIAEditor";
import { FIELD_CLASS, contarPassosIA } from "@/components/automacoes/builder-shared";
import { CHATBOT_PERSONA_DEFAULT } from "@/lib/automacoes/chatbot-persona";
import { INSIGHTS_CONVERSA_INSTRUCOES_DEFAULT } from "@/lib/automacoes/insights-conversa-prompt";
import { TRANSCRICAO_RESUMO_INSTRUCOES_DEFAULT } from "@/lib/automacoes/transcricao-resumo-prompt";
import { CAC_INSIGHTS_INSTRUCOES_DEFAULT } from "@/lib/automacoes/cac-insights-prompt";
import { atualizarPersonasChatbot } from "@/lib/actions/chatbot-agents";
import { atualizarInsightsConversaPrompt } from "@/lib/actions/whatsapp-insights";
import { atualizarInstrucoesIA } from "@/lib/actions/prompts-ia";
import { GATILHO_CATALOG, type AutomacaoAcao, type AutomacaoComStats } from "@/types/automacao";
import { cn, formatRelativeTime } from "@/lib/utils";

// ════════════════════════════════════════════════════════════════════════
// Hub /agents — famílias de agents de IA do BAU Engine (CEO-only).
//   1. Copilotos de conversa  → personas editáveis (1:1 + grupo)
//   2. Agents de sistema      → prompts de IA das automações nativas
//   3. Agents de automação    → automações do builder que usam IA
// INVARIANTE: a IA SUGERE/ANALISA; o humano revisa e envia. Nunca envia sozinha.
// ════════════════════════════════════════════════════════════════════════

const PERSONA_MAX = 4000;

export type SistemaPromptChave =
  | "insights_conversa_prompt"
  | "transcricao_resumo_prompt"
  | "cac_insights_prompt";

interface PromptOverride {
  seeded: boolean;
  override: string;
}

interface AgentsClientProps {
  personaSeeded: boolean;
  personaAtual: string;
  personaGrupoAtual: string;
  insightsPrompt: PromptOverride;
  transcricaoPrompt: PromptOverride;
  cacPrompt: PromptOverride;
  qualificacaoCustom: boolean;
  npsCustom: boolean;
  automacoesIA: AutomacaoComStats[];
}

/** Aviso reutilizável quando o seed da config ainda não existe no ambiente. */
function SeedPendenteNota({ chave }: { chave: string }) {
  return (
    <p className="rounded-md border border-dashed border-border bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      Edição indisponível neste ambiente (seed <code className="font-mono">{chave}</code> pendente) —
      a IA segue com o texto padrão do sistema.
    </p>
  );
}

// ─── 1. Copiloto de conversa (persona editável) ──────────────────────────

function PersonaCard({
  icon: Icon,
  titulo,
  descricao,
  campo,
  valorAtual,
  seeded,
}: {
  icon: LucideIcon;
  titulo: string;
  descricao: string;
  campo: "persona" | "personaGrupo";
  valorAtual: string;
  seeded: boolean;
}) {
  const [texto, setTexto] = useState(valorAtual);
  const [isPending, startTransition] = useTransition();
  const excedeu = texto.length > PERSONA_MAX;
  const personalizada = texto.trim().length > 0;

  const persistir = (valor: string, ok: string) => {
    startTransition(() => {
      void atualizarPersonasChatbot({ [campo]: valor })
        .then((r) => {
          if (!r.success) {
            toast.error(r.error ?? "Não foi possível salvar a persona.");
            return;
          }
          toast.success(ok);
        })
        .catch(() => toast.error("Erro inesperado ao salvar a persona."));
    });
  };

  return (
    <Card accent="brand" className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
            {personalizada && (
              <Badge tone="blue" size="sm">
                Personalizada
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{descricao}</p>
        </div>
      </div>

      {seeded ? (
        <>
          <div className="flex items-center justify-between">
            <label
              htmlFor={`persona-${campo}`}
              className="text-[11px] font-semibold text-foreground"
            >
              Persona (tom + identidade)
            </label>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                excedeu ? "text-sys-red" : "text-muted-foreground",
              )}
            >
              {texto.length}/{PERSONA_MAX}
            </span>
          </div>
          <textarea
            id={`persona-${campo}`}
            className={cn(FIELD_CLASS, "min-h-40 resize-y leading-relaxed")}
            value={texto}
            placeholder={CHATBOT_PERSONA_DEFAULT}
            onChange={(e) => setTexto(e.target.value)}
          />
          <details className="text-[11px] text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium hover:text-foreground">
              Ver a persona padrão do sistema
            </summary>
            <p className="mt-1.5 whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-2 leading-relaxed">
              {CHATBOT_PERSONA_DEFAULT}
            </p>
          </details>
          <p className="flex items-center gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-primary" />A IA sugere; você
            revisa e envia. Ela nunca envia sozinha.
          </p>
          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending || texto.trim() === ""}
              onClick={() => {
                setTexto("");
                persistir("", "Persona restaurada para o padrão.");
              }}
            >
              <RotateCcw />
              Restaurar padrão
            </Button>
            <Button
              size="sm"
              disabled={isPending || excedeu}
              onClick={() => persistir(texto, "Persona salva.")}
            >
              Salvar
            </Button>
          </div>
        </>
      ) : (
        <SeedPendenteNota chave="chatbot_persona" />
      )}
    </Card>
  );
}

// ─── 2. Agents de sistema (prompt editável inline) ───────────────────────

function SistemaPromptCard({
  icon: Icon,
  chave,
  titulo,
  rotulo,
  descricao,
  defaultTexto,
  rodape,
  seeded,
  override,
}: {
  icon: LucideIcon;
  chave: SistemaPromptChave;
  titulo: string;
  rotulo: string;
  descricao: string;
  defaultTexto: string;
  rodape: string;
  seeded: boolean;
  override: string;
}) {
  const [texto, setTexto] = useState(seeded ? override || defaultTexto : "");
  const [isPending, startTransition] = useTransition();
  const excedeu = texto.length > 4000;

  const salvarInstrucoes = (instrucoes: string) => {
    return chave === "insights_conversa_prompt"
      ? atualizarInsightsConversaPrompt({ instrucoes })
      : atualizarInstrucoesIA({ chave, instrucoes });
  };

  const persistir = (valor: string, ok: string) => {
    // Igual ao default → grava vazio (remove o override; fail-open ao default).
    const payload = valor.trim() === defaultTexto.trim() ? "" : valor.trim();
    startTransition(() => {
      void salvarInstrucoes(payload)
        .then((r) => {
          if (!r.success) {
            toast.error(r.error ?? "Não foi possível salvar as instruções.");
            return;
          }
          toast.success(ok);
        })
        .catch(() => toast.error("Erro inesperado ao salvar as instruções."));
    });
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sys-purple/12 text-sys-purple">
          <Icon aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{descricao}</p>
        </div>
      </div>

      {seeded ? (
        <>
          <InstrucoesIAEditor
            id={`sistema-${chave}`}
            titulo="Instruções (Gemini)"
            rotulo={rotulo}
            valor={texto}
            onChange={setTexto}
            defaultTexto={defaultTexto}
            rodape={rodape}
          />
          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending || texto.trim() === defaultTexto.trim()}
              onClick={() => {
                setTexto(defaultTexto);
                persistir(defaultTexto, "Instruções restauradas para o padrão.");
              }}
            >
              <RotateCcw />
              Restaurar padrão
            </Button>
            <Button
              size="sm"
              disabled={isPending || excedeu}
              onClick={() => persistir(texto, "Instruções salvas.")}
            >
              Salvar
            </Button>
          </div>
        </>
      ) : (
        <SeedPendenteNota chave={chave} />
      )}
    </Card>
  );
}

/** Prompt com editor especializado que mora em /automacoes (não duplicamos aqui). */
function SistemaLinkCard({
  icon: Icon,
  titulo,
  descricao,
  custom,
}: {
  icon: LucideIcon;
  titulo: string;
  descricao: string;
  custom: boolean;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sys-purple/12 text-sys-purple">
          <Icon aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
            {custom && (
              <Badge tone="blue" size="sm">
                Personalizada
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{descricao}</p>
        </div>
      </div>
      <div className="flex items-center justify-end border-t border-border pt-3">
        <Button variant="secondary" size="sm" asChild>
          <Link href="/automacoes">
            Editar em Automações
            <ExternalLink />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

// ─── 3. Agent de automação (usa IA) ──────────────────────────────────────

/** Quantos passos/ações usam a IA (ia_condicao + ia_prompt em passos ou fluxo simples). */
function contarUsosIA(a: AutomacaoComStats): number {
  const nosPassos = contarPassosIA(a.passos ?? []);
  const nasAcoes = (a.acoes ?? []).filter((ac: AutomacaoAcao) => ac.tipo === "ia_prompt").length;
  return nosPassos + nasAcoes;
}

function AutomacaoIACard({ automacao }: { automacao: AutomacaoComStats }) {
  const usosIA = contarUsosIA(automacao);
  const gatilhoLabel = GATILHO_CATALOG[automacao.gatilho]?.label ?? automacao.gatilho;

  return (
    <Card accent={automacao.ativo ? "brand" : "neutral"} className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Workflow aria-hidden className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground" title={automacao.nome}>
            {automacao.nome}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">Quando: {gatilhoLabel}</p>
        </div>
        <Badge tone={automacao.ativo ? "green" : "neutral"} size="sm">
          {automacao.ativo ? "Ativa" : "Pausada"}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="purple" size="sm">
          <Sparkles aria-hidden className="size-3" />
          {usosIA} {usosIA === 1 ? "passo de IA" : "passos de IA"}
        </Badge>
        <Badge tone="green" size="sm">
          <CheckCircle2 aria-hidden className="size-3" />
          {automacao.runs_sucesso}
        </Badge>
        {automacao.runs_erro > 0 && (
          <Badge tone="red" size="sm">
            <AlertTriangle aria-hidden className="size-3" />
            {automacao.runs_erro}
          </Badge>
        )}
        <span className="text-[11px] text-muted-foreground">{automacao.runs_total} execuções</span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock aria-hidden className="size-3" />
          {automacao.ultimo_run_at
            ? `há ${formatRelativeTime(automacao.ultimo_run_at)}`
            : "sem execuções"}
        </span>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/automacoes">
            Abrir no builder
            <ExternalLink />
          </Link>
        </Button>
      </div>
    </Card>
  );
}

// ─── Título de seção ─────────────────────────────────────────────────────

function SecaoTitulo({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-eyebrow text-label-tertiary">{titulo}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

// ─── Hub ─────────────────────────────────────────────────────────────────

export function AgentsClient({
  personaSeeded,
  personaAtual,
  personaGrupoAtual,
  insightsPrompt,
  transcricaoPrompt,
  cacPrompt,
  qualificacaoCustom,
  npsCustom,
  automacoesIA,
}: AgentsClientProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Agents de IA"
        description="Onde a IA do BAU Engine trabalha — copilotos de conversa, prompts das automações nativas e agents do builder. A IA sugere e analisa; você revisa e envia. Ela nunca envia sozinha."
      />

      {/* 1. Copilotos de conversa */}
      <section className="space-y-3">
        <SecaoTitulo
          titulo="Copilotos de conversa"
          sub="A persona que a IA usa para SUGERIR respostas no WhatsApp (1:1 e grupo). Você revisa antes de enviar."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PersonaCard
            icon={MessageCircle}
            titulo="Copiloto de Conversa (1:1)"
            descricao="Sugere respostas nas conversas 1:1 do espelho de WhatsApp."
            campo="persona"
            valorAtual={personaAtual}
            seeded={personaSeeded}
          />
          <PersonaCard
            icon={Users}
            titulo="Copiloto de Grupo"
            descricao="Sugere respostas nos grupos das famílias (fallback → persona 1:1 → padrão)."
            campo="personaGrupo"
            valorAtual={personaGrupoAtual}
            seeded={personaSeeded}
          />
        </div>
      </section>

      {/* 2. Agents de sistema */}
      <section className="space-y-3">
        <SecaoTitulo
          titulo="Agents de sistema"
          sub="Instruções dos prompts de IA das automações nativas. Apagar tudo volta ao padrão do código (fail-open)."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SistemaPromptCard
            icon={MessageSquareText}
            chave="insights_conversa_prompt"
            titulo="Insights de conversa"
            rotulo="O que a IA deve diagnosticar na conversa"
            descricao="Diagnóstico comercial das conversas de WhatsApp (1:1 e grupo), sob demanda."
            defaultTexto={INSIGHTS_CONVERSA_INSTRUCOES_DEFAULT}
            rodape="O transcript e o formato de saída (JSON) são fixos — só as instruções acima são editáveis. Apagar tudo volta ao padrão do sistema."
            seeded={insightsPrompt.seeded}
            override={insightsPrompt.override}
          />
          <SistemaPromptCard
            icon={FileText}
            chave="transcricao_resumo_prompt"
            titulo="Resumo de reunião"
            rotulo="Como a IA deve resumir a transcrição"
            descricao="Resumo automático das transcrições do Google Meet anexadas aos deals."
            defaultTexto={TRANSCRICAO_RESUMO_INSTRUCOES_DEFAULT}
            rodape="A transcrição e o formato de saída (JSON) são fixos — só as instruções acima são editáveis. Apagar tudo volta ao padrão do sistema."
            seeded={transcricaoPrompt.seeded}
            override={transcricaoPrompt.override}
          />
          <SistemaPromptCard
            icon={BarChart3}
            chave="cac_insights_prompt"
            titulo="Insights de CAC"
            rotulo="O que a IA deve avaliar nos dados de aquisição"
            descricao="Análise dos dados de custo de aquisição (CAC/ROI), sob demanda."
            defaultTexto={CAC_INSIGHTS_INSTRUCOES_DEFAULT}
            rodape="Os dados (totais, ROI por canal/campanha, tendência) e o formato de saída (JSON) são fixos — só as instruções acima são editáveis. Apagar tudo volta ao padrão do sistema."
            seeded={cacPrompt.seeded}
            override={cacPrompt.override}
          />
          <SistemaLinkCard
            icon={GraduationCap}
            titulo="Qualificação de leads"
            descricao="Prompt multi-seção que classifica cada lead (QUENTE/MORNO/FRIO). Editor dedicado em Automações."
            custom={qualificacaoCustom}
          />
          <SistemaLinkCard
            icon={Star}
            titulo="Mensagem de NPS"
            descricao="Texto do WhatsApp da pesquisa de satisfação. Editor dedicado em Automações."
            custom={npsCustom}
          />
        </div>
      </section>

      {/* 3. Agents de automação */}
      <section className="space-y-3">
        <SecaoTitulo
          titulo="Agents de automação"
          sub="Automações do builder que usam IA (condição ou ação). O builder mora em Automações."
        />
        {automacoesIA.length === 0 ? (
          <Card>
            <EmptyState
              icon={Bot}
              title="Nenhum agent de automação com IA"
              description="Crie uma automação com condição ou ação de IA no builder para ela aparecer aqui."
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/automacoes">
                    Abrir Automações
                    <ExternalLink />
                  </Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {automacoesIA.map((a) => (
              <AutomacaoIACard key={a.id} automacao={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
