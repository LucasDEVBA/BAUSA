/**
 * Automações — tipos do builder (fluxo gatilho → condições → ações) e dos runs.
 * Espelha a migration 20260703232151_automacoes_builder.sql (TEXT + CHECK no banco).
 */

// ─── Gatilhos ────────────────────────────────────────────────────────────────

/** Gatilhos de EVENTO são materializados por trigger no banco; os de TEMPO são
 *  avaliados pela engine (Cloud Function `automation-engine`) a cada ciclo. */
export type AutomacaoGatilho =
  | "lead_qualificado"
  | "deal_etapa_mudou"
  | "reuniao_marcada"
  | "temperatura_vermelha"
  | "deal_parado_etapa"
  | "parcela_vencendo"
  | "parcela_atrasada"
  | "familia_sem_contato"
  | "tarefa_vencida"
  | "agendamento";

export type AgendamentoFrequencia = "diaria" | "semanal" | "mensal";

/** Config do gatilho `agendamento` (recorrente, hora de parede BRT).
 *  Runs de agendamento NÃO têm lead/deal no contexto: ações de WhatsApp/
 *  mover deal viram 'ignorado' na engine — os usos são criar tarefa e
 *  criar notificação (rotinas recorrentes). */
export interface GatilhoAgendamentoConfig {
  frequencia: AgendamentoFrequencia;
  /** Hora BRT do disparo (0-23) — a engine roda 1x/hora (min 30). */
  hora: number;
  /** Dia da semana (0=domingo … 6=sábado) — só frequência semanal. */
  dia_semana?: number;
  /** Dia do mês (1-28, evita meses curtos) — só frequência mensal. */
  dia_mes?: number;
}

export interface GatilhoInfo {
  label: string;
  descricao: string;
  origem: "evento" | "tempo";
  /** Campo numérico de configuração (ex.: dias) exibido no builder. */
  configDias?: { label: string; padrao: number };
  /** Gatilho `agendamento`: builder mostra frequência/hora/dia no lugar de dias. */
  configAgendamento?: boolean;
}

export const GATILHO_CATALOG: Record<AutomacaoGatilho, GatilhoInfo> = {
  lead_qualificado: {
    label: "Lead qualificado",
    descricao: "Novo lead QUENTE/MORNO entrou no pipeline (deal criado).",
    origem: "evento",
  },
  deal_etapa_mudou: {
    label: "Deal mudou de etapa",
    descricao: "Um deal foi movido no pipeline (qualquer transição).",
    origem: "evento",
  },
  reuniao_marcada: {
    label: "Reunião marcada",
    descricao: "Deal chegou na etapa reunião marcada.",
    origem: "evento",
  },
  temperatura_vermelha: {
    label: "Família em temperatura vermelha",
    descricao: "A temperatura da experiência mudou para vermelho.",
    origem: "evento",
  },
  deal_parado_etapa: {
    label: "Deal parado na etapa",
    descricao: "Deal sem mudança de etapa há mais de X dias.",
    origem: "tempo",
    configDias: { label: "Dias parado", padrao: 4 },
  },
  parcela_vencendo: {
    label: "Parcela vencendo",
    descricao: "Parcela pendente vence em X dias (régua preventiva, ex.: D-3).",
    origem: "tempo",
    configDias: { label: "Dias antes do vencimento", padrao: 3 },
  },
  parcela_atrasada: {
    label: "Parcela atrasada",
    descricao: "Parcela vencida há X dias sem pagamento (ex.: D+1, D+7, D+15).",
    origem: "tempo",
    configDias: { label: "Dias de atraso", padrao: 1 },
  },
  familia_sem_contato: {
    label: "Família sem contato",
    descricao: "Família ativa sem registro de contato há mais de X dias.",
    origem: "tempo",
    configDias: { label: "Dias sem contato", padrao: 7 },
  },
  tarefa_vencida: {
    label: "Tarefa vencida",
    descricao: "Tarefa pendente com prazo estourado há X dias.",
    origem: "tempo",
    configDias: { label: "Dias após o prazo", padrao: 1 },
  },
  agendamento: {
    label: "Agendamento recorrente",
    descricao:
      "Dispara em horário fixo (diário, semanal ou mensal) — rotina sem lead/deal: use criar tarefa/notificação.",
    origem: "tempo",
    configAgendamento: true,
  },
};

// ─── Condições ───────────────────────────────────────────────────────────────

export type CondicaoOperador = "eq" | "neq" | "in" | "gt" | "gte" | "lt" | "lte";

export interface AutomacaoCondicao {
  campo: string;
  operador: CondicaoOperador;
  valor: string | number | string[];
}

export interface CondicaoCampoInfo {
  label: string;
  /** Gatilhos em que o campo faz sentido (contexto disponível na engine). */
  gatilhos: AutomacaoGatilho[];
  tipo: "select" | "numero";
  opcoes?: { value: string; label: string }[];
}

export const OPERADOR_LABEL: Record<CondicaoOperador, string> = {
  eq: "é",
  neq: "não é",
  in: "é um de",
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
};

// ─── Ações ───────────────────────────────────────────────────────────────────

export type AutomacaoAcaoTipo =
  | "criar_tarefa"
  | "criar_notificacao"
  | "enviar_whatsapp"
  | "enviar_whatsapp_custom"
  | "mover_deal";

export interface AcaoCriarTarefa {
  tipo: "criar_tarefa";
  parametros: {
    titulo: string;
    descricao?: string;
    prioridade: "critica" | "alta" | "media" | "baixa";
    prazo_dias: number;
    responsavel_id: string;
  };
}

export interface AcaoCriarNotificacao {
  tipo: "criar_notificacao";
  parametros: {
    titulo: string;
    mensagem: string;
    severidade: "critica" | "alta" | "media" | "baixa";
    destinatario: "ceo" | "head_sucesso" | "responsavel";
  };
}

/** Templates = messageType do contrato da CF send-whatsapp. A engine reaplica a
 *  elegibilidade (QUENTE/MORNO, timing, colunas *_sent_at com CAS) — a ação
 *  nunca burla os invariantes. meeting_confirmed não é suportado (exige
 *  customMessage/phone no send-whatsapp; sem eles cairia no template errado). */
export interface AcaoEnviarWhatsapp {
  tipo: "enviar_whatsapp";
  parametros: {
    template:
      | "initial"
      | "followup_1"
      | "followup_2"
      | "early_potential"
      | "late_timing"
      | "scheduled_return";
  };
}

/** Texto livre via caminho de mensagem custom do send-whatsapp (customMessage
 *  + phone). A engine reaplica a classe: só QUENTE/MORNO recebem — FRIO nunca,
 *  nem custom. Destinatário MVP: responsável (guardian_whatsapp do lead).
 *  Placeholders suportados: {atleta_nome} e {responsavel_nome}. */
export interface AcaoEnviarWhatsappCustom {
  tipo: "enviar_whatsapp_custom";
  parametros: {
    mensagem: string;
    destinatario: "responsavel";
  };
}

/** mover_deal exige next_action (regra inviolável nº 2 do BUSINESS_RULES). */
export interface AcaoMoverDeal {
  tipo: "mover_deal";
  parametros: {
    etapa_destino: string;
    next_action: string;
    proxima_acao_dias: number;
  };
}

export type AutomacaoAcao =
  | AcaoCriarTarefa
  | AcaoCriarNotificacao
  | AcaoEnviarWhatsapp
  | AcaoEnviarWhatsappCustom
  | AcaoMoverDeal;

export const ACAO_CATALOG: Record<AutomacaoAcaoTipo, { label: string; descricao: string }> = {
  criar_tarefa: {
    label: "Criar tarefa",
    descricao: "Cria tarefa com responsável, prioridade e prazo relativo.",
  },
  criar_notificacao: {
    label: "Notificar",
    descricao: "Notificação in-app para CEO, Head ou responsável.",
  },
  enviar_whatsapp: {
    label: "Enviar WhatsApp",
    descricao: "Dispara template aprovado via send-whatsapp (respeita elegibilidade).",
  },
  enviar_whatsapp_custom: {
    label: "WhatsApp custom",
    descricao: "Texto livre ao responsável do lead — só QUENTE/MORNO recebem.",
  },
  mover_deal: {
    label: "Mover deal",
    descricao: "Move o deal de etapa (exige próxima ação definida).",
  },
};

// ─── Entidades ───────────────────────────────────────────────────────────────

export type AutomacaoRunStatus = "pendente" | "executando" | "sucesso" | "erro" | "ignorado";

export interface Automacao {
  id: string;
  nome: string;
  descricao: string | null;
  gatilho: AutomacaoGatilho;
  gatilho_config: Record<string, number | string>;
  condicoes: AutomacaoCondicao[];
  acoes: AutomacaoAcao[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomacaoRun {
  id: string;
  automacao_id: string;
  status: AutomacaoRunStatus;
  gatilho_origem_tabela: string | null;
  gatilho_origem_id: string | null;
  contexto: Record<string, unknown>;
  resultado: Record<string, unknown>;
  tentativas: number;
  proxima_tentativa_at: string | null;
  executado_at: string | null;
  created_at: string;
}

/** Resumo por automação exibido na lista (Fase A: contagens; Fase C: timeline). */
export interface AutomacaoComStats extends Automacao {
  runs_total: number;
  runs_sucesso: number;
  runs_erro: number;
  runs_pendente: number;
  ultimo_run_at: string | null;
}

/** Run enriquecido p/ a aba Execuções (embed do nome/gatilho da automação). */
export interface AutomacaoRunDetalhado extends AutomacaoRun {
  automacoes: { nome: string; gatilho: AutomacaoGatilho } | null;
}
