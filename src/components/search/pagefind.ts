/**
 * Thin typed wrapper around the Pagefind JS API.
 *
 * The index is a build artifact (scripts/build-search-index.mjs writes it to
 * public/pagefind/ after `next build`), so /pagefind/pagefind.js does not exist
 * on disk at compile time and must never be handed to the bundler — hence the
 * ignore comments on the dynamic import below. In `next dev` the file is not
 * there at all and the import rejects; callers surface that as "unavailable"
 * rather than an error.
 */

export interface PagefindResultData {
  /** Derived from the HTML file path, e.g. "/codex/items/tritanium.html". */
  url: string
  /** HTML with <mark> around the matched terms. */
  excerpt: string
  meta: { title?: string } & Record<string, string>
}

export interface PagefindResult {
  id: string
  data: () => Promise<PagefindResultData>
}

interface PagefindApi {
  options: (opts: Record<string, unknown>) => Promise<void>
  search: (query: string) => Promise<{ results: PagefindResult[] }>
}

let pagefindPromise: Promise<PagefindApi> | null = null

/** Loads (once) the Pagefind runtime from the built index. Rejects when there is no index. */
export function loadPagefind(): Promise<PagefindApi> {
  if (!pagefindPromise) {
    pagefindPromise = (async () => {
      const mod = (await import(
        /* webpackIgnore: true */ /* turbopackIgnore: true */
        // @ts-expect-error - build artifact, resolved by the browser at runtime
        '/pagefind/pagefind.js'
      )) as PagefindApi
      await mod.options({ excerptLength: 24 })
      return mod
    })()
    // Don't cache a rejection: a failed first load would otherwise poison every retry.
    pagefindPromise.catch(() => {
      pagefindPromise = null
    })
  }
  return pagefindPromise
}

/**
 * Pagefind derives a result's url from the HTML file it indexed, so results come
 * back as "/codex/items/tritanium.html". Turn that back into a routable href.
 */
export function resultUrlToHref(url: string): string {
  let href = url.split('#')[0].split('?')[0]
  if (!href.startsWith('/')) href = `/${href}`
  if (href.endsWith('/index.html')) {
    href = href.slice(0, -'index.html'.length)
  } else if (href.endsWith('.html')) {
    href = href.slice(0, -'.html'.length)
  }
  // Trailing slash on a nested path is noise; the bare root stays "/".
  if (href.length > 1 && href.endsWith('/')) href = href.slice(0, -1)
  return href === '' ? '/' : href
}

export type SearchSection = 'Codex' | 'Docs' | 'Guides' | 'News' | 'Site'

/** Section is read straight off the URL prefix — no extra Pagefind metadata needed. */
export function sectionForHref(href: string): SearchSection {
  if (href.startsWith('/docs/guides') || href.startsWith('/guides')) return 'Guides'
  if (href.startsWith('/docs')) return 'Docs'
  if (href.startsWith('/codex')) return 'Codex'
  if (href.startsWith('/news')) return 'News'
  return 'Site'
}

/** Fixed display order, so the groups don't reshuffle between queries. */
export const SECTION_ORDER: SearchSection[] = ['Docs', 'Guides', 'Codex', 'News', 'Site']
