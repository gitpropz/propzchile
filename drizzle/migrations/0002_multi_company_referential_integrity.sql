-- Add organization-aware keys without replacing existing foreign keys or changing any rows.
ALTER TABLE public.properties ADD CONSTRAINT properties_id_organization_key UNIQUE (id, organization_id);
ALTER TABLE public.rentable_units ADD CONSTRAINT rentable_units_id_organization_key UNIQUE (id, organization_id);
ALTER TABLE public.bank_statement_imports ADD CONSTRAINT bank_statement_imports_id_organization_key UNIQUE (id, organization_id);
ALTER TABLE public.bank_transactions ADD CONSTRAINT bank_transactions_id_organization_key UNIQUE (id, organization_id);
ALTER TABLE public.rent_payments ADD CONSTRAINT rent_payments_id_organization_key UNIQUE (id, organization_id);
ALTER TABLE public.monitored_services ADD CONSTRAINT monitored_services_id_organization_key UNIQUE (id, organization_id);
ALTER TABLE public.rentable_units ADD CONSTRAINT rentable_units_property_id_organization_fkey
  FOREIGN KEY (property_id, organization_id) REFERENCES public.properties (id, organization_id)
  ON DELETE CASCADE NOT VALID;
ALTER TABLE public.rent_payments ADD CONSTRAINT rent_payments_property_id_organization_fkey
  FOREIGN KEY (property_id, organization_id) REFERENCES public.properties (id, organization_id)
  ON DELETE CASCADE NOT VALID;
ALTER TABLE public.rent_payments ADD CONSTRAINT rent_payments_unit_id_organization_fkey
  FOREIGN KEY (unit_id, organization_id) REFERENCES public.rentable_units (id, organization_id)
  ON DELETE CASCADE NOT VALID;
ALTER TABLE public.bank_transactions ADD CONSTRAINT bank_transactions_import_id_organization_fkey
  FOREIGN KEY (import_id, organization_id) REFERENCES public.bank_statement_imports (id, organization_id)
  ON DELETE SET NULL (import_id) NOT VALID;
ALTER TABLE public.bank_transactions ADD CONSTRAINT bank_transactions_matched_unit_id_organization_fkey
  FOREIGN KEY (matched_unit_id, organization_id) REFERENCES public.rentable_units (id, organization_id)
  ON DELETE SET NULL (matched_unit_id) NOT VALID;
ALTER TABLE public.rent_payment_allocations ADD CONSTRAINT rent_payment_allocations_rent_payment_id_organization_fkey
  FOREIGN KEY (rent_payment_id, organization_id) REFERENCES public.rent_payments (id, organization_id)
  ON DELETE CASCADE NOT VALID;
ALTER TABLE public.rent_payment_allocations ADD CONSTRAINT rent_payment_allocations_bank_transaction_id_organization_fkey
  FOREIGN KEY (bank_transaction_id, organization_id) REFERENCES public.bank_transactions (id, organization_id)
  ON DELETE SET NULL (bank_transaction_id) NOT VALID;
ALTER TABLE public.monitored_services ADD CONSTRAINT monitored_services_property_id_organization_fkey
  FOREIGN KEY (property_id, organization_id) REFERENCES public.properties (id, organization_id)
  ON DELETE CASCADE NOT VALID;
ALTER TABLE public.monitored_services ADD CONSTRAINT monitored_services_unit_id_organization_fkey
  FOREIGN KEY (unit_id, organization_id) REFERENCES public.rentable_units (id, organization_id)
  ON DELETE CASCADE NOT VALID;
ALTER TABLE public.service_readings ADD CONSTRAINT service_readings_service_id_organization_fkey
  FOREIGN KEY (service_id, organization_id) REFERENCES public.monitored_services (id, organization_id)
  ON DELETE CASCADE NOT VALID;
ALTER TABLE public.service_readings ADD CONSTRAINT service_readings_property_id_organization_fkey
  FOREIGN KEY (property_id, organization_id) REFERENCES public.properties (id, organization_id)
  ON DELETE CASCADE NOT VALID;
ALTER TABLE public.rentable_units VALIDATE CONSTRAINT rentable_units_property_id_organization_fkey;
ALTER TABLE public.rent_payments VALIDATE CONSTRAINT rent_payments_property_id_organization_fkey;
ALTER TABLE public.rent_payments VALIDATE CONSTRAINT rent_payments_unit_id_organization_fkey;
ALTER TABLE public.bank_transactions VALIDATE CONSTRAINT bank_transactions_import_id_organization_fkey;
ALTER TABLE public.bank_transactions VALIDATE CONSTRAINT bank_transactions_matched_unit_id_organization_fkey;
ALTER TABLE public.rent_payment_allocations VALIDATE CONSTRAINT rent_payment_allocations_rent_payment_id_organization_fkey;
ALTER TABLE public.rent_payment_allocations VALIDATE CONSTRAINT rent_payment_allocations_bank_transaction_id_organization_fkey;
ALTER TABLE public.monitored_services VALIDATE CONSTRAINT monitored_services_property_id_organization_fkey;
ALTER TABLE public.monitored_services VALIDATE CONSTRAINT monitored_services_unit_id_organization_fkey;
ALTER TABLE public.service_readings VALIDATE CONSTRAINT service_readings_service_id_organization_fkey;
ALTER TABLE public.service_readings VALIDATE CONSTRAINT service_readings_property_id_organization_fkey;

-- Recompute both sides of allocation moves and serialize by payment id.
CREATE OR REPLACE FUNCTION public.recompute_rent_payment_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_target uuid;
  new_target uuid;
  old_org uuid;
  new_org uuid;
  target_id uuid;
  target_org uuid;
  total numeric(14,2);
  due numeric(14,2);
  last_paid date;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    old_target := OLD.rent_payment_id;
    old_org := OLD.organization_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    new_target := NEW.rent_payment_id;
    new_org := NEW.organization_id;
  END IF;

  FOR target_id IN
    SELECT DISTINCT payment_id
    FROM unnest(ARRAY[old_target, new_target]) AS targets(payment_id)
    WHERE payment_id IS NOT NULL
    ORDER BY payment_id
  LOOP
    SELECT organization_id, amount INTO target_org, due
    FROM public.rent_payments WHERE id = target_id FOR UPDATE;

    IF NOT FOUND THEN
      -- Deleting a parent payment cascades its allocations after the parent disappears.
      IF TG_OP = 'DELETE' THEN CONTINUE; END IF;
      RAISE EXCEPTION 'Allocation payment does not exist' USING ERRCODE = '23503';
    END IF;

    IF (target_id = old_target AND target_org IS DISTINCT FROM old_org)
       OR (target_id = new_target AND target_org IS DISTINCT FROM new_org) THEN
      RAISE EXCEPTION 'Allocation and payment organizations must match' USING ERRCODE = '23503';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.rent_payment_allocations
      WHERE rent_payment_id = target_id AND organization_id IS DISTINCT FROM target_org
    ) THEN
      RAISE EXCEPTION 'Payment contains an allocation from another organization' USING ERRCODE = '23503';
    END IF;

    SELECT COALESCE(SUM(amount), 0), MAX(paid_date) INTO total, last_paid
    FROM public.rent_payment_allocations
    WHERE rent_payment_id = target_id AND organization_id = target_org;

    UPDATE public.rent_payments
    SET amount_paid = total,
        paid_date = last_paid,
        status = CASE WHEN total <= 0 THEN 'pending'
                      WHEN total >= due THEN 'confirmed' ELSE 'partial' END,
        confirmed_at = CASE WHEN total >= due THEN COALESCE(confirmed_at, now()) ELSE NULL END
    WHERE id = target_id AND organization_id = target_org;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
