/**
 * Health Score 0–100 (espelho client-side da função SQL
 * public.calcular_health_score). Permite mostrar o score no
 * Kanban sem chamada extra ao banco.
 *
 * Composição:
 *  • 40 pts: satisfação (1→0, 5→40)
 *  • 30 pts: ansiedade invertida (1→30, 5→0)
 *  • 15 pts: risco percebido invertido (1→15, 5→0)
 *  • 15 pts: contato recente (0d→15, 30d+→0)
 *
 * Penalidades:
 *  • status='crise' → -30
 *  • status='atencao' → -10
 *  • temperatura='vermelho' → -10
 *
 * Retorna inteiro [0,100].
 */
export interface HealthInput {
  ansiedade: number;
  satisfacao: number;
  risco_percebido: number;
  status: "satisfeita" | "atencao" | "crise";
  temperatura: "verde" | "amarelo" | "vermelho";
  dias_sem_contato: number | null;
}

export function calcularHealthScore(input: HealthInput): number {
  let score = 0;

  // Satisfação (0..40)
  score += (Math.max(1, Math.min(5, input.satisfacao)) - 1) * 10;

  // Ansiedade invertida (0..30)
  score += (5 - Math.max(1, Math.min(5, input.ansiedade))) * 7.5;

  // Risco percebido invertido (0..15)
  score += (5 - Math.max(1, Math.min(5, input.risco_percebido))) * 3.75;

  // Contato (0..15)
  const dias = Math.max(0, Math.min(30, input.dias_sem_contato ?? 30));
  score += (30 - dias) * 0.5;

  // Penalidades
  if (input.status === "crise") score -= 30;
  else if (input.status === "atencao") score -= 10;
  if (input.temperatura === "vermelho") score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export type HealthLevel = "excelente" | "bom" | "atencao" | "critico";

export function getHealthLevel(score: number): HealthLevel {
  if (score >= 75) return "excelente";
  if (score >= 55) return "bom";
  if (score >= 35) return "atencao";
  return "critico";
}

export const HEALTH_LABEL: Record<HealthLevel, string> = {
  excelente: "Excelente",
  bom: "Bom",
  atencao: "Atenção",
  critico: "Crítico",
};

export const HEALTH_COLOR: Record<HealthLevel, { bg: string; text: string; ring: string }> = {
  excelente: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    ring: "ring-emerald-500/30",
  },
  bom: {
    bg: "bg-blue-500/15",
    text: "text-blue-300",
    ring: "ring-blue-500/30",
  },
  atencao: {
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    ring: "ring-amber-500/30",
  },
  critico: {
    bg: "bg-red-500/15",
    text: "text-red-300",
    ring: "ring-red-500/30",
  },
};
