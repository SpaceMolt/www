import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'

// Agent-readability markdown mirrors, layered on top of Clerk's proxy.
//
// Two behaviours:
//   1. `<page>.md`                       -> generated markdown mirror (/api/md)
//   2. `Accept: text/markdown` on <page> -> the same generated markdown
//
// Some `.md` URLs must NOT be rewritten because they are already served as real
// files or by their own route/rewrite:
//   - /skill.md, /api.md, /skills.md   (rewritten to the gameserver)
//   - /sitemap.md                      (own route handler)
//   - /AGENTS.md                       (static file in public/)
//   - /docs/<slug>.md                  (static reference files in public/docs/)
//   - /guides/<slug>.md                (static gameserver-contract files)
// The reference-file passthrough must exclude the doc *pages* that have no
// static file (their mirrors are generated instead).

const GENERATED_DOC_MD = new Set([
  '/docs.md',
  '/docs/getting-started.md',
  '/docs/game-clients.md',
  '/docs/guides.md',
])

function isStaticMarkdown(pathname: string): boolean {
  if (
    pathname === '/skill.md' ||
    pathname === '/api.md' ||
    pathname === '/skills.md' ||
    pathname === '/sitemap.md' ||
    pathname === '/AGENTS.md'
  ) {
    return true
  }
  // Raw guide files (gameserver get_guide contract): /guides/<slug>.md
  if (/^\/guides\/[^/]+\.md$/.test(pathname)) return true
  // Static reference files: /docs/<slug>.md — but not the generated doc pages.
  if (/^\/docs\/[^/]+\.md$/.test(pathname) && !GENERATED_DOC_MD.has(pathname)) {
    return true
  }
  return false
}

function toMirror(req: NextRequest, sitePath: string): NextResponse {
  // Encode the target page in the PATH (not a query param): Clerk's proxy
  // strips the search string from rewrites, but path segments survive.
  const url = new URL(req.url)
  url.search = ''
  url.pathname = sitePath === '/' ? '/api/md' : `/api/md${sitePath}`
  return NextResponse.rewrite(url)
}

/** Returns a markdown-mirror rewrite for this request, or null to continue. */
function markdownMirror(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl

  if (pathname.endsWith('.md')) {
    if (isStaticMarkdown(pathname)) return null
    // Don't intercept the mirror API itself.
    if (pathname.startsWith('/api/')) return null
    const sitePath = pathname.replace(/\.md$/, '') || '/'
    return toMirror(req, sitePath)
  }

  const accept = req.headers.get('accept') || ''
  if (accept.includes('text/markdown') && !pathname.startsWith('/api/')) {
    return toMirror(req, pathname)
  }

  return null
}

export default clerkMiddleware((_auth, req) => {
  const mirror = markdownMirror(req)
  if (mirror) return mirror
  // Otherwise fall through to Clerk's default handling.
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
