import assert from 'node:assert/strict'
import { createAudio } from '../src/game/audio.js'

class Param {
  value = 0
  events = []
  setValueAtTime(value, time) { this.events.push(['set', value, time]); this.value = value }
  exponentialRampToValueAtTime(value, time) { assert(value > 0); this.events.push(['exp', value, time]) }
  linearRampToValueAtTime(value, time) { this.events.push(['linear', value, time]) }
  setTargetAtTime(value, time) { this.events.push(['target', value, time]); this.value = value }
  cancelScheduledValues() {}
}
class Node {
  constructor(ctx, kind) {
    this.ctx = ctx; this.kind = kind; this.connections = []
    for (const name of ['gain', 'frequency', 'Q', 'pan']) this[name] = new Param()
    ctx.nodes.push(this)
  }
  connect(node) { this.connections.push(node) }
  disconnect() { this.connections = []; this.disconnected = true }
  start(time = 0) { this.started = time }
  stop(time) { this.stopped = time }
}
class Context {
  static instances = []
  currentTime = 0
  sampleRate = 48000
  state = 'running'
  nodes = []
  buffers = 0
  destination = {}
  constructor() { Context.instances.push(this) }
  createOscillator() { return new Node(this, 'tone') }
  createGain() { return new Node(this, 'gain') }
  createStereoPanner() { return new Node(this, 'pan') }
  createBiquadFilter() { return new Node(this, 'filter') }
  createBufferSource() { return new Node(this, 'noise') }
  createBuffer(channels, length) { this.buffers++; return { getChannelData: () => new Float32Array(length) } }
  resume() { this.state = 'running'; return Promise.resolve() }
  finish() {
    for (const node of this.nodes) if (node.stopped !== undefined && !node.ended) {
      node.ended = true; node.onended?.()
    }
    this.currentTime += 1
  }
}
globalThis.window = { AudioContext: Context }
function setup() {
  const state = { settings: { muted: false, masterVolume: 1, sfxVolume: 1 }, mode: 'PLAYING', entities: { bombers: [] } }
  const audio = createAudio(state)
  return { state, audio, ctx: Context.instances.at(-1) }
}
const sources = ctx => ctx.nodes.filter(n => n.kind === 'tone' || n.kind === 'noise')
const tests = []
function test(name, fn) { tests.push([name, fn]) }
test('launch has a swept, sustained noise whoosh and soft tone attack', () => {
  const { audio, ctx } = setup(); audio.consume(['launch'])
  const noise = sources(ctx).find(n => n.kind === 'noise')
  assert(noise.stopped - noise.started >= 0.12)
  assert(ctx.nodes.some(n => n.kind === 'filter' && n.frequency.events.some(e => e[0] === 'exp')))
  assert(ctx.nodes.some(n => n.kind === 'gain' && n.gain.events.some(e => e[0] === 'linear')))
})
test('explosions layer low impact with filtered debris', () => {
  for (const name of ['intercept', 'city_hit', 'bomber_down']) {
    const { audio, ctx } = setup(); audio.consume([name])
    assert(sources(ctx).some(n => n.kind === 'noise'))
    assert(sources(ctx).some(n => n.kind === 'tone' && n.frequency.events[0][1] <= 180))
    assert(sources(ctx).length >= 3)
  }
})
test('enemy signatures remain distinct without square or sawtooth edges', () => {
  const signatures = new Set()
  for (const name of ['standard', 'fast', 'split', 'zigzag', 'decoy']) {
    const { audio, ctx } = setup(); audio.consume([`incoming_${name}`])
    assert(sources(ctx).every(n => !['square', 'sawtooth'].includes(n.type)))
    signatures.add(JSON.stringify(sources(ctx).map(n => [n.kind, n.frequency.events, n.started, n.stopped])))
  }
  assert.equal(signatures.size, 5)
})
test('burst traffic is bounded and ended graphs disconnect', () => {
  const { audio, ctx } = setup()
  audio.consume(Array(1000).fill({ type: 'intercept', x: 100 }))
  assert(sources(ctx).length <= 32)
  ctx.finish()
  assert(ctx.nodes.every(n => n.disconnected))
  const before = sources(ctx).length; audio.consume(['launch'])
  assert(sources(ctx).length > before)
  assert.equal(ctx.buffers, 1)
})
test('dense explosions reserve headroom instead of summing to clipping', () => {
  const { audio, ctx } = setup(); audio.consume(Array(100).fill('city_hit'))
  const total = ctx.nodes.filter(n => n.kind === 'gain').reduce((sum, n) => sum + Math.max(...n.gain.events.map(e => e[1])), 0)
  assert(total <= 0.651, `transient peak budget ${total}`)
})
test('mute cancels queued notes and position is safely clamped', () => {
  const { audio, ctx, state } = setup()
  audio.consume([{ type: 'wave_clear', x: 1e9 }, { type: 'launch', x: -1e9 }])
  assert(ctx.nodes.filter(n => n.kind === 'pan').every(n => Math.abs(n.pan.value) <= 0.8))
  state.settings.muted = true; audio.sync(state)
  assert(sources(ctx).every(n => n.stopped === ctx.currentTime))
  ctx.finish(); assert(ctx.nodes.every(n => n.disconnected))
})
test('muted and zero-volume calls allocate no voices; volume scales peaks', () => {
  for (const settings of [{ muted: true }, { masterVolume: 0 }, { sfxVolume: 0 }]) {
    const { state, audio, ctx } = setup(); Object.assign(state.settings, settings)
    audio.consume(['launch', 'city_hit']); assert.equal(sources(ctx).length, 0)
  }
  const full = setup(); full.audio.consume(['launch'])
  const half = setup(); half.state.settings.masterVolume = 0.5; half.audio.consume(['launch'])
  const peak = ctx => Math.max(...ctx.nodes.flatMap(n => n.kind === 'gain' ? n.gain.events.map(e => e[1]) : []))
  assert.equal(peak(half.ctx), peak(full.ctx) * 0.5)
})
test('incoming calls never exceed two simultaneous cues', () => {
  const { audio, ctx } = setup(); audio.consume(Array(100).fill('incoming_fast'))
  assert.equal(sources(ctx).length, 4)
  ctx.finish(); audio.consume(['incoming_fast']); assert.equal(sources(ctx).length, 6)
})
test('UFO retirement disconnects its whole graph and prevents overlap', () => {
  const { audio, ctx, state } = setup(); state.entities.bombers = [{ alive: true, x: 100 }]
  audio.sync(state); state.settings.muted = true; audio.sync(state)
  state.settings.muted = false; audio.sync(state)
  assert.equal(sources(ctx).length, 3)
  ctx.finish(); assert(ctx.nodes.every(n => n.disconnected))
  audio.sync(state); assert.equal(sources(ctx).length, 6)
})
test('no WebAudio and no stereo panner are supported', () => {
  window.AudioContext = null
  const { audio, state } = setup(); audio.consume(['launch']); audio.sync(state); audio.unlock()
  window.AudioContext = Context
  const original = Context.prototype.createStereoPanner
  Context.prototype.createStereoPanner = undefined
  try { const sample = setup(); sample.audio.consume([{ type: 'city_hit', x: 0 }]); sample.ctx.finish() }
  finally { Context.prototype.createStereoPanner = original }
})
let failed = 0
for (const [name, fn] of tests) {
  try { fn(); console.log(`PASS ${name}`) }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`) }
}
if (failed) process.exitCode = 1
