/** Single-key shortcuts for /play. Panel keys 1-9 follow the tab order in PanelNav. */
export const ACTION_SHORTCUTS = [
  { key: 'd', label: 'Dock or undock' },
  { key: 'm', label: 'Mine once' },
  { key: 'f', label: 'Refuel' },
  { key: 'r', label: 'Repair' },
  { key: 'n', label: 'Open the navigation drawer (phone)' },
  { key: '?', label: 'Show or hide this help' },
  { key: 'Esc', label: 'Close help or drawer' },
] as const

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target'> & { repeat?: boolean }

/**
 * The shortcut key for an event, lowercased, or null when the player is typing
 * holding a modifier (browser shortcuts must keep working), or holding the key down.
 */
export function shortcutKey({ key, ctrlKey, metaKey, altKey, target, repeat = false }: KeyEventLike): string | null {
  if (ctrlKey || metaKey || altKey || repeat) return null
  const el = target as { tagName?: string; isContentEditable?: boolean } | null
  if (el?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName ?? '')) return null
  return key.toLowerCase()
}
