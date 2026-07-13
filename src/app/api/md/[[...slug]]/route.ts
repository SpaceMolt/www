import type { NextRequest } from 'next/server'
import { resolveMirror, renderMirror, canonicalUrlFor } from '@/lib/markdown-mirror'

// Serves the plain-markdown mirror of a page. The proxy rewrites both
// `<page>.md` requests and `Accept: text/markdown` requests to
// `/api/md/<page path>` (path-based so the target survives Clerk's proxy).

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug?: string[] }> }

async function sitePathFrom(ctx: Ctx): Promise<string> {
  const { slug } = await ctx.params
  if (!slug || slug.length === 0) return '/'
  return '/' + slug.map((s) => decodeURIComponent(s)).join('/')
}

function build(sitePath: string): { body: string; canonical: string } | null {
  const mirror = resolveMirror(sitePath)
  if (!mirror) return null
  return {
    body: renderMirror(mirror),
    canonical: canonicalUrlFor(mirror.canonicalPath),
  }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const result = build(await sitePathFrom(ctx))
  if (!result) {
    return new Response('# Not found\n\nNo markdown mirror exists for this path.\n', {
      status: 404,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    })
  }
  return new Response(result.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Link: `<${result.canonical}>; rel="canonical"`,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}

export async function HEAD(_req: NextRequest, ctx: Ctx) {
  const result = build(await sitePathFrom(ctx))
  if (!result) {
    return new Response(null, { status: 404 })
  }
  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Link: `<${result.canonical}>; rel="canonical"`,
    },
  })
}
