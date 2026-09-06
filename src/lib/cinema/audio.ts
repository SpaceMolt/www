import type { CinemaCue } from './types'

/** Original, locally synthesized soundtrack. No samples or external audio requests. */
export class CinemaAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private bed: GainNode | null = null
  private noise: AudioBuffer | null = null
  private voices = new Set<AudioScheduledSourceNode>()
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
    this.volume = Math.max(0, Math.min(1, volume))
    this.updateGain()
  }

  private updateGain() {
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.playing && !this.muted ? this.volume * 0.6 : 0, this.context.currentTime, 0.08)
  }

  intensity(value: number, time: number) {
    if (!this.context || !this.bed) return
    const chord = Math.floor(time / 22) % 4
    if (chord !== this.chord) {
      this.chord = chord
      const harmony = [[36.71,55,73.42,87.31,110],[32.7,49,65.4,82.41,98],[43.65,65.4,87.31,110,130.81],[36.71,55,73.42,98,110]][chord]
      this.continuous.forEach((osc,index)=>osc.frequency.setTargetAtTime(harmony[index],this.context!.currentTime,2.5))
    }
    this.bed.gain.setTargetAtTime(0.026 + value * 0.027 + Math.sin(time * 0.32) * 0.008, this.context.currentTime, 0.5)
  }

  cue(cue: CinemaCue, pan = 0) {
    const ctx = this.context
    if (!ctx || !this.master || !this.noise || !this.playing || this.muted) return
    const now = ctx.currentTime
    const explosion = cue.kind === 'death'
    const impact = cue.kind === 'knockout' || cue.kind === 'capture'
    const weapon = cue.kind === 'weapon'
    if (this.voices.size >= 24) {
      if (!explosion && !impact) return
      // A decisive loss takes the oldest voice pair's place in a dense volley.
      for (const source of [...this.voices].slice(0, 2)) {
        try { source.stop() } catch { /* Already ended. */ }
        this.voices.delete(source)
      }
    }
    if (!weapon && !explosion && !impact && cue.kind !== 'arrival' && cue.kind !== 'escape') return
    const duration = explosion ? 2.8 : impact ? 1.8 : weapon ? 0.65 : 1.4
    const gain = ctx.createGain()
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-0.8, Math.min(0.8, pan))
    gain.connect(panner).connect(this.master)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(explosion ? 0.75 : impact ? 0.3 : 0.13, now + 0.014)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    let remaining = 2
    const track = (source: AudioScheduledSourceNode) => {
      this.voices.add(source)
      source.onended = () => { this.voices.delete(source); source.disconnect(); if (--remaining === 0) { gain.disconnect(); panner.disconnect(); filter.disconnect() } }
      source.start(now)
      source.stop(now + duration + 0.05)
    }
    const noise = ctx.createBufferSource()
    noise.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(explosion ? 2400 : cue.damageType === 'kinetic' ? 6500 : 1100, now)
    filter.frequency.exponentialRampToValueAtTime(80, now + duration)
    noise.connect(filter).connect(gain)
    track(noise)
    const oscillator = ctx.createOscillator()
    oscillator.type = weapon && cue.damageType === 'energy' ? 'sawtooth' : 'sine'
    oscillator.frequency.setValueAtTime(explosion ? 90 : impact ? 420 : cue.damageType === 'kinetic' ? 170 : 900, now)
    oscillator.frequency.exponentialRampToValueAtTime(explosion ? 22 : 45, now + duration)
    oscillator.connect(gain)
    track(oscillator)
  }

  clear() { for (const source of this.voices) { try { source.stop() } catch { /* Already ended. */ } }; this.voices.clear() }
  dispose() {
    this.clear()
    for (const osc of this.continuous) { osc.stop(); osc.disconnect() }
    this.continuous = []
    this.master?.disconnect()
    this.bed?.disconnect()
    void this.context?.close().catch(() => {})
    this.context = null
  }
}
