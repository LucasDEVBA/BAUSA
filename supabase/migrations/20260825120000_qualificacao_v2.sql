-- Qualificação v2 — "Classificador Automático de Leads v1.0" (spec do CEO,
-- 2026-08-25). Score auditável 0-100 por tier de profissão + sinais, estados
-- novos INVALIDO/INCOMPLETO (dado sujo ≠ FRIO), prioridade estratégica
-- esportiva (eixo independente), ação recomendada e loop de aprendizado
-- (prompt_version + desfecho_real p/ cruzar previsto × realizado).
--
-- Compatibilidade: qualification_classification segue text livre — os
-- schedulers filtram IN (QUENTE,MORNO), então INVALIDO/INCOMPLETO ficam
-- naturalmente fora de todo outreach (invariante intocado, guard de CI).
-- Colunas novas são aditivas (IF NOT EXISTS) — zero impacto no fluxo v1.
--
-- + 3 campos novos do formulário (spec §11): profissão do 2º responsável,
-- "atleta já viajou ao exterior?" e "como conheceu a BAU?".
--
-- Config `qualificacao_v2` em configuracoes_sistema (seed ON CONFLICT DO
-- NOTHING — lição configuracoes-patch-sem-upsert): cotação USD, renda mínima
-- de referência e CORTES editáveis pelo CEO (viver no CRM, não no prompt).

DO $$
DECLARE
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    IF to_regclass(s || '.form_submissions') IS NULL THEN
      RAISE NOTICE 'qualificacao_v2: schema % sem form_submissions — pulado', s;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I.form_submissions
      ADD COLUMN IF NOT EXISTS score_financeiro integer,
      ADD COLUMN IF NOT EXISTS tier_profissao text,
      ADD COLUMN IF NOT EXISTS sinais_reforco jsonb,
      ADD COLUMN IF NOT EXISTS sinais_alerta jsonb,
      ADD COLUMN IF NOT EXISTS prioridade_estrategica text,
      ADD COLUMN IF NOT EXISTS acao_recomendada text,
      ADD COLUMN IF NOT EXISTS prompt_version text,
      ADD COLUMN IF NOT EXISTS desfecho_real text,
      ADD COLUMN IF NOT EXISTS guardian_profession_2 text,
      ADD COLUMN IF NOT EXISTS viajou_exterior boolean,
      ADD COLUMN IF NOT EXISTS como_conheceu text', s);

    -- Ordenação da fila de aprovação por score (spec §8: "Ordenação da fila").
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_form_submissions_score_financeiro
         ON %I.form_submissions (score_financeiro DESC NULLS LAST)
       WHERE deleted_at IS NULL', s);
  END LOOP;
END $$;

-- Config das variáveis do classificador (spec §9): os cortes vivem AQUI,
-- não no prompt — afrouxar/apertar o funil sem reescrever a lógica.
-- system_prompt vazio = usa o prompt v1.0 versionado no código da CF.
INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
VALUES ('qualificacao_v2',
        '{"cotacao_usd": 5.40, "renda_minima_mensal": 50000, "corte_ibge": null, "corte_quente": 70, "corte_frio": 40, "system_prompt": ""}'::jsonb,
        'Classificador v2: cotação USD (atualizar semanalmente), renda familiar líquida de referência (R$/mês), cortes QUENTE/FRIO do score e override opcional do system prompt (vazio = prompt versionado no código).')
ON CONFLICT (chave) DO NOTHING;
