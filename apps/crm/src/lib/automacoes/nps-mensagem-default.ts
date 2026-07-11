/**
 * Default do texto do WhatsApp da PESQUISA NPS (6 meses) — editável pelo CEO
 * em /automacoes (configuracoes_sistema.nps_mensagem.texto; vazio/ausente =
 * este default).
 *
 * Quem envia é a CF functions/experiencia-scheduler (diária, 10:00 BRT): ela
 * lê a config de PUBLIC com fail-open para o MESMO texto abaixo (duplicado lá
 * por ser deploy separado — manter os dois em sincronia ao editar o default).
 * Placeholders substituídos no envio: {{responsavel}} e {{atleta}}.
 */

export const NPS_MENSAGEM_DEFAULT =
  "Olá {{responsavel}}! Aqui é a equipe da Bolsa Atleta USA. 💙\n\n" +
  "Já são 6 meses de jornada do(a) {{atleta}} com a gente, e a sua opinião vale muito: " +
  "de 0 a 10, o quanto você recomendaria a BAUSA para outra família?\n\n" +
  "É só responder esta mensagem com a nota. Obrigado! 🙏";

export const NPS_MENSAGEM_VARIAVEIS = ["{{responsavel}}", "{{atleta}}"];
