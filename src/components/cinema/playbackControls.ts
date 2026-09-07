interface ShortcutEvent {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  defaultPrevented: boolean
}

export type CinemaShortcut = 'play' | 'back' | 'forward' | 'mute' | 'fullscreen' | 'close-settings'

export function cinemaShortcut(event: ShortcutEvent, interactive: boolean): CinemaShortcut | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return null
  if (event.key === 'Escape') return 'close-settings'
  if (interactive) return null
  if (event.key === ' ') return 'play'
  if (event.key === 'ArrowLeft') return 'back'
  if (event.key === 'ArrowRight') return 'forward'
  if (event.key.toLowerCase() === 'm') return 'mute'
  if (event.key.toLowerCase() === 'f') return 'fullscreen'
  return null
}
