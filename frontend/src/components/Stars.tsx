import { Star } from "@phosphor-icons/react";

export function Stars({
  rating,
  size = 13,
}: {
  rating: number;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          weight={i < Math.round(rating) ? "fill" : "regular"}
          className={
            i < Math.round(rating)
              ? "text-amber"
              : "text-muted/30"
          }
        />
      ))}
    </span>
  );
}
