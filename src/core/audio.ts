/**
 * All audio is synthesised with the Web Audio API, so the game ships no sound
 * files and works offline. Browsers only allow audio after a gesture, hence
 * unlock() on the first pointer or key event in main.ts.
 */

type Wave = OscillatorType

const MATERIAL_TONE: Record<string, number> = {
  wood: 190,
  glass: 880,
  stone: 120,
  ice: 1040,
  metal: 620,
  rubber: 240,
  crate: 150,
  crystal: 1180,
}

class AudioEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private musicTimer: number | null = null
  private step = 0
  sfxVolume = 0.7
  musicVolume = 0.35
  muted = false

  unlock(): void {
    if (typeof window === 'undefined') return
    if (!this.context) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.context = new Ctor()
      this.master = this.context.createGain()
      this.master.gain.value = this.muted ? 0 : 0.9
      this.master.connect(this.context.destination)
      this.sfxBus = this.context.createGain()
      this.sfxBus.gain.value = this.sfxVolume
      this.sfxBus.connect(this.master)
      this.musicBus = this.context.createGain()
      this.musicBus.gain.value = this.musicVolume * 0.45
      this.musicBus.connect(this.master)
    }
    if (this.context.state === 'suspended') void this.context.resume()
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, sfx))
    this.musicVolume = Math.max(0, Math.min(1, music))
    if (this.sfxBus) this.sfxBus.gain.value = this.sfxVolume
    if (this.musicBus) this.musicBus.gain.value = this.musicVolume * 0.45
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master && this.context) this.master.gain.value = muted ? 0 : 0.9
  }

  private tone(
    frequency: number,
    duration: number,
    options: { wave?: Wave; gain?: number; delay?: number; slideTo?: number } = {},
  ): void {
    if (!this.context || !this.sfxBus) return
    const start = this.context.currentTime + (options.delay ?? 0)
    const osc = this.context.createOscillator()
    const gain = this.context.createGain()
    osc.type = options.wave ?? 'sine'
    osc.frequency.setValueAtTime(Math.max(30, frequency), start)
    if (options.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, options.slideTo), start + duration)
    const peak = (options.gain ?? 0.2) * 0.6
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(gain)
    gain.connect(this.sfxBus)
    osc.start(start)
    osc.stop(start + duration + 0.02)
  }

  private noise(duration: number, gainValue = 0.14, delay = 0, frequency = 1600): void {
    if (!this.context || !this.sfxBus) return
    const frames = Math.floor(this.context.sampleRate * duration)
    const buffer = this.context.createBuffer(1, frames, this.context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < frames; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / frames) ** 2
    }
    const source = this.context.createBufferSource()
    source.buffer = buffer
    const gain = this.context.createGain()
    gain.gain.value = gainValue
    const filter = this.context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = frequency
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxBus)
    source.start(this.context.currentTime + delay)
  }

  click(): void {
    this.tone(520, 0.05, { wave: 'triangle', gain: 0.1 })
  }

  stretch(power: number): void {
    this.tone(180 + power * 220, 0.05, { wave: 'sawtooth', gain: 0.035, slideTo: 240 + power * 300 })
  }

  launch(): void {
    this.tone(200, 0.16, { wave: 'triangle', gain: 0.16, slideTo: 760 })
    this.noise(0.18, 0.1, 0, 900)
  }

  /** Material-specific impact. `force` is 0..1. */
  thud(material: string, force = 0.5): void {
    const base = MATERIAL_TONE[material] ?? 200
    this.tone(base, 0.1 + force * 0.1, { wave: 'triangle', gain: 0.1 + force * 0.08, slideTo: base * 0.6 })
    this.noise(0.08 + force * 0.08, 0.05 + force * 0.06, 0, base * 2)
  }

  shatter(): void {
    this.tone(1500, 0.18, { wave: 'triangle', gain: 0.1, slideTo: 2600 })
    ;[0, 0.03, 0.06, 0.1].forEach((delay) => this.noise(0.09, 0.06, delay, 4200))
  }

  explode(): void {
    this.tone(90, 0.5, { wave: 'sine', gain: 0.3, slideTo: 38 })
    this.noise(0.45, 0.28, 0, 420)
    this.noise(0.25, 0.12, 0.06, 1800)
  }

  zap(): void {
    this.tone(1400, 0.16, { wave: 'square', gain: 0.07, slideTo: 220 })
    this.noise(0.12, 0.09, 0, 3000)
  }

  whoosh(): void {
    this.noise(0.35, 0.12, 0, 700)
  }

  freeze(): void {
    this.tone(1800, 0.3, { wave: 'sine', gain: 0.1, slideTo: 2400 })
  }

  pop(step = 1): void {
    const base = 480 + Math.min(step, 8) * 80
    this.tone(base, 0.1, { wave: 'sine', gain: 0.14, slideTo: base * 1.45 })
    this.tone(base * 2, 0.06, { wave: 'triangle', gain: 0.05, delay: 0.02 })
  }

  squeak(high = false): void {
    this.tone(high ? 950 : 720, 0.09, { wave: 'square', gain: 0.045, slideTo: high ? 1300 : 980 })
  }

  rumble(): void {
    this.noise(0.5, 0.16, 0, 160)
    this.tone(70, 0.4, { wave: 'sine', gain: 0.16, slideTo: 45 })
  }

  fever(): void {
    ;[523, 659, 784, 1046].forEach((note, index) =>
      this.tone(note, 0.28, { wave: 'triangle', gain: 0.13, delay: index * 0.07 }),
    )
  }

  win(): void {
    ;[523, 659, 784, 1046, 1318].forEach((note, index) =>
      this.tone(note, 0.32, { wave: 'triangle', gain: 0.15, delay: index * 0.1 }),
    )
  }

  lose(): void {
    ;[392, 330, 262].forEach((note, index) => this.tone(note, 0.3, { wave: 'sine', gain: 0.12, delay: index * 0.13 }))
  }

  star(): void {
    this.tone(1180, 0.22, { wave: 'sine', gain: 0.13, slideTo: 1700 })
  }

  /** Sparse arpeggio under play; scales change with the mood. */
  startMusic(mood: 'menu' | 'play' | 'fever' | 'zen' = 'play'): void {
    this.unlock()
    if (!this.context || !this.musicBus) return
    this.stopMusic()
    const scales: Record<string, number[]> = {
      menu: [392, 494, 587, 494, 440, 523, 659, 523],
      play: [523, 659, 784, 659, 587, 698, 880, 698],
      fever: [659, 784, 988, 784, 740, 880, 1046, 880],
      zen: [392, 440, 523, 440, 349, 392, 523, 392],
    }
    const notes = scales[mood]!
    const beat = mood === 'fever' ? 215 : mood === 'zen' ? 520 : 320
    this.step = 0
    this.musicTimer = window.setInterval(() => {
      if (!this.context || !this.musicBus) return
      const note = notes[this.step % notes.length]!
      const osc = this.context.createOscillator()
      const gain = this.context.createGain()
      osc.type = 'triangle'
      osc.frequency.value = note
      const start = this.context.currentTime
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.05, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + beat / 1000)
      osc.connect(gain)
      gain.connect(this.musicBus)
      osc.start(start)
      osc.stop(start + beat / 1000 + 0.02)
      this.step += 1
    }, beat)
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer)
      this.musicTimer = null
    }
  }
}

export const sound = new AudioEngine()
