/**
 * Builder de automações — estado, catálogos de UI e resumos compartilhados
 * entre a visão Fluxo (FlowCanvas) e a visão Formulário (BuilderForms).
 * Extraído do antigo BuilderModal para as duas visões usarem a MESMA fonte.
 */

import {
  GATILHO_CATALOG,
  OPERADOR_LABEL,
  type AgendamentoFrequencia,
  type Automacao,
  type AutomacaoAcao,
  type AutomacaoAcaoTipo,
  type AutomacaoCondicao,
  type AutomacaoGatilho,
} from "@/types/automacao";
import { ETAPA_LABELS } from "@/types/crm";

// ─── Constantes de UI ────────────────────────────────────────────────────────

export const FIELD_CLASS =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-placeholder outline-none focus:border-primary/40";
export const SECTION_LABEL = "text-eyebrow text-label-tertiary";

export const ETAPA_OPCOES = Object.entries(ETAPA_LABELS).map(([value, label]) => ({
  value,
  label,
}));

/** Label de etapa segura para exibição (ETAPA_LABELS é Record<StatusDeal, …>). */
export function etapaLabel(etapa: string): string {
  return ETAPA_OPCOES.find((o) => o.value === etapa)?.label ?? etapa;
}

export interface CondicaoCampoUI {
  value: string;
  label: string;
  gatilhos: AutomacaoGatilho[];
  opcoes?: { value: string; label: string }[];
}

/** Campos de condição disponíveis por gatilho (contexto que a engine resolve). */
export const CONDICAO_CAMPOS: CondicaoCampoUI[] = [
  {
    value: "classificacao",
    label: "Classificação Gemini",
    gatilhos: ["lead_qualificado", "deal_etapa_mudou", "reuniao_marcada", "deal_parado_etapa"],
    opcoes: [
      { value: "QUENTE", label: "QUENTE" },
      { value: "MORNO", label: "MORNO" },
      { value: "FRIO", label: "FRIO" },
    ],
  },
  {
    value: "etapa_para",
    label: "Etapa de destino",
    gatilhos: ["deal_etapa_mudou"],
    opcoes: ETAPA_OPCOES,
  },
  {
    value: "etapa",
    label: "Etapa atual",
    gatilhos: ["deal_parado_etapa"],
    opcoes: ETAPA_OPCOES,
  },
  {
    value: "plano",
    label: "Plano contratado",
    gatilhos: ["parcela_vencendo", "parcela_atrasada", "familia_sem_contato"],
    opcoes: [
      { value: "Legacy", label: "Legacy" },
      { value: "Journey", label: "Journey" },
      { value: "Start", label: "Start" },
    ],
  },
  {
    value: "fase",
    label: "Fase da experiência",
    gatilhos: ["familia_sem_contato", "temperatura_vermelha"],
    opcoes: [
      { value: "admissao", label: "Admissão" },
      { value: "aprovado", label: "Aprovado" },
      { value: "pre_embarque", label: "Pré-embarque" },
      { value: "embarcado_inicial", label: "Embarcado" },
      { value: "acompanhamento", label: "Acompanhamento" },
    ],
  },
  {
    value: "prioridade",
    label: "Prioridade da tarefa",
    gatilhos: ["tarefa_vencida"],
    opcoes: [
      { value: "critica", label: "Crítica" },
      { value: "alta", label: "Alta" },
      { value: "media", label: "Média" },
      { value: "baixa", label: "Baixa" },
    ],
  },
];

export function camposCondicaoDoGatilho(gatilho: AutomacaoGatilho): CondicaoCampoUI[] {
  return CONDICAO_CAMPOS.filter((c) => c.gatilhos.includes(gatilho));
}

export const TEMPLATE_OPCOES: { value: string; label: string }[] = [
  { value: "initial", label: "Mensagem inicial (agendamento)" },
  { value: "followup_1", label: "Follow-up 1 (48h)" },
  { value: "followup_2", label: "Follow-up 2 (7 dias)" },
  { value: "early_potential", label: "Timing cedo (early potential)" },
  { value: "late_timing", label: "Timing tarde (late timing)" },
  { value: "scheduled_return", label: "Retomada agendada (novembro)" },
];

// Ação WhatsApp custom — espelha o Zod do servidor (10-1000 chars,
// placeholders {atleta_nome}/{responsavel_nome}).
export const WHATSAPP_CUSTOM_MIN = 10;
export const WHATSAPP_CUSTOM_MAX = 1000;
export const WHATSAPP_CUSTOM_VARIAVEIS = ["{atleta_nome}", "{responsavel_nome}"];

// Ação E-mail custom — espelha o Zod do servidor (assunto 3-150, mensagem
// 10-2000; mesmas variáveis, válidas no assunto E na mensagem).
export const EMAIL_CUSTOM_ASSUNTO_MIN = 3;
export const EMAIL_CUSTOM_ASSUNTO_MAX = 150;
export const EMAIL_CUSTOM_MENSAGEM_MIN = 10;
export const EMAIL_CUSTOM_MENSAGEM_MAX = 2000;

// Link/mídia das ações custom (I2) — espelha o Zod do servidor
// (título do card/botão 3-80; URLs http/https).
export const CUSTOM_LINK_TITULO_MIN = 3;
export const CUSTOM_LINK_TITULO_MAX = 80;

export const FREQUENCIA_OPCOES: { value: AgendamentoFrequencia; label: string }[] = [
  { value: "diaria", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
];

export const DIA_SEMANA_OPCOES = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

export interface UsuarioRow {
  id: string;
  nome: string;
  papel: string;
}

// ─── Estado do builder ───────────────────────────────────────────────────────

export interface BuilderState {
  id: string | null;
  nome: string;
  descricao: string;
  gatilho: AutomacaoGatilho;
  gatilhoDias: number;
  /** Config do gatilho agendamento (frequência + hora BRT + dia condicional). */
  agFrequencia: AgendamentoFrequencia;
  agHora: number;
  agDiaSemana: number;
  agDiaMes: number;
  condicoes: AutomacaoCondicao[];
  acoes: AutomacaoAcao[];
}

export function emptyBuilder(): BuilderState {
  return {
    id: null,
    nome: "",
    descricao: "",
    gatilho: "lead_qualificado",
    gatilhoDias: 3,
    agFrequencia: "diaria",
    agHora: 9,
    agDiaSemana: 1,
    agDiaMes: 1,
    condicoes: [],
    acoes: [],
  };
}

export function builderFromAutomacao(a: Automacao): BuilderState {
  const cfg = a.gatilho_config ?? {};
  const dias = cfg.dias;
  const frequencia = cfg.frequencia;
  return {
    id: a.id,
    nome: a.nome,
    descricao: a.descricao ?? "",
    gatilho: a.gatilho,
    gatilhoDias:
      typeof dias === "number" ? dias : GATILHO_CATALOG[a.gatilho].configDias?.padrao ?? 3,
    agFrequencia: frequencia === "semanal" || frequencia === "mensal" ? frequencia : "diaria",
    agHora: typeof cfg.hora === "number" ? cfg.hora : 9,
    agDiaSemana: typeof cfg.dia_semana === "number" ? cfg.dia_semana : 1,
    agDiaMes: typeof cfg.dia_mes === "number" ? cfg.dia_mes : 1,
    condicoes: a.condicoes,
    acoes: a.acoes,
  };
}

export function defaultAcao(tipo: AutomacaoAcaoTipo, usuarios: UsuarioRow[]): AutomacaoAcao {
  switch (tipo) {
    case "criar_tarefa":
      return {
        tipo,
        parametros: {
          titulo: "",
          prioridade: "alta",
          prazo_dias: 2,
          responsavel_id: usuarios[0]?.id ?? "",
        },
      };
    case "criar_notificacao":
      return {
        tipo,
        parametros: { titulo: "", mensagem: "", severidade: "alta", destinatario: "ceo" },
      };
    case "enviar_whatsapp":
      return { tipo, parametros: { template: "followup_1" } };
    case "enviar_whatsapp_custom":
      return { tipo, parametros: { mensagem: "", destinatario: "responsavel" } };
    case "enviar_email_custom":
      return { tipo, parametros: { assunto: "", mensagem: "", destinatario: "responsavel" } };
    case "mover_deal":
      return {
        tipo,
        parametros: { etapa_destino: "reuniao_marcada", next_action: "", proxima_acao_dias: 2 },
      };
  }
}

/** Normaliza os campos de link/mídia das ações custom antes de salvar:
 *  os forms editam strings ("" = ausente); o Zod do servidor espera os
 *  opcionais AUSENTES (z.string().url() rejeitaria string vazia). */
export function normalizarAcaoParaSalvar(acao: AutomacaoAcao): AutomacaoAcao {
  if (acao.tipo !== "enviar_whatsapp_custom" && acao.tipo !== "enviar_email_custom") {
    return acao;
  }
  const { imagem_url, link_url, link_titulo } = acao.parametros;
  return {
    ...acao,
    parametros: {
      ...acao.parametros,
      imagem_url: imagem_url?.trim() || undefined,
      link_url: link_url?.trim() || undefined,
      link_titulo: link_titulo?.trim() || undefined,
    },
  } as AutomacaoAcao;
}

// ─── Resumos (rótulos dos nós do fluxo) ──────────────────────────────────────

/** Resumo curto da config do gatilho — "Diária às 9h BRT", "Dias parado: 4"… */
export function resumoGatilho(builder: BuilderState): string {
  const info = GATILHO_CATALOG[builder.gatilho];
  if (info.configAgendamento) {
    const hora = `${builder.agHora}h BRT`;
    if (builder.agFrequencia === "semanal") {
      const dia =
        DIA_SEMANA_OPCOES.find((d) => d.value === builder.agDiaSemana)?.label ?? "Segunda-feira";
      return `Semanal · ${dia} às ${hora}`;
    }
    if (builder.agFrequencia === "mensal") {
      return `Mensal · dia ${builder.agDiaMes} às ${hora}`;
    }
    return `Diária às ${hora}`;
  }
  if (info.configDias) return `${info.configDias.label}: ${builder.gatilhoDias}`;
  return "Dispara no evento";
}

/** Resumo "campo operador valor" com labels amigáveis. */
export function resumoCondicao(cond: AutomacaoCondicao): string {
  const campo = CONDICAO_CAMPOS.find((c) => c.value === cond.campo);
  const valorStr = Array.isArray(cond.valor) ? cond.valor.join(", ") : String(cond.valor);
  const valorLabel = campo?.opcoes?.find((o) => o.value === valorStr)?.label ?? valorStr;
  return `${campo?.label ?? cond.campo} ${OPERADOR_LABEL[cond.operador]} ${valorLabel}`;
}

/** Resumo dos parâmetros da ação (título da tarefa, template, trecho…). */
export function resumoAcao(acao: AutomacaoAcao): string {
  switch (acao.tipo) {
    case "criar_tarefa":
      return acao.parametros.titulo
        ? `“${acao.parametros.titulo}”`
        : "Defina o título da tarefa";
    case "criar_notificacao":
      return acao.parametros.titulo
        ? `“${acao.parametros.titulo}”`
        : "Defina o título da notificação";
    case "enviar_whatsapp":
      return (
        TEMPLATE_OPCOES.find((t) => t.value === acao.parametros.template)?.label ??
        acao.parametros.template
      );
    case "enviar_whatsapp_custom": {
      const msg = acao.parametros.mensagem.trim();
      if (!msg) return "Escreva a mensagem";
      return msg.length > 48 ? `“${msg.slice(0, 48)}…”` : `“${msg}”`;
    }
    case "enviar_email_custom": {
      const assunto = acao.parametros.assunto.trim();
      if (!assunto) return "Defina o assunto do e-mail";
      return assunto.length > 48 ? `“${assunto.slice(0, 48)}…”` : `“${assunto}”`;
    }
    case "mover_deal":
      return `→ ${etapaLabel(acao.parametros.etapa_destino)}`;
  }
}
