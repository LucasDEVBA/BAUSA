-- Gamificação do Engine (2026-08-19, pedido do CEO): XP por ação real
-- (aprovar lead, mover deal, criar contrato, contato com família…),
-- níveis, conquistas e ranking CEO × Head.
--
--   gamificacao_eventos    — append-only, FONTE ÚNICA do XP (mesmo racional
--                            do fluxo_eventos). Pontos congelados na linha:
--                            mudar o catálogo não reescreve o passado.
--   gamificacao_conquistas — desbloqueios (idempotente por UNIQUE).
--
-- RLS: leitura para authenticated (ranking é público interno — CEO e Head
-- se veem); escrita SÓ service_role (a lib server-side registra via admin
-- client — o client de sessão não inventa ponto).
DO $$
BEGIN
  IF to_regclass('public.gamificacao_eventos') IS NULL THEN
    CREATE TABLE public.gamificacao_eventos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      tipo text NOT NULL,
      pontos integer NOT NULL DEFAULT 0,
      ref_tipo text,
      ref_id uuid,
      criado_em timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX gamificacao_eventos_user_idx
      ON public.gamificacao_eventos (user_id, criado_em DESC);
    CREATE INDEX gamificacao_eventos_tipo_idx
      ON public.gamificacao_eventos (tipo);

    ALTER TABLE public.gamificacao_eventos ENABLE ROW LEVEL SECURITY;
    CREATE POLICY gamificacao_eventos_select ON public.gamificacao_eventos
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF to_regclass('public.gamificacao_conquistas') IS NULL THEN
    CREATE TABLE public.gamificacao_conquistas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      conquista text NOT NULL,
      desbloqueada_em timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, conquista)
    );
    ALTER TABLE public.gamificacao_conquistas ENABLE ROW LEVEL SECURITY;
    CREATE POLICY gamificacao_conquistas_select ON public.gamificacao_conquistas
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
