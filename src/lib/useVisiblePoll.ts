import { useEffect, useRef } from 'react'

/**
 * Runs `fn` on an interval, but only while the tab is visible. When the tab is
 * hidden the interval is paused; when it becomes visible again `fn` runs once
 * immediately and the interval resumes.
 *
 * Background tabs otherwise keep polling the gameserver and share the same
 * per-IP rate-limit budget as the foreground tab, so pausing them keeps a stack
 * of idle tabs from tripping the limits.
 *
 * `fn` is not called on mount — callers typically do their own initial fetch so
 * they can manage loading/error state separately.
 */
export function useVisiblePoll(fn: () => void, intervalMs: number) {
  const saved = useRef(fn)
  saved.current = fn

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (timer !== null) return
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') saved.current()
      }, intervalMs)
    }

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        saved.current()
        start()
      } else {
        stop()
      }
    }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])
}
