interface LoadingDotsProps {
  /** Dot size in px */
  size?: number;
  /** Color — any Tailwind text color class */
  color?: string;
}

/**
 * Geist-style three-dot loading indicator.
 *
 * Used for agent "thinking" states and inline loading.
 * Each dot bounces with a staggered delay.
 */
export function LoadingDots({
  size = 4,
  color = "bg-orange",
}: LoadingDotsProps) {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`loading-dot inline-block rounded-full ${color}`}
          style={{
            width: size,
            height: size,
            animationDelay: `${i * 160}ms`,
          }}
        />
      ))}
    </span>
  );
}
