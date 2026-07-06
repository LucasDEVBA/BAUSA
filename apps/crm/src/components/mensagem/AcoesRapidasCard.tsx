"use client";

import { useState } from "react";
import { Copy, Mail, MessageSquare, Send, Video } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ChannelAction } from "@/components/ui";
import { MinimalCard } from "@/components/shared/MinimalUI";
import {
  MensagemDiretaComposer,
  type CanalMensagem,
  type MensagemDestinatario,
} from "./MensagemDiretaComposer";

/**
 * AcoesRapidasCard (I4) — card compacto da Visão Executiva (primeiro da
 * coluna) nos modais de detalhe do lead e do deal. WhatsApp/E-mail abrem o
 * compositor de mensagem direta no canal; Copiar telefone vai ao clipboard.
 * Sem contato → botão desabilitado com title explicativo (aria-disabled em
 * vez de disabled para o tooltip funcionar).
 */

interface AcoesRapidasCardProps {
  destinatario: MensagemDestinatario;
  /** Link de highlights do atleta (paridade com o card antigo do lead). */
  highlightsUrl?: string | null;
}

export function AcoesRapidasCard({ destinatario, highlightsUrl }: AcoesRapidasCardProps) {
  const [canalAberto, setCanalAberto] = useState<CanalMensagem | null>(null);

  const temTelefone = Boolean(destinatario.telefone);
  const temEmail = Boolean(destinatario.email);

  const copiarTelefone = async () => {
    if (!destinatario.telefone) return;
    try {
      await navigator.clipboard.writeText(destinatario.telefone);
      toast.success("Telefone copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const desabilitado = "cursor-not-allowed opacity-45 hover:bg-transparent";

  return (
    <>
      <MinimalCard title="Ações rápidas" icon={Send} iconColor="text-sys-green">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          <ChannelAction
            channel="whatsapp"
            icon={MessageSquare}
            aria-disabled={!temTelefone}
            title={temTelefone ? "Enviar mensagem por WhatsApp" : "Lead sem telefone cadastrado"}
            className={cn(!temTelefone && desabilitado)}
            onClick={() => temTelefone && setCanalAberto("whatsapp")}
          >
            WhatsApp
          </ChannelAction>
          <ChannelAction
            channel="email"
            icon={Mail}
            aria-disabled={!temEmail}
            title={temEmail ? "Enviar mensagem por e-mail" : "Lead sem e-mail cadastrado"}
            className={cn(!temEmail && desabilitado)}
            onClick={() => temEmail && setCanalAberto("email")}
          >
            E-mail
          </ChannelAction>
          <ChannelAction
            channel="neutral"
            icon={Copy}
            aria-disabled={!temTelefone}
            title={temTelefone ? "Copiar telefone para a área de transferência" : "Lead sem telefone cadastrado"}
            className={cn(!temTelefone && desabilitado)}
            onClick={copiarTelefone}
          >
            Copiar telefone
          </ChannelAction>
          {highlightsUrl && (
            <ChannelAction channel="call" icon={Video} asChild>
              <a href={highlightsUrl} target="_blank" rel="noreferrer">
                Highlights
              </a>
            </ChannelAction>
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          WhatsApp e E-mail abrem o compositor de mensagem direta para este lead.
        </p>
      </MinimalCard>

      {canalAberto && (
        <MensagemDiretaComposer
          canalInicial={canalAberto}
          destinatario={destinatario}
          onClose={() => setCanalAberto(null)}
        />
      )}
    </>
  );
}
