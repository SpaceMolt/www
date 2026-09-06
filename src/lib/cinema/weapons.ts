/** Motion/timbre identity comes from the recorded gun name, not its damage color. */
export type CinemaWeaponFamily = 'laser' | 'beam' | 'railgun' | 'autocannon' | 'flak' | 'plasma' | 'missile' | 'torpedo' | 'disruptor' | 'exotic' | 'mine' | 'kinetic' | 'smartbomb'

/** Accepts public names and catalog IDs; battle instance_id is opaque and is not a type ID. */
export function resolveWeaponFamily(name = '', damageType = ''): CinemaWeaponFamily {
  const gun = name.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  // Check delivery mechanism before payload: an EMP missile is still a missile,
  // and plasma/void torpedoes must not collapse into ordinary plasma/void bolts.
  if (/\bsmartbomb\b/.test(gun)) return 'smartbomb'
  if (/\bmine\b/.test(gun)) return 'mine'
  if (/\btorpedo\b/.test(gun)) return 'torpedo'
  if (/\bmissile\b/.test(gun)) return 'missile'
  if (/\brailgun\b|\bmass driver\b/.test(gun)) return 'railgun'
  if (/\bflak\b|\bscrapgun\b/.test(gun)) return 'flak'
  if (/\bautocannon\b|\bblood reaver\b|\bfury cannon\b|\bjury rigged cannon\b/.test(gun)) return 'autocannon'
  if (/\bplasma\b/.test(gun)) return 'plasma'
  if (/\bbeam\b|\bsolar lance\b|\bvoid lance\b|\benergy siphon\b/.test(gun)) return 'beam'
  if (/\blaser\b|\bion cannon\b/.test(gun)) return 'laser'
  if (/\bdark matter\b|\bnull cannon\b|\bphase disruptor\b|\bvoid cannon\b/.test(gun)) return 'exotic'
  if (/\bemp\b|\bem disruptor\b|\bion blaster\b|\bneural disruptor\b|\bsystem disabler\b|\bstorm lance\b|\bgalvanic hull grid\b/.test(gun)) return 'disruptor'
  if (/\bharpoon\b/.test(gun)) return 'kinetic'
  switch (damageType.toLowerCase()) {
    case 'energy': return 'laser'
    case 'thermal': return 'plasma'
    case 'em': return 'disruptor'
    case 'void': return 'exotic'
    // Unknown explosive damage does not establish a guided missile mechanism.
    default: return 'kinetic'
  }
}

const colors: Record<CinemaWeaponFamily, number> = {
  laser: 0x74edff, beam: 0xc3efff, railgun: 0xbde5ff, autocannon: 0xffd590,
  flak: 0xffad62, plasma: 0xff783c, missile: 0xffbd73, torpedo: 0xffb27a,
  disruptor: 0x8b9fff, exotic: 0xbe83ff, mine: 0xffad54, kinetic: 0xe4bc86,
  smartbomb: 0xffc38b,
}

/** Payload color remains independent from the weapon's flight and firing behavior. */
export function getWeaponColor(family: CinemaWeaponFamily, damageType = ''): number {
  switch (damageType.toLowerCase()) {
    case 'void': return 0xc395ff
    case 'em': return 0x8d9aff
    case 'thermal': return 0xff8548
    case 'explosive': return family === 'kinetic' ? 0xffad6c : colors[family]
    default: return colors[family]
  }
}
