export const CLIENT_TYPES = ["property_admin", "independent_owner"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];
export type AccountType = ClientType | "general_admin";
export const ACCOUNT_LABELS: Record<AccountType, string> = {
  general_admin: "Administrador General",
  property_admin: "Administrador de Propiedades",
  independent_owner: "Propietario Independiente",
};
export function isClientType(value: unknown): value is ClientType {
  return value === "property_admin" || value === "independent_owner";
}
export function accountDestination(type: AccountType | null): "/admin" | "/account-setup" | "/dashboard" {
  if (type === "general_admin") return "/admin";
  return type ? "/dashboard" : "/account-setup";
}
export interface AccountContext {
  user_id: string;
  account_type: AccountType | null;
  organization_id: string | null;
  full_name: string;
}