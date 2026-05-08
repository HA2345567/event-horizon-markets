import { PageShell } from "@/components/layout/PageShell";
import { Coins, Lock, ShieldCheck, Vote, Zap } from "lucide-react";

const DIST = [
  { label: "Community / liquidity mining", pct: 25, vest: "4-year linear vest" },
  { label: "Team", pct: 20, vest: "4-year vest, 1-year cliff" },
  { label: "Investors", pct: 15, vest: "2-year vest, 6-month cliff" },
  { label: "Oracle network bootstrap rewards", pct: 15, vest: "Performance-based" },
  { label: "Ecosystem / developer grants", pct: 15, vest: "Multisig governed" },
  { label: "Treasury / DAO", pct: 10, vest: "Vote-locked" },
];

export default function Token() {
  return (
    <PageShell>
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 dot-bg radial-fade opacity-40" />
        <div className="container relative py-20 text-center">
          <div className="badge-pill mx-auto inline-flex"><Coins className="h-3 w-3" /> HELIORA token</div>
          <h1 className="mx-auto mt-5 max-w-3xl font-display text-6xl leading-[1.02] tracking-tight text-gradient">
            Own a piece of the protocol.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            CFTC regulation prevents centralized exchanges from issuing equity-like tokens.
            HELIORA captures protocol fee revenue, gates oracle participation,
            and governs every parameter.
          </p>

          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            <Stat label="Circulating" value="142M" />
            <Stat label="Staked" value="38%" />
            <Stat label="30d fee revenue" value="$214K" />
            <Stat label="APR (stakers)" value="14.2%" />
          </div>
        </div>
      </section>

      {/* Utility */}
      <section className="container py-20">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Coins, title: "Fee share", body: "Stakers earn the 0.2% protocol fee, distributed by share of stake." },
            { icon: ShieldCheck, title: "Oracle participation", body: "Min 100 HELIORA staked to join the AI oracle network as a resolver." },
            { icon: Vote, title: "Governance", body: "Vote on fees, new categories, treasury spend, protocol upgrades." },
            { icon: Zap, title: "Disputes", body: "Stake to challenge market resolutions. Earn rewards on success." },
          ].map((u) => (
            <div key={u.title} className="rounded-2xl border border-border bg-surface p-6 shadow-ring">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background"><u.icon className="h-4 w-4" /></div>
              <h3 className="mt-5 font-display text-lg">{u.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{u.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Distribution */}
      <section className="container pb-24">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-border bg-surface p-8 shadow-ring">
            <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Token distribution · 1B max supply</div>
            <div className="mt-6 space-y-4">
              {DIST.map((d) => (
                <div key={d.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <div>
                      <span className="text-foreground">{d.label}</span>
                      <span className="ml-2 font-mono text-[11px] text-muted-foreground">{d.vest}</span>
                    </div>
                    <span className="font-mono text-foreground/90">{d.pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background">
                    <div className="h-full rounded-full bg-foreground" style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-surface p-6 shadow-ring">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                <Lock className="h-3 w-3" /> Stake HELIORA
              </div>
              <div className="mt-4 rounded-lg border border-border bg-background p-4">
                <div className="flex items-baseline justify-between">
                  <input defaultValue={1000} className="w-full bg-transparent font-display text-3xl focus:outline-none" />
                  <span className="rounded border border-border px-2 py-1 font-mono text-xs">HELIORA</span>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <Row k="Lock period" v="90 days" />
                <Row k="Est. APR" v="14.2%" />
                <Row k="Voting power" v="1,200 ve-HELIORA" />
                <Row k="30d fee share" v="~$182" />
              </div>
              <button className="mt-5 w-full rounded-lg bg-foreground py-2.5 text-sm font-semibold text-background shadow-button-inset">
                Stake
              </button>
            </div>

            <div className="rounded-2xl border border-dashed border-border p-6">
              <div className="font-display text-base">Emissions schedule</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Phase 1 (m1–6) — bootstrap LPs + creators</li>
                <li>Phase 2 (m7–18) — taper as fees grow</li>
                <li>Phase 3 (m19+) — fee-funded sustenance</li>
              </ul>
            </div>
          </div>
        </div>
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono text-foreground/90">{v}</span>
    </div>
  );
}
