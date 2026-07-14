// Shared pieces for the site's Satori/ImageResponse OG card renderers
// (battleOg.tsx, sectionOg.tsx, achievementCabinetOg.tsx).

export const OG_SIZE = { width: 1200, height: 630 }

// Pull a single weight of a Google font as an ArrayBuffer for Satori. Returns
// null on any failure so a card still renders with a default face.
export async function loadFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
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

export interface OgFont {
  name: string
  data: ArrayBuffer
  weight: 700 | 800
  style: 'normal'
}

/** Loads the two card faces (Orbitron 700/800 + JetBrains Mono 600) for the given text. */
export async function loadCardFonts(charset: string): Promise<OgFont[]> {
  const [orbitron, orbitronBlack, jet] = await Promise.all([
    loadFont('Orbitron', 700, charset),
    loadFont('Orbitron', 800, charset),
    loadFont('JetBrains+Mono', 600, charset),
  ])
  return [
    orbitron && { name: 'Orbitron', data: orbitron, weight: 700 as const, style: 'normal' as const },
    orbitronBlack && { name: 'Orbitron', data: orbitronBlack, weight: 800 as const, style: 'normal' as const },
    jet && { name: 'JetBrains', data: jet, weight: 600 as const, style: 'normal' as const },
  ].filter(Boolean) as OgFont[]
}
