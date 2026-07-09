"use client";

import { useState, type ReactNode } from "react";
import { CheckCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * MensagemPreview — preview AO VIVO das ações custom do builder de automações
 * (WhatsApp custom e E-mail custom). Renderiza a mensagem como o destinatário
 * verá: placeholders substituídos por exemplos, quebras de linha, formatação
 * WhatsApp (negrito com asteriscos, itálico com underscores), card de link
 * com imagem/título e mock de e-mail (remetente, assunto, imagem, botão).
 * Puro (dirigido por props) —
 * atualiza a cada tecla nas DUAS visões do builder (Fluxo e Formulário).
 */

// Exemplos dos placeholders — espelham o render da engine
// ({atleta_nome}/{responsavel_nome}, split/join).
const EXEMPLO_VARS: Record<string, string> = {
  "{atleta_nome}": "João Silva",
  "{responsavel_nome}": "Maria Silva",
};

function renderPlaceholders(texto: string, vars: Record<string, string>): string {
  let rendered = texto;
  for (const [placeholder, valor] of Object.entries(vars)) {
    rendered = rendered.split(placeholder).join(valor);
  }
  return rendered;
}

/** Formatação inline do WhatsApp: *negrito* e _itálico_ (sem HTML — só nós
 *  React, imune a injection). Mantém o restante do texto literal. */
function renderWhatsAppInline(linha: string, keyPrefix: string): ReactNode[] {
  const partes = linha.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return partes.map((parte, i) => {
    if (parte.length > 2 && parte.startsWith("*") && parte.endsWith("*")) {
      return <strong key={`${keyPrefix}-${i}`}>{parte.slice(1, -1)}</strong>;
    }
    if (parte.length > 2 && parte.startsWith("_") && parte.endsWith("_")) {
      return <em key={`${keyPrefix}-${i}`}>{parte.slice(1, -1)}</em>;
    }
    return <span key={`${keyPrefix}-${i}`}>{parte}</span>;
  });
}

function LinhasWhatsApp({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n").map((linha, i) =>
        linha.trim() ? (
          <span key={i} className="block">
            {renderWhatsAppInline(linha, `l${i}`)}
          </span>
        ) : (
          <span key={i} aria-hidden className="block h-3" />
        ),
      )}
    </>
  );
}

export interface MensagemPreviewProps {
  canal: "whatsapp" | "email";
  mensagem: string;
  /** Só canal e-mail (assunto renderizado com os mesmos placeholders). */
  assunto?: string;
  imagemUrl?: string;
  linkUrl?: string;
  linkTitulo?: string;
  /** Valores dos placeholders. Default: exemplos do builder (João/Maria).
   *  O compositor de mensagem direta passa os NOMES REAIS do lead. */
  vars?: Record<string, string>;
  className?: string;
}

export function MensagemPreview({
  canal,
  mensagem,
  assunto,
  imagemUrl,
  linkUrl,
  linkTitulo,
  vars = EXEMPLO_VARS,
  className,
}: MensagemPreviewProps) {
  // Hora de "envio" do mock — congelada no mount via lazy init. Componente
  // nunca renderiza em SSR (o builder abre por interação do CEO), então não
  // há par servidor/cliente para divergir — sem risco de hydration mismatch.
  const [hora] = useState(() =>
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  );

  const texto = renderPlaceholders(mensagem, vars);
  const assuntoRendered = renderPlaceholders(assunto ?? "", vars);
  const temLink = Boolean(linkUrl?.trim());
  const temImagem = Boolean(imagemUrl?.trim());

  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-[9px] font-semibold uppercase tracking-widest text-label-tertiary">
        Preview — {canal === "whatsapp" ? "WhatsApp" : "E-mail"}
      </p>

      {canal === "whatsapp" ? (
        <div className="rounded-xl bg-secondary/60 p-3">
          <div className="ml-auto w-fit max-w-[92%] rounded-lg rounded-tr-sm border border-sys-green/20 bg-sys-green/15 px-2.5 py-1.5 shadow-sm">
            {temImagem && !temLink && (
              // Imagem sem link → mídia nativa (o texto vira legenda abaixo).
              <div className="mb-1.5 overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagemUrl}
                  alt="Imagem da mensagem"
                  className="max-h-40 w-full rounded-md object-cover"
                />
              </div>
            )}
            {temLink && (
              <div className="mb-1.5 overflow-hidden rounded-md bg-card/80">
                {temImagem && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagemUrl}
                    alt="Imagem do card do link"
                    className="max-h-28 w-full object-cover"
                  />
                )}
                <div className="px-2 py-1.5">
                  <p className="truncate text-[11px] font-semibold text-foreground">
                    {linkTitulo?.trim() || linkUrl}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">{linkUrl}</p>
                </div>
              </div>
            )}
            {texto.trim() ? (
              <div className="text-xs leading-relaxed text-foreground">
                <LinhasWhatsApp texto={texto} />
                {/* O envio anexa o link ao final quando não está no texto */}
                {temLink && !texto.includes(linkUrl!.trim()) && (
                  <span className="mt-2 block truncate text-primary underline">
                    {linkUrl!.trim()}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                Escreva a mensagem para ver o preview…
              </p>
            )}
            <span className="mt-0.5 flex items-center justify-end gap-1 text-[9px] text-muted-foreground">
              {hora}
              <CheckCheck aria-hidden className="h-3 w-3 text-sys-blue" />
            </span>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Cabeçalho do mock: remetente + hora */}
          <div className="flex items-center gap-2 px-3 py-2">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-[10px] font-bold text-white"
            >
              BA
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] font-semibold text-foreground">
                Bolsa Atleta USA
              </span>
              <span className="block truncate text-[10px] text-muted-foreground">
                contato@bolsaatletausa.com
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{hora}</span>
          </div>
          <div className="space-y-2 border-t border-border px-3 py-2.5">
            <p className="text-xs font-semibold text-foreground">
              {assuntoRendered.trim() || (
                <span className="font-normal italic text-muted-foreground">
                  Defina o assunto do e-mail…
                </span>
              )}
            </p>
            {temImagem && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagemUrl}
                alt="Imagem do e-mail"
                className="max-h-32 w-full rounded-md object-cover"
              />
            )}
            {texto.trim() ? (
              <div className="space-y-2 text-xs leading-relaxed text-foreground">
                {texto
                  .split(/\r?\n+/)
                  .map((linha) => linha.trim())
                  .filter(Boolean)
                  .map((linha, i) => (
                    <p key={i}>{linha}</p>
                  ))}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                Escreva a mensagem para ver o preview…
              </p>
            )}
            {temLink && (
              <span className="inline-block rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground">
                {linkTitulo?.trim() || "Saiba mais"}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
