"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Baseline,
  Bold,
  Eraser,
  Image as ImageIcon,
  Italic,
  Link2,
  Loader2,
  PenLine,
  Plus,
  Save,
  Strikethrough,
  Trash2,
  Underline,
} from "lucide-react";
import { toast } from "sonner";

import { Button, Card } from "@/components/ui";
import { localPart } from "@/components/emails/email-status";
import {
  salvarAssinaturasEmails,
  uploadImagemAssinatura,
} from "@/lib/actions/emails";
import { sanitizarHtmlAssinatura } from "@/lib/email-assinatura-sanitize";
import type { EmailAssinatura } from "@/lib/emails-queries";

const ASSINATURAS_POR_CONTA_MAX = 5;
const ASSINATURA_NOME_MAX = 60;

/** Paleta de cores do editor — marca BAU + neutros (tokens não valem em e-mail). */
const CORES = [
  { nome: "Tinta", valor: "#0c1527" },
  { nome: "Azul BAU", valor: "#193b8b" },
  { nome: "Azul claro", valor: "#476bc0" },
  { nome: "Bordô BAU", valor: "#8e1824" },
  { nome: "Cinza", valor: "#697b9a" },
  { nome: "Verde", valor: "#1d7a4c" },
] as const;

const BTN_TOOLBAR_CLS =
  "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none";

/**
 * Editor rico de assinatura — contentEditable + document.execCommand (o único
 * caminho zero-dep que funciona em todos os browsers p/ HTML de e-mail
 * simples). NÃO CONTROLADO: o HTML inicial entra uma vez e o caret nunca é
 * clobberado por re-render; cada input notifica o pai via onChange.
 * Toolbar usa onMouseDown+preventDefault p/ NÃO roubar a seleção do editor.
 * O HTML final é sanitizado no SALVAR (server action) e de novo na CF.
 */
function EditorAssinatura({
  htmlInicial,
  onChange,
  rotulo,
}: {
  htmlInicial: string;
  onChange: (html: string) => void;
  rotulo: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const inputImagemRef = useRef<HTMLInputElement | null>(null);
  const [mostrarLink, setMostrarLink] = useState(false);
  const [urlLink, setUrlLink] = useState("");
  const [subindoImagem, setSubindoImagem] = useState(false);

  const notificar = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  /** Executa um comando de formatação preservando a seleção do editor. */
  const comando = (nome: string, valor?: string) => {
    editorRef.current?.focus();
    document.execCommand(nome, false, valor);
    notificar();
  };

  const aplicarLink = () => {
    const url = urlLink.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error("O link precisa começar com http(s)://");
      return;
    }
    comando("createLink", url);
    setUrlLink("");
    setMostrarLink(false);
  };

  const inserirImagem = async (arquivo: File) => {
    setSubindoImagem(true);
    try {
      const formData = new FormData();
      formData.set("arquivo", arquivo);
      const res = await uploadImagemAssinatura(formData);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      comando(
        "insertHTML",
        `<img src="${res.url}" alt="" style="max-width:220px;height:auto;display:block;margin:4px 0;">`,
      );
    } finally {
      setSubindoImagem(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/25">
      <div
        role="toolbar"
        aria-label={`Formatação — ${rotulo}`}
        className="flex flex-wrap items-center gap-0.5 border-b border-border bg-secondary/40 px-1.5 py-1"
      >
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => comando("bold")} aria-label="Negrito" title="Negrito" className={BTN_TOOLBAR_CLS}>
          <Bold className="size-3.5" />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => comando("italic")} aria-label="Itálico" title="Itálico" className={BTN_TOOLBAR_CLS}>
          <Italic className="size-3.5" />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => comando("underline")} aria-label="Sublinhado" title="Sublinhado" className={BTN_TOOLBAR_CLS}>
          <Underline className="size-3.5" />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => comando("strikeThrough")} aria-label="Tachado" title="Tachado" className={BTN_TOOLBAR_CLS}>
          <Strikethrough className="size-3.5" />
        </button>

        <span aria-hidden className="mx-1 h-4 w-px bg-border" />

        {/* Cores — swatches da marca (aria pelo nome da cor) */}
        <span className="flex items-center gap-1 px-0.5" role="group" aria-label="Cor do texto">
          <Baseline aria-hidden className="size-3.5 text-muted-foreground" />
          {CORES.map((cor) => (
            <button
              key={cor.valor}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => comando("foreColor", cor.valor)}
              aria-label={`Cor ${cor.nome}`}
              title={cor.nome}
              className="size-4 rounded-full border border-border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none"
              style={{ backgroundColor: cor.valor }}
            />
          ))}
        </span>

        <span aria-hidden className="mx-1 h-4 w-px bg-border" />

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMostrarLink((v) => !v)}
          aria-label="Inserir link"
          title="Inserir link (selecione o texto antes)"
          className={BTN_TOOLBAR_CLS}
        >
          <Link2 className="size-3.5" />
        </button>
        <input
          ref={inputImagemRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            e.target.value = "";
            if (arquivo) void inserirImagem(arquivo);
          }}
        />
        <button
          type="button"
          onClick={() => inputImagemRef.current?.click()}
          disabled={subindoImagem}
          aria-label="Inserir imagem (PNG/JPG/WebP, máx 3MB)"
          title="Inserir imagem (logo, foto — máx 3MB)"
          className={BTN_TOOLBAR_CLS}
        >
          {subindoImagem ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            comando("removeFormat");
            comando("unlink");
          }}
          aria-label="Limpar formatação"
          title="Limpar formatação"
          className={BTN_TOOLBAR_CLS}
        >
          <Eraser className="size-3.5" />
        </button>
      </div>

      {mostrarLink && (
        <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-2 py-1.5">
          <input
            type="url"
            value={urlLink}
            onChange={(e) => setUrlLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                aplicarLink();
              }
            }}
            placeholder="https://… (selecione o texto do link antes)"
            aria-label="URL do link"
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-xs text-foreground outline-none placeholder:text-placeholder focus-visible:border-primary"
          />
          <Button variant="secondary" size="sm" onClick={aplicarLink}>
            Aplicar
          </Button>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={rotulo}
        onInput={notificar}
        onBlur={notificar}
        // Colar HTML hostil executaria on* direto no DOM do editor —
        // intercepta, sanitiza e insere a versão limpa (texto puro segue igual).
        onPaste={(e) => {
          const htmlColado = e.clipboardData.getData("text/html");
          if (!htmlColado) return; // texto puro: caminho nativo é seguro
          e.preventDefault();
          document.execCommand("insertHTML", false, sanitizarHtmlAssinatura(htmlColado));
          notificar();
        }}
        className="min-h-28 px-3 py-2 text-sm leading-relaxed text-foreground outline-none [&_a]:text-primary [&_a]:underline [&_img]:max-w-[220px]"
        // Inicial UMA vez — editor não controlado (caret preservado);
        // sanitizado de novo aqui p/ blindar contra config editada por fora.
        dangerouslySetInnerHTML={{ __html: sanitizarHtmlAssinatura(htmlInicial) }}
      />
    </div>
  );
}

function clonarEstado(
  contas: string[],
  assinaturas: Record<string, EmailAssinatura[]>,
): Record<string, EmailAssinatura[]> {
  const estado: Record<string, EmailAssinatura[]> = {};
  for (const conta of contas) {
    estado[conta] = (assinaturas[conta] ?? []).map((a) => ({ ...a }));
  }
  return estado;
}

/**
 * Aba Assinaturas (/emails) — v2 RICA: cada conta de envio tem uma LISTA de
 * assinaturas (nome + HTML com negrito/cor/sublinhado/imagem + padrão). No
 * compositor, a assinatura padrão da conta do "De:" nasce selecionada e pode
 * ser trocada POR ENVIO. Salvar substitui o mapa inteiro (CEO-only).
 */
export function AssinaturasTab({
  contas,
  assinaturas,
}: {
  /** Contas de ENVIO (whitelist emails_contas). */
  contas: string[];
  assinaturas: Record<string, EmailAssinatura[]>;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<Record<string, EmailAssinatura[]>>(() =>
    clonarEstado(contas, assinaturas),
  );
  const [salvando, startSalvar] = useTransition();

  // Server re-render (salvar → refresh) entrega props novas — re-seeda o
  // estado local com o que FOI persistido (html sanitizado, padrão
  // normalizado). Padrão "ajustar estado durante o render" do client.tsx.
  const [seed, setSeed] = useState(assinaturas);
  if (seed !== assinaturas) {
    setSeed(assinaturas);
    setEstado(clonarEstado(contas, assinaturas));
  }

  const original = JSON.stringify(clonarEstado(contas, assinaturas));
  const alterado = JSON.stringify(estado) !== original;

  const atualizarLista = (
    conta: string,
    fn: (lista: EmailAssinatura[]) => EmailAssinatura[],
  ) => {
    setEstado((prev) => ({ ...prev, [conta]: fn(prev[conta] ?? []) }));
  };

  const adicionar = (conta: string) => {
    atualizarLista(conta, (lista) => {
      if (lista.length >= ASSINATURAS_POR_CONTA_MAX) return lista;
      return [
        ...lista,
        {
          id: crypto.randomUUID(),
          nome: lista.length === 0 ? "Padrão" : `Assinatura ${lista.length + 1}`,
          html: "",
          padrao: lista.length === 0,
        },
      ];
    });
  };

  const remover = (conta: string, id: string) => {
    atualizarLista(conta, (lista) => {
      const nova = lista.filter((a) => a.id !== id);
      // Remover a padrão promove a primeira restante.
      if (nova.length > 0 && !nova.some((a) => a.padrao)) {
        nova[0] = { ...nova[0], padrao: true };
      }
      return nova;
    });
  };

  const marcarPadrao = (conta: string, id: string) => {
    atualizarLista(conta, (lista) => lista.map((a) => ({ ...a, padrao: a.id === id })));
  };

  const salvar = () => {
    startSalvar(async () => {
      const payload: Record<string, EmailAssinatura[]> = {};
      for (const [conta, lista] of Object.entries(estado)) {
        payload[conta] = lista.map(({ id, nome, html, padrao }) => ({
          id,
          nome,
          html,
          padrao,
        }));
      }
      const res = await salvarAssinaturasEmails(payload);
      if (!res.success) {
        toast.error(res.error ?? "Não foi possível salvar as assinaturas.");
        return;
      }
      toast.success("Assinaturas salvas.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <PenLine className="size-4 text-primary" />
          Assinaturas por conta
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Cada conta pode ter até {ASSINATURAS_POR_CONTA_MAX} assinaturas ricas (negrito, cor,
          sublinhado, links e imagem). A marcada como <strong>padrão</strong> nasce selecionada no
          compositor quando a conta é o &ldquo;De:&rdquo; — e dá para trocar (ou remover) a
          assinatura em cada envio.
        </p>

        <div className="mt-4 space-y-6">
          {contas.map((conta) => {
            const lista = estado[conta] ?? [];
            return (
              <section key={conta} aria-label={`Assinaturas de ${conta}`} className="space-y-3">
                <header className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {localPart(conta)}
                    </span>
                    <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                      {conta}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => adicionar(conta)}
                    disabled={lista.length >= ASSINATURAS_POR_CONTA_MAX}
                  >
                    <Plus />
                    Nova assinatura
                  </Button>
                </header>

                {lista.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-label-tertiary">
                    Sem assinatura — os e-mails desta conta saem sem bloco de assinatura.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {lista.map((assinatura) => (
                      <div
                        key={assinatura.id}
                        className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={assinatura.nome}
                            maxLength={ASSINATURA_NOME_MAX}
                            onChange={(e) =>
                              atualizarLista(conta, (l) =>
                                l.map((a) =>
                                  a.id === assinatura.id ? { ...a, nome: e.target.value } : a,
                                ),
                              )
                            }
                            aria-label="Nome da assinatura"
                            placeholder="Nome (ex.: Padrão, Institucional)"
                            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-card px-2.5 text-xs font-medium text-foreground outline-none placeholder:text-placeholder focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25"
                          />
                          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <input
                              type="radio"
                              name={`padrao-${conta}`}
                              checked={assinatura.padrao}
                              onChange={() => marcarPadrao(conta, assinatura.id)}
                              className="size-3.5 accent-primary"
                            />
                            Padrão
                          </label>
                          <button
                            type="button"
                            onClick={() => remover(conta, assinatura.id)}
                            aria-label={`Remover assinatura ${assinatura.nome}`}
                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-sys-red motion-reduce:transition-none"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <EditorAssinatura
                          htmlInicial={assinatura.html}
                          rotulo={`Assinatura ${assinatura.nome} de ${conta}`}
                          onChange={(html) =>
                            atualizarLista(conta, (l) =>
                              l.map((a) => (a.id === assinatura.id ? { ...a, html } : a)),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button size="md" onClick={salvar} disabled={salvando || !alterado}>
            {salvando ? <Loader2 className="animate-spin" /> : <Save />}
            Salvar assinaturas
          </Button>
          {!alterado && (
            <span className="text-[11px] text-label-tertiary">Tudo salvo.</span>
          )}
        </div>
      </Card>
    </div>
  );
}
