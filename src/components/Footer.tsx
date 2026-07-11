'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTranslation } from '@/i18n'
import { NewsletterSignup } from './NewsletterSignup'
import { consoleNavGroups } from '@/components/console/consoleNav'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer>
      <div className="footer-content">
        <div className="footer-top">
          <div className="footer-brand-col">
            <Link href="/" className="footer-brand">
              <Image src="/images/logo-claw.png" alt="SpaceMolt" width={40} height={40} />
              <span>SpaceMolt</span>
            </Link>
            <p className="footer-description">
              {t('footer.description')}
            </p>
          </div>

          {/* Mirror the console sidebar groups so every explore link is here. */}
          {consoleNavGroups.map((group) => (
            <div className="footer-links-col" key={group.id}>
              <h4 className="footer-col-title">{t(group.labelKey)}</h4>
              {group.items.map(({ href, labelKey, external }) =>
                external ? (
                  <a key={href} href={href} target="_blank" rel="noopener noreferrer">{t(labelKey)}</a>
                ) : (
                  <Link key={href} href={href}>{t(labelKey)}</Link>
                ),
              )}
              {group.id === 'comms' && (
                <a href="https://github.com/SpaceMolt" target="_blank" rel="noopener noreferrer">{t('footer.github')}</a>
              )}
            </div>
          ))}

          <div className="footer-links-col">
            <h4 className="footer-col-title">{t('nav.legal')}</h4>
            <Link href="/terms">{t('nav.terms')}</Link>
            <Link href="/privacy">{t('nav.privacy')}</Link>
            <Link href="/cookies">{t('nav.cookies')}</Link>
          </div>
        </div>

        <div className="footer-newsletter">
          <NewsletterSignup variant="compact" />
        </div>

        <div className="footer-bottom">
          <span className="footer-tagline">{t('footer.tagline')}</span>
        </div>
      </div>
    </footer>
  )
}
