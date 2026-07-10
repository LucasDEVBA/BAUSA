import type { PrioridadeTarefa, QuadroColuna, StatusTarefa } from "@/types/crm";

export const COLUNAS_CONFIG: {
  key: QuadroColuna;
  label: string;
  dot: string;
}[] = [
  { key: "backlog", label: "Backlog", dot: "bg-label-tertiary" },
  { key: "a_fazer", label: "A fazer", dot: "bg-sys-blue" },
  { key: "fazendo", label: "Fazendo", dot: "bg-sys-orange" },
  { key: "feito", label: "Feito", dot: "bg-sys-green" },
];

export const PRIORIDADE_ORDER: Record<PrioridadeTarefa, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

export const PRIORIDADE_CONFIG: Record<
  PrioridadeTarefa,
  { label: string; bg: string; text: string }
> = {
  critica: { label: "Crítica", bg: "bg-sys-red/15", text: "text-sys-red" },
  alta: { label: "Alta", bg: "bg-sys-orange/15", text: "text-sys-orange" },
  media: { label: "Média", bg: "bg-sys-blue/15", text: "text-sys-blue" },
  baixa: { label: "Baixa", bg: "bg-secondary", text: "text-muted-foreground" },
};

export const MODULO_CONFIG: Record<string, { label: string; color: string }> = {
  comercial: { label: "Comercial", color: "text-primary" },
  experiencia: { label: "Experiência", color: "text-plan-legacy" },
  financeiro: { label: "Financeiro", color: "text-sys-green" },
  admissao: { label: "Admissão", color: "text-sys-orange" },
};

export type RecorrenciaTarefa = "nenhuma" | "diaria" | "semanal" | "mensal";

export const RECORRENCIA_LABELS: Record<RecorrenciaTarefa, string> = {
  nenhuma: "Nenhuma",
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
};

export function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffDays = Math.round((date.getTime() - now.getTime()) / 86400000);
  if (diffDays < -1) return `${Math.abs(diffDays)} dias atrasada`;
  if (diffDays === -1) return "Ontem";
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  return `Em ${diffDays} dias`;
}

export function isOverdue(tarefa: { status: StatusTarefa; prazo: string }): boolean {
  if (tarefa.status === "concluida" || tarefa.status === "cancelada") return false;
  return new Date(tarefa.prazo) < new Date();
}

// Comentários são embutidos na descrição (uma linha por comentário).
export const COMMENT_REGEX = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) - (.+?)\] (.+)$/;

export function parseComments(
  descricao: string | null,
): { date: string; author: string; text: string }[] {
  if (!descricao) return [];
  return descricao.split("\n").reduce<{ date: string; author: string; text: string }[]>(
    (acc, line) => {
      const match = line.match(COMMENT_REGEX);
      if (match) acc.push({ date: match[1], author: match[2], text: match[3] });
      return acc;
    },
    [],
  );
}

export function getDescriptionWithoutComments(descricao: string | null): string {
  if (!descricao) return "";
  return descricao
    .split("\n")
    .filter((line) => !COMMENT_REGEX.test(line))
    .join("\n")
    .trim();
}

/** Linhas brutas de comentário (para recompor a descrição preservando o histórico). */
export function getCommentLines(descricao: string | null): string[] {
  if (!descricao) return [];
  return descricao.split("\n").filter((line) => COMMENT_REGEX.test(line));
}

export function buildCommentLine(author: string, text: string): string {
  const now = new Date();
  const dateStr =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-` +
    `${String(now.getDate()).padStart(2, "0")} ` +
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return `[${dateStr} - ${author}] ${text}`;
}
