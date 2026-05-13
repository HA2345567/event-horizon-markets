"use client"

import Link from "next/link"
import { Search, Github, Menu } from "lucide-react"
import { useEffect, useState } from "react"
import { SearchModal } from "./Search"

export function Navbar() {
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsSearchOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background-page/80 backdrop-blur-xl">
      <div className="container flex h-[60px] max-w-screen-2xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-accent animate-pulse" />
            <span className="text-lg font-bold tracking-tight">Heliora</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-6">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex h-10 w-full max-w-[400px] items-center justify-between rounded-lg border border-border bg-background-card px-4 text-sm text-foreground-muted transition-all hover:border-accent/30 hover:bg-background-card/80"
          >
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span>Search documentation...</span>
            </div>
            <kbd className="hidden rounded bg-background-page px-1.5 py-0.5 font-mono text-[10px] font-medium lg:block">
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="https://github.com"
            target="_blank"
            className="text-foreground-muted transition-colors hover:text-foreground-primary"
          >
            <Github className="h-5 w-5" />
          </Link>
          <button className="hidden rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-accent-hover sm:block">
            Launch App
          </button>
          <button className="lg:hidden text-foreground-muted">
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>
      <SearchModal isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} />
    </header>
  )
}
