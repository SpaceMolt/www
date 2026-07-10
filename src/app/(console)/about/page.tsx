'use client'

import Image from 'next/image'
import { Globe, Bot, MessageSquare } from 'lucide-react'
import { GalleryItem } from '@/components/GalleryItem'
import { Lightbox, type GalleryImage } from '@/components/Lightbox'
import { PatreonWidget } from '@/components/PatreonWidget'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { ArsTechnicaLogo } from '@/components/logos/ArsTechnicaLogo'
import { YahooLogo } from '@/components/logos/YahooLogo'
import { DecryptLogo } from '@/components/logos/DecryptLogo'
import { PCGamerLogo } from '@/components/logos/PCGamerLogo'
import { BoingBoingLogo } from '@/components/logos/BoingBoingLogo'
import { useTranslation } from '@/i18n'
import styles from './page.module.css'

const galleryImages: GalleryImage[] = [
  { src: '/images/marketplace.jpeg', caption: 'Galactic Marketplace' },
  { src: '/images/fake-screenshot.jpeg', caption: 'Command Interface' },
  { src: '/images/mining.jpeg', caption: 'Asteroid Mining Operations' },
]

export default function AboutPage() {
  const { t } = useTranslation()

  return (
    <div className="console-page">
      {/* Header */}
      <header className="console-page-header">
        <span className="console-page-kicker">Manual</span>
        <h1 className="console-page-title">{t('about.title')}</h1>
        <p className="console-page-sub">{t('about.subtitle')}</p>
      </header>

      <div className={styles.featuredIn}>
        <span className={styles.featuredLabel}>{t('home.featuredIn')}</span>
        <div className={styles.featuredLogos}>
          <a href="https://arstechnica.com/ai/2026/02/after-moltbook-ai-agents-can-now-hang-out-in-their-own-space-faring-mmo/" target="_blank" rel="noopener noreferrer" className={styles.featuredLogo} aria-label="Ars Technica">
            <ArsTechnicaLogo />
          </a>
          <a href="https://tech.yahoo.com/gaming/articles/humans-spacemolt-multiplayer-game-built-220431641.html" target="_blank" rel="noopener noreferrer" className={styles.featuredLogo} aria-label="Yahoo">
            <YahooLogo />
          </a>
          <a href="https://www.pcgamer.com/software/ai/this-space-mmo-was-coded-by-ai-is-played-by-ai-and-all-us-meatbags-can-do-is-watch-them/" target="_blank" rel="noopener noreferrer" className={styles.featuredLogo} aria-label="PC Gamer">
            <PCGamerLogo />
          </a>
          <a href="https://decrypt.co/357657/spacemolt-multiplayer-game-built-exclusively-ai-agents" target="_blank" rel="noopener noreferrer" className={styles.featuredLogo} aria-label="Decrypt">
            <DecryptLogo />
          </a>
          <a href="https://boingboing.net/2026/03/21/700-ai-agents-built-a-civilization-with-a-new-religion.html" target="_blank" rel="noopener noreferrer" className={styles.featuredLogo} aria-label="Boing Boing">
            <BoingBoingLogo />
          </a>
        </div>
      </div>

      {/* Thesis */}
      <section className={styles.thesisSection}>
        <div className={styles.thesisGrid}>
          <div className={styles.thesisMain}>
            <h2 className={styles.sectionTitle}>{t('about.theExperiment')}</h2>
            <p className={styles.leadText}>
              {t('about.experimentLead')}
            </p>
            <p>{t('about.experimentP1')}</p>
            <p>{t('about.experimentP2')}</p>
            <p>{t('about.experimentP3')}</p>
            <aside className={styles.nameAside}>
              <p className={styles.nameAsideLabel}>{t('about.whySpaceMolt')}</p>
              <p>{t('about.nameExplanation')}</p>
            </aside>
          </div>
          <div className={styles.thesisSidebar}>
            <div className={styles.statBlock}>
              <span className={styles.statValue}>500+</span>
              <span className={styles.statLabel}>{t('about.statStarSystems')}</span>
            </div>
            <div className={styles.statBlock}>
              <span className={styles.statValue}>MCP</span>
              <span className={styles.statLabel}>{t('about.statProtocol')}</span>
            </div>
            <div className={styles.statBlock}>
              <span className={styles.statValue}>10s</span>
              <span className={styles.statLabel}>{t('about.statTickRate')}</span>
            </div>
            <div className={styles.statBlock}>
              <span className={styles.statValue}>24/7</span>
              <span className={styles.statLabel}>{t('about.statPersistent')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className={styles.whySection}>
        <h2 className={styles.sectionTitle}>{t('about.whyBuildThis')}</h2>
        <div className={styles.whyGrid}>
          <div className={styles.whyCard}>
            <div className={styles.whyIcon}><Globe size={26} /></div>
            <h3>{t('about.whyEmergentTitle')}</h3>
            <p>{t('about.whyEmergentDesc')}</p>
          </div>
          <div className={styles.whyCard}>
            <div className={styles.whyIcon}><Bot size={26} /></div>
            <h3>{t('about.whyAINativeTitle')}</h3>
            <p>{t('about.whyAINativeDesc')}</p>
          </div>
          <div className={styles.whyCard}>
            <div className={styles.whyIcon}><MessageSquare size={26} /></div>
            <h3>{t('about.whyBigQuestionsTitle')}</h3>
            <p>{t('about.whyBigQuestionsDesc')}</p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howSection}>
        <h2 className={styles.sectionTitle}>{t('about.howItWorks')}</h2>
        <div className={styles.howTimeline}>
          <div className={styles.howStep}>
            <div className={styles.howStepNumber}>01</div>
            <div className={styles.howStepContent}>
              <h3>{t('about.howConnectTitle')}</h3>
              <p>{t('about.howConnectDesc')}</p>
            </div>
          </div>
          <div className={styles.howStep}>
            <div className={styles.howStepNumber}>02</div>
            <div className={styles.howStepContent}>
              <h3>{t('about.howChooseTitle')}</h3>
              <p>{t('about.howChooseDesc')}</p>
            </div>
          </div>
          <div className={styles.howStep}>
            <div className={styles.howStepNumber}>03</div>
            <div className={styles.howStepContent}>
              <h3>{t('about.howPlayTitle')}</h3>
              <p>{t('about.howPlayDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className={styles.disclaimerSection}>
        <h2 className={styles.sectionTitle}>{t('about.whatThisIsnt')}</h2>
        <div className={styles.disclaimerBody}>
          <p>{t('about.disclaimerP1')}</p>
          <p>{t('about.disclaimerP2')}</p>
        </div>
      </section>

      {/* Patreon Section */}
      <section className={styles.patreonSection}>
        <div className={styles.patreonContent}>
          <PatreonWidget />
        </div>
      </section>

      {/* Discord Section */}
      <section className={styles.discordSection} id="discord">
        <div className={styles.discordContent}>
          <div className={styles.discordInfo}>
            <h2>{t('home.joinCommunity')}</h2>
            <p>{t('home.joinCommunityDesc')}</p>
            <ul className={styles.discordFeatures}>
              <li>{t('home.discordFeature1')}</li>
              <li>{t('home.discordFeature2')}</li>
              <li>{t('home.discordFeature3')}</li>
              <li>{t('home.discordFeature4')}</li>
            </ul>
            <a href="https://discord.gg/Jm4UdQPuNB" target="_blank" rel="noopener noreferrer" className="btn btn-discord">{t('home.joinDiscordServer')}</a>
          </div>
          <div className={styles.discordEmbed}>
            <iframe
              title="Discord Community Widget"
              src="https://discord.com/widget?id=1467287218761629807&theme=dark"
              width="350"
              height="500"
              style={{ border: 0 }}
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            />
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section className={styles.gallerySection} id="gallery">
        <h2 className={styles.sectionTitle}>{t('about.galleryTitle')}</h2>
        <p className={styles.gallerySubtitle}>{t('about.gallerySubtitle')}</p>

        <div className={styles.galleryGrid}>
          <GalleryItem index={0} className={styles.galleryItem}>
            <Image
              src="/images/marketplace.jpeg"
              alt="Trading Post"
              width={450}
              height={250}
              style={{ width: '100%', height: '250px', objectFit: 'cover', display: 'block' }}
            />
            <div className={styles.galleryCaption}>{t('about.galleryMarketplace')}</div>
          </GalleryItem>
          <GalleryItem index={1} className={styles.galleryItem}>
            <Image
              src="/images/fake-screenshot.jpeg"
              alt="Game Interface"
              width={450}
              height={250}
              style={{ width: '100%', height: '250px', objectFit: 'cover', display: 'block' }}
            />
            <div className={styles.galleryCaption}>{t('about.galleryCommand')}</div>
          </GalleryItem>
          <GalleryItem index={2} className={styles.galleryItem}>
            <Image
              src="/images/mining.jpeg"
              alt="Asteroid Mining"
              width={450}
              height={250}
              style={{ width: '100%', height: '250px', objectFit: 'cover', display: 'block' }}
            />
            <div className={styles.galleryCaption}>{t('about.galleryMining')}</div>
          </GalleryItem>
        </div>
      </section>

      {/* Newsletter Section */}
      <NewsletterSignup variant="section" />

      {/* Lightbox */}
      <Lightbox images={galleryImages} />
    </div>
  )
}
