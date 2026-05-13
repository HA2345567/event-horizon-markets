import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { PageShell } from "@/components/layout/PageShell";
import { api, formatUsd, timeUntil } from "@/lib/api";
import { 
  Bot, Brain, Cpu, Network, TrendingUp, Zap, 
  ArrowLeft, ShieldCheck, Users, BarChart3, 
  Activity, ArrowUpRight, History, Wallet,
  Info, AlertCircle, CheckCircle2, ChevronRight
} from "lucide-react";
import { cn, getAvatar } from "@/lib/utils";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useHelioraWallet } from "@/components/wallet/useHelioraWallet";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const ICON_BY_TYPE: Record<string, any> = {
  Sentiment: Brain,
  Arbitrage: Network,
  MarketMaker: Cpu,
  NewsAlpha: Zap,
  Momentum: TrendingUp,
};

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { address, balance } = useHelioraWallet();
  const [subAmount, setSubAmount] = useState(100);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["agent", id],
    queryFn: () => api.getAgent(id!),
    enabled: !!id,
    refetchInterval: 10000,
  });

  const agent = data?.agent;
  const perf = data?.performance;
  const trades = data?.recentTrades ?? [];

  const subMutation = useMutation({
    mutationFn: (capital: number) => api.subscribeAgent(id!, capital),
    onSuccess: () => {
      toast.success(`Successfully allocated $${subAmount} to ${agent?.name}`);
      queryClient.invalidateQueries({ queryKey: ["agent", id] });
    },
    onError: (err: any) => {
      toast.error(`Subscription failed: ${err.message}`);
    },
  });

  const handleSubscribe = () => {
    if (!address) {
      toast.error("Please connect your wallet first");
      return;
    }
    if (subAmount > balance) {
      toast.error("Insufficient USDC balance");
      return;
    }
    subMutation.mutate(subAmount);
  };

  // Generate fake equity curve based on real PnL
  const chartData = useMemo(() => {
    if (!perf) return [];
    const base = 1000;
    const pts = 30;
    const out = [];
    let current = base;
    const dailyVol = Math.abs(perf.realizedPnl) / 10 + 0.5;
    
    for (let i = 0; i < pts; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (pts - i));
      const drift = perf.realizedPnl / pts;
      current += drift + (Math.random() - 0.5) * dailyVol;
      out.push({
        date: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        value: +current.toFixed(2)
      });
    }
    return out;
  }, [perf]);

  if (isLoading) {
    return (
      <PageShell>
        <div className="container py-20 animate-pulse">
          <div className="h-8 w-48 bg-surface rounded mb-6" />
          <div className="grid lg:grid-cols-[1fr_400px] gap-8">
            <div className="space-y-6">
              <div className="h-64 bg-surface rounded-2xl border border-border" />
              <div className="h-96 bg-surface rounded-2xl border border-border" />
            </div>
            <div className="h-[500px] bg-surface rounded-2xl border border-border" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (isError || !agent) {
    return (
      <PageShell>
        <div className="container py-32 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-display">Agent not found</h2>
          <p className="text-muted-foreground mt-2">The agent you are looking for does not exist or has been deactivated.</p>
          <Link to="/agents" className="mt-6 inline-flex items-center gap-2 text-sm text-foreground hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to marketplace
          </Link>
        </div>
      </PageShell>
    );
  }

  const Icon = ICON_BY_TYPE[agent.type] ?? Bot;

  return (
    <PageShell>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 -z-10 h-[400px] bg-gradient-to-b from-surface/50 to-transparent" />
        
        <div className="container py-8">
          {/* Breadcrumb */}
          <Link to="/agents" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-6">
            <ArrowLeft className="h-4 w-4" /> Marketplace
          </Link>

          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            {/* LEFT COLUMN */}
            <div className="space-y-8">
              {/* Profile Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border">
                <div className="flex items-center gap-5">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-border bg-background shadow-ring overflow-hidden">
                    <img src={getAvatar(agent.id, true)!} className="h-full w-full object-cover scale-110" alt="" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="font-display text-4xl tracking-tight">{agent.name}</h1>
                      <span className="badge-pill bg-success/10 text-success border-success/20">LIVE</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="font-mono">{agent.handle}</span>
                      <span className="text-border">|</span>
                      <span className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5" /> {agent.type} Engine</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right hidden md:block">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Managed AUM</div>
                    <div className="text-2xl font-display">{formatUsd(agent.aum)}</div>
                  </div>
                  <div className="h-10 w-px bg-border mx-2 hidden md:block" />
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Subscribers</div>
                    <div className="text-2xl font-display">{agent._count?.subscriptions ?? 0}</div>
                  </div>
                </div>
              </div>

              {/* Performance Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="30d P&L" value={`${agent.pnl30d >= 0 ? "+" : ""}${agent.pnl30d.toFixed(1)}%`} sub="Past month" tone={agent.pnl30d >= 0 ? "success" : "destructive"} />
                <StatCard label="Win Rate" value={`${agent.winRate.toFixed(1)}%`} sub={`${perf?.winningTrades} of ${perf?.totalTrades} trades`} />
                <StatCard label="Sharpe Ratio" value={agent.sharpe.toFixed(2)} sub="Risk adjusted" />
                <StatCard label="Max Drawdown" value={`${agent.maxDrawdown.toFixed(1)}%`} sub="Historical peak" tone="destructive" />
              </div>

              {/* Equity Chart */}
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-ring">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Cumulative Performance</h3>
                  </div>
                  <div className="flex gap-1 rounded-lg bg-background p-1 border border-border">
                    {["1D", "1W", "1M", "ALL"].map(r => (
                      <button key={r} className={cn("px-2.5 py-1 text-[10px] font-bold rounded-md uppercase transition", r === "1M" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{r}</button>
                    ))}
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--foreground))" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="hsl(var(--foreground))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} hide />
                      <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                        itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--foreground))" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Trades */}
              <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-ring">
                <div className="flex items-center justify-between border-b border-border bg-background/50 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Agent Activity Log</h3>
                  </div>
                  <button className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    Export history <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="divide-y divide-border">
                  {trades.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground text-sm">
                      No recent trade activity found for this agent.
                    </div>
                  ) : (
                    trades.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between p-4 hover:bg-background/40 transition">
                        <div className="flex items-center gap-4">
                          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg font-mono text-[10px] font-bold", t.side === "YES" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                            {t.side}
                          </div>
                          <div>
                            <div className="text-sm font-medium leading-tight">{t.market.question}</div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                              <span>{t.shares} shares</span>
                              <span className="text-border">•</span>
                              <span>avg {t.price.toFixed(3)}¢</span>
                              <span className="text-border">•</span>
                              <span>{timeUntil(t.createdAt, true)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn("text-sm font-mono font-semibold", t.status === 'won' ? "text-success" : t.status === 'lost' ? "text-destructive" : "text-muted-foreground")}>
                            {t.status === 'won' ? `+$${(t.cost * 0.4).toFixed(2)}` : t.status === 'lost' ? `-$${t.cost.toFixed(2)}` : "Pending"}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{t.status}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN — Subscription Panel */}
            <aside className="space-y-6">
              <div className="rounded-2xl border-2 border-foreground/5 bg-surface p-6 shadow-ring-strong relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <ShieldCheck className="h-24 w-24" />
                </div>
                
                <h3 className="font-display text-xl">Copy-stake Agent</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Allocate USDC to {agent.name}. The agent will automatically trade your capital on prediction markets, following its own strategy.
                </p>

                <div className="mt-8 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Allocation amount</span>
                      <span>Balance: {formatUsd(balance)}</span>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 focus-within:ring-2 ring-foreground/20 transition-all">
                      <Wallet className="h-5 w-5 text-muted-foreground" />
                      <input 
                        type="number"
                        value={subAmount}
                        onChange={(e) => setSubAmount(Number(e.target.value))}
                        className="w-full bg-transparent font-display text-2xl focus:outline-none"
                        placeholder="0.00"
                      />
                      <span className="font-mono text-sm font-semibold">USDC</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[100, 500, 1000, 5000].map(v => (
                      <button 
                        key={v} 
                        onClick={() => setSubAmount(v)}
                        className={cn("rounded-lg border py-2 text-xs font-mono transition", subAmount === v ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-surface")}
                      >
                        ${v}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-xl bg-background/50 p-4 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Performance Fee</span>
                      <span className="font-mono font-medium">{agent.performanceFee}% of profit</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Management Fee</span>
                      <span className="font-mono font-medium">0% (Limited time)</span>
                    </div>
                    <div className="border-t border-border/50 pt-3 flex justify-between text-sm">
                      <span className="font-semibold">Expected Cap</span>
                      <span className="font-mono font-bold">${subAmount.toLocaleString()}</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleSubscribe}
                    disabled={subMutation.isPending}
                    className="w-full rounded-xl bg-foreground py-4 text-sm font-bold text-background shadow-button-inset transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {subMutation.isPending ? "Allocating Capital..." : "Subscribe & Stake"}
                  </button>

                  <div className="flex items-center gap-2 justify-center text-[10px] text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" />
                    Funds secured by Heliora Multi-Sig
                  </div>
                </div>
              </div>

              {/* Info Card */}
              <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  How it works
                </div>
                <div className="space-y-4">
                  <Step num={1} text="Choose an amount of USDC to allocate." />
                  <Step num={2} text="The agent places trades proportionally based on its AUM." />
                  <Step num={3} text="Winnings are auto-credited to your copy-trading sub-account." />
                  <Step num={4} text="Withdraw your capital + profit at any time." />
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-success" />
                  <div>
                    <div className="text-xs font-semibold">Uptime Status</div>
                    <div className="text-[10px] text-muted-foreground">Last heartbeat 14s ago</div>
                  </div>
                </div>
                <div className="font-mono text-xs font-bold text-success">{agent.uptime.toFixed(1)}%</div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "success" | "destructive" }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-ring transition hover:bg-surface-elevated">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-2xl font-display", tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground")}>
        {value}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground/80 leading-tight">{sub}</div>
    </div>
  );
}

function Step({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-bold">{num}</span>
      <p className="text-[11px] leading-snug text-muted-foreground">{text}</p>
    </div>
  );
}
