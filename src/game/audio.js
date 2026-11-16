import { WORLD } from './constants.js'

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

export function createAudio(state) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  const ctx = Ctx ? new Ctx() : null
  let ufo = null

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
    if (!ctx || state.settings.muted) return
    const now = ctx.currentTime + startOffset
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration)
    }
    gain.gain.setValueAtTime(Math.max(0.0001, level(gainValue)), now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    if (pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner()
      panner.pan.setValueAtTime(pan, now)
      osc.connect(panner)
      panner.connect(gain)
    } else {
      osc.connect(gain)
    }
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + duration)
  }

  function playNoiseBurst({
    duration = 0.08,
    gainValue = 0.08,
    startOffset = 0,
    pan = 0,
    frequency = 1100,
  } = {}) {
    if (!ctx || state.settings.muted) return
    const now = ctx.currentTime + startOffset
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length)

    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(frequency, now)
    filter.Q.value = 0.8
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(Math.max(0.0001, level(gainValue)), now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    src.connect(filter)
    if (pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner()
      panner.pan.setValueAtTime(pan, now)
      filter.connect(panner)
      panner.connect(gain)
    } else {
      filter.connect(gain)
    }
    gain.connect(ctx.destination)
    src.start(now)
    src.stop(now + duration)
  }

  function play(eventName, x = null) {
    const pan = panFromX(x)
    switch (eventName) {
      case 'launch':
        playTone({ freq: 280, endFreq: 620, duration: 0.1, type: 'triangle', gainValue: 0.05, pan })
        playNoiseBurst({ duration: 0.03, gainValue: 0.025, pan, frequency: 1400 })
        break
      case 'incoming_standard':
        playTone({ freq: 260, endFreq: 140, duration: 0.18, type: 'sawtooth', gainValue: 0.03, pan })
        playNoiseBurst({ duration: 0.12, gainValue: 0.018, pan, frequency: 520 })
        break
      case 'incoming_fast':
        playTone({ freq: 620, endFreq: 980, duration: 0.07, type: 'square', gainValue: 0.028, pan })
        playTone({ freq: 1240, endFreq: 760, duration: 0.05, type: 'square', gainValue: 0.012, startOffset: 0.02, pan })
        break
      case 'incoming_split':
        playTone({ freq: 170, endFreq: 120, duration: 0.16, type: 'triangle', gainValue: 0.032, pan })
        playTone({ freq: 255, endFreq: 190, duration: 0.16, type: 'square', gainValue: 0.018, startOffset: 0.03, pan })
        break
      case 'incoming_zigzag':
        playTone({ freq: 340, endFreq: 520, duration: 0.07, type: 'square', gainValue: 0.024, pan })
        playTone({ freq: 520, endFreq: 280, duration: 0.08, type: 'square', gainValue: 0.02, startOffset: 0.07, pan })
        break
      case 'incoming_decoy':
        playTone({ freq: 980, endFreq: 720, duration: 0.05, type: 'sine', gainValue: 0.016, pan })
        break
      case 'intercept':
        playNoiseBurst({ duration: 0.08, gainValue: 0.11, pan, frequency: 900 })
        playTone({ freq: 820, endFreq: 280, duration: 0.13, type: 'square', gainValue: 0.07, pan })
        playTone({ freq: 1240, endFreq: 480, duration: 0.14, type: 'triangle', gainValue: 0.045, startOffset: 0.012, pan })
        break
      case 'enemy_split':
        playTone({ freq: 680, endFreq: 980, duration: 0.06, type: 'square', gainValue: 0.04, pan })
        playTone({ freq: 520, endFreq: 860, duration: 0.06, type: 'square', gainValue: 0.035, startOffset: 0.02, pan })
        break
      case 'city_hit':
        playNoiseBurst({ duration: 0.22, gainValue: 0.14, pan, frequency: 280 })
        playTone({ freq: 160, endFreq: 52, duration: 0.36, type: 'sawtooth', gainValue: 0.1, pan })
        break
      case 'ufo_arrive':
        playTone({ freq: 70, endFreq: 150, duration: 0.42, type: 'sawtooth', gainValue: 0.04, pan })
        playTone({ freq: 210, endFreq: 300, duration: 0.42, type: 'sine', gainValue: 0.02, pan })
        break
      case 'ufo_drop':
        playTone({ freq: 540, endFreq: 180, duration: 0.14, type: 'sawtooth', gainValue: 0.04, pan })
        playNoiseBurst({ duration: 0.06, gainValue: 0.02, pan, frequency: 1600 })
        break
      case 'bomber_down':
        playNoiseBurst({ duration: 0.18, gainValue: 0.1, pan, frequency: 700 })
        playTone({ freq: 420, endFreq: 90, duration: 0.28, type: 'sawtooth', gainValue: 0.07, pan })
        playTone({ freq: 180, endFreq: 60, duration: 0.34, type: 'triangle', gainValue: 0.04, startOffset: 0.04, pan })
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
    if (!ctx) return
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
    if (!visible || gameState.settings.muted) {
      stopUfo()
      return
    }
    if (ctx.state === 'suspended') ctx.resume()
    if (!ufo) startUfo()
    const now = ctx.currentTime
    ufo.gain.gain.setTargetAtTime(Math.max(0.0001, level(0.045)), now, 0.08)
    if (ufo.panner) ufo.panner.pan.setTargetAtTime(panFromX(visible.x), now, 0.06)
  }

  function consume(events) {
    if (!events?.length) return
    if (ctx && ctx.state === 'suspended') ctx.resume()
    for (const ev of events) {
      const name = typeof ev === 'string' ? ev : ev?.type
      const x = typeof ev === 'string' ? null : ev?.x
      if (name) play(name, x)
    }
  }

  function unlock() {
    if (ctx && ctx.state === 'suspended') ctx.resume()
  }

  return { consume, unlock, sync }
}
