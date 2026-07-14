import { ImageResponse } from 'next/og'
import { OG_SIZE, loadCardFonts } from './shared'

export { OG_SIZE }

// Generic OpenGraph card for the site's top-level section index pages
// (battles list, market, ships codex, stations, forum, news, ticker, about).
// These pages don't have a single "instance" to render like a battle or an
// achievement, so the card is just the section identity: kicker, title,
// tagline, and an optional short stat line — styled to match the rest of
// the card family (battleOg.tsx, achievementCabinetOg.tsx).
export interface SectionOgInput {
  kicker: string
  title: string
  tagline: string
  accent: string
  /** Short uppercase stat line, e.g. "292 SHIPS · 5 EMPIRES". Only set when the data is free (no network fetch). */
  stat?: string
}

export async function renderSectionOg(input: SectionOgInput): Promise<ImageResponse> {
  const { kicker, title, tagline, accent, stat } = input

  const charset = `${kicker}${title}${tagline}${stat ?? ''}SPACEMOLTspacemolt.com·PLAY FREE`
  const fonts = await loadCardFonts(charset)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: '#0a0e17',
          backgroundImage: `radial-gradient(900px 500px at 25% 30%, ${accent}26, transparent), radial-gradient(700px 500px at 95% 95%, #ff6b3514, transparent)`,
          fontFamily: 'JetBrains',
          color: '#e8f4f8',
        }}
      >
        {/* top row: eyebrow + wordmark */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontFamily: 'JetBrains',
              fontSize: 22,
              letterSpacing: 4,
              color: accent,
            }}
          >
            <div style={{ display: 'flex', width: 12, height: 12, background: accent, transform: 'rotate(45deg)' }} />
            {kicker.toUpperCase()}
          </div>
          <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 800, fontSize: 30, letterSpacing: 2 }}>
            SPACEMOLT
          </div>
        </div>

        {/* middle: title + tagline + optional stat */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Orbitron',
              fontWeight: 800,
              fontSize: title.length > 16 ? 68 : 84,
              lineHeight: 1.05,
              color: '#e8f4f8',
              maxWidth: 1050,
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: 'flex',
              fontFamily: 'JetBrains',
              fontSize: 24,
              lineHeight: 1.5,
              color: '#a8c5d6',
              marginTop: 22,
              maxWidth: 820,
            }}
          >
            {tagline}
          </div>
          {stat && (
            <div
              style={{
                display: 'flex',
                fontFamily: 'JetBrains',
                fontWeight: 600,
                fontSize: 20,
                letterSpacing: 2,
                color: accent,
                marginTop: 24,
              }}
            >
              {stat}
            </div>
          )}
        </div>

        {/* bottom: CTA */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'JetBrains',
              fontSize: 22,
              letterSpacing: 2,
              color: '#0a0e17',
              background: '#ff6b35',
              padding: '14px 28px',
              borderRadius: 8,
            }}
          >
            spacemolt.com · PLAY FREE
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined },
  )
}
