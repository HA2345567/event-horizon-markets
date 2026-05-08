import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { 
  Vote, 
  Coins, 
  TrendingUp, 
  Lock, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Plus,
  ArrowUpRight,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function Governance() {
  const [stakeAmount, setStakeAmount] = useState("");
  
  const stats = useQuery({
    queryKey: ["governance", "stats"],
    queryFn: async () => ({
      totalStaked: 12540880,
      apy: 12.4,
      myStake: 5000,
      protocolFees: 45.2,
      votingPower: 5000
    }),
  });

  const proposals = useQuery({
    queryKey: ["governance", "proposals"],
    queryFn: async () => [
      {
        id: 1,
        title: "HIP-1: Increase protocol fee to 0.25%",
        status: "Active",
        for: 85,
        against: 15,
        endsIn: "2 days",
        creator: "0xHel...ora"
      },
      {
        id: 2,
        title: "HIP-2: Add 'AI Agents' as first-class market category",
        status: "Passed",
        for: 98,
        against: 2,
        endsIn: "Ended",
        creator: "Heliora Foundation"
      }
    ],
  });

  const data = stats.data;

  return (
    <PageShell>
      <div className="container py-12">
        <div className="mb-12">
          <Badge variant="outline" className="mb-4 border-primary/20 bg-primary/5 text-primary">
            <ShieldCheck className="mr-1 h-3 w-3" />
            Heliora DAO
          </Badge>
          <h1 className="font-display text-4xl tracking-tight">Governance & Staking</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Stake $HELIORA to earn a share of protocol revenue, participate in market 
            resolutions, and vote on the future of the AI-native prediction layer.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Staking Stats */}
          <Card className="flex flex-col border-border/60 bg-surface/40 p-6 backdrop-blur">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" />
              Total Value Staked
            </div>
            <div className="mt-3 font-display text-3xl">
              {data ? data.totalStaked.toLocaleString() : "—"}
              <span className="ml-1 text-xs font-normal text-muted-foreground">HELIORA</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-success">
              <TrendingUp className="h-3 w-3" />
              +5.2% this week
            </div>
          </Card>

          <Card className="flex flex-col border-border/60 bg-surface/40 p-6 backdrop-blur">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Fee Share APY
            </div>
            <div className="mt-3 font-display text-3xl">
              {data ? `${data.apy}%` : "—"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Real yield in $SOL
            </div>
          </Card>

          <Card className="flex flex-col border-border/60 bg-surface/40 p-6 backdrop-blur">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Vote className="h-4 w-4" />
              My Voting Power
            </div>
            <div className="mt-3 font-display text-3xl">
              {data ? data.votingPower.toLocaleString() : "—"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              1 HELIORA = 1 VOTE
            </div>
          </Card>
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-5">
          {/* Staking Action */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden border-border/60 bg-surface/20">
              <div className="border-b border-border/60 bg-surface/40 px-6 py-4">
                <h3 className="font-semibold text-foreground">Stake Tokens</h3>
              </div>
              <div className="p-6">
                <div className="mb-6 space-y-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Wallet Balance</span>
                    <span className="font-mono">15,420.00 HELIORA</span>
                  </div>
                  <div className="relative">
                    <Input 
                      placeholder="0.00" 
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      className="h-12 border-border/60 bg-background pl-4 pr-16 font-mono text-lg focus-visible:ring-primary/20"
                    />
                    <button 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-primary hover:text-primary-elevated"
                      onClick={() => setStakeAmount("15420")}
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 font-bold transition-all active:scale-[0.98]">
                    Stake $HELIORA
                  </Button>
                  <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground">
                    Unstake
                  </Button>
                </div>

                <div className="mt-8 rounded-lg border border-border/40 bg-surface/40 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Protocol Rewards</span>
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Coins className="h-3.5 w-3.5 text-success" />
                      45.22 SOL
                    </div>
                  </div>
                  <Button variant="outline" className="mt-4 w-full border-success/20 bg-success/5 text-success hover:bg-success/10 hover:text-success transition-colors">
                    Claim Rewards
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Proposals List */}
          <div className="lg:col-span-3">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-display text-2xl tracking-tight">Active Proposals</h3>
              <Button size="sm" className="gap-1.5 rounded-full border border-border/60 bg-surface/40 text-foreground hover:bg-surface/60">
                <Plus className="h-3.5 w-3.5" />
                New Proposal
              </Button>
            </div>

            <div className="space-y-4">
              {proposals.data?.map((p) => (
                <Card key={p.id} className="group overflow-hidden border-border/60 bg-surface/20 transition-all hover:bg-surface/30">
                  <div className="p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant={p.status === "Active" ? "default" : "secondary"} className={p.status === "Active" ? "bg-primary/10 text-primary hover:bg-primary/10" : "bg-muted text-muted-foreground"}>
                            {p.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">ID: {p.id}</span>
                        </div>
                        <h4 className="font-display text-xl text-foreground group-hover:text-primary transition-colors">
                          {p.title}
                        </h4>
                      </div>
                      <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="mb-6 space-y-3">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-success">FOR ({p.for}%)</span>
                        <span className="text-destructive">AGAINST ({p.against}%)</span>
                      </div>
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
                        <div className="bg-success" style={{ width: `${p.for}%` }} />
                        <div className="bg-destructive" style={{ width: `${p.against}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/40 pt-4 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {p.endsIn}
                        </div>
                        <div className="text-muted-foreground">
                          by <span className="text-foreground">{p.creator}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-8 border-success/30 bg-success/5 text-success hover:bg-success/10">
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Vote For
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10">
                          <XCircle className="mr-1.5 h-3.5 w-3.5" /> Against
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
