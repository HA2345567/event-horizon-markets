import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useHelioraWallet } from "@/components/wallet/useHelioraWallet";
import { PageShell } from "@/components/layout/PageShell";
import { api, formatUsd, timeUntil } from "@/lib/api";
import { useMarketSocket } from "@/hooks/useMarketSocket";
import type { ApiMarket, ApiPricePoint, ApiTrade } from "@/lib/api-types";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { IDL } from "@/lib/idl";
import { toast } from "sonner";
import { Buffer } from "buffer";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Bookmark,
  Bot,
  Brain,
  CandlestickChart,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Flame,
  LineChart as LineChartIcon,
  Loader2,
  MoreHorizontal,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Wifi,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Side = "YES" | "NO";
type OrderType = "Market" | "Limit" | "Stop";
type ChartMode = "Line" | "Candle";
type Range = "1H" | "1D" | "1W" | "1M" | "ALL";

interface Candle { o: number; h: number; l: number; c: number; close: number; }
interface OBRow { price: number; size: number; total: number; flash?: "up" | "down" | null; }

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const RANGE_MS: Record<Range, number> = {
  "1H": 3_600_000,
  "1D": 86_400_000,
  "1W": 604_800_000,
  "1M": 2_592_000_000,
  "ALL": Infinity,
};

function filterPointsByRange(points: ApiPricePoint[], range: Range): ApiPricePoint[] {
  if (!points.length) return [];
  if (range === "ALL") return points;
  const cutoff = Date.now() - RANGE_MS[range];
  const filtered = points.filter((p) => new Date(p.ts).getTime() >= cutoff);
  // If too few, take last N points
  if (filtered.length < 8) {
    const n = { "1H": 12, "1D": 24, "1W": 48, "1M": 90 }[range] ?? 24;
    return points.slice(-n);
  }
  return filtered;
}

function formatChartLabel(ts: string, range: Range): string {
  const d = new Date(ts);
  if (range === "1H" || range === "1D") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (range === "1W") return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["market", id],
    queryFn: () => api.getMarket(id!),
    enabled: !!id,
    refetchInterval: 8000,
  });
  const { data: relatedData } = useQuery({
    queryKey: ["markets", "related"],
    queryFn: () => api.listMarkets({ sort: "volume", take: 6 }),
  });

  const { balance, isLoadingBalance } = useHelioraWallet();

  const { livePrice: socketPrice, orderbook: socketOrderbook, status: wsStatus } = useMarketSocket(id);

  const market = data?.market;
  const pricePoints = market?.pricePoints ?? [];

  const trend = useMemo(() => {
    if (!pricePoints.length) return 0;
    const first = pricePoints[0]?.yesPrice ?? 0.5;
    const current = market?.yesPrice ?? 0.5;
    return current - first;
  }, [pricePoints, market?.yesPrice]);

  const seedYes = market?.yesPrice ?? 0.5;
  const queryClient = useQueryClient();

  // ─── Social Actions (Watchlist/Alerts)
  const { data: watchlistData } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => api.getWatchlist(),
    enabled: !!id,
  });

  const isWatched = useMemo(() => {
    return watchlistData?.markets.some((m) => m.id === id);
  }, [watchlistData, id]);

  const toggleWatchlist = useMutation({
    mutationFn: () => api.toggleWatchlist(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });

  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction } = useWallet();

  const [isBuying, setIsBuying] = useState(false);
  const [isSell, setIsSell] = useState(false);

  const handleTrade = async (targetIndex: number) => {
    if (!publicKey || !signTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }

    try {
      setIsBuying(true);
      toast.loading(`Buying ${market.question.slice(0, 20)}...`, { id: "trade" });

      const programId = new PublicKey("By5KbxUEFGs7NrQYLXcjmptft6yX2saVWvoA8sx7HzqT");
      const provider = new anchor.AnchorProvider(connection, {
        publicKey, signTransaction: signTransaction as any, signAllTransactions: async (t) => t
      }, { preflightCommitment: "confirmed" });

      const program = new anchor.Program(IDL, provider);
      const marketIdNum = market.onchainId ? parseInt(market.onchainId) : 0;
      const marketIdBytes = new Uint8Array(4);
      new DataView(marketIdBytes.buffer).setUint32(0, marketIdNum, true);

      const encoder = new TextEncoder();
      const [marketPda] = PublicKey.findProgramAddressSync([encoder.encode('market'), marketIdBytes], programId);
      const [vaultPda] = PublicKey.findProgramAddressSync([encoder.encode('vault'), marketIdBytes], programId);
      
      const collateralMint = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
      const userCollateral = getAssociatedTokenAddressSync(collateralMint, publicKey);
      
      const targetMint = new PublicKey(market.outcome_mints[targetIndex]);
      const userOutcome = getAssociatedTokenAddressSync(targetMint, publicKey);
      const [outcomeVault] = PublicKey.findProgramAddressSync([encoder.encode(`outcome_${targetIndex}`), marketIdBytes], programId);

      const amountIn = new anchor.BN(amount * 1_000_000);

      // Remaining accounts for categorical swap
      const remainingAccounts = [];
      for (let i = 0; i < market.outcomes_count; i++) {
        remainingAccounts.push({ pubkey: new PublicKey(market.outcome_mints[i]), isSigner: false, isWritable: true });
      }
      for (let i = 0; i < market.outcomes_count; i++) {
        const [v] = PublicKey.findProgramAddressSync([encoder.encode(`outcome_${i}`), marketIdBytes], programId);
        remainingAccounts.push({ pubkey: v, isSigner: false, isWritable: true });
      }

      const tx = await program.methods
        .swap(marketIdNum, targetIndex, amountIn)
        .accounts({
          market: marketPda,
          user: publicKey,
          userCollateral,
          collateralVault: vaultPda,
          userOutcome,
          outcomeVault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts(remainingAccounts)
        .rpc();

      toast.success("Trade confirmed on-chain!", { id: "trade" });
      queryClient.invalidateQueries({ queryKey: ["market", id] });
    } catch (err: any) {
      toast.error(`Trade failed: ${err.message}`, { id: "trade" });
    } finally {
      setIsBuying(false);
    }
  };

  const handleClaim = async () => {
    if (!publicKey || !signTransaction) return;
    try {
      setIsClaiming(true);
      toast.loading("Claiming rewards...", { id: "claim" });
      
      const programId = new PublicKey("By5KbxUEFGs7NrQYLXcjmptft6yX2saVWvoA8sx7HzqT");
      const provider = new anchor.AnchorProvider(connection, {
        publicKey, signTransaction: signTransaction as any, signAllTransactions: async (t) => t
      }, { preflightCommitment: "confirmed" });

      const program = new anchor.Program(IDL, provider);
      const marketIdNum = market.onchainId ? parseInt(market.onchainId) : 0;
      const marketIdBytes = new Uint8Array(4);
      new DataView(marketIdBytes.buffer).setUint32(0, marketIdNum, true);
      
      const encoder = new TextEncoder();
      const [marketPda] = PublicKey.findProgramAddressSync([encoder.encode('market'), marketIdBytes], programId);
      const [vaultPda] = PublicKey.findProgramAddressSync([encoder.encode('vault'), marketIdBytes], programId);

      const winningIndex = market.winning_outcome_index ?? 0;
      const winningMint = new PublicKey(market.outcome_mints[winningIndex]);
      const userWinningOutcomeAta = getAssociatedTokenAddressSync(winningMint, publicKey);
      
      const collateralMint = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
      const userCollateral = getAssociatedTokenAddressSync(collateralMint, publicKey);

      const tx = await program.methods
        .claimRewards(marketIdNum)
        .accounts({
          user: publicKey,
          market: marketPda,
          userCollateral,
          collateralVault: vaultPda,
          winningOutcomeMint: winningMint,
          userWinningOutcomeAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      toast.success("Rewards claimed!", { id: "claim" });
      queryClient.invalidateQueries({ queryKey: ["market", id] });
    } catch (err: any) {
      toast.error(`Claim failed: ${err.message}`, { id: "claim" });
    } finally {
      setIsClaiming(false);
    }
  };

  const [copyStatus, setCopyStatus] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: market?.question || "Heliora Market",
        url: window.location.href,
      });
    } else {
      handleCopy();
    }
  };

  // ─── Live price (WebSocket + polling fallback)
  const [livePrice, setLivePrice] = useState(seedYes);
  const [tickDir, setTickDir] = useState<"up" | "down" | "flat">("flat");
  const wsConnected = wsStatus === "open";
  const prevPriceRef = useRef(seedYes);
  const [wsOrderbook, setWsOrderbook] = useState<{ yes: OBRow[]; no: OBRow[] } | null>(null);

  // Sync live price from API
  useEffect(() => {
    if (market) {
      setLivePrice((p) => {
        setTickDir(market.yesPrice > p ? "up" : market.yesPrice < p ? "down" : "flat");
        prevPriceRef.current = p;
        return market.yesPrice;
      });
    }
  }, [market?.yesPrice]);

  // WebSocket sync from hook
  useEffect(() => {
    if (socketPrice !== null) {
      setLivePrice((prev) => {
        setTickDir(socketPrice > prev ? "up" : socketPrice < prev ? "down" : "flat");
        prevPriceRef.current = prev;
        return socketPrice;
      });
    }
  }, [socketPrice]);

  useEffect(() => {
    if (socketOrderbook) {
      const toRows = (items: { price: number; size: number }[]): OBRow[] => {
        let acc = 0;
        return items.map((r) => {
          acc += r.size;
          return { price: r.price, size: r.size, total: acc };
        });
      };
      setWsOrderbook({
        yes: toRows(socketOrderbook.buyYes ?? []),
        no: toRows((socketOrderbook.sellYes ?? []).map((r) => ({
          price: +(1 - r.price).toFixed(4),
          size: r.size,
        }))),
      });
    }
  }, [socketOrderbook]);

  // Polling fallback when WS is not connected
  useEffect(() => {
    if (wsConnected || !market) return;
    const t = setInterval(() => {
      setLivePrice((p) => {
        const drift = (Math.random() - 0.5) * 0.012;
        const next = Math.min(0.99, Math.max(0.01, p + drift));
        setTickDir(next > p ? "up" : next < p ? "down" : "flat");
        return next;
      });
    }, 1800);
    return () => clearInterval(t);
  }, [wsConnected, market?.id]);

  // ─── State
  const [side, setSide] = useState<Side>("YES");
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [amount, setAmount] = useState(100);
  const [limitPrice, setLimitPrice] = useState<number>(Math.round(seedYes * 100));
  const [chartMode, setChartMode] = useState<ChartMode>("Line");
  const [range, setRange] = useState<Range>("1D");
  const [tab, setTab] = useState<"orderbook" | "activity" | "holders" | "agents" | "rules">("orderbook");
  const [bookmarked, setBookmarked] = useState(false);
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);

  // ─── Derived data
  const livePriceForSide = side === "YES" ? livePrice : 1 - livePrice;
  const fillPrice = orderType === "Market" ? livePriceForSide : limitPrice / 100;
  const shares = amount / Math.max(0.01, fillPrice);
  const potential = shares;
  const profit = potential - amount;
  const fee = amount * 0.01;

  // Candles from real price points
  const candles = useMemo(() => {
    const filtered = filterPointsByRange(pricePoints, range);
    if (filtered.length < 2) return generateCandles(livePrice, trend, range);
    return buildCandlesFromPoints(filtered, livePrice);
  }, [pricePoints, range, livePrice, trend]);

  const orderbook = useMemo(() => wsOrderbook ?? generateOrderbook(livePrice), [wsOrderbook, livePrice]);

  // Activity from real trades
  const activity = useMemo(() => {
    const trades = data?.recentTrades ?? [];
    if (trades.length > 0) {
      return trades.map((t, i) => ({
        id: i,
        who: t.handle ?? `${t.wallet?.slice(0, 4) ?? "anon"}…${t.wallet?.slice(-4) ?? ""}`,
        isAgent: t.isAgent ?? false,
        side: (t.side ?? "YES") as Side,
        isBuy: true,
        amount: Math.round(t.shares ?? 0),
        price: t.price,
        time: timeAgo(t.createdAt),
      }));
    }
    return generateActivity(seedYes);
  }, [data?.recentTrades, seedYes]);

  const subMarkets = useMemo(() => buildSubMarkets(seedYes, market?.volume ?? 0), [seedYes, market?.volume]);
  const holders = useMemo(() => generateHolders(seedYes), [seedYes, market?.id]);

  const yesCents = Math.round(livePrice * 100);
  const noCents = 100 - yesCents;
  const isGreen = livePrice >= 0.5;

  if (isLoading || !market) {
    return (
      <PageShell>
        <div className="container py-32 text-center text-sm text-muted-foreground">
          {isError ? "Failed to load market." : "Loading market…"}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] opacity-60"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, hsl(0 0% 100% / 0.06), transparent 70%)" }}
        />

        <div className="container py-6">
          {/* Breadcrumb */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/markets" className="inline-flex items-center gap-1.5 hover:text-foreground transition">
                <ArrowLeft className="h-3.5 w-3.5" /> Markets
              </Link>
              <span className="text-border">/</span>
              <span className="text-foreground/70">{market.category}</span>
              <span className="text-border">/</span>
              <span className="font-mono text-xs text-muted-foreground/80">{market.id?.slice(0, 8)}…</span>
            </div>
          </div>

          {/* Hero header */}
          <header className="mt-4 rounded-2xl border border-border bg-surface/60 p-4 backdrop-blur shadow-ring md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-lg border border-border/70 bg-background/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {market.category}
                </span>
                {market.isLive && (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                    </span>
                    LIVE
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" /> {market.resolution}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  <Wifi className={cn("h-3 w-3", wsConnected ? "text-success" : "text-muted-foreground")} />
                  {wsConnected ? "Live" : "Polling"}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <div className="hidden items-center gap-1 md:flex">
                  <ActionIcon onClick={() => setBookmarked((b) => !b)} active={bookmarked} icon={Bookmark} label="Watch" />
                  <ActionIcon icon={Bell} label="Alert" />
                  <ActionIcon icon={Share2} label="Share" />
                  <ActionIcon icon={Copy} label="Copy link" />
                </div>
                <div className="relative md:hidden">
                  <button
                    onClick={() => setUtilityMenuOpen((v) => !v)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-background/80 text-muted-foreground transition hover:text-foreground hover:bg-background"
                    aria-label="Market actions"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                  {utilityMenuOpen && (
                    <div className="absolute right-0 top-8 z-20 w-36 rounded-lg border border-border bg-background/95 p-1 shadow-ring backdrop-blur">
                      <button onClick={() => { setBookmarked((b) => !b); setUtilityMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-surface hover:text-foreground">
                        <Bookmark className="h-3.5 w-3.5" /> Watch
                      </button>
                      <button onClick={() => setUtilityMenuOpen(false)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-surface hover:text-foreground">
                        <Bell className="h-3.5 w-3.5" /> Alert
                      </button>
                      <button onClick={() => setUtilityMenuOpen(false)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-surface hover:text-foreground">
                        <Share2 className="h-3.5 w-3.5" /> Share
                      </button>
                      <button onClick={() => setUtilityMenuOpen(false)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-surface hover:text-foreground">
                        <Copy className="h-3.5 w-3.5" /> Copy link
                      </button>
                    </div>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Eye className="h-3 w-3" /> {(market.participants * 7).toLocaleString()} watching
                </span>
              </div>
            </div>

            <h1 className="mt-2.5 max-w-[62ch] font-display text-xl leading-[1.2] tracking-tight md:text-2xl">
              {market.question}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Ends in <span className="font-mono text-foreground/90">{timeUntil(market.endsAt)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> {market.participants.toLocaleString()} traders
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> {formatUsd(market.volume)} volume
              </span>
              <span className="inline-flex items-center gap-1.5">
                Created by{" "}
                <span className="font-mono text-foreground/80">
                  {market.creator?.handle ?? `${market.creator?.wallet?.slice(0, 4)}…${market.creator?.wallet?.slice(-4)}`}
                </span>
                · {timeAgo(market.createdAt)}
              </span>
            </div>

            {/* Probability bar */}
            <div className="relative mt-4">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-x-2 -top-2 h-14 rounded-xl opacity-60"
                style={{ background: "radial-gradient(55% 130% at 20% 50%, hsl(0 0% 100% / 0.08), transparent 75%)" }}
              />
              <div className="flex items-end justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-4xl tabular-nums text-foreground">
                    {yesCents}
                    <span className="text-xl text-muted-foreground">¢</span>
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">YES probability</span>
                  <PriceTickPill dir={tickDir} value={trend} />
                </div>
                <div className="hidden text-right text-xs text-muted-foreground md:block">
                  <div>NO settles at <span className="font-mono text-foreground/80">{noCents}¢</span></div>
                  <div className="mt-0.5">Spread <span className="font-mono text-foreground/80">0.01</span> · Fee <span className="font-mono text-foreground/80">1%</span></div>
                </div>
              </div>

              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-background ring-1 ring-inset ring-border">
                <div className="flex h-full w-full">
                  <div className="h-full bg-gradient-to-r from-success/80 to-success transition-all duration-700" style={{ width: `${yesCents}%` }} />
                  <div className="h-full bg-gradient-to-r from-destructive to-destructive/80 transition-all duration-700" style={{ width: `${noCents}%` }} />
                </div>
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] font-medium">
                <span className="text-success">YES · {yesCents}%</span>
                <span className="text-destructive">{noCents}% · NO</span>
              </div>
            </div>
          </header>

          {/* Main grid */}
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
            {/* LEFT */}
            <div className="min-w-0 space-y-6">
              {/* Stats strip */}
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
                {[
                  { l: "24h Volume", v: formatUsd(market.volume * 0.18), s: "+12.4%", up: true },
                  { l: "Liquidity", v: formatUsd(market.liquidity), s: "Deep", up: true },
                  { l: "Open Interest", v: formatUsd(market.volume * 0.42), s: "+3.1%", up: true },
                  { l: "Kamino APY", v: "5.42%", s: "Auto-routed", up: true },
                ].map((s) => (
                  <div key={s.l} className="bg-background p-4">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.l}</div>
                    <div className="mt-1.5 font-display text-xl tabular-nums">{s.v}</div>
                    <div className={cn("mt-0.5 text-[11px]", s.up ? "text-success" : "text-destructive")}>{s.s}</div>
                  </div>
                ))}
              </div>

              {/* Chart card */}
              <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-ring">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className={cn("font-display text-3xl tabular-nums transition-colors", isGreen ? "text-success" : "text-destructive")}>
                      {(livePrice * 100).toFixed(1)}¢
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">YES</span>
                    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px]", trend >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                      {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {(trend * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
                      <ChartTab icon={LineChartIcon} active={chartMode === "Line"} onClick={() => setChartMode("Line")} label="Line" />
                      <ChartTab icon={CandlestickChart} active={chartMode === "Candle"} onClick={() => setChartMode("Candle")} label="Candles" />
                    </div>
                    <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
                      {(["1H", "1D", "1W", "1M", "ALL"] as Range[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => setRange(r)}
                          className={cn(
                            "rounded px-2.5 py-1 text-[11px] font-medium transition",
                            range === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="relative h-[340px] w-full bg-background/20">
                  {chartMode === "Line" ? (
                    <PolymarketChart pricePoints={pricePoints} live={livePrice} range={range} />
                  ) : (
                    <CandleChart candles={candles} live={livePrice} />
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">
                  <span className="font-mono">
                    Last update <span className="text-foreground/80">{new Date().toLocaleTimeString()}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn("h-1.5 w-1.5 rounded-full", wsConnected ? "bg-success animate-pulse-soft" : "bg-warning")} />
                    {wsConnected ? "Live stream" : `Streaming via ${market.resolution}`}
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <div className="rounded-2xl border border-border bg-surface shadow-ring">
                <div className="flex items-center gap-1 border-b border-border px-3 overflow-x-auto">
                  {[
                    { k: "orderbook", l: "Order book" },
                    { k: "activity", l: "Activity" },
                    { k: "holders", l: "Top holders" },
                    { k: "agents", l: "AI Agents" },
                    { k: "rules", l: "Resolution" },
                  ].map((t) => (
                    <button
                      key={t.k}
                      onClick={() => setTab(t.k as typeof tab)}
                      className={cn(
                        "relative shrink-0 px-3.5 py-3 text-sm font-medium transition",
                        tab === t.k ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.l}
                      {tab === t.k && <span className="absolute inset-x-3 -bottom-px h-px bg-foreground" />}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {tab === "orderbook" && (
                    <div className="grid gap-5 lg:grid-cols-2">
                      <DepthBook side="YES" rows={wsOrderbook?.yes ?? orderbook.yes} mid={livePrice} />
                      <DepthBook side="NO" rows={wsOrderbook?.no ?? orderbook.no} mid={1 - livePrice} />
                    </div>
                  )}
                  {tab === "activity" && <ActivityFeed trades={data?.recentTrades ?? []} />}
                  {tab === "holders" && <HoldersList rows={holders} />}
                  {tab === "agents" && <AgentsPanel marketId={market.id} yesPrice={livePrice} />}
                  {tab === "rules" && <ResolutionRules market={market} />}
                </div>
              </div>

              {/* Comment Section */}
              <CommentSection marketId={market.id} />
            </div>

            {/* RIGHT — Trading panel + side cards */}
            <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
              {/* Order ticket */}
              <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-ring-strong">
                <div className="flex items-center justify-between border-b border-border px-4 py-1.5 bg-background/40">
                  <div className="flex gap-1 p-0.5">
                    <button
                      onClick={() => setIsSell(false)}
                      className={cn("px-3 py-1 text-[11px] font-bold uppercase rounded-md transition", !isSell ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => setIsSell(true)}
                      className={cn("px-3 py-1 text-[11px] font-bold uppercase rounded-md transition", isSell ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                    >
                      Sell
                    </button>
                  </div>
                  <span className={cn("badge-pill", wsStatus === 'open' ? "text-success" : "text-warning")}>
                    <Zap className={cn("h-3 w-3", wsStatus === 'open' ? "animate-pulse" : "")} /> {wsStatus === 'open' ? "Live" : "Sub-second"}
                  </span>
                </div>

                <div className="space-y-3.5 p-4">
                  {/* YES / NO toggle */}
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-background p-1 ring-1 ring-inset ring-border">
                    {(["YES", "NO"] as const).map((s) => {
                      const p = s === "YES" ? livePrice : 1 - livePrice;
                      const isActive = side === s;
                      const isYes = s === "YES";
                      return (
                        <button
                          key={s}
                          onClick={() => setSide(s)}
                          className={cn(
                            "group relative flex flex-col items-center gap-0.5 rounded-lg py-2 text-xs font-semibold transition-all",
                            isActive
                              ? isYes ? "bg-success/15 text-success shadow-button-inset" : "bg-destructive/15 text-destructive shadow-button-inset"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">{s}</span>
                          <span className="font-display text-lg tabular-nums">{(p * 100).toFixed(0)}¢</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Order type */}
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
                    {(["Market", "Limit", "Stop"] as OrderType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setOrderType(t)}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-xs font-medium transition",
                          orderType === t ? "bg-surface text-foreground shadow-button-inset" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {/* Amount */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Amount</label>
                      <span className="text-[11px] text-muted-foreground">
                        Balance <span className="font-mono text-foreground/80">2,480.00</span>
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 transition focus-within:border-border-strong">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-transparent font-display text-xl tabular-nums text-foreground focus:outline-none"
                      />
                      <span className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-[11px]">USDC</span>
                    </div>
                    <div className="mt-2 grid grid-cols-5 gap-1.5">
                      {[10, 50, 100, 500, 1000].map((v) => (
                        <button
                          key={v}
                          onClick={() => setAmount(v)}
                          className={cn(
                            "rounded-md border border-border bg-background py-1.5 text-[11px] font-medium transition",
                            amount === v ? "text-foreground bg-surface" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          ${v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Limit price */}
                  {orderType !== "Market" && (
                    <div>
                      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {orderType} price (¢)
                      </label>
                      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={limitPrice}
                          onChange={(e) => setLimitPrice(Math.min(99, Math.max(1, Number(e.target.value) || 1)))}
                          className="w-full bg-transparent font-display text-xl tabular-nums text-foreground focus:outline-none"
                        />
                        <span className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-[11px]">¢</span>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="space-y-2 rounded-lg border border-border bg-background p-3.5">
                    <Row k="Avg. fill" v={`${fillPrice.toFixed(3)} USDC`} />
                    <Row k="Shares" v={shares.toFixed(2)} />
                    <Row k="Protocol fee" v={`-$${fee.toFixed(2)}`} muted />
                    <div className="my-2 border-t border-border/60" />
                    <Row k="Potential payout" v={`$${potential.toFixed(2)}`} highlight />
                    <Row k="Profit if win" v={`+$${profit.toFixed(2)} · ${((profit / Math.max(1, amount)) * 100).toFixed(0)}%`} tone="success" />
                  </div>

                  {/* CTA */}
                  {market.status === 'resolved' ? (
                    <button
                      onClick={handleClaim}
                      disabled={isClaiming}
                      className="group relative w-full overflow-hidden rounded-xl bg-foreground py-3 text-sm font-semibold text-background shadow-button-inset transition-all active:scale-[0.99] disabled:opacity-50"
                    >
                      {isClaiming ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Claim Winnings"}
                    </button>
                  ) : (
                    <button
                      onClick={handleTrade}
                      disabled={isBuying}
                      className={cn(
                        "group relative w-full overflow-hidden rounded-xl py-3 text-sm font-semibold shadow-button-inset transition-all active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none",
                        isSell ? "bg-foreground text-background" : (side === "YES" ? "bg-success text-background hover:brightness-110" : "bg-destructive text-background hover:brightness-110"),
                      )}
                    >
                      <span className="relative z-10">
                        {isBuying ? "Executing..." : isSell ? `Sell ${side} · ${shares.toFixed(0)} shares` : `Buy ${side} · $${amount.toFixed(0)} → ${potential.toFixed(2)}`}
                      </span>
                      {!isBuying && <span className="absolute inset-0 -translate-x-full bg-white/10 transition-transform duration-700 group-hover:translate-x-0" />}
                    </button>
                  )}

                  <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-[11px] font-medium text-muted-foreground transition hover:text-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    Auto-route via <span className="font-mono text-foreground/90">Pulse agent</span>
                  </button>

                  <div className="flex items-start gap-2 rounded-lg bg-background/60 p-2.5 text-[10px] text-muted-foreground">
                    <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <span>
                      Idle USDC auto-routes to <span className="font-mono text-foreground/80">Kamino</span> earning
                      <span className="font-mono text-success"> +5.42% APY</span> until resolution.
                    </span>
                  </div>
                </div>
              </div>

              {/* Sub-predictions */}
              <div className="rounded-2xl border border-border bg-surface p-4 shadow-ring">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Related</div>
                  <Link to="/markets" className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    All <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-2.5">
                  {subMarkets.map((s) => (
                    <button
                      key={s.id}
                      className="group block w-full rounded-lg border border-border bg-background p-3 text-left transition hover:border-border-strong hover:bg-surface-hover"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-sm leading-snug">{s.label}</span>
                        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">{s.yes}¢</span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/60">
                        <div className="h-full bg-gradient-to-r from-foreground/40 to-foreground/80 transition-all" style={{ width: `${s.yes}%` }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                        <span>YES {s.yes}%</span>
                        <span>{formatUsd(s.vol)} vol</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Related markets */}
              <div className="rounded-2xl border border-border bg-surface p-4 shadow-ring">
                <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Related markets</div>
                <div className="space-y-2">
                  {(relatedData?.markets ?? []).filter((m) => m.id !== market.id).slice(0, 3).map((m) => (
                    <Link
                      key={m.id}
                      to={`/markets/${m.id}`}
                      className="group flex items-center justify-between gap-3 rounded-lg p-2 -mx-2 transition hover:bg-surface-hover"
                    >
                      <div className="min-w-0">
                        <div className="line-clamp-1 text-sm">{m.question}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{formatUsd(m.volume)} · {m.category}</div>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">{Math.round(m.yesPrice * 100)}¢</span>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

/* ============================== Polymarket-style Line Chart + Volume Bars ============================== */

function PolymarketChart({ pricePoints, live, range }: { pricePoints: ApiPricePoint[]; live: number; range: Range }) {
  const yesColor = "hsl(142 71% 45%)";
  const noColor = "hsl(0 84% 60%)";

  const filtered = filterPointsByRange(pricePoints, range);
  const chartData = useMemo(() => {
    const pts = filtered.length > 0 ? filtered : pricePoints.slice(-24);
    return pts.map((p, i) => {
      const prev = pts[i - 1];
      const delta = prev ? Math.abs(p.yesPrice - prev.yesPrice) : 0.008;
      const vol = Math.round(delta * 60000 + Math.random() * 4000 + 1500);
      return {
        yes: +(p.yesPrice * 100).toFixed(1),
        no: +((1 - p.yesPrice) * 100).toFixed(1),
        volume: vol,
        label: formatChartLabel(p.ts, range),
        ts: p.ts,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricePoints, range]);

  // Inject live price at the end
  const fullData = useMemo(() => {
    const liveYes = +(live * 100).toFixed(1);
    const liveNo = +(100 - liveYes).toFixed(1);
    if (!chartData.length) return [{ yes: liveYes, no: liveNo, volume: 2000, label: "Now", ts: new Date().toISOString() }];
    const copy = [...chartData];
    copy[copy.length - 1] = { ...copy[copy.length - 1], yes: liveYes, no: liveNo };
    return copy;
  }, [chartData, live]);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const yesVal = payload.find((p) => p.dataKey === "yes")?.value;
    const noVal = payload.find((p) => p.dataKey === "no")?.value;
    const volVal = payload.find((p) => p.dataKey === "volume")?.value;

    return (
      <div className="rounded-lg border border-border bg-background/95 px-3 py-2.5 shadow-ring backdrop-blur">
        <div className="font-mono text-[10px] text-muted-foreground mb-1">{label}</div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-success" />
              <span className="text-[11px] font-medium text-muted-foreground">YES</span>
            </div>
            <span className="font-display text-base font-semibold text-success tabular-nums">{yesVal?.toFixed(1)}¢</span>
          </div>
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
              <span className="text-[11px] font-medium text-muted-foreground">NO</span>
            </div>
            <span className="font-display text-base font-semibold text-destructive tabular-nums">{noVal?.toFixed(1)}¢</span>
          </div>
          {volVal && (
            <div className="mt-1 pt-1 border-t border-border/40 font-mono text-[10px] text-muted-foreground">
              Vol <span className="text-foreground/70">{(volVal / 1000).toFixed(1)}K</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-[340px] w-full flex-col">
      {/* Price chart — 78% */}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={fullData} margin={{ top: 16, right: 16, left: -8, bottom: 0 }} syncId="predchart">
            <defs>
              <linearGradient id="grad-yes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={yesColor} stopOpacity={0.15} />
                <stop offset="100%" stopColor={yesColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="grad-no" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={noColor} stopOpacity={0.15} />
                <stop offset="100%" stopColor={noColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 8" stroke="hsl(0 0% 100% / 0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(0 0% 56%)", fontFamily: "JetBrains Mono, monospace" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "hsl(0 0% 56%)", fontFamily: "JetBrains Mono, monospace" }}
              tickFormatter={(v: number) => `${v}¢`}
              axisLine={false}
              tickLine={false}
              width={36}
              ticks={[0, 25, 50, 75, 100]}
            />
            <ReferenceLine
              y={50}
              stroke="hsl(0 0% 100% / 0.10)"
              strokeDasharray="3 6"
              label={{ value: "50¢", position: "insideTopRight", fontSize: 9, fill: "hsl(0 0% 48%)", fontFamily: "JetBrains Mono" }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "hsl(0 0% 100% / 0.15)", strokeWidth: 1, strokeDasharray: "3 4" }}
            />
            <Area
              type="monotone"
              dataKey="yes"
              stroke={yesColor}
              strokeWidth={2}
              fill="url(#grad-yes)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: yesColor }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="no"
              stroke={noColor}
              strokeWidth={2}
              fill="url(#grad-no)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: noColor }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Volume bars — 22% */}
      <div className="h-[68px] border-t border-border/30">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={fullData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }} syncId="predchart">
            <defs>
              <linearGradient id="grad-vol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={yesColor} stopOpacity={0.4} />
                <stop offset="100%" stopColor={yesColor} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <YAxis hide domain={[0, "dataMax * 2.5"]} />
            <Tooltip content={() => null} cursor={{ fill: "hsl(0 0% 100% / 0.04)" }} />
            <Bar dataKey="volume" fill="url(#grad-vol)" radius={[1, 1, 0, 0]} isAnimationActive={false} maxBarSize={6}>
              {fullData.map((_, i) => (
                <Cell key={i} fill="url(#grad-vol)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ============================== Candle Chart ============================== */

function buildCandlesFromPoints(pts: ApiPricePoint[], live: number): Candle[] {
  const candles: Candle[] = pts.slice(1).map((curr, i) => {
    const prev = pts[i];
    const o = prev.yesPrice;
    const c = curr.yesPrice;
    // Lower artificial volatility since Y-axis is now auto-scaled
    const variance = Math.abs(c - o) * 0.2 + 0.002 + Math.random() * 0.002;
    const h = Math.min(0.99, Math.max(o, c) + Math.random() * variance);
    const l = Math.max(0.01, Math.min(o, c) - Math.random() * variance);
    return { o, h, l, c, close: c };
  });
  if (candles.length > 0) {
    candles[candles.length - 1] = { ...candles[candles.length - 1], c: live, close: live };
  }
  return candles;
}

function generateCandles(end: number, trend: number, range: Range): Candle[] {
  const N = range === "1H" ? 30 : range === "1D" ? 60 : range === "1W" ? 80 : 100;
  let v = Math.max(0.05, Math.min(0.95, end - trend * 0.35));
  const out: Candle[] = [];
  for (let i = 0; i < N; i++) {
    const o = v;
    v += (Math.random() - 0.5) * 0.045 + (end - v) * 0.05;
    v = Math.max(0.04, Math.min(0.96, v));
    const c = v;
    const h = Math.min(0.99, Math.max(o, c) + Math.random() * 0.02);
    const l = Math.max(0.01, Math.min(o, c) - Math.random() * 0.02);
    out.push({ o, h, l, c, close: c });
  }
  out[out.length - 1] = { ...out[out.length - 1], c: end, close: end };
  return out;
}

function CandleChart({ candles, live }: { candles: Candle[]; live: number }) {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  const H = 340, PAD = 20;
  const W = 1200 * zoom;
  const cw = (W - PAD * 2) / Math.max(1, candles.length);

  // Auto-scale Y-axis
  const minC = candles.length ? Math.min(...candles.map(c => c.l)) : live;
  const maxC = candles.length ? Math.max(...candles.map(c => c.h)) : live;
  const minP = Math.min(minC, live);
  const maxP = Math.max(maxC, live);

  let span = Math.max(0.02, maxP - minP);
  const domainMin = Math.max(0, minP - span * 0.15);
  const domainMax = Math.min(1, maxP + span * 0.15);
  span = domainMax - domainMin;

  const scaleY = (p: number) => PAD + (1 - (p - domainMin) / span) * (H - PAD * 2);
  const lastY = scaleY(live);

  // Dynamic grid lines
  const gridLines = [
    domainMin + span * 0.2,
    domainMin + span * 0.4,
    domainMin + span * 0.6,
    domainMin + span * 0.8,
  ];

  // Auto-scroll to the right edge whenever zoom or data changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [zoom, candles.length]);

  return (
    <div className="relative h-full w-full bg-background group">
      {/* Zoom Controls */}
      <div className="absolute right-4 top-4 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 rounded border border-border/50 bg-surface/80 p-1 backdrop-blur shadow">
        <button onClick={() => setZoom(z => Math.max(1, z - 0.5))} className="flex h-6 w-6 items-center justify-center rounded hover:bg-surface-hover text-muted-foreground transition">-</button>
        <span className="flex h-6 w-10 items-center justify-center text-[10px] font-mono text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(10, z + 0.5))} className="flex h-6 w-6 items-center justify-center rounded hover:bg-surface-hover text-muted-foreground transition">+</button>
      </div>

      <div ref={containerRef} className="h-full w-full overflow-x-auto overflow-y-hidden custom-scrollbar">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ minWidth: "100%", width: W, height: "100%" }}>
          {/* Grid */}
          {gridLines.map((yVal, idx) => (
            <line key={`gl-${idx}`} x1={PAD} x2={W - PAD} y1={scaleY(yVal)} y2={scaleY(yVal)} stroke="hsl(0 0% 100% / 0.05)" strokeDasharray="3 6" />
          ))}
          {/* Price labels (pinned to right edge area) */}
          {gridLines.map((yVal, idx) => (
            <text key={`gt-${idx}`} x={W - PAD - 2} y={scaleY(yVal) - 3} fontSize="9" fill="hsl(0 0% 48%)" textAnchor="end" fontFamily="JetBrains Mono">
              {Math.round(yVal * 100)}¢
            </text>
          ))}
          {/* Candles */}
          {candles.map((k, i) => {
            const x = PAD + i * cw + cw / 2;
            const yH = scaleY(k.h);
            const yL = scaleY(k.l);
            const yO = scaleY(k.o);
            const yC = scaleY(k.c);
            const up = k.c >= k.o;
            const color = up ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)";
            const bodyTop = Math.min(yO, yC);
            const bodyH = Math.max(4, Math.abs(yO - yC));
            const bw = Math.max(5, cw * 0.8);
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth="2" opacity="0.85" />
                <rect x={x - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} opacity={up ? 0.9 : 0.85} rx="1" />
              </g>
            );
          })}
          {/* Live price line */}
          <line x1={PAD} x2={W - PAD} y1={lastY} y2={lastY} stroke="hsl(0 0% 100% / 0.35)" strokeDasharray="3 4" />
          <rect x={W - PAD - 42} y={lastY - 10} width="40" height="20" fill="hsl(0 0% 100%)" rx="3" opacity="0.9" />
          <text x={W - PAD - 22} y={lastY + 4} fontSize="10" textAnchor="middle" fill="hsl(0 0% 0%)" fontFamily="JetBrains Mono" fontWeight="700">
            {(live * 100).toFixed(1)}¢
          </text>
        </svg>
      </div>
    </div>
  );
}

/* ============================== Backpack-style Orderbook with Flash ============================== */

function DepthBook({ side, rows, mid }: { side: Side; rows: OBRow[]; mid: number }) {
  const isYes = side === "YES";
  const max = rows.reduce((m, r) => Math.max(m, r.total), 0.001);
  const bgFill = isYes ? "hsl(142 71% 45% / 0.12)" : "hsl(0 84% 60% / 0.12)";
  const textColor = isYes ? "text-success" : "text-destructive";

  // Flash animation tracking
  const prevRowsRef = useRef<OBRow[]>([]);
  const [flashedRows, setFlashedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!prevRowsRef.current.length) {
      prevRowsRef.current = rows;
      return;
    }
    const changed = new Set<number>();
    rows.forEach((r, i) => {
      const prev = prevRowsRef.current[i];
      if (prev && (Math.abs(prev.size - r.size) > 10 || Math.abs(prev.price - r.price) > 0.0005)) {
        changed.add(i);
      }
    });
    prevRowsRef.current = rows;
    if (changed.size > 0) {
      setFlashedRows(changed);
      const t = setTimeout(() => setFlashedRows(new Set()), 550);
      return () => clearTimeout(t);
    }
  }, [rows]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-surface/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", isYes ? "bg-success" : "bg-destructive")} />
          <span className="text-xs font-semibold uppercase tracking-wider">{side}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>MID</span>
          <span className="text-foreground/80">{mid.toFixed(3)}</span>
          <span className="text-border">·</span>
          <span>{(mid * 100).toFixed(1)}¢</span>
        </div>
      </div>
      {/* Column headers */}
      <div className="grid grid-cols-3 px-4 py-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>
      {/* Rows */}
      <div className="divide-y divide-border/20">
        {rows.slice(0, 12).map((r, i) => {
          const pct = (r.total / max) * 100;
          const isFlashing = flashedRows.has(i);
          return (
            <div
              key={i}
              className={cn(
                "relative grid grid-cols-3 items-center px-4 py-[5px] font-mono text-[11px] transition-colors hover:bg-surface-hover/30",
                isFlashing && (isYes ? "animate-flash-green" : "animate-flash-red"),
              )}
            >
              {/* Depth fill bar */}
              <div
                className="absolute inset-y-0 right-0 transition-all duration-500"
                style={{ width: `${pct}%`, background: bgFill }}
              />
              <span className={cn("relative z-10 font-semibold", textColor)}>{r.price.toFixed(3)}</span>
              <span className="relative z-10 text-right tabular-nums text-foreground/80">
                {r.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="relative z-10 text-right tabular-nums text-muted-foreground">
                {r.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          );
        })}
      </div>
      {/* Footer */}
      <div className="border-t border-border/40 px-4 py-2 font-mono text-[10px] text-muted-foreground">
        Spread <span className="text-foreground/70">0.004</span> · Depth{" "}
        <span className="text-foreground/70">{max.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      </div>
    </div>
  );
}

function generateOrderbook(yesPrice: number) {
  const yes: OBRow[] = [], no: OBRow[] = [];
  let accY = 0, accN = 0;
  for (let i = 0; i < 15; i++) {
    const szY = Math.round(150 + Math.random() * 900);
    const szN = Math.round(150 + Math.random() * 900);
    accY += szY; accN += szN;
    yes.push({ price: Math.max(0.01, +(yesPrice - (i + 1) * 0.004).toFixed(4)), size: szY, total: accY });
    no.push({ price: Math.max(0.01, +(1 - yesPrice - (i + 1) * 0.004).toFixed(4)), size: szN, total: accN });
  }
  return { yes, no };
}

/* ============================== AI Agents Panel ============================== */

function AgentsPanel({ marketId, yesPrice }: { marketId: string; yesPrice: number }) {
  const { data } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.listAgents(),
    staleTime: 30_000,
  });

  const agents = (data?.agents ?? []).filter((a) => a.status === "live").slice(0, 5);

  const agentSentiments: Record<string, { view: string; confidence: number; action: string }> = useMemo(() => {
    const out: Record<string, { view: string; confidence: number; action: string }> = {};
    agents.forEach((a) => {
      const yesBias = Math.random() > 0.42;
      const conf = 55 + Math.random() * 40;
      out[a.id] = {
        view: yesBias ? "YES" : "NO",
        confidence: +conf.toFixed(1),
        action: conf > 75
          ? (yesBias ? "Bought YES" : "Bought NO")
          : conf > 60
            ? "Monitoring"
            : "Idle",
      };
    });
    return out;
  }, [agents.map((a) => a.id).join(",")]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Active AI agents</div>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 font-mono text-[10px] text-success">
          <span className="h-1 w-1 rounded-full bg-success animate-pulse-soft" />
          {agents.length} live
        </span>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          <Bot className="mx-auto mb-2 h-6 w-6" />
          No agents monitoring this market yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {agents.map((a) => {
            const sent = agentSentiments[a.id];
            if (!sent) return null;
            return (
              <div key={a.id} className="rounded-xl border border-border bg-background p-4 transition hover:bg-surface-hover/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{a.name}</span>
                        <span className="rounded-full bg-success/10 px-1.5 py-0.5 font-mono text-[9px] text-success uppercase">{a.type}</span>
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{a.handle}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn("block rounded-md px-2 py-0.5 text-[11px] font-bold uppercase text-center", sent.view === "YES" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                      {sent.view}
                    </span>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">{sent.confidence.toFixed(0)}%</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-muted-foreground">{sent.action}</span>
                  <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
                    <span>Win {a.winRate.toFixed(0)}%</span>
                    <span className={cn(a.pnl30d >= 0 ? "text-success" : "text-destructive")}>
                      {a.pnl30d >= 0 ? "+" : ""}{a.pnl30d.toFixed(1)}% 30d
                    </span>
                  </div>
                </div>
                {/* Confidence bar */}
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/40">
                  <div
                    className={cn("h-full rounded-full transition-all", sent.view === "YES" ? "bg-success" : "bg-destructive")}
                    style={{ width: `${sent.confidence}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-border p-4 text-center">
        <Brain className="mx-auto h-5 w-5 text-muted-foreground" />
        <div className="mt-2 text-sm font-display">Let an agent trade this market</div>
        <p className="mt-1 text-xs text-muted-foreground">Subscribe in 1 click. Performance fee only. Funds secured via Squads multisig.</p>
        <Link to="/agents" className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-foreground px-3.5 py-2 text-xs font-semibold text-background shadow-button-inset hover:opacity-90">
          Browse agents <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

/* ============================== Supporting components ============================== */

function ActionIcon({ icon: Icon, label, active, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground hover:bg-background/70",
        active && "text-foreground",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", active && "fill-current")} />
    </button>
  );
}

function ChartTab({ icon: Icon, active, onClick, label }: {
  icon: React.ComponentType<{ className?: string }>;
  active: boolean; onClick: () => void; label: string;
}) {
  return (
    <button onClick={onClick} title={label} className={cn("inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition", active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function PriceTickPill({ dir, value }: { dir: "up" | "down" | "flat"; value: number }) {
  const positive = value >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] transition-colors", positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive", dir === "up" && "ring-1 ring-success/40", dir === "down" && "ring-1 ring-destructive/40")}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {(value * 100).toFixed(2)}%
    </span>
  );
}

function Row({ k, v, highlight, muted, tone }: { k: string; v: string; highlight?: boolean; muted?: boolean; tone?: "success" | "destructive" }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-muted-foreground">{k}</span>
      <span className={cn("font-mono text-sm tabular-nums", highlight ? "text-foreground font-semibold" : "text-foreground/90", muted && "text-muted-foreground", tone === "success" && "text-success", tone === "destructive" && "text-destructive")}>
        {v}
      </span>
    </div>
  );
}

/* ============================== Activity / Holders / Sub-markets / Rules ============================== */

function buildSubMarkets(yesPrice: number, volume: number) {
  const base = Math.round(yesPrice * 100);
  return [
    { id: "s1", label: `Above ${(base + 8)}¢ within 24h`, yes: Math.max(5, base - 18), vol: volume * 0.21 },
    { id: "s2", label: `Resolves YES before deadline`, yes: Math.min(95, base + 6), vol: volume * 0.34 },
    { id: "s3", label: `Daily candle closes green tomorrow`, yes: 47, vol: volume * 0.11 },
    { id: "s4", label: `Volume crosses ${formatUsd(volume * 1.5)} this week`, yes: 28, vol: volume * 0.08 },
  ];
}

type ActivityRow = { id: number; who: string; isAgent: boolean; side: Side; isBuy: boolean; amount: number; price: number; time: string };

function generateActivity(yesPrice: number): ActivityRow[] {
  const names = ["pulse.sol", "arc.agent", "0x4f...92e", "anchor.dao", "drift.bot", "wire.alpha", "0x88...c1a", "lattice.ai"];
  return Array.from({ length: 14 }, (_, i) => {
    const side: Side = Math.random() > 0.5 ? "YES" : "NO";
    const price = side === "YES" ? yesPrice : 1 - yesPrice;
    return {
      id: i, who: names[i % names.length], isAgent: i % 3 === 0,
      side, isBuy: Math.random() > 0.35, amount: Math.floor(20 + Math.random() * 4800),
      price: Math.min(0.99, Math.max(0.01, price + (Math.random() - 0.5) * 0.04)),
      time: `${Math.floor(Math.random() * 59) + 1}s ago`,
    };
  });
}

function ActivityFeed({ trades }: { trades: ApiTrade[] }) {
  if (!trades.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="h-8 w-8 text-muted-foreground/30" />
        <p className="mt-2 text-sm text-muted-foreground">No trades yet. Be the first!</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[1fr_90px_100px_90px_70px] gap-2 border-b border-border bg-background px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Trader</span><span>Side</span><span className="text-right">Shares</span><span className="text-right">Price</span><span className="text-right">Time</span>
      </div>
      <div className="divide-y divide-border">
        {trades.map((t) => (
          <div key={t.id} className="grid grid-cols-[1fr_90px_100px_90px_70px] items-center gap-2 px-4 py-2.5 text-xs transition hover:bg-surface-hover/50">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.isAgent ? "bg-sol-purple" : "bg-foreground/60")} />
              <span className="truncate font-mono text-foreground/90">
                {t.handle || (t.wallet ? `${t.wallet.slice(0, 4)}...${t.wallet.slice(-4)}` : "anon")}
              </span>
              {t.isAgent && <span className="shrink-0 rounded border border-border px-1 py-0 font-mono text-[9px] uppercase text-muted-foreground">AI</span>}
            </div>
            <span className={cn("rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold uppercase", t.side === "YES" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
              {t.kind === 'market' ? 'BUY' : t.kind.toUpperCase()} {t.side}
            </span>
            <span className="text-right font-mono tabular-nums text-foreground/90">{Math.round(t.shares).toLocaleString()}</span>
            <span className="text-right font-mono tabular-nums">{t.price.toFixed(3)}</span>
            <span className="text-right font-mono text-muted-foreground">{timeUntil(t.createdAt, true)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function generateHolders(yesPrice: number) {
  return Array.from({ length: 8 }, (_, i) => {
    const yes = Math.random() > 0.4;
    const shares = Math.floor(800 + Math.random() * 24000);
    return {
      id: i,
      addr: `${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 5)}`,
      isAgent: i < 3,
      side: yes ? "YES" : "NO",
      shares,
      avgPrice: yes ? yesPrice + (Math.random() - 0.5) * 0.1 : 1 - yesPrice + (Math.random() - 0.5) * 0.1,
      pnl: (Math.random() - 0.4) * 12,
    };
  }).sort((a, b) => b.shares - a.shares);
}

function HoldersList({ rows }: { rows: ReturnType<typeof generateHolders> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[40px_1fr_70px_110px_90px_80px] gap-2 border-b border-border bg-background px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>#</span><span>Address</span><span>Side</span><span className="text-right">Shares</span><span className="text-right">Avg.</span><span className="text-right">P&L</span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((r, i) => (
          <div key={r.id} className="grid grid-cols-[40px_1fr_70px_110px_90px_80px] items-center gap-2 px-4 py-2.5 text-xs transition hover:bg-surface-hover/50">
            <span className="font-mono text-muted-foreground">{i + 1}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-foreground/90">{r.addr}</span>
              {r.isAgent && <span className="rounded border border-border px-1 py-0 font-mono text-[9px] uppercase text-muted-foreground">AI</span>}
            </div>
            <span className={cn("rounded px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold", r.side === "YES" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>{r.side}</span>
            <span className="text-right font-mono tabular-nums">{r.shares.toLocaleString()}</span>
            <span className="text-right font-mono tabular-nums text-muted-foreground">{r.avgPrice.toFixed(3)}</span>
            <span className={cn("text-right font-mono tabular-nums", r.pnl >= 0 ? "text-success" : "text-destructive")}>
              {r.pnl >= 0 ? "+" : ""}{r.pnl.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResolutionRules({ market }: { market: ApiMarket }) {
  const res = market.oracleResolution;

  return (
    <div className="space-y-6">
      {res ? (
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-success" />
              <h4 className="font-display text-base">Oracle Resolution Details</h4>
            </div>
            <span className="badge-pill bg-success/10 text-success uppercase">
              {res.outcome} confirmed
            </span>
          </div>
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {res.reasoning}
            </p>
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Consensus</div>
                <div className="mt-1 font-mono text-sm">{res.consensus} of {res.totalVotes} Agents</div>
              </div>
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Confidence</div>
                <div className="mt-1 font-mono text-sm">{(res.averageConfidence ?? 0).toFixed(1)}% avg</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-foreground/90">
          This market resolves <strong className="text-foreground">YES</strong> if the criteria as described in the question are
          satisfied. Resolution source: <span className="font-mono text-foreground">{market.resolution}</span>.
          {market.description && ` ${market.description}`}
          {" "}Disputes may be opened within 48 hours by staking PREDICT tokens.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { icon: ShieldCheck, t: "Trustless", d: "On-chain oracle attests outcome cryptographically." },
          { icon: Zap, t: "Sub-second", d: "Auto-resolution settles within a single Solana slot." },
          { icon: Users, t: "DAO Override", d: "Stake PREDICT to dispute within 48h post-resolution." },
        ].map((c) => (
          <div key={c.t} className="rounded-lg border border-border bg-background p-4">
            <c.icon className="h-4 w-4 text-foreground" />
            <div className="mt-2 text-sm font-semibold">{c.t}</div>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.d}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <div>
            <div className="text-sm">Audited by <span className="font-mono">Ottersec</span> & <span className="font-mono">Neodyme</span></div>
            <div className="text-[11px] text-muted-foreground">Last audit · April 2026</div>
          </div>
        </div>
        <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          View report <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/* ============================== Comment Section ============================== */

function CommentSection({ marketId }: { marketId: string }) {
  const { address, connected } = useHelioraWallet();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["comments", marketId],
    queryFn: () => api.getComments(marketId),
    enabled: !!marketId,
    refetchInterval: 10000,
  });

  const postMutation = useMutation({
    mutationFn: (text: string) =>
      api.postComment(marketId, {
        text,
        wallet: address ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", marketId] });
      setNewComment("");
    },
  });

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || postMutation.isPending) return;
    postMutation.mutate(newComment.trim());
  };

  const comments = data?.comments ?? [];

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-ring">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <h3 className="font-display text-lg">Discussion</h3>
        <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {isLoading ? "..." : comments.length}
        </span>
      </div>
      <div className="p-5">
        <form onSubmit={handlePost} className="mb-6 flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background">
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 space-y-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={connected ? "What are your thoughts on this market?" : "Connect wallet to comment"}
              disabled={!connected || postMutation.isPending}
              className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-1 focus:ring-foreground/30 disabled:opacity-50"
              rows={2}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newComment.trim() || !connected || postMutation.isPending}
                className="rounded-md bg-foreground px-4 py-2 text-xs font-semibold text-background shadow transition hover:opacity-90 disabled:opacity-50"
              >
                {postMutation.isPending ? "Posting..." : "Post Comment"}
              </button>
            </div>
          </div>
        </form>

        <div className="space-y-5">
          {isLoading && comments.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">Loading discussion...</div>
          )}
          {!isLoading && comments.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">No comments yet. Be the first to join the discussion!</div>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                {c.isAgent ? <Bot className="h-4 w-4 text-foreground" /> : <Users className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground/90">
                    {c.wallet ? `${c.wallet.slice(0, 4)}...${c.wallet.slice(-4)}` : "anon"}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
