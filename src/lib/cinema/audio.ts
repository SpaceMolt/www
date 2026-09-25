import { audioCueRange, buildAudioSchedule, type CinemaAudioCue } from './audioSchedule'
import type { ShipAppearance } from './appearance'
import type { CinemaFilm } from './types'
import { composeScore, type ScoreNote } from './score'
import { impulseResponse, renderCue, renderNote, seeded, type Sound } from './synth'

/** Score events are queued this far ahead of the film clock on the audio clock. */
const LOOKAHEAD = .35
/** Events are requested from the render worker this far ahead. */
const PREPARE = 3
const MAX_VOICES = 48
const STINGS = new Set<ScoreNote['instrument']>(['hit', 'swell', 'riser', 'fanfare'])
const bounded = (value: number, low: number, high: number, fallback = low) => Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback

/**
 * Original, locally synthesized soundtrack. The score is composed from the whole
 * film in advance; effects are rendered per cue. Buses (music, stings, effects,
 * ambience) share two synthetic reverbs and a limited master.
 */
export class CinemaAudio {
  private context: AudioContext | null = null
  private out: GainNode | null = null
  private sfx: GainNode | null = null
  private loss: GainNode | null = null
  private duck: GainNode | null = null
  private drop: GainNode | null = null
  private sting: GainNode | null = null
  private amb: GainNode | null = null
  private battle: GainNode | null = null
  private shortIn: GainNode | null = null
  private longIn: GainNode | null = null
  private voices = new Map<AudioScheduledSourceNode, number>()
  private notes = new Set<AudioScheduledSourceNode>()
  private continuous: AudioScheduledSourceNode[] = []
  private score: ScoreNote[]
  private schedule: CinemaAudioCue[]
  private sizes: Record<string, number>
  private density: number[] = []
  private worker: Worker | null = null
  private ready = new Map<string, Sound | null>()
  private requested = new Set<string>()
  private done = new Set<number>()
  private next = 0
  private anchored = false
  private anchor = 0
  private duckEnd = 0
  private duckLevel = 1
  private muted = true
  private volume = 0.65
  private playing = false
  private ending = false
  private time = 0
  private offline: BaseAudioContext | null

  /** An offline context renders the whole film at scheduled times (development capture). */
  constructor(private film: CinemaFilm, appearances: Record<string, ShipAppearance> = {}, offline?: BaseAudioContext) {
    this.score = composeScore(film)
    this.schedule = buildAudioSchedule(film.cues, film.shots)
    // Hull scale 0 (fighter) to 1 (capital or station) from the rendered length.
    this.sizes = Object.fromEntries(film.ships.map(ship => [ship.id, ship.kind === 'station' ? 1 : bounded(Math.log2((appearances[ship.shipClass]?.length ?? 2) / 1.8) / 4.5, 0, 1)]))
    // Massed-battle bed: weapon activity over two seconds plus the ships still fighting.
    for (let t = 0; t <= film.duration + .25; t += .25) this.density.push(film.cues.filter(cue => cue.kind === 'weapon' && Math.abs(cue.time - t) < 1).length / 2
      + .15 * film.ships.filter(ship => ship.start <= t && t < ship.end).length)
    this.offline = offline ?? null
    if (!offline) return
    this.muted = false; this.playing = true
    this.initialize()
    this.updateGain()
    for (const note of this.score) if (note.instrument === 'drop') this.dip(note, note.time)
    else this.playNote(note, renderNote(note, offline.sampleRate), note.time)
    this.density.forEach((_, i) => this.bed(i * .25, i * .25))
    this.amb?.gain.setTargetAtTime(0, Math.max(0, film.duration - 2.5), .7)
  }

  private initialize() {
    if (this.context || (!this.offline && typeof AudioContext === 'undefined')) return
    const ctx = this.context = (this.offline ?? new AudioContext()) as AudioContext
    // Synthesis runs in a worker ahead of the playhead; without one it runs inline.
    if (!this.offline && typeof Worker !== 'undefined') try {
      const worker = this.worker = new Worker(new URL('./synth.worker.ts', import.meta.url))
      worker.onmessage = (event: MessageEvent<{ key: string; sound?: Sound }>) => { if (this.requested.has(event.data.key)) this.ready.set(event.data.key, event.data.sound ?? null) }
      worker.onerror = () => { this.worker = null }
      worker.postMessage({ film: this.film, sizes: this.sizes, rate: ctx.sampleRate })
    } catch { this.worker = null }
    const gain = (value: number, to?: AudioNode) => { const node = ctx.createGain(); node.gain.value = value; if (to) node.connect(to); return node }
    const out = this.out = gain(0, ctx.destination)
    // Soft clip at -1.9 dBFS (true peak under -1 dBTP) after the limiter catches what its attack lets through.
    const clip = ctx.createWaveShaper()
    const curve = new Float32Array(2048)
    for (let i = 0; i < curve.length; i++) { const x = i / 1023.5 - 1, a = Math.abs(x); curve[i] = Math.sign(x) * (a < .6 ? a : .6 + .2 * Math.tanh((a - .6) / .2)) }
    clip.curve = curve
    // Band-limit around the clipper so its corners do not overshoot between samples.
    const smooth = ctx.createBiquadFilter()
    smooth.type = 'lowpass'; smooth.frequency.value = 15000
    clip.connect(smooth).connect(out)
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -4.5; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = .001; limiter.release.value = .12
    limiter.connect(clip)
    const glue = ctx.createDynamicsCompressor()
    glue.threshold.value = -16; glue.knee.value = 8; glue.ratio.value = 2.5; glue.attack.value = .01; glue.release.value = .3
    glue.connect(limiter)
    const highpass = ctx.createBiquadFilter(), band = ctx.createBiquadFilter()
    highpass.type = 'highpass'; highpass.frequency.value = 30
    band.type = 'lowpass'; band.frequency.value = 15000
    highpass.connect(band).connect(glue)
    const master = gain(.45, highpass)
    const verb = (seconds: number, seed: number) => {
      const convolver = ctx.createConvolver(), [l, r] = impulseResponse(ctx.sampleRate, seconds, seed)
      const ir = ctx.createBuffer(2, l.length, ctx.sampleRate)
      ir.getChannelData(0).set(l); ir.getChannelData(1).set(r)
      convolver.normalize = false
      convolver.buffer = ir
      const ret = ctx.createBiquadFilter()
      ret.type = 'highpass'; ret.frequency.value = 180
      convolver.connect(ret).connect(master)
      return gain(1, convolver)
    }
    this.shortIn = verb(.6, 11)
    this.longIn = verb(4, 23)
    this.sfx = gain(1, master)
    this.loss = gain(1, master)
    const music = gain(.4, master)
    music.connect(gain(.22, this.longIn))
    this.drop = gain(1, music)
    this.duck = gain(1, this.drop)
    this.sting = gain(.5, master)
    this.sting.connect(gain(.3, this.longIn))
    const amb = this.amb = gain(1, master)
    // Ambience: slow, wide, decorrelated air; a density-driven battle rumble; a station hum.
    const r = seeded(this.film.seed ^ 0xa1b)
    const loop = (seconds: number, fill: (ch: Float32Array, c: number) => void, to: AudioNode) => {
      const buffer = ctx.createBuffer(2, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate)
      for (const c of [0, 1]) fill(buffer.getChannelData(c), c)
      const source = ctx.createBufferSource()
      source.buffer = buffer; source.loop = true
      source.connect(to); source.start()
      this.continuous.push(source)
    }
    const lowNoise = (a: number, level: number) => (ch: Float32Array) => { let y = 0, z = 0; for (let i = 0; i < ch.length; i++) { y += a * (r() * 2 - 1 - y); z += a * (y - z); ch[i] = z * level } }
    const air = gain(.7, amb)
    const lfo = ctx.createOscillator(), depth = gain(.3)
    lfo.frequency.value = .05; lfo.connect(depth).connect(air.gain); lfo.start()
    this.continuous.push(lfo)
    loop(7, lowNoise(.08, .05), air)
    this.battle = gain(0, amb)
    loop(5, lowNoise(.03, .28), this.battle)
    if (this.film.ships.some(ship => ship.kind === 'station')) loop(1, ch => { for (let i = 0; i < ch.length; i++) { const t = i / ctx.sampleRate; ch[i] = .006 * (Math.sin(2 * Math.PI * 100 * t) + .6 * Math.sin(2 * Math.PI * 150 * t) + .3 * Math.sin(2 * Math.PI * 201 * t)) } }, amb)
  }

  private bed(time: number, at: number) {
    const d = this.density[Math.max(0, Math.min(this.density.length - 1, Math.round(time / .25)))] ?? 0
    this.battle?.gain.setTargetAtTime(Math.min(1, Math.log2(1 + d) / 4), at, .6)
  }

  setPlaying(playing: boolean) {
    // The film clock reaching its end lets the final chord and reverb ring out.
    if (!playing && this.playing && this.time >= this.film.duration - .05 && this.context) {
      this.playing = false; this.ending = true
      this.amb?.gain.setTargetAtTime(0, this.context.currentTime, 1)
      return
    }
    this.playing = playing
    if (playing) {
      // Called directly by the Play gesture, before any await.
      try { this.initialize(); void this.context?.resume().catch(() => {}) } catch { /* Silent playback remains available. */ }
      if (this.context) this.amb?.gain.setTargetAtTime(1, this.context.currentTime, .3)
    } else this.clear()
    this.updateGain()
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (!muted && this.playing) this.setPlaying(true)
    this.updateGain()
  }

  setVolume(volume: number) {
    this.volume = bounded(volume, 0, 1)
    this.updateGain()
  }

  private updateGain() {
    if (this.out && this.context) this.out.gain.setTargetAtTime((this.playing || this.ending) && !this.muted ? (this.offline ? 1 : this.volume) : 0, this.context.currentTime, 0.08)
  }

  private play(sound: Sound, at: number, bus: AudioNode, pan = 0, offset = 0, level = 1) {
    const ctx = this.context!
    const buffer = ctx.createBuffer(2, sound.l.length, sound.rate)
    buffer.getChannelData(0).set(sound.l); buffer.getChannelData(1).set(sound.r)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const panner = ctx.createStereoPanner()
    panner.pan.value = pan
    const trim = ctx.createGain()
    trim.gain.value = level
    source.connect(trim).connect(panner).connect(bus)
    const sends = ([[sound.short, this.shortIn], [sound.long, this.longIn]] as const).filter(([level]) => level > 0).map(([level, input]) => {
      const send = ctx.createGain()
      send.gain.value = level
      panner.connect(send).connect(input!)
      return send
    })
    source.onended = () => { this.voices.delete(source); this.notes.delete(source); source.disconnect(); trim.disconnect(); panner.disconnect(); for (const send of sends) send.disconnect() }
    source.start(at, offset)
    return source
  }

  private playNote(note: ScoreNote, sound: Sound, at: number, offset = 0) {
    this.notes.add(this.play(sound, at, STINGS.has(note.instrument) ? this.sting! : this.duck!, 0, offset))
  }

  /** Clears the music, then pulls the effects back, so the decisive hit lands on near silence. */
  private dip(note: ScoreNote, at: number) {
    const end = at + note.duration, music = this.drop?.gain, sfx = this.sfx?.gain
    music?.setTargetAtTime(.03, at, .06)
    music?.setTargetAtTime(1, end, .004)
    sfx?.setTargetAtTime(.15, Math.max(at, end - 1), .12)
    sfx?.setTargetAtTime(1, end, .004)
  }

  /** A worker-rendered sound once it has arrived, or an inline render without a worker. */
  private take(key: string, render: () => Sound | undefined) {
    if (!this.worker) return render()
    const sound = this.ready.get(key)
    this.ready.delete(key)
    return sound ?? undefined
  }

  /** Follows the film clock: prepares upcoming events and queues score events on the audio clock. */
  update(time: number) {
    this.time = Number.isFinite(time) ? time : 0
    const ctx = this.context
    if (!ctx || this.offline) return
    if (!this.playing || this.muted) { this.anchored = false; return }
    const now = ctx.currentTime
    if (!this.anchored || Math.abs(now - this.time - this.anchor) > .1) this.anchor = now - this.time
    this.anchored = true
    if (this.worker) {
      const keys: string[] = []
      for (let i = this.next; i < this.score.length && this.score[i].time < this.time + PREPARE; i++) if (!this.done.has(i) && this.score[i].instrument !== 'drop') keys.push(`n${i}`)
      for (const cue of audioCueRange(this.schedule, this.time, this.time + PREPARE)) keys.push(`c${cue.id}`)
      const fresh = keys.filter(key => !this.requested.has(key))
      for (const key of fresh) this.requested.add(key)
      if (fresh.length) this.worker.postMessage({ keys: fresh })
    }
    for (let i = this.next; i < this.score.length && this.score[i].time < this.time + LOOKAHEAD; i++) {
      if (this.done.has(i)) continue
      const note = this.score[i], at = this.anchor + note.time, key = `n${i}`
      // A sustained note already sounding at a seek resumes mid-note; a late short one is dropped.
      if (note.time + note.duration <= this.time || (now - at > .05 && note.duration < 1)) { this.done.add(i); this.ready.delete(key); continue }
      if (note.instrument === 'drop') { this.done.add(i); this.dip(note, Math.max(now, at)); continue }
      if (this.worker && !this.ready.has(key)) continue
      this.done.add(i)
      const sound = this.take(key, () => renderNote(note, ctx.sampleRate))
      if (sound) this.playNote(note, sound, Math.max(now, at), Math.max(0, now - at))
    }
    while (this.done.has(this.next)) this.next++
    this.bed(this.time, now)
    // Ambience fades out with the score before the picture ends.
    this.amb?.gain.setTargetAtTime(this.time > this.film.duration - 2.5 ? 0 : 1, now, .7)
  }

  private duckMusic(at: number, [level, hold, release]: [number, number, number]) {
    const gain = this.duck?.gain
    if (!gain) return
    if (at < this.duckEnd) { level = Math.min(level, this.duckLevel); hold = Math.max(hold, this.duckEnd - at) }
    gain.cancelScheduledValues(at)
    gain.setTargetAtTime(level, at, .004)
    gain.setTargetAtTime(1, at + hold, release / 4)
    this.duckEnd = at + hold; this.duckLevel = level
  }

  cue(cue: CinemaAudioCue, pan = 0, at?: number) {
    const ctx = this.context
    if (!ctx || !this.sfx || !this.playing || this.muted) return
    const now = ctx.currentTime
    const when = at ?? Math.max(now, this.anchored ? this.anchor + cue.time : now)
    const sound = this.take(`c${cue.id}`, () => renderCue(cue, ctx.sampleRate, this.sizes[cue.to ?? ''] ?? 0, this.film.seed))
    if (!sound) return
    const priority = cue.audioCascade ? 0 : cue.kind === 'death' || cue.kind === 'knockout' || cue.kind === 'capture' ? 3
      : cue.audioPhase === 'impact' || cue.audioPhase === 'shield-impact' || cue.audioPhase === 'contact' ? 2 : cue.audioDistant ? 0 : 1
    if (!this.offline && this.voices.size >= MAX_VOICES) {
      // Hits may replace launches; only decisive events may replace a loss.
      const replaced = [...this.voices].find(([, p]) => p < priority || priority === 3)
      if (!replaced) return
      try { replaced[0].stop() } catch { /* Already ended. */ }
      this.voices.delete(replaced[0])
    }
    const start = Math.max(this.offline ? 0 : now, when - sound.lead)
    if (sound.duck) this.duckMusic(start + sound.lead, sound.duck)
    // Losses play on their own bus and the rest of the effects step back under
    // them; the story's decisive loss is the biggest sound in the film.
    const loss = priority === 3, climax = cue.id === this.film.story?.climaxCueId
    if (loss) { this.sfx.gain.setTargetAtTime(cue.audioDistant ? .6 : .4, start + sound.lead, .01); this.sfx.gain.setTargetAtTime(1, start + sound.lead + 1.2, .3) }
    this.voices.set(this.play(sound, start, loss ? this.loss! : this.sfx, bounded(pan, -.85, .85, 0) * (cue.kind === 'death' ? .6 : 1), Math.max(0, start - (when - sound.lead)), climax ? 10 ** (6 / 20) : loss ? 10 ** (-3.5 / 20) : 1), priority)
  }

  clear() {
    for (const source of [...this.voices.keys(), ...this.notes]) { try { source.stop() } catch { /* Already ended. */ } }
    this.voices.clear(); this.notes.clear()
    this.ready.clear(); this.requested.clear(); this.done.clear(); this.next = 0
    this.worker?.postMessage({ reset: true })
    this.anchored = false; this.duckEnd = 0; this.duckLevel = 1; this.ending = false
    for (const bus of [this.duck, this.drop, this.sfx]) if (bus && this.context) { bus.gain.cancelScheduledValues(0); bus.gain.setTargetAtTime(1, this.context.currentTime, .01) }
    this.updateGain()
  }

  dispose() {
    this.clear()
    for (const source of this.continuous) { source.stop(); source.disconnect() }
    this.continuous = []
    this.worker?.terminate()
    this.worker = null
    this.out?.disconnect()
    this.amb?.disconnect()
    void this.context?.close().catch(() => {})
    this.context = null
  }
}
