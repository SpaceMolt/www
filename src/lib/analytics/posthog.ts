'use client'

/**
 * Cookieless PostHog. Every option here is load-bearing for the privacy stance
 * documented on /privacy and /cookies — read those pages before relaxing any of
 * them, because they promise this configuration in writing:
 *
 *   persistence 'memory'  no cookies, no localStorage -> no consent banner owed
 *   autocapture off       we never ship un-audited DOM text or form values
 *   session recording off would capture player-authored chat and note bodies
 *
 * Analytics is disabled entirely when the token is absent, which is the case in
 * local dev, CI, and preview builds unless someone opts in.
 */
import posthog, { type CaptureResult } from 'posthog-js'

const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || ''
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

let started = false

export function analyticsConfigured(): boolean {
  return TOKEN.length > 0
}

/** True only once init() has actually run, so callers can't queue into a dead SDK. */
export function analyticsReady(): boolean {
  return started
}

/**
 * Drops the query string from any URL-bearing property. `/play` carries
 * `?player=<id>` and the docs carry search terms; neither belongs in analytics,
 * and stripping centrally means no future caller has to remember to.
 */
export function stripQueryStrings(properties: Record<string, unknown>): Record<string, unknown> {
  for (const key of ['$current_url', '$referrer', '$pathname'] as const) {
    const value = properties[key]
    if (typeof value !== 'string') continue
    const cut = value.search(/[?#]/)
    if (cut !== -1) properties[key] = value.slice(0, cut)
  }
  return properties
}

/**
 * Last gate before an event leaves the browser. Runs on every event, including
 * any PostHog generates itself, so URL-borne identifiers can't escape via a
 * property we didn't think to sanitise at the call site.
 *
 * This is `before_send` rather than the older `sanitize_properties`, which the
 * SDK now logs as deprecated — a privacy control shouldn't be sitting on an API
 * scheduled for removal.
 */
export function scrubEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null
  if (event.properties) stripQueryStrings(event.properties)
  return event
}

export function initAnalytics(): void {
  if (started || !analyticsConfigured() || typeof window === 'undefined') return
  started = true
  posthog.init(TOKEN, {
    api_host: HOST,
    persistence: 'memory',
    autocapture: false,
    disable_session_recording: true,
    capture_pageview: false, // App Router client nav doesn't fire this; see usePageviews
    capture_pageleave: false, // pageleave without persistence just yields orphan events

    // `autocapture: false` alone is NOT enough. PostHog fetches a remote config
    // (/array/<token>/config.js) and lazily side-loads extra collectors from it
    // — verified in a browser: surveys.js, dead-clicks-autocapture.js, and
    // web-vitals.js all loaded despite autocapture being off. Those are governed
    // by project settings in the PostHog dashboard, which means someone flipping
    // a toggle in a web UI could silently widen what we collect, with no deploy
    // and no review, while /privacy still claims we don't. Pin it shut in code:
    // the dashboard must not be able to override the policy we publish.
    disable_external_dependency_loading: true,
    disable_surveys: true,
    capture_dead_clicks: false,
    capture_performance: false,
    advanced_disable_flags: true, // we use no feature flags; skips the flags call

    before_send: scrubEvent,
  })
}

/**
 * Idempotent, and safe to call from anywhere. Every public entry point below
 * goes through this rather than trusting the provider's effect to have run
 * first: React fires *child* effects before parent ones, so <Pageviews>' first
 * capture beats <PostHogProvider>'s init and the session's opening pageview
 * would be dropped on the floor. Verified in a browser, not theorised.
 */
function ensureStarted(): boolean {
  if (!started) initAnalytics()
  return started
}

export function capture(event: string, properties?: Record<string, unknown>): void {
  if (!ensureStarted()) return
  posthog.capture(event, properties)
}

/**
 * `playerId` is the opaque game id from usePlayer(). Never pass an email, a
 * character username, or a Clerk id — see the no-PII rule in the design doc.
 */
export function identifyPlayer(playerId: string): void {
  if (!ensureStarted()) return
  posthog.identify(playerId)
}

export function resetIdentity(): void {
  if (!started) return // nothing to reset if we never started
  posthog.reset()
}
