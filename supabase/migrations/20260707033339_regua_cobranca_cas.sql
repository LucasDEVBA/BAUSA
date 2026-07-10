-- ════════════════════════════════════════════════════════════════════════
-- Migration: Régua de cobrança F4.1 — colunas CAS em parcelas + mensagens
-- Aplica em: public (parcelas é public-only, como contratos_financeiros)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   A régua de cobrança (D-3 a D+15) existia só como CONFIG (regua_cobranca),
--   sem execução. Esta migration prepara a base para a Cloud Function
--   billing-reminders (F4.2): uma coluna timestamptz por marco, usada como
--   trava CAS (marca ANTES de enviar; PATCH filtra =is.null → nunca duplica),
--   e o texto editável das mensagens em configuracoes_sistema (regua_mensagens).
--
--   A régua NÃO é outreach de lead — os alvos são FAMÍLIAS COM CONTRATO
--   ASSINADO devendo uma parcela. Por isso NÃO usa a classificação Gemini
--   (QUENTE/MORNO); a elegibilidade é: parcela previsto/atrasado + contrato
--   ativo + marco ainda não enviado. Respeita consentimento (responsaveis
--   .aceite_whatsapp / .aceite_email) na CF.
--
-- Forward-only, idempotente. Colunas aditivas nullable (seguras em PRD).
-- ════════════════════════════════════════════════════════════════════════

-- ─── Colunas CAS por marco (parcelas, public) ───────────────────────────
ALTER TABLE public.parcelas
  ADD COLUMN IF NOT EXISTS regua_dneg3_at TIMESTAMPTZ,  -- D-3 (lembrete amigável)
  ADD COLUMN IF NOT EXISTS regua_d0_at    TIMESTAMPTZ,  -- D+0 (vencimento hoje)
  ADD COLUMN IF NOT EXISTS regua_d1_at    TIMESTAMPTZ,  -- D+1 (marca atrasado + alerta)
  ADD COLUMN IF NOT EXISTS regua_d3_at    TIMESTAMPTZ,  -- D+3 (notificação formal)
  ADD COLUMN IF NOT EXISTS regua_d7_at    TIMESTAMPTZ,  -- D+7 (pendência + War Room)
  ADD COLUMN IF NOT EXISTS regua_d15_at   TIMESTAMPTZ;  -- D+15 (crítico + CEO)

COMMENT ON COLUMN public.parcelas.regua_dneg3_at IS 'Régua D-3 enviado (trava CAS — marca antes do envio, evita duplicar).';
COMMENT ON COLUMN public.parcelas.regua_d15_at IS 'Régua D+15 (crítico) enviado. CEO notificado.';

-- Índice parcial: acelera a varredura da CF (parcelas ainda cobráveis).
CREATE INDEX IF NOT EXISTS idx_parcelas_regua
  ON public.parcelas (vencimento)
  WHERE status IN ('previsto', 'atrasado') AND deleted_at IS NULL;

-- ─── Mensagens editáveis da régua (config) ──────────────────────────────
-- Texto padrão (rascunho cordial). Editável na tela de Configurações (F4.3).
-- Placeholders: {responsavel_nome} {atleta_nome} {valor} {vencimento} {numero_parcela}
INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
SELECT 'regua_mensagens', $json$
{
  "dneg3": {
    "whatsapp": "Olá {responsavel_nome}! 😊 Passando para lembrar, com carinho, que a parcela {numero_parcela} de {valor} do projeto do(a) {atleta_nome} vence em {vencimento}. Qualquer dúvida sobre o pagamento, é só chamar por aqui!"
  },
  "d0": {
    "whatsapp": "Olá {responsavel_nome}! Hoje ({vencimento}) é o vencimento da parcela {numero_parcela} de {valor} do projeto do(a) {atleta_nome}. Se já efetuou o pagamento, pode desconsiderar 💙 Precisando dos dados ou de ajuda, conte com a gente!",
    "email_assunto": "Vencimento hoje — parcela do projeto de {atleta_nome}",
    "email": "Olá {responsavel_nome},\n\nHoje é o vencimento da parcela {numero_parcela}, no valor de {valor}, referente ao projeto do(a) {atleta_nome}.\n\nSe o pagamento já foi realizado, por favor desconsidere este e-mail. Qualquer dúvida, estamos à disposição.\n\nEquipe Bolsa Atleta USA"
  },
  "d1": {
    "whatsapp": "Olá {responsavel_nome}, tudo bem? Notamos que a parcela {numero_parcela} de {valor} (venc. {vencimento}) do projeto do(a) {atleta_nome} ainda consta em aberto. Deve ser só um esquecimento 😉 Se precisar da segunda via ou de ajustar a data, é só falar com a gente."
  },
  "d3": {
    "email_assunto": "Pagamento pendente — parcela do projeto de {atleta_nome}",
    "email": "Prezado(a) {responsavel_nome},\n\nAinda não identificamos o pagamento da parcela {numero_parcela}, no valor de {valor}, com vencimento em {vencimento} (projeto do(a) {atleta_nome}).\n\nPedimos a gentileza de regularizar ou de entrar em contato para encontrarmos, juntos, a melhor solução.\n\nEquipe Bolsa Atleta USA"
  },
  "d7": {
    "whatsapp": "Olá {responsavel_nome}, a parcela {numero_parcela} de {valor} (venc. {vencimento}) do projeto do(a) {atleta_nome} está com 7 dias de atraso. Queremos ajudar a resolver — havendo qualquer dificuldade, fale com a gente para combinarmos uma alternativa e manter o cronograma do(a) {atleta_nome} em dia.",
    "email_assunto": "Parcela em atraso (7 dias) — projeto de {atleta_nome}",
    "email": "Prezado(a) {responsavel_nome},\n\nA parcela {numero_parcela} de {valor} (vencimento {vencimento}), do projeto do(a) {atleta_nome}, está com 7 dias de atraso.\n\nQueremos apoiar você nesse momento: se houver qualquer dificuldade, entre em contato para combinarmos uma alternativa. Manter o projeto em dia é importante para não impactar o cronograma do(a) {atleta_nome}.\n\nEquipe Bolsa Atleta USA"
  },
  "d15": {
    "email_assunto": "Importante: parcela com 15 dias de atraso — projeto de {atleta_nome}",
    "email": "Prezado(a) {responsavel_nome},\n\nA parcela {numero_parcela} de {valor} (vencimento {vencimento}), do projeto do(a) {atleta_nome}, está com 15 dias de atraso.\n\nPrecisamos conversar com urgência para evitar a suspensão temporária do atendimento. Nossa equipe entrará em contato, mas fique à vontade para nos procurar antes — estamos aqui para ajudar a resolver.\n\nEquipe Bolsa Atleta USA"
  }
}
$json$::jsonb, 'Textos editáveis da régua de cobrança por marco (D-3 a D+15). Placeholders: {responsavel_nome} {atleta_nome} {valor} {vencimento} {numero_parcela}.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.configuracoes_sistema WHERE chave = 'regua_mensagens'
);
