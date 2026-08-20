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
 * Hora no formato do Gmail: "14:32" se hoje, "12 de ago" no mesmo ano,
 * "12/08/25" em anos anteriores. Vazio para data inválida.
 */
export function horaEstiloGmail(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const agora = new Date();
  const mesmoDia =
    d.getFullYear() === agora.getFullYear() &&
    d.getMonth() === agora.getMonth() &&
    d.getDate() === agora.getDate();
  if (mesmoDia) {
    return new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
  if (d.getFullYear() === agora.getFullYear()) {
    // "12 de ago." → sem o ponto do mês abreviado
    return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" })
      .format(d)
      .replace(/\./g, "");
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d);
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
