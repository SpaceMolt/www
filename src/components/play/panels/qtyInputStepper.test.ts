import { describe, it, expect } from 'bun:test'
import fs from 'fs'
import path from 'path'

/*
 * The per-item quantity fields in the /play client are native
 * <input type="number">, so Chrome/Safari paint a stepper
 * (::-webkit-inner-spin-button) inside the right edge of the field and only make it
 * opaque on hover/focus, without moving the value out of the way. A narrow,
 * right-aligned quantity therefore ends up flush against (or clipped by) the stepper
 * the moment it appears. Reported by a player as "the item quantity adjuster overlaps
 * the number a bit making it difficult to see".
 *
 * There are two correct answers, and which one applies depends on whether the field has
 * another way to change the value:
 *
 *   - MarketView's order rows already render explicit +5/+10/+100/MAX buttons
 *     (QtyButtons) immediately before the input, so the native stepper is redundant and
 *     is hidden outright. That works in both engines and needs no extra field width.
 *
 *   - StorageView (also used by FactionStorageView) and ShipPanel have no such buttons:
 *     the stepper is the only increment affordance, so hiding it would be a functional
 *     regression. Those keep the stepper and reserve a gutter beside it instead.
 *     Firefox has no equivalent of ::-webkit-inner-spin-button, so it keeps some
 *     overlap on those two fields; that is a known, documented residual.
 *
 * There is no React render harness in this repo, so these tests guard the invariants at
 * the stylesheet level, plus the one component-level fact the MarketView decision rests
 * on (that QtyButtons is still there).
 */

const PANELS_DIR = path.join(process.cwd(), 'src', 'components', 'play', 'panels')
const read = (...p: string[]) => fs.readFileSync(path.join(PANELS_DIR, ...p), 'utf8')

// --- tiny CSS reader -------------------------------------------------------------
// Parses declarations per selector so the assertions below survive reordered
// declarations, grouped selectors, shorthands, and whitespace changes.

type Decls = Record<string, string>

function parseDecls(body: string): Decls {
  const decls: Decls = {}
  for (const part of body.split(';')) {
    const idx = part.indexOf(':')
    if (idx === -1) continue
    const prop = part.slice(0, idx).trim().toLowerCase()
    if (prop) decls[prop] = part.slice(idx + 1).trim()
  }
  return decls
}

/** All declarations that apply to an exact selector, in source order (later wins). */
function declsFor(css: string, selector: string): Decls | null {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const merged: Decls = {}
  const preludes: string[] = []
  let found = false
  let buf = ''

  for (const ch of src) {
    if (ch === '{') {
      preludes.push(buf.trim())
      buf = ''
    } else if (ch === '}') {
      const prelude = preludes.pop() ?? ''
      const body = buf
      buf = ''
      if (!prelude || prelude.startsWith('@')) continue
      const selectors = prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' '))
      if (selectors.includes(selector)) {
        found = true
        Object.assign(merged, parseDecls(body))
      }
    } else {
      buf += ch
    }
  }
  return found ? merged : null
}

const UNIT_PX: Record<string, number> = { px: 1, rem: 16, em: 16 }

/** Length in px, accepting any equivalent spelling we can convert. `null` = not convertible. */
function toPx(value: string): number | null {
  const v = value.trim()
  if (/^-?0+(\.0+)?$/.test(v)) return 0
  const m = /^(-?\d*\.?\d+)(px|rem|em)$/.exec(v)
  return m ? parseFloat(m[1]) * UNIT_PX[m[2]] : null
}

/** Resolved left margin, whether written longhand or via the `margin` shorthand. */
function marginLeftPx(decls: Decls): number | null {
  const longhand = decls['margin-left']
  if (longhand != null) return toPx(longhand)
  const shorthand = decls['margin']
  if (shorthand == null) return null
  const parts = shorthand.split(/\s+/)
  const left = parts.length >= 4 ? parts[3] : parts.length >= 2 ? parts[1] : parts[0]
  return toPx(left)
}

/** True if the field opts out of the native stepper in the given engine. */
const hidesStepperInGecko = (decls: Decls) =>
  [decls['-moz-appearance'], decls['appearance']].some((v) => v?.trim() === 'textfield')
const hidesStepperInWebkit = (decls: Decls) =>
  [decls['-webkit-appearance'], decls['appearance']].some((v) => v?.trim() === 'none')

/*
 * The reserved gutter is the gap between the number and the stepper, so it has to be a
 * perceptible separation rather than merely non-zero (the original assertion passed on
 * 0.01rem). It does NOT need to equal the stepper's own width — the margin sits beside
 * the stepper, it does not have to clear it.
 */
const MIN_GUTTER_PX = 3

// --- fields that hide the stepper (an explicit +/- affordance exists) -------------

describe('MarketView order quantity hides the native stepper in both engines', () => {
  const css = read('trading', 'MarketView.module.css')
  const field = declsFor(css, '.orderQtyInput')
  const outer = declsFor(css, '.orderQtyInput::-webkit-outer-spin-button')
  const inner = declsFor(css, '.orderQtyInput::-webkit-inner-spin-button')

  it('opts out of the spinner in Gecko', () => {
    expect(field).not.toBeNull()
    expect(hidesStepperInGecko(field!)).toBe(true)
  })

  it('opts out of the spinner in WebKit, on both spin-button pseudo-elements', () => {
    expect(outer).not.toBeNull()
    expect(inner).not.toBeNull()
    expect(hidesStepperInWebkit(outer!)).toBe(true)
    expect(hidesStepperInWebkit(inner!)).toBe(true)
  })

  it('reserves no leftover gutter, since there is no stepper to clear', () => {
    // A stale margin here would widen the order row for nothing; the row is half-width
    // and already packed with price, quantity, the +/- cluster and the Buy/Sell button.
    expect(marginLeftPx(inner!) ?? 0).toBe(0)
  })

  it('still renders QtyButtons beside the input, which is what makes hiding it safe', () => {
    const tsx = read('trading', 'MarketView.tsx')
    const uses = [...tsx.matchAll(/styles\.orderQtyInput/g)]
    expect(uses.length).toBeGreaterThan(0)
    for (const use of uses) {
      const preceding = tsx.slice(Math.max(0, use.index! - 400), use.index!)
      expect(preceding).toContain('<QtyButtons')
    }
  })
})

// --- fields that keep the stepper (it is the only increment affordance) -----------

const GUTTER_FIELDS = [
  {
    label: 'StorageView .qtyInput',
    cssFile: ['trading', 'StorageView.module.css'],
    className: 'qtyInput',
    components: [
      ['trading', 'StorageView.tsx'],
      ['trading', 'FactionStorageView.tsx'],
    ],
  },
  {
    label: 'ShipPanel .cargoQtyInput',
    cssFile: ['ShipPanel.module.css'],
    className: 'cargoQtyInput',
    components: [['ShipPanel.tsx']],
  },
]

describe.each(GUTTER_FIELDS)('$label keeps the stepper and reserves a gutter', (field) => {
  const css = read(...field.cssFile)
  const input = declsFor(css, `.${field.className}`)
  const spin = declsFor(css, `.${field.className}::-webkit-inner-spin-button`)

  it('reserves a perceptible gutter beside the stepper', () => {
    expect(spin).not.toBeNull()
    const gutter = marginLeftPx(spin!)
    expect(gutter).not.toBeNull()
    expect(gutter!).toBeGreaterThanOrEqual(MIN_GUTTER_PX)
  })

  it('does not hide the stepper, which is the only way to increment this field', () => {
    // Guards against someone applying the MarketView/CraftingPanel pattern here: these
    // rows have no +/- buttons, so hiding the stepper removes the affordance entirely.
    expect(input).not.toBeNull()
    expect(hidesStepperInGecko(input!)).toBe(false)
    expect(hidesStepperInWebkit(spin!)).toBe(false)
  })

  it('is applied to a native number input, so a stepper exists at all', () => {
    for (const component of field.components) {
      const tsx = read(...component)
      const uses = [...tsx.matchAll(new RegExp(`styles\\.${field.className}\\b`, 'g'))]
      expect(uses.length).toBeGreaterThan(0)
      for (const use of uses) {
        const element = tsx.slice(use.index!, tsx.indexOf('/>', use.index!))
        expect(element).toContain('type="number"')
      }
    }
  })
})
