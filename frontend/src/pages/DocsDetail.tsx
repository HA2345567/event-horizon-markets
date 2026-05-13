import { useParams, Navigate, Link, useLocation } from "react-router-dom";
import { Suspense, lazy, useMemo } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Loader2, ArrowLeft, ChevronRight, BookOpen, Search, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

// Layout constants
const SIDEBAR = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", slug: "introduction" },
      { title: "Quickstart", slug: "getting-started" },
      { title: "How it Works", slug: "how-it-works" },
    ]
  },
  {
    title: "Core Protocol",
    items: [
      { title: "Architecture", slug: "architecture" },
      { title: "Smart Contract", slug: "smart-contract" },
      { title: "Resolution System", slug: "resolution-system" },
    ]
  },
  {
    title: "AI Ecosystem",
    items: [
      { title: "Autonomous Agents", slug: "ai-agents" },
      { title: "Agent SDK", slug: "agent-sdk" },
      { title: "Copy Trading", slug: "copy-trading" },
    ]
  },
  {
    title: "Resources",
    items: [
      { title: "Roadmap", slug: "roadmap" },
      { title: "FAQ", slug: "faq" },
    ]
  },
  {
    title: "Legal",
    items: [
      { title: "Privacy Policy", slug: "privacy" },
      { title: "Terms of Service", slug: "terms" },
    ]
  }
];


import { MDXComponents } from "@/components/docs/MDXComponents";

// Dynamically import MDX files
const mdxPages = import.meta.glob("../content/docs/*.mdx");

export default function DocsDetail() {
  const { slug: slugParam } = useParams();
  const { pathname } = useLocation();

  const slug = useMemo(() => {
    if (slugParam) return slugParam;
    if (pathname === "/privacy") return "privacy";
    if (pathname === "/terms") return "terms";
    return "introduction";
  }, [slugParam, pathname]);

  const Content = useMemo(() => {
    const path = `../content/docs/${slug}.mdx`;
    if (mdxPages[path]) {
      return lazy(mdxPages[path] as any);
    }
    return null;
  }, [slug]);

  if (!Content) {
    return <Navigate to="/404" replace />;
  }

  return (
    <PageShell>
      <div className="container relative py-10">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0 space-y-8 sticky top-24 self-start">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search docs..." 
                className="w-full bg-surface border border-border rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
                readOnly
                onClick={() => toast.info("Search coming soon (CMD+K)")}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-background text-[10px] font-mono text-muted-foreground pointer-events-none">
                <Command className="h-2 w-2" />K
              </div>
            </div>

            <nav className="space-y-6">
              {SIDEBAR.map((group) => (
                <div key={group.title}>
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{group.title}</h4>
                  <ul className="space-y-1">
                    {group.items.map((item) => (
                      <li key={item.slug}>
                        <Link
                          to={`/docs/${item.slug}`}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all",
                            slug === item.slug 
                              ? "bg-foreground/5 text-foreground font-semibold" 
                              : "text-muted-foreground hover:text-foreground hover:bg-surface"
                          )}
                        >
                          {item.slug === slug && <div className="h-1 w-1 rounded-full bg-foreground" />}
                          {item.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6 uppercase tracking-wider font-mono">
              <Link to="/developers" className="hover:text-foreground transition-colors">Developers</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground/60">Documentation</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground">{slug.replace(/-/g, ' ')}</span>
            </div>

            <article className="prose prose-invert prose-heliora max-w-none">
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              }>
                <Content components={MDXComponents} />
              </Suspense>
            </article>


            {/* Pagination */}
            <div className="mt-20 pt-10 border-t border-border flex items-center justify-between">
              <Link 
                to="/docs/introduction" 
                className="group flex flex-col gap-2 text-left"
              >
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Previous</span>
                <span className="flex items-center gap-1 font-display text-lg">
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                  Introduction
                </span>
              </Link>
              <Link 
                to="/docs/architecture" 
                className="group flex flex-col gap-2 text-right"
              >
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Next</span>
                <span className="flex items-center justify-end gap-1 font-display text-lg">
                  Architecture
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </div>
          </main>

          {/* TOC (Desktop only) */}
          <aside className="hidden xl:block w-56 shrink-0 sticky top-24 self-start">
            <div className="pl-6 border-l border-border">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                <BookOpen className="h-3 w-3" /> On this page
              </h4>
              <ul className="space-y-3 text-xs text-muted-foreground font-medium">
                <li className="text-foreground">Overview</li>
                <li className="hover:text-foreground transition-colors cursor-pointer">Protocol Mechanics</li>
                <li className="hover:text-foreground transition-colors cursor-pointer">The Hybrid Engine</li>
                <li className="hover:text-foreground transition-colors cursor-pointer">Security & Audits</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
