-- ════════════════════════════════════════════════════════════════════════
-- Migration: whatsapp_grupos — leitura pelo HEAD de sucesso (grupos vinculados)
-- Aplica em: public, uat, dev (multi-schema; uat/dev gateados por to_regclass)
-- ════════════════════════════════════════════════════════════════════════
--
-- Contexto:
--   A Fase A (20260712140500) deixou os grupos e as mensagens de grupo CEO-only.
--   O Head de Sucesso participa dos grupos das famílias que acompanha, então
--   passa a ENXERGAR (e responder, via app) os grupos VINCULADOS a uma família.
--
--   Escopo do Head (defense-in-depth com o gate das server actions):
--     • whatsapp_grupos      → SELECT só de grupos NÃO deletados e VINCULADOS
--                              (atleta_id IS NOT NULL OR experiencia_id IS NOT NULL).
--                              NÃO vê grupos sem vínculo. Toggle de captura e
--                              vínculo continuam CEO-only (policy de UPDATE da Fase A).
--     • whatsapp_mensagens   → SELECT só de mensagens de GRUPO (is_grupo = true)
--                              cujo grupo está vinculado. As mensagens 1:1
--                              (is_grupo = false) PERMANECEM CEO-only — a policy
--                              nova filtra is_grupo = true de propósito.
--
--   As policies são ADITIVAS: as policies CEO (Fase A / whatsapp_mensagens) seguem
--   intactas; múltiplas policies de SELECT são OR — o CEO continua vendo tudo, o
--   Head passa a ver só o subconjunto de grupo vinculado.
--
-- Forward-only, idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- ─── PUBLIC (PRD) ────────────────────────────────────────────────────────

-- Head vê os grupos vinculados a uma família (não deletados, com vínculo).
DROP POLICY IF EXISTS "whatsapp_grupos_head_select" ON public.whatsapp_grupos;
CREATE POLICY "whatsapp_grupos_head_select" ON public.whatsapp_grupos
  FOR SELECT TO authenticated
  USING (
    public.get_user_papel() = 'head_sucesso'
    AND deleted_at IS NULL
    AND (atleta_id IS NOT NULL OR experiencia_id IS NOT NULL)
  );

-- Head vê as mensagens de GRUPO (is_grupo = true) de grupos vinculados. As 1:1
-- (is_grupo = false) NÃO entram — filtro explícito mantém a conversa 1:1 CEO-only.
DROP POLICY IF EXISTS "whatsapp_msg_head_grupo_select" ON public.whatsapp_mensagens;
CREATE POLICY "whatsapp_msg_head_grupo_select" ON public.whatsapp_mensagens
  FOR SELECT TO authenticated
  USING (
    public.get_user_papel() = 'head_sucesso'
    AND is_grupo = true
    AND grupo_id IN (
      SELECT grupo_id FROM public.whatsapp_grupos
      WHERE deleted_at IS NULL
        AND (atleta_id IS NOT NULL OR experiencia_id IS NOT NULL)
    )
  );

-- ─── UAT ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('uat.whatsapp_grupos') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_grupos_head_select" ON uat.whatsapp_grupos';
    EXECUTE '
      CREATE POLICY "whatsapp_grupos_head_select" ON uat.whatsapp_grupos
        FOR SELECT TO authenticated
        USING (
          public.get_user_papel() = ''head_sucesso''
          AND deleted_at IS NULL
          AND (atleta_id IS NOT NULL OR experiencia_id IS NOT NULL)
        )';
  END IF;

  IF to_regclass('uat.whatsapp_mensagens') IS NOT NULL
     AND to_regclass('uat.whatsapp_grupos') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_msg_head_grupo_select" ON uat.whatsapp_mensagens';
    EXECUTE '
      CREATE POLICY "whatsapp_msg_head_grupo_select" ON uat.whatsapp_mensagens
        FOR SELECT TO authenticated
        USING (
          public.get_user_papel() = ''head_sucesso''
          AND is_grupo = true
          AND grupo_id IN (
            SELECT grupo_id FROM uat.whatsapp_grupos
            WHERE deleted_at IS NULL
              AND (atleta_id IS NOT NULL OR experiencia_id IS NOT NULL)
          )
        )';
  END IF;
END $$;

-- ─── DEV ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('dev.whatsapp_grupos') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_grupos_head_select" ON dev.whatsapp_grupos';
    EXECUTE '
      CREATE POLICY "whatsapp_grupos_head_select" ON dev.whatsapp_grupos
        FOR SELECT TO authenticated
        USING (
          public.get_user_papel() = ''head_sucesso''
          AND deleted_at IS NULL
          AND (atleta_id IS NOT NULL OR experiencia_id IS NOT NULL)
        )';
  END IF;

  IF to_regclass('dev.whatsapp_mensagens') IS NOT NULL
     AND to_regclass('dev.whatsapp_grupos') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "whatsapp_msg_head_grupo_select" ON dev.whatsapp_mensagens';
    EXECUTE '
      CREATE POLICY "whatsapp_msg_head_grupo_select" ON dev.whatsapp_mensagens
        FOR SELECT TO authenticated
        USING (
          public.get_user_papel() = ''head_sucesso''
          AND is_grupo = true
          AND grupo_id IN (
            SELECT grupo_id FROM dev.whatsapp_grupos
            WHERE deleted_at IS NULL
              AND (atleta_id IS NOT NULL OR experiencia_id IS NOT NULL)
          )
        )';
  END IF;
END $$;
