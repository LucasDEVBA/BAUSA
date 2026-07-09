-- ════════════════════════════════════════════════════════════════════════
-- Migration: bucket remarketing-media aceita ÁUDIO (mensagem de voz — espelho)
-- ════════════════════════════════════════════════════════════════════════
--
-- O espelho de WhatsApp passa a gravar e enviar áudio pelo chat. O áudio
-- gravado no navegador (MediaRecorder) sobe para o bucket público
-- remarketing-media (URL estável — a Z-API baixa por URL no /send-audio) e o
-- Storage valida o contentType contra allowed_mime_types → sem os tipos de
-- áudio, o upload seria rejeitado.
--
-- Aditivo: mantém image/* + application/pdf (mensagem direta) e acrescenta os
-- tipos de áudio comuns (webm/opus do Chrome, ogg do Firefox, mp3/mp4/aac/wav).
-- O contentType é normalizado no app (sem `;codecs=...`) antes do upload.
-- Buckets são globais (storage.buckets) — não multi-schema. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
  'application/pdf',
  'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac',
  'audio/wav', 'audio/x-m4a', 'audio/3gpp'
]
WHERE id = 'remarketing-media';

-- As policies de INSERT/DELETE (só CEO autenticado) já existem na migration
-- 20260605190000_remarketing_message_types_and_media.sql e continuam valendo.
