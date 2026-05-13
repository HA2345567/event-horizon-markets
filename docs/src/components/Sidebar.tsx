"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navigation = [
  {
    title: "GETTING STARTED",
    links: [
      { title: "Introduction", href: "/docs/introduction" },
      { title: "How It Works", href: "/docs/how-it-works" },
      { title: "Quick Start", href: "/docs/getting-started" },
    ],
  },
  {
    title: "CORE CONCEPTS",
    links: [
      { title: "AI Agents", href: "/docs/ai-agents" },
      { title: "Resolution System", href: "/docs/resolution-system" },
      { title: "Copy Trading", href: "/docs/copy-trading" },
    ],
  },
  {
    title: "TECHNICAL DOCS",
    links: [
      { title: "Architecture", href: "/docs/architecture" },
      { title: "Agent SDK", href: "/docs/agent-sdk" },
      { title: "Smart Contract", href: "/docs/smart-contract" },
    ],
  },
  {
    title: "MORE",
    links: [
      { title: "Roadmap", href: "/docs/roadmap" },
      { title: "FAQ", href: "/docs/faq" },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed top-[60px] hidden h-[calc(100vh-60px)] w-[240px] overflow-y-auto border-r border-border bg-background-sidebar py-8 lg:block">
      <nav className="space-y-8 px-6">
        {navigation.map((section) => (
          <div key={section.title}>
            <h5 className="mb-4 text-[11px] font-bold tracking-widest text-foreground-muted">
              {section.title}
            </h5>
            <ul className="space-y-2">
              {section.links.map((link) => {
                const isActive = pathname === link.href
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        "group flex items-center border-l-2 py-1.5 pl-4 text-sm transition-all",
                        isActive
                          ? "border-accent bg-accent/5 text-foreground-primary font-medium"
                          : "border-transparent text-foreground-muted hover:text-foreground-secondary hover:border-border"
                      )}
                    >
                      {link.title}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
