import { cn } from "@/lib/utils";

/**
 * Marca Propz — según manual oficial.
 *
 * Isotipo: torres inmobiliarias en azul principal (#102A43) que
 * construyen una "P", atravesadas por una flecha de crecimiento
 * en verde (#14C87B). Sin degradados ni efectos.
 */
export function PropzMark({
  className,
  tone = "brand",
}: {
  className?: string;
  /** "inverse" pinta la P en blanco para fondos azules (sidebar). */
  tone?: "brand" | "inverse";
}) {
  const solid = tone === "inverse" ? "fill-white" : "fill-primary";
  const line = tone === "inverse" ? "stroke-white" : "stroke-primary";
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={cn("h-8 w-8", className)}>
      {/* Torres ascendentes */}
      <path d="M3 18.5 9.5 14v28H3z" className={solid} />
      <path d="M12.5 13 19 8.5V42h-6.5z" className={solid} />
      {/* Cuerpo de la P */}
      <path d="M22 8.5h6.5v33.5H22z" className={solid} />
      {/* Arco de la P */}
      <path
        d="M28.5 11.5h2.8c5.9 0 10.2 3.6 10.2 9s-4.3 9-10.2 9h-2.8"
        className={line}
        strokeWidth="6"
        strokeLinecap="butt"
      />
      {/* Flecha de crecimiento */}
      <path
        d="M7 36.5 16.5 25.5l5.5 5.5L36.5 15"
        className="stroke-accent-brand"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M29 14.5h8.5V23"
        className="stroke-accent-brand"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


/** Logotipo horizontal: isotipo + wordmark (Propz con la z en verde). */
export function PropzLogo({
  className,
  wordmarkClassName,
  markClassName,
  tone = "brand",
  tagline = false,
}: {
  className?: string;
  wordmarkClassName?: string;
  markClassName?: string;
  tone?: "brand" | "inverse";
  /** Muestra el eslogan oficial bajo el wordmark. */
  tagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-end gap-2", className)}>
      <PropzMark className={markClassName} tone={tone} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[1.75rem] font-bold leading-[0.85] tracking-[-0.03em]",
            wordmarkClassName,
          )}
        >
          Prop<span className="text-accent-brand">z</span>
        </span>
        {tagline && (
          <span className="mt-1 text-[0.6875rem] leading-tight text-muted-foreground">
            Todo tu patrimonio inmobiliario en un solo lugar
          </span>
        )}
      </span>
    </span>
  );
}
