import { strokeLine } from './canvasLine'

/** A player-built jump gate, as /api/map lists it. */
export interface MapGate {
  from_system: string
  to_system: string
  online: boolean
}

/** A gate as get_map lists it, from the system that carries the entry. */
export interface MapGateLink {
  system_id: string
  online: boolean
}

const GATE_COLOR = '#fb923c'
const GATE_OFFLINE_COLOR = 'rgba(251, 146, 60, 0.6)'
// Dotted, so an offline gate does not read as a dashed wormhole.
const GATE_OFFLINE_DASH = [2, 5]

const isSamePair = (a: MapGate, b: MapGate) =>
  (a.from_system === b.from_system && a.to_system === b.to_system) ||
  (a.from_system === b.to_system && a.to_system === b.from_system)

/** Joins gate lists, once per pair. An earlier list wins. */
export const joinGates = (...lists: MapGate[][]): MapGate[] =>
  lists.flat().filter((gate, i, all) => all.findIndex((other) => isSamePair(other, gate)) === i)

/** Turns get_map's per-system gate links into gates. */
export const gatesFromLinks = (systems: { system_id: string; gate_connections?: MapGateLink[] }[]): MapGate[] =>
  systems.flatMap(({ system_id, gate_connections = [] }) =>
    gate_connections.map(({ system_id: to_system, online }) => ({ from_system: system_id, to_system, online })),
  )

/**
 * Draws gate lanes: solid when the gate is online, dim and dotted when it is
 * offline. `at` gives a system's screen position, or undefined when the system
 * is not on the map.
 */
export function drawGateLanes(
  ctx: CanvasRenderingContext2D,
  gates: MapGate[],
  at: (systemId: string) => { x: number; y: number } | undefined,
) {
  ctx.save()
  ctx.lineWidth = 2
  for (const gate of gates) {
    const from = at(gate.from_system)
    const to = at(gate.to_system)
    if (!from || !to) continue
    ctx.strokeStyle = gate.online ? GATE_COLOR : GATE_OFFLINE_COLOR
    ctx.setLineDash(gate.online ? [] : GATE_OFFLINE_DASH)
    strokeLine(ctx, from, to)
  }
  ctx.restore()
}
