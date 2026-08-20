"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenLine, Save } from "lucide-react";
import { toast } from "sonner";

import { Button, Card } from "@/components/ui";
import { localPart } from "@/components/emails/email-status";
import { salvarAssinaturasEmails } from "@/lib/actions/emails";

const ASSINATURA_MAX_CHARS = 2000;

const TEXTAREA_CLS =
  "min-h-24 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-placeholder focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 motion-reduce:transition-none";

function montarTextos(
  contas: string[],
  assinaturas: Record<string, string>,
): Record<string, string> {
  const textos: Record<string, string> = {};
  for (const conta of contas) textos[conta] = assinaturas[conta] ?? "";
  return textos;
}

/**
 * Aba Assinaturas (/emails) — assinatura de texto POR CONTA de envio
 * (chave `emails_assinaturas`). O compositor insere o bloco `--` ao final do
 * corpo automaticamente (visível e editável — nada oculto). O estado local é
 * a fonte durante a edição; salvar substitui o mapa inteiro e dá refresh.
 */
export function AssinaturasTab({
  contas,
  assinaturas,
}: {
  /** Contas de ENVIO (whitelist emails_contas) — uma assinatura por conta. */
  contas: string[];
  assinaturas: Record<string, string>;
}) {
  const router = useRouter();
  const [textos, setTextos] = useState<Record<string, string>>(() =>
    montarTextos(contas, assinaturas),
  );
  const [salvando, startSalvar] = useTransition();

  const alterado = contas.some(
    (conta) => (textos[conta] ?? "").trim() !== (assinaturas[conta] ?? "").trim(),
  );

  const salvar = () => {
    startSalvar(async () => {
      const res = await salvarAssinaturasEmails(textos);
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
          O texto é inserido automaticamente ao final do e-mail (bloco iniciado por
          &ldquo;--&rdquo;) quando a conta é escolhida no &ldquo;De:&rdquo; do compositor —
          sempre visível e editável antes do envio. Deixe em branco para a conta ficar sem
          assinatura.
        </p>

        <div className="mt-4 space-y-4">
          {contas.map((conta) => (
            <label key={conta} className="block space-y-1.5">
              <span className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {localPart(conta)}
                </span>
                <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                  {conta}
                </span>
              </span>
              <textarea
                value={textos[conta] ?? ""}
                onChange={(e) =>
                  setTextos((prev) => ({ ...prev, [conta]: e.target.value }))
                }
                rows={4}
                maxLength={ASSINATURA_MAX_CHARS}
                placeholder={
                  "Ex.:\nLeandro Ribeiro\nBolsa Atleta USA — bolsaatletausa.com"
                }
                aria-label={`Assinatura da conta ${conta}`}
                className={TEXTAREA_CLS}
              />
            </label>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
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
