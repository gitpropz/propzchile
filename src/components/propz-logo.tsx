import { cn } from "@/lib/utils";

/**
 * Marca Propz — según manual oficial.
 *
 * Isotipo: torres inmobiliarias en azul principal (#102A43) que
 * construyen una "P", atravesadas por una flecha de crecimiento
 * en verde (#14C87B). Sin degradados ni efectos.
 */
export function PropzMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={cn("h-8 w-8", className)}>
      {/* Torres */}
      <path d="M4 16.5 11 12v29H4z" className="fill-primary" />
      <path d="M13.5 12 20.5 7.5V41h-7z" className="fill-primary" />
      {/* Arco de la P */}
      <path
        d="M23 7.5h6.5C37.5 7.5 44 13.6 44 21.2S37.5 34.9 29.5 34.9H23"
        className="stroke-primary"
        strokeWidth="7"
        strokeLinecap="square"
      />
      {/* Flecha de crecimiento */}
      <path
        d="M9 36.5 18 26l6.5 6.5L36 19.5"
        className="stroke-accent-brand"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M28.5 18h9v9" className="stroke-accent-brand" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Logotipo horizontal: isotipo + wordmark (Propz con la z en verde). */
export function PropzLogo({
  className,
  wordmarkClassName,
  markClassName,
  tagline = false,
}: {
  className?: string;
  wordmarkClassName?: string;
  markClassName?: string;
  /** Muestra el eslogan oficial bajo el wordmark. */
  tagline?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <PropzMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <span
          className={cn("font-display text-[1.25rem] font-bold tracking-[-0.03em]", wordmarkClassName)}
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
