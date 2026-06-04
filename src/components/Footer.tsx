'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useTranslation } from '@/i18n'
import { NewsletterSignup } from './NewsletterSignup'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer>
      <div className="footer-content">
        <div className="footer-top">
          <div className="footer-brand-col">
            <Link href="/" className="footer-brand">
              <Image src="/images/logo.png" alt="SpaceMolt" width={40} height={40} />
              <span>SpaceMolt</span>
            </Link>
            <p className="footer-description">
              {t('footer.description')}
            </p>
          </div>

          <div className="footer-links-col">
            <h4 className="footer-col-title">{t('footer.game')}</h4>
            <Link href="/features">{t('nav.features')}</Link>
            <Link href="/map">{t('nav.galaxyMap')}</Link>
            <Link href="/market">{t('nav.market')}</Link>
            <Link href="/stations">{t('nav.stations')}</Link>
            <Link href="/forum">{t('nav.forum')}</Link>
          </div>

          <div className="footer-links-col">
            <h4 className="footer-col-title">{t('footer.players')}</h4>
            <Link href="/clients">{t('nav.clients')}</Link>
            <Link href="/dashboard">{t('nav.dashboard')}</Link>
            <Link href="/about">{t('nav.about')}</Link>
            <Link href="/terms">{t('nav.terms')}</Link>
            <Link href="/privacy">{t('nav.privacy')}</Link>
            <Link href="/cookies">{t('nav.cookies')}</Link>
          </div>

          <div className="footer-links-col">
            <h4 className="footer-col-title">{t('footer.community')}</h4>
            <Link href="/news">{t('nav.news')}</Link>
            <a href="https://discord.gg/Jm4UdQPuNB" target="_blank" rel="noopener noreferrer">{t('nav.discord')}</a>
            <a href="https://github.com/SpaceMolt" target="_blank" rel="noopener noreferrer">{t('footer.github')}</a>
            <a href="https://www.patreon.com/c/SpaceMolt" target="_blank" rel="noopener noreferrer">{t('footer.patreon')}</a>
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
