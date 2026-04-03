-- Create form_submissions table for reliable form data storage
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Submission metadata
  submission_id TEXT UNIQUE, -- Client-generated ID to prevent duplicates
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,

  -- Section 1: Registration
  email TEXT NOT NULL,

  -- Section 2: Athletic Information
  athlete_name TEXT NOT NULL,
  birth_date TEXT,
  gender TEXT,
  city_state TEXT,
  position TEXT,
  club_history TEXT,
  achievements TEXT,
  video_link TEXT,
  instagram TEXT,

  -- Section 3: Academic Information
  is_high_school TEXT,
  school_year TEXT,
  current_school TEXT,
  english_level TEXT,
  english_exam TEXT,
  exam_result TEXT,

  -- Section 4: Family & Financial Information
  guardian_name TEXT,
  guardian_email TEXT,
  guardian_whatsapp TEXT,
  guardian_profession TEXT,
  family_address TEXT,
  investment_range TEXT,

  -- Section 5: Motivations
  school_priorities TEXT[], -- Array of selected priorities
  how_did_you_find TEXT,
  how_did_you_find_other TEXT,
  why_international TEXT,

  -- Status & qualification tracking
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  qualified BOOLEAN,
  qualification_classification TEXT,
  qualification_reason TEXT,
  qualification_confidence TEXT,
  qualified_at TIMESTAMP WITH TIME ZONE,
  whatsapp_sent_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(email, athlete_name)
);

-- Enable Row Level Security (idempotent)
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Policies (drop before create to avoid conflicts)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can submit form" ON public.form_submissions;
  DROP POLICY IF EXISTS "Service role can read submissions" ON public.form_submissions;
  DROP POLICY IF EXISTS "Service role full access" ON public.form_submissions;
  DROP POLICY IF EXISTS "Anon can insert" ON public.form_submissions;
END $$;

CREATE POLICY "Service role full access" ON public.form_submissions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can insert" ON public.form_submissions
  FOR INSERT TO anon
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_form_submissions_email ON public.form_submissions(email);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON public.form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON public.form_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submission_id ON public.form_submissions(submission_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_classification ON public.form_submissions(qualification_classification);
CREATE INDEX IF NOT EXISTS idx_form_submissions_qualified_at ON public.form_submissions(qualified_at);
CREATE INDEX IF NOT EXISTS idx_form_submissions_whatsapp_sent_at ON public.form_submissions(whatsapp_sent_at);

-- Auto-update timestamp function
CREATE OR REPLACE FUNCTION public.update_form_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger (drop before create to avoid conflicts)
DROP TRIGGER IF EXISTS update_form_submissions_updated_at ON public.form_submissions;
CREATE TRIGGER update_form_submissions_updated_at
BEFORE UPDATE ON public.form_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_form_submissions_updated_at();
