// Shared styling for the /economy charts. One meaning per colour across the
// whole page; each chart's set was run through the dataviz palette validator
// on the panel surface (only the brand tokens' brightness fails its band check).

import { compact, dayLabel } from './economy'

export const C = {
  // Player vs NPC splits only.
  player: '#00d4ff', // --plasma-cyan
  npc: '#9b59b6', // --void-purple
  npcAlt: '#d67ff7', // second NPC-side series in the trade stack
  // Credits created and destroyed only.
  created: '#2dd4bf', // --bio-green
  destroyed: '#ff6b35', // --shell-orange
  // Net change in the supply (net created, supply change).
  net: '#e8f4f8', // --star-white
  gap: '#6b8fa3', // --hull-grey: the reconciliation gap
  // Price indices only.
  ore: '#ffd93d', // --warning-yellow
  refined: '#f472b6',
  component: '#4dabf7', // --laser-blue
  // Trade authenticators: the Federation window, and the three market segments.
  window: '#f5a524',
  p2s: '#fb7185', // players selling to stations
  s2p: '#c4b5fd', // stations selling to players
  p2p: '#a3e635', // between players
  // Single-series charts and bars with no category meaning.
  neutral: '#a8c5d6', // --chrome-silver
  reference: '#8aa9bb', // reference lines (price base = 100)
  axis: '#3d5a6c',
  grid: 'rgba(61, 90, 108, 0.35)',
  surface: '#0c111c',
} as const

/** Fixed y-axis width so stacked charts (flows over the gap strip) line up. */
export const Y_WIDTH = 52

export const MARGIN = { top: 8, right: 8, left: 0, bottom: 0 }

const TICK = { fill: '#8aa9bb', fontSize: 11 }

export const X_AXIS = {
  dataKey: 'date',
  tickFormatter: dayLabel,
  tick: TICK,
  tickLine: false,
  axisLine: { stroke: C.axis },
  minTickGap: 28,
  interval: 'preserveStartEnd' as const,
}

export const Y_AXIS = {
  width: Y_WIDTH,
  tick: TICK,
  tickLine: false,
  axisLine: false,
  tickFormatter: (v: number) => compact(v),
}

/** Faint crosshair band behind the hovered day. */
export const CURSOR = { fill: 'rgba(168, 197, 214, 0.06)' }
