// Shared styling for the /economy charts. Colours are the globals.css tokens;
// each pairing was checked for colour-blind separation on the panel surface.

import { formatCompact } from '@/lib/format'
import { dayLabel } from './economy'

export const C = {
  player: '#00d4ff', // --plasma-cyan
  npc: '#9b59b6', // --void-purple
  faucet: '#2dd4bf', // --bio-green
  sink: '#ff6b35', // --shell-orange
  net: '#e8f4f8', // --star-white
  unattributed: '#9b59b6',
  p2p: '#00d4ff',
  sold: '#ffd93d', // --warning-yellow
  bought: '#9b59b6',
  ore: '#ff6b35',
  refined: '#00d4ff',
  component: '#9b59b6',
  axis: '#3d5a6c',
  grid: 'rgba(61, 90, 108, 0.35)',
  surface: '#0c111c',
} as const

/** Fixed y-axis width so stacked charts (flows over unattributed) line up. */
export const Y_WIDTH = 48

export const MARGIN = { top: 8, right: 8, left: 0, bottom: 0 }

export const X_AXIS = {
  dataKey: 'date',
  tickFormatter: dayLabel,
  tick: { fill: '#6b8fa3', fontSize: 10 },
  tickLine: false,
  axisLine: { stroke: C.axis },
  minTickGap: 28,
  interval: 'preserveStartEnd' as const,
}

export const Y_AXIS = {
  width: Y_WIDTH,
  tick: { fill: '#6b8fa3', fontSize: 10 },
  tickLine: false,
  axisLine: false,
  tickFormatter: (v: number) => formatCompact(v),
}

/** Faint crosshair band behind the hovered day. */
export const CURSOR = { fill: 'rgba(0, 212, 255, 0.06)' }
