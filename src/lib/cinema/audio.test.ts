import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { CinemaAudio, WEAPON_SOUNDS, cueSound } from './audio'
import type { CinemaAudioCue } from './audioSchedule'

class FakeParam {
  value = 0
  setValueAtTime(value: number) { this.value = value }
  setTargetAtTime(value: number) { this.value = value }
}
class FakeNode {
  disconnected = false
  connect(target: FakeNode) { return target }
  disconnect() { this.disconnected = true }
}
class FakeSource extends FakeNode {
  buffer: unknown = null
  playbackRate = new FakeParam()
  onended: (() => void) | null = null
  stopped = false
  started = false
  start() { this.started = true }
  stop(time?: number) {
    if (!this.started) throw new Error('stop before start')
    if (time === undefined) { this.stopped = true; this.onended?.() }
  }
}
class FakeContext {
  static instances: FakeContext[] = []
  currentTime = 10
  destination = new FakeNode()
  sources: FakeSource[] = []
  closes = 0
  constructor() { FakeContext.instances.push(this) }
  createDynamicsCompressor() { return Object.assign(new FakeNode(), { threshold: new FakeParam(), ratio: new FakeParam() }) }
  createGain() { return Object.assign(new FakeNode(), { gain: new FakeParam() }) }
  createStereoPanner() { return Object.assign(new FakeNode(), { pan: new FakeParam() }) }
  createBufferSource() { const s = new FakeSource(); this.sources.push(s); return s }
  decodeAudioData(data: ArrayBuffer) { return Promise.resolve(data) }
  resume() { return Promise.resolve() }
  close() { this.closes++; return Promise.resolve() }
}
class FakeMusic {
  static instances: FakeMusic[] = []
  loop = false
  volume = 1
  paused = true
  constructor(public src: string) { FakeMusic.instances.push(this) }
  play() { this.paused = false; return Promise.resolve() }
  pause() { this.paused = true }
}

const globals = globalThis as Record<string, unknown>
const saved = { AudioContext: globals.AudioContext, Audio: globals.Audio, fetch: globals.fetch }
const fetched: string[] = []
const weapon = (extra: Partial<CinemaAudioCue> = {}): CinemaAudioCue =>
  ({ id: 'w', time: 0, tick: 1, duration: .4, kind: 'weapon', damageType: 'energy', intensity: .5, ...extra })
const started = async () => {
  const audio = new CinemaAudio()
  audio.setMuted(false)
  audio.setPlaying(true)
  await new Promise(resolve => setTimeout(resolve, 0))
  return { audio, ctx: FakeContext.instances[0], music: FakeMusic.instances[0] }
}

beforeEach(() => {
  FakeContext.instances = []
  FakeMusic.instances = []
  fetched.length = 0
  globals.AudioContext = FakeContext
  globals.Audio = FakeMusic
  globals.fetch = (url: string) => { fetched.push(url); return Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) }) }
})
afterEach(() => Object.assign(globals, saved))

describe('cinema audio', () => {
  it('maps every cue to a sound file that ships in public/cinema/sfx', async () => {
    const { audio } = await started()
    for (const url of fetched) expect(existsSync(join(process.cwd(), 'public', url))).toBe(true)
    const names = new Set(fetched.map(url => url.replace(/^\/cinema\/sfx\/|(_\d+)?\.mp3$/g, '')))
    for (const name of Object.values(WEAPON_SOUNDS)) expect(names.has(name)).toBe(true)
    for (const kind of ['death', 'knockout', 'boarding', 'capture', 'arrival', 'escape', 'repair', 'disable', 'cloak', 'drain'] as const)
      expect(names.has(cueSound({ ...weapon(), kind })![0])).toBe(true)
    for (const audioPhase of ['charge', 'impact', 'shield-impact', 'contact'] as const) expect(names.has(cueSound(weapon({ audioPhase }))![0])).toBe(true)
    audio.dispose()
  })

  it('creates nothing before Play and plays a random looping combat track', async () => {
    const audio = new CinemaAudio()
    audio.setMuted(false)
    expect(FakeContext.instances.length).toBe(0)
    audio.setPlaying(true)
    const music = FakeMusic.instances[0]
    expect(music.src).toMatch(/^https:\/\/assets\.spacemolt\.com\/cinema\/music\/combat(_[234])?\.mp3$/)
    expect(music.loop).toBe(true)
    expect(music.paused).toBe(false)
    audio.setMuted(true)
    expect(music.paused).toBe(true)
    audio.dispose()
  })

  it('picks the hit sound by phase and family, and cuts the railgun charge to its cue', () => {
    expect(cueSound(weapon({ audioPhase: 'shield-impact' }))![0]).toBe('shield_hit')
    expect(cueSound(weapon({ audioPhase: 'impact', weaponFamily: 'missile' }))![0]).toBe('explosion')
    expect(cueSound(weapon({ audioPhase: 'impact', weaponFamily: 'railgun' }))![0]).toBe('hull_hit')
    expect(cueSound(weapon({ audioPhase: 'charge', duration: .8 }))![3]).toBe(.8)
    expect(cueSound(weapon({ secondaryKind: 'retaliation' }))![0]).toBe('em')
    expect(cueSound(weapon({ weaponFamily: 'plasma' }))![0]).toBe('thermal')
  })

  it('caps voices at 24 and lets a loss replace a launch', async () => {
    const { audio, ctx } = await started()
    audio.cue(weapon({ audioPhase: 'charge' }))
    audio.cue({ ...weapon(), kind: 'repair' })
    for (let i = 0; i < 30; i++) audio.cue(weapon())
    expect(ctx.sources.length).toBe(24)
    audio.cue({ ...weapon(), kind: 'death' })
    expect(ctx.sources.length).toBe(25)
    expect(ctx.sources.filter(s => s.stopped).length).toBe(1)
    audio.clear()
    expect(ctx.sources.every(s => s.stopped)).toBe(true)
    audio.dispose()
    expect(ctx.closes).toBe(1)
  })

  it('stays silent while muted and survives a missing AudioContext', async () => {
    const { audio, ctx } = await started()
    audio.setMuted(true)
    audio.cue(weapon())
    expect(ctx.sources.length).toBe(0)
    audio.dispose()
    globals.AudioContext = undefined
    const silent = new CinemaAudio()
    expect(() => { silent.setMuted(false); silent.setPlaying(true); silent.cue(weapon()); silent.dispose() }).not.toThrow()
  })
})
