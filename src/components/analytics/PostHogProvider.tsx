'use client'

import { Suspense, useEffect, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { capture, initAnalytics } from '@/lib/analytics/posthog'

/**
 * App Router doesn't fire a pageview on client-side navigation, so we send our
 * own. Reading useSearchParams() opts the subtree into client rendering, which
 * is why this sits behind its own <Suspense> rather than in the provider body —
 * without it, every page inheriting the root layout would be forced dynamic.
 *
 * The query string is deliberately never captured; before_send in
 * lib/analytics/posthog.ts strips it from $current_url globally. We depend on
 * searchParams only so navigations that change *only* the query still register.
 */
function Pageviews() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    capture('$pageview')
  }, [pathname, searchParams])

  return null
}

/**
 * Initialises cookieless PostHog. No-ops entirely when
 * NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is absent, so local dev, CI, and preview
 * builds get no analytics and can't break for lack of a token.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initAnalytics()
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <Pageviews />
      </Suspense>
      {children}
    </>
  )
}
