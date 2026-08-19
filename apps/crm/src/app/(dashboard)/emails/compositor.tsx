"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Link2, Loader2, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Input } from "@/components/ui";
import {
  buscarLeadsEmail,
  enviarEmail,
  rascunharEmailIA,
  type LeadBusca,
} from "@/lib/actions/emails";

import { CampoEmail, EmailModal } from "./modal";

/** Pré-preenchimento (fluxo "Responder" da caixa de entrada). */
export interface CompositorPrefill {
  para?: string;
  assunto?: string;
  formSubmissionId?: string;
  leadNome?: string;
}

const BUSCA_DEBOUNCE_MS = 300;
const BUSCA_MIN_CHARS = 2;

const TONS = [
  { value: "", label: "Consultivo premium (padrão)" },
  { value: "mais direto e objetivo", label: "Direto e objetivo" },
  { value: "mais caloroso e próximo", label: "Caloroso e próximo" },
  { value: "formal e institucional", label: "Formal e institucional" },
] as const;

const SELECT_CLS =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25";

/**
 * Compositor — renderizar SÓ quando aberto ({aberto && <CompositorEmail/>}):
 * cada abertura remonta o componente, então o estado inicial vem direto do
 * prefill (sem effect de reset — exigência do react-hooks/set-state-in-effect).
 */
export function CompositorEmail({
  prefill,
  onFechar,
  onEnviado,
}: {
  prefill?: CompositorPrefill | null;
  onFechar: () => void;
  onEnviado: () => void;
}) {
  const [para, setPara] = useState(prefill?.para ?? "");
  const [assunto, setAssunto] = useState(prefill?.assunto ?? "");
  const [corpo, setCorpo] = useState("");
  const [leadVinculado, setLeadVinculado] = useState<{ id: string; nome: string } | null>(
    prefill?.formSubmissionId
      ? { id: prefill.formSubmissionId, nome: prefill.leadNome ?? "Lead" }
      : null,
  );
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [mostrarLink, setMostrarLink] = useState(false);

  // Autocomplete de lead
  const [sugestoes, setSugestoes] = useState<LeadBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const buscaSeq = useRef(0);

  // IA
  const [objetivo, setObjetivo] = useState("");
  const [tom, setTom] = useState<string>("");
  const [iaAviso, setIaAviso] = useState<string | null>(null);
  const [rascunhando, startRascunho] = useTransition();

  const [enviando, startEnvio] = useTransition();

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

  const rascunhar = () => {
    setIaAviso(null);
    startRascunho(async () => {
      const res = await rascunharEmailIA({
        formSubmissionId: leadVinculado?.id,
        objetivo,
        tom: tom || undefined,
      });
      if (!res.success) {
        if (res.notConfigured) {
          setIaAviso(res.error);
        } else {
          toast.error(res.error);
        }
        return;
      }
      setAssunto(res.rascunho.assunto);
      setCorpo(res.rascunho.corpo);
      toast.success("Rascunho gerado — revise antes de enviar.");
    });
  };

  const enviar = () => {
    startEnvio(async () => {
      const res = await enviarEmail({
        para: para.trim(),
        assunto,
        corpo,
        formSubmissionId: leadVinculado?.id,
        linkUrl: linkUrl.trim() || undefined,
        linkTitle: linkTitle.trim() || undefined,
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
    para.trim().length > 0 && assunto.trim().length > 0 && corpo.trim().length > 0 && !enviando;

  return (
    <EmailModal
      aberto
      titulo="Novo e-mail"
      descricao="Enviado como contato@bolsaatletausa.com — respostas caem na caixa de entrada."
      onFechar={onFechar}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button size="sm" onClick={enviar} disabled={!podeEnviar}>
            {enviando ? <Loader2 className="animate-spin" /> : <Send />}
            Enviar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Destinatário: lead vinculado (chip) OU busca/e-mail livre */}
        <CampoEmail
          label="Destinatário"
          ajuda={
            leadVinculado
              ? undefined
              : "Busque um lead pelo nome ou digite um e-mail livre."
          }
        >
          {leadVinculado ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-input bg-card px-3 py-2">
              <Badge tone="brand">{leadVinculado.nome}</Badge>
              <span className="min-w-0 truncate text-sm text-foreground">{para}</span>
              <button
                type="button"
                onClick={desvincularLead}
                aria-label={`Desvincular ${leadVinculado.nome}`}
                className="ml-auto rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Input
                type="text"
                value={para}
                onChange={(e) => aoDigitarPara(e.target.value)}
                placeholder="Nome do lead ou e-mail…"
                autoComplete="off"
                role="combobox"
                aria-expanded={sugestoes.length > 0}
                aria-controls="emails-sugestoes-leads"
                aria-autocomplete="list"
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
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-secondary"
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
        </CampoEmail>

        <CampoEmail label="Assunto">
          <Input
            type="text"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            maxLength={200}
            placeholder="Assunto do e-mail"
          />
        </CampoEmail>

        <CampoEmail label="Mensagem">
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={10}
            maxLength={10_000}
            placeholder="Escreva a mensagem — ou gere um rascunho com a IA abaixo."
            className="w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-placeholder focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25"
          />
        </CampoEmail>

        {/* Link CTA opcional */}
        {mostrarLink ? (
          <div className="grid gap-3 sm:grid-cols-2">
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
            className="flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:underline"
          >
            <Link2 className="size-3.5" />
            Adicionar link (CTA)
          </button>
        )}

        {/* Bloco de IA */}
        <section
          aria-label="Rascunhar com IA"
          className="space-y-3 rounded-xl border border-border bg-secondary/50 p-3"
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Rascunhar com IA
            {leadVinculado && (
              <span className="font-normal text-muted-foreground">
                — usa os dados de {leadVinculado.nome} e da última reunião
              </span>
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <CampoEmail label="Objetivo do e-mail">
              <Input
                type="text"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                maxLength={500}
                placeholder="Ex.: retomar contato após a reunião e convidar para o próximo passo"
              />
            </CampoEmail>
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
            <Button
              variant="secondary"
              size="md"
              onClick={rascunhar}
              disabled={rascunhando || objetivo.trim().length < 5}
            >
              {rascunhando ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Rascunhar
            </Button>
          </div>
          {iaAviso && (
            <p role="status" className="text-xs font-medium text-sys-orange">
              {iaAviso} O envio manual continua funcionando normalmente.
            </p>
          )}
        </section>
      </div>
    </EmailModal>
  );
}
