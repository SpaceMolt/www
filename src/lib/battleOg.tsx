import { ImageResponse } from 'next/og'
import { BATTLE_CATEGORY_META, sideColor, type BattleSummary } from '@/lib/battle/types'
import { formatDuration, outcomeLabel, sideLabel, truncate } from '@/lib/battle/format'
import { OG_SIZE, loadCardFonts } from '@/lib/og/shared'

// Shared OpenGraph card renderer for the battle detail share page.
export { OG_SIZE }

// English-only plain text for the card (Satori has no i18n context to draw
// from). Keep in sync with BATTLE_CATEGORY_META's labelKey translations in
// battle/types.ts if a category's label ever changes.
const CATEGORY_LABELS: Record<string, string> = {
  pvp: 'PVP ENGAGEMENT',
  pirate: 'PIRATE ATTACK',
  police: 'POLICE ACTION',
  wildlife: 'WILDLIFE ENCOUNTER',
  pve: 'PVE ENGAGEMENT',
  npc: 'NPC ENGAGEMENT',
}

export async function renderBattleOg(battle: BattleSummary | null): Promise<ImageResponse> {
  const catMeta = battle?.category ? BATTLE_CATEGORY_META[battle.category] : undefined
  const accent = catMeta?.color ?? '#00d4ff'
  const categoryText = battle?.category ? CATEGORY_LABELS[battle.category] : undefined
  const systemName = battle?.system_name || battle?.system_id || 'Unknown System'
  const sides = battle?.sides ?? []
  const outcome = battle ? outcomeLabel(battle) : 'Battle Record'
  const isLive = battle?.status === 'active'

  // Free-for-all battles can have many sides; showing them all (uncapped)
  // pushed the matchup row off the right edge of the card, so cap the count
  // and each side's label length, and let the row wrap onto a second line.
  const MAX_SIDES_SHOWN = 4
  const shownSides = sides.slice(0, MAX_SIDES_SHOWN)
  const hiddenSideCount = sides.length - shownSides.length
  const sideTexts = shownSides.map(s => truncate(sideLabel(s, 2), 34))
  const matchupFontSize = sides.length > 2 ? 22 : 26

  const statPairs: [string, string][] = battle
    ? [
        ['DURATION', formatDuration(battle.duration_ticks)],
        ['DAMAGE', battle.total_damage.toLocaleString()],
        ['SHIPS LOST', String(battle.ships_destroyed)],
        ...(battle.top_damage ? ([['TOP DAMAGE', battle.top_damage.username]] as [string, string][]) : []),
      ]
    : []

  const charset = `${systemName}${outcome}${sideTexts.join('')}${statPairs.map(p => p.join('')).join('')}${Object.values(CATEGORY_LABELS).join('')}BATTLE RECORDSPACEMOLTspacemolt.com·WATCH REPLAYVS+ more0123456789…`
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
          backgroundImage: `radial-gradient(900px 500px at 25% 20%, ${accent}26, transparent), radial-gradient(700px 500px at 95% 95%, #ff6b3514, transparent)`,
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
            {categoryText ?? 'BATTLE RECORD'}
          </div>
          <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 800, fontSize: 30, letterSpacing: 2 }}>
            SPACEMOLT
          </div>
        </div>

        {/* middle: outcome + system + matchup */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'JetBrains',
              fontSize: 26,
              letterSpacing: 2,
              color: isLive ? '#2dd4bf' : accent,
              marginBottom: 12,
            }}
          >
            {isLive && (
              <div style={{ display: 'flex', width: 10, height: 10, borderRadius: 5, background: '#2dd4bf', marginRight: 12 }} />
            )}
            {outcome.toUpperCase()}
          </div>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Orbitron',
              fontWeight: 800,
              fontSize: systemName.length > 20 ? 52 : 64,
              lineHeight: 1.05,
              color: '#e8f4f8',
            }}
          >
            {systemName}
          </div>
          {sideTexts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', marginTop: 28, fontSize: matchupFontSize }}>
              {sideTexts.map((text, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  {i > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        fontFamily: 'Orbitron',
                        fontWeight: 700,
                        color: '#5a6b7a',
                        fontSize: matchupFontSize - 4,
                        margin: '0 20px',
                      }}
                    >
                      VS
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: sideColor(i) }} />
                    <div style={{ display: 'flex' }}>{text}</div>
                  </div>
                </div>
              ))}
              {hiddenSideCount > 0 && (
                <div style={{ display: 'flex', color: '#5a6b7a', fontSize: matchupFontSize - 4, marginLeft: 20 }}>
                  +{hiddenSideCount} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* bottom: stats + CTA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 32, flexShrink: 0 }}>
            {statPairs.map(([label, value]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <div style={{ display: 'flex', fontFamily: 'JetBrains', fontSize: 16, letterSpacing: 2, color: '#5a6b7a' }}>
                  {label}
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontFamily: 'Orbitron',
                    fontWeight: 700,
                    fontSize: 24,
                    marginTop: 4,
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              flexShrink: 0,
              fontFamily: 'JetBrains',
              fontSize: 22,
              letterSpacing: 2,
              color: '#0a0e17',
              background: '#ff6b35',
              padding: '14px 28px',
              borderRadius: 8,
            }}
          >
            spacemolt.com · WATCH REPLAY
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined },
  )
}
