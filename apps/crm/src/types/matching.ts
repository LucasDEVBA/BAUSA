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
    color: "text-sys-green",
    bg: "bg-sys-green/10",
    border: "border-sys-green/30",
    scoreMin: 80,
  },
  forte: {
    label: "Match Forte",
    color: "text-sys-blue",
    bg: "bg-sys-blue/10",
    border: "border-sys-blue/30",
    scoreMin: 60,
  },
  possivel: {
    label: "Match Possível",
    color: "text-sys-orange",
    bg: "bg-sys-orange/10",
    border: "border-sys-orange/30",
    scoreMin: 40,
  },
  fraco: {
    label: "Match Fraco",
    color: "text-sys-red",
    bg: "bg-sys-red/10",
    border: "border-sys-red/30",
    scoreMin: 0,
  },
};

export function getMatchClassification(score: number): MatchClassification {
  if (score >= 80) return "excelente";
  if (score >= 60) return "forte";
  if (score >= 40) return "possivel";
  return "fraco";
}
