"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Plus,
  Reply,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Card,
  ChartCard,
  ChartTooltip,
  EmptyState,
  PageHeader,
  StatCard,
  type BadgeTone,
} from "@/components/ui";
import { carregarThreadEmail } from "@/lib/actions/emails";
import type { EmailMensagem, EmailMetricas } from "@/lib/emails-queries";
import { formatRelativeTime } from "@/lib/utils";

import { CompositorEmail, type CompositorPrefill } from "./compositor";
import { EmailModal } from "./modal";

type TabId = "caixa" | "enviados" | "metricas";

const REMETENTE = "contato@bolsaatletausa.com";

function pct(v: number | null): string {
  return v == null ? "—" : `${(v * 100).toFixed(0)}%`;
}

/** "2026-08-19" → "19/08" (rótulo curto do eixo). */
function diaLabel(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

/** Prefixo "Re:" sem duplicar (Re: Re: …). */
function assuntoResposta(assunto: string): string {
  return /^re:/i.test(assunto.trim()) ? assunto : `Re: ${assunto}`;
}

/** Chips de status do e-mail enviado, derivados dos timestamps do Resend. */
function statusChips(email: EmailMensagem): Array<{ label: string; tone: BadgeTone }> {
  const chips: Array<{ label: string; tone: BadgeTone }> = [];
  if (email.falhaMotivo) chips.push({ label: "Falha", tone: "red" });
  if (email.bounceAt) chips.push({ label: "Bounce", tone: "red" });
  if (email.reclamadoAt) chips.push({ label: "Reclamado", tone: "red" });
  if (chips.length > 0) return chips;

  // Progressão: mostra o estágio mais avançado alcançado.
  if (email.clicadoAt) return [{ label: "Clicado", tone: "purple" }];
  if (email.abertoAt) return [{ label: "Aberto", tone: "green" }];
  if (email.entregueAt) return [{ label: "Entregue", tone: "blue" }];
  return [{ label: "Enviado", tone: "neutral" }];
}

export function EmailsClient({
  recebidos,
  enviados,
  metricas,
}: {
  recebidos: EmailMensagem[];
  enviados: EmailMensagem[];
  metricas: EmailMetricas;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("caixa");

  // Compositor
  const [compositorAberto, setCompositorAberto] = useState(false);
  const [prefill, setPrefill] = useState<CompositorPrefill | null>(null);

  // Painel de conversa (thread)
  const [threadAberta, setThreadAberta] = useState<EmailMensagem | null>(null);
  const [threadMensagens, setThreadMensagens] = useState<EmailMensagem[]>([]);
  const [carregandoThread, startThread] = useTransition();

  const novoEmail = () => {
    setPrefill(null);
    setCompositorAberto(true);
  };

  const abrirThread = (email: EmailMensagem) => {
    setThreadAberta(email);
    if (!email.gmailThreadId) {
      setThreadMensagens([email]);
      return;
    }
    setThreadMensagens([]);
    const threadId = email.gmailThreadId;
    startThread(async () => {
      const res = await carregarThreadEmail(threadId);
      if (!res.success) {
        toast.error(res.error);
        setThreadMensagens([email]);
        return;
      }
      setThreadMensagens(res.mensagens.length > 0 ? res.mensagens : [email]);
    });
  };

  const responder = (email: EmailMensagem) => {
    // Responde à outra ponta: num recebido, o remetente; num enviado, o destinatário.
    const para = email.direcao === "recebido" ? email.deEmail : email.paraEmail;
    setPrefill({
      para,
      assunto: assuntoResposta(email.assunto),
      formSubmissionId: email.formSubmissionId ?? undefined,
      leadNome: email.leadNome ?? undefined,
    });
    setThreadAberta(null);
    setCompositorAberto(true);
  };

  const tabs = [
    { id: "caixa", label: `Caixa de entrada (${recebidos.length})`, icon: Inbox },
    { id: "enviados", label: `Enviados (${enviados.length})`, icon: Send },
    { id: "metricas", label: "Métricas", icon: BarChart3 },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Comercial"
        title="E-mails"
        description="Caixa de entrada da contato@, envios do compositor e métricas do Resend."
        actions={
          <Button size="sm" onClick={novoEmail}>
            <Plus />
            Novo e-mail
          </Button>
        }
      />

      {/* Abas client-side (mesma tela, sem sub-rotas) */}
      <div
        role="tablist"
        aria-label="Seções do módulo de e-mail"
        className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-1 shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(20px)] [scrollbar-width:none]"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id as TabId)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                active
                  ? "bg-card font-semibold text-bau-blue shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "caixa" && (
        <Card padding="none">
          {recebidos.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Caixa de entrada vazia"
              description="As respostas e mensagens recebidas na contato@ aparecem aqui assim que o sync do Gmail roda."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recebidos.map((email) => (
                <li key={email.id}>
                  <button
                    type="button"
                    onClick={() => abrirThread(email)}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                        {email.deEmail}
                      </span>
                      {email.leadNome && <Badge tone="brand">{email.leadNome}</Badge>}
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(email.mensagemEm)}
                      </span>
                    </span>
                    <span className="truncate text-sm text-foreground">
                      {email.assunto || "(sem assunto)"}
                    </span>
                    {email.snippet && (
                      <span className="truncate text-xs text-muted-foreground">
                        {email.snippet}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "enviados" && (
        <Card padding="none">
          {enviados.length === 0 ? (
            <EmptyState
              icon={Send}
              title="Nenhum e-mail enviado ainda"
              description="Use o botão “Novo e-mail” para enviar o primeiro — ele fica registrado aqui com o status de entrega."
              action={
                <Button size="sm" onClick={novoEmail}>
                  <Plus />
                  Novo e-mail
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {enviados.map((email) => (
                <li key={email.id}>
                  <button
                    type="button"
                    onClick={() => abrirThread(email)}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                        {email.paraEmail}
                      </span>
                      {email.leadNome && <Badge tone="brand">{email.leadNome}</Badge>}
                      {statusChips(email).map((chip) => (
                        <Badge key={chip.label} tone={chip.tone}>
                          {chip.label}
                        </Badge>
                      ))}
                      {email.provider && (
                        <Badge tone="neutral" size="sm">
                          {email.provider}
                        </Badge>
                      )}
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(email.mensagemEm)}
                      </span>
                    </span>
                    <span className="truncate text-sm text-foreground">
                      {email.assunto || "(sem assunto)"}
                    </span>
                    {email.snippet && (
                      <span className="truncate text-xs text-muted-foreground">
                        {email.snippet}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "metricas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              label={`Enviados (${metricas.dias}d)`}
              value={metricas.enviados}
              icon={Send}
              accent="brand"
              context={`${metricas.enviadosResend} via Resend`}
            />
            <StatCard
              label="Entrega"
              value={pct(metricas.taxaEntrega)}
              icon={Mail}
              accent="blue"
              context={`${metricas.entregues} entregues`}
            />
            <StatCard
              label="Abertura"
              value={pct(metricas.taxaAbertura)}
              icon={MailOpen}
              accent="green"
              context={`${metricas.abertos} abertos`}
            />
            <StatCard
              label="Clique"
              value={pct(metricas.taxaClique)}
              icon={BarChart3}
              accent="purple"
              context={`${metricas.clicados} cliques`}
            />
            <StatCard
              label="Bounces"
              value={metricas.bounces}
              icon={Inbox}
              accent="red"
              context={
                metricas.reclamados > 0 ? `${metricas.reclamados} reclamações` : undefined
              }
            />
          </div>

          {metricas.enviados === 0 ? (
            <Card>
              <EmptyState
                icon={BarChart3}
                title="Sem métricas ainda"
                description="As métricas aparecem conforme os e-mails são enviados e os eventos do Resend chegam."
              />
            </Card>
          ) : (
            <>
              <ChartCard
                title="Envios por dia"
                subtitle={`Últimos ${metricas.dias} dias — aberturas atribuídas ao dia do envio`}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={metricas.serie}>
                    <defs>
                      <linearGradient id="emailsEnviados" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="emailsAbertos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                    <XAxis
                      dataKey="dia"
                      tickFormatter={diaLabel}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      minTickGap={24}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                    <Tooltip
                      content={
                        <ChartTooltip
                          labelFormatter={(l) => (typeof l === "string" ? diaLabel(l) : l)}
                        />
                      }
                      cursor={{ stroke: "var(--border)" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="enviados"
                      name="Enviados"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="url(#emailsEnviados)"
                    />
                    <Area
                      type="monotone"
                      dataKey="abertos"
                      name="Abertos"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      fill="url(#emailsAbertos)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <Card>
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Leads mais engajados
                </h3>
                {metricas.topLeads.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma interação registrada ainda — aberturas, cliques e respostas de
                    leads vinculados aparecem aqui.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {metricas.topLeads.map((lead) => (
                      <li
                        key={lead.formSubmissionId}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                      >
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">
                          {lead.leadNome}
                        </span>
                        <span className="ml-auto flex flex-wrap items-center gap-1.5">
                          {lead.aberturas > 0 && (
                            <Badge tone="green" size="sm">
                              {lead.aberturas} abertura{lead.aberturas > 1 ? "s" : ""}
                            </Badge>
                          )}
                          {lead.cliques > 0 && (
                            <Badge tone="purple" size="sm">
                              {lead.cliques} clique{lead.cliques > 1 ? "s" : ""}
                            </Badge>
                          )}
                          {lead.respostas > 0 && (
                            <Badge tone="brand" size="sm">
                              {lead.respostas} resposta{lead.respostas > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* Painel da conversa */}
      <EmailModal
        aberto={threadAberta !== null}
        titulo={threadAberta?.assunto || "(sem assunto)"}
        descricao={
          threadAberta?.leadNome ? `Conversa com ${threadAberta.leadNome}` : undefined
        }
        onFechar={() => setThreadAberta(null)}
        footer={
          threadAberta ? (
            <Button size="sm" onClick={() => responder(threadAberta)}>
              <Reply />
              Responder
            </Button>
          ) : undefined
        }
      >
        {carregandoThread && threadMensagens.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando conversa…
          </div>
        ) : (
          <ul className="space-y-3">
            {threadMensagens.map((msg) => {
              const nossa = msg.deEmail.toLowerCase() === REMETENTE || msg.direcao === "enviado";
              return (
                <li
                  key={msg.id}
                  className={`rounded-xl border p-3 ${
                    nossa
                      ? "border-primary/20 bg-primary/5"
                      : "border-border bg-secondary/50"
                  }`}
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-semibold text-foreground">
                      {nossa ? "Bolsa Atleta USA" : msg.deEmail}
                    </span>
                    <Badge tone={nossa ? "brand" : "neutral"} size="sm">
                      {nossa ? "enviado" : "recebido"}
                    </Badge>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {formatRelativeTime(msg.mensagemEm)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                    {msg.corpoText ?? msg.snippet ?? "(sem conteúdo)"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </EmailModal>

      {/* Compositor — montado só quando aberto (remonta zerado a cada abertura) */}
      {compositorAberto && (
        <CompositorEmail
          prefill={prefill}
          onFechar={() => setCompositorAberto(false)}
          onEnviado={() => router.refresh()}
        />
      )}
    </div>
  );
}
