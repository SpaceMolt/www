/**
 * Regression coverage for gh#1885: the Missions panel's Available tab rendered
 * loading / empty / list only and never read the query's `error`, so a failed
 * `get_missions` (most commonly `not_docked`) produced a completely blank tab.
 * Players read the blank tab as "this station has no missions" — which is what
 * was originally reported about Gold Run Extraction Hub.
 *
 * The repo has no React render harness, so these assert on the pure
 * branch-selection and message helpers the panel now renders from.
 */
import { describe, test, expect } from 'bun:test'
import { missionsTabView, missionsErrorText } from './MissionsPanel'

/**
 * The Available tab's pre-fix render conditions, transcribed verbatim from the
 * three JSX guards at MissionsPanel.tsx (loading / data-with-zero / list). Kept
 * as an executable statement of the bug: for the reported input all three are
 * false, so the tab rendered nothing at all.
 */
function preFixBranches(q: { loading: boolean; hasData: boolean; count: number }): string[] {
  const rendered: string[] = []
  if (q.loading && q.count === 0) rendered.push('loading')
  if (q.hasData && q.count === 0 && !q.loading) rendered.push('empty')
  if (q.count > 0) rendered.push('list')
  return rendered
}

describe('gh#1885 the pre-fix Available tab rendered nothing on a failed query', () => {
  test('old branches all miss, new branch selector shows the error', () => {
    // get_missions rejected with not_docked: data undefined, loading finished.
    const failed = { loading: false, error: 'not docked', hasData: false, count: 0 }
    expect(preFixBranches(failed)).toEqual([])
    expect(missionsTabView(failed)).toBe('error')
  })
})

describe('missionsTabView', () => {
  test('a failed query with no data renders the error state, not a blank tab', () => {
    // The reported gh#1885 shape: get_missions rejected with not_docked, so
    // data stayed undefined and the old code matched none of its branches.
    expect(
      missionsTabView({
        loading: false,
        error: 'You must be docked at a station to view missions.',
        hasData: false,
        count: 0,
      }),
    ).toBe('error')
  })

  test('an error never collapses into the "genuinely zero missions" empty state', () => {
    // Stale successful data plus a later failure: the player must see the
    // failure, not "No missions available at this location."
    expect(
      missionsTabView({ loading: false, error: 'boom', hasData: true, count: 0 }),
    ).toBe('error')
  })

  test('docked with genuinely zero missions still renders the empty state', () => {
    expect(
      missionsTabView({ loading: false, error: null, hasData: true, count: 0 }),
    ).toBe('empty')
  })

  test('loading wins over a stale error so no error flashes mid-refetch', () => {
    // useCommandQuery only clears `error` on success, so a refetch after a
    // failure runs with loading=true and error still set.
    expect(
      missionsTabView({ loading: true, error: 'previous failure', hasData: false, count: 0 }),
    ).toBe('loading')
  })

  test('an existing list stays on screen while it refreshes', () => {
    expect(
      missionsTabView({ loading: true, error: null, hasData: true, count: 3 }),
    ).toBe('list')
    expect(
      missionsTabView({ loading: false, error: 'boom', hasData: true, count: 3 }),
    ).toBe('list')
  })

  test('every state combination resolves to a visible branch (never blank)', () => {
    const views = new Set<string>()
    for (const loading of [true, false]) {
      for (const error of [null, 'boom']) {
        for (const hasData of [true, false]) {
          for (const count of [0, 2]) {
            const view = missionsTabView({ loading, error, hasData, count })
            expect(['loading', 'error', 'empty', 'list']).toContain(view)
            views.add(view)
          }
        }
      }
    }
    expect(views.size).toBe(4)
  })
})

describe('missionsErrorText', () => {
  test('not_docked gets the actionable dock-first hint', () => {
    expect(
      missionsErrorText(
        'not_docked',
        "You must be docked at a station to view missions. Use 'dock' to dock at a station first.",
        'available missions',
      ),
    ).toBe('Dock at a station to see the missions it offers.')
  })

  test('other server errors surface the server message rather than silence', () => {
    // e.g. get_missions no_mission_service — the server text is already useful.
    const text = missionsErrorText(
      'no_mission_service',
      'Gold Run Extraction Hub does not offer mission services. Try a larger base or station.',
      'available missions',
    )
    expect(text).toContain('Gold Run Extraction Hub does not offer mission services')
    expect(text).not.toBe('Dock at a station to see the missions it offers.')
  })

  test('a transport failure with no server code still says something useful', () => {
    expect(missionsErrorText(null, 'socket closed', 'completed missions')).toBe(
      'Could not load completed missions: socket closed',
    )
    expect(missionsErrorText(null, null, 'completed missions')).toBe(
      'Could not load completed missions.',
    )
  })

  test('does not string-match a message that merely mentions docking', () => {
    // Guard against regressing to message matching: only the code decides.
    expect(
      missionsErrorText('rate_limited', 'You must be docked to do that', 'available missions'),
    ).not.toBe('Dock at a station to see the missions it offers.')
  })
})
