UPDATE public.claims SET status = 'new' WHERE status = 'ai_processing';
UPDATE public.claims SET status = 'in_review' WHERE status = 'changes_requested';
ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS claims_status_check;
ALTER TABLE public.claims ADD CONSTRAINT claims_status_check CHECK (status IN ('new','in_review','submitted','approved','rejected'));