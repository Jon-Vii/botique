import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-orange/20 mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-ink mb-2">
        {title}
      </h3>
      <p className="text-sm text-secondary max-w-md leading-relaxed">
        {description}
      </p>
    </div>
  );
}
