-- ════════════════════════════════════════════════════════════════════════
-- Migration: novo processo comercial (9 estágios) + handoff no Sinal pago
-- Roda DEPOIS de 20260811140000 (que adiciona 'contato_feito' ao enum).
-- ════════════════════════════════════════════════════════════════════════
--
-- Decisão do CEO (2026-08-11). O board passa a ser:
--   1 Contato feito · 2 Lead qualificado · 3 Reunião marcada
--   4 Reunião realizada · 5 Proposta enviada · 6 Plano escolhido
--   7 Contrato enviado · 8 Contrato assinado · 9 Sinal pago (GANHO) · Perdido
--
-- Estratégia (o enum NUNCA é renomeado — ver 20260811140000):
--   • 'negociacao' passa a se chamar "Plano escolhido" (rótulo).
--   • Estágios que saíram do processo (diagnóstico/alinhamento/follow-up e as
--     etapas pós-ganho, que agora vivem na jornada da família) ficam OCULTOS.
--     Coluna oculta só desaparece do board quando esvazia — nenhum deal some.
--   • 'aguardando_timing' deixa de ser coluna: os deals voltam para o funil e
--     o "fora do timing" vira BADGE no card (form_submissions.timing_status).
--   • Follow-up NÃO é estágio: é o estado de quem está em Proposta enviada
--     (a cadência D0→D+90 é automação, migration própria).
--
-- Tudo idempotente: rodar 2x é no-op.
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Ordem de negócio (detecção de retrocesso) ───────────────────────
-- Números só são comparados entre si, nunca persistidos — renumerar é seguro
-- (mesma nota da 20260706173000). 'contato_feito' entra como 1.
CREATE OR REPLACE FUNCTION public.ordem_etapa(p_etapa status_deal)
RETURNS INTEGER AS $$
  SELECT CASE p_etapa
    WHEN 'contato_feito'           THEN 1
    WHEN 'lead'                    THEN 2
    WHEN 'aguardando_timing'       THEN 3
    WHEN 'reuniao_marcada'         THEN 4
    WHEN 'reuniao_realizada'       THEN 5
    WHEN 'diagnostico_fit'         THEN 6
    WHEN 'alinhamento_estrategico' THEN 7
    WHEN 'proposta_enviada'        THEN 8
    WHEN 'followup_proposta'       THEN 9
    WHEN 'negociacao'              THEN 10
    WHEN 'contrato_enviado'        THEN 11
    WHEN 'contrato_assinado'       THEN 12
    WHEN 'sinal_pago'              THEN 13
    WHEN 'admission_process'       THEN 14
    WHEN 'concluido'               THEN 15
    WHEN 'perdido'                 THEN 16
    WHEN 'cancelamento_solicitado' THEN 17
    WHEN 'projeto_futuro'          THEN 18
    ELSE 0
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ─── 2. Deals estacionados em aguardando_timing voltam ao funil ─────────
-- O motivo do estacionamento (timing) continua registrado em
-- form_submissions.timing_status e agora aparece como badge no card.
-- etapa_anterior preservado; a trigger de retrocesso não dispara porque
-- sair de aguardando_timing é isento (20260706173000).
UPDATE public.deals
SET etapa = 'lead'
WHERE etapa = 'aguardando_timing'
  AND deleted_at IS NULL;

-- ─── 3. Handoff da jornada: começa no GANHO (Sinal pago) ────────────────
-- Antes: admission_process/concluido. Agora sinal_pago também abre a jornada
-- pós-venda (fase 'admissao'), porque o comercial termina ali. As duas etapas
-- antigas seguem funcionando (deals históricos).
CREATE OR REPLACE FUNCTION public.trg_create_experiencia_on_admission()
RETURNS TRIGGER AS $$
DECLARE
  v_existing UUID;
  v_fase_destino fase_experiencia;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.etapa IN ('sinal_pago', 'admission_process', 'concluido'))
     OR (TG_OP = 'UPDATE'
         AND NEW.etapa IN ('sinal_pago', 'admission_process', 'concluido')
         AND COALESCE(OLD.etapa::text, '') IS DISTINCT FROM NEW.etapa::text)
  THEN
    v_fase_destino := CASE NEW.etapa::text
      WHEN 'concluido'         THEN 'acompanhamento'::fase_experiencia
      ELSE 'admissao'::fase_experiencia   -- sinal_pago e admission_process
    END;

    -- Tudo em sub-bloco com EXCEPTION para NUNCA abortar o UPDATE em deals.
    BEGIN
      SELECT id INTO v_existing
      FROM public.crm_experiencia
      WHERE atleta_id = NEW.atleta_id
      LIMIT 1;

      IF v_existing IS NULL THEN
        INSERT INTO public.crm_experiencia (
          atleta_id, deal_id, fase, temperatura,
          ansiedade, satisfacao, risco_percebido,
          status, psicologa_acionada
        ) VALUES (
          NEW.atleta_id, NEW.id, v_fase_destino, 'verde',
          3, 5, 1,
          'satisfeita', FALSE
        );
      ELSE
        UPDATE public.crm_experiencia
        SET fase = v_fase_destino
        WHERE id = v_existing
          AND fase::text NOT IN ('encerrado')
          AND (
            (v_fase_destino = 'acompanhamento' AND fase::text NOT IN ('acompanhamento', 'encerrado'))
            OR (v_fase_destino = 'admissao' AND fase::text NOT IN ('admissao', 'aprovado', 'pre_embarque', 'embarcado_inicial', 'acompanhamento', 'encerrado'))
          );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'trg_create_experiencia_on_admission: % (deal=%, atleta=%)',
        SQLERRM, NEW.id, NEW.atleta_id;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.trg_create_experiencia_on_admission() IS
  'Auto-handoff defensivo: cria crm_experiencia ao deal entrar em sinal_pago (ganho) / admission_process / concluido. NUNCA aborta o UPDATE no deal (EXCEPTION handler).';

-- ─── 4. Rótulos, ordem e ocultação do board (apresentação) ──────────────
-- Merge com o que já existe (`||` = a direita vence): o CEO segue livre para
-- reabrir qualquer coluna e renomear tudo pelo modal da própria coluna.
UPDATE public.configuracoes_sistema
SET valor = COALESCE(valor, '{}'::jsonb) || '{
  "contato_feito":          {"label": "Contato feito",     "accent": "blue",   "order": 1,  "oculta": false},
  "lead":                   {"label": "Lead qualificado",  "accent": "blue",   "order": 2,  "oculta": false},
  "reuniao_marcada":        {"label": "Reunião marcada",   "accent": "purple", "order": 3,  "oculta": false},
  "reuniao_realizada":      {"label": "Reunião realizada", "accent": "purple", "order": 4,  "oculta": false},
  "proposta_enviada":       {"label": "Proposta enviada",  "accent": "orange", "order": 5,  "oculta": false},
  "negociacao":             {"label": "Plano escolhido",   "accent": "orange", "order": 6,  "oculta": false},
  "contrato_enviado":       {"label": "Contrato enviado",  "accent": "green",  "order": 7,  "oculta": false},
  "contrato_assinado":      {"label": "Contrato assinado", "accent": "green",  "order": 8,  "oculta": false},
  "sinal_pago":             {"label": "Sinal pago",        "accent": "green",  "order": 9,  "oculta": false},
  "perdido":                {"label": "Perdido",           "accent": "red",    "order": 10, "oculta": false},
  "aguardando_timing":      {"oculta": true, "order": 90},
  "diagnostico_fit":        {"oculta": true, "order": 91},
  "alinhamento_estrategico":{"oculta": true, "order": 92},
  "followup_proposta":      {"oculta": true, "order": 93},
  "admission_process":      {"oculta": true, "order": 94},
  "concluido":              {"oculta": true, "order": 95}
}'::jsonb,
    updated_at = NOW()
WHERE chave = 'etapas_deal_config';

-- ─── 5. Probabilidade da etapa nova ─────────────────────────────────────
UPDATE public.configuracoes_sistema
SET valor = COALESCE(valor, '{}'::jsonb) || '{"contato_feito": 5}'::jsonb,
    updated_at = NOW()
WHERE chave = 'probabilidade_por_etapa'
  AND NOT (COALESCE(valor, '{}'::jsonb) ? 'contato_feito');
