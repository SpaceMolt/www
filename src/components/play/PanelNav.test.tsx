import React from 'react'
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { PanelNav } from './PanelNav'

function hasCombat(isDocked: boolean, hasBattleReplay = false) {
  return renderToStaticMarkup(<PanelNav activePanel="combat" onPanelChange={() => {}} isDocked={isDocked} hasBattleReplay={hasBattleReplay} />)
    .includes('aria-label="Combat"')
}

test('retained replay stays reachable after docking or a docked respawn', () => {
  expect(hasCombat(true, true)).toBe(true)
})

test('normal combat navigation remains available in space, hidden at a station without history', () => {
  expect(hasCombat(false)).toBe(true)
  expect(hasCombat(true)).toBe(false)
})

test('docked replay remains the active navigation entry without live combat membership', () => {
  const markup = renderToStaticMarkup(
    <PanelNav activePanel="combat" onPanelChange={() => {}} isDocked inCombat={false} hasBattleReplay />,
  )
  expect(markup).toContain('aria-label="Combat" aria-current="page"')
  // Desktop and mobile share the same visible panel definitions. The closed
  // mobile selector should still name Combat, rather than falling back to Galaxy.
  expect(markup.match(/>Combat<\/span>/g)?.length).toBe(2)
})
