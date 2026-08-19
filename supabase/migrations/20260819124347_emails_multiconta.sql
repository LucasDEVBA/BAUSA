-- E-mail multi-conta (2026-08-19, pedido do CEO): enviar/ler como contato@ E
-- leandro.ribeiro@ (e futuras contas), com roteamento de alias em tela.
--
--   caixa_email  — a QUAL caixa do Engine a mensagem pertence (após regras
--                  de roteamento). Espelho antigo era só contato@ → backfill.
--   UNIQUE passa a ser (caixa_email, gmail_message_id): ids do Gmail são
--   únicos POR CAIXA — a mesma conversa pode existir nas duas contas.
--
-- Seeds (lição configuracoes-patch-sem-upsert — chave nasce seedada):
--   emails_contas     — contas sincronizadas + conta padrão de envio
--                       (editável na tela /emails)
--   emails_roteamento — regras alias→caixa aplicadas pelo sync
DO $$
BEGIN
  IF to_regclass('public.emails_mensagens') IS NOT NULL THEN
    ALTER TABLE public.emails_mensagens
      ADD COLUMN IF NOT EXISTS caixa_email text;

    UPDATE public.emails_mensagens
      SET caixa_email = 'contato@bolsaatletausa.com'
      WHERE caixa_email IS NULL;

    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'emails_mensagens_gmail_msg_uidx'
    ) THEN
      DROP INDEX public.emails_mensagens_gmail_msg_uidx;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'emails_mensagens_caixa_gmail_uidx'
    ) THEN
      CREATE UNIQUE INDEX emails_mensagens_caixa_gmail_uidx
        ON public.emails_mensagens (caixa_email, gmail_message_id)
        WHERE gmail_message_id IS NOT NULL;
    END IF;

    CREATE INDEX IF NOT EXISTS emails_mensagens_caixa_idx
      ON public.emails_mensagens (caixa_email, mensagem_em DESC);
  END IF;
END $$;

INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
VALUES
  ('emails_contas',
   '{"contas": ["contato@bolsaatletausa.com", "leandro.ribeiro@bolsaatletausa.com"], "padrao_envio": "contato@bolsaatletausa.com"}'::jsonb,
   'Contas de e-mail sincronizadas e conta padrão de envio (tela /emails)'),
  ('emails_roteamento',
   '{"regras": []}'::jsonb,
   'Roteamento de alias: e-mail recebido PARA o endereço x vai para a caixa y na tela /emails')
ON CONFLICT (chave) DO NOTHING;
