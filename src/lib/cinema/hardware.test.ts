import { describe, expect, it } from 'bun:test'
import { buildHardwareCatalog, mergeRecordedHardwareWeapons, projectCinemaHardware } from './hardware'

const mod = (name: string, category = 'module') => ({ name, category })
const gun = (instance_id: string, name: string, damage_type = 'energy') => ({ instance_id, name, damage_type })

describe('recorded hull hardware', () => {
  it('cross-checks normalized names against public catalog types and actual utility stats', () => {
    const catalog = buildHardwareCatalog([{ name: 'Laser Survey Array', type: 'utility', scanner_power: 10 },
      { name: 'Silent Hold', type: 'utility', cargo_bonus: 50 }, { name: 'Exotic Blaster', type: 'mining' },
      { name: 'Generic Projector', type: 'weapon', damage_type: 'em' },
      { name: 'Plasma Cannon', type: 'defense' }, { name: 'Plain Bay', type: 'utility', special: 'salvage_bonus_20' },
      { name: 'Iron Ore', category: 'ore' } as { name: string }])
    expect(projectCinemaHardware(['laser_survey-array', 'Silent Hold', 'Exotic Blaster', 'Generic Projector', 'Plasma Cannon', 'Plain Bay'].map(name => mod(name)), [], catalog))
      .toEqual({ source: 'modules', weapons: { disruptor: 1 }, cargo: 1, mining: 1, salvage: 1, sensor: 1, defense: 1, utility: 0 })
    expect(Object.keys(catalog)).toHaveLength(6)
  })
  it('handles conflicting catalog names deterministically without choosing an arbitrary gun definition', () => {
    const entries = [{ name: 'Test Laser', type: 'weapon' }, { name: 'test-laser', type: 'utility' }]
    const catalog = buildHardwareCatalog(entries)
    expect(catalog).toEqual(buildHardwareCatalog([...entries].reverse()))
    expect(projectCinemaHardware([mod('Test Laser')], [], catalog)).toMatchObject({ weapons: {}, utility: 1 })
    expect(projectCinemaHardware([mod('Legacy Railgun')], [], catalog).weapons).toEqual({ railgun: 1 })
  })
  it('distinguishes missing module evidence, explicit empty fits, and recorded firing', () => {
    expect(projectCinemaHardware(undefined).source).toBe('unknown')
    expect(projectCinemaHardware([], [gun('x', 'Railgun I')])).toMatchObject({ source: 'modules', weapons: {}, utility: 0 })
    expect(projectCinemaHardware(undefined, [gun('x', 'Railgun I')])).toMatchObject({ source: 'recorded-weapons', weapons: { railgun: 1 } })
  })
  it('projects real generic-category modules and preserves identical fitted copies', () => {
    expect(projectCinemaHardware([mod('Pulse Laser III'), mod('Pulse Laser III'), mod('Null Cannon'),
      mod('Shield Booster IV'), mod('Damage Control System'), mod('Cargo Expander II'),
      mod('Mining Laser I'), mod('Outer Rim Salvage Array'), mod('Ship Scanner II'), mod('CPU Co-Processor')]))
      .toEqual({ source: 'modules', weapons: { laser: 2, exotic: 1 }, cargo: 1, mining: 1, salvage: 1, sensor: 1, defense: 2, utility: 1 })
  })
  it('uses explicit categories before gun-like names and separates noncombat beams and plasma hardware', () => {
    const profile = projectCinemaHardware([mod('Survey Laser', 'mining'), mod('Laser Array', 'sensor'),
      mod('Plasma Cannon', 'defense'), mod('Torpedo Rack', 'cargo'), mod('Mystery Box', 'weapon'),
      mod('Tractor Beam'), mod('Plasma Afterburner'), mod('Crystal Mining Probe'), mod('Warp Disruptor'),
      mod('Laser Scanner'), mod('Unknown Future Module')])
    expect(profile).toEqual({ source: 'modules', weapons: { kinetic: 1 }, cargo: 1, mining: 2,
      salvage: 1, sensor: 2, defense: 1, utility: 3 })
  })
  it('recognizes nonstandard recorded weapon names without treating arbitrary modules as guns', () => {
    const profile = projectCinemaHardware(['Blood Reaver', 'Solar Lance', 'Dark Matter Projector',
      'Energy Siphon', 'EMP Pulse III', 'Galvanic Hull Grid', 'Phase Disruptor'].map(name => mod(name)))
    expect(profile.weapons).toEqual({ autocannon: 1, beam: 2, exotic: 2, disruptor: 2 })
    expect(projectCinemaHardware([mod('Unrecognized Module')]).weapons).toEqual({})
  })
  it('deduplicates repeated instance IDs but retains multiple identical guns and anonymous per-volley maxima', () => {
    const first = [gun('a', 'Pulse Laser I'), gun('b', 'Pulse Laser I'), gun('', 'Railgun I'), gun('', 'Railgun I')]
    const second = [gun('a', 'Pulse Laser I'), gun('b', 'Pulse Laser I'), gun('', 'Railgun I')]
    const evidence = mergeRecordedHardwareWeapons(mergeRecordedHardwareWeapons([], first), second)
    expect(projectCinemaHardware(undefined, evidence).weapons).toEqual({ laser: 2, railgun: 2 })
    expect(evidence).toHaveLength(4)
    expect(first[2].instance_id).toBe('')
  })
  it('bounds large fits and evidence and returns immutable compact values', () => {
    const modules = Array.from({ length: 1000 }, () => mod('Pulse Laser I'))
    const profile = projectCinemaHardware([...modules, ...Array.from({ length: 1000 }, () => mod('Cargo Expander I'))])
    expect(profile.weapons.laser).toBeLessThanOrEqual(8)
    expect(profile.cargo).toBeLessThanOrEqual(8)
    expect(Object.isFrozen(profile)).toBe(true)
    expect(Object.isFrozen(profile.weapons)).toBe(true)
    const evidence = mergeRecordedHardwareWeapons([], modules.map((m, i) => gun(String(i), m.name)))
    expect(evidence.length).toBeLessThanOrEqual(104)
  })
})
