'use client'

import Image from 'next/image'
import { Expand } from 'lucide-react'
import { useState } from 'react'
import styles from './itemArtwork.module.css'

export default function ItemArtwork({ src, name, preview = false }: {
  src: string
  name: string
  preview?: boolean
}) {
  const [failed, setFailed] = useState(false)
  if (failed) return null

  return (
    <a className={styles.artwork} href={src} target="_blank" rel="noopener noreferrer"
      aria-label={`View full-size artwork of ${name} (opens in a new tab)`}>
      <Image src={src} alt={name} width={1024} height={1024}
        sizes="(max-width: 720px) 100vw, (max-width: 1200px) 42vw, 480px"
        priority unoptimized={preview} onError={() => setFailed(true)} />
      <span className={styles.expand}><Expand size={13} aria-hidden /> View full size</span>
    </a>
  )
}
