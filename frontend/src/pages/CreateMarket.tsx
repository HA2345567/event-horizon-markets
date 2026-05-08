import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useHelioraWallet } from "@/components/wallet/useHelioraWallet";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageShell } from "@/components/layout/PageShell";
import { api } from "@/lib/api";
import { CATEGORIES, type MarketCategory, type ResolutionSource } from "@/lib/api-types";
import { ArrowLeft, ArrowRight, Brain, Calendar, Check, CheckCircle2, Coins, Database, Loader2, Network, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  { id: 'pump', name: 'Pump.fun Launch', icon: Zap, question: "Will {token} reach $10M MC within 24h of launch?", res: 'AIOracle', cat: 'Memes' },
  { id: 'meme', name: 'Meme Comparison', icon: Sparkles, question: "Will {coin1} outperform {coin2} this week?", res: 'Pyth', cat: 'Memes' },
  { id: 'nft', name: 'NFT Floor', icon: Layers, question: "Will {collection} floor be above {price} SOL by Friday?", res: 'AIOracle', cat: 'NFTs' },
  { id: 'defi', name: 'DeFi Volume', icon: Gauge, question: "Will Jupiter daily volume exceed $1B this week?", res: 'Switchboard', cat: 'DeFi' },
];

const RES: { key: ResolutionSource; label: string; icon: any; desc: string; best: string }[] = [
  { key: "Pyth", label: "Pyth", icon: Database, desc: "Auto-resolve from on-chain price feeds. Sub-slot settlement.", best: "Crypto, FX, commodities" },
  { key: "Switchboard", label: "Switchboard", icon: Network, desc: "Custom data feeds. APIs, sports stats, analytics.", best: "DeFi metrics, sports" },
  { key: "AIOracle", label: "AI Oracle", icon: Brain, desc: "5-agent consensus with web search + reasoning.", best: "Subjective, news, social" },
  { key: "DAOVote", label: "DAO Vote", icon: CheckCircle2, desc: "PREDICT holders vote. 48h dispute window.", best: "Governance, futarchy" },
];

export default function CreateMarket() {
  const navigate = useNavigate();
  const { connected } = useHelioraWallet();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<"binary" | "categorical">("binary");
  const [question, setQuestion] = useState("Will SOL close above $300 by July 1?");
  const [cat, setCat] = useState<MarketCategory>("Crypto");
  const [resolution, setResolution] = useState<ResolutionSource>("Pyth");
  const [seed, setSeed] = useState(500);
  const [endDate, setEndDate] = useState("2026-07-01");

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setQuestion(t.question);
    setCat(t.cat as MarketCategory);
    setResolution(t.res as ResolutionSource);
  };

  const createMut = useMutation({
    mutationFn: () =>
      api.createMarket({
        question,
        category: cat,
        resolution,
        endsAt: new Date(endDate).toISOString(),
        liquiditySeed: seed,
        isLive: true,
      }),
    onSuccess: ({ market }) => {
      toast.success("Market deployed");
      navigate(`/markets/${market.id}`);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to deploy market"),
  });

  return (
    <PageShell>
      <div className="container py-10">
        <Link to="/markets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to markets
        </Link>

        <div className="mt-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-4xl tracking-tight">Create a market</h1>
            <p className="mt-2 text-muted-foreground">One transaction. Less than $0.001 in fees. Live in 412ms.</p>
          </div>
          <Stepper step={step} />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_420px]">
          {/* LEFT FORM */}
          <div className="space-y-6">
            {/* Template Picker */}
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-ring">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-success" />
                <h2 className="font-display text-lg">Solana-Native Templates</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-4 text-center transition hover:border-foreground hover:bg-surface-elevated"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface">
                      <t.icon className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 1 — Type */}
            <Section n={1} title="Market type" active={step >= 1}>
              <div className="grid gap-3 md:grid-cols-2">
                <TypeCard
                  active={type === "binary"}
                  onClick={() => setType("binary")}
                  title="Binary YES/NO"
                  body="Single outcome question. AMM provides instant liquidity."
                  icon={Coins}
                />
                <TypeCard
                  active={type === "categorical"}
                  onClick={() => setType("categorical")}
                  title="Multi-outcome"
                  body="2–10 mutually exclusive outcomes. Categorical AMM."
                  icon={Network}
                />
              </div>
            </Section>

            {/* Step 2 — Question */}
            <Section n={2} title="The question" active={step >= 1}>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background p-4 text-base focus:border-border-strong focus:outline-none"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Category:</span>
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      cat === c
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-surface text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Section>

            {/* Step 3 — Resolution */}
            <Section n={3} title="Resolution source" active={step >= 1}>
              <div className="grid gap-3 md:grid-cols-2">
                {RES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setResolution(r.key)}
                    className={cn(
                      "group rounded-xl border p-4 text-left transition",
                      resolution === r.key
                        ? "border-foreground bg-surface-elevated shadow-ring"
                        : "border-border bg-surface hover:bg-surface-elevated",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background">
                        <r.icon className="h-4 w-4" />
                      </div>
                      {resolution === r.key && <Check className="h-4 w-4" />}
                    </div>
                    <div className="mt-3 font-display text-base">{r.label}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
                    <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Best for: {r.best}
                    </div>
                  </button>
                ))}
              </div>
            </Section>

            {/* Step 4 — Params */}
            <Section n={4} title="Parameters" active={step >= 1}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Resolution date" icon={Calendar}>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                </Field>
                <Field label="Initial liquidity (USDC)" icon={Coins}>
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value) || 0)}
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                </Field>
              </div>
              <div className="mt-3 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
                <Sparkles className="mr-1 inline h-3 w-3" /> You earn <strong className="text-foreground">0.3% of all trading fees</strong> on this market — forever.
              </div>
            </Section>

            <div className="flex items-center justify-between border-t border-border pt-6">
              <span className="font-mono text-xs text-muted-foreground">
                {connected ? "Network fee: ~0.000012 SOL" : "Connect wallet to deploy"}
              </span>
              {!connected ? (
                <ConnectWalletButton />
              ) : (
                <button
                  onClick={() => createMut.mutate()}
                  disabled={createMut.isPending || !question.trim()}
                  className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-button-inset transition hover:opacity-90 disabled:opacity-50"
                >
                  {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {createMut.isPending ? "Deploying…" : "Deploy market"}
                </button>
              )}
            </div>
          </div>

          {/* RIGHT — preview */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-ring-strong">
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Live preview</div>

              <div className="mt-4 rounded-xl border border-border bg-background p-5">
                <div className="flex items-center gap-2">
                  <span className="rounded border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{cat}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">resolves via {resolution}</span>
                </div>
                <h3 className="mt-3 font-display text-lg leading-snug">{question || "Your question…"}</h3>
                <div className="mt-4 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl">50%</span>
                    <span className="text-xs text-muted-foreground">YES</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">${seed} liquidity</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-surface">
                  <div className="h-full w-1/2 rounded-full bg-foreground" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border bg-surface py-1.5 text-center text-xs font-semibold text-success">YES · 0.50</div>
                  <div className="rounded-md border border-border bg-surface py-1.5 text-center text-xs font-semibold text-destructive">NO · 0.50</div>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <Row k="Your fee share" v="0.3% per trade" />
                <Row k="LP fee" v="0.5%" />
                <Row k="Protocol fee" v="0.2%" />
                <Row k="Resolution window" v={resolution === "AIOracle" ? "1 hour" : "1 slot"} />
                <Row k="Idle yield routing" v="Kamino · 5.4% APY" />
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background p-3 text-xs">
                <Zap className="h-3.5 w-3.5 text-success" />
                <span>Deploy in 412ms. Zero configuration.</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="hidden items-center gap-2 md:flex">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className={cn("h-1.5 w-10 rounded-full", step >= n ? "bg-foreground" : "bg-border")} />
      ))}
    </div>
  );
}

function Section({ n, title, active, children }: any) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-ring">
      <div className="flex items-center gap-3">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-full border font-mono text-xs", active ? "border-foreground text-foreground" : "border-border text-muted-foreground")}>{n}</span>
        <h2 className="font-display text-lg">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function TypeCard({ active, onClick, title, body, icon: Icon }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-5 text-left transition",
        active ? "border-foreground bg-surface-elevated shadow-ring" : "border-border bg-surface hover:bg-surface-elevated",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background">
          <Icon className="h-4 w-4" />
        </div>
        {active && <Check className="h-4 w-4" />}
      </div>
      <div className="mt-3 font-display text-base">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </button>
  );
}

function Field({ label, icon: Icon, children }: any) {
  return (
    <div>
      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {children}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono text-foreground/90">{v}</span>
    </div>
  );
}
