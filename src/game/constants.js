export const GAME_STATES = Object.freeze({
  BOOT: 'BOOT',
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  WAVE_CLEAR: 'WAVE_CLEAR',
  GAME_OVER: 'GAME_OVER',
  ENTER_INITIALS: 'ENTER_INITIALS',
})

export const BOARD_SIZE = 8
export const INITIAL_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export const WORLD = Object.freeze({
  width: 1280,
  height: 720,
  groundY: 640,
  cityCount: 6,
  siloCount: 3,
})

export const TIMING = Object.freeze({
  fixedStep: 1 / 60,
  maxFrameDelta: 1 / 20,
})

export const PLAYER = Object.freeze({
  missileSpeed: 700,
  explosionRadius: 84,
  explosionGrowRate: 340,
  explosionShrinkRate: 150,
  siloAmmo: 10,
  fireCooldown: 0.08,
  comboWindow: 2.6,
  comboBonusPerStack: 0.25,
  maxComboMult: 3,
})

export const ENEMY_TYPES = Object.freeze({
  STANDARD: 'standard',
  FAST: 'fast',
  SPLIT: 'split',
  ZIGZAG: 'zigzag',
  DECOY: 'decoy',
})

export const ENEMIES = Object.freeze({
  baseSpawnInterval: 1.2,
  minSpawnInterval: 0.28,
  spawnIntervalStep: 0.055,
  waveBaseCount: 8,
  waveCountPerLevel: 2,
  hitRadius: 42,
  maxOnScreen: 16,
  bomberScore: 500,
  bomberFirstWave: 3,
  cityBias: 0.72,
  splitChildScore: 70,
  scoreByType: {
    standard: 100,
    fast: 150,
    split: 250,
    zigzag: 175,
    decoy: 40,
  },
})
