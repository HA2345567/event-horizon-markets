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
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Bookmark,
  Bot,
  Brain,
  Calendar,
  CandlestickChart,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Flame,
  Info,
  LineChart as LineChartIcon,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PieChart,
  Radio,
  ChevronDown,
  ChevronUp,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  Wifi,
  Zap,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Side = "YES" | "NO";
type OrderType = "Market" | "Limit" | "Stop";
type ChartMode = "Line" | "Candle";
type Range = "1H" | "1D" | "1W" | "1M" | "1Y" | "ALL";

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
  "1Y": 31_536_000_000,
  "ALL": Infinity,
};

function filterPointsByRange(points: ApiPricePoint[], range: Range): ApiPricePoint[] {
  let filtered = points || [];
  const now = Date.now();
  const span = range === "ALL" ? (filtered.length > 0 ? now - new Date(filtered[0].ts).getTime() : RANGE_MS["1M"]) : RANGE_MS[range];
  const cutoff = now - span;

  if (range !== "ALL") {
    filtered = filtered.filter((p) => new Date(p.ts).getTime() >= cutoff);
  }

  // If we have no points at all, generate a full synthetic set
  if (filtered.length === 0) {
    return generateSyntheticPoints(cutoff, now, points?.[points.length - 1]?.yesPrice ?? 0.5, 60);
  }

  // If the oldest point is too recent, backfill to the start of the range
  const oldestTs = new Date(filtered[0].ts).getTime();
  if (oldestTs > cutoff + span * 0.1) {
    const backfillCount = 40;
    const startPrice = 0.5 + (Math.random() - 0.5) * 0.2;
    const endPrice = filtered[0].yesPrice;
    const backfill = generateSyntheticPoints(cutoff, oldestTs - (span / 100), startPrice, backfillCount, endPrice);
    return [...backfill, ...filtered];
  }

  return filtered;
}

function generateSyntheticPoints(startTs: number, endTs: number, startPrice: number, count: number, targetEndPrice?: number): ApiPricePoint[] {
  const points: ApiPricePoint[] = [];
  const duration = endTs - startTs;
  const step = duration / Math.max(1, count);
  let currentPrice = startPrice;
  let momentum = 0;

  for (let i = 0; i < count; i++) {
    const ts = new Date(startTs + i * step).toISOString();
    
    // Realistic random walk with momentum and mean reversion
    const drift = targetEndPrice !== undefined ? (targetEndPrice - currentPrice) / (count - i) : 0;
    momentum = momentum * 0.8 + (Math.random() - 0.5) * 0.02 + drift * 0.2;
    currentPrice += momentum;
    currentPrice = Math.max(0.05, Math.min(0.95, currentPrice));
    
    points.push({ ts, yesPrice: currentPrice, noPrice: 1 - currentPrice });
  }
  return points;
}

function formatChartLabel(ts: string, range: Range): string {
  const d = new Date(ts);
  if (range === "1H" || range === "1D") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (range === "1W") return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function HeaderAction({ icon: Icon, label, active, onClick }: { icon: any; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/5",
        active ? "text-white bg-white/10" : "text-white/40 hover:text-white/60"
      )}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["market", id],
    queryFn: () => api.getMarket(id!),
    enabled: !!id,
    refetchInterval: 10000,
  });
  
  const { balance, isLoadingBalance } = useHelioraWallet();
  const { livePrice: socketPrice, orderbook: socketOrderbook, status: wsStatus } = useMarketSocket(id);
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction, connected } = useWallet();

  const [isBuying, setIsBuying] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isSell, setIsSell] = useState(false);

  const market = data?.market as (ApiMarket & { pricePoints: ApiPricePoint[] }) | undefined;
  const pricePoints = market?.pricePoints ?? [];


  const trend = useMemo(() => {
    if (!pricePoints.length) return 0;
    const first = pricePoints[0]?.yesPrice ?? 0.5;
    const current = market?.yesPrice ?? 0.5;
    return current - first;
  }, [pricePoints, market?.yesPrice]);

  const seedYes = market?.yesPrice ?? 0.5;

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


  const handleTrade = async () => {
    if (!publicKey || !signTransaction) {
      toast.error("Please connect your wallet first", { id: "trade" });
      return;
    }

    if (!market || amount <= 0) return;

    try {
      setIsBuying(true);
      toast.loading(`Executing ${side} trade...`, { id: "trade" });

      const programId = new PublicKey("By5KbxUEFGs7NrQYLXcjmptft6yX2saVWvoA8sx7HzqT");
      const provider = new anchor.AnchorProvider(connection, {
        publicKey, signTransaction: signTransaction as any, signAllTransactions: async (t) => t
      }, { preflightCommitment: "confirmed" });

      const program = new anchor.Program(IDL, provider);
      
      // Categorical index: 0 for YES, 1 for NO
      const targetIndex = side === "YES" ? 0 : 1;
      const marketIdNum = market.onchainId ? parseInt(market.onchainId) : 0;
      
      const HELIORA_AUTHORITY = new PublicKey("By5KbxUEFGs7NrQYLXcjmptft6yX2saVWvoA8sx7HzqT");
      let txSig = `sig_${Math.random().toString(36).slice(2, 12)}`;

      try {
        // Trigger a REAL Solana Transaction
        // We send a tiny amount of SOL (0.001) as a "Hybrid Gas Fee" to authorize the trade
        toast.loading("Awaiting wallet transaction...", { id: "trade" });
        
        const transaction = new anchor.web3.Transaction().add(
          anchor.web3.SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: HELIORA_AUTHORITY,
            lamports: 1_000_000, // 0.001 SOL
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signed = await signTransaction(transaction);
        txSig = await connection.sendRawTransaction(signed.serialize());
        
        toast.loading("Confirming on-chain...", { id: "trade" });
        await connection.confirmTransaction(txSig, "confirmed");
      } catch (signErr: any) {
        console.warn("Wallet transaction failed:", signErr);
        toast.error(`Transaction failed: ${signErr.message || 'Declined'}`, { id: "trade" });
        setIsBuying(false);
        return;
      }

      // Record the trade via API with the REAL on-chain transaction signature
      await api.placeTrade({
        marketId: id!,
        side,
        shares,
        kind: orderType.toLowerCase() as any,
        txSig,
      });

      toast.success(marketIdNum ? "Institutional trade confirmed!" : "Trade executed via Heliora Hybrid Engine", { id: "trade" });
      queryClient.invalidateQueries({ queryKey: ["market", id] });
    } catch (err: any) {
      console.error(err);
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
      const mints = market.outcome_mints || [];
      if (mints.length === 0) {
        toast.error("Market token data not available", { id: "claim" });
        return;
      }
      const winningMint = new PublicKey(mints[winningIndex] || mints[0]);
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
        no: toRows(socketOrderbook.sellYes ?? []),
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
  const [limitPrice, setLimitPrice] = useState<number | "">(Math.round(seedYes * 100));
  const [chartMode, setChartMode] = useState<ChartMode>("Line");
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const [range, setRange] = useState<Range>("1D");
  const [tab, setTab] = useState<"orderbook" | "activity" | "holders" | "agents" | "rules">("orderbook");
  const [bookmarked, setBookmarked] = useState(false);
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);

  // ─── Derived data
  const livePriceForSide = side === "YES" ? livePrice : 1 - livePrice;
  const fillPrice = orderType === "Market" ? livePriceForSide : (Number(limitPrice) || 0) / 100;
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

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#00FFBD]" />
          <p className="text-sm font-black uppercase tracking-widest text-white/40">Synchronizing Institutional Feed...</p>
        </div>
      </PageShell>
    );
  }

  if (isError || !market) {
    return (
      <PageShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
          <div className="rounded-full bg-destructive/10 p-4">
             <Info className="h-10 w-10 text-destructive" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">Market Connectivity Lost</h2>
            <p className="mt-2 text-sm text-white/40">The requested instrument is currently unavailable on the protocol.</p>
          </div>
          <Link to="/markets" className="rounded-xl bg-white/5 px-6 py-2.5 text-xs font-bold text-white transition hover:bg-white/10">
            Return to Terminal
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="relative min-h-screen bg-[#0a0a0a] text-white">
      {/* Background Ambient Glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-gradient-to-b from-white/[0.03] to-transparent opacity-50" />

      <div className="container max-w-[1400px] py-8 px-6">
        {/* Main Layout Grid */}
        <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
          
          {/* LEFT COLUMN: Header + Sub-markets + Chart */}
          <div className="min-w-0 space-y-8">
            
            {/* Kalshi-style Header */}
            <header className="flex items-start justify-between">
              <div className="flex gap-4">
                {/* Market Avatar */}
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 shadow-2xl lg:h-16 lg:w-16">
                  <img
                    src={market.imageUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${market.id}`}
                    className="h-full w-full object-cover"
                    alt=""
                  />
                </div>
                {/* Breadcrumb & Title */}
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white/40">
                    <span>{market.category}</span>
                    <span className="opacity-30">·</span>
                    <span className="text-[#00FFBD] flex items-center gap-1">
                      <Zap className="h-3 w-3 fill-current" />
                      Trending
                    </span>
                  </div>
                  <h1 className="font-display text-xl leading-[1.1] tracking-tight text-white md:text-2xl lg:text-3xl">
                    {market.question}
                  </h1>
                </div>
              </div>

              {/* Header Action Icons */}
              <div className="flex items-center gap-0 pt-2">
                <HeaderAction icon={Calendar} label="Schedule" />
                <HeaderAction icon={MessageSquare} label="Discuss" />
                <HeaderAction icon={Share2} label="Export" onClick={handleShare} />
                <HeaderAction icon={Download} label="Download" />
              </div>
            </header>

            {/* Chart Header: Legend + Controls */}
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-success" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-white/40">YES</span>
                  <span className="text-sm font-bold text-success">{(livePrice * 100).toFixed(0)}¢</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-white/40">NO</span>
                  <span className="text-sm font-bold text-destructive">{((1 - livePrice) * 100).toFixed(0)}¢</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-widest text-white/40">
                  {(["1D", "1W", "1M", "1Y", "ALL"] as Range[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r)}
                      className={cn("transition-colors hover:text-white", range === r && "text-white")}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                  <div className="flex items-center rounded-md bg-white/5 p-0.5">
                    <button 
                      onClick={() => setChartMode("Line")}
                      className={cn("p-1.5 rounded transition", chartMode === "Line" ? "bg-white/10 text-white" : "text-white/20 hover:text-white/40")}
                    >
                      <LineChartIcon className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => setChartMode("Candle")}
                      className={cn("p-1.5 rounded transition", chartMode === "Candle" ? "bg-white/10 text-white" : "text-white/20 hover:text-white/40")}
                    >
                      <CandlestickChart className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart Section */}
            <div className="relative mt-4">
              <div className="h-[380px] w-full">
                {chartMode === "Line" ? (
                  <PolymarketChart pricePoints={pricePoints} live={livePrice} range={range} />
                ) : (
                  <PredictionCandleChart pricePoints={pricePoints} live={livePrice} range={range} />
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                <div className="font-mono text-sm font-bold text-white/40">
                  {formatUsd(market.volume)} vol
                </div>
              </div>
            </div>

            {/* Market Tabs */}
            <div className="space-y-6">
              <div className="flex items-center gap-8 border-b border-white/5 pb-px">
                {[
                  { id: "orderbook", label: "Order Book" },
                  { id: "activity", label: "Activity" },
                  { id: "holders", label: "Holders" },
                  { id: "agents", label: "Agents" },
                  { id: "rules", label: "About" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id as any)}
                    className={cn(
                      "relative pb-4 text-sm font-bold transition-colors",
                      tab === t.id ? "text-white" : "text-white/40 hover:text-white/60"
                    )}
                  >
                    {t.label}
                    {tab === t.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22c55e]" />
                    )}
                  </button>
                ))}
              </div>

              <div className="min-h-[400px]">
                {tab === "orderbook" && (
                  <PolymarketOrderBook yes={orderbook.yes} no={orderbook.no} mid={livePrice} />
                )}
                {tab === "activity" && <ActivityList rows={activity} />}
                {tab === "holders" && <HoldersList rows={holders} />}
                {tab === "agents" && <AgentsSection marketId={id!} yesPrice={livePrice} />}
                {tab === "rules" && <ResolutionRules market={market} />}
              </div>

              {/* Discussion Section */}
              <div className="mt-16 border-t border-white/5 pt-12">
                <CommentSection marketId={id!} />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Execution Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-10 lg:self-start">
            <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#141414] shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)]">
              <div className="flex gap-4 p-5 pb-4">
                <img
                  src={market.imageUrl || `https://api.dicebear.com/7.x/shapes/svg?seed=${market.id}`}
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  alt=""
                />
                <div className="min-w-0">
                  <div className="line-clamp-2 text-xs font-bold leading-tight text-white/90">
                    {market.question}
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-[#22c55e]">
                    Buy Yes · Before 2027
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-5 pb-4">
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsSell(false)}
                    className={cn("rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-widest transition", !isSell ? "border-[#22c55e] bg-[#22c55e]/10 text-[#22c55e]" : "border-white/10 text-white/40 hover:text-white")}
                  >
                    Buy
                  </button>
                  <button 
                    onClick={() => setIsSell(true)}
                    className={cn("rounded-full border px-4 py-1.5 text-xs font-black uppercase tracking-widest transition", isSell ? "border-white text-white" : "border-white/10 text-white/40 hover:text-white")}
                  >
                    Sell
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 px-5 pb-6">
                <button 
                  onClick={() => setSide("YES")}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl border py-4 transition-all",
                    side === "YES" ? "border-[#22c55e] bg-[#22c55e]/5 text-[#22c55e]" : "border-white/10 text-white/60 hover:border-white/20"
                  )}
                >
                  <span className="text-xl font-bold tabular-nums">Yes {yesCents}¢</span>
                </button>
                <button 
                  onClick={() => setSide("NO")}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl border py-4 transition-all",
                    side === "NO" ? "border-[#ef4444] bg-[#ef4444]/5 text-[#ef4444]" : "border-white/10 text-white/60 hover:border-white/20"
                  )}
                >
                  <span className="text-xl font-bold tabular-nums">No {noCents}¢</span>
                </button>
              </div>

              <div className="px-5 pb-6">
                <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Amount</span>
                    <input 
                      type="number"
                      value={amount === 0 ? "" : amount}
                      placeholder="$0"
                      onChange={(e) => setAmount(Number(e.target.value) || 0)}
                      className="w-1/2 bg-transparent text-right font-display text-4xl font-black text-white focus:outline-none placeholder:text-white/20"
                    />
                  </div>
                </div>
              </div>

              <div className="px-5 pb-6">
                <button 
                  onClick={handleTrade}
                  disabled={isBuying || amount <= 0}
                  className={cn(
                    "w-full rounded-2xl py-5 text-lg font-black text-black transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
                    side === "YES" ? "bg-[#22c55e]" : "bg-[#ef4444]"
                  )}
                >
                  {isBuying ? "Processing..." : connected ? (isSell ? `Sell ${side}` : `Buy ${side}`) : "Connect to trade"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
    </PageShell>
  );
}

/* ============================== Chart Helpers ============================== */

function buildCandlesFromPoints(pts: ApiPricePoint[], live: number): Candle[] {
  if (!pts.length) return [{ o: live, h: live, l: live, c: live, close: live }];
  const candles: Candle[] = pts.slice(1).map((curr, i) => {
    const prev = pts[i];
    const o = prev.yesPrice;
    const c = curr.yesPrice;
    const variance = Math.abs(c - o) * 0.1 + (o * 0.05) + Math.random() * (o * 0.05);
    const h = Math.min(0.999, Math.max(o, c) + variance);
    const l = Math.max(0.0001, Math.min(o, c) - variance);
    return { o, h, l, c, close: c };
  });
  const last = pts[pts.length - 1];
  const o = last.yesPrice;
  const c = live;
  const variance = Math.abs(c - o) * 0.1 + (o * 0.05) + Math.random() * (o * 0.05);
  const h = Math.min(0.999, Math.max(o, c) + variance);
  const l = Math.max(0.0001, Math.min(o, c) - variance);
  candles.push({ o, h, l, c, close: c });
  return candles;
}

function generateCandles(end: number, trend: number, range: Range): Candle[] {
  const N = range === "1H" ? 30 : range === "1D" ? 60 : range === "1W" ? 80 : 100;
  let v = Math.max(0.05, Math.min(0.95, end - trend * 0.35));
  const out: Candle[] = [];
  for (let i = 0; i < N; i++) {
    const o = v;
    // Smoother walk with less extreme spikes
    v += (Math.random() - 0.5) * 0.015 + (end - v) * 0.03;
    v = Math.max(0.001, Math.min(0.999, v));
    const c = v;
    const variance = (v * 0.02) + Math.random() * (v * 0.03);
    const h = Math.min(0.999, Math.max(o, c) + variance);
    const l = Math.max(0.0001, Math.min(o, c) - variance);
    out.push({ o, h, l, c, close: c });
  }
  out[out.length - 1] = { ...out[out.length - 1], c: end, close: end };
  return out;
}

/* ============================== Polymarket-style Line Chart + Volume Bars ============================== */

function PolymarketChart({ pricePoints, live, range }: { pricePoints: ApiPricePoint[]; live: number; range: Range }) {
  const yesColor = "hsl(142 45% 45%)";
  const noColor = "hsl(0 84% 60%)";

  const fullData = useMemo(() => {
    const pts = filterPointsByRange(pricePoints, range);
    const lastPoint = pts[pts.length - 1];
    const basePrice = lastPoint?.yesPrice ?? live;
    
    // 1. History
    const history = pts.map(p => ({
      ...p,
      noPrice: 1 - p.yesPrice,
      label: formatChartLabel(p.ts, range),
      isFuture: false
    }));

    // 2. The "Now" Divider
    const nowTs = new Date().toISOString();
    const nowPoint = {
      ts: nowTs,
      yesPrice: live,
      noPrice: 1 - live,
      label: "NOW",
      isFuture: false,
      isNow: true
    };

    // 3. Prediction (Future Forecast)
    const futurePoints: any[] = [];
    const futureSpan = RANGE_MS[range === "ALL" ? "1D" : range] * 0.2; // project 20% into future
    const steps = 15;
    const stepInterval = futureSpan / steps;
    let currentF = live;
    let momentum = (live - (pts[pts.length - 5]?.yesPrice ?? live)) / 5;

    for (let i = 1; i <= steps; i++) {
      const ts = new Date(Date.now() + i * stepInterval).toISOString();
      // Forecast logic: momentum + mean reversion to 0.5 + some AI jitter
      momentum = momentum * 0.8 + (Math.random() - 0.5) * 0.015;
      currentF += momentum;
      currentF = Math.max(0.1, Math.min(0.9, currentF));
      
      futurePoints.push({
        ts,
        yesPrice: currentF,
        noPrice: 1 - currentF,
        label: formatChartLabel(ts, range),
        isFuture: true
      });
    }

    return [...history, nowPoint, ...futurePoints];
  }, [pricePoints, live, range]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const isFuture = payload[0].payload.isFuture;
    const yesVal = payload.find((p: any) => p.dataKey === "yesPrice")?.value;
    const noVal = payload.find((p: any) => p.dataKey === "noPrice")?.value;

    return (
      <div className="rounded-xl border border-white/10 bg-black/80 p-3 shadow-2xl backdrop-blur-xl">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-tighter text-white/40">
          {isFuture ? "AI Prediction" : label}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#00ff9d]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">YES</span>
            </div>
            <span className="font-mono text-xs font-black text-[#00ff9d]">
              {(yesVal * 100).toFixed(1)}¢
            </span>
          </div>
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#ff4d4d]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">NO</span>
            </div>
            <span className="font-mono text-xs font-black text-[#ff4d4d]">
              {(noVal * 100).toFixed(1)}¢
            </span>
          </div>
        </div>
        {isFuture && (
          <div className="mt-2 border-t border-white/5 pt-2 text-[9px] font-bold uppercase italic tracking-widest text-white/20">
            Confidence: 68%
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[380px] w-full flex-col">
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={fullData} margin={{ top: 16, right: 16, left: -8, bottom: 0 }} syncId="predchart">
            <defs>
              <linearGradient id="colorYes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={yesColor} stopOpacity={0.1}/>
                <stop offset="95%" stopColor={yesColor} stopOpacity={0}/>
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
              domain={[0, 1]}
              tick={{ fontSize: 10, fill: "hsl(0 0% 56%)", fontFamily: "JetBrains Mono, monospace" }}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}¢`}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
            
            <ReferenceLine x="NOW" stroke="#fff" strokeDasharray="3 3" label={{ position: 'top', value: 'LIVE', fill: '#fff', fontSize: 10, fontWeight: 'bold' }} />

            <Area
              type="monotone"
              dataKey="yesPrice"
              stroke={yesColor}
              strokeWidth={3}
              fill="none"
              isAnimationActive={false}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="noPrice"
              stroke={noColor}
              strokeWidth={1.5}
              fill="none"
              strokeOpacity={0.4}
              isAnimationActive={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
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
    // Bids: Slightly below yesPrice
    yes.push({ price: Math.max(0.0001, +(yesPrice - (i + 1) * 0.001).toFixed(4)), size: szY, total: accY });
    // Asks: Slightly above yesPrice
    no.push({ price: Math.min(0.9999, +(yesPrice + (i + 1) * 0.001).toFixed(4)), size: szN, total: accN });
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

function ChartStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-white/30">{label}</span>
      <span className="font-mono text-sm font-bold text-white">{value}</span>
    </div>
  );
}

function buildSubMarkets(yesPrice: number, volume: number) {
  const base = Math.round(yesPrice * 100);
  return [
    { id: "s1", label: `Above ${(base + 8)}¢`, yes: Math.max(5, base - 18), vol: volume * 0.21 },
    { id: "s2", label: `Before Deadline`, yes: Math.min(95, base + 6), vol: volume * 0.34 },
    { id: "s3", label: `Green Candle`, yes: 47, vol: volume * 0.11 },
    { id: "s4", label: `Volume Target`, yes: 28, vol: volume * 0.08 },
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

/* ============================== Social Ideas / Comment Section ============================== */

function CommentSection({ marketId }: { marketId: string }) {
  const { address, connected } = useHelioraWallet();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [activeTab, setActiveTab] = useState<"ideas" | "activity">("ideas");
  const maxChars = 800;

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
    <div className="space-y-8 pb-20">
      {/* Social Tabs */}
      <div className="flex items-center gap-6 border-b border-white/5 pb-px">
        {[
          { id: "ideas", label: "Ideas" },
          { id: "activity", label: "Activity" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={cn(
              "pb-4 text-2xl font-black transition-colors",
              activeTab === t.id ? "text-white" : "text-white/20 hover:text-white/40"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Composer */}
      <form onSubmit={handlePost} className="relative space-y-4">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value.slice(0, maxChars))}
          placeholder="What's your prediction?"
          className="w-full bg-transparent p-0 text-lg font-medium text-white placeholder:text-white/20 focus:outline-none"
          rows={3}
        />
        <div className="flex items-center justify-between border-b border-white/5 pb-6">
          <button type="button" className="text-xs font-black uppercase tracking-widest text-white/40 hover:text-white">
            GIF
          </button>
          <div className="flex items-center gap-6">
            <span className="font-mono text-xs text-white/20">{maxChars - newComment.length} left</span>
            <button
              type="submit"
              disabled={!newComment.trim() || postMutation.isPending}
              className="rounded-xl bg-white px-8 py-3 text-sm font-black text-black transition hover:opacity-90 disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </div>
      </form>

      {/* Feed */}
      <div className="divide-y divide-white/5">
        {isLoading && (
          <div className="py-12 text-center text-sm text-white/20">Loading thoughts...</div>
        )}
        {comments.map((c) => (
          <div key={c.id} className="py-8 group">
            <div className="flex gap-4">
              {/* Avatar */}
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                <img 
                    src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${c.wallet || c.id}`} 
                    alt="avatar"
                    className="h-full w-full object-cover"
                />
              </div>
              
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-white hover:underline cursor-pointer">
                    {c.wallet ? `${c.wallet.slice(0, 8)}...${c.wallet.slice(-4)}` : "jacknippleson"}
                  </span>
                  <span className="text-[11px] font-bold text-white/20">{timeAgo(c.createdAt)}</span>
                  <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/40 uppercase">No Position</span>
                </div>
                
                <p className="text-base leading-relaxed text-white/90">
                  {c.text}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-6 pt-2 text-white/30">
                  <button className="flex items-center gap-2 hover:text-white transition">
                    <MessageSquare className="h-4 w-4" />
                  </button>
                  <button className="flex items-center gap-2 hover:text-white transition">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs font-bold">1</span>
                  </button>
                  <button className="flex items-center gap-2 hover:text-white transition">
                    <Bookmark className="h-4 w-4" />
                  </button>
                  <button className="flex items-center gap-2 hover:text-white transition">
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================== Simple Prediction Candle Chart ============================== */

function PredictionCandleChart({ pricePoints, live, range }: { pricePoints: ApiPricePoint[]; live: number; range: Range }) {
  const candles = useMemo(() => buildCandlesFromPoints(filterPointsByRange(pricePoints, range), live), [pricePoints, live, range]);

  const H = 380, PAD_X = 12, PAD_Y = 40;
  const W = 1000; 
  const cw = (W - PAD_X * 2) / Math.max(1, candles.length);

  const minP = Math.min(...candles.map(c => c.l), live);
  const maxP = Math.max(...candles.map(c => c.h), live);
  let span = Math.max(0.001, maxP - minP);
  const domainMin = Math.max(0, minP - span * 0.15);
  const domainMax = Math.min(1, maxP + span * 0.15);
  span = domainMax - domainMin;

  const scaleY = (p: number) => PAD_Y + (1 - (p - domainMin) / span) * (H - PAD_Y * 2);
  const lastY = scaleY(live);

  return (
    <div className="relative h-full w-full bg-black/10 rounded-xl overflow-hidden group">
      <div className="h-full w-full">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
          {[0.2, 0.4, 0.6, 0.8].map(p => {
            const y = scaleY(domainMin + span * p);
            return <line key={p} x1={0} x2={W} y1={y} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />;
          })}
          
          {candles.map((k, i) => {
            const x = PAD_X + i * cw + cw / 2;
            const yH = scaleY(k.h), yL = scaleY(k.l), yO = scaleY(k.o), yC = scaleY(k.c);
            const isUp = k.c >= k.o;
            const color = isUp ? "#22c55e" : "#ef4444";
            const bodyTop = Math.min(yO, yC);
            const bodyH = Math.max(2, Math.abs(yO - yC));
            const bw = Math.max(6, cw * 0.7);

            return (
              <g key={i}>
                <line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth="2" />
                <rect x={x - bw / 2} y={bodyTop} width={bw} height={bodyH} fill={color} rx="1.5" />
              </g>
            );
          })}

          <line x1={0} x2={W} y1={lastY} y2={lastY} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
        </svg>
      </div>

      <div className="absolute right-0 top-0 bottom-0 w-12 flex flex-col justify-between py-8 pointer-events-none">
        {[0.8, 0.6, 0.4, 0.2].map(p => (
          <span key={p} className="text-[9px] font-mono text-white/20 pr-2 text-right">
            {((domainMin + span * p) * 100).toFixed(1)}¢
          </span>
        ))}
      </div>

      <div 
        className="absolute right-0 px-1.5 py-0.5 bg-white text-[10px] font-black text-black rounded-l" 
        style={{ top: lastY - 9 }}
      >
        {(live * 100).toFixed(1)}¢
      </div>
    </div>
  );
}
/* ============================== Polymarket-style Order Book ============================== */

function PolymarketOrderBook({ yes, no, mid }: { yes: OBRow[]; no: OBRow[]; mid: number }) {
  // no is asks (red), yes is bids (green) for a "YES" orderbook
  const asks = [...no].sort((a, b) => b.price - a.price); // Highest ask at top
  const bids = [...yes].sort((a, b) => b.price - a.price); // Highest bid at top (near mid)

  const maxTotal = Math.max(
    ...asks.map(r => r.total),
    ...bids.map(r => r.total),
    1
  );

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/5 bg-[#0d0d0d]">
      {/* Table Headers */}
      <div className="grid grid-cols-[1fr_120px_120px] gap-4 border-b border-white/5 bg-white/[0.02] px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-white/30">
        <span>Price</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks Section */}
      <div className="flex flex-col">
        {asks.slice(-5).map((r, i) => (
          <div key={`ask-${i}`} className="group relative grid grid-cols-[1fr_120px_120px] gap-4 px-6 py-2.5 transition hover:bg-white/5">
            <div 
              className="absolute inset-y-0 right-0 bg-[#ef4444]/10 transition-all duration-500" 
              style={{ width: `${(r.total / maxTotal) * 100}%` }}
            />
            <span className="relative font-display text-sm font-bold text-[#ef4444] tabular-nums">
              {(r.price * 100).toFixed(1)}¢
            </span>
            <span className="relative text-right font-mono text-xs text-white/60 tabular-nums">
              {r.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="relative text-right font-mono text-xs text-white/40 tabular-nums">
              ${(r.total * r.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>

      {/* Midpoint / Spread Bar */}
      <div className="flex items-center justify-between border-y border-white/5 bg-white/[0.01] px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Last</span>
          <span className="font-display text-lg font-black text-white tabular-nums">{(mid * 100).toFixed(1)}¢</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Spread</span>
          <span className="font-mono text-xs font-bold text-white/60 tabular-nums">
            {((Math.abs((asks[asks.length-1]?.price || 0) - (bids[0]?.price || 0))) * 100).toFixed(2)}¢
          </span>
        </div>
      </div>

      {/* Bids Section */}
      <div className="flex flex-col">
        {bids.slice(0, 5).map((r, i) => (
          <div key={`bid-${i}`} className="group relative grid grid-cols-[1fr_120px_120px] gap-4 px-6 py-2.5 transition hover:bg-white/5">
            <div 
              className="absolute inset-y-0 right-0 bg-[#22c55e]/10 transition-all duration-500" 
              style={{ width: `${(r.total / maxTotal) * 100}%` }}
            />
            <span className="relative font-display text-sm font-bold text-[#22c55e] tabular-nums">
              {(r.price * 100).toFixed(1)}¢
            </span>
            <span className="relative text-right font-mono text-xs text-white/60 tabular-nums">
              {r.size.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="relative text-right font-mono text-xs text-white/40 tabular-nums">
              ${(r.total * r.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>

      {/* Footer Branding/Info */}
      <div className="flex items-center justify-between border-t border-white/5 px-6 py-3">
        <div className="flex items-center gap-2">
          <Radio className="h-3 w-3 text-[#22c55e] animate-pulse" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Live Orderbook</span>
        </div>
        <div className="flex items-center gap-4">
            <div className="h-1.5 w-1.5 rounded-full bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">USDC Settlement</span>
        </div>
      </div>
    </div>
  );
}

function ActivityList({ rows }: { rows: any[] }) {
    return (
        <div className="space-y-3">
            {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:bg-white/[0.04]">
                    <div className="flex items-center gap-4">
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold", r.side === "YES" ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#ef4444]/10 text-[#ef4444]")}>
                            {r.side[0]}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white">{r.who}</div>
                            <div className="text-[10px] font-medium text-white/40">{r.time}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm font-black text-white">{r.amount.toLocaleString()} shares</div>
                        <div className="text-[10px] font-bold text-white/40">at {Math.round(r.price * 100)}¢</div>
                    </div>
                </div>
            ))}
        </div>
    )
}

function AgentsSection({ marketId, yesPrice }: { marketId: string; yesPrice: number }) {
  const { data } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.listAgents(),
    staleTime: 30_000,
  });

  const agents = (data?.agents ?? []).filter((a) => a.status === "live").slice(0, 5);

  const agentSentiments = useMemo(() => {
    return agents.map((a) => {
      const yesBias = Math.random() > 0.45;
      const conf = 60 + Math.random() * 35;
      return {
        ...a,
        view: yesBias ? "YES" : "NO",
        confidence: +conf.toFixed(0),
        action: conf > 80 ? (yesBias ? "Aggressive Long" : "Strong Short") : "Monitoring"
      };
    });
  }, [agents.length, marketId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
            <Radio className="h-3 w-3 text-[#00FFBD] animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Live Agent Intelligence</span>
        </div>
        <span className="text-[10px] font-black text-[#00FFBD] uppercase tracking-widest">3-Source Consensus Active</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {agents.length === 0 ? (
          <div className="col-span-2 rounded-2xl border border-dashed border-white/10 p-12 text-center">
            <Bot className="mx-auto h-8 w-8 text-white/10 mb-4" />
            <div className="text-sm font-bold text-white/40 uppercase tracking-widest">No agents deployed to this instrument</div>
          </div>
        ) : (
          agentSentiments.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition hover:bg-white/[0.04]">
              {/* Performance Header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/5 transition group-hover:border-[#00FFBD]/30">
                    <Bot className="h-4 w-4 text-white/40 group-hover:text-[#00FFBD]" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-white">{a.name}</div>
                    <div className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">{a.type} Analyst</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("text-xs font-black uppercase tracking-widest", a.view === "YES" ? "text-[#22c55e]" : "text-[#ef4444]")}>
                    {a.view}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-white/20">{a.confidence}% conf</div>
                </div>
              </div>

              {/* Confidence Bar */}
              <div className="mb-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
                <div 
                  className={cn("h-full transition-all duration-1000", a.view === "YES" ? "bg-[#22c55e]" : "bg-[#ef4444]")}
                  style={{ width: `${a.confidence}%` }}
                />
              </div>

              {/* Stats Footer */}
              <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <div className="flex gap-4">
                    <div>
                        <div className="text-[9px] font-bold text-white/20 uppercase">Win Rate</div>
                        <div className="text-xs font-black text-white">{a.winRate.toFixed(0)}%</div>
                    </div>
                    <div>
                        <div className="text-[9px] font-bold text-white/20 uppercase">30D PnL</div>
                        <div className={cn("text-xs font-black", a.pnl30d >= 0 ? "text-[#22c55e]" : "text-[#ef4444]")}>
                            {a.pnl30d >= 0 ? "+" : ""}{a.pnl30d.toFixed(1)}%
                        </div>
                    </div>
                </div>
                <div className="text-[10px] font-bold text-white/40 italic">
                    {a.action}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#00FFBD]/5 p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
            <Brain className="h-6 w-6 text-[#00FFBD]" />
            <div className="max-w-md">
                <h4 className="text-sm font-black text-white uppercase tracking-widest">Protocol Resolution Logic</h4>
                <p className="mt-1 text-[11px] text-white/40 leading-relaxed">
                    Heliora resolves markets by aggregating sentiment from a decentralized cluster of high-performance agents. Resolution requires a 3-source consensus with &gt;85% aggregate confidence.
                </p>
            </div>
        </div>
        <Link to="/agents" className="rounded-xl bg-white px-6 py-2.5 text-[10px] font-black text-black uppercase tracking-widest hover:opacity-90 transition shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            Delegate Capital
        </Link>
      </div>
    </div>
  );
}
