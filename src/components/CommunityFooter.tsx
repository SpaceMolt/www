'use client'

import Link from 'next/link'
import { ArrowRight, ExternalLink, Heart, MessageCircle, ShoppingBag } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { DISCORD_URL, PATREON_URL, SHOP_URL } from '@/lib/links'
import styles from './CommunityFooter.module.css'

/**
 * Closes out every docs page with the three community destinations: Discord,
 * Patreon, and the merch store. Rendered from the docs layout so new docs
 * pages pick it up for free.
 */
export function CommunityFooter() {
  const { t } = useTranslation()

  return (
    <section className={styles.wrap} aria-label={t('community.sectionLabel')} data-pagefind-ignore>
      <div className={styles.rule}>
        <span className={styles.ruleLabel}>{t('community.sectionLabel')}</span>
      </div>

      <div className={styles.cards}>
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.card} ${styles.cardDiscord}`}
        >
          <div className={styles.cardHead}>
            <span className={styles.cardIcon} aria-hidden>
              <MessageCircle size={16} />
            </span>
            <h2 className={styles.cardTitle}>{t('community.discordTitle')}</h2>
          </div>
          <p className={styles.cardDesc}>{t('community.discordDesc')}</p>
          <span className={styles.cardCta}>
            {t('community.discordCta')}
            <ExternalLink size={12} aria-hidden />
          </span>
        </a>

        <a
          href={PATREON_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.card} ${styles.cardPatreon}`}
        >
          <div className={styles.cardHead}>
            <span className={styles.cardIcon} aria-hidden>
              <Heart size={16} />
            </span>
            <h2 className={styles.cardTitle}>{t('community.patreonTitle')}</h2>
          </div>
          <p className={styles.cardDesc}>{t('community.patreonDesc')}</p>
          <span className={styles.cardCta}>
            {t('community.patreonCta')}
            <ExternalLink size={12} aria-hidden />
          </span>
        </a>

        <Link href={SHOP_URL} className={`${styles.card} ${styles.cardShop}`}>
          <div className={styles.cardHead}>
            <span className={styles.cardIcon} aria-hidden>
              <ShoppingBag size={16} />
            </span>
            <h2 className={styles.cardTitle}>{t('community.shopTitle')}</h2>
          </div>
          <p className={styles.cardDesc}>{t('community.shopDesc')}</p>
          <span className={styles.cardCta}>
            {t('community.shopCta')}
            <ArrowRight size={12} aria-hidden />
          </span>
        </Link>
      </div>
    </section>
  )
}
