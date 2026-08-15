-- ════════════════════════════════════════════════════════════════════════
-- Migration: fluxos de exemplo prontos (WhatsApp + Instagram)
-- Aplica em public, uat, dev — só onde a tabela `fluxos` existir.
--
-- Contexto: o motor de fluxos (20260813014726) subiu vazio. Estes dois
-- fluxos são o esqueleto de qualificação que o CEO já usa hoje no ManyChat,
-- reescrito no nosso motor:
--
--   pergunta o esporte → pergunta a série → captura o e-mail → passa p/ humano
--
-- O de Instagram é exatamente o roteiro que o revisor do App Review da Meta
-- vai reproduzir ("comente EUA"), então ele precisa existir ANTES da submissão.
--
-- ⚠️ Ambos nascem `ativo = FALSE`. Mesmo se alguém ligar, o gate de escopo
-- (`fluxos_escopo` em configuracoes_sistema) nasce `desligado` e a engine
-- não envia nada. São DUAS travas independentes — de propósito.
--
-- Idempotente: só insere se não existir fluxo com o mesmo nome.
-- ════════════════════════════════════════════════════════════════════════

DO $seed$
DECLARE
  s          TEXT;
  f_id       UUID;
  b_msg      UUID;
  b_esporte  UUID;
  b_serie    UUID;
  b_email    UUID;
  b_handoff  UUID;
BEGIN
  FOREACH s IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    CONTINUE WHEN to_regclass(s || '.fluxos') IS NULL;

    -- ══════════════════════════════════════════════════════════════════
    -- FLUXO 1 — WhatsApp: palavra-chave → qualificação
    -- Canal disponível HOJE (Z-API). É o que dá para testar de verdade.
    -- ══════════════════════════════════════════════════════════════════
    EXECUTE format('SELECT id FROM %I.fluxos WHERE nome = $1 AND deleted_at IS NULL', s)
      INTO f_id USING 'WhatsApp — palavra-chave "bolsa"';

    IF f_id IS NULL THEN
      b_msg     := gen_random_uuid();
      b_esporte := gen_random_uuid();
      b_serie   := gen_random_uuid();
      b_email   := gen_random_uuid();
      b_handoff := gen_random_uuid();
      f_id      := gen_random_uuid();

      EXECUTE format($q$
        INSERT INTO %I.fluxos (id, nome, descricao, canal, gatilho, gatilho_config,
                               bloco_inicial_id, ativo, limite_hora, reentrada_horas)
        VALUES ($1, $2, $3, 'whatsapp', 'mensagem_palavra_chave', $4, $5, FALSE, 30, 720)
      $q$, s)
      USING f_id,
            'WhatsApp — palavra-chave "bolsa"',
            'Quem manda "bolsa", "eua" ou "bolsa atleta" no WhatsApp entra na qualificação: esporte, série e e-mail. Termina passando a conversa para o time.',
            jsonb_build_object(
              'palavras', jsonb_build_array('bolsa', 'bolsas', 'eua', 'usa', 'bolsa atleta'),
              'match', 'contem'
            ),
            b_msg;

      EXECUTE format($q$
        INSERT INTO %I.fluxo_blocos (id, fluxo_id, tipo, conteudo, proximo_id, ramos, ordem)
        VALUES
          ($1,  $6, 'mensagem', $7,  $2, '[]'::jsonb, 0),
          ($2,  $6, 'botoes',   $8,  $3, '[]'::jsonb, 1),
          ($3,  $6, 'botoes',   $9,  $4, '[]'::jsonb, 2),
          ($4,  $6, 'captura',  $10, $5, '[]'::jsonb, 3),
          ($5,  $6, 'handoff',  $11, NULL, '[]'::jsonb, 4)
      $q$, s)
      USING b_msg, b_esporte, b_serie, b_email, b_handoff, f_id,
        jsonb_build_object('texto',
          'Oi! Aqui é a Bolsa Atleta USA 🇺🇸' || chr(10) || chr(10) ||
          'A gente ajuda atletas brasileiros a conquistarem bolsa esportiva em escolas e universidades dos Estados Unidos.' || chr(10) || chr(10) ||
          'Vou te fazer 3 perguntas rápidas para entender o perfil do atleta — leva menos de um minuto.'),
        jsonb_build_object(
          'texto', 'Primeiro: qual o esporte do atleta?',
          'variavel', 'esporte',
          'opcoes', jsonb_build_array('Futebol', 'Vôlei', 'Outro esporte')),
        jsonb_build_object(
          'texto', 'E em que ano escolar ele está hoje?',
          'variavel', 'serie',
          'opcoes', jsonb_build_array('Até o 9º ano', '1º ou 2º ano do EM', '3º ano ou já formado')),
        jsonb_build_object(
          'texto', 'Perfeito! Por último, me passa o melhor e-mail para eu te enviar o guia completo:',
          'campo', 'email',
          'variavel', 'email',
          'criarLead', TRUE),
        jsonb_build_object(
          'texto', 'Obrigado! Um consultor vai te chamar aqui mesmo em instantes. 👊',
          'destinatario', 'ceo');
    END IF;

    -- ══════════════════════════════════════════════════════════════════
    -- FLUXO 2 — Instagram: comentou "EUA" → DM de qualificação
    -- Canal ainda BLOQUEADO (App Review). Existe para (a) o CEO revisar o
    -- texto antes e (b) o revisor da Meta conseguir reproduzir o roteiro.
    -- ══════════════════════════════════════════════════════════════════
    EXECUTE format('SELECT id FROM %I.fluxos WHERE nome = $1 AND deleted_at IS NULL', s)
      INTO f_id USING 'Instagram — comentou "EUA"';

    IF f_id IS NULL THEN
      b_msg     := gen_random_uuid();
      b_esporte := gen_random_uuid();
      b_serie   := gen_random_uuid();
      b_email   := gen_random_uuid();
      b_handoff := gen_random_uuid();
      f_id      := gen_random_uuid();

      EXECUTE format($q$
        INSERT INTO %I.fluxos (id, nome, descricao, canal, gatilho, gatilho_config,
                               bloco_inicial_id, ativo, limite_hora, reentrada_horas)
        VALUES ($1, $2, $3, 'instagram', 'comentario_post', $4, $5, FALSE, 60, 720)
      $q$, s)
      USING f_id,
            'Instagram — comentou "EUA"',
            'O clássico "comente EUA que eu te mando": responde o comentário em público e puxa a qualificação no direct. É o fluxo que o revisor da Meta testa no App Review.',
            jsonb_build_object(
              'palavras', jsonb_build_array('EUA', 'USA', 'QUERO'),
              'match', 'contem',
              'responderComentario', TRUE,
              'textoComentario', 'Te chamei no direct! 📩'
            ),
            b_msg;

      EXECUTE format($q$
        INSERT INTO %I.fluxo_blocos (id, fluxo_id, tipo, conteudo, proximo_id, ramos, ordem)
        VALUES
          ($1,  $6, 'mensagem', $7,  $2, '[]'::jsonb, 0),
          ($2,  $6, 'botoes',   $8,  $3, '[]'::jsonb, 1),
          ($3,  $6, 'botoes',   $9,  $4, '[]'::jsonb, 2),
          ($4,  $6, 'captura',  $10, $5, '[]'::jsonb, 3),
          ($5,  $6, 'handoff',  $11, NULL, '[]'::jsonb, 4)
      $q$, s)
      USING b_msg, b_esporte, b_serie, b_email, b_handoff, f_id,
        jsonb_build_object('texto',
          'Oi! Vi seu comentário 🙌' || chr(10) || chr(10) ||
          'Aqui é a Bolsa Atleta USA — a gente leva atletas brasileiros para escolas e universidades dos Estados Unidos com bolsa esportiva.' || chr(10) || chr(10) ||
          'Me responde 3 perguntinhas que eu te mando o guia completo.'),
        jsonb_build_object(
          'texto', 'Qual o esporte do atleta?',
          'variavel', 'esporte',
          'opcoes', jsonb_build_array('Futebol', 'Vôlei', 'Outro esporte')),
        jsonb_build_object(
          'texto', 'E em que ano escolar ele está hoje?',
          'variavel', 'serie',
          'opcoes', jsonb_build_array('Até o 9º ano', '1º ou 2º ano do EM', '3º ano ou já formado')),
        jsonb_build_object(
          'texto', 'Fechou! Me passa o melhor e-mail para eu enviar o guia:',
          'campo', 'email',
          'variavel', 'email',
          'criarLead', TRUE),
        jsonb_build_object(
          'texto', 'Prontinho! Um consultor vai te chamar por aqui. 👊',
          'destinatario', 'ceo');
    END IF;

  END LOOP;
END
$seed$;
