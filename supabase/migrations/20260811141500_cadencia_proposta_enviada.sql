-- ════════════════════════════════════════════════════════════════════════
-- Migration: cadência de follow-up da PROPOSTA (D0 → D+90) — nasce PAUSADA
-- ════════════════════════════════════════════════════════════════════════
--
-- Decisão do CEO (2026-08-11): "Follow-up" não é estágio — é o que acontece
-- com quem está em Proposta enviada. A cadência vira 6 automações reais,
-- visíveis e editáveis tanto no modal da coluna quanto em /automacoes:
--
--   D0   ligação   — confirmar recebimento da proposta
--   D+2  WhatsApp  — checar dúvidas
--   D+7  WhatsApp  — reforço de valor
--   D+15 ligação   — tentativa por voz
--   D+25 WhatsApp  — última chamada do ciclo
--   D+90 move para Nutrição longa (projeto_futuro) + tarefa de retomada
--
-- Vínculo com a coluna (sem schema novo):
--   • D0 usa o gatilho de EVENTO `deal_etapa_mudou` + etapa_para=proposta_enviada
--     (dispara na hora em que a proposta é marcada como enviada);
--   • D+N usam o gatilho de TEMPO `deal_parado_etapa` (dias) + condição
--     `etapa = proposta_enviada` — o finder de tempo não filtra etapa, quem
--     filtra é a condição, avaliada pela engine antes de agir.
--
-- Idempotência: IDs fixos + ON CONFLICT DO NOTHING. Todas com ativo=FALSE —
-- o CEO liga uma a uma pelo modal da coluna (padrão "nasce pausada").
-- IDs c1…c6 no mesmo espaço reservado das âncoras de sistema (a0000000-…).
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO public.automacoes (id, nome, descricao, gatilho, gatilho_config, condicoes, acoes, ativo)
VALUES
  -- ── D0: confirmar recebimento (evento — dispara ao entrar na coluna) ──
  ('a0000000-0000-4000-8000-0000000000c1',
   'Proposta D0 · confirmar recebimento',
   'Ao marcar a proposta como enviada, cria a tarefa de ligar confirmando o recebimento.',
   'deal_etapa_mudou',
   '{"etapa_para": "proposta_enviada"}'::jsonb,
   '[]'::jsonb,
   '[{"tipo": "criar_tarefa", "parametros": {
        "titulo": "Ligar: confirmar recebimento da proposta",
        "descricao": "Confirmar que a família recebeu a proposta e checar primeiras dúvidas.",
        "prioridade": "alta",
        "prazo_dias": 0
      }}]'::jsonb,
   FALSE),

  -- ── D+2: WhatsApp de dúvidas ──
  ('a0000000-0000-4000-8000-0000000000c2',
   'Proposta D+2 · WhatsApp de dúvidas',
   'Dois dias sem avanço na proposta: mensagem curta perguntando dúvidas.',
   'deal_parado_etapa',
   '{"dias": 2}'::jsonb,
   '[{"campo": "etapa", "operador": "eq", "valor": "proposta_enviada"}]'::jsonb,
   '[{"tipo": "enviar_whatsapp_custom", "parametros": {
        "mensagem": "Oi {responsavel_nome}! Passando para saber se ficou alguma dúvida sobre a proposta do {atleta_nome}. Posso esclarecer por aqui mesmo.",
        "destinatario": "responsavel"
      }}]'::jsonb,
   FALSE),

  -- ── D+7: WhatsApp de reforço ──
  ('a0000000-0000-4000-8000-0000000000c3',
   'Proposta D+7 · WhatsApp de reforço',
   'Uma semana parado: reforça o valor do projeto e reabre a conversa.',
   'deal_parado_etapa',
   '{"dias": 7}'::jsonb,
   '[{"campo": "etapa", "operador": "eq", "valor": "proposta_enviada"}]'::jsonb,
   '[{"tipo": "enviar_whatsapp_custom", "parametros": {
        "mensagem": "Oi {responsavel_nome}, tudo bem? Seguimos à disposição para falar do projeto do {atleta_nome}. Quer que eu te mostre como ficaria o cronograma a partir de agora?",
        "destinatario": "responsavel"
      }}]'::jsonb,
   FALSE),

  -- ── D+15: ligação ──
  ('a0000000-0000-4000-8000-0000000000c4',
   'Proposta D+15 · ligação',
   'Quinze dias parado: tentativa por voz (a mensagem já não está funcionando).',
   'deal_parado_etapa',
   '{"dias": 15}'::jsonb,
   '[{"campo": "etapa", "operador": "eq", "valor": "proposta_enviada"}]'::jsonb,
   '[{"tipo": "criar_tarefa", "parametros": {
        "titulo": "Ligar: proposta parada há 15 dias",
        "descricao": "Tentativa por voz — entender objeção real antes do último contato do ciclo.",
        "prioridade": "alta",
        "prazo_dias": 1
      }}]'::jsonb,
   FALSE),

  -- ── D+25: última chamada do ciclo ──
  ('a0000000-0000-4000-8000-0000000000c5',
   'Proposta D+25 · última chamada',
   'Fecha o ciclo ativo de follow-up antes da nutrição longa.',
   'deal_parado_etapa',
   '{"dias": 25}'::jsonb,
   '[{"campo": "etapa", "operador": "eq", "valor": "proposta_enviada"}]'::jsonb,
   '[{"tipo": "enviar_whatsapp_custom", "parametros": {
        "mensagem": "Oi {responsavel_nome}! Vou pausar meu acompanhamento do projeto do {atleta_nome} por enquanto para não incomodar. Se fizer sentido retomar, é só me chamar por aqui.",
        "destinatario": "responsavel"
      }}]'::jsonb,
   FALSE),

  -- ── D+90: nutrição longa + tarefa de retomada ──
  ('a0000000-0000-4000-8000-0000000000c6',
   'Proposta D+90 · nutrição longa',
   'Move o deal para Nutrição longa (projeto futuro) e agenda a retomada.',
   'deal_parado_etapa',
   '{"dias": 90}'::jsonb,
   '[{"campo": "etapa", "operador": "eq", "valor": "proposta_enviada"}]'::jsonb,
   '[{"tipo": "criar_tarefa", "parametros": {
        "titulo": "Retomar contato (nutrição longa)",
        "descricao": "Proposta sem avanço há 90 dias. Retomar com novidade concreta (turma, prazo, caso de sucesso).",
        "prioridade": "media",
        "prazo_dias": 7
      }},
     {"tipo": "mover_deal", "parametros": {
        "etapa_destino": "projeto_futuro",
        "next_action": "Retomar na nutrição longa",
        "proxima_acao_dias": 7
      }}]'::jsonb,
   FALSE)
ON CONFLICT (id) DO NOTHING;

-- ─── responsavel_id das tarefas ──────────────────────────────────────────
-- `tarefas.responsavel_id` é NOT NULL e o Zod do builder exige uuid: sem isto
-- toda ação `criar_tarefa` da cadência falharia no INSERT (run em erro).
-- Aponta para o CEO/CTO ativo. Idempotente: reaplicar grava o mesmo valor.
UPDATE public.automacoes a
SET acoes = (
      SELECT jsonb_agg(
        CASE WHEN elem->>'tipo' = 'criar_tarefa'
          THEN jsonb_set(elem, '{parametros,responsavel_id}', to_jsonb(dono.id::text))
          ELSE elem
        END
        ORDER BY idx
      )
      FROM jsonb_array_elements(a.acoes) WITH ORDINALITY AS t(elem, idx)
    ),
    updated_at = NOW()
FROM (
  SELECT id FROM public.user_profiles
  WHERE papel IN ('ceo', 'cto') AND ativo IS TRUE
  ORDER BY CASE papel WHEN 'ceo' THEN 0 ELSE 1 END, created_at
  LIMIT 1
) AS dono
WHERE a.id IN (
  'a0000000-0000-4000-8000-0000000000c1',
  'a0000000-0000-4000-8000-0000000000c4',
  'a0000000-0000-4000-8000-0000000000c6'
)
  AND a.acoes @> '[{"tipo": "criar_tarefa"}]'::jsonb;

COMMENT ON TABLE public.automacoes IS
  'Automações do builder (/automacoes) e das colunas do pipeline. Cadência da proposta = IDs a0000000-…-0000000000c1..c6 (nascem pausadas).';
