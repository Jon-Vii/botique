import type { ReactNode } from "react";

type BadgeVariant =
  | "gray"
  | "orange"
  | "emerald"
  | "teal"
  | "violet"
  | "rose"
  | "sky"
  | "amber";

export type { BadgeVariant };

const styles: Record<BadgeVariant, { base: string; subtle: string }> = {
  gray: {
    base: "bg-gray-3 text-gray-9 border-gray-a3",
    subtle: "bg-gray-a1 text-gray-9 border-gray-a2",
  },
  orange: {
    base: "bg-orange-2 text-orange-9 border-orange-5",
    subtle: "bg-orange-1 text-orange-8 border-orange-4",
  },
  emerald: {
    base: "bg-emerald-dim text-emerald border-emerald/15",
    subtle: "bg-emerald-subtle text-emerald border-emerald/10",
  },
  teal: {
    base: "bg-teal-dim text-teal border-teal/15",
    subtle: "bg-teal-subtle text-teal border-teal/10",
  },
  violet: {
    base: "bg-violet-dim text-violet border-violet/15",
    subtle: "bg-violet-subtle text-violet border-violet/10",
  },
  rose: {
    base: "bg-rose-dim text-rose border-rose/15",
    subtle: "bg-rose-subtle text-rose border-rose/10",
  },
  sky: {
    base: "bg-sky-dim text-sky border-sky/15",
    subtle: "bg-sky-subtle text-sky border-sky/10",
  },
  amber: {
    base: "bg-amber-dim text-amber border-amber/15",
    subtle: "bg-amber-subtle text-amber border-amber/10",
  },
};

export function Badge({
  children,
  variant = "gray",
  subtle = false,
  icon,
  className = "",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  subtle?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const s = subtle ? styles[variant].subtle : styles[variant].base;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider border ${s} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
