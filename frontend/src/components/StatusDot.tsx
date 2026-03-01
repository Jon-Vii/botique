type StatusState = "active" | "draft" | "sold_out" | "inactive" | "building" | "error";

const config: Record<StatusState, { color: string; label: string; pulse: boolean }> = {
  active:   { color: "bg-emerald",  label: "Active",   pulse: true },
  building: { color: "bg-amber",    label: "Building", pulse: true },
  draft:    { color: "bg-teal",     label: "Draft",    pulse: false },
  sold_out: { color: "bg-rose",     label: "Sold Out", pulse: false },
  inactive: { color: "bg-gray-6",   label: "Inactive", pulse: false },
  error:    { color: "bg-rose",     label: "Error",    pulse: true },
};

export function StatusDot({
  state,
  label = false,
  size = "sm",
}: {
  state: StatusState;
  label?: boolean;
  size?: "sm" | "md";
}) {
  const c = config[state];
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`rounded-full ${dotSize} ${c.color} ${c.pulse ? "dot-pulse" : ""}`}
      />
      {label && (
        <span className="text-[10px] font-mono font-semibold text-secondary uppercase tracking-wider">
          {c.label}
        </span>
      )}
    </span>
  );
}
