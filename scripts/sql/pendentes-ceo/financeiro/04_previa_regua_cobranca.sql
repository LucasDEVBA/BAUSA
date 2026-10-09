-- ════════════════════════════════════════════════════════════════════════
-- SOMENTE LEITURA — rodar ANTES de retomar o job billing-reminders.
-- Mostra exatamente o que a régua (functions/billing-reminders) consideraria
-- elegível hoje: parcelas previsto/atrasado, vivas, de contrato vivo, na
-- janela [hoje−20d, hoje+5d], e o marco que dispararia. Se aparecer família
-- que já pagou (ex.: Amanda) ou contrato de teste (Lucas Leo), NÃO retomar.
-- ════════════════════════════════════════════════════════════════════════
WITH base AS (
  SELECT p.id, p.numero_parcela, p.valor, p.vencimento, p.status, p.metodo,
         (p.vencimento - (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS dtd,
         p.regua_dneg3_at, p.regua_d0_at, p.regua_d1_at, p.regua_d3_at, p.regua_d7_at, p.regua_d15_at,
         c.id AS contrato_id, c.plano, a.nome_completo AS atleta, d.etapa
    FROM public.parcelas p
    JOIN public.contratos_financeiros c ON c.id = p.contrato_id AND c.deleted_at IS NULL
    JOIN public.deals d ON d.id = c.deal_id
    JOIN public.atletas a ON a.id = d.atleta_id
   WHERE p.status IN ('previsto', 'atrasado') AND p.deleted_at IS NULL
     AND p.vencimento BETWEEN (now()::date - 20) AND (now()::date + 5)
)
SELECT atleta, etapa, plano, numero_parcela, valor, vencimento, metodo, status, dtd,
       CASE
         WHEN status = 'previsto' AND dtd BETWEEN 1 AND 3 AND regua_dneg3_at IS NULL THEN 'dneg3 (WhatsApp)'
         WHEN status = 'previsto' AND dtd = 0 AND regua_d0_at IS NULL THEN 'd0 (WhatsApp + e-mail)'
         WHEN dtd <= -1 AND regua_d1_at IS NULL THEN 'd1 (WhatsApp, marca atrasado)'
         WHEN dtd <= -3 AND regua_d3_at IS NULL THEN 'd3 (e-mail)'
         WHEN dtd <= -7 AND regua_d7_at IS NULL THEN 'd7 (WhatsApp + e-mail + War Room)'
         WHEN dtd <= -15 AND regua_d15_at IS NULL THEN 'd15 (e-mail + CEO)'
         ELSE '— (nada hoje)'
       END AS marco_que_dispararia
  FROM base
 ORDER BY vencimento;
