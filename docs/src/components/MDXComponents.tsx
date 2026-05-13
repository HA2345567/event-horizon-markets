"use client"

import { Info, AlertTriangle, CheckCircle, Flame, Copy, Check } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export const Callout = ({ children, type = "info" }: { children: React.ReactNode, type?: "info" | "warning" | "tip" | "danger" }) => {
  const icons = {
    info: <Info className="h-5 w-5 text-blue-400" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-400" />,
    tip: <CheckCircle className="h-5 w-5 text-accent" />,
    danger: <Flame className="h-5 w-5 text-red-400" />,
  }

  const styles = {
    info: "border-blue-500/20 bg-blue-500/5",
    warning: "border-amber-500/20 bg-amber-500/5",
    tip: "border-accent/20 bg-accent/5",
    danger: "border-red-500/20 bg-red-500/5",
  }

  return (
    <div className={cn("my-6 flex gap-4 rounded-lg border p-4", styles[type])}>
      <div className="mt-0.5">{icons[type]}</div>
      <div className="text-[14px] leading-relaxed text-foreground-secondary">{children}</div>
    </div>
  )
}

export const CodeBlock = ({ children, language, filename }: { children: string, language?: string, filename?: string }) => {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative my-6 overflow-hidden rounded-lg border border-border bg-code-bg">
      <div className="flex items-center justify-between border-b border-border bg-white/5 px-4 py-2">
        <span className="text-[11px] font-medium text-foreground-muted uppercase tracking-wider">
          {filename || language || "code"}
        </span>
        <button
          onClick={copy}
          className="text-foreground-muted transition-colors hover:text-foreground-primary"
        >
          {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[13px] leading-relaxed font-mono">
        <code>{children}</code>
      </pre>
    </div>
  )
}

export const AgentCard = ({ name, schedule, status, children }: { name: string, schedule: string, status: string, children: React.ReactNode }) => {
  return (
    <div className="my-6 rounded-xl border border-border bg-background-card p-6 shadow-premium transition-transform hover:-translate-y-1">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-lg font-bold text-foreground-primary">{name}</h4>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
            {schedule}
          </span>
          <div className="flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 border border-accent/20">
            <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider">{status}</span>
          </div>
        </div>
      </div>
      <div className="text-sm text-foreground-secondary leading-relaxed">{children}</div>
    </div>
  )
}

export const Tabs = ({ items, children }: { items: string[], children: React.ReactNode[] }) => {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <div className="my-6">
      <div className="flex border-b border-border">
        {items.map((item, i) => (
          <button
            key={item}
            onClick={() => setActiveTab(i)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[2px]",
              activeTab === i
                ? "border-accent text-foreground-primary"
                : "border-transparent text-foreground-muted hover:text-foreground-secondary"
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="py-4">{children[activeTab]}</div>
    </div>
  )
}

export const APIMethod = ({ method, endpoint }: { method: string, endpoint: string }) => {
  const colors = {
    GET: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    POST: "text-accent bg-accent/10 border-accent/20",
    PUT: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    DELETE: "text-red-400 bg-red-400/10 border-red-400/20",
  }

  return (
    <div className="my-4 flex items-center gap-3 font-mono text-[13px]">
      <span className={cn("rounded border px-2 py-0.5 font-bold", colors[method as keyof typeof colors])}>
        {method}
      </span>
      <span className="text-foreground-secondary">{endpoint}</span>
    </div>
  )
}

export const components = {
  Callout,
  CodeBlock,
  AgentCard,
  Tabs,
  APIMethod,
}
