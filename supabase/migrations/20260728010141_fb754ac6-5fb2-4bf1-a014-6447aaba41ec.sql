ALTER TABLE public.rentable_units
  ADD COLUMN IF NOT EXISTS tenant_aliases text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS tenant_account_numbers text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS counterparty_account text,
  ADD COLUMN IF NOT EXISTS counterparty_bank text,
  ADD COLUMN IF NOT EXISTS operation_number text,
  ADD COLUMN IF NOT EXISTS movement_type text NOT NULL DEFAULT 'credit';