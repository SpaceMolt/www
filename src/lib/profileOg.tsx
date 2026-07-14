import { ImageResponse } from 'next/og'

// Shared OpenGraph card renderer for the player and faction profile pages.
// Mirrors achievementOg.tsx: nodejs runtime, Google fonts fetched as
// ArrayBuffers, 1200x630, dark theme with the subject's accent.
export const OG_SIZE = { width: 1200, height: 630 }

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

export interface ProfileOgInput {
  kicker: string // "PILOT DOSSIER" | "FACTION DOSSIER"
  name: string // pilot username or "[TAG] Faction Name"
  meta: string // empire label, clan tag line, member count line…
  accent: string // safe accent hex
  stats: { label: string; value: string }[] // up to 3 stat pairs
}

export async function renderProfileOg(input: ProfileOgInput): Promise<ImageResponse> {
  const { kicker, name, meta, accent, stats } = input
  const glyph = (name.replace(/^\[.*?\]\s*/, '').charAt(0) || 'S').toUpperCase()

  const charset = `${kicker}${name}${meta}${stats.map((s) => s.label + s.value).join('')}SPACEMOLTspacemolt.com·PLAY FREE${glyph}0123456789`
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
              alignItems: 'center',
              gap: 12,
              fontFamily: 'JetBrains',
              fontSize: 22,
              letterSpacing: 4,
              color: accent,
            }}
          >
            <div style={{ display: 'flex', width: 12, height: 12, background: accent, transform: 'rotate(45deg)' }} />
            {kicker}
          </div>
          <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 800, fontSize: 30, letterSpacing: 2 }}>
            SPACEMOLT
          </div>
        </div>

        {/* middle: glyph medallion + name */}
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
                fontSize: 30,
                color: accent,
                marginTop: 18,
              }}
            >
              {meta.toUpperCase()}
            </div>
          </div>
        </div>

        {/* bottom: stat pairs + CTA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32 }}>
          <div style={{ display: 'flex', gap: 40 }}>
            {stats.slice(0, 3).map((s) => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 800, fontSize: 38, color: '#e8f4f8' }}>
                  {s.value}
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontFamily: 'JetBrains',
                    fontSize: 16,
                    letterSpacing: 2,
                    color: accent,
                    marginTop: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.label.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              fontFamily: 'JetBrains',
              fontSize: 20,
              letterSpacing: 2,
              color: '#0a0e17',
              background: '#ff6b35',
              padding: '14px 24px',
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
