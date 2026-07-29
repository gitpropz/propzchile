import { supabase } from "@/integrations/supabase/client";
import { toISODate } from "@/lib/rent-status";
import type { Database } from "@/integrations/supabase/types";

type Unit = Database["public"]["Tables"]["rentable_units"]["Row"];

/**
 * Ensure a rent_payments row exists for the given unit/period and return its id.
 * Uses base_rent_amount for the initial `amount` (trigger keeps amount_paid in sync).
 */
export async function ensureRentPayment(params: {
  organizationId: string;
  unit: Pick<Unit, "id" | "property_id" | "base_rent_amount" | "base_rent_currency" | "payment_day">;
  year: number;
  month: number;
  dueDate: string;
}): Promise<string> {
  const { organizationId, unit, year, month, dueDate } = params;
  const { data: existing, error: selErr } = await supabase
    .from("rent_payments")
    .select("id")
    .eq("unit_id", unit.id)
    .eq("period_year", year)
    .eq("period_month", month)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing?.id) return existing.id;

  const total = Number(unit.base_rent_amount ?? 0);
  const { data: inserted, error: insErr } = await supabase
    .from("rent_payments")
    .insert({
      organization_id: organizationId,
      property_id: unit.property_id,
      unit_id: unit.id,
      period_year: year,
      period_month: month,
      due_date: dueDate,
      amount: total,
      currency: unit.base_rent_currency ?? "CLP",
      status: "pending",
    })
    .select("id")
    .single();
  if (insErr) throw insErr;
  return inserted.id;
}

/**
 * Insert a manual allocation against a payment. Trigger auto-updates status
 * and amount_paid on the parent payment.
 */
export async function addManualAllocation(params: {
  organizationId: string;
  rentPaymentId: string;
  amount: number;
  paidDate?: string;
  notes?: string;
  bankTransactionId?: string | null;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("rent_payment_allocations").insert({
    organization_id: params.organizationId,
    rent_payment_id: params.rentPaymentId,
    amount: params.amount,
    paid_date: params.paidDate ?? toISODate(new Date()),
    source: params.bankTransactionId ? "bank" : "manual",
    notes: params.notes ?? null,
    bank_transaction_id: params.bankTransactionId ?? null,
    created_by: userData.user?.id ?? null,
  });
  if (error) throw error;
}

/** Delete every allocation of a payment (used to fully revert a confirmation). */
export async function clearAllocations(rentPaymentId: string): Promise<void> {
  const { error } = await supabase
    .from("rent_payment_allocations")
    .delete()
    .eq("rent_payment_id", rentPaymentId);
  if (error) throw error;
}