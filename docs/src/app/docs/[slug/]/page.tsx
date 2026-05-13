import { notFound } from "next/navigation"
import { allDocs } from "contentlayer/generated"
import { useMDXComponent } from "next-contentlayer/hooks"
import { components } from "@/components/MDXComponents"
import { ChevronRight, Github } from "lucide-react"
import Link from "next/link"

interface DocPageProps {
  params: {
    slug: string
  }
}

async function getDocFromParams(slug: string) {
  const doc = allDocs.find((doc) => doc.slugAsParams === slug)

  if (!doc) {
    return null
  }

  return doc
}

export async function generateStaticParams() {
  return allDocs.map((doc) => ({
    slug: doc.slugAsParams,
  }))
}

export default async function DocPage({ params }: DocPageProps) {
  const doc = await getDocFromParams(params.slug)

  if (!doc) {
    notFound()
  }

  const MDXContent = useMDXComponent(doc.body.code)

  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-8 flex items-center gap-2 text-sm text-foreground-muted">
        <span>Docs</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground-primary">{doc.title}</span>
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-foreground-primary mb-4">
        {doc.title}
      </h1>
      <p className="text-lg text-foreground-secondary mb-12">
        {doc.description}
      </p>
      
      <MDXContent components={components} />

      <hr className="my-12 border-border" />
      
      <div className="flex items-center justify-between">
        <Link
          href="https://github.com/heliora/docs/edit/main/content/docs/introduction.mdx"
          target="_blank"
          className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground-primary"
        >
          <Github className="h-4 w-4" />
          Edit this page on GitHub
        </Link>
        <span className="text-sm text-foreground-muted">
          Last updated: May 2024
        </span>
      </div>
    </article>
  )
}
