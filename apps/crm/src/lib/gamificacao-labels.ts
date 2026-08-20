import type { TipoEventoGamificacao } from "@/lib/gamificacao";

/**
 * Rótulos de exibição dos tipos de evento de gamificação.
 *
 * Módulo CLIENT-SAFE (só `import type` do motor server-only): é consumido
 * tanto pelas queries server-side (timeline do /conquistas) quanto pelos
 * call sites client que disparam celebrações (+XP toast).
 */
export const GAMIFICACAO_TIPO_LABEL: Record<TipoEventoGamificacao, string> = {
  lead_criado: "Lead criado",
  lead_aprovado: "Lead aprovado",
  lead_reprovado: "Lead reprovado",
  deal_avancado: "Deal avançado",
  contrato_criado: "Contrato criado",
  sinal_pago: "Sinal recebido",
  pagamento_confirmado: "Pagamento confirmado",
  email_enviado: "E-mail enviado",
  whatsapp_enviado: "WhatsApp enviado",
  tarefa_concluida: "Tarefa concluída",
  contato_familia: "Contato com família",
};

/** Rótulo seguro para tipos desconhecidos (catálogo pode evoluir). */
export function rotuloEventoGamificacao(tipo: string): string {
  return (GAMIFICACAO_TIPO_LABEL as Record<string, string>)[tipo] ?? "Ação registrada";
}
