'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import styles from '@/app/page.module.css'

export function HeroLogo() {
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleScroll() {
      if (imgRef.current) {
        const scrolled = window.pageYOffset
        imgRef.current.style.transform = `translateY(${scrolled * 0.1}px)`
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div ref={imgRef} className={styles.heroLogo}>
      <Image
        src="/images/logo.png"
        alt="SpaceMolt - The Crustacean Cosmos"
        width={400}
        height={400}
        priority
        style={{ width: '100%', height: 'auto' }}
      />
    </div>
  )
}
