/**
 * Fluxos — motor de conversa multicanal (o "ManyChat" próprio).
 * Espelha a migration 20260813014726_fluxos_manychat.sql (TEXT + CHECK no banco).
 *
 * Princípio: o motor é AGNÓSTICO DE CANAL. O mesmo fluxo (gatilho → blocos
 * encadeados) roda em WhatsApp (Z-API, disponível hoje) e em Instagram
 * (depende do App Review de instagram_manage_messages).
 */

// ─── Canais ──────────────────────────────────────────────────────────────

export type FluxoCanal = "whatsapp" | "instagram";

export interface CanalInfo {
  label: string;
  /** false = a UI mostra o fluxo, mas avisa que o canal ainda não envia. */
  disponivel: boolean;
  /** Explicação honesta do que falta para o canal ficar ativo. */
  bloqueio?: string;
}

export const CANAL_CATALOG: Record<FluxoCanal, CanalInfo> = {
  whatsapp: { label: "WhatsApp", disponivel: true },
  instagram: {
    label: "Instagram",
    disponivel: false,
    bloqueio:
      "Aguardando App Review da permissão instagram_manage_messages. O fluxo pode ser montado e testado agora; o envio liga sozinho quando a Meta aprovar.",
  },
};

// ─── Gatilhos ────────────────────────────────────────────────────────────

export type FluxoGatilho =
  | "comentario_post"
  | "comentario_reels"
  | "novo_seguidor"
  | "resposta_story"
  | "mencao_story"
  | "dm_palavra_chave"
  | "dm_primeira_msg"
  | "link_ref"
  | "mensagem_palavra_chave"
  | "manual"
  | "agendado";

export interface GatilhoFluxoInfo {
  label: string;
  descricao: string;
  canais: FluxoCanal[];
  /** Gatilho usa lista de palavras-chave (contém / exato). */
  usaPalavras?: boolean;
  /** Gatilho pode ser restrito a um post/reel específico (id ou permalink). */
  usaPostAlvo?: boolean;
  /** Gatilho usa um código de referência (link ig.me?ref= / wa.me?text=). */
  usaRef?: boolean;
}

export const GATILHO_FLUXO_CATALOG: Record<FluxoGatilho, GatilhoFluxoInfo> = {
  comentario_post: {
    label: "Comentário em post",
    descricao:
      "Alguém comenta em um post do feed. Pode filtrar por palavra-chave e por post específico — o clássico \"comente EUA que eu te mando\".",
    canais: ["instagram"],
    usaPalavras: true,
    usaPostAlvo: true,
  },
  comentario_reels: {
    label: "Comentário em Reels",
    descricao: "Mesma mecânica do feed, mas restrito a Reels — costuma ter volume maior e público mais frio.",
    canais: ["instagram"],
    usaPalavras: true,
    usaPostAlvo: true,
  },
  novo_seguidor: {
    label: "Novo seguidor",
    descricao: "Dispara quando a conta ganha um seguidor. Boas-vindas + primeira pergunta de qualificação.",
    canais: ["instagram"],
  },
  resposta_story: {
    label: "Resposta a Story",
    descricao: "O usuário responde a qualquer Story (ou a um com palavra-chave). Alta intenção — vale puxar conversa.",
    canais: ["instagram"],
    usaPalavras: true,
  },
  mencao_story: {
    label: "Menção em Story",
    descricao: "Alguém marca o perfil no Story dele. Ótimo para prova social e para agradecer com oferta.",
    canais: ["instagram"],
  },
  dm_palavra_chave: {
    label: "DM com palavra-chave",
    descricao: "Mensagem direta contendo uma das palavras configuradas.",
    canais: ["instagram"],
    usaPalavras: true,
  },
  dm_primeira_msg: {
    label: "Primeira DM do contato",
    descricao: "A primeira vez que aquele contato manda mensagem — só dispara uma vez por pessoa.",
    canais: ["instagram"],
  },
  link_ref: {
    label: "Link de referência",
    descricao: "Entrada por link rastreável (ig.me/m/…?ref= ou wa.me/…?text=). Ideal para bio, anúncio e QR.",
    canais: ["instagram", "whatsapp"],
    usaRef: true,
  },
  mensagem_palavra_chave: {
    label: "Mensagem com palavra-chave",
    descricao: "Mensagem recebida no WhatsApp contendo uma das palavras configuradas.",
    canais: ["whatsapp"],
    usaPalavras: true,
  },
  manual: {
    label: "Disparo manual",
    descricao: "Você escolhe o contato e inicia o fluxo pela tela — útil para testar antes de ligar.",
    canais: ["whatsapp", "instagram"],
  },
  agendado: {
    label: "Agendado",
    descricao: "Roda em horário definido sobre uma lista de contatos com determinada tag.",
    canais: ["whatsapp", "instagram"],
  },
};

/** Como a palavra-chave é comparada com a mensagem recebida. */
export type MatchPalavra = "contem" | "exato" | "comeca_com";

export interface FluxoGatilhoConfig {
  palavras?: string[];
  match?: MatchPalavra;
  /** id ou permalink do post/reel (vazio = qualquer). */
  postAlvo?: string;
  /** código do link de referência. */
  ref?: string;
  /** gatilho `agendado`: hora BRT 0-23. */
  hora?: number;
  /** gatilho `agendado`: só contatos com esta tag. */
  tag?: string;
  /** Responder também no comentário público (além da DM). */
  responderComentario?: boolean;
  /** Texto da resposta pública ao comentário. */
  textoComentario?: string;
}

// ─── Blocos ──────────────────────────────────────────────────────────────

export type FluxoBlocoTipo =
  | "mensagem"
  | "pergunta"
  | "botoes"
  | "condicao"
  | "ia_resposta"
  | "ia_condicao"
  | "delay"
  | "tag"
  | "captura"
  | "handoff"
  | "acao_crm"
  | "fim";

export interface BlocoInfo {
  label: string;
  descricao: string;
  /** Bloco ramifica (usa `ramos` em vez de só `proximo_id`). */
  ramifica?: boolean;
  /** Bloco espera resposta do contato antes de seguir. */
  aguardaResposta?: boolean;
}

export const BLOCO_CATALOG: Record<FluxoBlocoTipo, BlocoInfo> = {
  mensagem: {
    label: "Mensagem",
    descricao: "Envia texto (com variáveis) e opcionalmente uma mídia.",
  },
  pergunta: {
    label: "Pergunta aberta",
    descricao: "Pergunta e guarda a resposta livre numa variável para usar depois.",
    aguardaResposta: true,
  },
  botoes: {
    label: "Pergunta com opções",
    descricao: "Oferece até 3 respostas rápidas e ramifica o fluxo conforme a escolha.",
    ramifica: true,
    aguardaResposta: true,
  },
  condicao: {
    label: "Condição",
    descricao: "Ramifica comparando uma variável capturada ou uma tag do contato.",
    ramifica: true,
  },
  ia_resposta: {
    label: "Resposta com IA",
    descricao: "Um agent responde com base no histórico da conversa. Sempre com texto de fallback.",
  },
  ia_condicao: {
    label: "Classificação por IA",
    descricao: "Um agent lê a conversa e escolhe um dos ramos (ex.: interessado / curioso / fora de perfil).",
    ramifica: true,
  },
  delay: {
    label: "Espera",
    descricao: "Pausa o fluxo por um tempo antes do próximo bloco — evita parecer robô e respeita o ritmo.",
  },
  tag: {
    label: "Etiqueta",
    descricao: "Adiciona ou remove tags do contato (segmentação para disparos futuros).",
  },
  captura: {
    label: "Captura para o funil",
    descricao:
      "Valida e grava e-mail/telefone/nome do contato — e opcionalmente cria o lead no funil. É o bloco que transforma conversa em pipeline.",
    aguardaResposta: true,
  },
  handoff: {
    label: "Passar para humano",
    descricao: "Encerra a automação e avisa o time — a conversa vira atendimento humano.",
  },
  acao_crm: {
    label: "Ação no CRM",
    descricao: "Cria tarefa, notificação ou move o deal de etapa.",
  },
  fim: { label: "Fim", descricao: "Encerra o fluxo com sucesso." },
};

/** Campo do funil que o bloco `captura` alimenta. */
export type CampoCaptura = "nome" | "email" | "telefone" | "instagram" | "livre";

export const CAMPO_CAPTURA_LABEL: Record<CampoCaptura, string> = {
  nome: "Nome",
  email: "E-mail",
  telefone: "Telefone / WhatsApp",
  instagram: "@ do Instagram",
  livre: "Campo livre",
};

export interface BlocoConteudo {
  /** mensagem / pergunta / botoes / captura */
  texto?: string;
  mediaUrl?: string;
  /** pergunta / captura: nome da variável onde a resposta é guardada. */
  variavel?: string;
  /** captura: qual campo do funil, com validação de formato. */
  campo?: CampoCaptura;
  /** captura: cria/atualiza o lead no funil ao capturar. */
  criarLead?: boolean;
  /** botoes: rótulos das opções (o ramo casa pelo rótulo). */
  opcoes?: string[];
  /** condicao: variável ou tag comparada. */
  campoComparado?: string;
  /** ia_resposta / ia_condicao: agent escolhido (opcional). */
  agentId?: string;
  /** ia_resposta / ia_condicao: prompt inline — SEMPRE obrigatório (fallback). */
  prompt?: string;
  /** ia_resposta: texto usado se a IA falhar ou não estiver configurada. */
  fallback?: string;
  /** ia_condicao: rótulos possíveis (viram os ramos). */
  rotulos?: string[];
  /** delay: minutos de espera. */
  minutos?: number;
  /** tag: tags a adicionar/remover. */
  adicionar?: string[];
  remover?: string[];
  /** handoff: para quem avisar. */
  destinatario?: string;
  /** acao_crm: o que fazer. */
  acao?: "criar_tarefa" | "criar_notificacao" | "mover_deal";
  etapa?: string;
  titulo?: string;
}

export interface FluxoRamo {
  /** Rótulo do botão, valor da condição ou classe da IA. */
  valor: string;
  blocoId: string | null;
}

export interface FluxoBloco {
  id: string;
  fluxoId: string;
  tipo: FluxoBlocoTipo;
  conteudo: BlocoConteudo;
  proximoId: string | null;
  ramos: FluxoRamo[];
  ordem: number;
}

// ─── Fluxo ───────────────────────────────────────────────────────────────

export interface Fluxo {
  id: string;
  nome: string;
  descricao: string | null;
  canal: FluxoCanal;
  gatilho: FluxoGatilho;
  gatilhoConfig: FluxoGatilhoConfig;
  blocoInicialId: string | null;
  ativo: boolean;
  limiteHora: number;
  reentradaHoras: number;
  criadoEm: string;
}

export type FluxoExecucaoStatus =
  | "ativa"
  | "aguardando_resposta"
  | "concluida"
  | "abandonada"
  | "erro"
  | "handoff";

export const EXECUCAO_STATUS_LABEL: Record<FluxoExecucaoStatus, string> = {
  ativa: "Em andamento",
  aguardando_resposta: "Aguardando resposta",
  concluida: "Concluída",
  abandonada: "Abandonada",
  erro: "Erro",
  handoff: "Passou para humano",
};

export type FluxoEventoTipo =
  | "entrou"
  | "bloco_executado"
  | "mensagem_enviada"
  | "resposta_recebida"
  | "botao_clicado"
  | "campo_capturado"
  | "lead_criado"
  | "tag_aplicada"
  | "handoff"
  | "abandonou"
  | "concluiu"
  | "erro";

// ─── Métricas ────────────────────────────────────────────────────────────

/** Funil por bloco: quantos chegaram e quantos seguiram (mede abandono). */
export interface BlocoMetrica {
  blocoId: string;
  tipo: FluxoBlocoTipo;
  rotulo: string;
  chegaram: number;
  seguiram: number;
  /** 0–1. null quando ninguém chegou. */
  taxaAvanco: number | null;
}

export interface FluxoMetricas {
  fluxoId: string;
  entradas: number;
  concluidas: number;
  emAndamento: number;
  abandonadas: number;
  handoffs: number;
  erros: number;
  respostas: number;
  capturas: number;
  leadsCriados: number;
  reunioes: number;
  /** 0–1 */
  taxaConclusao: number | null;
  taxaResposta: number | null;
  taxaCaptura: number | null;
  blocos: BlocoMetrica[];
}

/** Um dia da série de execuções (gráfico da tela de métricas). */
export interface FluxoDia {
  dia: string;
  entradas: number;
  concluidas: number;
  capturas: number;
}
