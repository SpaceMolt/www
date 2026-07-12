import { GalaxyMap } from '@/components/GalaxyMap'

// The map is a full-bleed instrument view: it fills the console main
// viewport with zero header chrome. The h1 is visually hidden; the on-map
// title chip inside GalaxyMap is the visible identifier.
const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

export default function GalaxyMapPage() {
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <h1 style={srOnly}>Galaxy Map</h1>
      <h2 style={srOnly}>Interactive Star Chart</h2>
      <h2 style={srOnly}>Map Controls and Legend</h2>
      <GalaxyMap fullPage />
    </div>
  )
}
