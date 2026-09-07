type FocusTarget = Pick<HTMLElement, 'isConnected' | 'focus'>

export function restoreSettingsFocus(trigger: FocusTarget | null, player: FocusTarget | null) {
  // Closing removes the focused settings control from the DOM. Move focus
  // before that happens so keyboard users can continue operating the player.
  const target = trigger?.isConnected ? trigger : player
  if (target?.isConnected) target.focus({ preventScroll: true })
}
