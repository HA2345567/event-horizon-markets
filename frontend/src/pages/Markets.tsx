import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/layout/PageShell";
import { MarketCard } from "@/components/MarketCard";
import { api, formatUsd } from "@/lib/api";
import type { MarketCategory } from "@/lib/api-types";
import { Link } from "react-router-dom";
import { ArrowUpDown, Filter, Plus, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES: MarketCategory[] = [
  "Crypto", "Politics", "Sports", "Memes", "NFTs", "DeFi", "Social", "AI", "Weather",
];
type Sort = "volume" | "ending" | "trending" | "newest";

export default function Markets() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<MarketCategory | "All">("All");
  const [sort, setSort] = useState<Sort>("volume");
  const [liveOnly, setLiveOnly] = useState(false);

  const params = useMemo(
    () => ({
      category: cat === "All" ? undefined : cat,
      live: liveOnly || undefined,
      sort,
      search: q.trim() || undefined,
      take: 200,
    }),
    [cat, liveOnly, sort, q],
  );

  const query = useQuery({
    queryKey: ["markets", params],
    queryFn: () => api.listMarkets(params),
  });
  const filtered = query.data?.markets ?? [];
  const totalVolume = filtered.reduce((s, m) => s + m.volume, 0);

  return (
    <PageShell>
      <section className="border-b border-border/60">
        <div className="container py-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="font-display text-4xl tracking-tight">All markets</h1>
              <p className="mt-2 text-muted-foreground">
                {query.isLoading ? "Loading…" : `${filtered.length} markets · ${formatUsd(totalVolume)} visible volume`}
              </p>
            </div>
            <Link
              to="/markets/create"
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-button-inset"
            >
              <Plus className="h-4 w-4" /> Create market
            </Link>
          </div>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container flex flex-col gap-3 py-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search markets…"
              className="h-10 w-full rounded-md border border-border bg-surface pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:border-border-strong focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <CatChip label="All" active={cat === "All"} onClick={() => setCat("All")} />
            {CATEGORIES.map((c) => (
              <CatChip key={c} label={c} active={cat === c} onClick={() => setCat(c)} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLiveOnly((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 h-10 text-xs font-medium",
                liveOnly ? "border-success/50 bg-success/10 text-success" : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" /> Live
            </button>
            <div className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="bg-transparent text-sm focus:outline-none"
              >
                <option value="volume">Volume</option>
                <option value="ending">Ending soon</option>
                <option value="trending">Trending</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-10">
        {query.isLoading ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-[380px] animate-shimmer rounded-2xl border border-border bg-surface" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-destructive/40 py-24 text-destructive">
            <p className="text-sm">Failed to load markets. Is the backend running?</p>
            <p className="mt-1 font-mono text-xs opacity-70">{(query.error as Error).message}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-24">
            <Filter className="h-6 w-6 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">No markets match these filters</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-surface text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
