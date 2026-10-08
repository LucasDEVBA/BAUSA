-- ════════════════════════════════════════════════════════════════════════
-- Banco de Escolas — correção EM LOTE após a validação da Head (OPCIONAL)
-- ⚠️ NÃO EXECUTAR SEM AUTORIZAÇÃO DO CEO. O caminho padrão é corrigir pela
--    tela /escolas (Editar), que já audita quem mudou (T16). Use este script
--    só se a Head entregar uma lista grande de correções de uma vez.
-- Idempotente: só atualiza o que MUDA; NULL na tabela de correções = "não
-- mexer neste campo". Termina em ROLLBACK — trocar por COMMIT só depois de
-- conferir a prévia e com o OK explícito.
-- Requer a migration 20261008170000 (coluna perfil).
-- ════════════════════════════════════════════════════════════════════════
BEGIN;

-- Autor no audit_logs (sem JWT, o trigger grava NULL = "sistema"). Trocar
-- pelo id do executor (public.user_profiles.id) — o guard abaixo aborta
-- enquanto estiver vazio.
SELECT set_config('audit.user_id', '<uuid-do-executor>', true);

CREATE TEMP TABLE correcoes_escolas (
  nome      TEXT PRIMARY KEY,  -- casado por lower(nome) com public.escolas
  tipo      TEXT,              -- boarding | day | mista | NULL (não mexer)
  perfil    TEXT,              -- academia_esportiva | prep_tradicional | religiosa | boarding_internacional | outro | NULL
  cidade    TEXT,
  estado_us TEXT,              -- sigla de 2 letras (FL, NC...)
  website   TEXT               -- https://...
) ON COMMIT DROP;

-- Preencher com as respostas da Head (exemplo com marcadores — o guard
-- abaixo ABORTA enquanto houver '<...>'):
INSERT INTO correcoes_escolas (nome, tipo, perfil, cidade, estado_us, website) VALUES
  ('Gateway Academy', NULL, NULL, '<cidade>', '<UF>', '<https://site-oficial>'),
  ('RPS Academies',   NULL, NULL, '<cidade>', '<UF>', '<https://site-oficial>');

-- ─── Guardas (abortam tudo antes de tocar em qualquer linha) ────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles up
                 WHERE up.id::text = current_setting('audit.user_id', true)) THEN
    RAISE EXCEPTION 'Defina audit.user_id com o id do executor (user_profiles) antes de rodar.';
  END IF;
  IF EXISTS (SELECT 1 FROM correcoes_escolas
             WHERE concat_ws('|', tipo, perfil, cidade, estado_us, website) LIKE '%<%') THEN
    RAISE EXCEPTION 'Ainda há marcadores <...> — preencha com os dados confirmados pela Head.';
  END IF;
  IF EXISTS (SELECT 1 FROM correcoes_escolas c
             LEFT JOIN public.escolas e ON lower(e.nome) = lower(c.nome) AND e.deleted_at IS NULL
             WHERE e.id IS NULL) THEN
    RAISE EXCEPTION 'Escola não encontrada (nome diferente do cadastro).';
  END IF;
  -- Sem UNIQUE em escolas.nome: o UPDATE ... FROM abaixo corrigiria TODAS as
  -- homônimas ativas sem aviso. Ambíguo = corrigir pela tela, escola a escola.
  IF EXISTS (SELECT 1 FROM correcoes_escolas c
             JOIN public.escolas e ON lower(e.nome) = lower(c.nome) AND e.deleted_at IS NULL
             GROUP BY lower(c.nome) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Nome ambíguo: mais de uma escola ativa (ou linha repetida na lista) com este nome — corrigir pela tela.';
  END IF;
  IF EXISTS (SELECT 1 FROM correcoes_escolas WHERE tipo IS NOT NULL AND tipo NOT IN ('boarding','day','mista')) THEN
    RAISE EXCEPTION 'tipo inválido (use boarding, day ou mista).';
  END IF;
  IF EXISTS (SELECT 1 FROM correcoes_escolas WHERE perfil IS NOT NULL AND perfil NOT IN
             ('academia_esportiva','prep_tradicional','religiosa','boarding_internacional','outro')) THEN
    RAISE EXCEPTION 'perfil inválido.';
  END IF;
  -- Mesma lista da tela (US_STATES: 50 estados + DC) — sigla fora dela
  -- continuaria aparecendo como "Localização a confirmar".
  IF EXISTS (SELECT 1 FROM correcoes_escolas WHERE estado_us IS NOT NULL AND estado_us NOT IN (
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY',
    'LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH',
    'OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY')) THEN
    RAISE EXCEPTION 'estado_us inválido (use a sigla oficial: FL, NC, DC...).';
  END IF;
  IF EXISTS (SELECT 1 FROM correcoes_escolas WHERE cidade IS NOT NULL AND length(trim(cidade)) < 2) THEN
    RAISE EXCEPTION 'cidade inválida.';
  END IF;
  IF EXISTS (SELECT 1 FROM correcoes_escolas WHERE website IS NOT NULL AND website !~* '^https?://') THEN
    RAISE EXCEPTION 'website deve começar com http:// ou https://.';
  END IF;
END $$;

-- ─── Prévia (o que vai mudar) ────────────────────────────────────────────
SELECT e.nome,
       e.tipo      AS tipo_antes,      COALESCE(c.tipo, e.tipo)           AS tipo_depois,
       e.perfil    AS perfil_antes,    COALESCE(c.perfil, e.perfil)       AS perfil_depois,
       e.cidade    AS cidade_antes,    COALESCE(c.cidade, e.cidade)       AS cidade_depois,
       e.estado_us AS estado_antes,    COALESCE(c.estado_us, e.estado_us) AS estado_depois,
       e.website   AS website_antes,   COALESCE(c.website, e.website)     AS website_depois
FROM public.escolas e
JOIN correcoes_escolas c ON lower(c.nome) = lower(e.nome)
WHERE e.deleted_at IS NULL;

-- ─── Aplicação (só linhas que de fato mudam → audit_logs só registra mudança real)
UPDATE public.escolas e
SET tipo      = COALESCE(c.tipo, e.tipo),
    perfil    = COALESCE(c.perfil, e.perfil),
    cidade    = COALESCE(trim(c.cidade), e.cidade),
    estado_us = COALESCE(c.estado_us, e.estado_us),
    website   = COALESCE(c.website, e.website)
FROM correcoes_escolas c
WHERE lower(c.nome) = lower(e.nome)
  AND e.deleted_at IS NULL
  AND (   COALESCE(c.tipo, e.tipo)                 IS DISTINCT FROM e.tipo
       OR COALESCE(c.perfil, e.perfil)             IS DISTINCT FROM e.perfil
       OR COALESCE(trim(c.cidade), e.cidade)       IS DISTINCT FROM e.cidade
       OR COALESCE(c.estado_us, e.estado_us)       IS DISTINCT FROM e.estado_us
       OR COALESCE(c.website, e.website)           IS DISTINCT FROM e.website);

-- ─── Conferência ──────────────────────────────────────────────────────────
SELECT e.nome, e.tipo, e.perfil, e.cidade, e.estado_us, e.website, e.updated_at
FROM public.escolas e
JOIN correcoes_escolas c ON lower(c.nome) = lower(e.nome)
WHERE e.deleted_at IS NULL
ORDER BY e.nome;

ROLLBACK;  -- trocar por COMMIT somente com autorização explícita do CEO
