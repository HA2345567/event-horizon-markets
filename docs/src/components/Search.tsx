"use client"

import { useEffect, useState, useRef } from "react"
import { Search as SearchIcon, X, Command } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Fuse from "fuse.js"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

// Mock data for search - in production this would come from a generated index
const searchData = [
  { title: "Introduction", excerpt: "What is Heliora — an AI-Native Prediction Protocol on Solana.", href: "/docs/introduction", section: "Getting Started" },
  { title: "How It Works", excerpt: "End-to-end flow diagram of the Kalshi to Solana pipeline.", href: "/docs/how-it-works", section: "Getting Started" },
  { title: "AI Agents", excerpt: "Details on Scout, Creator, Market Maker, and Resolution Agents.", href: "/docs/ai-agents", section: "Core Concepts" },
  { title: "Agent SDK", excerpt: "Installation and API reference for @heliora/agent-sdk.", href: "/docs/agent-sdk", section: "Technical Docs" },
  { title: "Smart Contract", excerpt: "On-chain architecture and instructions for the Heliora program.", href: "/docs/smart-contract", section: "Technical Docs" },
  { title: "FAQ", excerpt: "Frequently asked questions about Heliora, legal, and resolution.", href: "/docs/faq", section: "More" },
]

export function SearchModal({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (open: boolean) => void }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState(searchData)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const fuse = new Fuse(searchData, {
    keys: ["title", "excerpt", "section"],
    threshold: 0.3,
  })

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setQuery("")
      setResults(searchData)
    }
  }, [isOpen])

  useEffect(() => {
    if (query) {
      const searchResults = fuse.search(query).map(r => r.item)
      setResults(searchResults)
    } else {
      setResults(searchData)
    }
    setActiveIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      setActiveIndex((prev) => (prev + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length)
    } else if (e.key === "Enter" && results[activeIndex]) {
      handleSelect(results[activeIndex].href)
    } else if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  const handleSelect = (href: string) => {
    router.push(href)
    setIsOpen(false)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-[640px] overflow-hidden rounded-xl border border-border bg-background-card shadow-2xl"
          >
            <div className="flex items-center border-b border-border px-4">
              <SearchIcon className="h-5 w-5 text-foreground-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search documentation..."
                className="h-14 w-full bg-transparent px-4 text-sm outline-none placeholder:text-foreground-muted"
              />
              <button
                onClick={() => setIsOpen(false)}
                className="rounded border border-border p-1 text-foreground-muted hover:text-foreground-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-2">
              {results.length > 0 ? (
                results.map((result, i) => (
                  <button
                    key={result.href}
                    onClick={() => handleSelect(result.href)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      "flex w-full items-start gap-4 rounded-lg p-4 text-left transition-colors",
                      i === activeIndex ? "bg-accent/10" : "hover:bg-white/5"
                    )}
                  >
                    <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background-page">
                      <SearchIcon className="h-4 w-4 text-foreground-muted" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground-primary">{result.title}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                          {result.section}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-foreground-secondary line-clamp-1">
                        {result.excerpt}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-foreground-muted">
                  No results found for "{query}"
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border bg-white/5 px-4 py-3 text-[11px] text-foreground-muted">
              <div className="flex gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-background-page px-1">ENTER</kbd> to select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-background-page px-1">↑↓</kbd> to navigate
                </span>
              </div>
              <div className="flex items-center gap-1">
                Powered by <span className="font-bold text-accent">Fuse.js</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
