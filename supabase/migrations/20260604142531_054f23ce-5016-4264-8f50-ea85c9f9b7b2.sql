DROP POLICY IF EXISTS "auth update ai_assessments feedback" ON public.ai_assessments;
REVOKE UPDATE (feedback, feedback_by, feedback_at) ON public.ai_assessments FROM authenticated;