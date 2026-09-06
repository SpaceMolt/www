import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { CinemaAudio } from './audio'
import type { CinemaCue } from './types'

// Model scheduling and graph lifetime, not audible output. Future stop() calls
// remain pending until end() or an immediate stop(), just as browser voices do.
class FakeParam {
  value = 0
  calls: { method: string; value: number; time: number; constant?: number }[] = []
  private record(method: string, value: number, time: number, constant?: number) {
    if (!Number.isFinite(value) || !Number.isFinite(time) || time < 0) throw new Error('Invalid audio automation')
    if (method === 'exponential' && value <= 0) throw new Error('Exponential ramp must be positive')
    if (constant !== undefined && (!Number.isFinite(constant) || constant <= 0)) throw new Error('Invalid time constant')
    this.calls.push({ method, value, time, constant })
    this.value = value
  }
  setTargetAtTime(value: number, time: number, constant: number) { this.record('target', value, time, constant) }
  setValueAtTime(value: number, time: number) { this.record('value', value, time) }
  exponentialRampToValueAtTime(value: number, time: number) { this.record('exponential', value, time) }
}

class FakeNode {
  connections: FakeNode[] = []
  disconnected = false
  connect(target: FakeNode) { this.connections.push(target); return target }
  disconnect() { this.disconnected = true; this.connections = [] }
}
class FakeGain extends FakeNode { gain = new FakeParam() }
class FakeFilter extends FakeNode { type = ''; frequency = new FakeParam() }
class FakePanner extends FakeNode { pan = new FakeParam() }
class FakeCompressor extends FakeNode { threshold = new FakeParam(); ratio = new FakeParam() }
class FakeSource extends FakeNode {
  frequency = new FakeParam()
  detune = new FakeParam()
  type = ''
  buffer: unknown = null
  onended: (() => void) | null = null
  starts: number[] = []
  stops: (number | undefined)[] = []
  ended = false
  start(time = 0) { this.starts.push(time) }
  stop(time?: number) { this.stops.push(time); if (time === undefined) this.end() }
  end() { if (!this.ended) { this.ended = true; this.onended?.() } }
}
class FakeContext {
  static instances: FakeContext[] = []
  currentTime = 10
  sampleRate = 8000
  destination = new FakeNode()
  gains: FakeGain[] = []
  filters: FakeFilter[] = []
  panners: FakePanner[] = []
  oscillators: FakeSource[] = []
  buffers: FakeSource[] = []
  resumes = 0
  closes = 0
  constructor() { FakeContext.instances.push(this) }
  createDynamicsCompressor() { return new FakeCompressor() }
  createGain() { const node = new FakeGain(); this.gains.push(node); return node }
  createBiquadFilter() { const node = new FakeFilter(); this.filters.push(node); return node }
  createStereoPanner() { const node = new FakePanner(); this.panners.push(node); return node }
  createOscillator() { const node = new FakeSource(); this.oscillators.push(node); return node }
  createBufferSource() { const node = new FakeSource(); this.buffers.push(node); return node }
  createBuffer(_channels: number, length: number) { const samples = new Float32Array(length); return { getChannelData: () => samples } }
  resume() { this.resumes++; return Promise.resolve() }
  close() { this.closes++; return Promise.resolve() }
  get transients() { return [...this.buffers, ...this.oscillators.slice(5)] }
  get master() { return this.gains[0].gain }
}

const originalContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')
const instances: CinemaAudio[] = []
const makeAudio = () => { const audio = new CinemaAudio(); instances.push(audio); return audio }
const weapon: CinemaCue = { id: 'volley', time: 12, tick: 1, duration: 0.4, kind: 'weapon', damageType: 'energy', intensity: 0.7 }
const started = () => {
  const audio = makeAudio()
  audio.setMuted(false)
  audio.setPlaying(true)
  return { audio, context: FakeContext.instances[0] }
}

beforeEach(() => {
  FakeContext.instances = []
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, writable: true, value: FakeContext })
})
afterEach(() => {
  for (const audio of instances.splice(0)) audio.dispose()
  if (originalContext) Object.defineProperty(globalThis, 'AudioContext', originalContext)
  else Reflect.deleteProperty(globalThis, 'AudioContext')
})

describe('cinema audio lifecycle', () => {
  it('creates no audio resources before Play, including configuration, preview intensity, and seeks', () => {
    const audio = makeAudio()
    audio.setVolume(0.7)
    audio.setMuted(false)
    audio.intensity(1, 12)
    audio.cue(weapon)
    audio.clear()
    audio.setPlaying(false)
    expect(FakeContext.instances).toHaveLength(0)
  })

  it('resumes synchronously on muted Play and can unlock sound from a later unmute gesture', () => {
    const audio = makeAudio()
    audio.setPlaying(true)
    const context = FakeContext.instances[0]
    expect(context.resumes).toBe(1)
    expect(context.master.value).toBe(0)
    audio.cue(weapon)
    expect(context.transients).toHaveLength(0)
    audio.setMuted(false)
    expect(context.resumes).toBe(2)
    expect(context.master.value).toBeCloseTo(0.65 * 0.6)
    expect(FakeContext.instances).toHaveLength(1)
  })

  it('clears every transient immediately on seek and disconnects completed effect graphs', () => {
    const { audio, context } = started()
    audio.cue(weapon)
    audio.cue({ ...weapon, id: 'death', kind: 'death' })
    expect(context.transients).toHaveLength(4)
    expect(context.transients.every(source => !source.ended)).toBe(true)
    audio.clear()
    expect(context.transients.every(source => source.stops.at(-1) === undefined && source.ended && source.disconnected)).toBe(true)
    expect(context.panners.every(node => node.disconnected)).toBe(true)
    expect(context.gains.slice(2).every(node => node.disconnected)).toBe(true)
    expect(context.filters.slice(1).every(node => node.disconnected)).toBe(true)
    expect(context.oscillators.slice(0, 5).every(source => !source.ended)).toBe(true)
  })

  it('pauses by stopping current effects and ramping the master to silence without spawning new voices', () => {
    const { audio, context } = started()
    audio.cue(weapon)
    audio.setPlaying(false)
    expect(context.transients.every(source => source.ended)).toBe(true)
    expect(context.master.calls.at(-1)).toEqual({ method: 'target', value: 0, time: 10, constant: 0.08 })
    const count = context.transients.length
    audio.cue(weapon)
    expect(context.transients).toHaveLength(count)
  })

  it('disconnects and stops the continuous bed and closes its context on disposal', () => {
    const { audio, context } = started()
    audio.cue(weapon)
    audio.dispose()
    expect(context.closes).toBe(1)
    expect([...context.oscillators, ...context.buffers].every(source => source.ended && source.disconnected)).toBe(true)
    expect(context.gains[0].disconnected).toBe(true)
    expect(context.gains[1].disconnected).toBe(true)
    audio.dispose()
    expect(context.closes).toBe(1)
  })

  it('bounds active transient sources to 24 and admits new effects after existing voices end', () => {
    const { audio, context } = started()
    for (let i = 0; i < 100; i++) audio.cue({ ...weapon, id: String(i) })
    expect(context.transients.length).toBeLessThanOrEqual(24)
    expect(context.transients.length).toBeGreaterThan(0)
    for (const source of context.transients) source.end()
    const prior = context.transients.length
    audio.cue(weapon)
    expect(context.transients).toHaveLength(prior + 2)
  })

  it('lets a recorded loss interrupt a saturated volley instead of dropping its sound', () => {
    const { audio, context } = started()
    for (let i = 0; i < 30; i++) audio.cue({ ...weapon, id: String(i) })
    const prior = context.transients.length
    audio.cue({ ...weapon, kind: 'death', id: 'decisive-loss' })
    expect(context.transients).toHaveLength(prior + 2)
  })

  it('reuses a single context and continuous bed across pause, seek, and repeated replay', () => {
    const { audio, context } = started()
    const continuous = [...context.oscillators]
    for (let i = 0; i < 4; i++) {
      audio.cue(weapon)
      audio.clear()
      audio.setPlaying(false)
      audio.setPlaying(true)
      audio.intensity(0.8, 0)
    }
    expect(FakeContext.instances).toHaveLength(1)
    expect(context.oscillators.filter(source => !source.ended)).toEqual(continuous)
    expect(continuous.every(source => source.starts.length === 1)).toBe(true)
  })

  it('schedules positive, bounded envelopes and panning and clamps user volume', () => {
    const { audio, context } = started()
    audio.setVolume(2)
    expect(context.master.value).toBe(0.6)
    audio.setVolume(-3)
    expect(context.master.value).toBe(0)
    audio.setVolume(0.5)
    expect(context.master.value).toBe(0.3)
    audio.cue(weapon, 500)
    expect(context.panners[0].pan.value).toBe(0.8)
    const envelope = context.gains[2].gain.calls
    expect(envelope[0]).toMatchObject({ method: 'value', value: 0.0001, time: 10 })
    expect(envelope[1].time).toBeGreaterThan(envelope[0].time)
    expect(envelope[2].time).toBeGreaterThan(envelope[1].time)
    expect(envelope[2].value).toBe(0.0001)
    expect(context.transients.every(source => source.starts[0] === 10 && source.stops[0]! > envelope[2].time)).toBe(true)
    audio.cue(weapon, -500)
    expect(context.panners[1].pan.value).toBe(-0.8)
    for (const time of [0, 22, 44, 66, 88]) audio.intensity(0.7, time)
    expect(context.oscillators.slice(0, 5).every(source => source.frequency.calls.length === 5)).toBe(true)
  })

  it('keeps silent playback usable if AudioContext is unavailable', () => {
    Reflect.deleteProperty(globalThis, 'AudioContext')
    const audio = makeAudio()
    expect(() => { audio.setMuted(false); audio.setPlaying(true); audio.cue(weapon); audio.clear(); audio.setPlaying(false); audio.dispose() }).not.toThrow()
    expect(FakeContext.instances).toHaveLength(0)
  })
})
