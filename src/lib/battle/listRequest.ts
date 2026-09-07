/** The battle list request and commit lifecycle, shared by filter, paging and polling. */
export function createListRequest<T>(callbacks: {
  success: (data: T) => void
  failure: () => void
  settled: () => void
}, timeoutMs = 20_000) {
  let current: AbortController | undefined
  return {
    async run(url: string, background = false) {
      // Polls never interrupt a filter change, load-more request, or another poll.
      if (background && current) return
      current?.abort()
      const controller = new AbortController()
      current = controller
      // Release a stalled request even if fetch or JSON decoding fails to reject on abort.
      const timer = setTimeout(() => {
        if (current !== controller) return
        current = undefined
        controller.abort()
        callbacks.failure()
        callbacks.settled()
      }, timeoutMs)
      controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        // Abort alone is insufficient if an old response was already being decoded.
        if (current === controller) callbacks.success(data)
      } catch {
        if (current === controller) callbacks.failure()
      } finally {
        clearTimeout(timer)
        if (current === controller) {
          current = undefined
          callbacks.settled()
        }
      }
    },
    cancel() {
      current?.abort()
      current = undefined
    },
  }
}

