import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/layout/PageShell";
import { api, formatUsd } from "@/lib/api";
import type { ApiAgent } from "@/lib/api-types";
import { Bot, Brain, Cpu, Network, Search, Sparkles, TrendingUp, Zap } from "lucide-react";
import { cn, getAvatar } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const TYPES = ["All", "Sentiment", "Arbitrage", "MarketMaker", "NewsAlpha", "Momentum"] as const;

const ICON_BY_TYPE: Record<string, typeof Bot> = {
  Sentiment: Brain,
  Arbitrage: Network,
  MarketMaker: Cpu,
  NewsAlpha: Zap,
  Momentum: TrendingUp,
};

export default function Agents() {
  const [type, setType] = useState<(typeof TYPES)[number]>("All");
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.listAgents(),
  });

  const all = data?.agents ?? [];
  const list = all.filter((a) => {
    const matchesType = type === "All" || a.type === type;
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.handle.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });
  const totalAum = all.reduce((s, a) => s + a.aum, 0);

  return (
    <PageShell>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 grid-bg radial-fade opacity-50" />
        <div className="container relative py-20">
          <div className="badge-pill"><Bot className="h-3 w-3" /> Agent marketplace</div>
          <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[1.05] tracking-tight text-gradient">
            Subscribe to AI agents that trade prediction markets 24/7.
          </h1>
          <p className="mt-5 max-w-xl text-muted-foreground">
            Squads multisig keeps your funds safe. Performance fee only. All agent
            actions logged on-chain — track records cannot be manipulated.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            <Stat label="Active agents" value={all.filter((a) => a.status === "live").length.toString()} />
            <Stat label="AUM" value={formatUsd(totalAum)} />
            <Stat label="Total agents" value={all.length.toString()} />
            <Stat label="Avg uptime" value={all.length ? `${(all.reduce((s, a) => s + a.uptime, 0) / all.length).toFixed(2)}%` : "—"} />
          </div>
        </div>
      </section>

      <section className="sticky top-16 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="container flex flex-col gap-3 py-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search agents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-surface pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  type === t ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-10">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[320px] animate-shimmer rounded-2xl border border-border bg-surface" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-dashed border-destructive/40 py-16 text-center text-destructive">
            <p className="text-sm">Failed to load agents</p>
            <p className="mt-1 font-mono text-xs opacity-70">{(error as Error).message}</p>
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            <p className="text-sm">No agents found matching your criteria</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {list.map((a) => <AgentCard key={a.id} a={a} />)}
          </div>
        )}

        <div className="mt-12 rounded-2xl border border-dashed border-border bg-surface/40 p-10 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
          <h3 className="mt-4 font-display text-2xl">Building an agent of your own?</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Use the Solana Agent Kit plugin or our MCP server. List on the marketplace and earn performance fees.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <a href="/developers" className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-surface">Read docs</a>
            <button className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-button-inset">Submit agent</button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function AgentCard({ a }: { a: ApiAgent }) {
  const Icon = ICON_BY_TYPE[a.type] ?? Bot;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const subMutation = useMutation({
    mutationFn: (capital: number) => api.subscribeAgent(a.id, capital),
    onSuccess: () => {
      toast.success(`Successfully subscribed to ${a.name}!`);
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (err: Error) => {
      toast.error(`Subscription failed: ${err.message}`);
    },
  });

  const handleSubscribe = () => {
    // In a real app, this would open a modal to choose capital
    const capital = 1000;
    subMutation.mutate(capital);
  };

  return (
    <div className="group flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-ring transition hover:bg-surface-elevated">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background overflow-hidden">
            <img src={getAvatar(a.id, true)!} className="h-full w-full object-cover scale-110" alt="" />
          </div>
          <div>
            <div className="font-display text-xl">{a.name}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{a.handle}</div>
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", a.status === "live" ? "bg-success/15 text-success" : "bg-warning/10 text-warning")}>
          <span className={cn("h-1 w-1 rounded-full", a.status === "live" ? "bg-success animate-pulse-soft" : "bg-warning")} /> {a.status}
        </span>
      </div>

      <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">{a.description}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl border border-border bg-background p-4">
        <Metric label="30d P&L" value={`${a.pnl30d >= 0 ? "+" : ""}${a.pnl30d.toFixed(1)}%`} accent={a.pnl30d >= 0 ? "success" : "destructive"} />
        <Metric label="Win rate" value={`${a.winRate.toFixed(0)}%`} />
        <Metric label="Sharpe" value={a.sharpe.toFixed(1)} />
        <Metric label="Max DD" value={`${a.maxDrawdown.toFixed(1)}%`} accent="destructive" />
      </div>

      <div className="mt-4">
        <Spark seed={a.id} positive={a.pnl30d > 0} />
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4 text-xs">
        <span className="font-mono text-muted-foreground">AUM {formatUsd(a.aum)}</span>
        <span className="font-mono text-muted-foreground">{a._count?.subscriptions ?? 0} subs</span>
        <span className="font-mono text-muted-foreground">{a.performanceFee}% fee</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button 
          onClick={() => navigate(`/agents/${a.id}`)}
          className="rounded-md border border-border bg-background py-2 text-xs font-medium hover:bg-surface-hover"
        >
          View stats
        </button>
        <button 
          onClick={handleSubscribe}
          disabled={subMutation.isPending}
          className="rounded-md bg-foreground py-2 text-xs font-semibold text-background shadow-button-inset hover:opacity-90 disabled:opacity-50"
        >
          {subMutation.isPending ? "Subscribing..." : "Subscribe"}
        </button>
      </div>
    </div>
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
function Metric({ label, value, accent }: { label: string; value: string; accent?: "success" | "destructive" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono text-base font-semibold", accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "text-foreground")}>
        {value}
      </div>
    </div>
  );
}
function Spark({ seed, positive }: { seed: string; positive: boolean }) {
  const hash = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const N = 40;
  const pts: number[] = [];
  let v = 0.5;
  for (let i = 0; i < N; i++) {
    const r = ((hash * (i + 7)) % 100) / 100 - 0.5;
    v += r * 0.06 + (positive ? 0.006 : -0.004);
    v = Math.max(0.05, Math.min(0.95, v));
    pts.push(v);
  }
  const W = 200, H = 36;
  const path = pts.map((p, i) => {
    const x = (i / (N - 1)) * W;
    const y = H - p * H;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-9 w-full">
      <path d={path} stroke={positive ? "hsl(var(--success))" : "hsl(var(--destructive))"} strokeWidth="1.4" fill="none" />
    </svg>
  );
}
