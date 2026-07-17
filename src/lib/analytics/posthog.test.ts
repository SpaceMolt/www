import { describe, expect, test } from 'bun:test'
import type { CaptureResult } from 'posthog-js'
import { analyticsConfigured, analyticsReady, capture, identifyPlayer, resetIdentity, scrubEvent, stripQueryStrings } from './posthog'

describe('stripQueryStrings', () => {
  test('drops the query string from URL properties', () => {
    expect(
      stripQueryStrings({
        $current_url: 'https://www.spacemolt.com/play?player=plr_abc123',
        $referrer: 'https://www.spacemolt.com/docs?q=mining+guide',
      }),
    ).toEqual({
      $current_url: 'https://www.spacemolt.com/play',
      $referrer: 'https://www.spacemolt.com/docs',
    })
  })

  test('drops the hash too', () => {
    expect(stripQueryStrings({ $current_url: 'https://www.spacemolt.com/docs#section' })).toEqual({
      $current_url: 'https://www.spacemolt.com/docs',
    })
  })

  test('leaves clean URLs and non-URL properties alone', () => {
    expect(stripQueryStrings({ $current_url: 'https://www.spacemolt.com/', command: 'undock' })).toEqual({
      $current_url: 'https://www.spacemolt.com/',
      command: 'undock',
    })
  })

  test('ignores non-string values', () => {
    expect(stripQueryStrings({ $current_url: undefined, duration_ms: 412 })).toEqual({
      $current_url: undefined,
      duration_ms: 412,
    })
  })
})

describe('scrubEvent', () => {
  const event = (properties: Record<string, unknown>) => ({ event: '$pageview', properties }) as unknown as CaptureResult

  test('strips the query string from a real event before it is sent', () => {
    const result = scrubEvent(event({ $current_url: 'https://www.spacemolt.com/play?player=plr_abc123' }))
    expect(result!.properties.$current_url).toBe('https://www.spacemolt.com/play')
  })

  test('passes a null event through (PostHog uses null to drop)', () => {
    expect(scrubEvent(null)).toBeNull()
  })

  test('leaves our own game_action properties intact', () => {
    const result = scrubEvent(event({ command: 'undock', namespace: 'spacemolt', outcome: 'ok', duration_ms: 412 }))
    expect(result!.properties).toEqual({ command: 'undock', namespace: 'spacemolt', outcome: 'ok', duration_ms: 412 })
  })
})

/**
 * The suite runs without NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, which is exactly the
 * local-dev and CI case: every entry point must be inert rather than throwing or
 * queueing into an uninitialised SDK.
 */
describe('with no token configured', () => {
  test('reports itself unconfigured and not ready', () => {
    expect(analyticsConfigured()).toBe(false)
    expect(analyticsReady()).toBe(false)
  })

  test('capture, identify, and reset are inert', () => {
    expect(() => capture('game_action', { command: 'undock' })).not.toThrow()
    expect(() => identifyPlayer('plr_1')).not.toThrow()
    expect(() => resetIdentity()).not.toThrow()
  })

  /**
   * Regression: capture() used to bail when the provider's init effect hadn't
   * run yet. React fires child effects before parent effects, so <Pageviews>
   * always beat <PostHogProvider>'s init and every session lost its opening
   * pageview. capture() must now be safe to call before any explicit init —
   * here that means staying inert rather than throwing on an unstarted SDK.
   */
  test('capture before any explicit init does not throw', () => {
    expect(() => capture('$pageview')).not.toThrow()
    expect(analyticsReady()).toBe(false)
  })
})
