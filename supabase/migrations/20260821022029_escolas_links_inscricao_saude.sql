-- ════════════════════════════════════════════════════════════════════════
-- Migration: escolas ganham links estruturados (inscrição + plano de saúde)
-- Aplica em: public (escolas só existe em public; o Engine lê public em
--            todos os ambientes — mesmo padrão da 20260820142333)
--
-- Contexto: pedido do CEO — o link de inscrição precisa virar BOTÃO na tela
-- /escolas. Hoje os links vivem como texto em notas_internas (import do
-- Trello). Duas colunas novas + backfill a partir dos dados do Trello,
-- casando por nome e SEM sobrescrever valor já preenchido pela UI.
-- O checklist de onboarding (etapas "Application — inscrição na escola" e
-- "Plano de saúde") referencia exatamente estes links.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.escolas ADD COLUMN IF NOT EXISTS link_inscricao TEXT;
ALTER TABLE public.escolas ADD COLUMN IF NOT EXISTS link_plano_saude TEXT;

COMMENT ON COLUMN public.escolas.link_inscricao IS
  'URL do portal/formulário de application da escola. Renderizado como botão em /escolas.';
COMMENT ON COLUMN public.escolas.link_plano_saude IS
  'URL de contratação do plano de saúde exigido/aceito pela escola. Renderizado como botão em /escolas.';

-- ─── Backfill (fonte: Trello da Head de Sucesso, 2026-08-20) ─────────────
-- Idempotente e não-destrutivo: só preenche onde ainda está NULL.
UPDATE public.escolas e
SET link_inscricao = v.link_inscricao
FROM (VALUES
  ('img academy',                    'https://imgacademy.myschoolapp.com/app?svcid=edu#login/apply'),
  ('dme academy',                    'https://admissions-parent.renweb.com/en-us/home?districtCode=XDA-FL'),
  ('montverde academy',              'https://www.montverde.org/admission/application-process'),
  ('spire academy',                  'https://portals.veracross.com/spire/form/spire-inquiry-form/2025-26%20Student%20Inquiry/account-lookup'),
  ('putnam science academy',         'https://putnamscienceacademy.fsenrollment.com/users/sign_up'),
  ('hoosac school',                  'https://hoosac.openapply.com'),
  ('baylor school',                  'https://baylorschool.fsenrollment.com/users/sign_in'),
  ('westtown school',                'https://www.admission.org/services/standard-application-online-sao'),
  ('winston salem christian school', 'https://admissions-parent.renweb.com/en-us/home?districtCode=WS-NC'),
  ('benfica academy',                'https://www.benficaresidentialacademy.com/bishop-application'),
  ('combine academy',                'https://www.jotform.com/form/83105120500941'),
  ('gateway academy',                'https://docs.google.com/forms/d/e/1FAIpQLSf_qpDZD32Ukeaov0RwiUTErj15UBjTGt27Mm6ivF5P_sC-Iw/viewform'),
  ('rps academies',                  'https://enrollment.powerschool.com/family/ActionForms/Index/1')
) AS v(nome_lower, link_inscricao)
WHERE lower(e.nome) = v.nome_lower
  AND e.deleted_at IS NULL
  AND e.link_inscricao IS NULL;

UPDATE public.escolas e
SET link_plano_saude = v.link_plano_saude
FROM (VALUES
  ('putnam science academy',         'https://cghb-ogse.com/index.php'),
  ('winston salem christian school', 'https://www.envisageglobalinsurance.com/self-enrollment/register/1205/'),
  ('gateway academy',                'https://www.isoa.org')
) AS v(nome_lower, link_plano_saude)
WHERE lower(e.nome) = v.nome_lower
  AND e.deleted_at IS NULL
  AND e.link_plano_saude IS NULL;
