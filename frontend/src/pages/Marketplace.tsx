import { MagnifyingGlass, Package, SlidersHorizontal } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { ListingCard } from "../components/ListingCard";
import { ListingCardSkeleton } from "../components/Skeleton";
import { useActiveListings } from "../hooks/useApi";

type SortOption = "relevance" | "price_asc" | "price_desc" | "newest";

export function Marketplace() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("relevance");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading } = useActiveListings({
    keywords: debouncedSearch || undefined,
    limit: 50,
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    const timeout = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(timeout);
  };

  const listings = useMemo(() => {
    if (!data?.results) return [];
    const items = [...data.results];
    switch (sort) {
      case "price_asc":
        items.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        items.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        items.sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        );
        break;
    }
    return items;
  }, [data?.results, sort]);

  const allTags = useMemo(() => {
    if (!data?.results) return [];
    const tagCounts = new Map<string, number>();
    for (const listing of data.results) {
      for (const tag of listing.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    return [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
  }, [data?.results]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-ink">
          <span className="font-pixel text-orange">Market</span>place
        </h1>
        <p className="mt-1 text-secondary text-sm">
          All active listings across AI-operated shops
        </p>
      </div>

      {/* Search + sort */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <MagnifyingGlass
            size={18}
            weight="duotone"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search for anything..."
            className="w-full bg-white border-2 border-rule pl-11 pr-5 py-2.5 text-sm text-ink font-body placeholder:text-muted focus:outline-none focus:border-orange focus:shadow-[0_0_0_2px_var(--color-cream),0_0_0_4px_var(--color-orange)] transition-[border-color,box-shadow] duration-150"
          />
        </div>

        <div className="flex items-center gap-2 bg-white border border-rule px-3 py-2.5">
          <SlidersHorizontal size={14} weight="duotone" className="text-muted" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="bg-transparent text-xs text-secondary font-mono font-semibold focus:outline-none cursor-pointer"
          >
            <option value="relevance">Relevance</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="newest">Newest First</option>
          </select>
        </div>
      </div>

      {/* Tag cloud */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(([tag, count]) => (
            <button
              key={tag}
              onClick={() => {
                setSearch(tag);
                setDebouncedSearch(tag);
              }}
              className={`tag-pill !bg-white cursor-pointer ${
                debouncedSearch === tag
                  ? "!border-orange !text-orange !bg-orange-50"
                  : ""
              }`}
            >
              {tag}
              <span className="ml-1 text-muted text-[9px]">{count}</span>
            </button>
          ))}
          {debouncedSearch && (
            <button
              onClick={() => {
                setSearch("");
                setDebouncedSearch("");
              }}
              className="tag-pill !bg-white cursor-pointer !text-rose !border-rose/25 hover:!bg-rose-dim"
            >
              clear
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      {data && (
        <div className="text-xs text-muted font-mono">
          <span className="num font-bold text-secondary">
            {data.count}
          </span>{" "}
          result{data.count !== 1 ? "s" : ""}
        </div>
      )}

      {/* Listing grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 stagger">
          {Array.from({ length: 10 }, (_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      ) : listings.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 stagger">
          {listings.map((listing) => (
            <ListingCard key={listing.listing_id} listing={listing} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Package size={48} weight="duotone" />}
          title="No listings found"
          description={
            debouncedSearch
              ? `Nothing matches "${debouncedSearch}". Try a different search.`
              : "The marketplace is empty. Start the simulation to see AI agents create products."
          }
        />
      )}
    </div>
  );
}
