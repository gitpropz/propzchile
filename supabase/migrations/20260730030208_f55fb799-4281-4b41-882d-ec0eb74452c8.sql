ALTER TABLE public.monitored_services ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE;

UPDATE public.monitored_services ms
SET property_id = u.property_id
FROM public.rentable_units u
WHERE ms.unit_id = u.id AND ms.property_id IS NULL;

ALTER TABLE public.monitored_services ALTER COLUMN unit_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS monitored_services_property_idx ON public.monitored_services(property_id);

CREATE TABLE IF NOT EXISTS public.service_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'upload',
  period text,
  documents_count integer NOT NULL DEFAULT 0,
  detected_count integer NOT NULL DEFAULT 0,
  matched_count integer NOT NULL DEFAULT 0,
  raw jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_import_batches TO authenticated;
GRANT ALL ON public.service_import_batches TO service_role;
ALTER TABLE public.service_import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_import_batches: org access" ON public.service_import_batches
  FOR ALL TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE TRIGGER service_import_batches_updated_at BEFORE UPDATE ON public.service_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.service_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.monitored_services(id) ON DELETE CASCADE,
  period text NOT NULL,
  amount_due numeric(14,2) NOT NULL,
  expected_amount numeric(14,2),
  months_due numeric(10,2),
  source text NOT NULL DEFAULT 'manual',
  document_ref text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  batch_id uuid REFERENCES public.service_import_batches(id) ON DELETE SET NULL,
  raw jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_readings TO authenticated;
GRANT ALL ON public.service_readings TO service_role;
ALTER TABLE public.service_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_readings: org access" ON public.service_readings
  FOR ALL TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE INDEX IF NOT EXISTS service_readings_period_idx ON public.service_readings(organization_id, period);
CREATE TRIGGER service_readings_updated_at BEFORE UPDATE ON public.service_readings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();