import { WORLD } from './constants.js'

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

export function createAudio(state) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = Ctx ? new Ctx() : null
  let ufo = null
  let retiringUfo = false
  let noiseBuffer = null
  const voices = new Set()
  const incomingUntil = []
  // Count scheduled sources as well as sounding ones: bursts cannot grow the graph.
  const MAX_VOICES = 32

  let reservedPeak = 0

  function track(source, nodes, peak) {
    reservedPeak += peak
    voices.add(source)
    source.onended = () => {
      for (const node of nodes) node.disconnect()
      voices.delete(source)
      reservedPeak = Math.max(0, reservedPeak - peak)
      source.onended = null
    }
  }

  function envelope(gain, amount, now, duration, attack = 0.006) {
    const peak = Math.min(level(amount), Math.max(0.0001, 0.65 - reservedPeak))
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(peak, now + Math.min(attack, duration / 3))
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    gain.gain.linearRampToValueAtTime(0, now + duration + 0.008)
    return peak
  }

  function level(amount = 1) {
    const master = clamp(state.settings.masterVolume, 0, 1)
    const sfx = clamp(state.settings.sfxVolume, 0, 1)
    return amount * master * sfx
  }

  function panFromX(x) {
    if (!Number.isFinite(x)) return 0
    return clamp((x / WORLD.width - 0.5) * 1.35, -0.8, 0.8)
  }

  function playTone({
    freq = 440,
    duration = 0.08,
    type = 'sine',
    gainValue = 0.1,
    endFreq = null,
    startOffset = 0,
    pan = 0,
  } = {}) {
    if (!ctx || state.settings.muted || level() <= 0 || voices.size >= MAX_VOICES || reservedPeak >= 0.6499) return
    const now = ctx.currentTime + startOffset
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration)
    }
    const peak = envelope(gain, gainValue, now, duration)
    const nodes = [osc, gain]
    if (pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner()
      panner.pan.setValueAtTime(pan, now)
      nodes.push(panner)
      osc.connect(panner)
      panner.connect(gain)
    } else {
      osc.connect(gain)
    }
    gain.connect(ctx.destination)
    track(osc, nodes, peak)
    osc.start(now)
    osc.stop(now + duration + 0.01)
  }

  function playNoiseBurst({
    duration = 0.08,
    gainValue = 0.08,
    startOffset = 0,
    pan = 0,
    frequency = 1100,
    endFrequency = 280,
    attack = 0.008,
  } = {}) {
    if (!ctx || state.settings.muted || level() <= 0 || voices.size >= MAX_VOICES || reservedPeak >= 0.6499) return
    const now = ctx.currentTime + startOffset
    // Reuse a half-second noise bed; the filter and envelope shape each event.
    if (!noiseBuffer) {
      const length = Math.ceil(ctx.sampleRate * 0.5)
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
    }

    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(frequency, now)
    filter.frequency.exponentialRampToValueAtTime(endFrequency, now + duration)
    filter.Q.value = 0.65
    const gain = ctx.createGain()
    const peak = envelope(gain, gainValue, now, duration, attack)
    const nodes = [src, filter, gain]
    src.connect(filter)
    if (pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner()
      panner.pan.setValueAtTime(pan, now)
      nodes.push(panner)
      filter.connect(panner)
      panner.connect(gain)
    } else {
      filter.connect(gain)
    }
    gain.connect(ctx.destination)
    track(src, nodes, peak)
    src.start(now)
    src.stop(now + duration + 0.01)
  }

  function play(eventName, x = null) {
    if (!ctx || state.settings.muted || level() <= 0) return
    const pan = panFromX(x)
    if (eventName.startsWith('incoming_')) {
      while (incomingUntil.length && incomingUntil[0] <= ctx.currentTime) incomingUntil.shift()
      if (incomingUntil.length >= 2 || voices.size > MAX_VOICES - 2) return
      incomingUntil.push(ctx.currentTime + 0.22)
    }
    switch (eventName) {
      case 'launch':
        // Ignition body under a rising, then thinning exhaust whoosh.
        playTone({ freq: 160, endFreq: 380, duration: 0.14, type: 'triangle', gainValue: 0.035, pan })
        playNoiseBurst({ duration: 0.2, gainValue: 0.042, pan, frequency: 620, endFrequency: 2300, attack: 0.025 })
        break
      case 'incoming_standard':
        playTone({ freq: 260, endFreq: 140, duration: 0.18, type: 'triangle', gainValue: 0.026, pan })
        playNoiseBurst({ duration: 0.12, gainValue: 0.012, pan, frequency: 520, endFrequency: 320 })
        break
      case 'incoming_fast':
        // Two short rising pips: speed without a piercing square-wave edge.
        playTone({ freq: 620, endFreq: 880, duration: 0.055, type: 'sine', gainValue: 0.026, pan })
        playTone({ freq: 780, endFreq: 1040, duration: 0.05, type: 'sine', gainValue: 0.02, startOffset: 0.075, pan })
        break
      case 'incoming_split':
        playTone({ freq: 170, endFreq: 120, duration: 0.16, type: 'triangle', gainValue: 0.03, pan })
        playTone({ freq: 255, endFreq: 190, duration: 0.16, type: 'sine', gainValue: 0.017, startOffset: 0.03, pan })
        break
      case 'incoming_zigzag':
        playTone({ freq: 340, endFreq: 520, duration: 0.07, type: 'triangle', gainValue: 0.024, pan })
        playTone({ freq: 520, endFreq: 280, duration: 0.08, type: 'triangle', gainValue: 0.02, startOffset: 0.07, pan })
        break
      case 'incoming_decoy':
        playTone({ freq: 980, endFreq: 720, duration: 0.05, type: 'sine', gainValue: 0.016, pan })
        break
      case 'intercept':
        playNoiseBurst({ duration: 0.16, gainValue: 0.075, pan, frequency: 1800, endFrequency: 380 })
        playTone({ freq: 150, endFreq: 48, duration: 0.22, type: 'sine', gainValue: 0.065, pan })
        playTone({ freq: 680, endFreq: 220, duration: 0.1, type: 'triangle', gainValue: 0.022, startOffset: 0.012, pan })
        break
      case 'enemy_split':
        playTone({ freq: 680, endFreq: 980, duration: 0.06, type: 'triangle', gainValue: 0.03, pan })
        playTone({ freq: 520, endFreq: 860, duration: 0.06, type: 'triangle', gainValue: 0.026, startOffset: 0.045, pan })
        break
      case 'city_hit':
        playNoiseBurst({ duration: 0.32, gainValue: 0.085, pan, frequency: 950, endFrequency: 160 })
        playTone({ freq: 115, endFreq: 38, duration: 0.4, type: 'sine', gainValue: 0.085, pan })
        playNoiseBurst({ duration: 0.18, gainValue: 0.03, pan, frequency: 1800, endFrequency: 440, startOffset: 0.045 })
        break
      case 'ufo_arrive':
        playTone({ freq: 70, endFreq: 150, duration: 0.42, type: 'triangle', gainValue: 0.035, pan })
        playTone({ freq: 210, endFreq: 300, duration: 0.42, type: 'sine', gainValue: 0.02, pan })
        break
      case 'ufo_drop':
        playTone({ freq: 540, endFreq: 180, duration: 0.14, type: 'triangle', gainValue: 0.035, pan })
        playNoiseBurst({ duration: 0.09, gainValue: 0.02, pan, frequency: 1600, endFrequency: 500 })
        break
      case 'bomber_down':
        playNoiseBurst({ duration: 0.3, gainValue: 0.075, pan, frequency: 1400, endFrequency: 220 })
        playTone({ freq: 175, endFreq: 42, duration: 0.38, type: 'sine', gainValue: 0.07, pan })
        playTone({ freq: 320, endFreq: 65, duration: 0.28, type: 'triangle', gainValue: 0.03, startOffset: 0.04, pan })
        break
      case 'dry_fire':
        playTone({ freq: 180, endFreq: 90, duration: 0.07, type: 'square', gainValue: 0.04 })
        break
      case 'fizzle':
        playTone({ freq: 880, endFreq: 240, duration: 0.09, type: 'sine', gainValue: 0.02, pan })
        break
      case 'wave_clear':
        playTone({ freq: 523, duration: 0.08, type: 'triangle', gainValue: 0.06 })
        playTone({ freq: 659, duration: 0.08, type: 'triangle', gainValue: 0.06, startOffset: 0.08 })
        playTone({ freq: 784, duration: 0.1, type: 'triangle', gainValue: 0.06, startOffset: 0.16 })
        playTone({ freq: 1046, duration: 0.12, type: 'triangle', gainValue: 0.065, startOffset: 0.26 })
        break
      case 'firework':
        playNoiseBurst({ duration: 0.07, gainValue: 0.03, pan, frequency: 1800 })
        playTone({ freq: 880 + Math.random() * 280, endFreq: 240, duration: 0.12, type: 'triangle', gainValue: 0.03, pan })
        break
      case 'game_over':
        playTone({ freq: 311, endFreq: 196, duration: 0.16, type: 'sawtooth', gainValue: 0.07 })
        playTone({ freq: 196, endFreq: 98, duration: 0.28, type: 'sawtooth', gainValue: 0.06, startOffset: 0.14 })
        break
      default:
        break
    }
  }

  function stopUfo() {
    if (!ufo || !ctx) return
    const now = ctx.currentTime
    retiringUfo = true
    try {
      ufo.gain.gain.cancelScheduledValues(now)
      ufo.gain.gain.setTargetAtTime(0.0001, now, 0.04)
      ufo.osc.stop(now + 0.12)
      ufo.overtone.stop(now + 0.12)
      ufo.lfo.stop(now + 0.12)
    } catch {
      // already stopped
    }
    ufo = null
  }

  function startUfo() {
    if (!ctx || retiringUfo) return
    const osc = ctx.createOscillator()
    const overtone = ctx.createOscillator()
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    osc.type = 'sawtooth'
    osc.frequency.value = 96
    overtone.type = 'sine'
    overtone.frequency.value = 192
    lfo.type = 'sine'
    lfo.frequency.value = 5.5
    lfoGain.gain.value = 12
    filter.type = 'lowpass'
    filter.frequency.value = 480
    gain.gain.value = 0.0001
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    osc.connect(filter)
    overtone.connect(filter)
    filter.connect(gain)
    if (panner) {
      gain.connect(panner)
      panner.connect(ctx.destination)
    } else {
      gain.connect(ctx.destination)
    }
    let ended = 0
    const nodes = [osc, overtone, lfo, lfoGain, filter, gain, panner].filter(Boolean)
    for (const source of [osc, overtone, lfo]) {
      source.onended = () => {
        source.onended = null
        ended += 1
        if (ended === 3) {
          for (const node of nodes) node.disconnect()
          retiringUfo = false
        }
      }
    }
    osc.start()
    overtone.start()
    lfo.start()
    ufo = { osc, overtone, lfo, gain, panner }
  }

  function sync(gameState) {
    if (!ctx) return
    const visible = gameState.mode === 'PLAYING'
      ? gameState.entities.bombers?.find((craft) => craft.alive && craft.x > -10 && craft.x < WORLD.width + 10)
      : null
    if (gameState.settings.muted || level() <= 0) {
      // Also cancel delayed notes when muting, not only the continuous hum.
      for (const source of voices) source.stop(ctx.currentTime)
      incomingUntil.length = 0
    }
    if (!visible || gameState.settings.muted || level() <= 0) {
      stopUfo()
      return
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    if (!ufo) startUfo()
    if (!ufo) return
    const now = ctx.currentTime
    ufo.gain.gain.setTargetAtTime(Math.max(0.0001, level(0.045)), now, 0.08)
    if (ufo.panner) ufo.panner.pan.setTargetAtTime(panFromX(visible.x), now, 0.06)
  }

  function consume(events) {
    if (!events?.length) return
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
    for (const ev of events) {
      const name = typeof ev === 'string' ? ev : ev?.type
      const x = typeof ev === 'string' ? null : ev?.x
      if (name) play(name, x)
    }
  }

  function unlock() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
  }

  return { consume, unlock, sync }
}
