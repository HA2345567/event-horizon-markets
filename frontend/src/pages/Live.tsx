import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageShell } from "@/components/layout/PageShell";
import { Activity, ArrowDown, ArrowRight, ArrowUp, Globe, LayoutGrid, List as ListIcon, Radio, Search, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KalshiMarketLive } from "@/lib/api-types";

const CATS = ["All", "Crypto", "Politics", "Sports", "Economy", "Culture", "Weather", "Other"] as const;

function fmtUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "ended";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function Live() {
  const [cat, setCat] = useState<(typeof CATS)[number]>("All");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(1000);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data, isLoading, isError, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ["live", "markets", limit],
    queryFn: () => api.liveMarkets({ status: "open", limit }),
    refetchInterval: 15_000,           // poll every 15s (institutional standard)
    refetchIntervalInBackground: false,
  });

  const markets = data?.markets ?? [];
  const filtered = useMemo(() => {
    return markets.filter((m) => {
      if (cat !== "All" && m.category !== cat) return false;
      if (q && !`${m.title} ${m.event_ticker}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [markets, cat, q]);

  const totalVol = data?.meta?.totalVolume ?? 0;
  const totalLiq = data?.meta?.totalLiquidity ?? 0;
  const cacheAge = data?.meta?.cacheAge ?? 0;

  return (
    <PageShell>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 grid-bg radial-fade opacity-40" />
        <div className="container relative py-16">
          <div className="badge-pill">
            <Radio className="h-3 w-3 animate-pulse-soft" /> Live · Institutional liquidity bridge
          </div>
          <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[1.05] tracking-tight text-gradient">
            Real-time prediction markets, aggregated from institutional feeds.
          </h1>
          <p className="mt-5 max-w-2xl text-muted-foreground">
            Heliora aggregates markets from top-tier institutional providers alongside 
            native Solana markets so traders see one unified feed. Prices refresh 
            every 15 seconds via our edge proxy — arbitrage agents keep them 
            aligned with on-chain liquidity.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            <Stat label="Open markets" value={String(markets.length)} />
            <Stat label="24h volume" value={fmtUsd(totalVol)} />
            <Stat label="Liquidity" value={fmtUsd(totalLiq)} />
            <Stat label="Cache age" value={`${Math.max(0, Math.floor(cacheAge / 1000))}s`} />
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
              placeholder="Search live markets…"
              className="h-10 w-full rounded-md border border-border bg-surface pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  cat === c
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 p-1 bg-surface border border-border rounded-lg mr-2">
            <button 
              onClick={() => setViewMode("grid")}
              className={cn("px-2 py-1 rounded-md transition", viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button 
              onClick={() => setViewMode("list")}
              className={cn("px-2 py-1 rounded-md transition", viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <ListIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-surface-hover disabled:opacity-50"
          >
            <Activity className={cn("h-3.5 w-3.5", isFetching && "animate-pulse-soft")} />
            {isFetching ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </section>

      <section className="container py-10">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-44 animate-shimmer rounded-2xl border border-border bg-surface" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-dashed border-destructive/40 py-16 text-center">
            <p className="text-sm text-destructive">Couldn't reach Heliora API</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{(error as Error).message}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            No markets match your filters.
          </div>
        ) : (
          <>
            {viewMode === "grid" ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((m) => <KalshiCard key={m.ticker} m={m} />)}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-ring">
                <div className="grid grid-cols-12 border-b border-border bg-background px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <div className="col-span-5">Market</div>
                  <div className="col-span-1 text-center">Ticker</div>
                  <div className="col-span-2 text-right">Price (Yes)</div>
                  <div className="col-span-2 text-right">24h Vol</div>
                  <div className="col-span-2 text-right">Expires</div>
                </div>
                <div className="divide-y divide-border/50">
                  {filtered.map((m) => (
                    <Link to={`/live/${m.ticker}`} key={m.ticker} className="grid grid-cols-12 items-center px-5 py-4 transition hover:bg-surface-hover">
                      <div className="col-span-5 pr-4 flex items-center gap-3">
                        <div className="h-8 w-8 shrink-0 rounded-md ring-1 ring-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
                          {(m as any).image_url || (m as any).imageUrl ? (
                            <img
                              src={(m as any).image_url || (m as any).imageUrl}
                              className="h-full w-full object-cover"
                              alt=""
                            />
                          ) : (
                            <Globe className="h-4 w-4 text-white/20" />
                          )}
                        </div>
                        <div>
                          <div className="line-clamp-1 text-sm font-medium">{m.title}</div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="badge-pill !bg-surface !border-border/40 text-[9px]">{m.category}</span>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-1 text-center font-mono text-[11px] text-muted-foreground">
                        {m.ticker.split('-').slice(-1)[0]}
                      </div>
                      <div className="col-span-2 text-right">
                        <div className="font-mono text-sm font-semibold">{(m.yes_prob * 100).toFixed(1)}%</div>
                        <div className="text-[10px] text-muted-foreground">{(1 / m.yes_prob).toFixed(2)}x</div>
                      </div>
                      <div className="col-span-2 text-right font-mono text-sm">
                        {fmtUsd(m.volume_24h / 100)}
                      </div>
                      <div className="col-span-2 text-right font-mono text-[11px] text-muted-foreground">
                        {timeUntil(m.close_time)}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            
            {data?.pagination?.hasMore && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={() => setLimit(l => l + 100)}
                  disabled={isFetching}
                  className="group relative flex items-center gap-2 rounded-xl border border-border bg-surface px-8 py-4 text-sm font-semibold text-foreground shadow-ring transition hover:bg-surface-elevated active:scale-[0.98] disabled:opacity-50"
                >
                  {isFetching ? "Syncing..." : "Load more markets"}
                  <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-6">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl">{value}</div>
    </div>
  );
}

function KalshiCard({ m }: { m: KalshiMarketLive }) {
  const yesProb = Math.round(m.yes_prob * 100);
  const noProb = 100 - yesProb;
  const yesMultiplier = (1 / m.yes_prob).toFixed(2);
  const noMultiplier = (1 / (1 - m.yes_prob)).toFixed(2);
  const vol = (m.volume_24h ?? 0) / 100;

  return (
    <Link
      to={`/live/${m.ticker}`}
      className="group relative flex flex-col w-full bg-[#0B0B0B] border border-white/5 rounded-[24px] p-6 transition-all duration-300 hover:bg-[#111111] hover:border-white/10 hover:shadow-2xl"
    >
      <div className="flex flex-col flex-1">
        {/* Header: Label */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[11px] font-black tracking-widest text-[#888888] uppercase">
            {m.category}
          </span>
          <div className="ml-auto flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-success/80">
            <ShieldCheck className="h-3 w-3" />
            Live Feed
          </div>
        </div>

        {/* Title with Image */}
        <div className="flex gap-4 mb-8">
          <div className="h-12 w-12 shrink-0 rounded-xl ring-1 ring-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
            {(m as any).image_url || (m as any).imageUrl ? (
              <img
                src={(m as any).image_url || (m as any).imageUrl}
                className="h-full w-full object-cover"
                alt=""
              />
            ) : (
              <Globe className="h-6 w-6 text-white/20" />
            )}
          </div>
          <h3 className="text-[17px] font-bold text-white leading-snug line-clamp-2 min-h-[3rem]">
            {m.title}
          </h3>
        </div>

        {/* Outcomes Grid */}
      <div className="flex flex-col gap-6 mb-8">
          {/* Yes Row */}
        <div className="flex items-center justify-between group/row">
          <div className="flex flex-col gap-1 flex-1 mr-8">
            <span className="text-base font-semibold text-white/95">Yes</span>
            <div className="h-[3px] w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                <div 
                className="h-full bg-[#00FFBD] transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(0,255,189,0.2)]" 
                  style={{ width: `${yesProb}%` }}
                />
              </div>
            </div>
          <div className="flex items-center gap-5">
            <span className="text-[13px] font-medium text-[#555555]">{yesMultiplier}x</span>
            <div className="min-w-[68px] h-[36px] rounded-full border border-[#00FFBD]/30 flex items-center justify-center bg-[#00FFBD]/5">
              <span className="text-[14px] font-bold text-white">{yesProb}%</span>
              </div>
            </div>
          </div>

          {/* No Row */}
        <div className="flex items-center justify-between group/row">
          <div className="flex flex-col gap-1 flex-1 mr-8">
            <span className="text-base font-semibold text-white/95">No</span>
            <div className="h-[3px] w-full bg-[#1A1A1A] rounded-full overflow-hidden">
                <div 
                className="h-full bg-[#FF4F4F] transition-all duration-1000 ease-out" 
                  style={{ width: `${noProb}%` }}
                />
              </div>
            </div>
          <div className="flex items-center gap-5">
            <span className="text-[13px] font-medium text-[#555555]">{noMultiplier}x</span>
            <div className="min-w-[68px] h-[36px] rounded-full border border-white/10 flex items-center justify-center bg-white/5">
              <span className="text-[14px] font-bold text-white">{noProb}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <span className="text-[12px] font-medium text-[#555555]">
            {fmtUsd(vol)} vol
          </span>
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#555555]">
          <Radio className="h-3 w-3 text-success/70" />
            {timeUntil(m.close_time)}
          </div>
        </div>
      </div>
    </Link>
  );
}
