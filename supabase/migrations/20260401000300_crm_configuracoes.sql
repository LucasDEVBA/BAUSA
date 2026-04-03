-- ============================================================
-- CRM Bolsa Atleta USA — Migration 4: Configurações do Sistema
-- Tabela chave-valor para configurações editáveis pelo CEO.
-- Seed com todos os valores padrão da especificação.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  chave        TEXT PRIMARY KEY,
  valor        JSONB NOT NULL,
  descricao    TEXT,
  editavel_ceo BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.configuracoes_sistema IS 'Configurações do CRM editáveis pelo CEO sem necessidade de dev';

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_configuracoes_updated_at ON public.configuracoes_sistema;
CREATE TRIGGER trg_configuracoes_updated_at
  BEFORE UPDATE ON public.configuracoes_sistema
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer autenticado pode ler (frontend precisa dos pesos, timers, etc.)
DROP POLICY IF EXISTS "config_select" ON public.configuracoes_sistema;
CREATE POLICY "config_select" ON public.configuracoes_sistema
  FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE: apenas CEO
DROP POLICY IF EXISTS "config_upsert" ON public.configuracoes_sistema;
CREATE POLICY "config_upsert" ON public.configuracoes_sistema
  FOR ALL TO authenticated
  USING (public.get_user_papel() = 'ceo')
  WITH CHECK (public.get_user_papel() = 'ceo');

-- DELETE: ninguém (configurações não são deletadas)
-- Sem policy = sem permissão

-- service_role
DROP POLICY IF EXISTS "config_service" ON public.configuracoes_sistema;
CREATE POLICY "config_service" ON public.configuracoes_sistema
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── Seed: valores padrão da especificação ────────────────────
INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES

-- Lead Score — pesos (soma = 100)
('lead_score_pesos', '{
  "investimento": 25,
  "timing": 20,
  "ingles": 15,
  "academico": 15,
  "competitivo": 10,
  "comprometimento": 10,
  "video": 5
}'::jsonb, 'Pesos do Lead Score. Soma deve ser 100.'),

-- Lead Score — faixas de classificação
('lead_score_faixas', '{
  "hot": 70,
  "warm": 40
}'::jsonb, 'Faixas: >= hot = Hot, >= warm = Warm, abaixo = Cold'),

-- Motor de Match — pesos (soma = 100%)
('match_pesos', '{
  "financeiro": 30,
  "academico": 25,
  "esportivo": 25,
  "serie": 10,
  "historico_bausa": 10
}'::jsonb, 'Pesos do Motor de Match. Soma deve ser 100.'),

-- Motor de Match — faixas de classificação
('match_faixas', '{
  "excelente": 85,
  "forte": 70,
  "possivel": 50
}'::jsonb, 'Faixas: >= excelente, >= forte, >= possivel, abaixo = fraco'),

-- Timers de automação (em horas, exceto onde indicado)
('timers_automacao', '{
  "convite_horas": 22,
  "followup_horas": 24,
  "alerta_sem_acao_horas": 48,
  "reuniao_sem_proposta_horas": 12,
  "alinhamento_sem_avanco_dias": 3,
  "proposta_sem_followup_horas": 48,
  "negociacao_parada_dias": 4,
  "contrato_sem_assinatura_horas": 48,
  "contrato_sem_sinal_horas": 48,
  "horario_seguro_inicio": 21,
  "horario_seguro_fim": 8,
  "fallback_canal_horas": 1
}'::jsonb, 'Timers de automação do pipeline e comunicação'),

-- Régua de cobrança (dias relativos ao vencimento)
('regua_cobranca', '[
  {"dia": -3, "canal": "whatsapp", "acao": "Lembrete amigável"},
  {"dia": 0,  "canal": "whatsapp_email", "acao": "Lembrete com dados de pagamento"},
  {"dia": 1,  "canal": "whatsapp", "acao": "Alerta de atraso. Status → Atrasado"},
  {"dia": 3,  "canal": "email", "acao": "Segunda notificação formal"},
  {"dia": 7,  "canal": "whatsapp_email", "acao": "Pendência. Alerta War Room"},
  {"dia": 15, "canal": "email", "acao": "Alerta crítico. CEO notificado. Considerar suspensão"}
]'::jsonb, 'Régua de cobrança com dias, canal e ação'),

-- Planos e valores
('planos', '{
  "journey": {"valor": 26000, "valor_pix": 23000, "psicologa": true},
  "legacy":  {"valor": 32000, "valor_pix": 28500, "psicologa": true},
  "start":   {"valor": 18000, "valor_pix": 16000, "psicologa": false}
}'::jsonb, 'Planos disponíveis com valores e inclusões'),

-- Valor padrão da entrada
('entrada_padrao', '4500'::jsonb, 'Valor padrão da entrada (sinal) em R$'),

-- Custo da psicóloga
('psicologa_custo_padrao', '1200'::jsonb, 'Custo padrão da psicóloga intercultural por cliente (R$)'),

-- Metas do War Room
('meta_anual', '1500000'::jsonb, 'Meta anual de receita em R$'),
('meta_mensal_padrao', '125000'::jsonb, 'Meta mensal padrão (anual / 12) em R$'),
('ticket_medio_alvo', '23000'::jsonb, 'Ticket médio alvo em R$'),
('contratos_mes_alvo', '6'::jsonb, 'Meta de contratos por mês'),
('pipeline_health_ratio', '{"min": 3, "max": 5}'::jsonb, 'Ratio saudável: pipeline provável / meta mensal'),

-- Thresholds do CRM Experiência
('thresholds_experiencia', '{
  "ansiedade_vermelho": 4,
  "satisfacao_vermelho": 2
}'::jsonb, 'Thresholds para temperatura automática vermelha'),

-- Dias de inatividade por fase (CRM Experiência)
('inatividade_por_fase', '{
  "admissao": 7,
  "pre_embarque": 15,
  "embarcado_inicial": 7,
  "acompanhamento": 30
}'::jsonb, 'Dias sem contato para gerar alerta por fase'),

-- Digest
('digest_horario', '"09:00"'::jsonb, 'Horário do digest diário de notificações'),

-- Probabilidade padrão por etapa do pipeline
('probabilidade_por_etapa', '{
  "lead": 10,
  "reuniao_marcada": 20,
  "reuniao_realizada": 35,
  "diagnostico_fit": 45,
  "alinhamento_estrategico": 50,
  "proposta_enviada": 55,
  "followup_proposta": 60,
  "negociacao": 65,
  "contrato_enviado": 75,
  "contrato_assinado": 85,
  "sinal_pago": 95,
  "admission_process": 98,
  "concluido": 100,
  "perdido": 0,
  "cancelamento_solicitado": 10,
  "projeto_futuro": 5
}'::jsonb, 'Probabilidade padrão de fechamento por etapa')

ON CONFLICT (chave) DO NOTHING;
