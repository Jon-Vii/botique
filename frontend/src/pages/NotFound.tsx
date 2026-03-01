import { Compass } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";

export function NotFound() {
  return (
    <div className="space-y-6">
      <EmptyState
        icon={<Compass size={48} weight="duotone" />}
        title="Page not found"
        description="The route does not exist in the current Botique frontend."
      />
      <div className="flex justify-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 border border-rule bg-white px-4 py-2 text-sm font-medium text-ink transition-[background-color,border-color,color] hover:border-orange/20 hover:bg-orange-1 hover:text-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
        >
          Return to Observatory
        </Link>
      </div>
    </div>
  );
}
