/**
 * Default do CRITÉRIO do gate de intenção do chatbot AUTÔNOMO de WhatsApp —
 * editável pelo CEO em configuracoes_sistema.chatbot_autonomo_criterio (campo
 * `criterio`; vazio/ausente = este default). Fail-open: sem o override no banco,
 * a Cloud Function `chatbot-autonomo` usa o texto equivalente do próprio código.
 *
 * ESPELHO do CRITERIO_DEFAULT da CF (functions/chatbot-autonomo/index.js). É
 * apenas o texto exibido no editor da UI — a decisão real roda na CF (que tem
 * seu próprio default). Se um divergir do outro, a CF sempre vence.
 *
 * O tom/identidade da resposta NÃO vêm daqui — vêm da persona
 * (configuracoes_sistema.chatbot_persona), editável no card de Copiloto de
 * Conversa. Este critério define apenas QUANDO é seguro responder × escalar.
 */
export const CHATBOT_AUTONOMO_CRITERIO_DEFAULT =
  "Classifique a INTENÇÃO da última mensagem do lead e decida se é SEGURO responder " +
  "automaticamente. É SEGURO (segura=true) apenas para: acolhimento/primeiro contato, " +
  "dúvida geral sobre o serviço/metodologia, confirmar/relembrar reunião, reenviar o " +
  "link de agendamento, enviar o link da página. NÃO é seguro (segura=false → escalar " +
  "a um humano) para QUALQUER: preço, valores, investimento, mensalidade, desconto, " +
  "formas de pagamento, negociação, proposta, contrato, reclamação, insatisfação, " +
  "cancelamento, reembolso, pedido explícito de falar com uma pessoa/humano, assunto " +
  "jurídico/sensível, ou qualquer coisa que você não tenha certeza. Na menor dúvida, " +
  "segura=false.";
