export type MatchClassification = "excelente" | "forte" | "possivel" | "fraco";

export interface SchoolMatch {
  school_id: string;
  school_name: string;
  school_type: string;
  school_state: string;
  school_city: string;
  score: number; // 0-100
  classification: MatchClassification;
  estimated_scholarship_pct: number;
  compatibility_notes: string[];
  blockers: string[];
}

export const MATCH_CLASSIFICATION_CONFIG: Record<
  MatchClassification,
  { label: string; color: string; bg: string; border: string; scoreMin: number }
> = {
  excelente: {
    label: "Match Excelente",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    scoreMin: 80,
  },
  forte: {
    label: "Match Forte",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    scoreMin: 60,
  },
  possivel: {
    label: "Match Possível",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    scoreMin: 40,
  },
  fraco: {
    label: "Match Fraco",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    scoreMin: 0,
  },
};

export function getMatchClassification(score: number): MatchClassification {
  if (score >= 80) return "excelente";
  if (score >= 60) return "forte";
  if (score >= 40) return "possivel";
  return "fraco";
}
