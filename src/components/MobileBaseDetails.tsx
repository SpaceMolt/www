export interface MobileBaseCatalog {
  combat_model: 'station'
  ship_modules: false
  production_slots: number
  weapon_mounts: number
  storage_capacity_per_item: number
  fuel_capacity: number
  built_in_facilities: { id: string; name: string }[]
  services: string[]
  default_weapon_facilities: { id: string; name: string }[]
}

export interface MobileBaseIdentity {
  class?: string
  mobile_base_archetype?: string
  mobile_base?: MobileBaseCatalog
}

export function isMobileBase(ship: MobileBaseIdentity): boolean {
  return Boolean(ship.mobile_base || ship.mobile_base_archetype || ship.class === 'Mobile Base')
}

export function MobileBaseDetails({ ship }: { ship: MobileBaseIdentity }) {
  const base = ship.mobile_base
  return (
    <div>
      <p>Faction-owned mobile station. Uses station combat and station weapon facilities; cannot fit ship modules or be piloted as a ship.</p>
      {base ? <>
        <p>{base.weapon_mounts} station weapon mounts · {base.production_slots} production slots · {base.storage_capacity_per_item.toLocaleString('en-US')} faction storage per item</p>
        <p>Station fuel reservoir: {base.fuel_capacity.toLocaleString('en-US')}. Shield recharge depends on station power.</p>
        <p>Default station weapons: {base.default_weapon_facilities.map((facility) => facility.name).join(', ')}. Weapons use station ammunition and maintenance.</p>
        <p>Built-in facilities: {base.built_in_facilities.map((facility) => facility.name).join(', ')}.</p>
      </> : <p>Station service and fitting details are unavailable in this catalog version.</p>}
    </div>
  )
}
