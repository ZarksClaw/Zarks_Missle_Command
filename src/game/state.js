import { BOARD_SIZE, GAME_STATES, INITIAL_GLYPHS, PLAYER, WORLD } from './constants.js'

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function readHighScore() {
  const value = Number(readJson('mc_high_score', 0))
  return Number.isFinite(value) ? value : 0
}

function normalizeEntry(entry) {
  if (typeof entry === 'number' || (typeof entry === 'string' && entry !== '' && Number.isFinite(Number(entry)))) {
    const score = Number(entry)
    return Number.isFinite(score) ? { initials: '---', score } : null
  }
  if (!entry || !Number.isFinite(Number(entry.score))) return null
  const cleaned = String(entry.initials || '---').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)
  return { initials: cleaned.padEnd(3, '-'), score: Number(entry.score) }
}

export function readLeaderboard() {
  const raw = readJson('mc_leaderboard', [])
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeEntry).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, BOARD_SIZE)
}

export function qualifiesForBoard(state) {
  if (!state || state.score <= 0) return false
  const board = state.leaderboard || []
  if (board.length < BOARD_SIZE) return true
  const last = normalizeEntry(board[board.length - 1])
  return last ? state.score >= last.score : true
}

function persistBoard(state) {
  if (state.score > state.highScore) state.highScore = state.score
  try {
    localStorage.setItem('mc_high_score', String(state.highScore))
    localStorage.setItem('mc_leaderboard', JSON.stringify(state.leaderboard))
  } catch {
    // private mode or a non-browser check
  }
}

export function confirmInitials(state) {
  if (!state || state.runCommitted || state.score <= 0) {
    returnToAttract(state)
    return
  }
  const initials = (state.initials || ['A', 'A', 'A']).join('').replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'A')
  state.runCommitted = true
  const board = readLeaderboard()
  board.push({ initials, score: state.score })
  board.sort((a, b) => b.score - a.score)
  state.leaderboard = board.slice(0, BOARD_SIZE)
  state.lastEntry = { initials, score: state.score }
  persistBoard(state)
  returnToAttract(state)
}

export function beginInitials(state) {
  state.initials = ['A', 'A', 'A']
  state.initialCursor = 0
  state.mode = GAME_STATES.ENTER_INITIALS
}

export function shiftInitial(state, delta) {
  const cursor = state.initialCursor || 0
  const current = state.initials?.[cursor] || 'A'
  const index = Math.max(0, INITIAL_GLYPHS.indexOf(current))
  state.initials[cursor] = INITIAL_GLYPHS[(index + delta + INITIAL_GLYPHS.length) % INITIAL_GLYPHS.length]
}

export function moveInitialCursor(state, delta) {
  state.initialCursor = Math.max(0, Math.min(2, (state.initialCursor || 0) + delta))
}

export function setInitialChar(state, char) {
  const glyph = String(char || '').toUpperCase()
  if (!INITIAL_GLYPHS.includes(glyph)) return false
  const cursor = state.initialCursor || 0
  if (!state.initials) state.initials = ['A', 'A', 'A']
  state.initials[cursor] = glyph
  if (cursor < 2) state.initialCursor = cursor + 1
  else confirmInitials(state)
  return true
}

export function returnToAttract(state) {
  const keep = {
    highScore: Math.max(state.highScore || 0, state.score || 0),
    leaderboard: state.leaderboard,
    settings: state.settings,
    ui: state.ui,
    lastEntry: state.lastEntry || null,
  }
  const fresh = createInitialState()
  Object.assign(fresh, keep)
  fresh.attractIndex = 0
  fresh.attractTimer = state.settings?.reducedMotion ? 8 : 4.5
  Object.assign(state, fresh)
  state.mode = GAME_STATES.MENU
}

function makeDefenses() {
  const margin = 96
  const slots = WORLD.cityCount + WORLD.siloCount
  const span = (WORLD.width - margin * 2) / (slots - 1)
  const pattern = ['silo', 'city', 'city', 'city', 'silo', 'city', 'city', 'city', 'silo']
  const cities = []
  const silos = []
  pattern.forEach((kind, index) => {
    const x = margin + span * index
    if (kind === 'city') {
      cities.push({ id: cities.length, kind, x, y: WORLD.groundY, alive: true })
    } else {
      silos.push({
        id: silos.length,
        kind,
        x,
        y: WORLD.groundY,
        alive: true,
        ammo: PLAYER.siloAmmo,
      })
    }
  })
  return { cities, silos }
}

export function createInitialState() {
  return {
    mode: GAME_STATES.BOOT,
    score: 0,
    wave: 1,
    waveMissilesRemaining: 0,
    enemiesDestroyedThisWave: 0,
    shotsFiredThisWave: 0,
    waveBonusLast: 0,
    highScore: readHighScore(),
    leaderboard: readLeaderboard(),
    lastEntry: null,
    attractIndex: 0,
    attractTimer: 4.5,
    initials: ['A', 'A', 'A'],
    initialCursor: 0,
    runCommitted: false,
    combo: 0,
    comboTimer: 0,
    peakCombo: 0,
    dryTimer: 0,
    hintTimer: 7,
    waveArmed: false,
    bomberDue: false,
    bomberSpawnedThisWave: true,
    settings: {
      colorblind: false,
      reducedMotion: false,
      visualPreset: 'modern',
      shakeIntensity: 1,
      masterVolume: 0.8,
      sfxVolume: 0.8,
      muted: false,
    },
    ui: { settingsOpen: false },
    aim: { x: WORLD.width / 2, y: 260, siloId: null, hasAmmo: true },
    events: [],
    flash: null,
    camera: { shakeTime: 0, shakeMag: 0 },
    defenses: makeDefenses(),
    threatened: [],
    craters: [],
    scorePopups: [],
    entities: {
      enemyMissiles: [],
      playerMissiles: [],
      explosions: [],
      particles: [],
      shockwaves: [],
      afterimages: [],
      bombers: [],
    },
    timers: {
      enemySpawn: 0,
      waveCooldown: 0,
      firework: 0,
      fireCooldown: 0,
    },
    requestRestart: false,
  }
}

export function resetForNewGame(state) {
  const fresh = createInitialState()
  fresh.highScore = Math.max(state.highScore || 0, fresh.highScore)
  fresh.leaderboard = state.leaderboard?.length ? state.leaderboard : fresh.leaderboard
  fresh.settings = state.settings
  fresh.ui = state.ui
  Object.assign(state, fresh)
  state.mode = GAME_STATES.PLAYING
}
