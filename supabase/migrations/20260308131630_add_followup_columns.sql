-- Adiciona colunas de follow-up e detecção de reunião agendada
-- Parte do fluxo: 48h sem agendamento → follow-up 1; 72h → follow-up 2

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS followup_1_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_2_sent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meeting_scheduled    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS meeting_scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_form_submissions_followup_1
  ON form_submissions(followup_1_sent_at);

CREATE INDEX IF NOT EXISTS idx_form_submissions_followup_2
  ON form_submissions(followup_2_sent_at);

CREATE INDEX IF NOT EXISTS idx_form_submissions_meeting_scheduled
  ON form_submissions(meeting_scheduled);
