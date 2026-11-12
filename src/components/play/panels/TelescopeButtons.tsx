import { Pin, PinOff, Telescope } from 'lucide-react'
import type { TelescopeControl } from '../telescope'
import styles from './GalaxyPanel.module.css'

/** The telescope controls in a map's button stack: the toggle, then pin and clear while it is on. */
export function TelescopeButtons({ telescope }: { telescope: TelescopeControl }) {
  const button = (label: string, onClick: () => void, icon: React.ReactNode, props: React.ButtonHTMLAttributes<HTMLButtonElement> = {}) => (
    <button type="button" className={`${styles.zoomBtn} ${styles.driveBtn}`} onClick={onClick} aria-label={label} title={label} {...props}>{icon}</button>
  )
  return (
    <>
      {telescope.on && telescope.pins > 0 && button(`Clear ${telescope.pins} pinned telescope readings`, telescope.onClearPins, <PinOff size={16} />)}
      {telescope.on && button('Pin these star lines to the map, to cross them with lines from another position', telescope.onPin, <Pin size={16} />, { disabled: !telescope.canPin })}
      {button('Telescope: show star lines', telescope.onToggle, <Telescope size={16} />, { 'aria-pressed': telescope.on })}
    </>
  )
}
