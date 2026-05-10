import { useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { apiBaseUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ConnectWalletButton({ className }: { className?: string }) {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toBase58();

  // Sync address to Heliora localStorage
  useEffect(() => {
    if (address) {
      localStorage.setItem("heliora.wallet", address);
    } else {
      localStorage.removeItem("heliora.wallet");
    }
  }, [address]);


  if (!connected) {
    return (
      <button
        onClick={() => setVisible(true)}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-4 py-1.5 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-95",
          className
        )}
      >
        <User className="h-4 w-4" />
        Connect
      </button>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>

      <div className="flex items-center gap-px overflow-hidden rounded-md border border-border bg-surface">
        <div className="px-3 py-1.5 text-sm font-mono text-muted-foreground">
          {address?.slice(0, 4)}...{address?.slice(-4)}
        </div>
        <button
          onClick={() => disconnect()}
          className="flex items-center justify-center border-l border-border px-3 py-1.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
          title="Disconnect"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
