import { cn } from "@/lib/utils";

/**
 * Marca Propz.
 *
 * El isotipo es una "P" construida sobre una forma arquitectónica sólida:
 * una base de patrimonio con un núcleo abierto que representa la capa
 * tecnológica. Geometría estable, sin degradados ni efectos.
 */
export function PropzMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-8", className)}
    >
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M11 23V9.6c0-.33.27-.6.6-.6h5.65c3.17 0 5.25 1.95 5.25 4.9s-2.08 4.95-5.25 4.95H14.4"
        stroke="currentColor"
        className="text-primary-foreground"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.1" cy="13.95" r="1.85" className="fill-primary" />
    </svg>
  );
}

/** Logotipo completo: isotipo + wordmark. */
export function PropzLogo({
  className,
  wordmarkClassName,
  markClassName,
}: {
  className?: string;
  wordmarkClassName?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <PropzMark className={markClassName} />
      <span
        className={cn(
          "font-display text-[1.0625rem] font-bold tracking-[-0.03em]",
          wordmarkClassName,
        )}
      >
        Propz
      </span>
    </span>
  );
}
