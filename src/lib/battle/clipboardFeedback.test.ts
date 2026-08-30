import { describe, expect, it, spyOn } from 'bun:test'
import { createClipboardFeedback, writeClipboardText, type ClipboardStatus } from './clipboardFeedback'

describe('battle link clipboard feedback', () => {
  it('reports unavailable and rejected clipboard writes as failures', async () => {
    expect(await writeClipboardText(undefined, 'link')).toBe(false)
    expect(await writeClipboardText({ writeText: async () => { throw new Error('denied') } }, 'link')).toBe(false)
  })

  it('waits for the actual clipboard write before reporting success', async () => {
    let finish!: () => void
    const statuses: ClipboardStatus[] = []
    const feedback = createClipboardFeedback(
      () => writeClipboardText({ writeText: () => new Promise<void>(resolve => { finish = resolve }) }, 'link'),
      status => statuses.push(status),
    )
    const copying = feedback.copy()
    expect(statuses).toEqual(['copying'])
    finish()
    await copying
    expect(statuses).toEqual(['copying', 'copied'])
    feedback.dispose()
  })

  it('shows failure instead of success when a callback rejects or returns false', async () => {
    for (const copy of [async () => false, async (): Promise<boolean> => { throw new Error('denied') }]) {
      const statuses: ClipboardStatus[] = []
      const feedback = createClipboardFeedback(copy, status => statuses.push(status))
      await feedback.copy()
      expect(statuses).toEqual(['copying', 'failed'])
      feedback.dispose()
    }
  })

  it('ignores repeated pending clicks and completion after unmount or battle reset', async () => {
    let finish!: (success: boolean) => void
    let writes = 0
    const statuses: ClipboardStatus[] = []
    const feedback = createClipboardFeedback(() => {
      writes++
      return new Promise<boolean>(resolve => { finish = resolve })
    }, status => statuses.push(status))
    const copying = feedback.copy()
    await feedback.copy()
    expect(writes).toBe(1)
    feedback.dispose()
    finish(true)
    await copying
    await feedback.copy()
    expect(writes).toBe(1)
    expect(statuses).toEqual(['copying'])
  })

  it('clears the previous feedback timer on another copy and on teardown', async () => {
    const clearTimer = spyOn(globalThis, 'clearTimeout')
    const feedback = createClipboardFeedback(async () => true, () => {})
    try {
      await feedback.copy()
      await feedback.copy()
      expect(clearTimer).toHaveBeenCalledTimes(1)
      feedback.dispose()
      expect(clearTimer).toHaveBeenCalledTimes(2)
    } finally {
      feedback.dispose()
      clearTimer.mockRestore()
    }
  })
})
