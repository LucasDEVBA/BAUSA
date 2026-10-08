import type {
  AgressividadeBolsa,
  InfluenciaEsporte,
  NivelIngles,
  PerfilEscola,
  StatusEscola,
  TemperaturaRelacionamento,
  TipoEscola,
} from "@/components/escolas/school-options";

/**
 * Histórico BAUSA da escola — derivado de estrategia_escolas pela view
 * `escolas_historico_bausa` (buckets mutuamente exclusivos: somam
 * atletas_total). Substitui as colunas mortas total_aplicados/total_aceitos/
 * bolsa_media_obtida/tempo_medio_resposta, que nenhum código alimenta.
 */
export interface HistoricoEscola {
  atletas_total: number;
  em_andamento: number;
  em_planejamento: number;
  aceitos: number;
  recusados: number;
  /** Quantos aceites têm bolsa_obtida_pct preenchida. */
  bolsas_informadas: number;
  /** Soma de bolsa_obtida_pct dos aceites (p/ média ponderada global). */
  bolsa_obtida_pct_soma: number | null;
  /** Média de bolsa_obtida_pct dos aceites — null quando ninguém informou. */
  bolsa_media_obtida_pct: number | null;
}

/**
 * Escola como a tela /escolas usa: nomes e valores CRUS do banco (sem camada
 * de tradução — a tradução antiga gerou o vocabulário de universidade e os
 * valores inventados). NULL continua NULL; a apresentação decide o rótulo.
 */
export interface School {
  id: string;
  nome: string;
  cidade: string;
  estado_us: string;
  tipo: TipoEscola;
  perfil: PerfilEscola | null;
  status: StatusEscola;
  website: string | null;
  link_inscricao: string | null;
  link_plano_saude: string | null;
  budget_minimo_usd: number | null;
  budget_forte_usd: number | null;
  agressividade_bolsa: AgressividadeBolsa | null;
  ingles_minimo: NivelIngles | null;
  nota_minima_duolingo: number | null;
  gpa_minimo: number | null;
  testes_exigidos: string[];
  esportes_oferecidos: string[];
  influencia_esporte: InfluenciaEsporte | null;
  aceita_excecao_elite: boolean;
  /** TEXT no banco — normalmente um de SERIE_VALUES, mas não é garantido por CHECK. */
  serie_maxima: string | null;
  rolling_admission: boolean;
  deadline_fall: string | null;
  deadline_spring: string | null;
  admissions_officer_nome: string | null;
  admissions_officer_email: string | null;
  admissions_officer_telefone: string | null;
  temperatura_relacionamento: TemperaturaRelacionamento | null;
  ultimo_contato_at: string | null;
  regra_pratica: string | null;
  notas_internas: string | null;
  updated_at: string;
  historico: HistoricoEscola;
}

/** Linha de historico_contatos_escola (colunas reais: `data` e `tipo`). */
export interface ContatoEscola {
  id: string;
  escola_id: string;
  data: string;
  tipo: string;
  resumo: string;
  created_at: string;
}

export interface SchoolStageStrategy {
  id: string;
  deal_id: string;
  athlete_name: string;
  school_id: string;
  school_name: string;
  priority: number;
  status: "pre_acordada" | "rede_ativa" | "planejamento" | "observacao_futura";
  estimated_scholarship_usd: number;
  notes?: string;
}

export const STAGE_STRATEGY_STATUS_CONFIG = {
  pre_acordada: { label: "Pré-acordada", color: "text-sys-green", bg: "bg-sys-green/15 border-sys-green/20" },
  rede_ativa: { label: "Rede Ativa", color: "text-primary", bg: "bg-primary/15 border-primary/20" },
  planejamento: { label: "Planejamento", color: "text-sys-orange", bg: "bg-sys-orange/15 border-sys-orange/20" },
  observacao_futura: { label: "Observação Futura", color: "text-muted-foreground", bg: "bg-secondary border-border" },
};
