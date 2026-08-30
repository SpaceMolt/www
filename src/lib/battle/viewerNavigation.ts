/** Replay links always leave Play's query state behind. */
export function battleMomentPath(battleId: string, playhead: number): string {
  return `/battles/${encodeURIComponent(battleId)}?t=${Math.max(0, Math.floor(playhead))}`
}

export function acceptsPlaybackShortcut(
  event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; defaultPrevented: boolean },
  interactiveTarget: boolean,
): boolean {
  return !interactiveTarget && !event.defaultPrevented && !event.altKey && !event.ctrlKey && !event.metaKey
}

/** Preserve the viewed game tick when delayed persistence inserts earlier rows. */
export function reconcilePlayhead(previous: readonly { tick: number }[], next: readonly { tick: number }[], playhead: number): number {
  const tick = previous[Math.floor(playhead)]?.tick
  const index = tick === undefined ? -1 : next.findIndex(entry => entry.tick === tick)
  return index < 0 ? playhead : index + (playhead % 1)
}
