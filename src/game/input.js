import { GAME_STATES, WORLD } from './constants.js'
import { confirmInitials, moveInitialCursor, resetForNewGame, returnToAttract, setInitialChar, shiftInitial } from './state.js'

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

export function createInput(canvas, state) {
  const input = {
    pointer: { x: WORLD.width / 2, y: 260, active: false },
    fireRequested: false,
    keys: new Set(),
  }

  const toWorld = (event) => {
    const rect = canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height
    return {
      x: clamp(x, 0, WORLD.width),
      y: clamp(y, 0, WORLD.height),
    }
  }

  const typingTarget = (event) => {
    const tag = event.target?.tagName
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
  }

  canvas.addEventListener('pointermove', (event) => {
    const p = toWorld(event)
    input.pointer.x = p.x
    input.pointer.y = p.y
    input.pointer.active = true
  })

  canvas.addEventListener('pointerdown', (event) => {
    canvas.focus()
    const p = toWorld(event)
    input.pointer.x = p.x
    input.pointer.y = p.y
    input.pointer.active = true

    if (state.mode === GAME_STATES.PLAYING) input.fireRequested = true
    else if (state.mode === GAME_STATES.MENU) state.mode = GAME_STATES.PLAYING
    else if (state.mode === GAME_STATES.GAME_OVER) returnToAttract(state)
    else if (state.mode === GAME_STATES.ENTER_INITIALS) confirmInitials(state)
    else if (state.mode === GAME_STATES.PAUSED) state.mode = GAME_STATES.PLAYING
    else if (state.mode === GAME_STATES.WAVE_CLEAR) state.timers.waveCooldown = 0
  })

  window.addEventListener('keydown', (event) => {
    if (typingTarget(event)) return
    if (state.mode === GAME_STATES.ENTER_INITIALS) {
      handleInitialsKey(state, event)
      return
    }
    if (state.mode === GAME_STATES.MENU && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {
      event.preventDefault()
      const step = event.code === 'ArrowRight' ? 1 : 2
      state.attractIndex = ((state.attractIndex || 0) + step) % 3
      state.attractTimer = state.settings.reducedMotion ? 8 : 4.5
      return
    }
    input.keys.add(event.code)

    if (event.key === 'Escape') {
      if (state.ui?.settingsOpen) return
      if (state.mode === GAME_STATES.PLAYING) state.mode = GAME_STATES.PAUSED
      else if (state.mode === GAME_STATES.PAUSED) state.mode = GAME_STATES.PLAYING
      return
    }

    if (event.key === 'p' || event.key === 'P') {
      if (state.mode === GAME_STATES.PLAYING) state.mode = GAME_STATES.PAUSED
      else if (state.mode === GAME_STATES.PAUSED) state.mode = GAME_STATES.PLAYING
    }

    if ((event.key === 'r' || event.key === 'R') && !event.repeat) {
      if (state.mode === GAME_STATES.GAME_OVER) returnToAttract(state)
      else if (state.mode !== GAME_STATES.MENU) resetForNewGame(state)
    }

    if (event.key === 'm' || event.key === 'M') {
      state.settings.muted = !state.settings.muted
    }

    if (event.key === 'c' || event.key === 'C') {
      state.settings.colorblind = !state.settings.colorblind
    }

    if (event.key === 'n' || event.key === 'N') {
      state.settings.reducedMotion = !state.settings.reducedMotion
    }

    if (event.key === 'v' || event.key === 'V') {
      state.settings.visualPreset = state.settings.visualPreset === 'modern' ? 'retro' : 'modern'
    }

    if (event.code === 'Space' || event.key === 'Enter') {
      event.preventDefault()
      if (state.mode === GAME_STATES.MENU) state.mode = GAME_STATES.PLAYING
      else if (state.mode === GAME_STATES.GAME_OVER) returnToAttract(state)
      else if (state.mode === GAME_STATES.PAUSED) state.mode = GAME_STATES.PLAYING
      else if (state.mode === GAME_STATES.WAVE_CLEAR) state.timers.waveCooldown = 0
      else if (state.mode === GAME_STATES.PLAYING && !event.repeat) input.fireRequested = true
    }

    if (event.code.startsWith('Arrow')) event.preventDefault()
  })

  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code)
  })

  window.addEventListener('blur', () => {
    input.keys.clear()
  })

  return input
}

function handleInitialsKey(state, event) {
  if (event.key === 'Escape') {
    returnToAttract(state)
    return
  }
  if (event.key === 'Enter' || event.code === 'Space') {
    event.preventDefault()
    confirmInitials(state)
    return
  }
  if (event.key === 'Backspace') {
    event.preventDefault()
    moveInitialCursor(state, -1)
    return
  }
  if (event.code === 'ArrowUp') {
    event.preventDefault()
    shiftInitial(state, -1)
    return
  }
  if (event.code === 'ArrowDown') {
    event.preventDefault()
    shiftInitial(state, 1)
    return
  }
  if (event.code === 'ArrowLeft') {
    event.preventDefault()
    moveInitialCursor(state, -1)
    return
  }
  if (event.code === 'ArrowRight') {
    event.preventDefault()
    moveInitialCursor(state, 1)
    return
  }
  if (event.key.length === 1 && !event.repeat) setInitialChar(state, event.key)
}
