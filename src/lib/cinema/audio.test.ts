import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { CinemaAudio } from './audio'
import { composeScore } from './score'
import type { CinemaAudioCue } from './audioSchedule'
import type { CinemaFilm } from './types'

// Model scheduling and graph lifetime, not audible output. Future stop() calls
// remain pending until end() or an immediate stop(), just as browser voices do.
class FakeParam {
  value = 0
  calls: { method: string; value: number; time: number }[] = []
  private record(method: string, value: number, time: number, constant = 1) {
    if (!Number.isFinite(value) || !Number.isFinite(time) || time < 0 || !(constant > 0)) throw new Error('Invalid audio automation')
    this.calls.push({ method, value, time })
    this.value = value
  }
  setTargetAtTime(value: number, time: number, constant: number) { this.record('target', value, time, constant) }
  setValueAtTime(value: number, time: number) { this.record('value', value, time) }
  cancelScheduledValues(time: number) { if (!Number.isFinite(time)) throw new Error('Invalid cancel') }
}
class FakeNode {
  connections: FakeNode[] = []
  disconnected = false
  gain = new FakeParam(); pan = new FakeParam(); frequency = new FakeParam()
  threshold = new FakeParam(); knee = new FakeParam(); ratio = new FakeParam(); attack = new FakeParam(); release = new FakeParam()
  type = ''; curve: unknown = null; normalize = true; buffer: unknown = null; loop = false
  connect(target: FakeNode | FakeParam) { if (target instanceof FakeNode) this.connections.push(target); return target }
  disconnect() { this.disconnected = true; this.connections = [] }
}
class FakeSource extends FakeNode {
  onended: (() => void) | null = null
  starts: [number, number][] = []
  stops: (number | undefined)[] = []
  ended = false
  start(time = 0, offset = 0) { this.starts.push([time, offset]) }
  stop(time?: number) { this.stops.push(time); if (time === undefined) this.end() }
  end() { if (!this.ended) { this.ended = true; this.onended?.() } }
}
class FakeContext {
  static instances: FakeContext[] = []
  currentTime = 10
  sampleRate = 8000
  destination = new FakeNode()
  gains: FakeNode[] = []
  panners: FakeNode[] = []
  sources: FakeSource[] = []
  continuous: FakeSource[] = []
  resumes = 0
  closes = 0
  constructor() { FakeContext.instances.push(this) }
  createGain() { const node = new FakeNode(); this.gains.push(node); return node }
  createWaveShaper() { return new FakeNode() }
  createDynamicsCompressor() { return new FakeNode() }
  createBiquadFilter() { return new FakeNode() }
  createConvolver() { return new FakeNode() }
  createStereoPanner() { const node = new FakeNode(); this.panners.push(node); return node }
  createOscillator() { const node = new FakeSource(); this.continuous.push(node); return node }
  createBufferSource() { const node = new FakeSource(); this.sources.push(node); return node }
  createBuffer(channels: number, length: number) { const data = Array.from({ length: channels }, () => new Float32Array(length)); return { getChannelData: (c: number) => data[c] } }
  resume() { this.resumes++; return Promise.resolve() }
  close() { this.closes++; return Promise.resolve() }
  /** One-shot voices: everything but the looping ambience beds. */
  get transients() { return this.sources.filter(source => !source.loop) }
  get output() { return this.gains[0].gain }
}
class FakeWorker {
  static instances: FakeWorker[] = []
  posted: { film?: unknown; keys?: string[]; reset?: boolean }[] = []
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  terminated = false
  constructor() { FakeWorker.instances.push(this) }
  postMessage(data: { keys?: string[] }) { this.posted.push(data) }
  terminate() { this.terminated = true }
  reply(key: string) { this.onmessage?.({ data: { key, sound: { rate: 8000, l: new Float32Array(80), r: new Float32Array(80), lead: 0, short: 0, long: 0 } } }) }
  get keys() { return this.posted.flatMap(message => message.keys ?? []) }
}

const film: CinemaFilm = {
  version: 1, battleId: 'b', seed: 3, duration: 12, arena: false, outcome: 'victory', winningSide: 2, systemName: 's',
  ships: [
    { id: 'a', playerId: 'a', name: 'a', shipClass: 'x', kind: 'ship', sideId: 2, sideIndex: 0, start: 0, end: 12, fate: 'survived', health: [] },
    { id: 'b', playerId: 'b', name: 'b', shipClass: 'x', kind: 'ship', sideId: 1, sideIndex: 0, start: 0, end: 7, fate: 'destroyed', health: [] },
  ],
  shots: [{ start: 0, end: 2.5, kind: 'reveal', intensity: .12 }, { start: 2.5, end: 9, kind: 'broadside', intensity: .8, subject: 'a', target: 'b' }, { start: 9, end: 12, kind: 'aftermath', intensity: .12 }],
  story: { protagonistId: 'a', adversaryId: 'b', climaxCueId: 'loss', sequences: [] },
  cues: [
    { id: 'gun', time: 3, duration: .4, tick: 1, kind: 'weapon', from: 'a', to: 'b', hit: true, hullDamage: 10, intensity: .7, weaponFamily: 'laser' },
    { id: 'loss', time: 7, duration: 3, tick: 2, kind: 'death', to: 'b', intensity: 1 },
  ],
  segments: [],
}
const score = composeScore(film)
const weapon: CinemaAudioCue = { id: 'volley', time: 3, tick: 1, duration: 0.4, kind: 'weapon', from: 'a', to: 'b', intensity: 0.7, weaponFamily: 'laser', audioPhase: 'release' }
const death: CinemaAudioCue = { id: 'loss', time: 7, tick: 2, duration: 3, kind: 'death', to: 'b', intensity: 1 }

const originals = Object.fromEntries(['AudioContext', 'Worker'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
const instances: CinemaAudio[] = []
const makeAudio = () => { const audio = new CinemaAudio(film); instances.push(audio); return audio }
const started = () => {
  const audio = makeAudio()
  audio.setMuted(false)
  audio.setPlaying(true)
  return { audio, context: FakeContext.instances[0] }
}

beforeEach(() => {
  FakeContext.instances = []
  FakeWorker.instances = []
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, writable: true, value: FakeContext })
  Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: undefined })
})
afterEach(() => {
  for (const audio of instances.splice(0)) audio.dispose()
  for (const [name, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
})

describe('cinema audio engine', () => {
  it('creates no audio resources before Play, including configuration, clock updates, cues and seeks', () => {
    const audio = makeAudio()
    audio.setVolume(0.7)
    audio.setMuted(false)
    audio.update(3)
    audio.cue(weapon)
    audio.clear()
    audio.setPlaying(false)
    expect(FakeContext.instances).toHaveLength(0)
  })

  it('resumes synchronously on muted Play and unlocks sound from a later unmute gesture', () => {
    const audio = makeAudio()
    audio.setPlaying(true)
    const context = FakeContext.instances[0]
    expect(context.resumes).toBe(1)
    expect(context.output.value).toBe(0)
    audio.update(3)
    audio.cue(weapon)
    expect(context.transients).toHaveLength(0)
    audio.setMuted(false)
    expect(context.resumes).toBe(2)
    expect(context.output.value).toBeCloseTo(0.65)
    expect(FakeContext.instances).toHaveLength(1)
  })

  it('queues score events a short lookahead ahead on the audio clock', () => {
    const { audio, context } = started()
    audio.update(2.4)
    const expected = score.filter(note => note.instrument !== 'drop' && note.time >= 2.4 && note.time < 2.75 && note.time + note.duration > 2.4)
    const starts = context.transients.map(source => source.starts[0][0])
    expect(starts.length).toBeGreaterThanOrEqual(expected.length)
    for (const note of expected) expect(starts.some(start => Math.abs(start - (10 + note.time - 2.4)) < 1e-6)).toBe(true)
    const count = context.transients.length
    audio.update(2.45)
    expect(context.transients.slice(count).every(source => source.starts[0][0] >= 10 + .3)).toBe(true)
  })

  it('resumes a sustained note mid-way after a seek instead of skipping it', () => {
    const { audio, context } = started()
    const pad = score.find(note => note.instrument === 'pad' && note.duration > 1)!
    audio.update(pad.time + .5)
    expect(context.transients.some(source => Math.abs(source.starts[0][1] - .5) < 1e-6)).toBe(true)
  })

  it('clears every scheduled note and effect on seek and disconnects their graphs', () => {
    const { audio, context } = started()
    audio.update(2.4)
    audio.cue(weapon)
    audio.cue(death)
    expect(context.transients.length).toBeGreaterThan(2)
    audio.clear()
    expect(context.transients.every(source => source.ended && source.disconnected)).toBe(true)
    expect(context.panners.every(node => node.disconnected)).toBe(true)
    expect(context.sources.filter(source => source.loop).every(source => !source.ended)).toBe(true)
  })

  it('pauses by stopping everything and ramping the output to silence without spawning new voices', () => {
    const { audio, context } = started()
    audio.update(2.4)
    audio.cue(weapon)
    audio.setPlaying(false)
    expect(context.transients.every(source => source.ended)).toBe(true)
    expect(context.output.calls.at(-1)).toEqual({ method: 'target', value: 0, time: 10 })
    const count = context.transients.length
    audio.update(3)
    audio.cue(weapon)
    expect(context.transients).toHaveLength(count)
  })

  it('lets the final chord ring out when the film reaches its end, until the next seek', () => {
    const { audio, context } = started()
    audio.update(11.9)
    audio.update(12)
    audio.setPlaying(false)
    expect(context.transients.length).toBeGreaterThan(0)
    expect(context.transients.every(source => !source.ended)).toBe(true)
    expect(context.output.calls.at(-1)!.value).toBeGreaterThan(0)
    audio.clear()
    expect(context.transients.every(source => source.ended)).toBe(true)
    expect(context.output.calls.at(-1)!.value).toBe(0)
  })

  it('stops the ambience, terminates the render worker and closes its context on disposal', () => {
    Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: FakeWorker })
    const { audio, context } = started()
    audio.dispose()
    expect(context.closes).toBe(1)
    expect([...context.continuous, ...context.sources].every(source => source.ended && source.disconnected)).toBe(true)
    expect(FakeWorker.instances[0].terminated).toBe(true)
    audio.dispose()
    expect(context.closes).toBe(1)
  })

  it('renders ahead in the worker, plays only what has arrived, and ignores renders made stale by a seek', () => {
    Object.defineProperty(globalThis, 'Worker', { configurable: true, writable: true, value: FakeWorker })
    const { audio, context } = started()
    const worker = FakeWorker.instances[0]
    expect(worker.posted[0].film).toBeDefined()
    audio.update(2.4)
    expect(worker.keys).toContain('cgun:audio:release')
    expect(context.transients).toHaveLength(0)
    const first = score.findIndex(note => note.instrument !== 'drop' && note.time >= 2.4)
    worker.reply(`n${first}`)
    audio.update(2.41)
    expect(context.transients.length).toBe(Math.min(1, Number(score[first].time < 2.76)))
    audio.clear()
    expect(worker.posted.at(-1)).toEqual({ reset: true })
    worker.reply('cgun:audio:release')
    audio.cue({ ...weapon, id: 'gun:audio:release' })
    expect(context.transients.filter(source => !source.ended)).toHaveLength(0)
  })

  it('bounds concurrent effects and lets a loss interrupt a saturated volley', () => {
    const { audio, context } = started()
    for (let i = 0; i < 60; i++) audio.cue({ ...weapon, id: String(i) })
    expect(context.transients.filter(source => !source.ended)).toHaveLength(32)
    audio.cue(death)
    expect(context.transients.filter(source => !source.ended)).toHaveLength(32)
    expect(context.transients.at(-1)!.ended).toBe(false)
    for (let i = 0; i < 40; i++) audio.cue({ ...death, id: `d${i}` })
    const before = context.transients.length
    audio.cue({ ...weapon, id: 'late' })
    expect(context.transients).toHaveLength(before)
  })

  it('ducks the music under losses and clamps pan and user volume', () => {
    const { audio, context } = started()
    audio.cue(death, 5)
    expect(context.panners.at(-1)!.pan.value).toBeCloseTo(.85 * .6)
    expect(context.gains.some(node => node.gain.calls.some(call => call.method === 'target' && Math.abs(call.value - 10 ** (-10 / 20)) < 1e-6))).toBe(true)
    audio.cue(weapon, -500)
    expect(context.panners.at(-1)!.pan.value).toBe(-.85)
    audio.setVolume(2)
    expect(context.output.value).toBe(1)
    audio.setVolume(-3)
    expect(context.output.value).toBe(0)
  })

  it('keeps silent playback usable if AudioContext is unavailable, and non-finite values out of automation', () => {
    const { audio, context } = started()
    expect(() => { audio.setVolume(NaN); audio.update(NaN); audio.update(Infinity); audio.cue(weapon, NaN) }).not.toThrow()
    expect(context.output.value).toBe(0)
    Reflect.deleteProperty(globalThis, 'AudioContext')
    const silent = makeAudio()
    expect(() => { silent.setMuted(false); silent.setPlaying(true); silent.update(3); silent.cue(weapon); silent.clear(); silent.setPlaying(false); silent.dispose() }).not.toThrow()
  })

  it('renders the whole score into an offline context without a worker', () => {
    const context = new FakeContext()
    const audio = new CinemaAudio(film, {}, context as unknown as BaseAudioContext)
    instances.push(audio)
    expect(context.transients).toHaveLength(score.filter(note => note.instrument !== 'drop').length)
    audio.cue(death, 0, 7)
    expect(context.transients.at(-1)!.starts[0][0]).toBeCloseTo(7 - .07)
  })
})
