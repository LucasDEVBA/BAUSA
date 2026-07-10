-- ════════════════════════════════════════════════════════════════════════
-- Migration: bucket remarketing-media aceita PDF (mensagem direta — I4)
-- Contexto: o compositor de mensagem direta do detalhe do lead/deal
-- (/pipeline e /leads) permite anexar DOCUMENTO (PDF) que entra na mensagem
-- como link (WhatsApp: card clicável · e-mail: botão). O upload usa o mesmo
-- bucket público remarketing-media (URL estável — a mensagem referencia o
-- arquivo por tempo indeterminado), path mensagens/. O bucket hoje só
-- permite imagens em allowed_mime_types → PDF seria rejeitado pelo Storage.
--
-- Aditiva e idempotente. Storage é GLOBAL (não tem schema — vale para
-- public/uat/dev). Não afeta os fluxos existentes: imagens continuam
-- permitidas e as actions de imagem (remarketing/automações) seguem
-- validando image/* no application-level; o gate de PDF fica na nova
-- action uploadMensagemArquivo (CEO-only, 10MB).
-- ════════════════════════════════════════════════════════════════════════

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
  'application/pdf'
]
WHERE id = 'remarketing-media';

-- As policies de INSERT/DELETE (só CEO autenticado) já existem na migration
-- 20260605190000_remarketing_message_types_and_media.sql e continuam valendo
-- para o novo path mensagens/ — nenhuma policy nova é necessária.
