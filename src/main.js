import './style.css'
import { WORLD, GAME_STATES } from './game/constants.js'
import { createInitialState } from './game/state.js'
import { createInput } from './game/input.js'
import { update } from './game/update.js'
import { render } from './game/render.js'
import { startLoop } from './game/loop.js'
import { createAudio } from './game/audio.js'

const app = document.querySelector('#app')
app.innerHTML = `
  <div class="game-shell">
    <button id="openControls" class="settings-toggle" type="button" title="Settings (F1)">Settings</button>
    <div class="controls-panel hidden">
      <div class="controls-header">
        <h3>Settings</h3>
        <button id="closeControls" class="close-btn" type="button" aria-label="Close settings">×</button>
      </div>
      <div class="controls-content">
        <div class="control-group">
          <label for="masterVolume">Master volume</label>
          <input id="masterVolume" type="range" min="0" max="1" step="0.01" value="0.8">
        </div>
        <div class="control-group">
          <label for="sfxVolume">SFX volume</label>
          <input id="sfxVolume" type="range" min="0" max="1" step="0.01" value="0.8">
        </div>
        <div class="control-group">
          <label for="shakeIntensity">Shake intensity</label>
          <input id="shakeIntensity" type="range" min="0" max="2" step="0.1" value="1">
        </div>
        <div class="control-group">
          <label for="visualPreset">Visual preset</label>
          <select id="visualPreset">
            <option value="modern">Modern</option>
            <option value="retro">Retro</option>
          </select>
        </div>
        <div class="control-group checkbox-group">
          <label><input id="muted" type="checkbox"> Mute</label>
        </div>
        <div class="control-group checkbox-group">
          <label><input id="colorblind" type="checkbox"> Colorblind palette</label>
        </div>
        <div class="control-group checkbox-group">
          <label><input id="reducedMotion" type="checkbox"> Reduced motion</label>
        </div>
      </div>
      <div class="controls-footer">
        <small>Arrows or WASD aim · Shift slows aim · Space fires · P pause · R restart · M mute · C colorblind · N reduced motion · V style · F1 settings</small>
      </div>
    </div>
    <canvas id="game" width="${WORLD.width}" height="${WORLD.height}" tabindex="0" aria-label="Missile Command clone"></canvas>
  </div>
`

const canvas = document.querySelector('#game')
const ctx = canvas.getContext('2d')
const panel = document.querySelector('.controls-panel')
const state = createInitialState()
state.mode = GAME_STATES.MENU

try {
  const saved = JSON.parse(localStorage.getItem('mc_settings') || '{}')
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && saved.reducedMotion == null) {
    state.settings.reducedMotion = true
  }
  Object.assign(state.settings, saved)
} catch {
  // ignore invalid settings
}

const input = createInput(canvas, state)
const audio = createAudio(state)

const masterVolumeInput = document.querySelector('#masterVolume')
const sfxVolumeInput = document.querySelector('#sfxVolume')
const shakeIntensityInput = document.querySelector('#shakeIntensity')
const colorblindInput = document.querySelector('#colorblind')
const reducedMotionInput = document.querySelector('#reducedMotion')
const visualPresetInput = document.querySelector('#visualPreset')
const mutedInput = document.querySelector('#muted')
const closeControlsBtn = document.querySelector('#closeControls')
const openControlsBtn = document.querySelector('#openControls')

function setIfIdle(el, value) {
  if (!el || document.activeElement === el) return
  if (el.type === 'checkbox') el.checked = Boolean(value)
  else if (String(el.value) !== String(value)) el.value = String(value)
}

function syncSettingsDom() {
  setIfIdle(masterVolumeInput, state.settings.masterVolume)
  setIfIdle(sfxVolumeInput, state.settings.sfxVolume)
  setIfIdle(shakeIntensityInput, state.settings.shakeIntensity)
  setIfIdle(colorblindInput, state.settings.colorblind)
  setIfIdle(reducedMotionInput, state.settings.reducedMotion)
  setIfIdle(mutedInput, state.settings.muted)
  setIfIdle(visualPresetInput, state.settings.visualPreset || 'modern')
}

let settingsSnapshot = JSON.stringify(state.settings)
function persistSettings() {
  const next = JSON.stringify(state.settings)
  if (next === settingsSnapshot) return
  settingsSnapshot = next
  localStorage.setItem('mc_settings', next)
  syncSettingsDom()
}

function setSettingsOpen(open) {
  panel.classList.toggle('hidden', !open)
  state.ui.settingsOpen = open
  openControlsBtn.setAttribute('aria-expanded', open ? 'true' : 'false')
}

function toggleSettings() {
  setSettingsOpen(panel.classList.contains('hidden'))
}

syncSettingsDom()
setSettingsOpen(false)

masterVolumeInput.addEventListener('input', (e) => {
  state.settings.masterVolume = Number(e.target.value)
  persistSettings()
})
sfxVolumeInput.addEventListener('input', (e) => {
  state.settings.sfxVolume = Number(e.target.value)
  persistSettings()
})
shakeIntensityInput.addEventListener('input', (e) => {
  state.settings.shakeIntensity = Number(e.target.value)
  persistSettings()
})
colorblindInput.addEventListener('change', (e) => {
  state.settings.colorblind = e.target.checked
  persistSettings()
})
reducedMotionInput.addEventListener('change', (e) => {
  state.settings.reducedMotion = e.target.checked
  persistSettings()
})
mutedInput.addEventListener('change', (e) => {
  state.settings.muted = e.target.checked
  persistSettings()
})
visualPresetInput.addEventListener('change', (e) => {
  state.settings.visualPreset = e.target.value
  persistSettings()
})
closeControlsBtn.addEventListener('click', () => {
  setSettingsOpen(false)
  canvas.focus()
})
openControlsBtn.addEventListener('click', () => {
  toggleSettings()
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'F1') {
    e.preventDefault()
    toggleSettings()
  }
  if (e.key === 'Escape' && state.ui.settingsOpen) {
    setSettingsOpen(false)
    canvas.focus()
  }
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.mode === GAME_STATES.PLAYING) state.mode = GAME_STATES.PAUSED
})

canvas.addEventListener('pointerdown', () => audio.unlock())
window.addEventListener('keydown', () => audio.unlock())

startLoop({
  update: (dt) => {
    update(state, input, dt)
    audio.consume(state.events)
    audio.sync(state)
    persistSettings()
  },
  render: () => render(ctx, state),
})
