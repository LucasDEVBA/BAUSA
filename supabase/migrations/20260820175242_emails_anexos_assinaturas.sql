-- Compositor completo (2026-08-20): anexos + assinaturas por conta.
--   emails_mensagens.anexos — [{nome, bytes}] dos anexos enviados (o arquivo
--   em si vai pelo Resend; aqui fica o registro para a thread/histórico).
--   emails_assinaturas — assinatura de texto POR CONTA, inserida no corpo ao
--   abrir o compositor (visível/editável antes do envio — nada oculto).
-- Lição configuracoes-patch-sem-upsert: chave nasce seedada.
DO $$
BEGIN
  IF to_regclass('public.emails_mensagens') IS NOT NULL THEN
    ALTER TABLE public.emails_mensagens
      ADD COLUMN IF NOT EXISTS anexos jsonb;
  END IF;
END $$;

INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
VALUES ('emails_assinaturas', '{}'::jsonb,
        'Assinatura de e-mail por conta (tela /emails → Assinaturas); texto inserido no corpo ao compor')
ON CONFLICT (chave) DO NOTHING;
