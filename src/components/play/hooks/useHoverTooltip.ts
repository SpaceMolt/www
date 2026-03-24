import { useState, useRef, useCallback, useEffect } from 'react'

interface UseHoverTooltipOptions {
  delay?: number
  width?: number
}

export function useHoverTooltip(options: UseHoverTooltipOptions = {}) {
  const { delay = 200, width = 320 } = options
  const [show, setShow] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback(() => {
    timer.current = setTimeout(() => {
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
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    setShow(false)
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  useEffect(() => {
    if (!show) return
    const close = () => setShow(false)
    window.addEventListener('scroll', close, true)
    return () => window.removeEventListener('scroll', close, true)
  }, [show])

  return { ref, show, position, handleMouseEnter, handleMouseLeave }
}
