ALTER TABLE public.ai_assessments
  ADD COLUMN feedback text CHECK (feedback IN ('up','down')),
  ADD COLUMN feedback_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN feedback_at timestamptz;

GRANT UPDATE (feedback, feedback_by, feedback_at) ON public.ai_assessments TO authenticated;

CREATE POLICY "auth update ai_assessments feedback"
  ON public.ai_assessments FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);