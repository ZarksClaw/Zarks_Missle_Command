import { ENEMIES, ENEMY_TYPES, GAME_STATES, PLAYER, WORLD } from './constants.js'
import { beginInitials, qualifiesForBoard } from './state.js'

const MAX_PARTICLES = 480
const EMPTY_KEYS = new Set()

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function emit(state, type, x) {
  state.events.push(Number.isFinite(x) ? { type, x } : type)
}

function noteHighScore(state) {
  if (state.score <= state.highScore) return
  state.highScore = state.score
  try {
    localStorage.setItem('mc_high_score', String(state.highScore))
  } catch {
    // ignore
  }
}

function aliveCities(state) {
  return state.defenses.cities.filter((c) => c.alive)
}

function aliveTargets(state) {
  return [
    ...state.defenses.cities.filter((c) => c.alive),
    ...state.defenses.silos.filter((s) => s.alive),
  ]
}

function pickTarget(state) {
  const cities = state.defenses.cities.filter((c) => c.alive)
  const silos = state.defenses.silos.filter((s) => s.alive)
  if (!cities.length && !silos.length) return null
  const preferCities = cities.length > 0 && Math.random() < ENEMIES.cityBias
  const pool = preferCities ? cities : [...cities, ...silos]
  if (!pool.length) return null
  return pool[(Math.random() * pool.length) | 0]
}

function pickEnemyType(wave) {
  const bag = [
    [ENEMY_TYPES.STANDARD, Math.max(0.34, 0.62 - wave * 0.03)],
    [ENEMY_TYPES.FAST, Math.min(0.3, 0.16 + wave * 0.012)],
    [ENEMY_TYPES.SPLIT, wave >= 2 ? Math.min(0.24, 0.08 + wave * 0.012) : 0],
    [ENEMY_TYPES.ZIGZAG, wave >= 3 ? Math.min(0.2, 0.06 + wave * 0.01) : 0],
    [ENEMY_TYPES.DECOY, wave >= 4 ? Math.min(0.16, 0.05 + wave * 0.006) : 0],
  ]
  const total = bag.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = Math.random() * total
  for (const [type, weight] of bag) {
    roll -= weight
    if (roll <= 0) return type
  }
  return ENEMY_TYPES.STANDARD
}

function speedFor(type, wave) {
  let speed = 76 + wave * 6.5 + Math.random() * 16
  if (type === ENEMY_TYPES.FAST) speed *= 1.42
  if (type === ENEMY_TYPES.SPLIT) speed *= 0.84
  if (type === ENEMY_TYPES.ZIGZAG) speed *= 0.96
  if (type === ENEMY_TYPES.DECOY) speed *= 1.18
  return speed
}

function makeEnemy(type, x, y, target, speed, score) {
  const dx = target.x - x
  const dy = target.y - y
  const totalDist = Math.hypot(dx, dy) || 1
  const missile = {
    type,
    x,
    y,
    startX: x,
    startY: y,
    targetX: target.x,
    targetY: target.y,
    targetId: target.id,
    targetKind: target.kind,
    speed,
    alive: true,
    splitAt: type === ENEMY_TYPES.SPLIT ? 0.42 + Math.random() * 0.16 : null,
    progress: 0,
    traveled: 0,
    totalDist,
    perpX: -dy / totalDist,
    perpY: dx / totalDist,
    zigFreq: 2.6 + Math.random() * 1.4,
    zigzag: type === ENEMY_TYPES.ZIGZAG,
    trail: [],
    trailMax: 80,
    sfxTimer: 0.3 + Math.random() * 0.45,
  }
  if (score != null) missile.score = score
  return missile
}

function spawnEnemy(state) {
  const target = pickTarget(state)
  if (!target) return false
  const type = pickEnemyType(state.wave)
  const missile = makeEnemy(type, Math.random() * WORLD.width, -16, target, speedFor(type, state.wave))
  state.entities.enemyMissiles.push(missile)
  state.waveMissilesRemaining -= 1
  missile.sfxTimer = voiceInterval(type)
  emit(state, `incoming_${type}`, missile.x)
  return true
}

function voiceInterval(type) {
  if (type === ENEMY_TYPES.FAST) return 0.38
  if (type === ENEMY_TYPES.ZIGZAG) return 0.5
  if (type === ENEMY_TYPES.SPLIT) return 0.7
  if (type === ENEMY_TYPES.DECOY) return 1.15
  return 0.85
}

function tickIncomingSounds(state, dt) {
  const ready = []
  for (const missile of state.entities.enemyMissiles) {
    if (!missile.alive || missile.y < -4) continue
    missile.sfxTimer = (missile.sfxTimer ?? 0.4) - dt
    if (missile.sfxTimer <= 0) ready.push(missile)
  }
  ready.sort((a, b) => b.y - a.y)
  const cap = 2
  for (let i = 0; i < ready.length; i += 1) {
    const missile = ready[i]
    if (i < cap) {
      missile.sfxTimer = voiceInterval(missile.type)
      emit(state, `incoming_${missile.type}`, missile.x)
    } else {
      missile.sfxTimer = 0.14
    }
  }
}

function pickBestSilo(state, targetX) {
  const silos = state.defenses.silos.filter((s) => s.alive && s.ammo > 0)
  if (!silos.length) return null
  silos.sort((a, b) => Math.abs(a.x - targetX) - Math.abs(b.x - targetX) || a.id - b.id)
  return silos[0]
}

function popup(state, x, y, text, color = '#fef08a') {
  if (state.scorePopups.length > 24) state.scorePopups.shift()
  state.scorePopups.push({ x, y, text, color, life: 0.85, maxLife: 0.85, vy: -38 })
}

function spawnParticles(state, x, y, count, speed, life, color, options = {}) {
  const kind = options.kind || 'spark'
  const room = MAX_PARTICLES - state.entities.particles.length
  const n = Math.min(count, Math.max(0, room))
  const spread = options.spread
  const aim = options.aim ?? -Math.PI / 2
  for (let i = 0; i < n; i += 1) {
    const angle = spread == null ? Math.random() * Math.PI * 2 : aim + (Math.random() - 0.5) * spread
    const velocity = (0.35 + Math.random() * 0.65) * speed
    state.entities.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life,
      maxLife: life,
      color,
      size: kind === 'ember' ? 2.2 + Math.random() * 2.2 : 1.2 + Math.random() * 1.6,
      kind,
      alive: true,
    })
  }
}

function spawnShockwave(state, x, y, color, maxRadius, life) {
  if (state.settings.reducedMotion) return
  if (!state.entities.shockwaves) state.entities.shockwaves = []
  if (state.entities.shockwaves.length > 24) state.entities.shockwaves.shift()
  state.entities.shockwaves.push({
    x,
    y,
    radius: 6,
    maxRadius,
    life,
    maxLife: life,
    color,
    alive: true,
  })
}

function addFlash(state, color, alpha, life) {
  if (state.settings.reducedMotion) return
  state.flash = { color, alpha, life, maxLife: life }
}

function ghostTrail(state, trail, color) {
  if (state.settings.reducedMotion || !trail || trail.length < 2) return
  if (!state.entities.afterimages) state.entities.afterimages = []
  if (state.entities.afterimages.length > 16) state.entities.afterimages.shift()
  state.entities.afterimages.push({
    points: trail.map((p) => ({ x: p.x, y: p.y })),
    color,
    life: 0.38,
    maxLife: 0.38,
    alive: true,
  })
}

function detonate(state, missile) {
  const x = missile.x
  const y = missile.y
  ghostTrail(state, missile.trail, '#7dd3fc')
  state.entities.explosions.push({
    x,
    y,
    radius: 8,
    maxRadius: PLAYER.explosionRadius,
    growRate: PLAYER.explosionGrowRate,
    shrinkRate: PLAYER.explosionShrinkRate,
    growing: true,
    alive: true,
  })
  spawnShockwave(state, x, y, '#7dd3fc', PLAYER.explosionRadius * 1.55, 0.48)
  spawnParticles(state, x, y, 16, 280, 0.38, '#fef9c3', { kind: 'streak' })
  spawnParticles(state, x, y, 8, 70, 0.55, '#fb7185', { kind: 'ember' })
  addFlash(state, '#fff7ed', 0.14, 0.07)
}

function shake(state, time, mag) {
  if (state.settings.reducedMotion) return
  state.camera.shakeTime = Math.max(state.camera.shakeTime, time)
  state.camera.shakeMag = Math.max(state.camera.shakeMag, mag)
}

function launchPlayerMissile(state, targetX, targetY) {
  const x = clamp(targetX, 12, WORLD.width - 12)
  const y = clamp(Math.min(targetY, WORLD.groundY - 14), 12, WORLD.groundY - 14)
  const silo = pickBestSilo(state, x)
  if (!silo) return false
  silo.ammo -= 1
  state.shotsFiredThisWave += 1
  state.hintTimer = 0
  emit(state, 'launch', silo.x)
  spawnParticles(state, silo.x, silo.y - 16, 12, 240, 0.26, '#e0f2fe', { kind: 'streak', aim: -Math.PI / 2, spread: 0.85 })
  addFlash(state, '#e0f2fe', 0.07, 0.05)
  const originY = silo.y - 10
  state.entities.playerMissiles.push({
    x: silo.x,
    y: originY,
    startX: silo.x,
    startY: originY,
    targetX: x,
    targetY: y,
    totalDist: Math.hypot(x - silo.x, y - originY) || 1,
    traveled: 0,
    progress: 0,
    speed: PLAYER.missileSpeed,
    alive: true,
    trail: [],
    trailMax: 28,
  })
  return true
}

function updateMissile(missile, dt) {
  if (missile.trail) {
    missile.trail.push({ x: missile.x, y: missile.y })
    const max = missile.trailMax ?? 40
    if (missile.trail.length > max) missile.trail.shift()
  }

  if (missile.zigzag) {
    missile.traveled += missile.speed * dt
    const t = Math.min(1, missile.traveled / (missile.totalDist || 1))
    const alongX = missile.startX + (missile.targetX - missile.startX) * t
    const alongY = missile.startY + (missile.targetY - missile.startY) * t
    const fade = Math.sin(t * Math.PI)
    const off = Math.sin(t * (missile.zigFreq || 3) * Math.PI * 2) * 46 * fade
    missile.x = alongX + (missile.perpX || 0) * off
    missile.y = alongY + (missile.perpY || 0) * off
    missile.progress = t
    if (t >= 1) {
      missile.x = missile.targetX
      missile.y = missile.targetY
      missile.alive = false
      return true
    }
    return false
  }

  const dx = missile.targetX - missile.x
  const dy = missile.targetY - missile.y
  const distance = Math.hypot(dx, dy)
  if (distance < 3.5) {
    missile.x = missile.targetX
    missile.y = missile.targetY
    missile.progress = 1
    missile.alive = false
    return true
  }
  const step = Math.min(distance, missile.speed * dt)
  missile.x += (dx / distance) * step
  missile.y += (dy / distance) * step
  missile.traveled = (missile.traveled ?? 0) + step
  missile.progress = missile.totalDist ? missile.traveled / missile.totalDist : 0
  return false
}

function splitMissile(state, missile) {
  const targets = aliveTargets(state)
  if (!targets.length) return 0
  const children = 2 + ((Math.random() * 2) | 0)
  for (let i = 0; i < children; i += 1) {
    const target = targets[(Math.random() * targets.length) | 0]
    const child = makeEnemy(
      ENEMY_TYPES.FAST,
      missile.x,
      missile.y,
      target,
      missile.speed * 1.12,
      ENEMIES.splitChildScore,
    )
    child.splitAt = null
    child.zigzag = false
    child.sfxTimer = voiceInterval(ENEMY_TYPES.FAST)
    state.entities.enemyMissiles.push(child)
    emit(state, 'incoming_fast', missile.x)
  }
  return children
}

function findDefense(state, missile) {
  const list = missile.targetKind === 'silo' ? state.defenses.silos : state.defenses.cities
  return list.find((d) => d.id === missile.targetId) || null
}

function destroyDefense(state, defense, x) {
  defense.alive = false
  if (defense.kind === 'silo') defense.ammo = 0
  state.combo = 0
  state.comboTimer = 0
  emit(state, 'city_hit', x)
  shake(state, 0.28, 8)
  spawnShockwave(state, x, WORLD.groundY - 6, '#fb923c', 110, 0.55)
  spawnParticles(state, x, WORLD.groundY - 10, 14, 90, 0.75, '#f97316', { kind: 'ember', aim: -Math.PI / 2, spread: 1.5 })
  spawnParticles(state, x, WORLD.groundY - 6, 12, 200, 0.42, '#fde68a', { kind: 'streak', aim: -Math.PI / 2, spread: 2.4 })
  addFlash(state, '#fb923c', 0.24, 0.14)
  if (state.craters.length > 14) state.craters.shift()
  state.craters.push({ x, r: 18 + Math.random() * 12, heat: 1 })
}

function impactGround(state, missile) {
  const target = findDefense(state, missile)
  const close = target && Math.hypot(target.x - missile.x, target.y - missile.y) <= ENEMIES.hitRadius
  if (target && target.alive && close) {
    destroyDefense(state, target, missile.x)
    return
  }
  spawnParticles(state, missile.x, missile.y, 8, 60, 0.28, '#94a3b8')
}

function awardIntercept(state, enemy) {
  state.combo += 1
  state.comboTimer = PLAYER.comboWindow
  state.peakCombo = Math.max(state.peakCombo, state.combo)
  const base = enemy.score ?? ENEMIES.scoreByType[enemy.type] ?? 100
  const mult = Math.min(PLAYER.maxComboMult, 1 + (state.combo - 1) * PLAYER.comboBonusPerStack)
  const gained = Math.round(base * mult)
  state.score += gained
  state.enemiesDestroyedThisWave += 1
  noteHighScore(state)
  emit(state, 'intercept', enemy.x)
  popup(state, enemy.x, enemy.y, state.combo > 1 ? `+${gained}  x${state.combo}` : `+${gained}`)
  ghostTrail(state, enemy.trail, '#fde68a')
  spawnShockwave(state, enemy.x, enemy.y, '#fde68a', 42, 0.3)
  spawnParticles(state, enemy.x, enemy.y, 12, 190, 0.34, '#fef08a', { kind: 'streak' })
  shake(state, 0.1, 3.2)
}

function updateExplosions(state, dt) {
  for (const explosion of state.entities.explosions) {
    explosion.radius += explosion.growing ? explosion.growRate * dt : -explosion.shrinkRate * dt
    if (explosion.radius >= explosion.maxRadius) explosion.growing = false
    if (explosion.radius <= 0) explosion.alive = false
  }
}

function resolveInterceptions(state) {
  for (const enemy of state.entities.enemyMissiles) {
    if (!enemy.alive) continue
    for (const blast of state.entities.explosions) {
      if (!blast.alive || blast.radius <= 0) continue
      if (Math.hypot(enemy.x - blast.x, enemy.y - blast.y) <= blast.radius) {
        enemy.alive = false
        awardIntercept(state, enemy)
        break
      }
    }
  }
}

function spawnBomber(state) {
  const fromLeft = Math.random() < 0.5
  state.entities.bombers.push({
    x: fromLeft ? -50 : WORLD.width + 50,
    y: 64 + Math.random() * 150,
    vx: (fromLeft ? 1 : -1) * (108 + state.wave * 7),
    dropsLeft: state.wave >= 6 ? 3 : 2,
    dropTimer: 0.65,
    spin: Math.random() * Math.PI * 2,
    alive: true,
  })
  emit(state, 'ufo_arrive', fromLeft ? 30 : WORLD.width - 30)
}

function updateBombers(state, dt) {
  for (const bomber of state.entities.bombers) {
    if (!bomber.alive) continue
    bomber.x += bomber.vx * dt
    bomber.spin = (bomber.spin || 0) + dt * 2.6
    bomber.dropTimer -= dt
    const onScreen = bomber.x > 30 && bomber.x < WORLD.width - 30
    if (bomber.dropsLeft > 0 && bomber.dropTimer <= 0 && onScreen) {
      const target = pickTarget(state)
      if (target) {
        state.entities.enemyMissiles.push(
          makeEnemy(ENEMY_TYPES.STANDARD, bomber.x, bomber.y + 10, target, speedFor(ENEMY_TYPES.STANDARD, state.wave)),
        )
        const dropped = state.entities.enemyMissiles.at(-1)
        dropped.sfxTimer = voiceInterval(ENEMY_TYPES.STANDARD)
        emit(state, 'ufo_drop', bomber.x)
        emit(state, 'incoming_standard', bomber.x)
        bomber.dropsLeft -= 1
        bomber.dropTimer = 0.78
      }
    }
    if (bomber.x < -90 || bomber.x > WORLD.width + 90) bomber.alive = false

    for (const blast of state.entities.explosions) {
      if (!bomber.alive || !blast.alive || blast.radius <= 0) continue
      if (Math.hypot(bomber.x - blast.x, bomber.y - blast.y) <= blast.radius + 18) {
        bomber.alive = false
        bomber.dropsLeft = 0
        state.score += ENEMIES.bomberScore
        state.combo += 1
        state.comboTimer = PLAYER.comboWindow
        state.peakCombo = Math.max(state.peakCombo, state.combo)
        noteHighScore(state)
        emit(state, 'bomber_down', bomber.x)
        popup(state, bomber.x, bomber.y, `+${ENEMIES.bomberScore}`, '#7dd3fc')
        spawnShockwave(state, bomber.x, bomber.y, '#7dd3fc', 80, 0.45)
        spawnParticles(state, bomber.x, bomber.y, 18, 240, 0.5, '#e0f2fe', { kind: 'streak' })
        spawnParticles(state, bomber.x, bomber.y, 10, 80, 0.7, '#fb923c', { kind: 'ember' })
        addFlash(state, '#e0f2fe', 0.16, 0.1)
        shake(state, 0.2, 6)
        break
      }
    }
  }
}

function updateParticles(state, dt) {
  for (const p of state.entities.particles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    const drag = p.kind === 'streak' ? 2.2 : 0.7
    const keep = Math.max(0, 1 - drag * dt)
    p.vx *= keep
    p.vy *= keep
    if (p.kind !== 'streak') p.vy += 40 * dt
    if (p.kind === 'ember') p.vy += 80 * dt
    p.life -= dt
    if (p.life <= 0) p.alive = false
  }
}

function updateShockwaves(state, dt) {
  for (const wave of state.entities.shockwaves || []) {
    const grow = wave.maxRadius / Math.max(0.05, wave.maxLife)
    wave.radius += grow * dt
    wave.life -= dt
    if (wave.life <= 0) wave.alive = false
  }
}

function updateFx(state, dt) {
  updateParticles(state, dt)
  updateShockwaves(state, dt)
  for (const image of state.entities.afterimages || []) {
    image.life -= dt
    if (image.life <= 0) image.alive = false
  }
  if (state.flash) {
    state.flash.life -= dt
    if (state.flash.life <= 0) state.flash = null
  }
  for (const crater of state.craters || []) {
    if (crater.heat > 0) crater.heat = Math.max(0, crater.heat - dt * 0.4)
  }
}

function updatePopups(state, dt) {
  for (const p of state.scorePopups) {
    p.y += p.vy * dt
    p.life -= dt
  }
  if (state.scorePopups.some((p) => p.life <= 0)) {
    state.scorePopups = state.scorePopups.filter((p) => p.life > 0)
  }
}

function retireDead(state) {
  for (const key of ['enemyMissiles', 'playerMissiles', 'explosions', 'particles', 'shockwaves', 'afterimages', 'bombers']) {
    if (state.entities[key]) {
      state.entities[key] = state.entities[key].filter((entity) => entity.alive)
    }
  }
}

function decayShake(state, dt) {
  if (state.camera.shakeTime > 0) {
    state.camera.shakeTime = Math.max(0, state.camera.shakeTime - dt)
    state.camera.shakeMag = Math.max(0, state.camera.shakeMag - dt * 22)
  }
}

function startWave(state) {
  state.waveMissilesRemaining = ENEMIES.waveBaseCount + state.wave * ENEMIES.waveCountPerLevel
  state.enemiesDestroyedThisWave = 0
  state.shotsFiredThisWave = 0
  state.waveBonusLast = 0
  state.peakCombo = 0
  state.timers.enemySpawn = 0.4
  state.waveArmed = true
  state.bomberDue = state.wave >= ENEMIES.bomberFirstWave && state.wave % 2 === 1
  state.bomberSpawnedThisWave = !state.bomberDue
}

function spawnFireworkBurst(state) {
  const x = 120 + Math.random() * (WORLD.width - 240)
  const y = 80 + Math.random() * (WORLD.groundY * 0.38)
  const palette = ['#fde047', '#f472b6', '#60a5fa', '#34d399', '#fb7185']
  const color = palette[(Math.random() * palette.length) | 0]
  const accent = palette[(Math.random() * palette.length) | 0]
  spawnParticles(state, x, y, 20, 260, 0.95, color, { kind: 'streak' })
  spawnParticles(state, x, y, 10, 90, 1.15, accent, { kind: 'ember' })
  spawnShockwave(state, x, y, color, 78, 0.6)
  emit(state, 'firework', x)
}

function tickFireworks(state, dt) {
  state.timers.firework = (state.timers.firework ?? 0) - dt
  if (state.timers.firework <= 0) {
    spawnFireworkBurst(state)
    state.timers.firework = 0.42 + Math.random() * 0.28
  }
}

const ROCKET_BONUS = 12
const ROCKET_TICK = 0.25

function countRocketBonus(state, all = false) {
  const silo = state.defenses.silos.find((s) => s.alive && s.ammo > 0)
  if (!silo) return false
  const count = all ? silo.ammo : 1
  silo.ammo -= count
  state.score += count * state.rocketBonus.pointsPerRocket
  state.waveBonusLast += count * state.rocketBonus.pointsPerRocket
  state.rocketBonus.counted += count
  noteHighScore(state)
  return true
}

function beginWaveClear(state) {
  const ammoLeft = state.defenses.silos.reduce((n, s) => n + (s.alive ? Math.max(0, s.ammo) : 0), 0)
  const bonus = aliveCities(state).length * 250 + state.peakCombo * 20
  state.rocketBonus = { total: ammoLeft, counted: 0, elapsed: 0, pointsPerRocket: ROCKET_BONUS * (1 + Math.floor((state.wave - 1) / 3)) }
  state.waveBonusLast = bonus
  state.score += bonus
  noteHighScore(state)
  state.mode = GAME_STATES.WAVE_CLEAR
  emit(state, 'wave_clear')
  state.camera.shakeTime = 0
  state.camera.shakeMag = 0
  state.timers.firework = 0
  state.timers.waveCooldown = 3.4 + ammoLeft * ROCKET_TICK
  if (!state.settings.reducedMotion) {
    for (let i = 0; i < 3; i += 1) spawnFireworkBurst(state)
  }
}

function endGame(state) {
  if (state.mode === GAME_STATES.GAME_OVER || state.mode === GAME_STATES.ENTER_INITIALS) return
  emit(state, 'game_over')
  if (state.score > state.highScore) {
    state.highScore = state.score
    try {
      localStorage.setItem('mc_high_score', String(state.highScore))
    } catch {
      // ignore
    }
  }
  if (qualifiesForBoard(state)) {
    beginInitials(state)
    return
  }
  state.mode = GAME_STATES.GAME_OVER
}

function updateAim(state, input, dt) {
  const keys = input.keys || EMPTY_KEYS
  if (!state.ui?.settingsOpen && state.mode !== GAME_STATES.ENTER_INITIALS && state.mode !== GAME_STATES.MENU && keys.size) {
    let kx = 0
    let ky = 0
    if (keys.has('ArrowLeft') || keys.has('KeyA')) kx -= 1
    if (keys.has('ArrowRight') || keys.has('KeyD')) kx += 1
    if (keys.has('ArrowUp') || keys.has('KeyW')) ky -= 1
    if (keys.has('ArrowDown') || keys.has('KeyS')) ky += 1
    if (kx || ky) {
      const len = Math.hypot(kx, ky) || 1
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 280 : 680
      input.pointer.x += (kx / len) * speed * dt
      input.pointer.y += (ky / len) * speed * dt
      input.pointer.active = true
    }
  }
  input.pointer.x = clamp(input.pointer.x ?? WORLD.width / 2, 0, WORLD.width)
  input.pointer.y = clamp(input.pointer.y ?? 260, 0, WORLD.height)
  const silo = pickBestSilo(state, input.pointer.x)
  state.aim.x = input.pointer.x
  state.aim.y = input.pointer.y
  state.aim.siloId = silo ? silo.id : null
  state.aim.hasAmmo = Boolean(silo)
}

function refreshThreats(state) {
  state.threatened = state.entities.enemyMissiles
    .filter((m) => m.alive && m.type !== ENEMY_TYPES.DECOY && m.targetId != null)
    .filter((m) => {
      const dy = m.targetY - m.y
      return dy > 0 && dy < 155
    })
    .map((m) => `${m.targetKind}:${m.targetId}`)
}

export function update(state, input, dt) {
  state.events.length = 0
  if (state.mode === GAME_STATES.MENU) {
    const dwell = state.settings.reducedMotion ? 8 : 4.5
    state.attractTimer = (state.attractTimer ?? dwell) - dt
    if (state.attractTimer <= 0) {
      state.attractIndex = ((state.attractIndex || 0) + 1) % 3
      state.attractTimer = dwell
    }
  }
  if (state.dryTimer > 0) state.dryTimer = Math.max(0, state.dryTimer - dt)
  updateAim(state, input, dt)

  if (!state.waveArmed && (state.mode === GAME_STATES.MENU || state.mode === GAME_STATES.PLAYING)) {
    startWave(state)
  }

  if (state.mode === GAME_STATES.WAVE_CLEAR) {
    if (!state.settings.reducedMotion) tickFireworks(state, dt)
    const skip = state.timers.waveCooldown <= 0
    state.rocketBonus.elapsed += dt
    while (state.rocketBonus.elapsed >= ROCKET_TICK && state.rocketBonus.counted < state.rocketBonus.total) {
      state.rocketBonus.elapsed -= ROCKET_TICK
      if (!countRocketBonus(state)) break
    }
    state.timers.waveCooldown -= dt
    if (skip || state.timers.waveCooldown <= 0) {
      while (countRocketBonus(state, true)) { /* settle the remainder before continuing */ }
      for (const silo of state.defenses.silos) {
        if (silo.alive) silo.ammo = PLAYER.siloAmmo
      }
      state.wave += 1
      state.mode = GAME_STATES.PLAYING
      startWave(state)
    }
  }

  if (state.mode !== GAME_STATES.PLAYING) {
    if (state.mode === GAME_STATES.WAVE_CLEAR) {
      updateFx(state, dt)
      updatePopups(state, dt)
      retireDead(state)
    }
    decayShake(state, dt)
    return
  }

  if (aliveCities(state).length === 0) {
    endGame(state)
    return
  }

  if (state.hintTimer > 0) state.hintTimer -= dt
  if (state.combo > 0) {
    state.comboTimer -= dt
    if (state.comboTimer <= 0) {
      state.combo = 0
      state.comboTimer = 0
    }
  }

  if (state.bomberDue && !state.bomberSpawnedThisWave) {
    spawnBomber(state)
    state.bomberSpawnedThisWave = true
  }

  state.timers.enemySpawn -= dt
  const spawnInterval = Math.max(
    ENEMIES.minSpawnInterval,
    ENEMIES.baseSpawnInterval - state.wave * ENEMIES.spawnIntervalStep,
  )
  if (
    state.waveMissilesRemaining > 0
    && state.timers.enemySpawn <= 0
    && state.entities.enemyMissiles.length < ENEMIES.maxOnScreen
  ) {
    if (spawnEnemy(state)) state.timers.enemySpawn = spawnInterval
  } else if (state.timers.enemySpawn <= 0) {
    state.timers.enemySpawn = 0.15
  }

  state.timers.fireCooldown = Math.max(0, (state.timers.fireCooldown || 0) - dt)
  if (input.fireRequested && state.timers.fireCooldown <= 0) {
    input.fireRequested = false
    if (launchPlayerMissile(state, input.pointer.x, input.pointer.y)) {
      state.timers.fireCooldown = PLAYER.fireCooldown
    } else {
      state.dryTimer = 0.55
      emit(state, 'dry_fire')
    }
  }

  const missiles = state.entities.enemyMissiles
  for (let i = 0; i < missiles.length; i += 1) {
    const missile = missiles[i]
    if (!missile.alive) continue
    const reached = updateMissile(missile, dt)
    if (missile.type === ENEMY_TYPES.DECOY && (reached || missile.progress >= 0.68)) {
      missile.alive = false
      emit(state, 'fizzle', missile.x)
      spawnParticles(state, missile.x, missile.y, 8, 50, 0.3, '#cbd5e1', { kind: 'spark' })
      continue
    }
    if (
      missile.alive
      && missile.type === ENEMY_TYPES.SPLIT
      && missile.splitAt != null
      && missile.progress >= missile.splitAt
    ) {
      splitMissile(state, missile)
      emit(state, 'enemy_split', missile.x)
      spawnShockwave(state, missile.x, missile.y, '#e879f9', 34, 0.28)
      spawnParticles(state, missile.x, missile.y, 10, 140, 0.3, '#e879f9', { kind: 'streak' })
      missile.alive = false
      continue
    }
    if (reached) {
      impactGround(state, missile)
      missile.alive = false
    }
  }

  for (const missile of state.entities.playerMissiles) {
    if (!missile.alive) continue
    if (updateMissile(missile, dt)) detonate(state, missile)
  }

  updateExplosions(state, dt)
  resolveInterceptions(state)
  updateBombers(state, dt)
  tickIncomingSounds(state, dt)
  refreshThreats(state)
  updateFx(state, dt)
  updatePopups(state, dt)
  decayShake(state, dt)

  if (aliveCities(state).length === 0) {
    endGame(state)
    retireDead(state)
    return
  }

  const inboundDone = state.waveMissilesRemaining <= 0
    && state.entities.enemyMissiles.every((m) => !m.alive)
    && state.entities.bombers.every((b) => !b.alive)
    && state.bomberSpawnedThisWave
  if (inboundDone) beginWaveClear(state)
  retireDead(state)
}
