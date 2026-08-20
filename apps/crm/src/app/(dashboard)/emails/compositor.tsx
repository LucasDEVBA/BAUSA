"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link2, Loader2, Paperclip, Send, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Input } from "@/components/ui";
import { formatarBytes } from "@/components/emails/email-status";
import {
  buscarLeadsEmail,
  enviarEmail,
  rascunharEmailIA,
  type LeadBusca,
} from "@/lib/actions/emails";
import { sanitizarHtmlAssinatura } from "@/lib/email-assinatura-sanitize";
import type { EmailAssinatura } from "@/lib/emails-queries";

/** Pré-preenchimento (fluxo "Responder" da caixa de entrada / aba do lead). */
export interface CompositorPrefill {
  para?: string;
  assunto?: string;
  formSubmissionId?: string;
  leadNome?: string;
  /**
   * Modo resposta: últimas mensagens da conversa (montadas pelo caller via
   * montarThreadContexto) — a IA responde à conversa mesmo sem instrução.
   */
  threadContexto?: string;
  /** Caixa preferida como "De:" (ex.: responder pela caixa que recebeu). */
  de?: string;
}

const BUSCA_DEBOUNCE_MS = 300;
const BUSCA_MIN_CHARS = 2;

/** Instrução mínima p/ a IA (espelha o Zod da action). */
const PROMPT_IA_MIN_CHARS = 5;
const PROMPT_IA_MAX_CHARS = 2000;

// Anexos — mesmos tetos da server action e da CF send-messages.
const ANEXOS_MAX = 5;
const ANEXOS_BYTES_MAX = 8 * 1024 * 1024;
const ANEXO_NOME_MAX = 120;

const TONS = [
  { value: "", label: "Consultivo premium (padrão)" },
  { value: "mais direto e objetivo", label: "Direto e objetivo" },
  { value: "mais caloroso e próximo", label: "Caloroso e próximo" },
  { value: "formal e institucional", label: "Formal e institucional" },
] as const;

type TamanhoIA = "" | "curto" | "medio" | "longo";

const TAMANHOS: Array<{ value: TamanhoIA; label: string }> = [
  { value: "", label: "Tamanho padrão" },
  { value: "curto", label: "Curto" },
  { value: "medio", label: "Médio" },
  { value: "longo", label: "Longo" },
];

/** Refinos de 1 clique — a instrução vai como prompt junto do rascunho atual. */
const REFINOS = [
  {
    label: "Mais curto",
    instrucao:
      "Reescreva o rascunho mais curto e direto, cortando redundâncias sem perder o essencial.",
  },
  {
    label: "Mais formal",
    instrucao:
      "Reescreva o rascunho com tom mais formal e institucional, mantendo o conteúdo e a intenção.",
  },
  {
    label: "Mais caloroso",
    instrucao:
      "Reescreva o rascunho com tom mais caloroso e próximo, mantendo o conteúdo e a intenção.",
  },
  {
    label: "Reescrever",
    instrucao:
      "Reescreva o rascunho por completo com outra abordagem, mantendo o objetivo e os fatos.",
  },
] as const;

const SELECT_CLS =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25";

const TEXTAREA_IA_CLS =
  "min-h-16 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-placeholder focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 motion-reduce:transition-none";

/** Assinatura padrão da conta ("" = nenhuma configurada). */
function assinaturaPadraoDe(
  assinaturas: Record<string, EmailAssinatura[]> | undefined,
  conta: string,
): string {
  const lista = assinaturas?.[conta] ?? [];
  return (lista.find((a) => a.padrao) ?? lista[0])?.id ?? "";
}

/** File → base64 puro (sem o prefixo data:) via FileReader. */
function lerArquivoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultado = reader.result;
      if (typeof resultado !== "string") {
        reject(new Error("Leitura do arquivo devolveu formato inesperado."));
        return;
      }
      const virgula = resultado.indexOf(",");
      resolve(virgula >= 0 ? resultado.slice(virgula + 1) : resultado);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(arquivo);
  });
}

interface AnexoLocal {
  nome: string;
  tipo?: string;
  bytes: number;
  base64: string;
}

/** Campo rotulado (bloco de IA / link CTA) — moldura padrão do Engine. */
function CampoEmail({
  label,
  ajuda,
  children,
  className,
}: {
  label: string;
  ajuda?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {ajuda && <span className="block text-[11px] text-label-tertiary">{ajuda}</span>}
    </label>
  );
}

/** Linha de campo estilo Gmail: rótulo curto + controle com underline sutil. */
function LinhaCampo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-border py-1">
      <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const CAMPO_INLINE_CLS =
  "h-8 w-full bg-transparent px-0 text-sm text-foreground outline-none placeholder:text-placeholder";

/**
 * Compositor — janela flutuante estilo Gmail, ancorada no canto inferior
 * direito (fullscreen em mobile), via portal p/ document.body (escapa de
 * qualquer containing block com backdrop-filter e flutua sobre os modais de
 * lead/deal). Renderizar SÓ quando aberto ({aberto && <CompositorEmail/>}):
 * cada abertura remonta o componente, então o estado inicial vem direto do
 * prefill (sem effect de reset — exigência do react-hooks/set-state-in-effect).
 *
 * Assinatura (v2 rica): o seletor escolhe QUAL assinatura da conta do "De:"
 * vai NESTE envio (padrão pré-selecionada); o preview renderizado aparece
 * abaixo do corpo. O envio manda só o `assinaturaId` — o HTML é resolvido
 * no servidor (nunca sai do client).
 */
export function CompositorEmail({
  prefill,
  contas,
  padraoEnvio,
  assinaturas,
  onFechar,
  onEnviado,
}: {
  prefill?: CompositorPrefill | null;
  /** Contas de `emails_contas` (query server-side, via props). */
  contas: string[];
  /** Conta pré-selecionada no "De:" (padrao_envio da config). */
  padraoEnvio: string;
  /** Assinaturas ricas por conta (config `emails_assinaturas`) — opcional. */
  assinaturas?: Record<string, EmailAssinatura[]>;
  onFechar: () => void;
  onEnviado: () => void;
}) {
  const deInicial =
    prefill?.de && contas.includes(prefill.de)
      ? prefill.de
      : contas.includes(padraoEnvio)
        ? padraoEnvio
        : (contas[0] ?? padraoEnvio);

  const [de, setDe] = useState(deInicial);
  const [para, setPara] = useState(prefill?.para ?? "");
  const [assunto, setAssunto] = useState(prefill?.assunto ?? "");
  // Assinatura escolhida p/ ESTE envio ("" = sem assinatura).
  const [assinaturaId, setAssinaturaId] = useState(() =>
    assinaturaPadraoDe(assinaturas, deInicial),
  );
  const [corpo, setCorpo] = useState("");
  const [leadVinculado, setLeadVinculado] = useState<{ id: string; nome: string } | null>(
    prefill?.formSubmissionId
      ? { id: prefill.formSubmissionId, nome: prefill.leadNome ?? "Lead" }
      : null,
  );
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [mostrarLink, setMostrarLink] = useState(false);

  // Anexos (máx 5, 8MB somados — validação clara ANTES de subir)
  const [anexos, setAnexos] = useState<AnexoLocal[]>([]);
  const [anexando, setAnexando] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);

  // Autocomplete de lead
  const [sugestoes, setSugestoes] = useState<LeadBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const buscaSeq = useRef(0);

  // IA — prompt livre + tom/tamanho + refinos de 1 clique
  const [promptIa, setPromptIa] = useState("");
  const [tom, setTom] = useState<string>("");
  const [tamanho, setTamanho] = useState<TamanhoIA>("");
  const [iaAviso, setIaAviso] = useState<string | null>(null);
  const [rascunhando, startRascunho] = useTransition();

  const [enviando, startEnvio] = useTransition();

  // Esc fecha SÓ o compositor. Capture + stopPropagation: quando aberto DENTRO
  // de outro modal (aba E-mails do detalhe do lead/deal), o listener do modal
  // pai fecharia os dois (padrão herdado do EmailModal/MensagemDiretaComposer).
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onFechar();
    };
    document.addEventListener("keydown", aoTeclar, true);
    return () => document.removeEventListener("keydown", aoTeclar, true);
  }, [onFechar]);

  // Busca de lead com debounce — só quando digitando livre (sem lead vinculado).
  // Com "@" o CEO está digitando um e-mail livre — não atrapalhar. A limpeza
  // das sugestões acontece nos handlers (aoDigitarPara/escolherLead), nunca
  // sincronamente no corpo do effect.
  useEffect(() => {
    const termo = para.trim();
    const deveBuscar =
      !leadVinculado && termo.length >= BUSCA_MIN_CHARS && !termo.includes("@");
    if (!deveBuscar) return;

    const seq = ++buscaSeq.current;
    const timer = setTimeout(() => {
      setBuscando(true);
      void buscarLeadsEmail(termo)
        .then((res) => {
          if (seq !== buscaSeq.current) return; // resposta velha — descarta
          setSugestoes(res.success ? res.leads : []);
        })
        .catch(() => {
          if (seq === buscaSeq.current) setSugestoes([]);
        })
        .finally(() => {
          if (seq === buscaSeq.current) setBuscando(false);
        });
    }, BUSCA_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [para, leadVinculado]);

  const aoDigitarPara = (valor: string) => {
    setPara(valor);
    const termo = valor.trim();
    if (termo.length < BUSCA_MIN_CHARS || termo.includes("@")) {
      buscaSeq.current += 1; // invalida busca em voo
      setSugestoes([]);
      setBuscando(false);
    }
  };

  const escolherLead = (lead: LeadBusca) => {
    if (!lead.email) {
      toast.error(`${lead.nome} não tem e-mail cadastrado.`);
      return;
    }
    buscaSeq.current += 1; // invalida busca em voo
    setLeadVinculado({ id: lead.id, nome: lead.nome });
    setPara(lead.email);
    setSugestoes([]);
    setBuscando(false);
  };

  const desvincularLead = () => {
    setLeadVinculado(null);
    setPara("");
    setSugestoes([]);
  };

  const modoResposta = Boolean(prefill?.threadContexto);
  const titulo = modoResposta ? "Responder e-mail" : "Nova mensagem";

  // ── Assinatura (v2 — seletor por envio + preview renderizado) ──────────
  const assinaturasContaAtual = assinaturas?.[de] ?? [];
  const assinaturaAtual = assinaturasContaAtual.find((a) => a.id === assinaturaId) ?? null;

  /** Troca o De: e pré-seleciona a assinatura padrão da nova conta. */
  const trocarDe = (novaConta: string) => {
    setDe(novaConta);
    setAssinaturaId(assinaturaPadraoDe(assinaturas, novaConta));
  };

  // ── IA ─────────────────────────────────────────────────────────────────

  const aplicarRascunho = (assuntoNovo: string, corpoNovo: string) => {
    setAssunto(assuntoNovo);
    setCorpo(corpoNovo);
  };

  const promptTrim = promptIa.trim();
  // Modo resposta gera sem instrução (a action usa a instrução padrão).
  const podeGerar =
    !rascunhando &&
    (promptTrim.length >= PROMPT_IA_MIN_CHARS ||
      (modoResposta && promptTrim.length === 0));

  const tratarFalhaIA = (res: { error: string; notConfigured?: boolean }) => {
    if (res.notConfigured) {
      setIaAviso(res.error);
    } else {
      toast.error(res.error);
    }
  };

  const gerar = () => {
    setIaAviso(null);
    startRascunho(async () => {
      const res = await rascunharEmailIA({
        formSubmissionId: leadVinculado?.id,
        prompt: promptTrim.length >= PROMPT_IA_MIN_CHARS ? promptTrim : undefined,
        tom: tom || undefined,
        tamanho: tamanho || undefined,
        threadContexto: prefill?.threadContexto,
      });
      if (!res.success) {
        tratarFalhaIA(res);
        return;
      }
      aplicarRascunho(res.rascunho.assunto, res.rascunho.corpo);
      toast.success("Rascunho gerado — revise antes de enviar.");
    });
  };

  /** Refino de 1 clique: manda o RASCUNHO ATUAL (corpo editado conta). */
  const refinar = (instrucao: string) => {
    const textoAtual = corpo.trim();
    if (!textoAtual) return;
    setIaAviso(null);
    startRascunho(async () => {
      const res = await rascunharEmailIA({
        formSubmissionId: leadVinculado?.id,
        prompt: instrucao,
        rascunhoAtual: { assunto: assunto.trim(), corpo: textoAtual },
        threadContexto: prefill?.threadContexto,
      });
      if (!res.success) {
        tratarFalhaIA(res);
        return;
      }
      aplicarRascunho(res.rascunho.assunto, res.rascunho.corpo);
      toast.success("Rascunho refinado — revise antes de enviar.");
    });
  };

  /** Há texto no corpo — habilita os refinos. */
  const temTextoParaRefinar = corpo.trim().length > 0;

  // ── Anexos ─────────────────────────────────────────────────────────────

  const anexarArquivos = async (arquivos: File[]) => {
    if (arquivos.length === 0) return;
    if (anexos.length + arquivos.length > ANEXOS_MAX) {
      toast.error(`Máximo de ${ANEXOS_MAX} anexos por e-mail.`);
      return;
    }
    const bytesAtuais = anexos.reduce((soma, a) => soma + a.bytes, 0);
    const bytesNovos = arquivos.reduce((soma, f) => soma + f.size, 0);
    if (bytesAtuais + bytesNovos > ANEXOS_BYTES_MAX) {
      toast.error(
        `Anexos excedem o limite de 8MB somados (${formatarBytes(bytesAtuais + bytesNovos)}). Remova arquivos ou envie um link.`,
      );
      return;
    }
    setAnexando(true);
    try {
      const novos: AnexoLocal[] = [];
      for (const arquivo of arquivos) {
        const base64 = await lerArquivoBase64(arquivo);
        novos.push({
          nome: (arquivo.name || "arquivo").slice(0, ANEXO_NOME_MAX),
          tipo: arquivo.type || undefined,
          bytes: arquivo.size,
          base64,
        });
      }
      setAnexos((prev) => [...prev, ...novos]);
    } catch (err) {
      console.error({
        level: "error",
        action: "email_anexar",
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error("Não foi possível ler um dos arquivos. Tente novamente.");
    } finally {
      setAnexando(false);
    }
  };

  const removerAnexo = (indice: number) => {
    setAnexos((prev) => prev.filter((_, i) => i !== indice));
  };

  // ── Envio ──────────────────────────────────────────────────────────────

  const enviar = () => {
    startEnvio(async () => {
      const res = await enviarEmail({
        de,
        para: para.trim(),
        assunto,
        corpo,
        assinaturaId: assinaturaId || undefined,
        formSubmissionId: leadVinculado?.id,
        linkUrl: linkUrl.trim() || undefined,
        linkTitle: linkTitle.trim() || undefined,
        anexos:
          anexos.length > 0
            ? anexos.map((a) => ({ nome: a.nome, tipo: a.tipo, base64: a.base64 }))
            : undefined,
      });
      if (!res.success) {
        toast.error(res.error ?? "Falha ao enviar o e-mail.");
        return;
      }
      toast.success("E-mail enviado.", res.detalhe ? { description: res.detalhe } : undefined);
      onFechar();
      onEnviado();
    });
  };

  const podeEnviar =
    para.trim().length > 0 &&
    assunto.trim().length > 0 &&
    corpo.trim().length > 0 &&
    !enviando &&
    !anexando;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-label={titulo}
      className="fixed inset-0 z-[95] flex flex-col overflow-hidden border border-border bg-card shadow-xl sm:inset-auto sm:bottom-0 sm:right-4 sm:max-h-[min(44rem,calc(100dvh-4rem))] sm:w-[min(35rem,calc(100vw-5rem))] sm:rounded-t-2xl"
    >
      {/* Header escuro (tinta) — padrão da janela de compor do Gmail */}
      <header className="flex shrink-0 items-center justify-between gap-3 bg-foreground px-4 py-2.5">
        <h2 className="truncate text-sm font-semibold text-background">{titulo}</h2>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar compositor"
          className="rounded-md p-1 text-background/70 transition-colors hover:bg-background/10 hover:text-background motion-reduce:transition-none"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {/* De: — contas de emails_contas */}
        <LinhaCampo label="De">
          <select
            value={de}
            onChange={(e) => trocarDe(e.target.value)}
            aria-label="Conta remetente"
            className="h-8 w-full bg-transparent text-sm text-foreground outline-none disabled:opacity-70"
            disabled={contas.length <= 1}
          >
            {contas.map((conta) => (
              <option key={conta} value={conta}>
                {conta}
              </option>
            ))}
          </select>
        </LinhaCampo>
        {contas.length > 1 && (
          <p className="pt-1 text-[11px] text-label-tertiary">
            A resposta do lead cai na caixa da conta escolhida.
          </p>
        )}

        {/* Para: lead vinculado (chip) OU busca/e-mail livre */}
        <LinhaCampo label="Para">
          {leadVinculado ? (
            <div className="flex flex-wrap items-center gap-2 py-1">
              <Badge tone="brand">{leadVinculado.nome}</Badge>
              <span className="min-w-0 truncate text-sm text-foreground">{para}</span>
              <button
                type="button"
                onClick={desvincularLead}
                aria-label={`Desvincular ${leadVinculado.nome}`}
                className="ml-auto rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground motion-reduce:transition-none"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={para}
                onChange={(e) => aoDigitarPara(e.target.value)}
                placeholder="Nome do lead ou e-mail…"
                autoComplete="off"
                autoFocus={!prefill?.para}
                role="combobox"
                aria-label="Destinatário — busque um lead pelo nome ou digite um e-mail livre"
                aria-expanded={sugestoes.length > 0}
                aria-controls="emails-sugestoes-leads"
                aria-autocomplete="list"
                className={CAMPO_INLINE_CLS}
              />
              {(sugestoes.length > 0 || buscando) && (
                <ul
                  id="emails-sugestoes-leads"
                  role="listbox"
                  aria-label="Leads encontrados"
                  className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-lg"
                >
                  {buscando && sugestoes.length === 0 && (
                    <li className="px-3 py-2 text-xs text-muted-foreground">Buscando…</li>
                  )}
                  {sugestoes.map((lead) => (
                    <li key={lead.id} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onClick={() => escolherLead(lead)}
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-secondary motion-reduce:transition-none"
                      >
                        <span className="text-sm font-medium text-foreground">
                          {lead.nome}
                          {lead.responsavelNome && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              resp. {lead.responsavelNome}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {lead.email ?? "sem e-mail cadastrado"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </LinhaCampo>

        <LinhaCampo label="Assunto">
          <input
            type="text"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            maxLength={200}
            placeholder="Assunto do e-mail"
            aria-label="Assunto"
            className={CAMPO_INLINE_CLS}
          />
        </LinhaCampo>

        <textarea
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          rows={10}
          maxLength={10_000}
          autoFocus={Boolean(prefill?.para)}
          placeholder="Escreva a mensagem — ou gere um rascunho com a IA abaixo."
          aria-label="Mensagem"
          className="min-h-40 w-full resize-y bg-transparent py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-placeholder"
        />

        {/* Assinatura — seletor por envio + preview renderizado (v2 rica) */}
        {assinaturasContaAtual.length > 0 && (
          <div className="mb-3 space-y-2">
            <label className="flex w-fit items-center gap-2 text-[11px] font-medium text-muted-foreground">
              Assinatura
              <select
                value={assinaturaId}
                onChange={(e) => setAssinaturaId(e.target.value)}
                aria-label={`Assinatura do envio pela conta ${de}`}
                className="h-7 rounded-md border border-input bg-card px-2 text-xs text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25"
              >
                <option value="">Sem assinatura</option>
                {assinaturasContaAtual.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                    {a.padrao ? " (padrão)" : ""}
                  </option>
                ))}
              </select>
            </label>
            {assinaturaAtual && (
              <div
                aria-label="Prévia da assinatura"
                className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm leading-relaxed text-foreground [&_img]:max-w-[220px]"
                // Sanitizado no SALVAR + na CF; re-sanitizar aqui protege o
                // preview mesmo se a config for editada por fora.
                dangerouslySetInnerHTML={{ __html: sanitizarHtmlAssinatura(assinaturaAtual.html) }}
              />
            )}
          </div>
        )}

        {/* Chips de anexos */}
        {anexos.length > 0 && (
          <ul aria-label="Anexos" className="flex flex-wrap gap-1.5 pb-3">
            {anexos.map((anexo, i) => (
              <li
                key={`${anexo.nome}-${i}`}
                className="flex max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary py-1 pl-2.5 pr-1.5 text-xs text-foreground"
              >
                <Paperclip aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate" title={anexo.nome}>
                  {anexo.nome}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {formatarBytes(anexo.bytes)}
                </span>
                <button
                  type="button"
                  onClick={() => removerAnexo(i)}
                  disabled={enviando}
                  aria-label={`Remover anexo ${anexo.nome}`}
                  className="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground motion-reduce:transition-none"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Link CTA opcional */}
        {mostrarLink ? (
          <div className="grid gap-3 pb-3 sm:grid-cols-2">
            <CampoEmail label="Link (CTA) — URL">
              <Input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
              />
            </CampoEmail>
            <CampoEmail label="Link (CTA) — título">
              <Input
                type="text"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                maxLength={200}
                placeholder="Ex.: Agendar conversa"
              />
            </CampoEmail>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarLink(true)}
            className="mb-3 flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:underline motion-reduce:transition-none"
          >
            <Link2 className="size-3.5" />
            Adicionar link (CTA)
          </button>
        )}

        {/* Bloco de IA — prompt livre + tom/tamanho + refinos */}
        <section
          aria-label="Escrever com IA"
          className="space-y-3 rounded-xl border border-border bg-secondary/50 p-3"
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Escrever com IA
            {leadVinculado && (
              <span className="font-normal text-muted-foreground">
                — usa os dados de {leadVinculado.nome} e da última reunião
              </span>
            )}
          </p>
          <CampoEmail
            label="Descreva o e-mail que você quer"
            ajuda={
              modoResposta
                ? "Sem instrução, a IA responde ao e-mail mais recente da conversa."
                : undefined
            }
          >
            <textarea
              value={promptIa}
              onChange={(e) => setPromptIa(e.target.value)}
              rows={2}
              maxLength={PROMPT_IA_MAX_CHARS}
              placeholder="Ex.: convide a família para uma conversa na quinta às 19h e reforce que a janela de janeiro está fechando"
              className={TEXTAREA_IA_CLS}
            />
          </CampoEmail>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <CampoEmail label="Tom">
              <select
                value={tom}
                onChange={(e) => setTom(e.target.value)}
                className={SELECT_CLS}
              >
                {TONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </CampoEmail>
            <CampoEmail label="Tamanho">
              <select
                value={tamanho}
                onChange={(e) => setTamanho(e.target.value as TamanhoIA)}
                className={SELECT_CLS}
              >
                {TAMANHOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </CampoEmail>
            <Button variant="secondary" size="md" onClick={gerar} disabled={!podeGerar}>
              {rascunhando ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Gerar
            </Button>
          </div>
          {temTextoParaRefinar && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                Refinar rascunho:
              </span>
              {REFINOS.map((refino) => (
                <Button
                  key={refino.label}
                  variant="ghost"
                  size="sm"
                  onClick={() => refinar(refino.instrucao)}
                  disabled={rascunhando}
                >
                  {refino.label}
                </Button>
              ))}
            </div>
          )}
          {iaAviso && (
            <p role="status" className="text-xs font-medium text-sys-orange">
              {iaAviso} O envio manual continua funcionando normalmente.
            </p>
          )}
        </section>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3">
        <div className="flex items-center gap-1">
          <Button size="md" onClick={enviar} disabled={!podeEnviar}>
            {enviando ? <Loader2 className="animate-spin" /> : <Send />}
            Enviar
          </Button>
          <input
            ref={inputArquivoRef}
            type="file"
            multiple
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              // Copia a lista ANTES de resetar o input (senão o FileList esvazia).
              const arquivos = Array.from(e.target.files ?? []);
              e.target.value = "";
              void anexarArquivos(arquivos);
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => inputArquivoRef.current?.click()}
            disabled={enviando || anexando || anexos.length >= ANEXOS_MAX}
            aria-label={`Anexar arquivos (máx ${ANEXOS_MAX}, 8MB somados)`}
            title="Anexar arquivos"
          >
            {anexando ? <Loader2 className="animate-spin" /> : <Paperclip />}
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={onFechar} disabled={enviando}>
          <Trash2 />
          Descartar
        </Button>
      </footer>
    </div>,
    document.body,
  );
}
