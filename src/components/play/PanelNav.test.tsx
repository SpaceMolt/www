import React from 'react'
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { PanelNav } from './PanelNav'

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
