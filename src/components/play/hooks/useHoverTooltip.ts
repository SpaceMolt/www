import { useState, useRef, useCallback, useEffect } from 'react'

interface UseHoverTooltipOptions {
  delay?: number
  width?: number
  /** Grace period (ms) before closing after the pointer leaves, so the user can move onto the tooltip body. */
  closeDelay?: number
}

/**
 * Decide whether a captured scroll event should dismiss the tooltip.
 * Scrolling *inside* the tooltip body (e.g. to reach overflowing content) must
 * NOT close it — only scrolling elsewhere on the page should. (dc#211282)
 */
export function shouldCloseOnScroll(scrollTarget: Node | null, tooltipEl: Node | null): boolean {
  if (scrollTarget && tooltipEl && tooltipEl.contains(scrollTarget)) return false
  return true
}

export function useHoverTooltip(options: UseHoverTooltipOptions = {}) {
  const { delay = 200, width = 320, closeDelay = 150 } = options
  const [show, setShow] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null }
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
  }, [])

  const handleMouseEnter = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    openTimer.current = setTimeout(() => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      let left = rect.left
      let top = rect.bottom + 8
      if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
      if (top + 200 > window.innerHeight) top = Math.max(8, rect.top - 200 - 8)
      setPosition({ top, left })
      setShow(true)
    }, delay)
  }, [delay, width])

  const handleMouseLeave = useCallback(() => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null }
    // Grace delay so the pointer can travel onto the tooltip body without closing it.
    closeTimer.current = setTimeout(() => setShow(false), closeDelay)
  }, [closeDelay])

  // Spread onto the tooltip element so hovering its body keeps it open (and scrollable).
  const tooltipProps = {
    ref: tooltipRef,
    onMouseEnter: () => {
      if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    },
    onMouseLeave: handleMouseLeave,
  }

  useEffect(() => () => clearTimers(), [clearTimers])

  useEffect(() => {
    if (!show) return
    const close = (e: Event) => {
      // Don't close when the scroll happens inside the tooltip body itself.
      if (shouldCloseOnScroll(e.target as Node | null, tooltipRef.current)) setShow(false)
    }
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [show])

  return { ref, show, position, handleMouseEnter, handleMouseLeave, tooltipProps }
}
