'use client'

import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  z: number
  color: string
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let stars: Star[] = []
    const speed = 1.5
    const colors = ['#e8f4f8', '#a8c5d6', '#00d4ff', '#ff6b35']
    let animationId: number
    let isVisible = true

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = prefersReducedMotion.matches

    const numStars = reducedMotion ? 100 : 400

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }

    function initStars() {
      const count = reducedMotion ? 100 : numStars
      stars = []
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * canvas!.width - canvas!.width / 2,
          y: Math.random() * canvas!.height - canvas!.height / 2,
          z: Math.random() * canvas!.width,
          color: colors[Math.floor(Math.random() * colors.length)],
        })
      }
    }

    function drawStatic() {
      ctx!.fillStyle = '#0a0e17'
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height)

      const cx = canvas!.width / 2
      const cy = canvas!.height / 2

      for (const star of stars) {
        const sx = (star.x / star.z) * canvas!.width + cx
        const sy = (star.y / star.z) * canvas!.height + cy
        const size = Math.max(0, (1 - star.z / canvas!.width) * 3)
        const opacity = Math.max(0, 1 - star.z / canvas!.width)

        if (sx >= 0 && sx <= canvas!.width && sy >= 0 && sy <= canvas!.height) {
          ctx!.beginPath()
          ctx!.arc(sx, sy, size, 0, Math.PI * 2)
          ctx!.fillStyle = star.color
          ctx!.globalAlpha = opacity
          ctx!.fill()
          ctx!.globalAlpha = 1
        }
      }
    }

    function draw() {
      if (!isVisible || reducedMotion) return

      ctx!.fillStyle = 'rgba(10, 14, 23, 0.2)'
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height)

      const cx = canvas!.width / 2
      const cy = canvas!.height / 2

      for (const star of stars) {
        star.z -= speed
        if (star.z <= 0) {
          star.x = Math.random() * canvas!.width - cx
          star.y = Math.random() * canvas!.height - cy
          star.z = canvas!.width
        }

        const sx = (star.x / star.z) * canvas!.width + cx
        const sy = (star.y / star.z) * canvas!.height + cy
        const size = Math.max(0, (1 - star.z / canvas!.width) * 3)
        const opacity = Math.max(0, 1 - star.z / canvas!.width)

        if (sx >= 0 && sx <= canvas!.width && sy >= 0 && sy <= canvas!.height) {
          ctx!.beginPath()
          ctx!.arc(sx, sy, size, 0, Math.PI * 2)
          ctx!.fillStyle = star.color
          ctx!.globalAlpha = opacity
          ctx!.fill()
          ctx!.globalAlpha = 1
        }
      }

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
