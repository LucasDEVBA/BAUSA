-- ============================================================
-- Familia: uploads + health score + templates de mensagem
--
-- 1) Bucket Supabase Storage `crm-uploads` (privado, com policies)
-- 2) Coluna `anexos JSONB` em contatos_experiencia
-- 3) Tabela `mensagem_templates`
-- 4) Função SQL calcular_health_score(experiencia_id)
-- ============================================================

-- ─── 1. Storage bucket ────────────────────────────────────────
-- Bucket privado. Acesso somente via signed URLs (server-side).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'crm-uploads',
  'crm-uploads',
  false,
  20971520, -- 20MB
  ARRAY[
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies: authenticated CEO/head_sucesso pode INSERT/SELECT/DELETE
DROP POLICY IF EXISTS "crm_uploads_select" ON storage.objects;
CREATE POLICY "crm_uploads_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'crm-uploads'
    AND public.get_user_papel() IN ('ceo', 'head_sucesso')
  );

DROP POLICY IF EXISTS "crm_uploads_insert" ON storage.objects;
CREATE POLICY "crm_uploads_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'crm-uploads'
    AND public.get_user_papel() IN ('ceo', 'head_sucesso')
  );

DROP POLICY IF EXISTS "crm_uploads_update" ON storage.objects;
CREATE POLICY "crm_uploads_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'crm-uploads'
    AND public.get_user_papel() IN ('ceo', 'head_sucesso')
  );

DROP POLICY IF EXISTS "crm_uploads_delete" ON storage.objects;
CREATE POLICY "crm_uploads_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'crm-uploads'
    AND public.get_user_papel() IN ('ceo', 'head_sucesso')
  );

-- ─── 2. Anexos em contatos_experiencia ────────────────────────
ALTER TABLE public.contatos_experiencia
  ADD COLUMN IF NOT EXISTS anexos JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.contatos_experiencia.anexos IS
  'Array de anexos: [{path, name, type, size, uploaded_at}]';

-- ─── 3. Mensagem templates ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mensagem_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  categoria   TEXT NOT NULL CHECK (categoria IN (
    'onboarding', 'checkin', 'pre_embarque', 'pos_embarque',
    'documento', 'crise', 'celebracao', 'follow_up', 'outro'
  )),
  canal       TEXT NOT NULL CHECK (canal IN ('whatsapp', 'email', 'ambos')),
  assunto     TEXT, -- usado quando canal inclui email
  corpo       TEXT NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

COMMENT ON TABLE public.mensagem_templates IS
  'Templates de mensagens para WhatsApp/email com variáveis {atleta}, {responsavel}, etc.';
COMMENT ON COLUMN public.mensagem_templates.corpo IS
  'Variáveis suportadas: {atleta_primeiro_nome}, {atleta_nome}, {responsavel_primeiro_nome}, {responsavel_nome}, {plano}, {esporte}, {data_embarque}, {dias_sem_contato}';

CREATE INDEX IF NOT EXISTS idx_mensagem_templates_ativo
  ON public.mensagem_templates(ativo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mensagem_templates_categoria
  ON public.mensagem_templates(categoria) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_mensagem_templates_updated_at ON public.mensagem_templates;
CREATE TRIGGER trg_mensagem_templates_updated_at
  BEFORE UPDATE ON public.mensagem_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.mensagem_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_select" ON public.mensagem_templates;
CREATE POLICY "templates_select" ON public.mensagem_templates
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "templates_insert" ON public.mensagem_templates;
CREATE POLICY "templates_insert" ON public.mensagem_templates
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_papel() IN ('ceo', 'head_sucesso'));

DROP POLICY IF EXISTS "templates_update" ON public.mensagem_templates;
CREATE POLICY "templates_update" ON public.mensagem_templates
  FOR UPDATE TO authenticated
  USING (public.get_user_papel() IN ('ceo', 'head_sucesso'))
  WITH CHECK (public.get_user_papel() IN ('ceo', 'head_sucesso'));

DROP POLICY IF EXISTS "templates_delete" ON public.mensagem_templates;
CREATE POLICY "templates_delete" ON public.mensagem_templates
  FOR DELETE TO authenticated
  USING (public.get_user_papel() = 'ceo');

-- Seed: templates iniciais
INSERT INTO public.mensagem_templates (nome, categoria, canal, assunto, corpo)
VALUES
  (
    'Onboarding inicial (WhatsApp)',
    'onboarding',
    'whatsapp',
    NULL,
    'Olá {responsavel_primeiro_nome}! Aqui é o time da Bolsa Atleta USA. Quero dar as boas-vindas oficiais à família e ao(à) {atleta_primeiro_nome}! Vou acompanhar vocês de perto durante todo o processo. Podemos agendar uma call de 30min essa semana para alinharmos os próximos passos?'
  ),
  (
    'Check-in semanal',
    'checkin',
    'whatsapp',
    NULL,
    'Oi {responsavel_primeiro_nome}, tudo bem? Passando para o check-in da semana com a família. Como vocês estão se sentindo em relação ao processo do(a) {atleta_primeiro_nome}? Alguma dúvida ou preocupação que eu possa ajudar?'
  ),
  (
    'Lembrete de documento',
    'documento',
    'whatsapp',
    NULL,
    'Oi {responsavel_primeiro_nome}, tudo certo? Estou organizando os documentos do(a) {atleta_primeiro_nome} e ainda preciso de alguns itens para avançar com a admissão. Pode me ajudar essa semana?'
  ),
  (
    'Pré-embarque',
    'pre_embarque',
    'whatsapp',
    NULL,
    'Oi {responsavel_primeiro_nome}! Faltam poucas semanas para o(a) {atleta_primeiro_nome} embarcar. Vou enviar um checklist do que precisamos finalizar até o embarque. Tudo bem se eu agendar uma call para revisarmos juntos?'
  ),
  (
    'Pós-embarque (primeira semana)',
    'pos_embarque',
    'whatsapp',
    NULL,
    'Oi {responsavel_primeiro_nome}! Como o(a) {atleta_primeiro_nome} está se adaptando nessa primeira semana? Lembrando que estamos aqui para qualquer apoio que vocês precisarem.'
  ),
  (
    'Email institucional',
    'follow_up',
    'email',
    'Bolsa Atleta USA — Atualização do processo de {atleta_nome}',
    E'Olá {responsavel_primeiro_nome},\n\nEspero que esteja tudo bem com a família.\n\nEstou entrando em contato para uma atualização sobre o processo do(a) {atleta_primeiro_nome} na BAUSA.\n\n[escreva aqui]\n\nFico à disposição para qualquer dúvida.\n\nAbraço,\nTime Bolsa Atleta USA'
  ),
  (
    'Celebração de marco',
    'celebracao',
    'whatsapp',
    NULL,
    '🎉 {responsavel_primeiro_nome}, mais uma conquista para a família! Parabéns ao(à) {atleta_primeiro_nome}! Estamos muito orgulhosos do caminho que vocês construíram. Vamos juntos para o próximo passo!'
  )
ON CONFLICT DO NOTHING;

-- ─── 4. Função calcular_health_score(experiencia_id) ──────────
-- Retorna 0-100. 100 = perfeito. <40 = crítico.
-- Composição:
--   • 40 pontos: satisfação (1=0pt, 5=40pt)
--   • 30 pontos: ansiedade invertida (1=30pt, 5=0pt)
--   • 15 pontos: risco percebido invertido (1=15pt, 5=0pt)
--   • 15 pontos: contato recente (0d=15, 30d+=0)
--   • Penalidades duras:
--     status='crise' → -30
--     status='atencao' → -10
--     temperatura='vermelho' → -10
CREATE OR REPLACE FUNCTION public.calcular_health_score(p_experiencia_id UUID)
RETURNS INT AS $$
DECLARE
  v_exp RECORD;
  v_score NUMERIC := 0;
  v_dias_sem INT;
BEGIN
  SELECT ansiedade, satisfacao, risco_percebido, status, temperatura,
         data_ultimo_contato
    INTO v_exp
  FROM public.crm_experiencia
  WHERE id = p_experiencia_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Satisfação (0..40)
  v_score := v_score + ((COALESCE(v_exp.satisfacao, 3) - 1) * 10.0);

  -- Ansiedade invertida (0..30)
  v_score := v_score + ((5 - COALESCE(v_exp.ansiedade, 3)) * 7.5);

  -- Risco percebido invertido (0..15)
  v_score := v_score + ((5 - COALESCE(v_exp.risco_percebido, 3)) * 3.75);

  -- Contato recente (0..15)
  IF v_exp.data_ultimo_contato IS NULL THEN
    v_dias_sem := 30;
  ELSE
    v_dias_sem := LEAST(30, GREATEST(0,
      EXTRACT(DAY FROM NOW() - v_exp.data_ultimo_contato)::INT
    ));
  END IF;
  v_score := v_score + ((30 - v_dias_sem) * 0.5);

  -- Penalidades
  IF v_exp.status = 'crise' THEN
    v_score := v_score - 30;
  ELSIF v_exp.status = 'atencao' THEN
    v_score := v_score - 10;
  END IF;

  IF v_exp.temperatura = 'vermelho' THEN
    v_score := v_score - 10;
  END IF;

  RETURN GREATEST(0, LEAST(100, ROUND(v_score)::INT));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.calcular_health_score(UUID) IS
  'Score 0-100 da saúde da família. Composto de indicadores + status + contato + temperatura.';
