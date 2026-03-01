import { MagnifyingGlass, Package, SlidersHorizontal } from "@phosphor-icons/react";
import { useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { ListingCard } from "../components/ListingCard";
import { ListingCardSkeleton } from "../components/Skeleton";
import { useActiveListings } from "../hooks/useApi";

type SortOption = "relevance" | "price_asc" | "price_desc" | "newest";

const SORT_OPTIONS: Array<{ label: string; value: SortOption }> = [
  { label: "Relevance", value: "relevance" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Newest First", value: "newest" },
];

function parseSort(value: string | null): SortOption {
  if (value === "price_asc" || value === "price_desc" || value === "newest") {
    return value;
  }
  return "relevance";
}

function buildTagCounts(tagsByListing: Array<{ tags: string[] }>) {
  const tagCounts = new Map<string, number>();
  for (const listing of tagsByListing) {
    for (const tag of listing.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  return [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
}

export function Marketplace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchFromUrl = searchParams.get("q") ?? "";
  const sort = parseSort(searchParams.get("sort"));
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const deferredSearch = useDeferredValue(searchInput.trim());

  useEffect(() => {
    setSearchInput(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (deferredSearch) next.set("q", deferredSearch);
    else next.delete("q");

    const serializedCurrent = searchParams.toString();
    const serializedNext = next.toString();
    if (serializedCurrent !== serializedNext) {
      setSearchParams(next, { replace: true });
    }
  }, [deferredSearch, searchParams, setSearchParams]);

  const sortParams =
    sort === "price_asc"
      ? { sort_on: "price", sort_order: "asc" as const }
      : sort === "price_desc"
        ? { sort_on: "price", sort_order: "desc" as const }
        : sort === "newest"
          ? { sort_on: "created", sort_order: "desc" as const }
          : undefined;

  const { data, isLoading } = useActiveListings({
    keywords: deferredSearch || undefined,
    limit: 50,
    ...sortParams,
  });

  const listings = data?.results ?? [];
  const allTags = buildTagCounts(listings);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">
          <span className="font-pixel text-orange">Market</span>place
        </h1>
        <p className="mt-1 text-sm text-secondary">
          All active listings across AI-operated shops.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <label htmlFor="market-search" className="sr-only">
            Search marketplace listings
          </label>
          <MagnifyingGlass
            size={18}
            weight="duotone"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            id="market-search"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search listings, materials, or tags…"
            className="w-full border-2 border-rule bg-white py-2.5 pl-11 pr-5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-orange focus:shadow-[0_0_0_2px_var(--color-cream),0_0_0_4px_var(--color-orange)] transition-[border-color,box-shadow]"
          />
        </div>

        <div className="flex items-center gap-2 border border-rule bg-white px-3 py-2.5">
          <SlidersHorizontal
            size={14}
            weight="duotone"
            className="text-muted"
            aria-hidden="true"
          />
          <label htmlFor="market-sort" className="sr-only">
            Sort marketplace listings
          </label>
          <select
            id="market-sort"
            value={sort}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              const nextSort = parseSort(event.target.value);
              if (nextSort === "relevance") next.delete("sort");
              else next.set("sort", nextSort);
              setSearchParams(next, { replace: true });
            }}
            className="cursor-pointer bg-transparent text-xs font-mono font-semibold text-secondary focus:outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {allTags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSearchInput(tag)}
              aria-pressed={deferredSearch === tag}
              className={`tag-pill !bg-white transition-[background-color,border-color,color] ${
                deferredSearch === tag
                  ? "!border-orange !bg-orange-50 !text-orange"
                  : ""
              }`}
            >
              {tag}
              <span className="ml-1 text-[9px] text-muted">{count}</span>
            </button>
          ))}
          {deferredSearch ? (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="tag-pill !border-rose/25 !bg-white !text-rose transition-[background-color,border-color,color] hover:!bg-rose-dim"
            >
              clear
            </button>
          ) : null}
        </div>
      ) : null}

      {data ? (
        <p className="text-xs font-mono text-muted">
          <span className="num font-bold text-secondary">{data.count}</span>{" "}
          result{data.count !== 1 ? "s" : ""}
        </p>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 stagger sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, index) => (
            <ListingCardSkeleton key={index} />
          ))}
        </div>
      ) : listings.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 stagger sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {listings.map((listing) => (
            <ListingCard key={listing.listing_id} listing={listing} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Package size={48} weight="duotone" />}
          title="No listings found"
          description={
            deferredSearch
              ? `Nothing matches “${deferredSearch}”. Try a broader query or a different tag.`
              : "The marketplace is empty. Start the simulation to see AI agents create products."
          }
        />
      )}
    </div>
  );
}
