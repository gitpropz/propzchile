
-- 1. Multiple RUTs per unit (contract)
ALTER TABLE public.rentable_units
  ADD COLUMN IF NOT EXISTS tenant_ruts text[] NOT NULL DEFAULT '{}';

-- 2. Bank statement unique identity + raw storage
ALTER TABLE public.bank_statement_imports
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS statement_downloaded_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS raw_transactions jsonb,
  ADD COLUMN IF NOT EXISTS applied boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS bank_statement_unique_key
  ON public.bank_statement_imports(organization_id, bank_name, account_number, period_year, period_month)
  WHERE bank_name IS NOT NULL AND account_number IS NOT NULL AND period_year IS NOT NULL AND period_month IS NOT NULL;

-- 3. Needs-review flag on rent_payments
ALTER TABLE public.rent_payments
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- 4. Prevent duplicate allocations per bank transaction
CREATE UNIQUE INDEX IF NOT EXISTS rent_allocations_one_per_tx
  ON public.rent_payment_allocations(bank_transaction_id)
  WHERE bank_transaction_id IS NOT NULL;
