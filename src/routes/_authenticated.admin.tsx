import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAccountContext } from "@/lib/account-context";
import { ACCOUNT_LABELS, type ClientType } from "@/lib/account-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type Subscription = Database["public"]["Tables"]["organization_subscriptions"]["Row"];
interface Overview {
  organizations: { id: string; name: string; properties_count: number; units_count: number }[];
  clients: { user_id: string; organization_id: string; account_type: ClientType; full_name: string; email: string }[];
  members: { user_id: string; organization_id: string; full_name: string; email: string; role: string }[];
  subscriptions: Subscription[];
}
const STATUS = { not_configured: "Sin configurar", trial: "Prueba", active: "Activa", past_due: "Pago pendiente", canceled: "Cancelada" };
type Status = keyof typeof STATUS;
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const account = await getAccountContext();
    if (account.account_type !== "general_admin") throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [
    { title: "Administración General — Propz 5.0" },
    { name: "description", content: "Organizaciones, clientes y suscripciones de Propz." },
    { property: "og:title", content: "Administración General — Propz 5.0" },
    { property: "og:description", content: "Organizaciones, clientes y suscripciones de Propz." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: GeneralAdmin,
});
function GeneralAdmin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [plan, setPlan] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>("not_configured");
  const [currency, setCurrency] = useState<"CLP" | "UF" | "USD">("CLP");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const overview = useQuery({ queryKey: ["general-admin-overview"], queryFn: async () => {
    const { data, error } = await supabase.rpc("general_admin_overview");
    if (error) throw error;
    return data as unknown as Overview;
  } });
  async function support(id: string) {
    await qc.cancelQueries();
    sessionStorage.setItem("propz-support-organization", id);
    qc.removeQueries({ predicate: (query) => query.queryKey[0] !== "account-context" && query.queryKey[0] !== "general-admin-overview" });
    await navigate({ to: "/dashboard" });
  }
  function editSubscription(id: string) {
    const s = overview.data?.subscriptions.find((s) => s.organization_id === id);
    setPlan(s?.plan_name ?? ""); setAmount(s?.monthly_amount == null ? "" : String(s.monthly_amount));
    setStatus((s?.status as Status) ?? "not_configured"); setCurrency(s?.currency ?? "CLP");
    setEnd(s?.current_period_end ?? ""); setNotes(s?.notes ?? ""); setEditing(id);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("organization_subscriptions").upsert({
      organization_id: editing, status, plan_name: plan || null, monthly_amount: amount ? Number(amount) : null,
      currency, current_period_end: end || null, notes: notes || null,
    });
    setSaving(false);
    if (error) { toast.error("No pudimos guardar la suscripción", { description: error.message }); return; }
    toast.success("Suscripción guardada"); setEditing(null); await overview.refetch();
  }
  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
    <h1 className="text-2xl font-semibold">Administración General</h1>
    <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
      <span>{overview.data?.organizations.length ?? 0} organizaciones</span>
      <span>{overview.data?.clients.length ?? 0} clientes</span>
      <span>{overview.data?.subscriptions.filter((s) => s.status === "active").length ?? 0} suscripciones activas</span>
    </div>
    <Input aria-label="Buscar organización o cliente" placeholder="Buscar organización o cliente" value={filter} onChange={(e) => setFilter(e.target.value)} />
    {overview.isPending && <p>Cargando…</p>}
    {overview.isError && <p role="alert" className="text-destructive">No pudimos cargar las organizaciones.</p>}
    <div className="divide-y divide-border">
      {overview.data?.organizations.filter((o) => [o.name, ...overview.data.clients.filter((c) => c.organization_id === o.id).flatMap((c) => [c.full_name, c.email])].join(" ").toLocaleLowerCase("es").includes(filter.toLocaleLowerCase("es"))).map((o) => {
        const s = overview.data.subscriptions.find((s) => s.organization_id === o.id);
        return <section key={o.id} className="space-y-3 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">{o.name}</h2>
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => support(o.id)}>Abrir cartera</Button><Button size="sm" variant="outline" onClick={() => editSubscription(o.id)}>Suscripción</Button></div>
          </div>
          <p className="text-sm text-muted-foreground">{o.properties_count} propiedades · {o.units_count} unidades · {STATUS[(s?.status as Status) ?? "not_configured"]}{s?.plan_name ? ` · ${s.plan_name}` : ""}</p>
          {overview.data.clients.filter((c) => c.organization_id === o.id).map((c) => <p key={c.user_id} className="break-words text-sm">{c.full_name} · {c.email} · {ACCOUNT_LABELS[c.account_type]}</p>)}
          {overview.data.members.filter((m) => m.organization_id === o.id).map((m) => <p key={m.user_id} className="break-words text-xs text-muted-foreground">Equipo: {m.full_name || m.email} · {m.role}</p>)}
        </section>;
      })}
    </div>
    <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Suscripción</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1"><Label htmlFor="plan">Plan</Label><Input id="plan" value={plan} onChange={(e) => setPlan(e.target.value)} /></div>
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}><SelectTrigger aria-label="Estado de suscripción"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}</SelectContent></Select>
          <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="monthly-amount">Monto mensual</Label><Input id="monthly-amount" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><Label>Moneda</Label><Select value={currency} onValueChange={(v) => setCurrency(v as typeof currency)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["CLP", "UF", "USD"].map((v) => <SelectItem value={v} key={v}>{v}</SelectItem>)}</SelectContent></Select></div></div>
          <div><Label htmlFor="period-end">Fin del período</Label><Input id="period-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div><Label htmlFor="billing-notes">Notas de facturación</Label><Input id="billing-notes" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button disabled={saving} type="submit">{saving ? "Guardando…" : "Guardar"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}