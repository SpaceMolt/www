import { describe, expect, it } from 'bun:test'
import { buildCinemaCascades, sampleCinemaCascade } from './cascades'
import type { CinemaCue } from './types'
import { weaponImpactAge } from './playback'

const primary: CinemaCue = { id: 'primary', kind: 'weapon', from: 'attacker', to: 'victim',
  time: 10, duration: 2, tick: 1, hit: true, hullDamage: 10, intensity: .6 }
const collateral = (id: string, over: Partial<CinemaCue> = {}): CinemaCue => ({ ...primary,
  id, to: id, parentId: primary.id, secondaryKind: 'aoe', ...over })
const point = (x: number, y = 0, z = 0) => ({ x, y, z })

describe('recorded cinematic cascades', () => {
  it('centers area propagation on the primary victim and samples real positions at its impact', () => {
    const calls: [string, number][] = []
    const [plan] = buildCinemaCascades([primary, collateral('near'), collateral('far')], (id, time) => {
      calls.push([id, time]); return id === 'victim' ? point(100) : id === 'near' ? point(120) : point(180)
    })
    expect(plan.center).toEqual(point(100))
    expect(plan.sourceCueId).toBe('primary')
    expect(plan.time).toBe(12)
    expect(calls.every(([id, time]) => id !== 'attacker' && time === 12)).toBe(true)
    expect(plan.recipients.map(recipient => recipient.actorId)).toEqual(['victim', 'near', 'far'])
    expect(plan.recipients[1].delay).toBeLessThan(plan.recipients[2].delay)
    expect(plan.duration).toBeGreaterThanOrEqual(1.2)
    expect(plan.duration).toBeLessThanOrEqual(2)
  })

  it('never invents recipients for misses, unrelated shots, orphaned collateral or missing positions', () => {
    const cues = [primary, collateral('hit'), collateral('miss', { hit: false }), collateral('unknown', { hit: undefined }),
      collateral('missing'), collateral('orphan', { parentId: 'absent' }), collateral('unrelated', { parentId: undefined, secondaryKind: undefined })]
    const plans = buildCinemaCascades(cues, id => id === 'missing' ? undefined : point(id === 'victim' ? 0 : 100))
    expect(plans).toHaveLength(1)
    expect(plans[0].recipients.map(recipient => recipient.actorId)).toEqual(['victim', 'hit'])
    expect(buildCinemaCascades([primary, collateral('miss', { hit: false })], () => point(0))).toHaveLength(0)
    expect(buildCinemaCascades([primary, collateral('hit')], id => id === 'victim' ? point(NaN) : point(0))).toHaveLength(0)
  })

  it('keeps all 99 connected victims in a finite bounded wave with separately readable pulses', () => {
    const cues = [primary, ...Array.from({ length: 98 }, (_, i) => collateral(`ship:${i}`))]
    const [plan] = buildCinemaCascades(cues, id => {
      const i = id === 'victim' ? 0 : Number(id.split(':')[1]) + 1
      return point(Math.cos(i) * (i ? 300 : 0), 0, Math.sin(i) * (i ? 300 : 0))
    })
    expect(plan.recipients).toHaveLength(99)
    const seen = new Set<string>()
    for (let time = plan.time; time <= plan.time + plan.duration; time += .01) {
      const frame = sampleCinemaCascade(plan, time, 32)
      expect(frame.pulses.length).toBeLessThanOrEqual(32)
      expect(frame.links).toHaveLength(0)
      expect(frame.wave === undefined || Number.isFinite(frame.wave.radius)).toBe(true)
      for (const pulse of frame.pulses) { seen.add(pulse.actorId); expect(Number.isFinite(pulse.opacity)).toBe(true) }
    }
    expect(seen.size).toBe(99)
    expect(sampleCinemaCascade(plan, plan.time - .01).pulses).toHaveLength(0)
    expect(sampleCinemaCascade(plan, plan.time + plan.duration + .01).wave).toBeUndefined()
  })

  it('associates only recorded same-tick losses from the source and keeps arena knockout distinct from death', () => {
    const fate = (to: string, kind: 'death' | 'knockout', over: Partial<CinemaCue> = {}): CinemaCue => ({ id: `loss:${to}`, to,
      from: 'attacker', kind, tick: 1, time: 12.4, duration: 3, intensity: 1, ...over })
    const [plan] = buildCinemaCascades([primary, collateral('arena'), collateral('destroyed'), collateral('other'),
      fate('arena', 'knockout'), fate('destroyed', 'death'), fate('other', 'death', { from: 'different-attacker' })],
      id => point(id === 'victim' ? 0 : id === 'arena' ? 100 : id === 'destroyed' ? 200 : 300))
    expect(plan.recipients.map(recipient => [recipient.actorId, recipient.fate])).toEqual([
      ['victim', 'hit'], ['arena', 'knockout'], ['destroyed', 'death'], ['other', 'hit'],
    ])
    const pulse = sampleCinemaCascade(plan, plan.time + plan.recipients[1].delay + .1).pulses.find(p => p.actorId === 'arena')!
    expect(pulse.fate).toBe('knockout')
    expect(pulse.intensity).toBe(1)
  })

  it('renders chain hops as links between recorded recipients rather than an area wave', () => {
    const [plan] = buildCinemaCascades([primary, collateral('one', { secondaryKind: 'chain' }), collateral('two', { secondaryKind: 'chain' })],
      id => point(id === 'victim' ? 0 : id === 'one' ? 80 : 160))
    const frame = sampleCinemaCascade(plan, plan.time + plan.recipients[2].delay + .1)
    expect(frame.wave).toBeUndefined()
    expect(frame.links.some(link => link.fromActorId === 'one' && link.toActorId === 'two')).toBe(true)
    expect(frame.links.every(link => link.fromActorId !== 'attacker')).toBe(true)
  })

  it('merges overlapping area and ammo recipients without duplicating a main wave or local damage', () => {
    const [plan] = buildCinemaCascades([primary, collateral('one'),
      collateral('again', { to: 'one', secondaryKind: 'ammo_splash' }), collateral('two', { secondaryKind: 'ammo_splash' })],
      id => point(id === 'victim' ? 0 : id === 'one' ? 40 : 80))
    expect(plan.kind).toBe('aoe')
    expect(plan.recipients.map(recipient => recipient.actorId)).toEqual(['victim', 'one', 'two'])
    expect(sampleCinemaCascade(plan, plan.time + .4, 0).pulses).toHaveLength(0)
    expect(sampleCinemaCascade(plan, plan.time + .4, 0).wave).toBeDefined()
  })

  it('never advances a later knockout while presenting its preceding hit', () => {
    const loss: CinemaCue = { id: 'loss', kind: 'knockout', from: 'attacker', to: 'victim',
      time: 12.4, duration: 3, tick: 1, intensity: 1 }
    const source = [primary, collateral('one'), loss], before = JSON.stringify(source)
    const [plan] = buildCinemaCascades(source, id => point(id === 'victim' ? 0 : 40))
    expect(plan.recipients[0].fate).toBe('knockout')
    expect(sampleCinemaCascade(plan, 12.1).pulses.find(pulse => pulse.actorId === 'victim')?.fate).toBe('hit')
    expect(JSON.stringify(source)).toBe(before)
    expect(plan.recipients[0].fateTime).toBe(12.4)
  })

  it('uses the shared weapon impact convention, including the railgun charge and flight', () => {
    const rail: CinemaCue = { ...primary, weaponFamily: 'railgun', duration: 4 }
    const [plan] = buildCinemaCascades([rail, collateral('one')], id => point(id === 'victim' ? 0 : 40))
    expect(weaponImpactAge(rail, plan.time)).toBe(0)
    expect(plan.time).toBe(14)
  })

  it('keeps chain cue order when the next recorded recipient is nearer than the first', () => {
    const [plan] = buildCinemaCascades([primary, collateral('far', { secondaryKind: 'chain' }),
      collateral('near', { secondaryKind: 'chain' })], id => point(id === 'victim' ? 0 : id === 'far' ? 200 : 20))
    expect(plan.recipients.map(recipient => recipient.actorId)).toEqual(['victim', 'far', 'near'])
    expect(plan.recipients[1].delay).toBeLessThan(plan.recipients[2].delay)
    const frame = sampleCinemaCascade(plan, plan.time + plan.recipients[2].delay + .1)
    expect(frame.links.some(link => link.fromActorId === 'far' && link.toActorId === 'near')).toBe(true)
  })
})
