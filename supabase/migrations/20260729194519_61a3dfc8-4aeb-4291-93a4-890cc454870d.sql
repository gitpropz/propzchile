CREATE TABLE public.monitored_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  unit_id uuid NOT NULL REFERENCES public.rentable_units(id) ON DELETE CASCADE,
  service_type text NOT NULL DEFAULT 'agua',
  service_identifier text,
  provider text,
  expected_amount numeric(14,2),
  currency text NOT NULL DEFAULT 'CLP',
  alert_threshold_pct numeric(6,2) NOT NULL DEFAULT 150,
  active boolean NOT NULL DEFAULT true,
  last_detected_amount numeric(14,2),
  last_detected_period text,
  last_detected_at timestamp with time zone,
  last_alert_at timestamp with time zone,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitored_services TO authenticated;
GRANT ALL ON public.monitored_services TO service_role;

ALTER TABLE public.monitored_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monitored_services: org access" ON public.monitored_services
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE INDEX monitored_services_unit_idx ON public.monitored_services(unit_id);
CREATE INDEX monitored_services_org_idx ON public.monitored_services(organization_id);
CREATE UNIQUE INDEX monitored_services_identifier_uq
  ON public.monitored_services(organization_id, service_type, service_identifier)
  WHERE service_identifier IS NOT NULL;

CREATE TRIGGER monitored_services_set_updated_at
  BEFORE UPDATE ON public.monitored_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();