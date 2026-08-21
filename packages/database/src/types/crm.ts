export type PapelUsuario = 'ceo' | 'head_sucesso' | 'comercial';

export type StatusDeal =
  | 'contato_feito'
  | 'lead' | 'aguardando_timing' | 'reuniao_marcada' | 'reuniao_realizada'
  | 'diagnostico_fit' | 'alinhamento_estrategico' | 'proposta_enviada'
  | 'followup_proposta' | 'negociacao' | 'contrato_enviado'
  | 'contrato_assinado' | 'sinal_pago' | 'admission_process'
  | 'concluido' | 'perdido' | 'cancelamento_solicitado' | 'projeto_futuro';

export type ClassificacaoLead = 'hot' | 'warm' | 'cold';
export type StatusParcela = 'previsto' | 'recebido' | 'atrasado' | 'cancelado';
export type TemperaturaFamilia = 'verde' | 'amarelo' | 'vermelho';
export type PrioridadeTarefa = 'critica' | 'alta' | 'media' | 'baixa';
export type StatusTarefa = 'pendente' | 'em_andamento' | 'concluida' | 'atrasada' | 'cancelada';
export type DecisaoFamiliar = 'decidida' | 'em_discussao' | 'resistente';
export type MotivoPerda = 'financeiro' | 'timing' | 'desistencia_familia' | 'atleta_nao_qualificado' | 'concorrencia' | 'outro';
export type OrigemLead = 'formulario_web' | 'indicacao' | 'instagram' | 'meta_ads' | 'outro';

export interface UserProfile {
  id: string;
  papel: PapelUsuario;
  nome: string;
  email: string;
  ativo: boolean;
  avatar_url: string | null;
  preferencias_notificacao: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Responsavel {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  telefone_alternativo: string | null;
  profissao: string | null;
  parentesco: string | null;
  endereco_id: string | null;
  consentimento_lgpd: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Atleta {
  id: string;
  nome_completo: string;
  data_nascimento: string;
  whatsapp: string;
  email: string | null;
  instagram: string | null;
  esporte: string;
  posicao: string | null;
  nivel_competitivo: string;
  nivel_ingles: string;
  desempenho_academico: string;
  serie_escolar: string;
  escola_atual: string | null;
  cidade_estado: string;
  video_highlights_url: string | null;
  historico_clubes: string | null;
  conquistas: string | null;
  modelo_educacional: string | null;
  momento_inicio: string;
  comprometimento: string;
  decisao_familiar: DecisaoFamiliar;
  faixa_investimento: string;
  direcao_projeto: string | null;
  safra: string;
  lead_score: number | null;
  lead_classificacao: ClassificacaoLead | null;
  lead_score_calculado_at: string | null;
  responsavel_id: string;
  form_submission_id: string | null;
  origem: OrigemLead;
  indicado_por_id: string | null;
  consentimento_lgpd: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
}

export interface Deal {
  id: string;
  atleta_id: string;
  etapa: StatusDeal;
  etapa_anterior: StatusDeal | null;
  responsavel_id: string;
  valor_estimado: number | null;
  probabilidade_fechamento: number | null;
  status_decisao_familia: DecisaoFamiliar | null;
  notas_reuniao: string | null;
  next_action: string | null;
  data_proxima_acao: string | null;
  motivo_perda: MotivoPerda | null;
  detalhe_perda: string | null;
  pode_reativar: boolean | null;
  data_reativacao: string | null;
  motivo_retrocesso: string | null;
  flag_retrocedido: boolean;
  flag_valores_customizados: boolean;
  reuniao_realizada_at: string | null;
  contrato_assinado_at: string | null;
  sinal_pago_at: string | null;
  safra: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
}

export interface DealWithRelations extends Deal {
  atleta: Atleta;
  responsavel_usuario: UserProfile;
}

export interface FormSubmission {
  id: string;
  submission_id: string | null;
  submitted_at: string;
  email: string;
  athlete_name: string;
  birth_date: string | null;
  city_state: string | null;
  position: string | null;
  club_history: string | null;
  achievements: string | null;
  video_link: string | null;
  instagram: string | null;
  school_year: string | null;
  current_school: string | null;
  english_level: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_whatsapp: string | null;
  guardian_profession: string | null;
  family_address: string | null;
  investment_range: string | null;
  status: string;
  qualified: boolean | null;
  qualification_classification: string | null;
  qualification_reason: string | null;
  address_country: string | null;
}

export interface AuditLog {
  id: string;
  tabela: string;
  registro_id: string;
  operacao: 'INSERT' | 'UPDATE' | 'DELETE';
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  campos_alterados: string[] | null;
  user_id: string | null;
  user_papel: string | null;
  created_at: string;
}

// Labels amigáveis para as etapas do pipeline
export const ETAPA_LABELS: Record<StatusDeal, string> = {
  contato_feito: 'Contato feito',
  lead: 'Lead',
  aguardando_timing: 'Aguardando Timing',
  reuniao_marcada: 'Reunião Marcada',
  reuniao_realizada: 'Reunião Realizada',
  diagnostico_fit: 'Diagnóstico / Fit',
  alinhamento_estrategico: 'Alinhamento',
  proposta_enviada: 'Proposta Enviada',
  followup_proposta: 'Follow-up Proposta',
  negociacao: 'Negociação',
  contrato_enviado: 'Contrato Enviado',
  contrato_assinado: 'Contrato Assinado',
  sinal_pago: 'Sinal Pago',
  admission_process: 'Admission Process',
  concluido: 'Concluído',
  perdido: 'Perdido',
  cancelamento_solicitado: 'Cancelamento',
  projeto_futuro: 'Projeto Futuro',
};

// Ordem das etapas (para detectar retrocesso)
export const ETAPA_ORDEM: Record<StatusDeal, number> = {
  contato_feito: 1,
  lead: 2,
  aguardando_timing: 2,
  reuniao_marcada: 3,
  reuniao_realizada: 4,
  diagnostico_fit: 5,
  alinhamento_estrategico: 6,
  proposta_enviada: 7,
  followup_proposta: 8,
  negociacao: 9,
  contrato_enviado: 10,
  contrato_assinado: 11,
  sinal_pago: 12,
  admission_process: 13,
  concluido: 14,
  perdido: 15,
  cancelamento_solicitado: 16,
  projeto_futuro: 17,
};

// Etapas visíveis no Kanban (exclui perdido, concluido, cancelamento, projeto_futuro)
export const PIPELINE_ETAPAS: StatusDeal[] = [
  'contato_feito', 'lead', 'aguardando_timing', 'reuniao_marcada', 'reuniao_realizada', 'diagnostico_fit',
  'alinhamento_estrategico', 'proposta_enviada', 'followup_proposta',
  'negociacao', 'contrato_enviado', 'contrato_assinado', 'sinal_pago',
  'admission_process',
];

// Cores dos badges
export const CLASSIFICACAO_COLORS: Record<ClassificacaoLead, { bg: string; text: string }> = {
  hot: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  warm: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  cold: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' },
};

export interface ContratoFinanceiro {
  id: string;
  deal_id: string;
  plano: 'journey' | 'legacy' | 'start';
  forma_pagamento_plano: 'padrao' | 'pix_avista';
  valor_total: number;
  valor_customizado: number | null;
  justificativa_customizacao: string | null;
  entrada_valor: number;
  entrada_forma: 'pix' | 'getnet_parcelado';
  entrada_parcelas: number;
  entrada_paga: boolean;
  entrada_paga_at: string | null;
  saldo_remanescente: number;
  saldo_forma: 'pix_avista' | 'getnet_parcelado' | null;
  saldo_parcelas: number | null;
  inclui_psicologa: boolean;
  custo_psicologa: number;
  lucro_estimado: number | null;
  nf_status: 'pendente' | 'emitida' | 'nao_aplicavel';
  nf_numero: string | null;
  nf_emitida_at: string | null;
  nf_valor: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Parcela {
  id: string;
  contrato_id: string;
  tipo: 'entrada' | 'saldo';
  numero_parcela: string;
  valor: number;
  vencimento: string;
  metodo: 'pix' | 'getnet';
  status: 'previsto' | 'recebido' | 'atrasado' | 'cancelado';
  recebido_at: string | null;
  comprovante_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  responsavel_id: string;
  prazo: string;
  prioridade: 'critica' | 'alta' | 'media' | 'baixa';
  status: 'pendente' | 'em_andamento' | 'concluida' | 'atrasada' | 'cancelada';
  deal_id: string | null;
  atleta_id: string | null;
  experiencia_id: string | null;
  modulo_origem: 'comercial' | 'experiencia' | 'financeiro' | 'admissao';
  criada_automaticamente: boolean;
  recorrencia: 'nenhuma' | 'diaria' | 'semanal' | 'mensal';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Notificacao {
  id: string;
  destinatario_id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  severidade: 'critica' | 'alta' | 'media' | 'baixa';
  lida: boolean;
  lida_at: string | null;
  deal_id: string | null;
  link: string | null;
  created_at: string;
}

export type TipoCrise = 'emocional' | 'academica' | 'financeira' | 'familiar' | 'bullying' | 'saude';
export type NivelCrise = 'baixo' | 'medio' | 'alto' | 'critico';

export interface CrmExperiencia {
  id: string;
  atleta_id: string;
  deal_id: string;
  fase: string;
  temperatura: 'verde' | 'amarelo' | 'vermelho';
  ansiedade: number;
  satisfacao: number;
  risco_percebido: number;
  status: 'satisfeita' | 'atencao' | 'crise';
  descricao_problema: string | null;
  acao_em_andamento: string | null;
  tipo_crise: TipoCrise | null;
  nivel_crise: NivelCrise | null;
  psicologa_acionada: boolean;
  psicologa_acionada_at: string | null;
  data_ultimo_contato: string | null;
  tipo_ultimo_contato: string | null;
  proximo_contato: string | null;
  data_prevista_embarque: string | null;
  escola_confirmada_id: string | null;
  nps_6meses: number | null;
  nps_enviado_at: string | null;
  retencao_segundo_ano: boolean | null;
  indicacoes_geradas: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface NotaInterna {
  id: string;
  deal_id: string | null;
  atleta_id: string | null;
  experiencia_id: string | null;
  autor_id: string;
  conteudo: string;
  menciona_ids: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  autor?: { nome: string };
}

export const PLANO_VALORES = {
  journey: { padrao: 26000, pix: 23000, psicologa: true },
  legacy: { padrao: 32000, pix: 28500, psicologa: true },
  start: { padrao: 18000, pix: 16000, psicologa: false },
} as const;

export const ENTRADA_PADRAO = 4500;

export interface Escola {
  id: string;
  nome: string;
  estado_us: string;
  cidade: string;
  tipo: 'boarding' | 'day' | 'mista';
  status: 'ativa' | 'inativa' | 'em_analise';
  website: string | null;
  link_inscricao: string | null;
  link_plano_saude: string | null;
  notas_internas: string | null;
  budget_minimo_usd: number | null;
  budget_forte_usd: number | null;
  agressividade_bolsa: string | null;
  regra_pratica: string | null;
  ingles_minimo: string;
  testes_exigidos: string[];
  nota_minima_duolingo: number | null;
  nota_minima_psat: number | null;
  nota_minima_ssat: number | null;
  gpa_minimo: number | null;
  esportes_oferecidos: string[];
  influencia_esporte: string;
  aceita_excecao_elite: boolean;
  nota_esporte: string | null;
  series_preferenciais: string[];
  serie_maxima: string;
  deadline_fall: string | null;
  deadline_spring: string | null;
  rolling_admission: boolean;
  tempo_medio_resposta: number | null;
  total_aplicados: number;
  total_aceitos: number;
  taxa_aceitacao: number;
  bolsa_media_obtida: number | null;
  admissions_officer_nome: string | null;
  admissions_officer_email: string | null;
  admissions_officer_telefone: string | null;
  temperatura_relacionamento: string;
  ultimo_contato_at: string | null;
  proximo_contato_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EstrategiaEscola {
  id: string;
  atleta_id: string;
  escola_id: string;
  escola?: Escola;
  match_score: number | null;
  prioridade: 'primeira' | 'segunda' | 'terceira' | 'safety' | null;
  status: string;
  bolsa_estimada_pct: number | null;
  bolsa_estimada_valor: number | null;
  bolsa_obtida_pct: number | null;
  bolsa_obtida_valor: number | null;
  data_aplicacao: string | null;
  data_resposta: string | null;
  resultado: string;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const MATCH_LABELS = {
  excelente: { label: 'Match Excelente', color: 'text-green-600', bg: 'bg-green-100', range: '85-100' },
  forte: { label: 'Match Forte', color: 'text-blue-600', bg: 'bg-blue-100', range: '70-84' },
  possivel: { label: 'Match Possivel', color: 'text-amber-600', bg: 'bg-amber-100', range: '50-69' },
  fraco: { label: 'Match Fraco', color: 'text-red-600', bg: 'bg-red-100', range: '0-49' },
} as const;

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
] as const;

export interface DocumentoAtleta {
  id: string;
  atleta_id: string;
  escola_id: string | null;
  tipo: string;
  status: 'pendente' | 'enviado_atleta' | 'revisado' | 'enviado_escola' | 'aprovado';
  arquivo_url: string | null;
  arquivo_nome: string | null;
  data_upload: string | null;
  data_envio_escola: string | null;
  deadline: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface FaqArtigo {
  id: string;
  titulo: string;
  categoria: string;
  conteudo: string;
  fases_aplicaveis: string[];
  acessos: number;
  arquivado: boolean;
  criado_por: string | null;
  atualizado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface Indicacao {
  id: string;
  responsavel_indicador_id: string;
  atleta_indicado_id: string;
  status: 'pendente' | 'em_negociacao' | 'convertido' | 'perdido';
  recompensa_devida: boolean;
  recompensa_entregue: boolean;
  recompensa_entregue_at: string | null;
  recompensa_descricao: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const DOCUMENTO_TIPOS = [
  { value: 'historico_escolar', label: 'Historico Escolar' },
  { value: 'passaporte', label: 'Passaporte' },
  { value: 'video_highlights', label: 'Video Highlights' },
  { value: 'carta_recomendacao', label: 'Carta de Recomendacao' },
  { value: 'resultado_teste', label: 'Resultado de Teste' },
  { value: 'formulario_aplicacao', label: 'Formulario de Aplicacao' },
  { value: 'certidao_vacinacao', label: 'Certidao de Vacinacao' },
  { value: 'comprovante_financeiro', label: 'Comprovante Financeiro' },
  { value: 'outro', label: 'Outro' },
] as const;

export const FAQ_CATEGORIAS = [
  { value: 'visto', label: 'Visto' },
  { value: 'documentacao', label: 'Documentacao' },
  { value: 'embarque', label: 'Embarque' },
  { value: 'adaptacao', label: 'Adaptacao' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'escola', label: 'Escola' },
  { value: 'saude', label: 'Saude' },
  { value: 'outros', label: 'Outros' },
] as const;
