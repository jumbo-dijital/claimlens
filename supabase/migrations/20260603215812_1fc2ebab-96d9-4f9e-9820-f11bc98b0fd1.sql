
-- ============ Auth roles & profiles ============
CREATE TYPE public.app_role AS ENUM ('agent', 'adjuster', 'superadmin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_color text NOT NULL DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ Audit log: track real auth user ============
ALTER TABLE public.audit_log
  ADD COLUMN actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============ Lock down data tables: authenticated-only reads ============
DROP POLICY IF EXISTS "read claims" ON public.claims;
DROP POLICY IF EXISTS "read claim_images" ON public.claim_images;
DROP POLICY IF EXISTS "read ai_assessments" ON public.ai_assessments;
DROP POLICY IF EXISTS "read line_items" ON public.assessment_line_items;
DROP POLICY IF EXISTS "read reviews" ON public.reviews;
DROP POLICY IF EXISTS "read audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "read personas" ON public.personas;
DROP POLICY IF EXISTS "read repair_catalog" ON public.repair_catalog;

CREATE POLICY "auth read claims" ON public.claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read claim_images" ON public.claim_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read ai_assessments" ON public.ai_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read line_items" ON public.assessment_line_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read reviews" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read audit_log" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read personas" ON public.personas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read repair_catalog" ON public.repair_catalog FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.claims FROM anon;
REVOKE SELECT ON public.claim_images FROM anon;
REVOKE SELECT ON public.ai_assessments FROM anon;
REVOKE SELECT ON public.assessment_line_items FROM anon;
REVOKE SELECT ON public.reviews FROM anon;
REVOKE SELECT ON public.audit_log FROM anon;
REVOKE SELECT ON public.personas FROM anon;
REVOKE SELECT ON public.repair_catalog FROM anon;

GRANT SELECT ON public.claims TO authenticated;
GRANT SELECT ON public.claim_images TO authenticated;
GRANT SELECT ON public.ai_assessments TO authenticated;
GRANT SELECT ON public.assessment_line_items TO authenticated;
GRANT SELECT ON public.reviews TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT SELECT ON public.personas TO authenticated;
GRANT SELECT ON public.repair_catalog TO authenticated;

-- ============ Seed demo auth users ============
-- Demo password for all three: ClaimLens2026!
DO $$
DECLARE
  agent_id uuid := gen_random_uuid();
  adjuster_id uuid := gen_random_uuid();
  super_id uuid := gen_random_uuid();
  hashed text := crypt('ClaimLens2026!', gen_salt('bf'));
BEGIN
  -- Insert into auth.users
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) VALUES
    (agent_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'agent@claimlens.demo', hashed, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"display_name":"Avery Agent"}'::jsonb,
     now(), now(), '', '', '', ''),
    (adjuster_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'adjuster@claimlens.demo', hashed, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"display_name":"Dana Adjuster"}'::jsonb,
     now(), now(), '', '', '', ''),
    (super_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin@claimlens.demo', hashed, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"display_name":"Sam Superadmin"}'::jsonb,
     now(), now(), '', '', '', '');

  -- Identities (required for email login)
  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES
    (gen_random_uuid(), agent_id,
     jsonb_build_object('sub', agent_id::text, 'email', 'agent@claimlens.demo', 'email_verified', true),
     'email', agent_id::text, now(), now(), now()),
    (gen_random_uuid(), adjuster_id,
     jsonb_build_object('sub', adjuster_id::text, 'email', 'adjuster@claimlens.demo', 'email_verified', true),
     'email', adjuster_id::text, now(), now(), now()),
    (gen_random_uuid(), super_id,
     jsonb_build_object('sub', super_id::text, 'email', 'admin@claimlens.demo', 'email_verified', true),
     'email', super_id::text, now(), now(), now());

  -- Roles
  INSERT INTO public.user_roles (user_id, role) VALUES
    (agent_id, 'agent'),
    (adjuster_id, 'adjuster'),
    (super_id, 'superadmin');

  -- Customise profile colors (trigger already inserted base rows)
  UPDATE public.profiles SET avatar_color = '#3b82f6' WHERE id = agent_id;
  UPDATE public.profiles SET avatar_color = '#10b981' WHERE id = adjuster_id;
  UPDATE public.profiles SET avatar_color = '#f59e0b' WHERE id = super_id;
END $$;
