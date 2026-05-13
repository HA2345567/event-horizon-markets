import { Sidebar } from "@/components/Sidebar"
import { Navbar } from "@/components/Navbar"
import { TableOfContents } from "@/components/TableOfContents"

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background-page">
      <Navbar />
      <div className="container flex-1 items-start lg:grid lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_240px]">
        <Sidebar />
        <main className="relative py-12 lg:gap-10 lg:py-16 xl:grid xl:grid-cols-[1fr_240px]">
          <div className="mx-auto w-full min-w-0 max-w-[720px] px-6 lg:px-8">
            {children}
          </div>
          <TableOfContents />
        </main>
      </div>
    </div>
  )
}
