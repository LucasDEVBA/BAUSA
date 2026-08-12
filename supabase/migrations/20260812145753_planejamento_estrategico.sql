-- ════════════════════════════════════════════════════════════
-- Migration: Planejamento estratégico (3 anos) e tático
-- Aplica em: public (PRD), uat e dev
-- Contexto:
--   Módulo /planejamento do Engine. Modelo OKR:
--     ciclo (3 anos) → objetivo → meta (KR) → check-in
--     ciclo → projeção anual   |   objetivo → projeto
--   Metas podem puxar o realizado do próprio banco (fonte != 'manual')
--   ou ser atualizadas na rotina de acompanhamento (fonte = 'manual').
--   Incentivo é em dinheiro: a regra mora na meta, a apuração por pessoa
--   em incentivos_apuracoes (previsto → aprovado → pago).
--
-- Por que um LOOP em vez de 3 blocos copiados: são 8 tabelas × (DDL +
-- índices + 2 triggers + 4 policies). Copiar 3× é a receita para os
-- schemas divergirem numa linha só. O loop garante que os 3 recebem
-- exatamente o mesmo DDL.
--
-- Gate por TABELA, não por schema: uat/dev são incompletos (nem todo
-- schema tem user_profiles). Sem esse gate a FK quebra o deploy com
-- 42P01. Schema sem user_profiles é pulado inteiro.
-- Idempotente: IF NOT EXISTS + DROP ... IF EXISTS antes de cada CREATE.
-- ════════════════════════════════════════════════════════════

DO $$
DECLARE
  sch TEXT;
BEGIN
  FOREACH sch IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    -- Schema ausente ou sem a base de usuários → pula (não é erro).
    CONTINUE WHEN to_regclass(sch || '.user_profiles') IS NULL;

    -- ─── 1. Ciclo estratégico (janela de 3 anos) ───────────────
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.planejamento_ciclos (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome        TEXT NOT NULL,
        ano_inicio  INT  NOT NULL CHECK (ano_inicio BETWEEN 2020 AND 2100),
        ano_fim     INT  NOT NULL CHECK (ano_fim   BETWEEN 2020 AND 2100),
        visao       TEXT,
        status      TEXT NOT NULL DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho','ativo','encerrado')),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ,
        created_by  UUID REFERENCES auth.users(id),
        CONSTRAINT planejamento_ciclos_janela CHECK (ano_fim >= ano_inicio)
      )$f$, sch);

    -- ─── 2. Objetivo estratégico (o "O" do OKR) ────────────────
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.planejamento_objetivos (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ciclo_id       UUID NOT NULL REFERENCES %I.planejamento_ciclos(id) ON DELETE CASCADE,
        titulo         TEXT NOT NULL,
        descricao      TEXT,
        responsavel_id UUID REFERENCES %I.user_profiles(id),
        ordem          INT  NOT NULL DEFAULT 0,
        accent         TEXT NOT NULL DEFAULT 'blue'
                       CHECK (accent IN ('blue','green','orange','red','purple','neutral')),
        status         TEXT NOT NULL DEFAULT 'nao_iniciado'
                       CHECK (status IN ('nao_iniciado','em_andamento','concluido','pausado','cancelado')),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at     TIMESTAMPTZ,
        created_by     UUID REFERENCES auth.users(id)
      )$f$, sch, sch, sch);

    -- ─── 3. Projeto (execução ligada a um objetivo) ────────────
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.planejamento_projetos (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        objetivo_id    UUID NOT NULL REFERENCES %I.planejamento_objetivos(id) ON DELETE CASCADE,
        nome           TEXT NOT NULL,
        descricao      TEXT,
        responsavel_id UUID REFERENCES %I.user_profiles(id),
        status         TEXT NOT NULL DEFAULT 'nao_iniciado'
                       CHECK (status IN ('nao_iniciado','em_andamento','concluido','pausado','cancelado')),
        prioridade     TEXT NOT NULL DEFAULT 'media'
                       CHECK (prioridade IN ('alta','media','baixa')),
        inicio         DATE,
        fim            DATE,
        progresso      INT  NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
        orcamento      NUMERIC(14,2),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at     TIMESTAMPTZ,
        created_by     UUID REFERENCES auth.users(id),
        CONSTRAINT planejamento_projetos_janela CHECK (fim IS NULL OR inicio IS NULL OR fim >= inicio)
      )$f$, sch, sch, sch);

    -- ─── 4. Projeção financeira por ano do ciclo ───────────────
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.planejamento_projecoes (
        id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ciclo_id               UUID NOT NULL REFERENCES %I.planejamento_ciclos(id) ON DELETE CASCADE,
        ano                    INT  NOT NULL CHECK (ano BETWEEN 2020 AND 2100),
        receita                NUMERIC(14,2) NOT NULL DEFAULT 0,
        contratos              INT           NOT NULL DEFAULT 0,
        ticket_medio           NUMERIC(14,2) NOT NULL DEFAULT 0,
        investimento_marketing NUMERIC(14,2) NOT NULL DEFAULT 0,
        custo_fixo             NUMERIC(14,2) NOT NULL DEFAULT 0,
        premissas              TEXT,
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at             TIMESTAMPTZ,
        created_by             UUID REFERENCES auth.users(id)
      )$f$, sch, sch);
    -- Um ano só aparece uma vez por ciclo (ignora soft-deleted).
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_projecoes_ciclo_ano ON %I.planejamento_projecoes '
      '(ciclo_id, ano) WHERE deleted_at IS NULL', sch);

    -- ─── 5. Meta corporativa (o "KR") ──────────────────────────
    --  periodo_tipo diz qual recorte vale: ano | semestre | mes.
    --  fonte != 'manual' → realizado calculado na leitura, e
    --  realizado_manual é ignorado (a coluna continua sendo o valor
    --  lançado à mão nas rotinas quando fonte = 'manual').
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.metas_corporativas (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ciclo_id              UUID NOT NULL REFERENCES %I.planejamento_ciclos(id) ON DELETE CASCADE,
        objetivo_id           UUID REFERENCES %I.planejamento_objetivos(id) ON DELETE SET NULL,
        titulo                TEXT NOT NULL,
        descricao             TEXT,
        responsavel_id        UUID REFERENCES %I.user_profiles(id),
        periodo_tipo          TEXT NOT NULL CHECK (periodo_tipo IN ('ano','semestre','mes')),
        ano                   INT  NOT NULL CHECK (ano BETWEEN 2020 AND 2100),
        semestre              INT  CHECK (semestre IN (1,2)),
        mes                   INT  CHECK (mes BETWEEN 1 AND 12),
        unidade               TEXT NOT NULL DEFAULT 'quantidade'
                              CHECK (unidade IN ('moeda','quantidade','percentual')),
        direcao               TEXT NOT NULL DEFAULT 'maior_melhor'
                              CHECK (direcao IN ('maior_melhor','menor_melhor')),
        alvo                  NUMERIC(14,2) NOT NULL,
        minimo                NUMERIC(14,2),
        fonte                 TEXT NOT NULL DEFAULT 'manual'
                              CHECK (fonte IN ('manual','receita','contratos','leads','reunioes','cac')),
        realizado_manual      NUMERIC(14,2),
        peso                  INT  NOT NULL DEFAULT 1 CHECK (peso BETWEEN 1 AND 10),
        incentivo_tipo        TEXT NOT NULL DEFAULT 'nenhum'
                              CHECK (incentivo_tipo IN ('nenhum','valor_fixo','percentual_meta')),
        incentivo_valor       NUMERIC(14,2),
        incentivo_gatilho_pct INT  NOT NULL DEFAULT 100 CHECK (incentivo_gatilho_pct BETWEEN 1 AND 200),
        incentivo_teto        NUMERIC(14,2),
        status                TEXT NOT NULL DEFAULT 'ativa'
                              CHECK (status IN ('ativa','concluida','cancelada')),
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at            TIMESTAMPTZ,
        created_by            UUID REFERENCES auth.users(id),
        -- O recorte tem de ser coerente com periodo_tipo, senão a meta
        -- não sabe a que período pertence e some dos filtros.
        CONSTRAINT metas_periodo_coerente CHECK (
          (periodo_tipo = 'ano'      AND semestre IS NULL AND mes IS NULL) OR
          (periodo_tipo = 'semestre' AND semestre IS NOT NULL AND mes IS NULL) OR
          (periodo_tipo = 'mes'      AND mes IS NOT NULL AND semestre IS NULL)
        ),
        -- Prêmio configurado exige valor; sem valor o incentivo é 'nenhum'.
        CONSTRAINT metas_incentivo_coerente CHECK (
          incentivo_tipo = 'nenhum' OR incentivo_valor IS NOT NULL
        )
      )$f$, sch, sch, sch, sch);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_metas_periodo ON %I.metas_corporativas '
      '(ciclo_id, ano, periodo_tipo) WHERE deleted_at IS NULL', sch);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_metas_responsavel ON %I.metas_corporativas '
      '(responsavel_id) WHERE deleted_at IS NULL', sch);

    -- ─── 6. Check-in (rotina de acompanhamento da meta) ────────
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.metas_checkins (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        meta_id    UUID NOT NULL REFERENCES %I.metas_corporativas(id) ON DELETE CASCADE,
        data       DATE NOT NULL DEFAULT CURRENT_DATE,
        valor      NUMERIC(14,2),
        farol      TEXT NOT NULL DEFAULT 'verde'
                   CHECK (farol IN ('verde','amarelo','vermelho')),
        comentario TEXT,
        autor_id   UUID REFERENCES %I.user_profiles(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        created_by UUID REFERENCES auth.users(id)
      )$f$, sch, sch, sch);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_checkins_meta ON %I.metas_checkins '
      '(meta_id, data DESC) WHERE deleted_at IS NULL', sch);

    -- ─── 7. Apuração de incentivo (previsto → aprovado → pago) ─
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.incentivos_apuracoes (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        meta_id       UUID NOT NULL REFERENCES %I.metas_corporativas(id) ON DELETE CASCADE,
        pessoa_id     UUID NOT NULL REFERENCES %I.user_profiles(id),
        pct_atingido  NUMERIC(6,2) NOT NULL DEFAULT 0,
        valor_apurado NUMERIC(14,2) NOT NULL DEFAULT 0,
        status        TEXT NOT NULL DEFAULT 'previsto'
                      CHECK (status IN ('previsto','aprovado','pago','cancelado')),
        aprovado_por  UUID REFERENCES %I.user_profiles(id),
        aprovado_em   TIMESTAMPTZ,
        pago_em       TIMESTAMPTZ,
        observacao    TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ,
        created_by    UUID REFERENCES auth.users(id)
      )$f$, sch, sch, sch, sch);
    -- Uma apuração por pessoa por meta (a meta já carrega o período).
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_apuracao_meta_pessoa ON %I.incentivos_apuracoes '
      '(meta_id, pessoa_id) WHERE deleted_at IS NULL', sch);

    -- ─── 8. Rotinas de acompanhamento + execuções ──────────────
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.rotinas_acompanhamento (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome          TEXT NOT NULL,
        descricao     TEXT,
        frequencia    TEXT NOT NULL
                      CHECK (frequencia IN ('semanal','quinzenal','mensal','trimestral')),
        dia_semana    INT  CHECK (dia_semana BETWEEN 0 AND 6),
        dia_mes       INT  CHECK (dia_mes BETWEEN 1 AND 31),
        hora          TIME,
        escopo        TEXT NOT NULL DEFAULT 'ciclo'
                      CHECK (escopo IN ('ciclo','objetivo','meta')),
        escopo_id     UUID,
        participantes UUID[] NOT NULL DEFAULT '{}',
        pauta         TEXT,
        ativa         BOOLEAN NOT NULL DEFAULT true,
        proxima_em    DATE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ,
        created_by    UUID REFERENCES auth.users(id)
      )$f$, sch);

    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I.rotinas_execucoes (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        rotina_id     UUID NOT NULL REFERENCES %I.rotinas_acompanhamento(id) ON DELETE CASCADE,
        data          DATE NOT NULL DEFAULT CURRENT_DATE,
        notas         TEXT,
        decisoes      TEXT,
        participantes UUID[] NOT NULL DEFAULT '{}',
        autor_id      UUID REFERENCES %I.user_profiles(id),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at    TIMESTAMPTZ,
        created_by    UUID REFERENCES auth.users(id)
      )$f$, sch, sch, sch);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_rotinas_exec ON %I.rotinas_execucoes '
      '(rotina_id, data DESC) WHERE deleted_at IS NULL', sch);
  END LOOP;
END $$;

-- ─── Triggers de updated_at + auditoria, RLS e policies ──────
-- Bloco separado para manter cada responsabilidade legível: acima é o
-- DDL das tabelas, aqui é o comportamento comum a todas elas.
DO $$
DECLARE
  sch  TEXT;
  tbl  TEXT;
  tabelas TEXT[] := ARRAY[
    'planejamento_ciclos', 'planejamento_objetivos', 'planejamento_projetos',
    'planejamento_projecoes', 'metas_corporativas', 'metas_checkins',
    'incentivos_apuracoes', 'rotinas_acompanhamento', 'rotinas_execucoes'
  ];
BEGIN
  FOREACH sch IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    CONTINUE WHEN to_regclass(sch || '.user_profiles') IS NULL;

    FOREACH tbl IN ARRAY tabelas LOOP
      CONTINUE WHEN to_regclass(sch || '.' || tbl) IS NULL;

      -- updated_at automático
      EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I.%I', tbl, sch, tbl);
      EXECUTE format(
        'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I.%I '
        'FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', tbl, sch, tbl);

      -- trilha de auditoria (todas têm `id`, requisito do log_change)
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%s ON %I.%I', tbl, sch, tbl);
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON %I.%I '
        'FOR EACH ROW EXECUTE FUNCTION audit.log_change()', tbl, sch, tbl);

      EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', sch, tbl);

      -- Leitura: todo usuário autenticado enxerga o planejamento (o time
      -- precisa ver as próprias metas). Escrita continua CEO-only.
      EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I.%I', tbl, sch, tbl);
      EXECUTE format(
        'CREATE POLICY "%s_select" ON %I.%I FOR SELECT TO authenticated '
        'USING (deleted_at IS NULL)', tbl, sch, tbl);

      EXECUTE format('DROP POLICY IF EXISTS "%s_ceo" ON %I.%I', tbl, sch, tbl);
      EXECUTE format(
        'CREATE POLICY "%s_ceo" ON %I.%I FOR ALL TO authenticated '
        'USING (public.get_user_papel() = ''ceo'') '
        'WITH CHECK (public.get_user_papel() = ''ceo'')', tbl, sch, tbl);

      EXECUTE format('DROP POLICY IF EXISTS "%s_service" ON %I.%I', tbl, sch, tbl);
      EXECUTE format(
        'CREATE POLICY "%s_service" ON %I.%I FOR ALL TO service_role '
        'USING (true) WITH CHECK (true)', tbl, sch, tbl);
    END LOOP;
  END LOOP;
END $$;

-- ─── Acompanhamento é do time, não só do CEO ──────────────────
--     Quem toca a meta registra o próprio check-in, e quem participa
--     da rotina registra o encontro. Sem estas duas policies o Head
--     receberia erro de permissão ao usar a tela de rotinas —
--     a action já libera, o RLS é que barraria.
DO $$
DECLARE sch TEXT;
BEGIN
  FOREACH sch IN ARRAY ARRAY['public', 'uat', 'dev'] LOOP
    IF to_regclass(sch || '.metas_checkins') IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "metas_checkins_autor" ON %I.metas_checkins', sch);
      EXECUTE format(
        'CREATE POLICY "metas_checkins_autor" ON %I.metas_checkins FOR INSERT TO authenticated '
        'WITH CHECK (created_by = auth.uid())', sch);
    END IF;
    IF to_regclass(sch || '.rotinas_execucoes') IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "rotinas_execucoes_autor" ON %I.rotinas_execucoes', sch);
      EXECUTE format(
        'CREATE POLICY "rotinas_execucoes_autor" ON %I.rotinas_execucoes FOR INSERT TO authenticated '
        'WITH CHECK (created_by = auth.uid())', sch);
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.planejamento_ciclos IS 'Ciclo estratégico de 3 anos (visão + janela). Raiz do módulo /planejamento.';
COMMENT ON TABLE public.metas_corporativas IS 'Meta corporativa (KR). fonte != manual → realizado é calculado do próprio banco; manual → vem de realizado_manual/check-ins.';
COMMENT ON COLUMN public.metas_corporativas.incentivo_gatilho_pct IS 'Percentual de atingimento a partir do qual o bônus é devido (100 = só paga meta cheia).';
COMMENT ON TABLE public.incentivos_apuracoes IS 'Bônus apurado por pessoa/meta. previsto → aprovado → pago (CEO aprova).';
