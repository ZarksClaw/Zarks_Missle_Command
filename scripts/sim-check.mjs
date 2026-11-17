const store = new Map()
globalThis.localStorage = {
  getItem(key) {
    return store.has(key) ? store.get(key) : null
  },
  setItem(key, value) {
    store.set(key, String(value))
  },
  removeItem(key) {
    store.delete(key)
  },
}

const game = new URL('../src/game/', import.meta.url)
const { createInitialState, resetForNewGame, confirmInitials, setInitialChar, readLeaderboard } = await import(new URL('state.js', game))
const { update } = await import(new URL('update.js', game))
await import(new URL('render.js', game))
await import(new URL('audio.js', game))
await import(new URL('input.js', game))
await import(new URL('loop.js', game))

const failures = []
function check(cond, msg) {
  if (cond) console.log('OK', msg)
  else {
    console.error('FAIL', msg)
    failures.push(msg)
  }
}

function idleInput(x = 400, y = 200) {
  return { pointer: { x, y, active: true }, fireRequested: false, keys: new Set() }
}

function playingState() {
  const state = createInitialState()
  state.mode = 'PLAYING'
  state.waveArmed = true
  state.bomberDue = false
  state.bomberSpawnedThisWave = true
  state.waveMissilesRemaining = 6
  state.timers.enemySpawn = 99
  state.timers.fireCooldown = 0
  return state
}

function missile(overrides) {
  return {
    type: 'standard',
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
    targetX: 0,
    targetY: 0,
    targetId: null,
    targetKind: 'city',
    speed: 10,
    alive: true,
    splitAt: null,
    progress: 0,
    traveled: 0,
    totalDist: 100,
    perpX: 1,
    perpY: 0,
    zigFreq: 3,
    zigzag: false,
    trail: [],
    trailMax: 8,
    ...overrides,
  }
}

const layout = createInitialState()
const marks = [
  ...layout.defenses.silos.map((s) => ({ x: s.x, kind: 'silo' })),
  ...layout.defenses.cities.map((c) => ({ x: c.x, kind: 'city' })),
].sort((a, b) => a.x - b.x)
check(layout.defenses.cities.length === 6 && layout.defenses.silos.length === 3, 'six cities and three batteries')
check(marks.map((m) => m.kind).join(',') === 'silo,city,city,city,silo,city,city,city,silo', `classic layout ${marks.map((m) => m.kind).join(',')}`)
let gap = Infinity
for (let i = 1; i < marks.length; i += 1) gap = Math.min(gap, marks[i].x - marks[i - 1].x)
check(gap > 100, `defense separation ${gap.toFixed(1)}`)
check(marks[0].x > 70 && marks.at(-1).x < WORLD_EDGE(), `field bounds ${marks[0].x.toFixed(1)}..${marks.at(-1).x.toFixed(1)}`)

function WORLD_EDGE() {
  return 1210
}

const far = playingState()
const farCity = far.defenses.cities[0]
far.entities.enemyMissiles.push(missile({
  x: farCity.x + 80,
  y: farCity.y,
  targetX: farCity.x + 80,
  targetY: farCity.y,
  targetId: farCity.id,
  targetKind: 'city',
}))
update(far, idleInput(), 1 / 60)
check(farCity.alive, 'impact outside the hit radius misses')

const direct = playingState()
const victim = direct.defenses.cities[2]
const neighbor = direct.defenses.cities[1]
direct.entities.enemyMissiles.push(missile({
  x: victim.x,
  y: victim.y,
  targetX: victim.x,
  targetY: victim.y,
  targetId: victim.id,
  targetKind: 'city',
}))
update(direct, idleInput(), 1 / 60)
check(!victim.alive, 'locked target is destroyed')
check(neighbor.alive, 'neighbor survives a locked hit')

const decoy = playingState()
const decoyCity = decoy.defenses.cities[1]
decoy.entities.enemyMissiles.push(missile({
  type: 'decoy',
  x: decoyCity.x,
  y: decoyCity.y,
  targetX: decoyCity.x,
  targetY: decoyCity.y,
  targetId: decoyCity.id,
}))
update(decoy, idleInput(), 1 / 60)
check(decoyCity.alive, 'decoy does not destroy a city')
check(decoy.entities.enemyMissiles.length === 0, 'decoy is removed')

const combo = playingState()
combo.entities.explosions.push({
  x: 200, y: 200, radius: 40, maxRadius: 80, growRate: 0, shrinkRate: 0, growing: true, alive: true,
})
combo.entities.enemyMissiles.push(missile({
  x: 200, y: 180, targetX: 200, targetY: 640, speed: 1, totalDist: 500,
}))
update(combo, idleInput(), 1 / 60)
const firstGain = combo.score
combo.entities.explosions.push({
  x: 520, y: 200, radius: 40, maxRadius: 80, growRate: 0, shrinkRate: 0, growing: true, alive: true,
})
combo.entities.enemyMissiles.push(missile({
  x: 520, y: 180, targetX: 520, targetY: 640, speed: 1, totalDist: 500,
}))
update(combo, idleInput(), 1 / 60)
check(firstGain === 100, `first intercept scores 100 (got ${firstGain})`)
check(combo.score - firstGain === 125, `second intercept scores 125 (got ${combo.score - firstGain})`)
check(combo.combo === 2, `combo stacked to ${combo.combo}`)

const split = playingState()
const splitCity = split.defenses.cities[0]
split.entities.enemyMissiles.push(missile({
  type: 'split',
  x: 100,
  y: 0,
  startX: 100,
  startY: 0,
  targetX: 100,
  targetY: 500,
  targetId: splitCity.id,
  speed: 250,
  splitAt: 0.5,
  totalDist: 500,
}))
update(split, idleInput(), 0.5)
check(split.entities.enemyMissiles.some((m) => m.type === 'split' && m.alive), 'split waits until mid-path')
update(split, idleInput(), 0.6)
const children = split.entities.enemyMissiles.filter((m) => m.alive && m.type === 'fast')
check(!split.entities.enemyMissiles.some((m) => m.type === 'split' && m.alive), 'parent is consumed by the split')
check(children.length >= 2 && children.length <= 3, `split releases 2-3 children (got ${children.length})`)
check(split.defenses.cities.every((c) => c.alive), 'split itself does not level a city')

const weave = playingState()
const weaveCity = weave.defenses.cities[3]
const totalDist = 480
weave.entities.enemyMissiles.push(missile({
  type: 'zigzag',
  zigzag: true,
  x: weaveCity.x,
  y: weaveCity.y - totalDist,
  startX: weaveCity.x,
  startY: weaveCity.y - totalDist,
  targetX: weaveCity.x,
  targetY: weaveCity.y,
  targetId: weaveCity.id,
  speed: 240,
  totalDist,
  perpX: 1,
  perpY: 0,
}))
const weaveInput = idleInput()
for (let i = 0; i < 140; i += 1) update(weave, weaveInput, 1 / 60)
check(!weaveCity.alive, 'zigzag still arrives on its locked city')

const over = playingState()
over.score = 500
over.waveMissilesRemaining = 0
for (const city of over.defenses.cities) city.alive = false
over.defenses.cities[0].alive = true
const last = over.defenses.cities[0]
over.entities.enemyMissiles.push(missile({
  x: last.x,
  y: last.y,
  targetX: last.x,
  targetY: last.y,
  targetId: last.id,
}))
update(over, idleInput(), 1 / 60)
check(over.mode === 'ENTER_INITIALS', `a top score asks for initials (got ${over.mode})`)
check(over.wave === 1, 'wave does not advance on game over')
check(JSON.parse(localStorage.getItem('mc_leaderboard') || '[]').length === 0, 'board waits for initials')
over.initials = ['R', 'D', 'K']
confirmInitials(over)
const board = JSON.parse(localStorage.getItem('mc_leaderboard') || '[]')
check(board[0]?.initials === 'RDK' && board[0]?.score === 500, `initials are stored (${JSON.stringify(board[0])})`)
check(over.mode === 'MENU', 'saving initials returns to the attract mode')
const beforeReset = board.length
resetForNewGame(over)
const afterReset = JSON.parse(localStorage.getItem('mc_leaderboard') || '[]').length
check(afterReset === beforeReset, 'restart does not duplicate the board entry')
check(over.defenses.cities.every((c) => c.alive), 'restart restores cities')

const typed = createInitialState()
typed.score = 40
typed.mode = 'ENTER_INITIALS'
typed.initials = ['A', 'A', 'A']
typed.initialCursor = 0
typed.runCommitted = false
check(setInitialChar(typed, 'z') === true, 'letter is accepted')
check(setInitialChar(typed, '!') === false, 'punctuation is rejected')
setInitialChar(typed, '9')
check(typed.initials.join('') === 'Z9A' && typed.mode === 'ENTER_INITIALS', 'third slot is still open')
setInitialChar(typed, 'k')
check(typed.mode === 'MENU' && typed.leaderboard.some((entry) => entry.initials === 'Z9K' && entry.score === 40), 'third character saves the tag')

localStorage.setItem('mc_leaderboard', JSON.stringify([80]))
const migrated = readLeaderboard()
check(migrated[0].initials === '---' && migrated[0].score === 80, 'old numeric scores still load')

const attract = createInitialState()
attract.mode = 'MENU'
attract.waveArmed = true
attract.attractIndex = 0
attract.attractTimer = 0.01
update(attract, idleInput(), 1 / 60)
check(attract.attractIndex === 1, `attract screen rotates (got ${attract.attractIndex})`)

const prefs = playingState()
prefs.settings.colorblind = true
prefs.settings.masterVolume = 0.2
prefs.score = 0
resetForNewGame(prefs)
check(prefs.settings.colorblind === true && prefs.settings.masterVolume === 0.2, 'restart keeps settings')
check(prefs.mode === 'PLAYING', 'restart returns to play')

const shot = playingState()
const aimCity = shot.defenses.cities[0]
const shotInput = idleInput(aimCity.x, 180)
shotInput.fireRequested = true
const beforeAmmo = shot.defenses.silos.map((s) => s.ammo)
update(shot, shotInput, 1 / 60)
const used = shot.defenses.silos.findIndex((s, i) => s.ammo < beforeAmmo[i])
check(used === 0, `nearest battery fires (got ${used})`)
check(shot.entities.playerMissiles.length === 1, 'one player missile per shot')

const dry = playingState()
for (const silo of dry.defenses.silos) silo.ammo = 0
const dryInput = idleInput()
dryInput.fireRequested = true
update(dry, dryInput, 1 / 60)
check(dry.entities.playerMissiles.length === 0, 'empty batteries do not fire')
check(dry.events.some((ev) => ev === 'dry_fire' || ev?.type === 'dry_fire'), 'empty batteries report dry fire')

const voiced = playingState()
voiced.entities.enemyMissiles.push(missile({
  type: 'fast',
  x: 300,
  y: 220,
  targetX: 300,
  targetY: 640,
  speed: 8,
  sfxTimer: 0,
}))
voiced.entities.enemyMissiles.push(missile({
  type: 'zigzag',
  zigzag: true,
  x: 500,
  y: 180,
  targetX: 500,
  targetY: 640,
  speed: 8,
  sfxTimer: 0,
}))
update(voiced, idleInput(), 1 / 60)
const names = voiced.events.map((ev) => ev?.type || ev)
check(names.includes('incoming_fast'), `fast rocket has its own call (${names.join(',')})`)
check(names.includes('incoming_zigzag'), `weaving rocket has its own call (${names.join(',')})`)

const saucer = playingState()
saucer.wave = 3
saucer.bomberDue = true
saucer.bomberSpawnedThisWave = false
update(saucer, idleInput(), 1 / 60)
check(saucer.entities.bombers.length === 1, 'saucer enters on a due wave')
check(saucer.events.some((ev) => (ev?.type || ev) === 'ufo_arrive'), 'saucer announces itself')


const clear = playingState()
clear.waveMissilesRemaining = 0
clear.defenses.silos[0].ammo = 2
clear.defenses.silos[1].ammo = 1
clear.defenses.silos[2].ammo = 7
clear.defenses.silos[2].alive = false
clear.peakCombo = 2
update(clear, idleInput(), 1 / 60)
check(clear.mode === 'WAVE_CLEAR' && clear.score === 1540, 'wave clear initially awards city and combo bonuses only')
check(clear.defenses.silos[0].ammo === 2 && clear.defenses.silos[1].ammo === 1, 'unused rockets remain visible before countdown')
update(clear, idleInput(), 0.25)
check(clear.score === 1552 && clear.defenses.silos[0].ammo === 1, 'first rocket counts down for 12 points')
update(clear, idleInput(), 0.25)
check(clear.score === 1564 && clear.defenses.silos[0].ammo === 0, 'second rocket counts down sequentially')
update(clear, idleInput(), 0.25)
check(clear.score === 1576 && clear.defenses.silos[1].ammo === 0 && clear.waveBonusLast === 1576, 'remaining live battery rocket is counted once')
clear.timers.waveCooldown = 0
update(clear, idleInput(), 1 / 60)
check(clear.wave === 2 && clear.score === 1576 && clear.defenses.silos[0].ammo === 10, 'continuing reloads without double award')
const skip = playingState()
skip.waveMissilesRemaining = 0
skip.defenses.silos.forEach((s, i) => { s.ammo = i === 0 ? 3 : 0 })
update(skip, idleInput(), 1 / 60)
skip.timers.waveCooldown = 0
update(skip, idleInput(), 1 / 60)
check(skip.wave === 2 && skip.score === 1536, 'early continue awards all remaining rockets exactly once')
const noAmmo = playingState()
noAmmo.waveMissilesRemaining = 0
noAmmo.defenses.silos.forEach((s) => { s.ammo = 0 })
noAmmo.settings.reducedMotion = true
update(noAmmo, idleInput(), 1 / 60)
noAmmo.timers.waveCooldown = 0
update(noAmmo, idleInput(), 1 / 60)
check(noAmmo.score === 1500 && noAmmo.wave === 2, 'zero ammo and reduced motion progress without extra points')

const reduced = playingState()
reduced.waveMissilesRemaining = 0
reduced.settings.reducedMotion = true
reduced.defenses.silos.forEach((s, i) => { s.ammo = i === 0 ? 2 : 0 })
update(reduced, idleInput(), 1 / 60)
update(reduced, idleInput(), 0.25)
check(reduced.score === 1512 && reduced.defenses.silos[0].ammo === 1, 'reduced motion preserves sequential scoring')
update(reduced, idleInput(), 10)
check(reduced.wave === 2 && reduced.score === 1524 && reduced.highScore >= reduced.score, 'large timestep settles remainder and updates high score')
update(reduced, idleInput(), 1 / 60)
check(reduced.score === 1524, 'subsequent wave does not award the bonus again')

for (const [wave, value] of [[1, 12], [3, 12], [4, 24], [6, 24], [7, 36]]) {
  const tier = playingState()
  tier.wave = wave
  tier.waveMissilesRemaining = 0
  tier.defenses.silos.forEach((s, i) => { s.ammo = i === 0 ? 2 : 0 })
  update(tier, idleInput(), 1 / 60)
  update(tier, idleInput(), 0.25)
  check(tier.score === 1500 + value && tier.rocketBonus.pointsPerRocket === value, `wave ${wave} awards ${value} per rocket`)
  tier.timers.waveCooldown = 0
  update(tier, idleInput(), 1 / 60)
  check(tier.score === 1500 + 2 * value, `wave ${wave} early continue settles at tier rate`)
}

if (failures.length) {
  console.error(`${failures.length} failed`)
  process.exit(1)
}
console.log('all checks passed')
