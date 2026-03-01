import { useMemo, useState } from "react";
import {
  CaretDown,
  Storefront,
  MagnifyingGlass,
  Brain,
  ShoppingCart,
  Wrench,
} from "@phosphor-icons/react";
import type { TurnRecord } from "../../types/api";

/* ── Category definitions ── */

type ToolCategory = {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgClass: string;
  tools: string[];
};

const CATEGORIES: ToolCategory[] = [
  {
    label: "Listings",
    icon: <Storefront size={12} weight="duotone" />,
    color: "text-teal",
    bgClass: "bg-teal/5 border-teal/15",
    tools: ["create_draft_listing", "update_listing", "publish_listing"],
  },
  {
    label: "Market Research",
    icon: <MagnifyingGlass size={12} weight="duotone" />,
    color: "text-violet",
    bgClass: "bg-violet-dim border-violet/15",
    tools: ["get_active_listings", "get_taxonomy_nodes"],
  },
  {
    label: "Memory",
    icon: <Brain size={12} weight="duotone" />,
    color: "text-amber",
    bgClass: "bg-amber/5 border-amber/15",
    tools: ["add_journal_entry", "set_reminder", "complete_reminder"],
  },
  {
    label: "Sales",
    icon: <ShoppingCart size={12} weight="duotone" />,
    color: "text-emerald",
    bgClass: "bg-emerald-dim border-emerald/15",
    tools: ["get_shop_receipts", "get_shop_reviews"],
  },
];

type CategorizedGroup = {
  category: ToolCategory;
  turns: TurnRecord[];
};

function categorizeTurns(turns: TurnRecord[]): {
  groups: CategorizedGroup[];
  uncategorized: TurnRecord[];
} {
  const allCategoryTools = new Set(CATEGORIES.flatMap((c) => c.tools));
  const groups: CategorizedGroup[] = [];
  const uncategorized: TurnRecord[] = [];

  for (const cat of CATEGORIES) {
    const matching = turns.filter((t) =>
      cat.tools.includes(t.tool_call.name),
    );
    if (matching.length > 0) {
      groups.push({ category: cat, turns: matching });
    }
  }

  for (const t of turns) {
    if (!allCategoryTools.has(t.tool_call.name)) {
      uncategorized.push(t);
    }
  }

  return { groups, uncategorized };
}

/* ── Formatted details for specific tool types ── */

function ListingDetail({ turn }: { turn: TurnRecord }) {
  const args = turn.tool_call.arguments;
  const title =
    typeof args.title === "string" ? args.title : null;
  const price =
    typeof args.price === "number" ? args.price : null;

  return (
    <div className="flex items-center gap-2 text-xs text-secondary">
      <span className="font-mono text-ink font-medium">
        {turn.tool_call.name}
      </span>
      {title && (
        <span className="text-muted truncate max-w-[200px]">"{title}"</span>
      )}
      {price != null && (
        <span className="num text-emerald">${price.toFixed(2)}</span>
      )}
    </div>
  );
}

function MemoryDetail({ turn }: { turn: TurnRecord }) {
  const args = turn.tool_call.arguments;
  const content =
    typeof args.content === "string"
      ? args.content.slice(0, 80)
      : typeof args.title === "string"
        ? args.title
        : null;

  return (
    <div className="flex items-center gap-2 text-xs text-secondary">
      <span className="font-mono text-ink font-medium">
        {turn.tool_call.name}
      </span>
      {content && (
        <span className="text-muted truncate max-w-[240px] italic">
          {content}
        </span>
      )}
    </div>
  );
}

function GenericDetail({ turn }: { turn: TurnRecord }) {
  const argKeys = Object.keys(turn.tool_call.arguments);
  return (
    <div className="flex items-center gap-2 text-xs text-secondary">
      <span className="font-mono text-ink font-medium">
        {turn.tool_call.name}
      </span>
      {argKeys.length > 0 && (
        <span className="text-muted truncate max-w-[200px]">
          {argKeys.join(", ")}
        </span>
      )}
    </div>
  );
}

function TurnDetail({ turn }: { turn: TurnRecord }) {
  const name = turn.tool_call.name;

  if (
    ["create_draft_listing", "update_listing", "publish_listing"].includes(name)
  ) {
    return <ListingDetail turn={turn} />;
  }
  if (
    ["add_journal_entry", "set_reminder", "complete_reminder"].includes(name)
  ) {
    return <MemoryDetail turn={turn} />;
  }
  return <GenericDetail turn={turn} />;
}

/* ── Category group card ── */

function CategoryGroup({ group }: { group: CategorizedGroup }) {
  const [expanded, setExpanded] = useState(false);
  const { category, turns } = group;

  return (
    <div className={`border ${category.bgClass} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left cursor-pointer hover:bg-white/40 transition-colors"
      >
        <span className={category.color}>{category.icon}</span>
        <span className="text-xs font-mono font-semibold text-ink">
          {category.label}
        </span>
        <span className="text-[10px] font-mono text-muted ml-auto mr-2">
          {turns.length} action{turns.length !== 1 ? "s" : ""}
        </span>
        <CaretDown
          size={10}
          className={`text-muted transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-1 animate-card-in">
          {turns.map((turn) => (
            <TurnDetail key={turn.turn_index} turn={turn} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */

export function ActivitySummary({ turns }: { turns: TurnRecord[] }) {
  const { groups, uncategorized } = useMemo(
    () => categorizeTurns(turns),
    [turns],
  );

  if (turns.length === 0) return null;

  return (
    <div className="tech-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-muted mb-3">
        <Wrench size={12} weight="duotone" className="text-orange" />
        Activity Summary
        <span className="ml-2 px-1.5 py-0.5 bg-gray-1 border border-rule text-[9px] font-mono text-secondary">
          {turns.length} turn{turns.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-1.5">
        {groups.map((g) => (
          <CategoryGroup key={g.category.label} group={g} />
        ))}

        {uncategorized.length > 0 && (
          <UncategorizedGroup turns={uncategorized} />
        )}
      </div>
    </div>
  );
}

function UncategorizedGroup({ turns }: { turns: TurnRecord[] }) {
  const [expanded, setExpanded] = useState(false);

  // Group by tool name for a compact summary
  const byName = useMemo(() => {
    const map = new Map<string, TurnRecord[]>();
    for (const t of turns) {
      const name = t.tool_call.name;
      const arr = map.get(name);
      if (arr) arr.push(t);
      else map.set(name, [t]);
    }
    return [...map.entries()].sort(([, a], [, b]) => b.length - a.length);
  }, [turns]);

  return (
    <div className="border border-rule bg-gray-1/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left cursor-pointer hover:bg-white/40 transition-colors"
      >
        <Wrench size={12} weight="duotone" className="text-muted" />
        <span className="text-xs font-mono font-semibold text-secondary">
          Other
        </span>
        <span className="text-[10px] font-mono text-muted ml-auto mr-2">
          {turns.length} action{turns.length !== 1 ? "s" : ""}
        </span>
        <CaretDown
          size={10}
          className={`text-muted transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-1 animate-card-in">
          {byName.map(([name, group]) => (
            <div
              key={name}
              className="flex items-center gap-2 text-xs text-secondary"
            >
              <span className="font-mono text-ink font-medium">{name}</span>
              <span className="text-muted">x{group.length}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
