'use client'

import { usePathname } from 'next/navigation'

// Advertises each page's plain-markdown mirror so AI agents can find it:
//   <link rel="alternate" type="text/markdown" href="/<page>.md">
// React hoists this <link> into <head> in the server-rendered HTML. The href is
// per-page (usePathname), and the mirror itself is served by middleware -> /api/md.
export function MarkdownAlternate() {
  const pathname = usePathname() || '/'
  const clean = pathname.replace(/\/+$/, '')
  const href = clean === '' ? '/index.md' : `${clean}.md`
  return <link rel="alternate" type="text/markdown" href={href} />
}
