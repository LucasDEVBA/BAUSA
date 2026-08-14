/**
 * Catálogo de eventos notificáveis e defaults de canal.
 *
 * Módulo PURO: `lib/actions/notificacoes-canais.ts` é `"use server"` e um
 * arquivo com essa diretiva só pode exportar funções async — constante ali
 * quebra a coleta da rota no build ("Failed to collect configuration").
 */

export const EVENTOS = [
  {
    id: "lead_aguardando_aprovacao",
    titulo: "Lead aguardando aprovação",
    descricao:
      "Enquanto você não decide, o lead não entra no pipeline nem recebe mensagem. O aviso traz os nomes e o link direto.",
    tom: "acao" as const,
  },
  {
    id: "monitor_critico",
    titulo: "Algo parou de funcionar",
    descricao:
      "Z-API fora do ar, fila travada, qualificação parada, entrada zerada. Afeta o funil agora.",
    tom: "critico" as const,
  },
  {
    id: "monitor_atencao",
    titulo: "Pontos de atenção",
    descricao:
      "Transcrição faltando, CPL acima do alvo, NPS pendente. Nada parado — vale olhar quando puder.",
    tom: "atencao" as const,
  },
  {
    id: "reuniao_confirmada",
    titulo: "Reunião confirmada",
    descricao: "Um lead agendou reunião pelo link.",
    tom: "ok" as const,
  },
  {
    id: "contrato_fechado",
    titulo: "Contrato fechado",
    descricao: "Um deal chegou a Sinal pago.",
    tom: "ok" as const,
  },
] as const;

export type EventoId = (typeof EVENTOS)[number]["id"];
export type Canais = { inapp: boolean; email: boolean; whatsapp: boolean };
export type MatrizCanais = Record<string, Canais>;
export type Severidades = Record<string, "critico" | "atencao">;

export const DEFAULT_CANAIS: MatrizCanais = {
  lead_aguardando_aprovacao: { inapp: true, email: true, whatsapp: true },
  monitor_critico: { inapp: true, email: true, whatsapp: false },
  monitor_atencao: { inapp: true, email: false, whatsapp: false },
  reuniao_confirmada: { inapp: true, email: false, whatsapp: true },
  contrato_fechado: { inapp: true, email: true, whatsapp: false },
};

export interface ConfigNotificacoes {
  canais: MatrizCanais;
  severidades: Severidades;
  /** Checks que o monitor conhece, para a tela listar sem hardcode. */
  checksConhecidos: string[];
}
