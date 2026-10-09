-- ════════════════════════════════════════════════════════════════════════
-- Migration: Financeiro — contrato flexível (T5/T6/T9/T10/T11/T18)
-- Aplica em: public (contratos_financeiros, parcelas, contrato_itens,
--   contrato_eventos, configuracoes_sistema — existem SÓ em public, verificado
--   em 2026-10-08 via information_schema) e despesas em public/uat/dev.
--   Gate POR TABELA (to_regclass): uat/dev não têm contratos_financeiros.
--
-- Contexto (vídeos do CEO 28/09):
--   • T9  — formas/métodos travados por CHECK (só pix/getnet): amplia.
--   • T11 — sinal antes do plano: contrato "aguardando plano" = plano NULL,
--           valor_total = entrada_valor (Σ dos sinais), sem saldo. O sinal é
--           parcela tipo 'entrada' RECEBIDA → entra no caixa/DRE na data real.
--   • T10 — escolha do plano preenche plano/valor_base_plano (fonte única de
--           plano = contratos_financeiros; NÃO criamos deals.plano_escolhido).
--   • T18a — itens por aluno (serviço/desconto/ajuste) compõem o valor_total:
--           valor_total = valor_base_plano + Σ itens + (sinal_abatido ? 0 : entrada).
--   • T18b — custo interno por aluno REUSA despesas (livro-razão de saídas,
--           já no DRE): despesas.contrato_id + categorias de custo de aluno.
--
-- COMPATIBILIDADE COM O CÓDIGO ANTIGO (main roda até a promoção):
--   • Só ADICIONA colunas/tabelas e AMPLIA CHECKs (superset dos valores atuais).
--   • plano/forma_pagamento_plano/entrada_forma perdem o NOT NULL, mas o código
--     antigo SEMPRE os preenche; linhas com NULL só nascem pelo código novo.
--   • valor_total continua NOT NULL (agregações antigas seguem numéricas).
--   • CHECKs novos foram testados contra os 2 contratos existentes (ROLLBACK).
--   • NÃO troca a UNIQUE(deal_id) por índice parcial (embed 1:1 contrato↔deal
--     continua OBJETO — lição do incidente de 05/09).
-- Forward-only, idempotente (rodar 2x não falha).
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. contratos_financeiros ───────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.contratos_financeiros') IS NULL THEN
    RAISE NOTICE 'financeiro_contrato_flexivel: sem public.contratos_financeiros — pulado';
    RETURN;
  END IF;

  -- Formas ampliadas (T9.5). Superset dos valores atuais.
  ALTER TABLE public.contratos_financeiros
    DROP CONSTRAINT IF EXISTS contratos_financeiros_entrada_forma_check;
  ALTER TABLE public.contratos_financeiros
    ADD CONSTRAINT contratos_financeiros_entrada_forma_check
    CHECK (entrada_forma IN ('pix','getnet_parcelado','transferencia','boleto','cartao','dinheiro','outro'));

  ALTER TABLE public.contratos_financeiros
    DROP CONSTRAINT IF EXISTS contratos_financeiros_saldo_forma_check;
  ALTER TABLE public.contratos_financeiros
    ADD CONSTRAINT contratos_financeiros_saldo_forma_check
    CHECK (saldo_forma IN ('pix_avista','pix_parcelado','getnet_parcelado','transferencia','boleto','cartao','dinheiro','outro'));

  -- Composição do valor (T18a) + sinal antes do plano (T11)
  ALTER TABLE public.contratos_financeiros
    ADD COLUMN IF NOT EXISTS valor_base_plano  NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS sinal_abatido     BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS plano_definido_at TIMESTAMPTZ;

  COMMENT ON COLUMN public.contratos_financeiros.valor_base_plano IS
    'Preço do plano escolhido (tabela de configuracoes_sistema.planos ou negociado). NULL = contrato legado (base = valor_total − Σ itens) ou aguardando plano.';
  COMMENT ON COLUMN public.contratos_financeiros.sinal_abatido IS
    'true (padrão) = o sinal/entrada é abatido do valor do plano; false = cobrado à parte (valor_total = base + itens + entrada).';
  COMMENT ON COLUMN public.contratos_financeiros.plano_definido_at IS
    'Quando o plano foi escolhido (T10). NULL em contrato aguardando plano; legado = created_at.';

  -- plano NULL = "aguardando plano" (T11). Código antigo sempre preenche.
  ALTER TABLE public.contratos_financeiros ALTER COLUMN plano DROP NOT NULL;
  ALTER TABLE public.contratos_financeiros ALTER COLUMN forma_pagamento_plano DROP NOT NULL;
  -- entrada 0 (contrato sem entrada) não precisa inventar forma.
  ALTER TABLE public.contratos_financeiros ALTER COLUMN entrada_forma DROP NOT NULL;

  -- Coerência do estado "aguardando plano": só sinais, sem saldo, total = entrada.
  ALTER TABLE public.contratos_financeiros
    DROP CONSTRAINT IF EXISTS contratos_financeiros_aguardando_plano_check;
  ALTER TABLE public.contratos_financeiros
    ADD CONSTRAINT contratos_financeiros_aguardando_plano_check CHECK (
      plano IS NOT NULL
      OR (forma_pagamento_plano IS NULL
          AND valor_base_plano IS NULL
          AND saldo_forma IS NULL
          AND valor_total = entrada_valor)
    );

  ALTER TABLE public.contratos_financeiros
    DROP CONSTRAINT IF EXISTS contratos_financeiros_plano_forma_check;
  ALTER TABLE public.contratos_financeiros
    ADD CONSTRAINT contratos_financeiros_plano_forma_check
    CHECK (plano IS NULL OR forma_pagamento_plano IS NOT NULL);

  ALTER TABLE public.contratos_financeiros
    DROP CONSTRAINT IF EXISTS contratos_financeiros_entrada_forma_presente_check;
  ALTER TABLE public.contratos_financeiros
    ADD CONSTRAINT contratos_financeiros_entrada_forma_presente_check
    CHECK (entrada_valor = 0 OR entrada_forma IS NOT NULL);

  -- Saldo nunca negativo; valores não negativos.
  ALTER TABLE public.contratos_financeiros
    DROP CONSTRAINT IF EXISTS contratos_financeiros_valores_check;
  ALTER TABLE public.contratos_financeiros
    ADD CONSTRAINT contratos_financeiros_valores_check CHECK (
      valor_total >= 0
      AND entrada_valor >= 0
      AND valor_total >= entrada_valor
      AND (valor_base_plano IS NULL OR valor_base_plano >= 0)
      AND (custo_psicologa IS NULL OR custo_psicologa >= 0)
    );

  ALTER TABLE public.contratos_financeiros
    DROP CONSTRAINT IF EXISTS contratos_financeiros_qtd_parcelas_check;
  ALTER TABLE public.contratos_financeiros
    ADD CONSTRAINT contratos_financeiros_qtd_parcelas_check CHECK (
      entrada_parcelas >= 0 AND (saldo_parcelas IS NULL OR saldo_parcelas >= 1)
    );
END $$;

-- ─── 2. parcelas ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.parcelas') IS NULL THEN
    RAISE NOTICE 'financeiro_contrato_flexivel: sem public.parcelas — pulado';
    RETURN;
  END IF;

  ALTER TABLE public.parcelas DROP CONSTRAINT IF EXISTS parcelas_metodo_check;
  ALTER TABLE public.parcelas
    ADD CONSTRAINT parcelas_metodo_check
    CHECK (metodo IN ('pix','getnet','transferencia','boleto','cartao','dinheiro','outro'));

  ALTER TABLE public.parcelas
    ADD COLUMN IF NOT EXISTS parcelas_cartao SMALLINT,
    ADD COLUMN IF NOT EXISTS observacao      TEXT;

  COMMENT ON COLUMN public.parcelas.parcelas_cartao IS
    'Vezes no cartão quando UMA parcela recebida representa uma venda parcelada (ex.: sinal na Getnet em 3x). Informativo.';
  COMMENT ON COLUMN public.parcelas.observacao IS
    'Nota livre da baixa/edição (ex.: "pago pela avó"). Máx. 500.';

  ALTER TABLE public.parcelas DROP CONSTRAINT IF EXISTS parcelas_parcelas_cartao_check;
  ALTER TABLE public.parcelas
    ADD CONSTRAINT parcelas_parcelas_cartao_check
    CHECK (parcelas_cartao IS NULL OR parcelas_cartao BETWEEN 1 AND 24);

  ALTER TABLE public.parcelas DROP CONSTRAINT IF EXISTS parcelas_observacao_check;
  ALTER TABLE public.parcelas
    ADD CONSTRAINT parcelas_observacao_check
    CHECK (observacao IS NULL OR char_length(observacao) <= 500);

  -- >= 0 (não > 0): o criarContrato ANTIGO grava parcela de entrada 0 quando a
  -- entrada é 0 — não pode quebrar durante a janela de promoção.
  ALTER TABLE public.parcelas DROP CONSTRAINT IF EXISTS parcelas_valor_check;
  ALTER TABLE public.parcelas ADD CONSTRAINT parcelas_valor_check CHECK (valor >= 0);

  ALTER TABLE public.parcelas DROP CONSTRAINT IF EXISTS parcelas_recebido_coerente_check;
  ALTER TABLE public.parcelas
    ADD CONSTRAINT parcelas_recebido_coerente_check
    CHECK (status <> 'recebido' OR recebido_at IS NOT NULL);

  CREATE INDEX IF NOT EXISTS idx_parcelas_contrato_vivas
    ON public.parcelas (contrato_id, tipo) WHERE deleted_at IS NULL;
END $$;

-- ─── 3. contrato_itens (T18a — condições negociadas por aluno) ──────────
DO $$
BEGIN
  IF to_regclass('public.contratos_financeiros') IS NULL THEN
    RAISE NOTICE 'financeiro_contrato_flexivel: contrato_itens pulado (sem contratos_financeiros)';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS public.contrato_itens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id     UUID NOT NULL REFERENCES public.contratos_financeiros(id),
    tipo            TEXT NOT NULL CHECK (tipo IN ('servico','desconto','ajuste')),
    descricao       TEXT NOT NULL CHECK (char_length(btrim(descricao)) BETWEEN 2 AND 160),
    valor           NUMERIC(10,2) NOT NULL,
    catalogo_chave  TEXT CHECK (catalogo_chave IS NULL OR catalogo_chave ~ '^[a-z0-9_]{1,40}$'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    created_by      UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    CONSTRAINT contrato_itens_sinal_check CHECK (
      (tipo = 'servico'  AND valor > 0)
      OR (tipo = 'desconto' AND valor < 0)
      OR (tipo = 'ajuste'   AND valor <> 0)
    )
  );

  COMMENT ON TABLE public.contrato_itens IS
    'Condições negociadas por aluno (T18a): serviços extras (+), descontos (−) e ajustes (±) que compõem contratos_financeiros.valor_total. Escrita só via RPC fin_salvar_condicoes.';

  DROP TRIGGER IF EXISTS trg_contrato_itens_updated_at ON public.contrato_itens;
  CREATE TRIGGER trg_contrato_itens_updated_at
    BEFORE UPDATE ON public.contrato_itens
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

  DROP TRIGGER IF EXISTS trg_audit_contrato_itens ON public.contrato_itens;
  CREATE TRIGGER trg_audit_contrato_itens
    AFTER INSERT OR UPDATE OR DELETE ON public.contrato_itens
    FOR EACH ROW EXECUTE FUNCTION audit.log_change();

  CREATE INDEX IF NOT EXISTS idx_contrato_itens_contrato
    ON public.contrato_itens (contrato_id) WHERE deleted_at IS NULL;

  ALTER TABLE public.contrato_itens ENABLE ROW LEVEL SECURITY;
  -- Dado financeiro do aluno: leitura e escrita só CEO/CTO (get_user_papel: cto→ceo).
  DROP POLICY IF EXISTS "contrato_itens_ceo" ON public.contrato_itens;
  CREATE POLICY "contrato_itens_ceo" ON public.contrato_itens
    FOR ALL TO authenticated
    USING (public.get_user_papel() = 'ceo')
    WITH CHECK (public.get_user_papel() = 'ceo');
  DROP POLICY IF EXISTS "contrato_itens_service" ON public.contrato_itens;
  CREATE POLICY "contrato_itens_service" ON public.contrato_itens
    FOR ALL TO service_role USING (true) WITH CHECK (true);
END $$;

-- ─── 4. contrato_eventos (histórico legível: justificativa + autor) ─────
-- Append-only (como audit_logs): sem UPDATE/DELETE para authenticated. Não
-- recebe trigger de audit (seria log do log). O audit.log_change continua
-- registrando as linhas de contratos/parcelas/itens; aqui fica o PORQUÊ.
DO $$
BEGIN
  IF to_regclass('public.contratos_financeiros') IS NULL THEN
    RAISE NOTICE 'financeiro_contrato_flexivel: contrato_eventos pulado (sem contratos_financeiros)';
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS public.contrato_eventos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id   UUID NOT NULL REFERENCES public.contratos_financeiros(id),
    deal_id       UUID REFERENCES public.deals(id),
    tipo          TEXT NOT NULL CHECK (tipo IN (
                    'contrato_criado','sinal_registrado','plano_escolhido',
                    'condicoes_editadas','parcela_editada','parcela_baixada',
                    'parcela_estornada','sinal_removido','contrato_quitado',
                    'contrato_descartado')),
    justificativa TEXT CHECK (justificativa IS NULL OR char_length(justificativa) <= 1000),
    detalhes      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    UUID REFERENCES auth.users(id) DEFAULT auth.uid()
  );

  COMMENT ON TABLE public.contrato_eventos IS
    'Histórico financeiro legível do contrato (quem, quando, o quê, por quê). Append-only. Gravado pelas RPCs fin_*.';

  CREATE INDEX IF NOT EXISTS idx_contrato_eventos_contrato
    ON public.contrato_eventos (contrato_id, created_at DESC);

  ALTER TABLE public.contrato_eventos ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "contrato_eventos_select" ON public.contrato_eventos;
  CREATE POLICY "contrato_eventos_select" ON public.contrato_eventos
    FOR SELECT TO authenticated
    USING (public.get_user_papel() = 'ceo');
  DROP POLICY IF EXISTS "contrato_eventos_insert" ON public.contrato_eventos;
  CREATE POLICY "contrato_eventos_insert" ON public.contrato_eventos
    FOR INSERT TO authenticated
    WITH CHECK (public.get_user_papel() = 'ceo' AND created_by = auth.uid());
  DROP POLICY IF EXISTS "contrato_eventos_service" ON public.contrato_eventos;
  CREATE POLICY "contrato_eventos_service" ON public.contrato_eventos
    FOR ALL TO service_role USING (true) WITH CHECK (true);
END $$;

-- ─── 5. despesas: custo interno por aluno (T18b) — public/uat/dev ──────
DO $$
DECLARE
  s TEXT;
BEGIN
  FOREACH s IN ARRAY ARRAY['public','uat','dev'] LOOP
    IF to_regclass(format('%I.despesas', s)) IS NULL THEN
      RAISE NOTICE 'financeiro_contrato_flexivel: %.despesas ausente — pulado', s;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I.despesas ADD COLUMN IF NOT EXISTS contrato_id UUID', s);

    -- FK só onde a tabela de contratos existe (hoje: public).
    IF to_regclass(format('%I.contratos_financeiros', s)) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conname = 'despesas_contrato_id_fkey'
           AND conrelid = to_regclass(format('%I.despesas', s))
       ) THEN
      EXECUTE format(
        'ALTER TABLE %I.despesas ADD CONSTRAINT despesas_contrato_id_fkey FOREIGN KEY (contrato_id) REFERENCES %I.contratos_financeiros(id)',
        s, s);
    END IF;

    -- Categorias de custo de aluno (superset das atuais).
    EXECUTE format('ALTER TABLE %I.despesas DROP CONSTRAINT IF EXISTS despesas_categoria_check', s);
    EXECUTE format(
      $f$ALTER TABLE %I.despesas ADD CONSTRAINT despesas_categoria_check CHECK (categoria IN ('folha','marketing','ferramentas','servicos','impostos','comissoes','ocupacao','outros','psicologa','taxas_escola','testes_idioma','traducao','viagem'))$f$,
      s);

    -- Custo de aluno é lançamento pontual: nunca template recorrente
    -- (senão o DRE projetaria o custo todo mês).
    EXECUTE format('ALTER TABLE %I.despesas DROP CONSTRAINT IF EXISTS despesas_custo_aluno_check', s);
    EXECUTE format(
      'ALTER TABLE %I.despesas ADD CONSTRAINT despesas_custo_aluno_check CHECK (contrato_id IS NULL OR recorrente = false)',
      s);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_despesas_contrato ON %I.despesas (contrato_id) WHERE contrato_id IS NOT NULL AND deleted_at IS NULL',
      s);

    EXECUTE format(
      $f$COMMENT ON COLUMN %I.despesas.contrato_id IS 'Custo interno da BAU com UM aluno (T18b). Entra no DRE como saída e na margem por aluno.'$f$,
      s);
  END LOOP;
END $$;

-- ─── 6. Seed: catálogo de serviços adicionais (T18a) ────────────────────
-- Chave nova nasce AQUI com ON CONFLICT DO NOTHING (PATCH sem seed é no-op —
-- lição 2026-08). Espelha o array SERVICOS_AVULSOS que vivia no código.
DO $$
BEGIN
  IF to_regclass('public.configuracoes_sistema') IS NULL THEN
    RAISE NOTICE 'financeiro_contrato_flexivel: sem configuracoes_sistema — seed pulado';
    RETURN;
  END IF;

  INSERT INTO public.configuracoes_sistema (chave, valor, descricao, editavel_ceo)
  VALUES (
    'servicos_adicionais',
    '[
      {"chave":"toefl","nome":"Preparação TOEFL","valor":2500,"ativo":true},
      {"chave":"ingles_3m","nome":"Aula particular inglês (3 meses)","valor":3600,"ativo":true},
      {"chave":"psicologico_extra","nome":"Acompanhamento psicológico extra","valor":1200,"ativo":true},
      {"chave":"traducao","nome":"Tradução juramentada","valor":800,"ativo":true}
    ]'::jsonb,
    'Catálogo de serviços adicionais sugeridos (itens do contrato e customização de valor do deal). Editável em Configurações → Parâmetros.',
    true
  )
  ON CONFLICT (chave) DO NOTHING;
END $$;
