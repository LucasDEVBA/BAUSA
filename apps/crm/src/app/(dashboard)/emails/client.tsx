"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  ArrowLeft,
  BarChart3,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  Pencil,
  PenLine,
  Plus,
  Reply,
  RotateCw,
  Search,
  Send,
  Shuffle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
} from "@/components/ui";
import {
  assuntoResposta,
  formatarBytes,
  horaEstiloGmail,
  localPart,
  montarThreadContexto,
  statusChips,
} from "@/components/emails/email-status";
import { carregarThreadEmail, paginarEmails } from "@/lib/actions/emails";
import { BUSCA_EMAILS_MIN_CHARS } from "@/lib/emails-queries";
import type {
  EmailDirecao,
  EmailMensagem,
  EmailMetricas,
  EmailRoteamentoRegra,
  EmailsContagens,
  EmailsCursor,
} from "@/lib/emails-queries";
import { cn, formatDateTime, getInitials } from "@/lib/utils";

import { AssinaturasTab } from "./assinaturas";
import { CompositorEmail, type CompositorPrefill } from "./compositor";
import { RoteamentoTab } from "./roteamento";

export type TabId = "caixa" | "enviados" | "metricas" | "roteamento" | "assinaturas";

/** Debounce da busca server-side (guard de sequência contra resposta velha). */
const BUSCA_SERVER_DEBOUNCE_MS = 350;

/** Página carregada de uma lista (caixa/enviados/busca) + cursor da próxima. */
interface ListaPaginada {
  itens: EmailMensagem[];
  /** null = fim da lista. */
  cursor: EmailsCursor | null;
}

/** Acrescenta a página nova sem duplicar ids (defensivo — o keyset já evita). */
function appendSemDuplicar(
  atual: EmailMensagem[],
  novos: EmailMensagem[],
): EmailMensagem[] {
  if (novos.length === 0) return atual;
  const vistos = new Set(atual.map((e) => e.id));
  const extras = novos.filter((e) => !vistos.has(e.id));
  return extras.length > 0 ? [...atual, ...extras] : atual;
}

function pct(v: number | null): string {
  return v == null ? "—" : `${(v * 100).toFixed(0)}%`;
}

/** "2026-08-19" → "19/08" (rótulo curto do eixo). */
function diaLabel(dia: string): string {
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

/** Cores das bolinhas de caixa no rail (convenção de série dos charts). */
const CORES_CAIXA = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const;

// ── Rail esquerdo (estilo Gmail) ─────────────────────────────────────────

function RailItem({
  icon: Icon,
  label,
  ativo,
  onClick,
  contador,
}: {
  icon: LucideIcon;
  label: string;
  ativo: boolean;
  onClick: () => void;
  contador?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      title={label}
      className={cn(
        "flex h-9 w-full items-center justify-center gap-3 rounded-full text-sm transition-colors motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        "lg:justify-start lg:px-4",
        ativo
          ? "bg-primary/10 font-semibold text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="hidden min-w-0 flex-1 truncate text-left lg:block">{label}</span>
      {contador != null && contador > 0 && (
        <span className="hidden shrink-0 text-xs tabular-nums lg:block">{contador}</span>
      )}
    </button>
  );
}

/** Item de caixa (label estilo Gmail): bolinha colorida + parte local da conta. */
function RailCaixa({
  label,
  titulo,
  corClass,
  ativo,
  onClick,
}: {
  label: string;
  titulo: string;
  corClass: string;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      title={titulo}
      className={cn(
        "flex h-8 w-full items-center justify-center gap-3 rounded-full text-sm transition-colors motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        "lg:justify-start lg:px-4",
        ativo
          ? "bg-primary/10 font-semibold text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", corClass)} />
      <span className="hidden min-w-0 flex-1 truncate text-left lg:block">{label}</span>
    </button>
  );
}

// ── Linha da lista (densa, estilo Gmail) ─────────────────────────────────

function LinhaEmail({
  email,
  mostrarCaixa,
  aoAbrir,
}: {
  email: EmailMensagem;
  mostrarCaixa: boolean;
  aoAbrir: (email: EmailMensagem) => void;
}) {
  const ehEnviado = email.direcao === "enviado";
  const remetente = ehEnviado ? `Para: ${email.paraEmail}` : email.deEmail;
  return (
    <li>
      <button
        type="button"
        onClick={() => aoAbrir(email)}
        aria-label={`Abrir conversa: ${email.assunto || "(sem assunto)"}`}
        className={cn(
          "group relative flex w-full items-center gap-3 px-4 py-2.5 text-left",
          "transition-[background-color,box-shadow] motion-reduce:transition-none",
          "hover:z-10 hover:bg-card hover:shadow-xs",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
        )}
      >
        <span className="w-28 shrink-0 truncate text-sm font-medium text-foreground sm:w-40 lg:w-44">
          {remetente}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {email.assunto || "(sem assunto)"}
          {email.snippet && (
            <span className="text-muted-foreground"> — {email.snippet}</span>
          )}
        </span>
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          {email.anexos && email.anexos.length > 0 && (
            <Badge
              tone="neutral"
              size="sm"
              title={email.anexos.map((a) => a.nome).join(", ")}
            >
              <Paperclip aria-hidden className="size-3" />
              <span className="max-w-24 truncate">{email.anexos[0].nome}</span>
              {email.anexos.length > 1 && `+${email.anexos.length - 1}`}
            </Badge>
          )}
          {email.leadNome && (
            <Badge tone="brand" size="sm">
              {email.leadNome}
            </Badge>
          )}
          {mostrarCaixa && email.caixaEmail && (
            <Badge tone="neutral" size="sm">
              {localPart(email.caixaEmail)}
            </Badge>
          )}
          {ehEnviado &&
            statusChips(email).map((chip) => (
              <Badge key={chip.label} tone={chip.tone} size="sm">
                {chip.label}
              </Badge>
            ))}
        </span>
        <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {horaEstiloGmail(email.mensagemEm)}
        </span>
      </button>
    </li>
  );
}

// ── Mensagem da conversa (card colapsável, estilo Gmail) ─────────────────

function MensagemThread({
  msg,
  nossa,
  expandida,
  aoAlternar,
  rodape,
}: {
  msg: EmailMensagem;
  nossa: boolean;
  expandida: boolean;
  aoAlternar: () => void;
  /** Só a última mensagem recebe o rodapé (botão Responder). */
  rodape?: React.ReactNode;
}) {
  const nome = nossa ? "Bolsa Atleta USA" : msg.deEmail;
  return (
    <li className="rounded-xl border border-border bg-card shadow-xs">
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={expandida}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 motion-reduce:transition-none"
      >
        <span
          aria-hidden
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            nossa ? "bg-gradient-brand text-white" : "bg-secondary text-foreground",
          )}
        >
          {getInitials(nome)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 truncate text-sm font-semibold text-foreground">
              {nome}
            </span>
            {expandida &&
              msg.direcao === "enviado" &&
              statusChips(msg).map((chip) => (
                <Badge key={chip.label} tone={chip.tone} size="sm">
                  {chip.label}
                </Badge>
              ))}
            {expandida && msg.direcao === "enviado" && msg.provider && (
              <Badge tone="neutral" size="sm">
                {msg.provider}
              </Badge>
            )}
            <span
              className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground"
              title={formatDateTime(msg.mensagemEm)}
            >
              {horaEstiloGmail(msg.mensagemEm)}
            </span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {expandida ? `para ${msg.paraEmail}` : (msg.snippet ?? msg.corpoText ?? "")}
          </span>
        </span>
      </button>
      {expandida && (
        <div className="px-4 pb-4 lg:pl-[3.75rem]">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {msg.corpoText ?? msg.snippet ?? "(sem conteúdo)"}
          </p>
          {msg.anexos && msg.anexos.length > 0 && (
            <ul aria-label="Anexos da mensagem" className="mt-3 flex flex-wrap gap-1.5">
              {msg.anexos.map((anexo, i) => (
                <li
                  key={`${anexo.nome}-${i}`}
                  className="flex max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-foreground"
                >
                  <Paperclip aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate" title={anexo.nome}>
                    {anexo.nome}
                  </span>
                  {anexo.bytes > 0 && (
                    <span className="shrink-0 text-muted-foreground">
                      {formatarBytes(anexo.bytes)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {rodape}
        </div>
      )}
    </li>
  );
}

// ── Tela ─────────────────────────────────────────────────────────────────

export function EmailsClient({
  recebidos,
  cursorRecebidos,
  enviados,
  cursorEnviados,
  contagens,
  metricas,
  contas,
  caixas,
  padraoEnvio,
  caixaAtiva,
  roteamento,
  assinaturas,
  tabInicial = "caixa",
}: {
  /** 1ª página (server) — as seguintes chegam via paginarEmails no scroll. */
  recebidos: EmailMensagem[];
  cursorRecebidos: EmailsCursor | null;
  enviados: EmailMensagem[];
  cursorEnviados: EmailsCursor | null;
  /** Contagem exata por direção (respeitando o filtro de caixa) — rail. */
  contagens: EmailsContagens;
  metricas: EmailMetricas;
  /** Lista MANUAL (config) — whitelist do De: do compositor. */
  contas: string[];
  /** TODAS as caixas visíveis (manuais ∪ descobertas pelo sync) — rail/filtros. */
  caixas: string[];
  padraoEnvio: string;
  /** Filtro de caixa aplicado server-side (querystring); null = Todas. */
  caixaAtiva: string | null;
  roteamento: EmailRoteamentoRegra[];
  /** Assinatura por conta de envio (config `emails_assinaturas`). */
  assinaturas: Record<string, string>;
  tabInicial?: TabId;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(tabInicial);

  // Listas paginadas por direção — semeadas com a 1ª página vinda do server.
  const [listaRecebidos, setListaRecebidos] = useState<ListaPaginada>({
    itens: recebidos,
    cursor: cursorRecebidos,
  });
  const [listaEnviados, setListaEnviados] = useState<ListaPaginada>({
    itens: enviados,
    cursor: cursorEnviados,
  });

  // Server re-render (troca de caixa, Sincronizar, revalidatePath) entrega
  // props novas — re-seeda a paginação. Padrão oficial de "ajustar estado
  // durante o render" (setState guardado pela comparação com o snapshot
  // anterior, sem effect); appends em voo sobre o seed antigo morrem no CAS
  // de cursor do carregarMais.
  const [seedRecebidos, setSeedRecebidos] = useState(recebidos);
  if (seedRecebidos !== recebidos) {
    setSeedRecebidos(recebidos);
    setListaRecebidos({ itens: recebidos, cursor: cursorRecebidos });
    setListaEnviados({ itens: enviados, cursor: cursorEnviados });
  }

  // Busca SERVER-SIDE (assunto/de/para/snippet) — debounce + guard de sequência.
  const [busca, setBusca] = useState("");
  const [resultadoBusca, setResultadoBusca] = useState<ListaPaginada | null>(null);
  const [buscandoServer, setBuscandoServer] = useState(false);
  const buscaSeq = useRef(0);

  // Compositor (janela flutuante estilo Gmail)
  const [compositorAberto, setCompositorAberto] = useState(false);
  const [prefill, setPrefill] = useState<CompositorPrefill | null>(null);

  // Conversa (substitui a lista na área principal)
  const [threadAberta, setThreadAberta] = useState<EmailMensagem | null>(null);
  const [threadMensagens, setThreadMensagens] = useState<EmailMensagem[]>([]);
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  const [carregandoThread, startThread] = useTransition();

  // Refresh (botão sincronizar) — pendente enquanto o server re-renderiza.
  const [atualizando, startAtualizar] = useTransition();

  // Scroll infinito — sentinela IntersectionObserver no fim da lista.
  const [carregandoMais, startCarregarMais] = useTransition();
  const listaScrollRef = useRef<HTMLUListElement | null>(null);
  const sentinelaRef = useRef<HTMLLIElement | null>(null);
  const carregarMaisRef = useRef<(() => void) | null>(null);

  const novoEmail = () => {
    setPrefill(null);
    setCompositorAberto(true);
  };

  const voltarParaLista = () => {
    setThreadAberta(null);
    setThreadMensagens([]);
  };

  const abrirThread = (email: EmailMensagem) => {
    setThreadAberta(email);
    if (!email.gmailThreadId) {
      setThreadMensagens([email]);
      setExpandidas(new Set([email.id]));
      return;
    }
    setThreadMensagens([]);
    setExpandidas(new Set());
    const threadId = email.gmailThreadId;
    startThread(async () => {
      const res = await carregarThreadEmail(threadId);
      if (!res.success) {
        toast.error(res.error);
        setThreadMensagens([email]);
        setExpandidas(new Set([email.id]));
        return;
      }
      const msgs = res.mensagens.length > 0 ? res.mensagens : [email];
      setThreadMensagens(msgs);
      // Padrão Gmail: só a última mensagem nasce expandida.
      const ultima = msgs[msgs.length - 1];
      setExpandidas(new Set(ultima ? [ultima.id] : []));
    });
  };

  const alternarMensagem = (id: string) => {
    setExpandidas((prev) => {
      const nova = new Set(prev);
      if (nova.has(id)) {
        nova.delete(id);
      } else {
        nova.add(id);
      }
      return nova;
    });
  };

  const responder = (email: EmailMensagem) => {
    // Responde à outra ponta: num recebido, o remetente; num enviado, o destinatário.
    const para = email.direcao === "recebido" ? email.deEmail : email.paraEmail;
    // Contexto p/ "Rascunhar resposta com IA": a thread carregada (ou a própria msg).
    const conversa = threadMensagens.length > 0 ? threadMensagens : [email];
    setPrefill({
      para,
      assunto: assuntoResposta(email.assunto),
      formSubmissionId: email.formSubmissionId ?? undefined,
      leadNome: email.leadNome ?? undefined,
      threadContexto: montarThreadContexto(conversa),
      // Responder pela caixa em que a conversa está (se sincronizada).
      de: email.caixaEmail?.toLowerCase() ?? undefined,
    });
    setCompositorAberto(true);
  };

  /** Zera o resultado da busca (troca de aba/caixa) — o effect refaz sozinho. */
  const zerarBusca = () => {
    if (busca.trim().length >= BUSCA_EMAILS_MIN_CHARS) {
      buscaSeq.current += 1; // invalida resposta em voo
      setResultadoBusca(null);
    }
  };

  /** Troca a seção no rail — client-side (mesma tela), fecha a conversa. */
  const mudarTab = (nova: TabId) => {
    setTab(nova);
    voltarParaLista();
    zerarBusca();
  };

  /** Troca o filtro de caixa — server-side via querystring (mantém a aba). */
  const mudarCaixa = (caixa: string | null) => {
    voltarParaLista();
    zerarBusca();
    const params = new URLSearchParams();
    if (tab !== "caixa") params.set("tab", tab);
    if (caixa) params.set("caixa", caixa);
    const qs = params.toString();
    router.replace(qs ? `/emails?${qs}` : "/emails");
  };

  const atualizar = () => {
    startAtualizar(() => {
      router.refresh();
    });
  };

  /** Abaixo do mínimo volta à lista normal — limpeza no handler, não no effect. */
  const aoDigitarBusca = (valor: string) => {
    setBusca(valor);
    if (valor.trim().length < BUSCA_EMAILS_MIN_CHARS) {
      buscaSeq.current += 1; // invalida busca em voo
      setResultadoBusca(null);
      setBuscandoServer(false);
    }
  };

  const buscaDesabilitada =
    tab === "metricas" || tab === "roteamento" || tab === "assinaturas";
  const termoBusca = busca.trim();
  const buscaServerAtiva =
    !buscaDesabilitada && termoBusca.length >= BUSCA_EMAILS_MIN_CHARS;
  /** Aguardando a PRIMEIRA resposta da busca (nada a exibir ainda). */
  const aguardandoBusca = buscaServerAtiva && resultadoBusca === null;

  const listaBase = tab === "enviados" ? listaEnviados : listaRecebidos;
  const itensVisiveis = buscaServerAtiva ? (resultadoBusca?.itens ?? []) : listaBase.itens;
  const cursorAtual = buscaServerAtiva ? (resultadoBusca?.cursor ?? null) : listaBase.cursor;

  /** Badge da caixa nas linhas — só quando o filtro = Todas (multi-conta). */
  const mostrarCaixaNaLinha = caixaAtiva === null && caixas.length > 1;
  const emConversa = threadAberta !== null && (tab === "caixa" || tab === "enviados");

  /** Próxima página (lista normal OU resultados da busca), com CAS de cursor. */
  const carregarMais = () => {
    if (carregandoMais) return;
    const cursor = cursorAtual;
    if (!cursor) return;
    const emBusca = buscaServerAtiva;
    const aba = tab;
    const direcao: EmailDirecao = aba === "enviados" ? "enviado" : "recebido";
    startCarregarMais(async () => {
      const res = await paginarEmails({
        direcao,
        caixa: caixaAtiva ?? undefined,
        cursor,
        busca: emBusca ? termoBusca : undefined,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      // CAS: só acrescenta se a lista ainda aponta p/ o cursor usado — re-seed
      // do server ou troca de termo no meio do voo descartam o append.
      const aplicar = (prev: ListaPaginada): ListaPaginada =>
        prev.cursor?.id === cursor.id
          ? {
              itens: appendSemDuplicar(prev.itens, res.itens),
              cursor: res.proximoCursor,
            }
          : prev;
      if (emBusca) {
        setResultadoBusca((prev) => (prev ? aplicar(prev) : prev));
      } else if (aba === "enviados") {
        setListaEnviados(aplicar);
      } else {
        setListaRecebidos(aplicar);
      }
    });
  };

  // Referência sempre fresca p/ o IntersectionObserver (closure nunca velha).
  useEffect(() => {
    carregarMaisRef.current = carregarMais;
  });

  // Busca server-side: debounce + guard de sequência (padrão do compositor —
  // resposta velha nunca sobrescreve a mais recente). Deps de aba/caixa
  // refazem a busca quando o contexto muda.
  useEffect(() => {
    if (buscaDesabilitada) return;
    const termo = busca.trim();
    if (termo.length < BUSCA_EMAILS_MIN_CHARS) return;
    const direcao: EmailDirecao = tab === "enviados" ? "enviado" : "recebido";
    const seq = ++buscaSeq.current;
    const timer = setTimeout(() => {
      setBuscandoServer(true);
      void paginarEmails({ direcao, caixa: caixaAtiva ?? undefined, busca: termo })
        .then((res) => {
          if (seq !== buscaSeq.current) return; // resposta velha — descarta
          if (!res.success) {
            toast.error(res.error);
            setResultadoBusca({ itens: [], cursor: null });
            return;
          }
          setResultadoBusca({ itens: res.itens, cursor: res.proximoCursor });
        })
        .catch(() => {
          if (seq === buscaSeq.current) setResultadoBusca({ itens: [], cursor: null });
        })
        .finally(() => {
          if (seq === buscaSeq.current) setBuscandoServer(false);
        });
    }, BUSCA_SERVER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [busca, tab, caixaAtiva, buscaDesabilitada]);

  // Sentinela do scroll infinito. Recriar o observer a cada mudança de
  // contexto/tamanho re-dispara o callback inicial do observe(): se a
  // sentinela continuar visível, carrega a próxima página (auto-preenche
  // telas altas até ela sair da viewport).
  const haMais = cursorAtual !== null;
  const totalVisivel = itensVisiveis.length;
  useEffect(() => {
    if (!haMais || emConversa || aguardandoBusca) return;
    const raiz = listaScrollRef.current;
    const alvo = sentinelaRef.current;
    if (!raiz || !alvo) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) carregarMaisRef.current?.();
      },
      // Raiz = a própria lista rolável; a margem pré-carrega antes do fim.
      { root: raiz, rootMargin: "200px 0px" },
    );
    io.observe(alvo);
    return () => io.disconnect();
  }, [haMais, emConversa, aguardandoBusca, tab, buscaServerAtiva, totalVisivel]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Barra superior: identidade + busca estilo Gmail + sincronizar */}
      <div className="flex flex-wrap items-center gap-3">
        <PageHeader eyebrow="Comercial" title="E-mails" dense className="shrink-0" />
        <div className="relative min-w-0 flex-1 basis-56 md:max-w-xl">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => aoDigitarBusca(e.target.value)}
            disabled={buscaDesabilitada}
            placeholder={
              buscaDesabilitada
                ? "Busca disponível na Caixa de entrada e Enviados"
                : "Buscar e-mails (assunto, remetente ou trecho)"
            }
            aria-label="Buscar e-mails — assunto, remetente, destinatário ou trecho (mínimo 2 caracteres)"
            className={cn(
              "h-10 w-full rounded-full border border-transparent bg-secondary pl-10 pr-4 text-sm text-foreground",
              "outline-none transition-colors placeholder:text-placeholder motion-reduce:transition-none",
              "focus-visible:border-primary/40 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/25",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={atualizar}
          disabled={atualizando}
          aria-label="Sincronizar — recarregar e-mails e métricas"
          title="Sincronizar"
        >
          <RotateCw
            className={atualizando ? "animate-spin motion-reduce:animate-none" : undefined}
          />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        {/* Rail esquerdo — colapsa para ícones abaixo de lg */}
        <aside
          aria-label="Navegação do módulo de e-mail"
          className="flex w-14 shrink-0 flex-col gap-1 lg:w-56"
        >
          <Button
            size="lg"
            onClick={novoEmail}
            aria-label="Escrever novo e-mail"
            title="Escrever"
            className="mb-2 h-11 w-11 self-center rounded-full px-0 shadow-md lg:w-auto lg:self-start lg:px-5"
          >
            <Pencil />
            <span className="hidden lg:inline">Escrever</span>
          </Button>

          <nav aria-label="Seções" className="flex flex-col gap-0.5">
            <RailItem
              icon={Inbox}
              label="Caixa de entrada"
              ativo={tab === "caixa"}
              contador={contagens.recebidos}
              onClick={() => mudarTab("caixa")}
            />
            <RailItem
              icon={Send}
              label="Enviados"
              ativo={tab === "enviados"}
              contador={contagens.enviados}
              onClick={() => mudarTab("enviados")}
            />
            <RailItem
              icon={BarChart3}
              label="Métricas"
              ativo={tab === "metricas"}
              onClick={() => mudarTab("metricas")}
            />
            <RailItem
              icon={Shuffle}
              label="Roteamento"
              ativo={tab === "roteamento"}
              onClick={() => mudarTab("roteamento")}
            />
            <RailItem
              icon={PenLine}
              label="Assinaturas"
              ativo={tab === "assinaturas"}
              onClick={() => mudarTab("assinaturas")}
            />
          </nav>

          {/* Caixas (multi-conta) — como labels do Gmail; filtro server-side */}
          {caixas.length > 1 && (
            <div
              role="group"
              aria-label="Filtrar por caixa"
              className="mt-4 flex flex-col gap-0.5"
            >
              <p className="hidden px-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground lg:block">
                Caixas
              </p>
              <RailCaixa
                label="Todas"
                titulo="Todas as caixas"
                corClass="bg-label-quaternary"
                ativo={caixaAtiva === null}
                onClick={() => mudarCaixa(null)}
              />
              {caixas.map((conta, i) => (
                <RailCaixa
                  key={conta}
                  label={localPart(conta)}
                  titulo={conta}
                  corClass={CORES_CAIXA[i % CORES_CAIXA.length]}
                  ativo={caixaAtiva === conta}
                  onClick={() => mudarCaixa(conta)}
                />
              ))}
            </div>
          )}
        </aside>

        {/* Área principal */}
        <section
          aria-label="Conteúdo do módulo de e-mail"
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
          {emConversa && threadAberta ? (
            /* Vista de conversa (substitui a lista) */
            <Card padding="none" className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={voltarParaLista}
                  aria-label="Voltar para a lista"
                >
                  <ArrowLeft />
                </Button>
                <h2 className="min-w-0 truncate text-base font-semibold text-foreground">
                  {threadAberta.assunto || "(sem assunto)"}
                </h2>
                {threadAberta.leadNome && (
                  <Badge tone="brand">{threadAberta.leadNome}</Badge>
                )}
                {caixas.length > 1 && threadAberta.caixaEmail && (
                  <Badge tone="neutral" size="sm">
                    {localPart(threadAberta.caixaEmail)}
                  </Badge>
                )}
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {carregandoThread && threadMensagens.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                    Carregando conversa…
                  </div>
                ) : (
                  <ol className="space-y-2">
                    {threadMensagens.map((msg, i) => {
                      const nossa =
                        msg.direcao === "enviado" ||
                        caixas.includes(msg.deEmail.toLowerCase());
                      const ehUltima = i === threadMensagens.length - 1;
                      return (
                        <MensagemThread
                          key={msg.id}
                          msg={msg}
                          nossa={nossa}
                          expandida={expandidas.has(msg.id)}
                          aoAlternar={() => alternarMensagem(msg.id)}
                          rodape={
                            ehUltima ? (
                              <div className="mt-3">
                                <Button size="sm" onClick={() => responder(threadAberta)}>
                                  <Reply />
                                  Responder
                                </Button>
                              </div>
                            ) : undefined
                          }
                        />
                      );
                    })}
                  </ol>
                )}
              </div>
            </Card>
          ) : tab === "caixa" || tab === "enviados" ? (
            /* Lista estilo Gmail (paginada por cursor; busca server-side) */
            <Card padding="none" className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {buscaServerAtiva && (
                <p
                  role="status"
                  className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground"
                >
                  {buscandoServer && (
                    <Loader2
                      aria-hidden
                      className="size-3 shrink-0 animate-spin motion-reduce:animate-none"
                    />
                  )}
                  {aguardandoBusca
                    ? "Buscando…"
                    : `${itensVisiveis.length} resultado${itensVisiveis.length === 1 ? "" : "s"} carregado${itensVisiveis.length === 1 ? "" : "s"}${cursorAtual ? " — role para carregar mais" : ""}`}
                </p>
              )}
              {aguardandoBusca ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  Buscando e-mails…
                </div>
              ) : itensVisiveis.length === 0 ? (
                buscaServerAtiva ? (
                  <EmptyState
                    icon={Search}
                    title="Nada encontrado"
                    description={`Nenhum e-mail corresponde a “${termoBusca}”.`}
                  />
                ) : tab === "caixa" ? (
                  <EmptyState
                    icon={Inbox}
                    title="Caixa de entrada vazia"
                    description="As respostas e mensagens recebidas aparecem aqui assim que o sync do Gmail roda."
                  />
                ) : (
                  <EmptyState
                    icon={Send}
                    title="Nenhum e-mail enviado ainda"
                    description="Use o botão “Escrever” para enviar o primeiro — ele fica registrado aqui com o status de entrega."
                    action={
                      <Button size="sm" onClick={novoEmail}>
                        <Plus />
                        Novo e-mail
                      </Button>
                    }
                  />
                )
              ) : (
                <ul
                  ref={listaScrollRef}
                  role="list"
                  className="min-h-0 flex-1 divide-y divide-border overflow-y-auto"
                >
                  {itensVisiveis.map((email) => (
                    <LinhaEmail
                      key={email.id}
                      email={email}
                      mostrarCaixa={mostrarCaixaNaLinha}
                      aoAbrir={abrirThread}
                    />
                  ))}
                  {cursorAtual && (
                    /* Sentinela do infinite scroll — o IO carrega a próxima página */
                    <li
                      ref={sentinelaRef}
                      className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground"
                    >
                      <Loader2
                        aria-hidden
                        className="size-3.5 animate-spin motion-reduce:animate-none"
                      />
                      Carregando mais…
                    </li>
                  )}
                </ul>
              )}
            </Card>
          ) : tab === "metricas" ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-1">
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
                    metricas.reclamados > 0
                      ? `${metricas.reclamados} reclamações`
                      : undefined
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
                    subtitle={`Últimos ${metricas.dias} dias — aberturas atribuídas ao dia do envio${
                      caixaAtiva ? ` — caixa ${localPart(caixaAtiva)}` : ""
                    }`}
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
          ) : tab === "roteamento" ? (
            <div className="min-h-0 flex-1 overflow-y-auto pb-1">
              <RoteamentoTab contas={caixas} regras={roteamento} />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pb-1">
              <AssinaturasTab contas={contas} assinaturas={assinaturas} />
            </div>
          )}
        </section>
      </div>

      {/* Compositor flutuante — montado só quando aberto (remonta zerado) */}
      {compositorAberto && (
        <CompositorEmail
          prefill={prefill}
          contas={contas}
          padraoEnvio={padraoEnvio}
          assinaturas={assinaturas}
          onFechar={() => setCompositorAberto(false)}
          onEnviado={() => router.refresh()}
        />
      )}
    </div>
  );
}
