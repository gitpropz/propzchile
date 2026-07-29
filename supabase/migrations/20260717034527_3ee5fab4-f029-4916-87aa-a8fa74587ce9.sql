
-- Add tenant_email to rentable_units
ALTER TABLE public.rentable_units ADD COLUMN IF NOT EXISTS tenant_email TEXT;

-- Create unit_bills table
CREATE TABLE IF NOT EXISTS public.unit_bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.rentable_units(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('gastos_comunes','agua','luz','gas','internet','otro')),
  period TEXT,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CLP',
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','pagado')),
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES auth.users(id),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','email')),
  provider TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_bills TO authenticated;
GRANT ALL ON public.unit_bills TO service_role;

ALTER TABLE public.unit_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read unit_bills"
ON public.unit_bills FOR SELECT TO authenticated
USING (public.is_org_member(organization_id));

CREATE POLICY "Org members insert unit_bills"
ON public.unit_bills FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Org members update unit_bills"
ON public.unit_bills FOR UPDATE TO authenticated
USING (public.is_org_member(organization_id))
WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "Org members delete unit_bills"
ON public.unit_bills FOR DELETE TO authenticated
USING (public.is_org_member(organization_id));

CREATE INDEX IF NOT EXISTS unit_bills_unit_idx ON public.unit_bills(unit_id);
CREATE INDEX IF NOT EXISTS unit_bills_org_idx ON public.unit_bills(organization_id);
CREATE INDEX IF NOT EXISTS unit_bills_due_idx ON public.unit_bills(due_date);

CREATE TRIGGER unit_bills_set_updated_at
BEFORE UPDATE ON public.unit_bills
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
