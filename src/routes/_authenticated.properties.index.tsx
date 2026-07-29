import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building, MapPin, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { UNIT_TYPE_LABELS } from "@/lib/property-types";
import type { Database } from "@/integrations/supabase/types";

type PropertyRow = Database["public"]["Tables"]["properties"]["Row"] & {
  rentable_units: { id: string }[];
};

export const Route = createFileRoute("/_authenticated/properties/")({
  head: () => ({ meta: [{ title: "Propiedades — Cartera" }] }),
  component: PropertiesIndex,
});

function PropertiesIndex() {
  const org = useCurrentOrg();
  const orgId = org.data?.organization_id;
  const query = useQuery({
    queryKey: ["properties", orgId],
    queryFn: async (): Promise<PropertyRow[]> => {
      const { data, error } = await supabase
        .from("properties")
        .select("*, rentable_units(id)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PropertyRow[];
    },
    enabled: !!orgId,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Propiedades</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas las propiedades de tu organización y sus unidades arrendables.
          </p>
        </div>
        <Link to="/properties/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Nueva propiedad
          </Button>
        </Link>
      </div>

      <div className="mt-8">
        {query.isLoading ? (
          <div className="text-sm text-muted-foreground">Cargando propiedades…</div>
        ) : query.data && query.data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.map((p) => (
              <Link
                key={p.id}
                to="/properties/$id"
                params={{ id: p.id }}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-brand/50"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                    <Building className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold group-hover:text-brand">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">{UNIT_TYPE_LABELS[p.property_type]}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="line-clamp-2">
                    {p.address}
                    {p.comuna ? `, ${p.comuna}` : ""}
                  </span>
                </div>
                <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                  {p.rentable_units.length} {p.rentable_units.length === 1 ? "unidad arrendable" : "unidades arrendables"}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-secondary text-secondary-foreground">
        <Building className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-semibold">Aún no tienes propiedades</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Agrega tu primera propiedad y sus unidades arrendables (departamento, estacionamiento, bodega...).
      </p>
      <Link to="/properties/new" className="mt-5 inline-block">
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Crear primera propiedad
        </Button>
      </Link>
    </div>
  );
}