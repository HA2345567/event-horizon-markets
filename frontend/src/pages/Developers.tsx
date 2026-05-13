import { PageShell } from "@/components/layout/PageShell";
import { Bot, Code2, Copy, ExternalLink, Globe, Layers, Plug, Terminal, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

const TABS = [
  { key: "agent-kit", label: "Agent Kit", icon: Bot },
  { key: "mcp", label: "MCP Server", icon: Terminal },
  { key: "sdk", label: "TypeScript SDK", icon: Code2 },
  { key: "rpc", label: "Direct RPC", icon: Layers },
] as const;

const SNIPPETS: Record<string, { title: string; lang: string; code: string }[]> = {
  "agent-kit": [
    {
      title: "Install",
      lang: "bash",
      code: `npm i solana-agent-kit @heliora/agent-kit-plugin`,
    },
    {
      title: "Use it",
      lang: "ts",
      code: `import { SolanaAgentKit } from "solana-agent-kit";
import { predictPlugin } from "@heliora/agent-kit-plugin";

const agent = new SolanaAgentKit(wallet, RPC).use(predictPlugin);

const markets = await agent.findMarkets({ category: "Crypto" });
const tx = await agent.placeBet({
  marketId: markets[0].id,
  side: "YES",
  amount: 100, // USDC
});`,
    },
  ],
  mcp: [
    {
      title: "Add to Claude / Cursor",
      lang: "json",
      code: `{
  "mcpServers": {
    "heliora": {
      "url": "https://mcp.heliora.xyz",
      "auth": "siws"
    }
  }
}`,
    },
    {
      title: "Natural language",
      lang: "txt",
      code: `> show me the most active crypto markets
> place 50 USDC on YES for "BTC > $145k by May 31"
> what's my open P&L?`,
    },
  ],
  sdk: [
    {
      title: "Install",
      lang: "bash",
      code: `npm i @heliora/sdk`,
    },
    {
      title: "Browse + bet",
      lang: "ts",
      code: `import { Heliora } from "@heliora/sdk";

const sp = new Heliora({ rpc: "helius://..." });
const live = await sp.markets.list({ live: true });

const tx = await sp.bet({
  marketId: live[0].id,
  side: "NO",
  amount: 25,
  signer: wallet,
});`,
    },
  ],
  rpc: [
    {
      title: "Anchor program",
      lang: "rs",
      code: `program: predict1111111111111111111111111111111111

instructions:
  create_market(question, resolution, ends_at, seed)
  place_position(market, side, amount)        // batchable up to 50
  claim_winnings(market)
  resolve(market, oracle_attestations[])`,
    },
  ],
};

const ACTIONS = [
  ["findMarkets(filters?)", "Returns open markets with odds + metadata"],
  ["getMarket(id)", "Full market details, liquidity, resolution rules"],
  ["placeBet(id, side, amount)", "Signs + sends tx, returns position token"],
  ["getPositions(wallet)", "Open positions + unrealized P&L"],
  ["claimWinnings(id)", "Claims resolved market payout"],
  ["createMarket(params)", "Deploys new market on-chain"],
  ["streamMarket(id, cb)", "Yellowstone gRPC subscription"],
  ["getLeaderboard()", "Top wallets + agents by 30d P&L"],
];

const API_KEY_PREFIX = "heli_live_";
const generateKey = () => API_KEY_PREFIX + Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join("");

export default function Developers() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("agent-kit");
  const [apiKey, setApiKey] = useState("");
  
  const stats = useQuery({
    queryKey: ["developers", "stats"],
    queryFn: () => api.protocolStats(),
  });

  const health = useQuery({
    queryKey: ["developers", "health"],
    queryFn: () => api.liveHealthStatus(),
  });

  const liveStats = stats.data;
  const isAvailable = health.data?.markets_available;

  return (
    <PageShell>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 grid-bg radial-fade opacity-50" />
        <div className="container relative py-20">
          <div className="badge-pill"><Code2 className="h-3 w-3" /> Developers</div>
          <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[1.05] tracking-tight text-gradient">
            The smart contract is the API.
          </h1>
          <p className="mt-5 max-w-xl text-muted-foreground">
            No wrappers. No rate limits. Agents read structured on-chain accounts,
            batch up to 50 positions in a single transaction, and subscribe to
            state changes via Yellowstone gRPC.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            <Stat label="Network Status" value={isAvailable ? "Operational" : "Degraded"} color={isAvailable ? "text-success" : "text-warning"} />
            <Stat label="On-chain Agents" value={String(liveStats?.agents ?? 12)} />
            <Stat label="Total Markets" value={String(liveStats?.markets ?? 42)} />
            <Stat label="Protocol Users" value={String(liveStats?.users ?? 850)} />
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="container py-16">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          {[
            { icon: Bot, title: "Solana Agent Kit", body: "Official plugin for the de-facto standard with 60+ skills." },
            { icon: Terminal, title: "MCP Server", body: "Hosted at mcp.heliora.xyz. Auth via SIWS." },
            { icon: Plug, title: "TypeScript SDK", body: "Typed, retry-aware client for Node + browser." },
            { icon: Globe, title: "Webhooks", body: "Helius webhooks for resolution + price events." },
          ].map((c) => (
            <div key={c.title} className="bg-background p-6">
              <c.icon className="h-5 w-5" />
              <h3 className="mt-5 font-display text-lg">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tabs + code */}
      <section className="container pb-16">
        <div className="rounded-2xl border border-border bg-surface shadow-ring-strong">
          <div className="flex flex-wrap gap-1 border-b border-border p-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition",
                  tab === t.key ? "bg-foreground text-background shadow-button-inset" : "text-muted-foreground hover:text-foreground hover:bg-surface-hover",
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid gap-6 p-6 md:grid-cols-2">
            {SNIPPETS[tab].map((s) => (
              <CodeBlock key={s.title} title={s.title} lang={s.lang} code={s.code} />
            ))}
          </div>
        </div>
      </section>

      {/* Action reference */}
      <section className="container pb-24">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl">Plugin actions</h2>
          <a className="text-sm text-muted-foreground hover:text-foreground" href="#">
            Full API reference <ExternalLink className="ml-1 inline h-3 w-3" />
          </a>
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-ring">
          {ACTIONS.map(([fn, desc], i) => (
            <div key={fn} className={cn("grid grid-cols-12 items-center px-5 py-4", i > 0 && "border-t border-border/50")}>
              <code className="col-span-5 font-mono text-sm text-foreground">{fn}</code>
              <span className="col-span-7 text-sm text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-surface p-8 shadow-ring">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <Zap className="h-3 w-3" /> Sandbox access
              </div>
              <h3 className="mt-3 font-display text-2xl text-foreground">Generate API Key</h3>
              <p className="mt-2 text-sm text-muted-foreground">Get started with the Heliora SDK in seconds.</p>
            </div>
            {apiKey ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm">
                {apiKey}
                <button 
                  onClick={() => { navigator.clipboard.writeText(apiKey); toast.success("API Key copied"); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setApiKey(generateKey())}
                className="rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-button-inset transition hover:opacity-90"
              >
                Create API Key
              </button>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-background p-6">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-2 font-display text-2xl", color || "text-foreground")}>{value}</div>
    </div>
  );
}

function CodeBlock({ title, lang, code }: { title: string; lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-background shadow-ring">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{title}</span>
          <span className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{lang}</span>
        </div>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
          className="rounded p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6 text-foreground/90">{code}</pre>
      {copied && <div className="border-t border-border bg-surface px-4 py-1.5 text-[11px] text-success">Copied</div>}
    </div>
  );
}
