import { ImageResponse } from 'next/og'
import {
  fetchPlayerAchievements,
  findAchievement,
  accentFor,
  empireLabel,
  rarityLabel,
  safeDecode,
} from '@/lib/publicAchievements'

export const runtime = 'edge'
export const alt = 'SpaceMolt achievement unlocked'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Pull a single weight of a Google font as an ArrayBuffer for Satori. Returns
// null on any failure so the card still renders with a default face.
async function loadFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`
    const css = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text()
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)
    if (!src) return null
    const res = await fetch(src[1])
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

type Params = Promise<{ player: string; achievement: string }>

export default async function Image({ params }: { params: Params }) {
  const { player: rawP, achievement: rawA } = await params
  const player = safeDecode(rawP)
  const achievement = safeDecode(rawA)
  const data = await fetchPlayerAchievements(player)
  const ach = findAchievement(data, achievement)

  const accent = accentFor(data?.subject.empire)
  const name = ach && ach.earned ? ach.name : 'SpaceMolt'
  const pilot = data?.subject.name ?? 'A pilot'
  const empire = empireLabel(data?.subject.empire)
  const rarity = ach && ach.earned ? rarityLabel(ach.rarity_pct).toUpperCase() : 'CRUSTACEAN COSMOS'
  const glyph = ((ach?.emblem || name).charAt(0) || 'S').toUpperCase()

  const charset = `${name}${desc}${pilot}${empire}${rarity}ACHIEVEMENT UNLOCKEDSPACEMOLTspacemolt.com·PLAY FREE${glyph}`
  const [orbitron, orbitronBlack, jet] = await Promise.all([
    loadFont('Orbitron', 700, charset),
    loadFont('Orbitron', 800, charset),
    loadFont('JetBrains+Mono', 600, charset),
  ])
  const fonts = [
    orbitron && { name: 'Orbitron', data: orbitron, weight: 700 as const, style: 'normal' as const },
    orbitronBlack && { name: 'Orbitron', data: orbitronBlack, weight: 800 as const, style: 'normal' as const },
    jet && { name: 'JetBrains', data: jet, weight: 600 as const, style: 'normal' as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 700 | 800; style: 'normal' }[]

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
          backgroundImage: `radial-gradient(900px 500px at 30% 35%, ${accent}26, transparent), radial-gradient(700px 500px at 90% 90%, #ff6b3514, transparent)`,
          fontFamily: 'JetBrains',
          color: '#e8f4f8',
        }}
      >
        {/* top row: eyebrow + wordmark */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'JetBrains',
              fontSize: 22,
              letterSpacing: 4,
              color: accent,
            }}
          >
            ◆ ACHIEVEMENT UNLOCKED
          </div>
          <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 800, fontSize: 30, letterSpacing: 2 }}>
            SPACEMOLT
          </div>
        </div>

        {/* middle: emblem + text */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 200,
              height: 200,
              borderRadius: 100,
              border: `3px solid ${accent}`,
              background: `radial-gradient(circle at 35% 30%, #ffffff1f, #0a0e17 72%)`,
              boxShadow: `0 0 60px ${accent}66`,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 800, fontSize: 96, color: '#e8f4f8' }}>
              {glyph}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div
              style={{
                display: 'flex',
                fontFamily: 'Orbitron',
                fontWeight: 800,
                fontSize: name.length > 22 ? 56 : 72,
                lineHeight: 1.04,
                color: '#e8f4f8',
              }}
            >
              {name}
            </div>
            <div
              style={{
                display: 'flex',
                fontFamily: 'Orbitron',
                fontWeight: 700,
                fontSize: 34,
                color: accent,
                marginTop: 18,
              }}
            >
              {rarity}
            </div>
          </div>
        </div>

        {/* bottom: pilot + CTA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 700, fontSize: 30, color: '#e8f4f8' }}>
              {pilot}
            </div>
            <div style={{ display: 'flex', fontFamily: 'JetBrains', fontSize: 20, letterSpacing: 2, color: accent, marginTop: 6 }}>
              {empire.toUpperCase()}
            </div>
          </div>
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
    { ...size, fonts: fonts.length ? fonts : undefined },
  )
}
