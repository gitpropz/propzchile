
-- 1) RUT del arrendatario
ALTER TABLE public.rentable_units ADD COLUMN IF NOT EXISTS tenant_rut TEXT;

-- 2) rent_payments: monto pagado y nuevo estado 'partial'
ALTER TABLE public.rent_payments ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.rent_payments DROP CONSTRAINT IF EXISTS rent_payments_status_check;
ALTER TABLE public.rent_payments ADD CONSTRAINT rent_payments_status_check
  CHECK (status IN ('pending','partial','confirmed'));

-- 3) bank_statement_imports
CREATE TABLE IF NOT EXISTS public.bank_statement_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id),
  file_name TEXT,
  bank_name TEXT,
  period_year INTEGER,
  period_month INTEGER,
  transactions_count INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_statement_imports TO authenticated;
GRANT ALL ON public.bank_statement_imports TO service_role;
ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_imports: org access" ON public.bank_statement_imports
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));
CREATE TRIGGER bank_statement_imports_set_updated_at BEFORE UPDATE ON public.bank_statement_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) bank_transactions
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  import_id UUID REFERENCES public.bank_statement_imports(id) ON DELETE SET NULL,
  tx_date DATE NOT NULL,
  description TEXT,
  counterparty_name TEXT,
  counterparty_rut TEXT,
  amount NUMERIC(14,2) NOT NULL,
  currency public.currency NOT NULL DEFAULT 'CLP',
  matched_unit_id UUID REFERENCES public.rentable_units(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched','suggested','matched','ignored')),
  match_confidence TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bank_tx_org_idx ON public.bank_transactions(organization_id, tx_date);
CREATE INDEX IF NOT EXISTS bank_tx_rut_idx ON public.bank_transactions(organization_id, counterparty_rut);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_tx: org access" ON public.bank_transactions
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));
CREATE TRIGGER bank_transactions_set_updated_at BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) rent_payment_allocations: vincula tx bancarias (o abonos manuales) con un rent_payment
CREATE TABLE IF NOT EXISTS public.rent_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rent_payment_id UUID NOT NULL REFERENCES public.rent_payments(id) ON DELETE CASCADE,
  bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  paid_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','bank_import')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rent_alloc_payment_idx ON public.rent_payment_allocations(rent_payment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rent_payment_allocations TO authenticated;
GRANT ALL ON public.rent_payment_allocations TO service_role;
ALTER TABLE public.rent_payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rent_alloc: org access" ON public.rent_payment_allocations
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));
CREATE TRIGGER rent_payment_allocations_set_updated_at BEFORE UPDATE ON public.rent_payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Trigger para recomputar amount_paid + status en rent_payments cuando cambian allocations
CREATE OR REPLACE FUNCTION public.recompute_rent_payment_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id UUID;
  total NUMERIC(14,2);
  due NUMERIC(14,2);
  last_paid DATE;
BEGIN
  target_id := COALESCE(NEW.rent_payment_id, OLD.rent_payment_id);
  SELECT COALESCE(SUM(amount),0), MAX(paid_date) INTO total, last_paid
    FROM public.rent_payment_allocations WHERE rent_payment_id = target_id;
  SELECT amount INTO due FROM public.rent_payments WHERE id = target_id;
  UPDATE public.rent_payments
    SET amount_paid = total,
        paid_date = last_paid,
        status = CASE
          WHEN total <= 0 THEN 'pending'
          WHEN total >= due THEN 'confirmed'
          ELSE 'partial'
        END,
        confirmed_at = CASE WHEN total >= due THEN COALESCE(confirmed_at, now()) ELSE NULL END
    WHERE id = target_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS trg_rent_alloc_recompute ON public.rent_payment_allocations;
CREATE TRIGGER trg_rent_alloc_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.rent_payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.recompute_rent_payment_totals();
