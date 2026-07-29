
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('superadmin','admin','owner','tenant','provider','referrer');
CREATE TYPE public.unit_type AS ENUM ('apartment','house','office','retail','parking','storage','other');
CREATE TYPE public.currency AS ENUM ('CLP','UF','USD');

-- Reusable updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES (1:1 auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ORGANIZATIONS (tenant)
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'CL',
  default_currency public.currency NOT NULL DEFAULT 'CLP',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ORGANIZATION MEMBERS
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- GLOBAL USER ROLES (for superadmin)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_global_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = auth.uid()
  ) OR public.has_global_role(auth.uid(), 'superadmin');
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = auth.uid() AND role = _role
  ) OR public.has_global_role(auth.uid(), 'superadmin');
$$;

-- Profiles policies
CREATE POLICY "profiles: self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles: self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles: self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Organizations policies
CREATE POLICY "orgs: members read" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "orgs: creator insert" ON public.organizations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "orgs: admin update" ON public.organizations FOR UPDATE TO authenticated USING (public.has_org_role(id, 'admin')) WITH CHECK (public.has_org_role(id, 'admin'));

-- Members policies
CREATE POLICY "members: read own org" ON public.organization_members FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "members: admin manage" ON public.organization_members FOR ALL TO authenticated USING (public.has_org_role(organization_id, 'admin')) WITH CHECK (public.has_org_role(organization_id, 'admin'));
CREATE POLICY "members: self insert on org create" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- user_roles policies (read-only for self; writes via service role)
CREATE POLICY "user_roles: self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- PROPERTIES
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  comuna TEXT,
  region TEXT,
  property_type public.unit_type NOT NULL DEFAULT 'apartment',
  notes TEXT,
  cover_photo_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_props_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_properties_org ON public.properties(organization_id);

CREATE POLICY "properties: org read" ON public.properties FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "properties: org insert" ON public.properties FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "properties: org update" ON public.properties FOR UPDATE TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY "properties: admin delete" ON public.properties FOR DELETE TO authenticated USING (public.has_org_role(organization_id, 'admin'));

-- PROPERTY OWNERS
CREATE TABLE public.property_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  rut TEXT,
  email TEXT,
  phone TEXT,
  ownership_pct NUMERIC(5,2) DEFAULT 100,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_owners TO authenticated;
GRANT ALL ON public.property_owners TO service_role;
ALTER TABLE public.property_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners: org access" ON public.property_owners FOR ALL TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));

-- RENTABLE UNITS
CREATE TABLE public.rentable_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  unit_type public.unit_type NOT NULL,
  identifier TEXT,
  bedrooms INT,
  bathrooms INT,
  surface_m2 NUMERIC(8,2),
  base_rent_amount NUMERIC(14,2),
  base_rent_currency public.currency DEFAULT 'CLP',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rentable_units TO authenticated;
GRANT ALL ON public.rentable_units TO service_role;
ALTER TABLE public.rentable_units ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_units_updated BEFORE UPDATE ON public.rentable_units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_units_property ON public.rentable_units(property_id);
CREATE POLICY "units: org access" ON public.rentable_units FOR ALL TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));

-- PROPERTY PHOTOS
CREATE TABLE public.property_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_photos TO authenticated;
GRANT ALL ON public.property_photos TO service_role;
ALTER TABLE public.property_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos: org access" ON public.property_photos FOR ALL TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));

-- PROPERTY DOCUMENTS
CREATE TABLE public.property_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  title TEXT NOT NULL,
  doc_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_documents TO authenticated;
GRANT ALL ON public.property_documents TO service_role;
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs: org access" ON public.property_documents FOR ALL TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));

-- NEW USER TRIGGER: create profile + default organization + admin membership
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_org_id UUID;
  display_name TEXT;
  org_name TEXT;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  org_name := COALESCE(NEW.raw_user_meta_data->>'organization_name', 'Mi Cartera');

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, display_name, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organizations (name, country, default_currency, created_by)
  VALUES (org_name, 'CL', 'CLP', NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'admin');

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
