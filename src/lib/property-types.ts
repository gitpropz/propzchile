import type { Database } from "@/integrations/supabase/types";

export type UnitType = Database["public"]["Enums"]["unit_type"];
export type Currency = Database["public"]["Enums"]["currency"];

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  apartment: "Departamento",
  house: "Casa",
  office: "Oficina",
  retail: "Local comercial",
  parking: "Estacionamiento",
  storage: "Bodega",
  other: "Otro",
};

export const UNIT_TYPE_OPTIONS: { value: UnitType; label: string }[] = (
  Object.keys(UNIT_TYPE_LABELS) as UnitType[]
).map((v) => ({ value: v, label: UNIT_TYPE_LABELS[v] }));

export const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: "CLP", label: "CLP" },
  { value: "UF", label: "UF" },
  { value: "USD", label: "USD" },
];