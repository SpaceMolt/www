import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const component = readFileSync(join(import.meta.dir, 'SideScoreboard.tsx'), 'utf8')
const css = readFileSync(join(import.meta.dir, 'BattleViewer.module.css'), 'utf8')

function cssRule(className: string): string {
  return css.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

describe('SideScoreboard identity layout', () => {
  it('keeps identity badges visible and readable beside dimmed fate details', () => {
    expect(component).toMatch(
      /<span className=\{styles\.scoreName\}>[\s\S]*?<\/span>\s*\{identityKey && <span className=\{styles\.actorBadge\}>/,
    )

    expect(cssRule('scoreName')).toContain('min-width: 0')
    expect(cssRule('scoreRowGone')).not.toContain('opacity')
    expect(css).toMatch(
      /\.scoreRowGone \.scoreName,\s*\.scoreRowGone \.scoreShip,\s*\.scoreRowGone \.scoreRowBars\s*\{[^}]*opacity: 0\.55/,
    )
    expect(cssRule('actorBadge')).toContain('flex-shrink: 0')
    expect(cssRule('actorBadge')).toContain('font-size: 0.65rem')
    expect(component).toContain('className={styles.scoreShip} title={meta.shipClassName}')
    expect(cssRule('scoreShip')).toContain('max-width: 42%')
    expect(cssRule('scoreShip')).toContain('text-overflow: ellipsis')
  })
})
