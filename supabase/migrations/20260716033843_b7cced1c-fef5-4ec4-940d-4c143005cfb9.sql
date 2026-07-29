
-- Extend rentable_units with rental agreement fields
ALTER TABLE public.rentable_units
  ADD COLUMN IF NOT EXISTS payment_day integer,
  ADD COLUMN IF NOT EXISTS tenant_name text,
  ADD COLUMN IF NOT EXISTS tenant_contact text,
  ADD COLUMN IF NOT EXISTS rent_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rent_start_date date;

ALTER TABLE public.rentable_units
  DROP CONSTRAINT IF EXISTS rentable_units_payment_day_check;
ALTER TABLE public.rentable_units
  ADD CONSTRAINT rentable_units_payment_day_check
  CHECK (payment_day IS NULL OR (payment_day BETWEEN 1 AND 28));

-- Rent payments (per unit, per month)
CREATE TABLE IF NOT EXISTS public.rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.rentable_units(id) ON DELETE CASCADE,
  period_year integer NOT NULL,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  due_date date NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency public.currency NOT NULL DEFAULT 'CLP',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed')),
  paid_date date,
  confirmed_at timestamptz,
  confirmed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS rent_payments_org_period_idx
  ON public.rent_payments (organization_id, period_year, period_month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rent_payments TO authenticated;
GRANT ALL ON public.rent_payments TO service_role;

ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read rent_payments"
  ON public.rent_payments FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "org members insert rent_payments"
  ON public.rent_payments FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "org members update rent_payments"
  ON public.rent_payments FOR UPDATE
  TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "org members delete rent_payments"
  ON public.rent_payments FOR DELETE
  TO authenticated
  USING (public.is_org_member(organization_id));

CREATE TRIGGER rent_payments_set_updated_at
  BEFORE UPDATE ON public.rent_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
