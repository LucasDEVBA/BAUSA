import type { BadgeTone } from "@/components/ui";
import type { EmailMensagem } from "@/lib/emails-queries";

// ════════════════════════════════════════════════════════════════════════
// Helpers de apresentação do módulo de E-mail, compartilhados entre a tela
// /emails e a aba E-mails do detalhe do lead/deal. Sem React aqui — só
// funções puras (importável de client e server components).
// ════════════════════════════════════════════════════════════════════════

export interface EmailStatusChip {
  label: string;
  tone: BadgeTone;
}

/** Chips de status do e-mail enviado, derivados dos timestamps do Resend. */
export function statusChips(email: EmailMensagem): EmailStatusChip[] {
  const chips: EmailStatusChip[] = [];
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

/** Prefixo "Re:" sem duplicar (Re: Re: …). */
export function assuntoResposta(assunto: string): string {
  return /^re:/i.test(assunto.trim()) ? assunto : `Re: ${assunto}`;
}

/** Parte local do e-mail ("contato@x.com" → "contato") — rótulo curto de caixa. */
export function localPart(email: string): string {
  return email.split("@")[0] || email;
}

/**
 * Contexto de conversa p/ o modo "responder com IA": últimas `max` mensagens
 * em texto simples, da mais antiga para a mais recente. O server action trata
 * tudo como DADOS delimitados (anti-injection) — aqui só montamos o texto.
 */
export function montarThreadContexto(
  mensagens: EmailMensagem[],
  max = 5,
  maxCharsPorMensagem = 800,
): string {
  return mensagens
    .slice(-max)
    .map((m) => {
      const quem = m.direcao === "enviado" ? `nós (${m.deEmail})` : m.deEmail;
      const texto = (m.corpoText ?? m.snippet ?? "").slice(0, maxCharsPorMensagem);
      return `[${quem}] assunto: ${m.assunto || "(sem assunto)"}\n${texto}`;
    })
    .join("\n---\n");
}
