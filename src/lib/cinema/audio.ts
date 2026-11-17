import type { CinemaAudioCue } from './audioSchedule'
import { resolveWeaponFamily, type CinemaWeaponFamily } from './weapons'

// Sounds from SpaceMolt: Adventures. Effects ship in public/cinema/sfx; the combat
// music lives on the asset CDN (no CORS there, so it plays through an <audio> element).
const SFX_URL = '/cinema/sfx/'
const MUSIC_URL = 'https://assets.spacemolt.com/cinema/music/'
const MUSIC = ['combat', 'combat_2', 'combat_5']
const VARIANTS: Readonly<Record<string, number>> = {
  energy: 3, kinetic: 3, missile: 3, thermal: 2, em: 2, shield_hit: 2, hull_hit: 3, explosion: 4,
  explosion_big: 1, dock: 1, launch: 1, jump_exit: 1, jump_spool: 1, alert: 1, mining_loop: 1,
}

export const WEAPON_SOUNDS: Readonly<Record<CinemaWeaponFamily, string>> = {
  laser: 'energy', beam: 'energy', railgun: 'kinetic', autocannon: 'kinetic', flak: 'kinetic', kinetic: 'kinetic',
  plasma: 'thermal', missile: 'missile', torpedo: 'missile', mine: 'missile', smartbomb: 'missile',
  disruptor: 'em', exotic: 'em',
}
const EXPLOSIVE = ['missile', 'torpedo', 'plasma', 'mine', 'smartbomb', 'flak']
// [sound, gain, playback rate]
const EVENT_SOUNDS: Readonly<Record<string, readonly [string, number, number]>> = {
  contact: ['em', .35, 1.3], death: ['explosion_big', 1, 1], knockout: ['explosion', .8, .9],
  boarding: ['dock', .6, 1], capture: ['alert', .5, 1], arrival: ['jump_exit', .3, 1.2], escape: ['jump_exit', .8, 1],
  repair: ['mining_loop', .3, 1.2], disable: ['em', .5, .8], cloak: ['launch', .5, .7], drain: ['em', .4, .6],
}

/** Sources of every sound the cinema plays, shown by the player's Credits button. */
export const CINEMA_AUDIO_CREDITS: readonly { title: string; by: string; url: string; license: string }[] = [
  { title: 'Enemy Infiltration, Invasion, World of Automatons', by: 'Eric Matyas', url: 'https://soundimage.org', license: 'CC BY 4.0' },
  { title: 'Effects from the #GameAudioGDC 2026 Bundle: InMotionAudio, Epic Stock Media, The Noisery, David Dumais Audio, Federico Soler, Ivo Vicic, Alexander Kopeikin, 344 Audio, Cinematic Sound Design', by: 'Sonniss', url: 'https://sonniss.com/gameaudiogdc', license: 'Royalty-free' },
  { title: 'FX_Player_Lazer_Shot_5', by: 'JakeAMT', url: 'https://freesound.org/people/JakeAMT/sounds/681965/', license: 'CC0' },
  { title: 'Scifi_Gun_Blast', by: 'tradeachest', url: 'https://freesound.org/people/tradeachest/sounds/730564/', license: 'CC0' },
  { title: 'Laser shot', by: 'michael_grinnell', url: 'https://freesound.org/people/michael_grinnell/sounds/512469/', license: 'CC0' },
  { title: 'Mk 46 30mm gun, Howitzer Artillery Gun Shot, Tank Firing', by: 'qubodup', url: 'https://freesound.org/people/qubodup/', license: 'CC0' },
  { title: 'Rocket Launch', by: 'Jarusca', url: 'https://freesound.org/people/Jarusca/sounds/521377/', license: 'CC0' },
  { title: 'missile-launch', by: 'jorgerosa', url: 'https://freesound.org/people/jorgerosa/sounds/458669/', license: 'CC0' },
  { title: 'CAS Missile Launching', by: 'morganpurkis', url: 'https://freesound.org/people/morganpurkis/sounds/398213/', license: 'CC0' },
  { title: 'plasmapistol_shot', by: 'Tycoh', url: 'https://freesound.org/people/Tycoh/sounds/450768/', license: 'CC0' },
  { title: 'Projectile Shoot', by: 'unfa', url: 'https://freesound.org/people/unfa/sounds/193427/', license: 'CC0' },
]

/** [sound, gain, rate, seconds to cut at (0 = whole sample)] for one scheduled cue. */
export function cueSound(cue: CinemaAudioCue): readonly [string, number, number, number] | null {
  if (cue.kind !== 'weapon') {
    const event = EVENT_SOUNDS[cue.kind]
    return event ? [...event, cue.kind === 'repair' ? 1.1 : cue.kind === 'arrival' ? 1.2 : 0] : null
  }
  if (cue.audioPhase === 'contact' || cue.secondaryKind === 'retaliation' || /galvanic hull grid/i.test(cue.weaponName ?? '')) return [...EVENT_SOUNDS.contact, 0]
  const family = cue.weaponFamily ?? resolveWeaponFamily(cue.weaponName, cue.damageType)
  const boost = cue.critical ? 1.15 : 1
  if (cue.audioPhase === 'charge') return ['jump_spool', .35, 1.4, bounded(cue.duration, .1, 3, .4)]
  if (cue.audioPhase === 'shield-impact') return ['shield_hit', .45 * boost, 1, 0]
  if (cue.audioPhase === 'impact') return EXPLOSIVE.includes(family) ? ['explosion', .5 * boost, 1.2, 0] : ['hull_hit', .5 * boost, 1, 0]
  // The rocket samples end in a buzzing motor tail; keep only the launch.
  return [WEAPON_SOUNDS[family], .35 * boost, 1, WEAPON_SOUNDS[family] === 'missile' ? .6 : 0]
}
const bounded = (value: number, low: number, high: number, fallback = low) => Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback

export class CinemaAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private music: HTMLAudioElement | null = null
  private buffers = new Map<string, AudioBuffer[]>()
  private voices = new Map<AudioBufferSourceNode, number>()
  private muted = true
  private volume = 0.65
  private playing = false

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
    // A wide hall send: a 2.4 s decaying-noise impulse, no extra file to load.
    const reverb = ctx.createConvolver(), wet = ctx.createGain()
    const tail = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 2.4), ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const data = tail.getChannelData(c)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3
    }
    reverb.buffer = tail
    wet.gain.value = .35
    master.connect(reverb).connect(wet).connect(compressor)
    for (const [name, count] of Object.entries(VARIANTS)) {
      for (let i = 1; i <= count; i++) {
        const file = count > 1 ? `${name}_${i}` : name
        void fetch(`${SFX_URL}${file}.mp3`).then(r => r.arrayBuffer()).then(data => ctx.decodeAudioData(data))
          .then(buffer => { if (this.context === ctx) this.buffers.set(name, [...this.buffers.get(name) ?? [], buffer]) }, () => {})
      }
    }
    if (typeof Audio !== 'undefined') {
      // A random combat track per screening, as the game does.
      this.music = new Audio(`${MUSIC_URL}${MUSIC[Math.floor(Math.random() * MUSIC.length)]}.mp3`)
      this.music.loop = true
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
    const on = this.playing && !this.muted
    if (this.master && this.context) this.master.gain.setTargetAtTime(on ? this.volume : 0, this.context.currentTime, 0.08)
    if (!this.music) return
    this.music.volume = this.volume * .45
    if (on) void this.music.play().catch(() => {})
    else this.music.pause()
  }

  cue(cue: CinemaAudioCue, pan = 0) {
    const ctx = this.context
    if (!ctx || !this.master || !this.playing || this.muted) return
    const sound = cueSound(cue)
    const variants = sound && this.buffers.get(sound[0])
    if (!sound || !variants?.length) return
    const [, peak, rate, cut] = sound
    const priority = ['death', 'knockout', 'capture', 'escape'].includes(cue.kind) ? 2 : cue.audioPhase === 'impact' || cue.audioPhase === 'shield-impact' ? 1 : 0
    if (this.voices.size >= 24) {
      // Hits may replace launches; only decisive events may replace a loss.
      const replaced = [...this.voices].find(([, p]) => priority === 2 || p < priority)?.[0]
      if (!replaced) return
      try { replaced.stop() } catch { /* Already ended. */ }
      this.voices.delete(replaced)
    }
    const now = ctx.currentTime
    const source = ctx.createBufferSource()
    source.buffer = variants[Math.floor(Math.random() * variants.length)]
    source.playbackRate.value = rate * (0.95 + Math.random() * 0.1)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(peak, now)
    if (cut) gain.gain.setTargetAtTime(0.0001, now + cut * .7, cut * .1)
    const panner = ctx.createStereoPanner()
    panner.pan.value = bounded(pan, -.8, .8, 0)
    source.connect(gain).connect(panner).connect(this.master)
    this.voices.set(source, priority)
    source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); panner.disconnect() }
    source.start(now)
    if (cut) source.stop(now + cut + 0.05)
  }

  clear() { for (const source of this.voices.keys()) { try { source.stop() } catch { /* Already ended. */ } }; this.voices.clear() }
  dispose() {
    this.clear()
    this.music?.pause()
    this.music = null
    this.master?.disconnect()
    void this.context?.close().catch(() => {})
    this.context = null
    this.buffers.clear()
  }
}
