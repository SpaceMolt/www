'use client'

import { useEffect, useRef } from 'react'
import { Mail } from 'lucide-react'
import { useTranslation } from '@/i18n'
import styles from './NewsletterSignup.module.css'

const BEEHIIV_FORM_ID = 'e66dd0da-f0a7-4fcb-86e6-3fb13c7aff70'
const LOADER_SRC = 'https://subscribe-forms.beehiiv.com/v3/loader.js'

type Variant = 'compact' | 'section'

/**
 * Public, anonymous newsletter signup using the beehiiv hosted subscribe form.
 * The v3 loader inserts the form's iframe adjacent to its own <script> tag, so we
 * append the loader into our own container ref — the form then renders in place.
 *
 * The loader supports multiple instances per page (keyed by form ID) and guards
 * each tag with data-bhv-initialized, so the same embed can appear in the footer,
 * a homepage section, and page-bottom blocks at once. Re-appending on each mount
 * keeps the form working across Next.js client-side navigation.
 *
 * Form fields and styling are configured in the beehiiv dashboard.
 */
export function NewsletterSignup({ variant = 'section' }: { variant?: Variant }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = ref.current
    if (!host) return
    // Don't stack duplicate scripts if the effect re-runs (e.g. React strict mode).
    if (host.querySelector('script[data-beehiiv-form]')) return
    const script = document.createElement('script')
    script.src = LOADER_SRC
    script.async = true
    script.setAttribute('data-beehiiv-form', BEEHIIV_FORM_ID)
    host.appendChild(script)
    // On unmount, drop the loader script we added so client-side navigation
    // re-injects cleanly. The injected form iframe is a child of `host`, which
    // React removes with the component, so no orphaned forms remain.
    return () => { script.remove() }
  }, [])

  if (variant === 'compact') {
    return (
      <div className={styles.compact}>
        <span className={styles.compactLabel}>
          <Mail size={14} />
          {t('newsletter.footerLabel')}
        </span>
        <div ref={ref} className={styles.embedHost} />
      </div>
    )
  }

  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.sectionInner}>
          <h2 className={styles.title}>{t('newsletter.title')}</h2>
          <p className={styles.subtitle}>{t('newsletter.subtitle')}</p>
          <div ref={ref} className={styles.embedHost} />
        </div>
      </div>
    </section>
  )
}
