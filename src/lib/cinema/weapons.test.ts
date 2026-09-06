import { describe, expect, it } from 'bun:test'
import { getWeaponColor, resolveWeaponFamily, type CinemaWeaponFamily } from './weapons'

/** All 69 weapons in the public catalog audit, plus historical smartbomb records. */
const catalog: Record<CinemaWeaponFamily, string[]> = {
  laser: ['pulse_laser_i', 'pulse_laser_ii', 'pulse_laser_iii', 'heavy_pulse_laser', 'ion_cannon_i', 'ion_cannon_ii', 'void_laser'],
  beam: ['focused_beam_i', 'focused_beam_ii', 'focused_beam_iii', 'ion_beam_array', 'judgment_beam', 'solar_lance', 'graviton_beam_i', 'graviton_beam_ii', 'entropy_beam', 'void_lance_i', 'void_lance_ii', 'energy_siphon'],
  railgun: ['railgun_i', 'railgun_ii', 'piercing_railgun_i', 'piercing_railgun_ii', 'siege_railgun', 'mass_driver', 'heavy_mass_driver'],
  autocannon: ['autocannon_i', 'autocannon_ii', 'blood_reaver', 'fury_cannon', 'jury_rigged_cannon'],
  flak: ['flak_cannon_i', 'flak_cannon_ii', 'flak_cannon_iii', 'scrapgun'],
  plasma: ['plasma_cannon_i', 'plasma_cannon_ii', 'plasma_cannon_iii', 'plasma_cannon_iv', 'plasma_repeater_i', 'plasma_repeater_ii'],
  missile: ['missile_launcher_i', 'missile_launcher_ii', 'emp_missile_launcher'],
  torpedo: ['heavy_torpedo', 'plasma_torpedo_launcher', 'void_torpedo_launcher'],
  disruptor: ['em_disruptor_i', 'emp_cannon_i', 'emp_pulse_i', 'emp_pulse_ii', 'emp_pulse_iii', 'ion_blaster_i', 'ion_blaster_ii', 'ion_blaster_iii', 'neural_disruptor', 'storm_lance', 'system_disabler', 'galvanic_hull_grid'],
  exotic: ['dark_matter_projector', 'null_cannon', 'phase_disruptor', 'void_cannon'],
  mine: ['mine_launcher_i', 'mine_launcher_ii', 'proximity_mine_launcher', 'tracking_mine_launcher', 'void_mine_launcher'],
  kinetic: ['scrap_harpoon'],
  smartbomb: ['em_smartbomb', 'kinetic_smartbomb', 'explosive_smartbomb', 'thermal_smartbomb'],
}

describe('recorded weapon identity', () => {
  it('recognizes every audited public weapon and historical smartbomb by ID or display name', () => {
    expect(Object.values(catalog).flat()).toHaveLength(73)
    for (const [family, ids] of Object.entries(catalog)) for (const id of ids) {
      expect(resolveWeaponFamily(id)).toBe(family)
      expect(resolveWeaponFamily(id.replaceAll('_', ' ').toUpperCase())).toBe(family)
    }
  })
  it('keeps delivery mechanism ahead of damage type and payload names', () => {
    expect(resolveWeaponFamily('EMP Missile Launcher', 'explosive')).toBe('missile')
    expect(resolveWeaponFamily('Plasma Torpedo Launcher', 'thermal')).toBe('torpedo')
    expect(resolveWeaponFamily('Void Torpedo Launcher', 'void')).toBe('torpedo')
    expect(resolveWeaponFamily('Void Mine Launcher', 'void')).toBe('mine')
    expect(resolveWeaponFamily('Graviton Beam II', 'kinetic')).toBe('beam')
    expect(resolveWeaponFamily('EMP Cannon I', 'energy')).toBe('disruptor')
    expect(resolveWeaponFamily('Galvanic Hull Grid', 'energy')).toBe('disruptor')
  })
  it('does not collapse mixed loadouts that deal the same damage type', () => {
    const kinetic = ['Autocannon I', 'Railgun I', 'Flak Cannon II', 'Graviton Beam I', 'Scrap Harpoon'].map(name => resolveWeaponFamily(name, 'kinetic'))
    expect(new Set(kinetic).size).toBe(5)
    expect(resolveWeaponFamily('Pulse Laser I', 'energy')).not.toBe(resolveWeaponFamily('Focused Beam I', 'energy'))
  })
  it('uses conservative payload fallbacks for incomplete historical records', () => {
    expect(resolveWeaponFamily(undefined, 'energy')).toBe('laser')
    expect(resolveWeaponFamily('unrecognized mount', 'explosive')).toBe('kinetic')
    expect(resolveWeaponFamily()).toBe('kinetic')
    expect(resolveWeaponFamily('Jury-Rigged Cannon', 'kinetic')).toBe('autocannon')
    expect(resolveWeaponFamily('Thermal Smartbomb', 'thermal')).toBe('smartbomb')
  })
  it('retains payload colors without changing family', () => {
    expect(getWeaponColor('torpedo', 'void')).not.toBe(getWeaponColor('torpedo', 'thermal'))
    for (const family of Object.keys(catalog) as CinemaWeaponFamily[]) {
      expect(Number.isInteger(getWeaponColor(family))).toBe(true)
      expect(getWeaponColor(family)).toBeGreaterThanOrEqual(0)
      expect(getWeaponColor(family)).toBeLessThanOrEqual(0xffffff)
    }
  })
})
