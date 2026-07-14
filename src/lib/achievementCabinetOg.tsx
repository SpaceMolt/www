import { ImageResponse } from 'next/og'
import { loadEmblem, OG_SIZE } from '@/lib/achievementOg'
import { loadCardFonts } from '@/lib/og/shared'

// OpenGraph card renderer for a subject's full achievement cabinet (player or
// faction dossier) — distinct from achievementOg.tsx, which renders a single
// earned achievement's share card. nodejs runtime is required by the route
// modules that use this so emblem PNGs can be read off disk.
export { OG_SIZE }

const MAX_EMBLEMS = 6

export interface AchievementCabinetOgInput {
  kicker: string // "Pilot Dossier" or "Faction Dossier"
  subjectName: string
  subjectMeta: string // empire label or "[TAG]"
  accent: string
  earned: number
  total: number
  points: number
  /** Earned achievement ids with emblem art, most-recent or most-notable first. */
  earnedEmblemIds: string[]
}

export async function renderAchievementCabinetOg(input: AchievementCabinetOgInput): Promise<ImageResponse> {
  const { kicker, subjectName, subjectMeta, accent, earned, total, points, earnedEmblemIds } = input
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0
  const shownIds = earnedEmblemIds.slice(0, MAX_EMBLEMS)
  const emblems = (await Promise.all(shownIds.map(loadEmblem))).filter(Boolean) as string[]

  const charset = `${kicker}${subjectName}${subjectMeta}${earned}${total}${points}${pct}SPACEMOLTspacemolt.com·PLAY FREEUNLOCKEDPOINTSCOMPLETE%/`
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
          backgroundImage: `radial-gradient(900px 500px at 30% 30%, ${accent}26, transparent), radial-gradient(700px 500px at 90% 90%, #ff6b3514, transparent)`,
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

        {/* middle: identity + stats + emblem strip */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Orbitron',
              fontWeight: 800,
              fontSize: subjectName.length > 18 ? 56 : 72,
              lineHeight: 1.04,
              color: '#e8f4f8',
            }}
          >
            {subjectName}
          </div>
          <div style={{ display: 'flex', fontFamily: 'JetBrains', fontSize: 20, letterSpacing: 2, color: accent, marginTop: 10 }}>
            {subjectMeta.toUpperCase()}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 48, marginTop: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 800, fontSize: 52, color: '#e8f4f8' }}>
                  {earned}
                </span>
                <span style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 700, fontSize: 28, color: '#5a6b7a' }}>
                  / {total}
                </span>
              </div>
              <div style={{ display: 'flex', fontFamily: 'JetBrains', fontSize: 16, letterSpacing: 2, color: '#5a6b7a', marginTop: 2 }}>
                UNLOCKED
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 800, fontSize: 52, color: '#e8f4f8' }}>
                {points}
              </div>
              <div style={{ display: 'flex', fontFamily: 'JetBrains', fontSize: 16, letterSpacing: 2, color: '#5a6b7a', marginTop: 2 }}>
                POINTS
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 800, fontSize: 52, color: accent }}>
                {pct}%
              </div>
              <div style={{ display: 'flex', fontFamily: 'JetBrains', fontSize: 16, letterSpacing: 2, color: '#5a6b7a', marginTop: 2 }}>
                COMPLETE
              </div>
            </div>
          </div>

          {emblems.length > 0 && (
            <div style={{ display: 'flex', gap: 16, marginTop: 36 }}>
              {emblems.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  width={72}
                  height={72}
                  style={{ borderRadius: 36, filter: `drop-shadow(0 0 16px ${accent}55)` }}
                  alt=""
                />
              ))}
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
