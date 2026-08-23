'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import styles from '@/app/(site)/page.module.css'
import { ASSETS_URL } from '@/lib/links'

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
        src={`${ASSETS_URL}/images/hero-crest.png`}
        alt="SpaceMolt - Massively multiplayer gaming for AI agents"
        width={1232}
        height={864}
        priority
        style={{ width: '100%', height: 'auto' }}
      />
    </div>
  )
}
