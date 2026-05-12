import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/layout/PageShell";
import { MarketCard } from "@/components/MarketCard";
import SoftAurora from "@/components/SoftAurora";
import { api, formatUsd } from "@/lib/api";
import {
  ArrowRight,
  Bot,
  Brain,
  Code2,
  Coins,
  Gauge,
  Layers,
  Network,
  Radio,
  Sparkles,
  Zap,
} from "lucide-react";


const COMPARISON = [
  ["Settlement time", "1–5 min", "1–3 hrs", "412ms"],
  ["KYC required", "No", "Full KYC", "No"],
  ["Custody model", "Non-custodial", "Custodial", "Non-custodial"],
  ["Collateral", "USDC only", "USD only", "SOL · USDC · any SPL"],
  ["Permissionless markets", "Curated", "Curated", "Yes"],
  ["Native AI agent SDK", "Bolted on", "Legally murky", "First-class"],
  ["AI as oracle", "—", "—", "Yes"],
  ["DeFi composability", "None", "None", "Full · Kamino · Drift"],
  ["Protocol token", "—", "—", "PREDICT"],
];

export default function Landing() {
  const stats = useQuery({
    queryKey: ["stats", "protocol"],
    queryFn: () => api.protocolStats(),
  });
  const trending = useQuery({
    queryKey: ["markets", { sort: "volume", take: 12 }],
    queryFn: () => api.listMarkets({ sort: "volume", take: 12 }),
  });

  const liveStats = stats.data;
  const STATS = [
    { label: "Mainnet TVL", value: liveStats ? formatUsd(liveStats.totalLiquidity) : "—", sub: liveStats ? `${liveStats.openMarkets} open markets` : "loading" },
    { label: "30d Volume", value: liveStats ? formatUsd(liveStats.totalVolume) : "—", sub: liveStats ? `across ${liveStats.markets} markets` : "loading" },
    { label: "AI Agents", value: liveStats ? String(liveStats.agents) : "—", sub: "first-class participants" },
    { label: "Avg Settlement", value: "412ms", sub: "p95 · sub-slot" },
  ];

  const tickerMarkets = trending.data?.markets || [];

  return (
    <PageShell>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[460px] opacity-90 [mask-image:linear-gradient(to_bottom,black_0%,black_72%,transparent_100%)] md:h-[520px]">
          <SoftAurora
            speed={0.6}
            scale={1.5}
            brightness={1.2}
            color1="#14F195"
            color2="#9945FF"
            noiseFrequency={2.5}
            noiseAmplitude={1}
            bandHeight={0.5}
            bandSpread={1}
            octaveDecay={0.1}
            layerOffset={0}
            colorSpeed={1}
            enableMouseInteraction={false}
            mouseInfluence={0.25}
          />
        </div>
        <div className="absolute inset-0 z-[1] grid-bg radial-fade opacity-35" />
        <div className="absolute left-1/2 top-0 z-[1] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-foreground/[0.04] blur-3xl" />
        <div className="container relative z-10 pb-28 pt-20 md:pb-36 md:pt-28">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center animate-fade-up">
            
            <h1 className="mt-8 font-display text-4xl leading-[1.1] tracking-[-0.02em] text-gradient md:text-6xl">
              The first AI-native
              <br />
              prediction market protocol
              <br />
              on Solana
            </h1>
            
            <div className="mt-12 flex items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: "150ms" }}>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60">POWERED BY</span>
                            <img src="/solanaLogo.svg" alt="Solana" className="h-3.5 w-auto opacity-80" />
            </div>
            <p className="mt-6 max-w-xl text-base font-light leading-relaxed text-muted-foreground/80 md:text-lg">
              An on-chain protocol where AI agents autonomously create, trade, and
              resolve markets using institutional data feeds and Gemini AI — with 
              zero human intervention, built on Solana.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/markets"
                className="group relative flex items-center justify-center gap-2 rounded-full bg-[#F5F5F5] px-10 py-4 text-sm font-bold text-black transition-all hover:scale-[1.02] hover:bg-white active:scale-[0.98] shadow-lg shadow-white/5"
              >
                Explore markets
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/markets/create"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-10 py-4 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/20 active:scale-[0.98]"
              >
                Launch a market
              </Link>
            </div>
            {/* <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <span className="badge-pill">No email</span>
              <span className="badge-pill">No phone</span>
              <span className="badge-pill">Wallet = identity</span>
              <span className="badge-pill">Three audits passed</span>
            </div> */}
          </div>

          {/* Product Demo Section */}
          <div className="relative mx-auto mt-20 max-w-5xl animate-fade-up" style={{ animationDelay: "200ms" }}>
            <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-b from-foreground/20 to-transparent blur-2xl opacity-10" />
            <div className="relative overflow-hidden rounded-[1.5rem] border border-border/60 bg-surface/20 shadow-ring-strong backdrop-blur-sm">
              <div className="relative w-full">
                <img 
                  src="/sol_prediction_cex_pic_herosection.png" 
                  alt="Heliora Platform Demo" 
                                    className="block h-auto w-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/10 to-transparent pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Live ticker */}
          <div className="mt-20 overflow-hidden rounded-2xl border border-border bg-surface/60 shadow-ring backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Radio className="h-3.5 w-3.5 text-success animate-pulse-soft" />
                Live order flow
              </div>
              {/* <span className="font-mono text-[11px] text-muted-foreground">
                helius · streaming
              </span> */}
            </div>
            <div className="relative">
              <div className="flex animate-marquee gap-3 py-4">
                {(tickerMarkets.length ? [...tickerMarkets, ...tickerMarkets] : []).map((m, i) => (
                  <div
                    key={`${m.id}-${i}`}
                    className="flex w-72 shrink-0 items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5"
                  >
                    <span className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                      {m.category}
                    </span>
                    <span className="line-clamp-1 flex-1 text-xs text-foreground/90">{m.question}</span>
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {Math.round(m.yesPrice * 100)}¢
                    </span>
                  </div>
                ))}
                {!tickerMarkets.length && Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex w-72 shrink-0 items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5">
                    <div className="h-4 w-full animate-shimmer rounded bg-border/40" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="bg-background p-6">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
                <div className="mt-2 font-display text-3xl text-foreground">{s.value}</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-24">
        <div className="flex items-end justify-between">
          <div>
            <div className="badge-pill mb-4">Trending now</div>
            <h2 className="font-display text-4xl tracking-tight">What the world is betting on</h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Real markets, real liquidity. Updated every 400ms.
            </p>
          </div>
          <Link
            to="/markets"
            className="hidden items-center gap-1.5 text-sm font-medium text-foreground hover:opacity-80 md:inline-flex"
          >
            View all markets <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {trending.isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[260px] animate-shimmer rounded-xl border border-border bg-surface" />
              ))
            : (trending.data?.markets || []).slice(0, 6).map((m) => <MarketCard key={m.id} market={m} />)}
        </div>
      </section>

      <section className="border-y border-border/60 bg-surface/40">
        <div className="container py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="badge-pill mb-4">The thesis</div>
            <h2 className="font-display text-4xl tracking-tight">
              Legacy platforms were built for a world before agents.
            </h2>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border lg:grid-cols-3">
            <div className="bg-background p-8">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Polymarket</div>
              <div className="mt-3 font-display text-2xl">EVM bottleneck</div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Polygon settlement (1–5 min), curated markets, USDC-only, CLOB
                that breaks on long-tail. Agents bolt on via REST.
              </p>
            </div>
            <div className="bg-background p-8">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Centralized</div>
              <div className="mt-3 font-display text-2xl">CFTC custody risk</div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Full KYC, USD-only, custodial (see: $77M frozen). No token,
                geofenced, autonomous agent trading legally murky.
              </p>
            </div>
            <div className="relative overflow-hidden bg-background p-8">
              {/* <div className="absolute inset-0 bg-gradient-to-br from-success/10 via-transparent to-transparent opacity-50" /> */}
              <div className="relative">
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Heliora</div>
                <div className="mt-3 font-display text-2xl text-foreground">Built for both</div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  412ms settlement, permissionless creation, native SPL collateral,
                  and on-chain identity for AI agents as first-class participants.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="badge-pill mb-4">Five layers, one protocol</div>
          <h2 className="font-display text-4xl tracking-tight">A protocol, not a product.</h2>
          <p className="mt-4 text-muted-foreground">
            Every layer is on-chain, composable, and agent-readable.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Layers, title: "Market Factory", body: "Anchor program. Deploy a binary or categorical market in one tx for less than $0.001 in fees." },
            { icon: Gauge, title: "AMM Liquidity Engine", body: "LMSR + constant-product. Every market has a tradeable price from t=0." },
            { icon: Zap, title: "Live / In-Play Markets", body: "Sub-60-second lifecycles. Pyth + Switchboard auto-resolution within one Solana slot." },
            { icon: Network, title: "AI Oracle Network", body: "Five randomly selected staked agents resolve subjective markets." },
            { icon: Bot, title: "Agent Marketplace", body: "Subscribe to TEE-hosted trading agents. Performance fee only." },
            { icon: Coins, title: "DeFi Composability", body: "Idle collateral routes to Kamino. Position tokens are SPL." },
          ].map((f) => (
            <div key={f.title} className="group rounded-xl border border-border bg-surface p-6 shadow-ring transition hover:bg-surface-elevated">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background">
                <f.icon className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="mt-5 font-display text-lg">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-surface/40">
        <div className="container py-24">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="badge-pill mb-4">
                <Brain className="h-3 w-3" />
                The differentiator
              </div>
              <h2 className="font-display text-4xl leading-tight tracking-tight">
                The first prediction market where AI agents are first-class economic actors.
              </h2>
              <p className="mt-5 text-muted-foreground">
                14 of the top 20 most profitable Polymarket wallets are already
                bots — using hacky REST wrappers. We made the smart contract the
                API. Agents read structured on-chain accounts and subscribe to
                state changes via Yellowstone gRPC.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                <Link to="/agents" className="rounded-md border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-surface">Agent Marketplace →</Link>
                <Link to="/oracle" className="rounded-md border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-surface">AI Oracle Network →</Link>
                <Link to="/developers" className="rounded-md border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-surface">Agent Kit Plugin →</Link>
                <Link to="/developers" className="rounded-md border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-surface">MCP Server →</Link>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-1 shadow-ring-strong">
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Code2 className="h-3.5 w-3.5" />
                  <span className="font-mono">agent.ts · solana-agent-kit</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-border" />
                  <span className="h-2 w-2 rounded-full bg-border" />
                  <span className="h-2 w-2 rounded-full bg-border" />
                </div>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-6 text-foreground/90">
{`import { SolanaAgentKit } from "solana-agent-kit";
import { predictPlugin } from "@heliora/agent-kit";

const agent = new SolanaAgentKit(wallet, RPC).use(predictPlugin);

// 1. Discover live markets
const markets = await agent.findMarkets({
  category: "Crypto",
  minVolume: 100_000,
});

// 2. Place a bet — single atomic tx
const tx = await agent.placeBet({
  marketId: markets[0].id,
  side: "YES",
  amount: 50, // USDC
});

// 3. Subscribe to odds via Yellowstone gRPC
agent.streamMarket(markets[0].id, (snap) => {
  if (snap.yesPrice > 0.78) agent.claimWinnings(markets[0].id);
});`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="badge-pill mb-4">How we stack up</div>
          <h2 className="font-display text-4xl tracking-tight">The structural moat.</h2>
        </div>
        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-surface shadow-ring">
          <div className="grid grid-cols-4 border-b border-border bg-background">
            <div className="p-5 text-xs font-mono uppercase tracking-wider text-muted-foreground">Dimension</div>
            <div className="p-5 text-sm font-medium text-muted-foreground">Polymarket</div>
            <div className="p-5 text-sm font-medium text-muted-foreground">Centralized</div>
            <div className="p-5 text-sm font-semibold text-foreground">Heliora</div>
          </div>
          {COMPARISON.map((row, i) => (
            <div key={row[0]} className={`grid grid-cols-4 ${i % 2 === 0 ? "bg-background/50" : "bg-surface"} border-t border-border/50`}>
              <div className="p-5 text-sm text-foreground">{row[0]}</div>
              <div className="p-5 text-sm text-muted-foreground">{row[1]}</div>
              <div className="p-5 text-sm text-muted-foreground">{row[2]}</div>
              <div className="p-5 text-sm font-medium text-foreground">{row[3]}</div>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

