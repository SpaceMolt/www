import { describe, it, expect } from 'bun:test'
import { shouldCloseOnScroll } from './useHoverTooltip'

// Minimal Node stand-ins so we can exercise the contains() logic without a DOM.
function makeNode(children: Node[] = []): Node {
  const node = {
    contains(other: Node | null): boolean {
      if (!other) return false
      if (other === node) return true
      return children.some((c) => c === other || c.contains(other))
    },
  }
  return node as unknown as Node
}

describe('shouldCloseOnScroll (dc#211282)', () => {
  it('keeps the tooltip open when the scroll target is the tooltip body itself', () => {
    const tooltip = makeNode()
    expect(shouldCloseOnScroll(tooltip, tooltip)).toBe(false)
  })

  it('keeps the tooltip open when the scroll target is a child of the tooltip', () => {
    const child = makeNode()
    const tooltip = makeNode([child])
    // Regression: scrolling inside the scrollable tooltip used to dismiss it,
    // making overflowing item details impossible to reach.
    expect(shouldCloseOnScroll(child, tooltip)).toBe(false)
  })

  it('closes the tooltip when the page scrolls outside of it', () => {
    const tooltip = makeNode()
    const elsewhere = makeNode()
    expect(shouldCloseOnScroll(elsewhere, tooltip)).toBe(true)
  })

  it('closes when there is no tooltip element yet', () => {
    expect(shouldCloseOnScroll(makeNode(), null)).toBe(true)
  })

  it('closes when the scroll event has no target', () => {
    expect(shouldCloseOnScroll(null, makeNode())).toBe(true)
  })
})
