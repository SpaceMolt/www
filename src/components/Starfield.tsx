'use client'

import { useEffect, useRef } from 'react'
import {
  createStars,
  drawAnimatedFrame,
  drawStaticFrame,
  type Star,
} from './starfieldRender'

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let stars: Star[] = []
    const speed = 1.5
    let animationId: number
    let isVisible = true

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = prefersReducedMotion.matches

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }

    function initStars() {
      stars = createStars(reducedMotion ? 100 : 400, canvas!.width, canvas!.height)
    }

    function drawStatic() {
      drawStaticFrame(ctx!, stars, canvas!.width, canvas!.height)
    }

    function draw() {
      if (!isVisible || reducedMotion) return
      drawAnimatedFrame(ctx!, stars, canvas!.width, canvas!.height, speed)
      animationId = requestAnimationFrame(draw)
    }

    const handleResize = () => {
      resize()
      initStars()
      if (reducedMotion) {
        drawStatic()
      }
    }

    // Handle reduced motion changes
    function handleMotionChange(e: MediaQueryListEvent) {
      reducedMotion = e.matches
      if (reducedMotion) {
        cancelAnimationFrame(animationId)
        initStars()
        drawStatic()
      } else {
        initStars()
        draw()
      }
    }

    // Handle page visibility changes
    function handleVisibilityChange() {
      if (document.hidden) {
        isVisible = false
        cancelAnimationFrame(animationId)
      } else {
        isVisible = true
        if (!reducedMotion) {
          draw()
        }
      }
    }

    window.addEventListener('resize', handleResize)
    prefersReducedMotion.addEventListener('change', handleMotionChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    resize()
    initStars()

    if (reducedMotion) {
      drawStatic()
    } else {
      draw()
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      prefersReducedMotion.removeEventListener('change', handleMotionChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <div className="starfield">
      <canvas ref={canvasRef} />
    </div>
  )
}
