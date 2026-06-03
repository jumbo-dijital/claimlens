
-- Personas
CREATE TABLE public.personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('agent','adjuster','superadmin')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personas TO anon, authenticated;
GRANT ALL ON public.personas TO service_role;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "personas open" ON public.personas FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.personas (role, name, email, avatar_color) VALUES
  ('agent','Sarah Chen','sarah.chen@claimlens.demo','#3b82f6'),
  ('adjuster','Tom Mitchell','tom.mitchell@claimlens.demo','#10b981'),
  ('superadmin','Admin','admin@claimlens.demo','#a855f7');

-- Repair catalog
CREATE TABLE public.repair_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_name TEXT NOT NULL,
  vehicle_class TEXT NOT NULL DEFAULT 'standard',
  base_part_cost NUMERIC(10,2) NOT NULL,
  base_labour_hours NUMERIC(5,2) NOT NULL,
  labour_rate NUMERIC(10,2) NOT NULL DEFAULT 95.00,
  notes TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_catalog TO anon, authenticated;
GRANT ALL ON public.repair_catalog TO service_role;
ALTER TABLE public.repair_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog open" ON public.repair_catalog FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.repair_catalog (part_name, vehicle_class, base_part_cost, base_labour_hours, notes) VALUES
  ('Front bumper cover','standard',420.00,3.5,'Paint and refit included'),
  ('Rear bumper cover','standard',390.00,3.0,NULL),
  ('Front bumper cover','premium',880.00,4.0,'OEM part'),
  ('Headlight assembly (L)','standard',310.00,1.5,NULL),
  ('Headlight assembly (R)','standard',310.00,1.5,NULL),
  ('Tail light assembly','standard',180.00,1.0,NULL),
  ('Front door panel','standard',640.00,5.0,'Paint match required'),
  ('Rear door panel','standard',620.00,5.0,NULL),
  ('Front fender (L)','standard',280.00,3.0,NULL),
  ('Front fender (R)','standard',280.00,3.0,NULL),
  ('Hood','standard',520.00,4.5,NULL),
  ('Trunk lid','standard',490.00,4.0,NULL),
  ('Side mirror assembly','standard',150.00,0.8,NULL),
  ('Windshield','standard',380.00,2.0,'Includes calibration'),
  ('Wheel (alloy 17")','standard',340.00,0.5,NULL),
  ('Paint correction (panel)','standard',0.00,2.5,'Labour only - scratch buff'),
  ('Dent repair (PDR small)','standard',0.00,1.0,'Paintless dent repair'),
  ('Dent repair (PDR medium)','standard',0.00,2.5,NULL),
  ('Structural frame inspection','standard',0.00,3.0,'Diagnostic'),
  ('Quarter panel','standard',720.00,6.0,'Bodywork required');

-- Claims
CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number TEXT NOT NULL UNIQUE,
  policyholder_name TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  vehicle_make TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_year INT NOT NULL,
  vehicle_plate TEXT,
  vehicle_class TEXT NOT NULL DEFAULT 'standard',
  incident_date DATE NOT NULL,
  incident_description TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','ai_processing','in_review','submitted','approved','rejected','changes_requested')),
  current_agent_id UUID REFERENCES public.personas(id),
  current_reviewer_id UUID REFERENCES public.personas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO anon, authenticated;
GRANT ALL ON public.claims TO service_role;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claims open" ON public.claims FOR ALL USING (true) WITH CHECK (true);

-- Claim images
CREATE TABLE public.claim_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  angle TEXT NOT NULL DEFAULT 'unspecified',
  quality_flag TEXT,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_images TO anon, authenticated;
GRANT ALL ON public.claim_images TO service_role;
ALTER TABLE public.claim_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claim_images open" ON public.claim_images FOR ALL USING (true) WITH CHECK (true);

-- AI assessments
CREATE TABLE public.ai_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  summary TEXT,
  overall_confidence NUMERIC(4,3),
  raw_json JSONB,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_assessments TO anon, authenticated;
GRANT ALL ON public.ai_assessments TO service_role;
ALTER TABLE public.ai_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_assessments open" ON public.ai_assessments FOR ALL USING (true) WITH CHECK (true);

-- Line items
CREATE TABLE public.assessment_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.ai_assessments(id) ON DELETE CASCADE,
  damage_type TEXT NOT NULL,
  location TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'minor',
  suggested_repair TEXT NOT NULL,
  part_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  labour_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
  labour_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  confidence NUMERIC(4,3),
  source TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai','agent')),
  edited_by UUID REFERENCES public.personas(id),
  rationale TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  evidence_image_id UUID REFERENCES public.claim_images(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_line_items TO anon, authenticated;
GRANT ALL ON public.assessment_line_items TO service_role;
ALTER TABLE public.assessment_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "line_items open" ON public.assessment_line_items FOR ALL USING (true) WITH CHECK (true);

-- Reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.personas(id),
  decision TEXT NOT NULL CHECK (decision IN ('approve','reject','changes')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO anon, authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews open" ON public.reviews FOR ALL USING (true) WITH CHECK (true);

-- Audit log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
  actor_persona_id UUID REFERENCES public.personas(id),
  actor_role TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_log TO anon, authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log open" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER touch_claims_updated_at BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_claims_status ON public.claims(status);
CREATE INDEX idx_claim_images_claim ON public.claim_images(claim_id);
CREATE INDEX idx_line_items_assessment ON public.assessment_line_items(assessment_id);
CREATE INDEX idx_audit_claim ON public.audit_log(claim_id, created_at DESC);
