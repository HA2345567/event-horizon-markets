import { Link, NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";

const NAV = [
  { to: "/markets", label: "Markets" },
  { to: "/live", label: "Live" },
  { to: "/agents", label: "Agents" },
  { to: "/oracle", label: "Oracle" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/governance", label: "DAO" },
  { to: "/developers", label: "Developers" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const onLanding = pathname === "/";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full backdrop-blur-xl",
        "bg-background/70 border-b border-border/60",
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center gap-3">
            <Logo className="h-7 w-11" />
            <span className="font-display text-xl tracking-tight">Heliora</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "text-foreground bg-surface"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface/60",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {onLanding && (
            <Link
              to="/developers"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Docs
            </Link>
          )}
          <ConnectWalletButton className="heliora-wallet" />
          <Link
            to="/markets/create"
            className="group relative overflow-hidden rounded-md bg-foreground px-4 py-1.5 text-sm font-semibold text-background transition-all hover:opacity-90 hover:shadow-[0_0_20px_-5px_rgba(255,255,255,0.4)]"
          >
            <span className="relative z-10">Launch App</span>
            <div className="absolute inset-0 z-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        </div>

        <button
          className="md:hidden rounded-md border border-border p-2"
          onClick={() => setOpen((s) => !s)}
          aria-label="Menu"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <nav className="container flex flex-col gap-1 py-3">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2 text-sm font-medium",
                    isActive
                      ? "bg-surface text-foreground"
                      : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <ConnectWalletButton className="heliora-wallet w-full" />
              <Link
                to="/markets/create"
                className="rounded-md bg-foreground px-3 py-2 text-center text-sm font-semibold text-background"
              >
                Launch App
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
