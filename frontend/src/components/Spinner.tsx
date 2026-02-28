export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const px = { sm: 16, md: 24, lg: 36 }[size];
  return (
    <div className="flex items-center justify-center py-16">
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        className="animate-spin text-orange"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeDasharray="50 25"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
