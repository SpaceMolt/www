import React from 'react'
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { PanelNav, panelShortcuts } from './PanelNav'

test('combat stays reachable whatever the station lacks (arena status and battle history work anywhere)', () => {
  const markup = renderToStaticMarkup(<PanelNav activePanel="galaxy" onPanelChange={() => {}} hidden={['shipyard', 'crafting', 'salvage']} />)
  expect(markup).toContain('aria-label="Combat"')
  expect(markup).not.toContain('aria-label="Shipyard"')
})

test('docked replay remains the active navigation entry without live combat membership', () => {
  const markup = renderToStaticMarkup(
    <PanelNav activePanel="combat" onPanelChange={() => {}} />,
  )
  expect(markup).toContain('aria-label="Combat" aria-current="page"')
  // Desktop and mobile share the same visible panel definitions. The closed
  // mobile selector should still name Combat, rather than falling back to Galaxy.
  expect(markup.match(/>Combat<\/span>/g)?.length).toBe(2)
})

test('number shortcuts follow the visible tabs, so key 9 never targets a hidden tab', () => {
  expect(panelShortcuts(['shipyard', 'crafting']).map((p) => p.id)).not.toContain('shipyard')
  expect(panelShortcuts(['shipyard', 'crafting'])[8].id).toBe('facilities')
  expect(panelShortcuts([])[8].id).toBe('shipyard')
})
