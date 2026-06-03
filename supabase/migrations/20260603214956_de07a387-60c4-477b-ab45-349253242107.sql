
-- Drop all existing permissive policies and replace with read-only-for-anon, full-access-for-service-role
DROP POLICY IF EXISTS "ai_assessments open" ON public.ai_assessments;
DROP POLICY IF EXISTS "line_items open" ON public.assessment_line_items;
DROP POLICY IF EXISTS "audit_log open" ON public.audit_log;
DROP POLICY IF EXISTS "claim_images open" ON public.claim_images;
DROP POLICY IF EXISTS "claims open" ON public.claims;
DROP POLICY IF EXISTS "personas open" ON public.personas;
DROP POLICY IF EXISTS "catalog open" ON public.repair_catalog;
DROP POLICY IF EXISTS "reviews open" ON public.reviews;

-- Read-only policies for anon + authenticated; all writes go through server functions using the service role (which bypasses RLS).
CREATE POLICY "read claims" ON public.claims FOR SELECT USING (true);
CREATE POLICY "read claim_images" ON public.claim_images FOR SELECT USING (true);
CREATE POLICY "read ai_assessments" ON public.ai_assessments FOR SELECT USING (true);
CREATE POLICY "read line_items" ON public.assessment_line_items FOR SELECT USING (true);
CREATE POLICY "read audit_log" ON public.audit_log FOR SELECT USING (true);
CREATE POLICY "read personas" ON public.personas FOR SELECT USING (true);
CREATE POLICY "read reviews" ON public.reviews FOR SELECT USING (true);
-- repair_catalog: no public read needed (only server uses it), but allow read for transparency
CREATE POLICY "read repair_catalog" ON public.repair_catalog FOR SELECT USING (true);

-- Revoke write privileges from anon/authenticated; service_role retains ALL.
REVOKE INSERT, UPDATE, DELETE ON public.claims FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.claim_images FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ai_assessments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.assessment_line_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.personas FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.reviews FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.repair_catalog FROM anon, authenticated;

GRANT SELECT ON public.claims, public.claim_images, public.ai_assessments, public.assessment_line_items, public.audit_log, public.personas, public.reviews, public.repair_catalog TO anon, authenticated;
GRANT ALL ON public.claims, public.claim_images, public.ai_assessments, public.assessment_line_items, public.audit_log, public.personas, public.reviews, public.repair_catalog TO service_role;
