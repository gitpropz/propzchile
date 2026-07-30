import { supabase } from "@/integrations/supabase/client";
import { monthsDue, type MonitoredService, type ReadingSource } from "@/lib/monitored-services";

/**
 * Registra (o actualiza) el monto adeudado de un servicio en un período.
 * Es el único punto de escritura de lecturas: lo usa tanto el ingreso manual
 * como la carga automática de documentos (y en el futuro Gmail/Outlook/OCR).
 */
export async function saveReading(params: {
  organizationId: string;
  propertyId: string;
  service: MonitoredService;
  period: string;
  amountDue: number;
  source: ReadingSource | string;
  documentRef?: string | null;
  batchId?: string | null;
  raw?: unknown;
  notes?: string | null;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const expected = params.service.expected_amount == null ? null : Number(params.service.expected_amount);
  const months = monthsDue(params.amountDue, expected);

  const { error } = await supabase.from("service_readings").upsert(
    {
      organization_id: params.organizationId,
      property_id: params.propertyId,
      service_id: params.service.id,
      period: params.period,
      amount_due: params.amountDue,
      expected_amount: expected,
      months_due: months,
      source: params.source,
      document_ref: params.documentRef ?? null,
      batch_id: params.batchId ?? null,
      raw: (params.raw ?? null) as never,
      notes: params.notes ?? null,
      created_by: userData.user?.id ?? null,
      detected_at: new Date().toISOString(),
    },
    { onConflict: "service_id,period" },
  );
  if (error) throw error;

  // Espejo liviano en la configuración, para vistas rápidas.
  await supabase
    .from("monitored_services")
    .update({
      last_detected_amount: params.amountDue,
      last_detected_period: params.period,
      last_detected_at: new Date().toISOString(),
    })
    .eq("id", params.service.id);
}

export async function saveManualReading(params: {
  organizationId: string;
  propertyId: string;
  service: MonitoredService;
  period: string;
  amountDue: number;
  source: ReadingSource;
}) {
  return saveReading({ ...params, documentRef: null });
}
