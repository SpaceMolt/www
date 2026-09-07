import type { CinemaAudioCue } from './audioSchedule'
import { resolveWeaponFamily, type CinemaWeaponFamily } from './weapons'

interface SoundProfile {
  duration: number
  attack: number
  peak: number
  wave: OscillatorType
  frequency: [number, number]
  filter: BiquadFilterType
  cutoff: [number, number]
  noise: number
  tone: number
  pulses?: number
  hold?: number
}

/** Two scheduled sources per event, with distinct measured envelopes and spectra. */
export const WEAPON_AUDIO_PROFILES: Readonly<Record<CinemaWeaponFamily, Readonly<SoundProfile>>> = {
  laser: { duration: .26, attack: .005, peak: .10, wave: 'sawtooth', frequency: [1450, 480], filter: 'bandpass', cutoff: [4800, 950], noise: .16, tone: .75 },
  beam: { duration: 1.05, attack: .055, peak: .10, wave: 'triangle', frequency: [220, 150], filter: 'lowpass', cutoff: [900, 380], noise: .13, tone: .62, hold: .60 },
  railgun: { duration: .72, attack: .003, peak: .18, wave: 'sine', frequency: [180, 35], filter: 'lowpass', cutoff: [6500, 90], noise: .95, tone: .60 },
  autocannon: { duration: .48, attack: .003, peak: .12, wave: 'square', frequency: [160, 55], filter: 'lowpass', cutoff: [4500, 1100], noise: .65, tone: .27, pulses: 4 },
  flak: { duration: .50, attack: .006, peak: .16, wave: 'triangle', frequency: [95, 32], filter: 'lowpass', cutoff: [3400, 220], noise: 1, tone: .30, pulses: 2 },
  plasma: { duration: .86, attack: .034, peak: .13, wave: 'sawtooth', frequency: [520, 64], filter: 'bandpass', cutoff: [1200, 210], noise: .42, tone: .50 },
  missile: { duration: 1.20, attack: .045, peak: .11, wave: 'triangle', frequency: [130, 310], filter: 'bandpass', cutoff: [480, 1700], noise: .80, tone: .25, hold: .38 },
  torpedo: { duration: 1.60, attack: .085, peak: .15, wave: 'sine', frequency: [90, 145], filter: 'lowpass', cutoff: [520, 190], noise: .85, tone: .42, hold: .40 },
  disruptor: { duration: .65, attack: .008, peak: .10, wave: 'square', frequency: [2100, 130], filter: 'bandpass', cutoff: [2800, 320], noise: .26, tone: .50, pulses: 2 },
  exotic: { duration: 1.05, attack: .090, peak: .12, wave: 'sine', frequency: [74, 260], filter: 'bandpass', cutoff: [350, 950], noise: .17, tone: .60, hold: .20 },
  mine: { duration: .80, attack: .025, peak: .12, wave: 'triangle', frequency: [120, 38], filter: 'lowpass', cutoff: [2400, 100], noise: .60, tone: .38 },
  kinetic: { duration: .37, attack: .004, peak: .12, wave: 'triangle', frequency: [120, 42], filter: 'lowpass', cutoff: [4300, 140], noise: .75, tone: .40 },
  smartbomb: { duration: 1.40, attack: .015, peak: .19, wave: 'sine', frequency: [190, 28], filter: 'lowpass', cutoff: [3200, 130], noise: 1, tone: .60 },
}

const eventSounds: Readonly<Record<string, Readonly<SoundProfile>>> = {
  // A reactive hull/contact discharge has no launch motor or firing burst.
  contact: { duration: .22, attack: .003, peak: .085, wave: 'square', frequency: [920, 95], filter: 'bandpass', cutoff: [2600, 420], noise: .70, tone: .22 },
  death: { duration: 2.8, attack: .014, peak: .75, wave: 'sine', frequency: [90, 22], filter: 'lowpass', cutoff: [2400, 80], noise: 1, tone: .70 },
  knockout: { duration: 1.8, attack: .014, peak: .26, wave: 'triangle', frequency: [420, 45], filter: 'bandpass', cutoff: [1500, 160], noise: .60, tone: .55 },
  boarding: { duration: .65, attack: .025, peak: .09, wave: 'triangle', frequency: [130, 75], filter: 'bandpass', cutoff: [950, 260], noise: .3, tone: .45 },
  capture: { duration: 1.4, attack: .040, peak: .16, wave: 'sine', frequency: [260, 140], filter: 'bandpass', cutoff: [1000, 220], noise: .15, tone: .60 },
  arrival: { duration: 1.4, attack: .09, peak: .15, wave: 'sine', frequency: [65, 340], filter: 'bandpass', cutoff: [160, 2200], noise: .62, tone: .40 },
  escape: { duration: 1.4, attack: .02, peak: .15, wave: 'sine', frequency: [340, 48], filter: 'lowpass', cutoff: [2400, 90], noise: .68, tone: .35 },
  repair: { duration: 1.1, attack: .10, peak: .065, wave: 'sine', frequency: [330, 660], filter: 'bandpass', cutoff: [480, 1300], noise: .06, tone: .65, hold: .45 },
  disable: { duration: .85, attack: .007, peak: .12, wave: 'square', frequency: [1700, 48], filter: 'bandpass', cutoff: [3100, 100], noise: .45, tone: .45, pulses: 3 },
  cloak: { duration: 1.3, attack: .04, peak: .075, wave: 'sine', frequency: [680, 42], filter: 'lowpass', cutoff: [1900, 80], noise: .26, tone: .45 },
  drain: { duration: 1.1, attack: .05, peak: .085, wave: 'triangle', frequency: [100, 540], filter: 'bandpass', cutoff: [260, 1800], noise: .10, tone: .55, hold: .45 },
}

const hitSounds: Readonly<Record<string, Readonly<SoundProfile>>> = {
  shield: { duration: .44, attack: .006, peak: .12, wave: 'sine', frequency: [760, 230], filter: 'bandpass', cutoff: [2100, 420], noise: .28, tone: .60 },
  ballistic: { duration: .34, attack: .003, peak: .16, wave: 'triangle', frequency: [140, 39], filter: 'lowpass', cutoff: [5400, 240], noise: .85, tone: .30 },
  explosive: { duration: .76, attack: .009, peak: .22, wave: 'sine', frequency: [110, 31], filter: 'lowpass', cutoff: [2600, 110], noise: 1, tone: .55 },
  energy: { duration: .40, attack: .004, peak: .14, wave: 'triangle', frequency: [650, 120], filter: 'bandpass', cutoff: [3400, 530], noise: .55, tone: .40 },
  exotic: { duration: .62, attack: .015, peak: .15, wave: 'sine', frequency: [290, 56], filter: 'bandpass', cutoff: [1800, 150], noise: .35, tone: .65 },
}

function weaponSound(cue: CinemaAudioCue, family: CinemaWeaponFamily): Readonly<SoundProfile> {
  if (cue.audioPhase === 'charge') {
    const duration = bounded(cue.duration, .025, 3, .4)
    return { duration, attack: Math.min(.08, duration * .15), peak: .07, wave: 'sine', frequency: [100, 1100], filter: 'bandpass', cutoff: [180, 1600], noise: .16, tone: .65, hold: .78 }
  }
  if (cue.audioPhase === 'shield-impact') return hitSounds.shield
  if (cue.audioPhase === 'impact') {
    if (['missile', 'torpedo', 'plasma', 'mine', 'smartbomb', 'flak'].includes(family)) return hitSounds.explosive
    if (family === 'exotic') return hitSounds.exotic
    if (['laser', 'beam', 'disruptor'].includes(family)) return hitSounds.energy
    return hitSounds.ballistic
  }
  return WEAPON_AUDIO_PROFILES[family]
}
const bounded = (value: number, low: number, high: number, fallback = low) => Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback

/** Original, locally synthesized soundtrack. No samples or external audio requests. */
export class CinemaAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private bed: GainNode | null = null
  private noise: AudioBuffer | null = null
  private voices = new Set<AudioScheduledSourceNode>()
  private voicePriority = new Map<AudioScheduledSourceNode, number>()
  private continuous: OscillatorNode[] = []
  private muted = true
  private volume = 0.65
  private playing = false
  private chord = -1

  private initialize() {
    if (this.context || typeof AudioContext === 'undefined') return
    const ctx = this.context = new AudioContext()
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.ratio.value = 5
    compressor.connect(ctx.destination)
    const master = this.master = ctx.createGain()
    master.gain.value = 0
    master.connect(compressor)
    const bed = this.bed = ctx.createGain()
    bed.gain.value = 0.06
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 340
    bed.connect(filter).connect(master)
    for (const [index, frequency] of [36.71, 55, 73.42, 110.12, 146.83].entries()) {
      const osc = ctx.createOscillator()
      osc.type = index < 2 ? 'sine' : 'triangle'
      osc.frequency.value = frequency
      osc.detune.value = index % 2 ? -5 : 5
      osc.connect(bed)
      osc.start()
      this.continuous.push(osc)
    }
    const buffer = this.noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate)
    const values = buffer.getChannelData(0)
    let seed = 7187, previous = 0
    for (let i = 0; i < values.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      previous = (previous + ((seed / 4294967296) * 2 - 1) * 0.12) / 1.12
      values[i] = previous * 3
    }
  }

  setPlaying(playing: boolean) {
    this.playing = playing
    if (playing) {
      // Called directly by the Play gesture, before any await.
      try { this.initialize(); void this.context?.resume().catch(() => {}) } catch { /* Silent playback remains available. */ }
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
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.playing && !this.muted ? this.volume * 0.6 : 0, this.context.currentTime, 0.08)
  }

  intensity(value: number, time: number) {
    if (!this.context || !this.bed) return
    value = bounded(value, 0, 1)
    time = Number.isFinite(time) ? Math.max(0, time) : 0
    const chord = Math.floor(time / 22) % 4
    if (chord !== this.chord) {
      this.chord = chord
      const harmony = [[36.71,55,73.42,87.31,110],[32.7,49,65.4,82.41,98],[43.65,65.4,87.31,110,130.81],[36.71,55,73.42,98,110]][chord]
      this.continuous.forEach((osc,index)=>osc.frequency.setTargetAtTime(harmony[index],this.context!.currentTime,2.5))
    }
    this.bed.gain.setTargetAtTime(0.026 + value * 0.027 + Math.sin(time * 0.32) * 0.008, this.context.currentTime, 0.5)
  }

  cue(cue: CinemaAudioCue, pan = 0) {
    const ctx = this.context
    if (!ctx || !this.master || !this.noise || !this.playing || this.muted) return
    const weapon = cue.kind === 'weapon'
    const contact = weapon && (cue.audioPhase === 'contact' || cue.secondaryKind === 'retaliation' || /galvanic hull grid/i.test(cue.weaponName ?? ''))
    const profile = contact ? eventSounds.contact : weapon ? weaponSound(cue, cue.weaponFamily ?? resolveWeaponFamily(cue.weaponName, cue.damageType)) : eventSounds[cue.kind]
    if (!profile) return
    const now = ctx.currentTime
    const explosion = cue.kind === 'death'
    const impact = cue.kind === 'knockout' || cue.kind === 'capture'
    const priority = explosion || impact ? 2 : cue.audioPhase === 'impact' || cue.audioPhase === 'shield-impact' || contact ? 1 : 0
    if (this.voices.size >= 24) {
      // Hits may replace launches; only decisive events may replace a loss.
      const replaced = [...this.voices].filter(source => priority === 2 || (this.voicePriority.get(source) ?? 0) < priority).slice(0, 2)
      if (replaced.length < 2) return
      for (const source of replaced) {
        try { source.stop() } catch { /* Already ended. */ }
        this.voices.delete(source)
        this.voicePriority.delete(source)
      }
    }
    const duration = profile.duration
    const peak = Math.min(weapon ? .23 : .75, profile.peak * (weapon && cue.critical ? 1.15 : 1))
    const gain = ctx.createGain()
    const panner = ctx.createStereoPanner()
    panner.pan.value = bounded(pan, -.8, .8, 0)
    gain.connect(panner).connect(this.master)
    const pulses = profile.pulses ?? 1
    for (let pulse = 0; pulse < pulses; pulse++) {
      const start = now + pulse * duration / pulses
      const end = pulse === pulses - 1 ? now + duration : start + duration / pulses * .8
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(peak, start + profile.attack)
      if (profile.hold && pulses === 1) gain.gain.exponentialRampToValueAtTime(peak * .72, now + duration * profile.hold)
      gain.gain.exponentialRampToValueAtTime(0.0001, end)
    }
    const noiseGain = ctx.createGain()
    const toneGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(profile.noise, now)
    toneGain.gain.setValueAtTime(profile.tone, now)
    noiseGain.connect(gain); toneGain.connect(gain)
    let remaining = 2
    const track = (source: AudioScheduledSourceNode) => {
      this.voices.add(source)
      this.voicePriority.set(source, priority)
      source.onended = () => { this.voices.delete(source); this.voicePriority.delete(source); source.disconnect(); if (--remaining === 0) { gain.disconnect(); panner.disconnect(); filter.disconnect(); noiseGain.disconnect(); toneGain.disconnect() } }
      source.start(now)
      source.stop(now + duration + 0.05)
    }
    const noise = ctx.createBufferSource()
    noise.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = profile.filter
    filter.frequency.setValueAtTime(profile.cutoff[0], now)
    filter.frequency.exponentialRampToValueAtTime(profile.cutoff[1], now + duration)
    noise.connect(filter).connect(noiseGain)
    track(noise)
    const oscillator = ctx.createOscillator()
    oscillator.type = profile.wave
    oscillator.frequency.setValueAtTime(profile.frequency[0], now)
    oscillator.frequency.exponentialRampToValueAtTime(profile.frequency[1], now + duration)
    oscillator.connect(toneGain)
    track(oscillator)
  }

  clear() { for (const source of this.voices) { try { source.stop() } catch { /* Already ended. */ } }; this.voices.clear(); this.voicePriority.clear() }
  dispose() {
    this.clear()
    for (const osc of this.continuous) { osc.stop(); osc.disconnect() }
    this.continuous = []
    this.master?.disconnect()
    this.bed?.disconnect()
    void this.context?.close().catch(() => {})
    this.context = null
    this.chord = -1
  }
}
