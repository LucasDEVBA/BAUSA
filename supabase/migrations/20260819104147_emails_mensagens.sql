-- Módulo de E-mail do Engine (2026-08-19): compositor + caixa de entrada +
-- métricas. Uma linha por mensagem, nas DUAS direções:
--   enviado  — pelo compositor (via CF send-messages/Resend) OU pelo Gmail
--              do CEO (espelhado pelo email-inbox-sync)
--   recebido — respostas/entradas no Gmail da contato@ (email-inbox-sync)
-- Métricas de entrega/abertura/clique chegam pelo webhook do Resend
-- (CF email-events) e casam por resend_email_id.
-- Tabela SÓ em public — mesmo racional das tabelas do CRM/fluxos: o Engine
-- e as CFs leem public em todo ambiente.
DO $$
BEGIN
  IF to_regclass('public.emails_mensagens') IS NULL THEN
    CREATE TABLE public.emails_mensagens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      direcao text NOT NULL CHECK (direcao IN ('enviado', 'recebido')),
      origem text NOT NULL DEFAULT 'compositor'
        CHECK (origem IN ('compositor', 'gmail', 'automacao')),
      de_email text NOT NULL,
      para_email text NOT NULL,
      assunto text NOT NULL DEFAULT '',
      corpo_text text,
      snippet text,
      -- Vínculo com o funil (matching por e-mail do lead/responsável)
      form_submission_id uuid,
      -- Correlação com provedores
      provider text,                     -- resend | brevo | gmail
      resend_email_id text,              -- id do Resend (métricas via webhook)
      gmail_message_id text,             -- id do Gmail (idempotência do sync)
      gmail_thread_id text,              -- agrupa conversa
      -- Métricas (webhook Resend — cada evento grava o timestamp)
      entregue_at timestamptz,
      aberto_at timestamptz,
      clicado_at timestamptz,
      bounce_at timestamptz,
      reclamado_at timestamptz,
      falha_motivo text,
      enviado_por uuid,                  -- user_profiles.id (compositor)
      mensagem_em timestamptz NOT NULL DEFAULT now(),  -- data real da mensagem
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );

    CREATE UNIQUE INDEX emails_mensagens_gmail_msg_uidx
      ON public.emails_mensagens (gmail_message_id) WHERE gmail_message_id IS NOT NULL;
    CREATE UNIQUE INDEX emails_mensagens_resend_uidx
      ON public.emails_mensagens (resend_email_id) WHERE resend_email_id IS NOT NULL;
    CREATE INDEX emails_mensagens_thread_idx
      ON public.emails_mensagens (gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;
    CREATE INDEX emails_mensagens_fs_idx
      ON public.emails_mensagens (form_submission_id) WHERE form_submission_id IS NOT NULL;
    CREATE INDEX emails_mensagens_ordem_idx
      ON public.emails_mensagens (mensagem_em DESC);

    ALTER TABLE public.emails_mensagens ENABLE ROW LEVEL SECURITY;
    -- Leitura: nível CEO (cto resolve para ceo). Escrita: só service_role
    -- (CFs e admin client do Engine) — mesmo padrão de reunioes_transcricoes.
    CREATE POLICY emails_mensagens_select_ceo ON public.emails_mensagens
      FOR SELECT TO authenticated
      USING (public.get_user_papel() = 'ceo');
  END IF;
END $$;

-- Heartbeat do sync da caixa de entrada (lição configuracoes-patch-sem-upsert:
-- chave nasce SEEDADA, senão o PATCH da CF é no-op silencioso).
INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
VALUES ('email_inbox_state', '{}'::jsonb, 'Heartbeat do email-inbox-sync (última varredura do Gmail)')
ON CONFLICT (chave) DO NOTHING;
