import React from 'react'
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { PanelNav, panelShortcuts } from './PanelNav'

function hasCombat(isDocked: boolean) {
  return renderToStaticMarkup(<PanelNav activePanel="combat" onPanelChange={() => {}} isDocked={isDocked} />)
    .includes('aria-label="Combat"')
}

test('combat stays reachable docked and in space (arena status and battle history work anywhere)', () => {
  expect(hasCombat(true)).toBe(true)
  expect(hasCombat(false)).toBe(true)
})

test('docked replay remains the active navigation entry without live combat membership', () => {
  const markup = renderToStaticMarkup(
    <PanelNav activePanel="combat" onPanelChange={() => {}} isDocked />,
  )
  expect(markup).toContain('aria-label="Combat" aria-current="page"')
  // Desktop and mobile share the same visible panel definitions. The closed
  // mobile selector should still name Combat, rather than falling back to Galaxy.
  expect(markup.match(/>Combat<\/span>/g)?.length).toBe(2)
})

test('number shortcuts follow the visible tabs, so key 9 never targets a hidden docked-only tab', () => {
  expect(panelShortcuts(false).map((p) => p.id)).not.toContain('shipyard')
  expect(panelShortcuts(false)[8].id).toBe('facilities')
  expect(panelShortcuts(true)[8].id).toBe('shipyard')
})
