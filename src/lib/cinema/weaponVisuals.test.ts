import { describe, expect, test } from 'bun:test'
import { Vector3 } from 'three'
import { weaponVisual } from './weaponVisuals'
import type { CinemaCue } from './types'
import type { CinemaWeaponFamily } from './weapons'
const families: CinemaWeaponFamily[]=['laser','beam','railgun','autocannon','flak','plasma','missile','torpedo','disruptor','exotic','mine','kinetic','smartbomb']
const from=new Vector3(-120,10,20),to=new Vector3(250,-5,40)
const cue: CinemaCue={id:'shot',kind:'weapon',time:2,tick:1,duration:2,from:'a',to:'b',hit:true,damageType:'energy',intensity:.6}
describe('weapon choreography',()=>{
  test('each family stays finite and within a bounded geometry budget at every phase',()=>{
    for(const family of families)for(const duration of [.015,.1,2,10])for(const age of [-1,0,duration*.25,duration*.6,duration,duration+.7,duration+1.3]){
      const frame=weaponVisual({...cue,weaponFamily:family,duration},age,from,to,80,120)
      expect(frame.lines.length).toBeLessThanOrEqual(24)
      expect(frame.projectiles.length).toBeLessThanOrEqual(3)
      expect(frame.rings.length).toBeLessThanOrEqual(2)
      for(const line of frame.lines){expect([...line.from.toArray(),...line.to.toArray(),line.width].every(Number.isFinite)).toBe(true);expect(line.width).toBeGreaterThanOrEqual(0)}
      for(const glow of frame.glows){expect([...glow.position.toArray(),glow.radius,glow.opacity].every(Number.isFinite)).toBe(true);expect(glow.opacity).toBeGreaterThanOrEqual(0);expect(glow.opacity).toBeLessThanOrEqual(1)}
    }
  })
  test('missiles curve through space while torpedoes launch fewer heavier bodies',()=>{
    const missiles=weaponVisual({...cue,weaponFamily:'missile'},1,from,to,80,120)
    const torpedo=weaponVisual({...cue,weaponFamily:'torpedo'},1,from,to,80,120)
    expect(missiles.projectiles).toHaveLength(3);expect(torpedo.projectiles).toHaveLength(1)
    expect(torpedo.projectiles[0].size).toBeGreaterThan(missiles.projectiles[0].size)
    expect(missiles.projectiles[0].position.y).toBeGreaterThan(from.clone().lerp(to,.5).y)
    const close=weaponVisual({...cue,weaponFamily:'missile'},1.99999,from,to,80,120)
    for(const missile of close.projectiles)expect(missile.position.distanceTo(to)).toBeLessThan(.1)
  })
  test('missed shots never produce impact explosions or collateral effects',()=>{
    for(const family of families){const frame=weaponVisual({...cue,hit:false,weaponFamily:family},2.3,from,to,80,120);expect(frame.glows).toHaveLength(0);expect(frame.rings).toHaveLength(0);expect(frame.lines).toHaveLength(0)}
  })
  test('chain and splash use the recorded parent impact rather than the firing ship',()=>{
    const origin=new Vector3(170,5,12)
    const chain=weaponVisual({...cue,parentId:'parent',secondaryKind:'chain'},2.2,from,to,80,120,false,origin)
    expect(chain.lines[0].from).toEqual(origin);expect(chain.lines.at(-1)?.to).toEqual(to)
    const splash=weaponVisual({...cue,parentId:'parent',secondaryKind:'ammo_splash'},2.2,from,to,80,120,false,origin)
    expect(splash.lines).toHaveLength(0);expect(splash.rings[0].position).toEqual(origin)
    expect(weaponVisual({...cue,parentId:'missing',secondaryKind:'chain'},2.2,from,to,80,120).lines).toHaveLength(0)
  })
  test('absorbed explosive hits and contact defenses cannot become penetrating gunfire',()=>{
    for(const family of ['missile','torpedo','smartbomb','mine','plasma'] as const){
      const absorbed=weaponVisual({...cue,weaponFamily:family,hullDamage:0,shieldDamage:10},2.2,from,to,80,120)
      expect(absorbed.glows).toHaveLength(0);expect(absorbed.rings).toHaveLength(0)
    }
    const contact=weaponVisual({...cue,weaponName:'Galvanic Hull Grid',secondaryKind:'retaliation'},1,from,to,80,120)
    expect(contact.lines).toHaveLength(0);expect(contact.projectiles).toHaveLength(0)
  })
  test('a smartbomb detonates around its target and a mine never invents a direct beam',()=>{
    const bomb=weaponVisual({...cue,weaponFamily:'smartbomb',hullDamage:10},2.2,from,to,80,120)
    expect(bomb.lines).toHaveLength(0);expect(bomb.rings[0].position).toEqual(to)
    const mine=weaponVisual({...cue,weaponFamily:'mine'},1,from,to,80,120)
    expect(mine.lines).toHaveLength(0);expect(mine.projectiles).toHaveLength(1)
  })
})
