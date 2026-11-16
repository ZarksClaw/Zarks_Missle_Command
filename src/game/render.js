import { GAME_STATES, PLAYER, WORLD } from './constants.js'

const STARS = Array.from({ length: 96 }, (_, i) => ({
  x: (i * 97.3) % WORLD.width,
  y: 14 + ((i * 53.7) % (WORLD.groundY - 36)),
  r: i % 6 === 0 ? 1.7 : 1.05,
  phase: i * 0.77,
}))

function enemyColor(type, colorblind) {
  const palette = colorblind
    ? { standard: '#f59e0b', fast: '#38bdf8', split: '#facc15', zigzag: '#a3e635', decoy: '#cbd5e1' }
    : { standard: '#fb7185', fast: '#fb923c', split: '#e879f9', zigzag: '#facc15', decoy: '#94a3b8' }
  return palette[type] || palette.standard
}

function playerColor(colorblind, retro) {
  if (retro) return '#f8fafc'
  return colorblind ? '#e0f2fe' : '#38bdf8'
}

function drawBackdrop(ctx, colorblind, retro) {
  if (retro) {
    ctx.fillStyle = '#03110a'
    ctx.fillRect(0, 0, WORLD.width, WORLD.height)
    return
  }
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.height)
  if (colorblind) {
    g.addColorStop(0, '#0b1220')
    g.addColorStop(0.55, '#152033')
    g.addColorStop(1, '#1e293b')
  } else {
    g.addColorStop(0, '#020617')
    g.addColorStop(0.42, '#0f172a')
    g.addColorStop(0.78, '#1e1b4b')
    g.addColorStop(1, '#312e81')
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, WORLD.width, WORLD.height)
}

function drawStarfield(ctx, reduced, retro, time) {
  for (const star of STARS) {
    const alpha = reduced || retro ? 0.55 : 0.35 + (Math.sin(time * 1.4 + star.phase) + 1) * 0.22
    ctx.globalAlpha = alpha
    ctx.fillStyle = retro ? '#86efac' : '#e2e8f0'
    ctx.fillRect(star.x, star.y, star.r, star.r)
  }
  ctx.globalAlpha = 1
}

function drawHorizon(ctx, colorblind, retro) {
  if (retro) return
  const glow = ctx.createLinearGradient(0, WORLD.groundY - 90, 0, WORLD.groundY + 8)
  glow.addColorStop(0, 'rgba(34, 211, 238, 0)')
  glow.addColorStop(1, colorblind ? 'rgba(56, 189, 248, 0.16)' : 'rgba(34, 211, 238, 0.28)')
  ctx.fillStyle = glow
  ctx.fillRect(0, WORLD.groundY - 90, WORLD.width, 98)
}

function drawGround(ctx, state, colorblind, retro) {
  if (retro) {
    ctx.fillStyle = '#022c22'
    ctx.fillRect(0, WORLD.groundY, WORLD.width, WORLD.height - WORLD.groundY)
    ctx.strokeStyle = '#4ade80'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, WORLD.groundY)
    ctx.lineTo(WORLD.width, WORLD.groundY)
    ctx.stroke()
  } else {
    const g = ctx.createLinearGradient(0, WORLD.groundY, 0, WORLD.height)
    g.addColorStop(0, colorblind ? '#1e293b' : '#0f172a')
    g.addColorStop(1, '#020617')
    ctx.fillStyle = g
    ctx.fillRect(0, WORLD.groundY, WORLD.width, WORLD.height - WORLD.groundY)
    ctx.strokeStyle = colorblind ? '#67e8f9' : '#22d3ee'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, WORLD.groundY)
    ctx.lineTo(WORLD.width, WORLD.groundY)
    ctx.stroke()
  }

  ctx.fillStyle = retro ? 'rgba(21, 128, 61, 0.45)' : 'rgba(15, 23, 42, 0.85)'
  for (const crater of state.craters || []) {
    if (crater.heat > 0 && !retro) {
      ctx.fillStyle = `rgba(251, 146, 60, ${0.55 * crater.heat})`
      ctx.beginPath()
      ctx.ellipse(crater.x, WORLD.groundY + 2, crater.r * 1.2, crater.r * 0.42, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = retro ? 'rgba(21, 128, 61, 0.45)' : 'rgba(2, 6, 23, 0.9)'
    ctx.beginPath()
    ctx.ellipse(crater.x, WORLD.groundY + 3, crater.r, crater.r * 0.32, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function isThreatened(state, defense) {
  return state.threatened?.includes(`${defense.kind}:${defense.id}`)
}

function drawCity(ctx, city, retro, threatened, time, reduced) {
  const x = city.x
  const y = city.y
  if (!city.alive) {
    ctx.fillStyle = retro ? '#14532d' : '#334155'
    ctx.fillRect(x - 18, y - 6, 36, 6)
    ctx.fillRect(x - 8, y - 12, 6, 6)
    ctx.fillRect(x + 4, y - 9, 5, 3)
    return
  }

  ctx.fillStyle = retro ? '#22c55e' : '#84cc16'
  ctx.fillRect(x - 20, y - 12, 40, 12)
  ctx.fillStyle = retro ? '#4ade80' : '#a3e635'
  ctx.fillRect(x - 16, y - 22, 9, 10)
  ctx.fillRect(x - 4, y - 28, 10, 16)
  ctx.fillRect(x + 8, y - 20, 8, 8)
  ctx.fillStyle = retro ? '#052e16' : '#ecfccb'
  ctx.fillRect(x - 2, y - 22, 3, 4)
  ctx.fillRect(x + 10, y - 16, 3, 3)

  if (threatened) {
    const alpha = reduced ? 0.7 : 0.4 + Math.sin(time * 8) * 0.3
    ctx.strokeStyle = `rgba(248, 113, 113, ${alpha})`
    ctx.lineWidth = 2
    ctx.strokeRect(x - 24, y - 32, 48, 34)
  }
}

function drawSilo(ctx, silo, state, retro, threatened, time, reduced) {
  const selected = state.mode === GAME_STATES.PLAYING && state.aim?.siloId === silo.id
  const body = !silo.alive
    ? (retro ? '#14532d' : '#475569')
    : (retro ? '#4ade80' : '#0284c7')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(silo.x - 16, silo.y)
  ctx.lineTo(silo.x - 9, silo.y - 16)
  ctx.lineTo(silo.x + 9, silo.y - 16)
  ctx.lineTo(silo.x + 16, silo.y)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.arc(silo.x, silo.y - 16, 7, Math.PI, 0)
  ctx.fill()

  if (selected) {
    ctx.strokeStyle = state.aim.hasAmmo ? '#e0f2fe' : '#fca5a5'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(silo.x, silo.y - 10, 18, 0, Math.PI * 2)
    ctx.stroke()
  }
  if (threatened && silo.alive) {
    const alpha = reduced ? 0.7 : 0.4 + Math.sin(time * 8) * 0.3
    ctx.strokeStyle = `rgba(248, 113, 113, ${alpha})`
    ctx.lineWidth = 2
    ctx.strokeRect(silo.x - 20, silo.y - 28, 40, 30)
  }

  if (!silo.alive) return
  ctx.font = '600 13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = silo.ammo === 0 ? '#f87171' : silo.ammo <= 3 ? '#fbbf24' : '#f8fafc'
  ctx.fillText(String(silo.ammo), silo.x, silo.y + 18)
  ctx.textAlign = 'left'
}

function drawDefenses(ctx, state, retro, time) {
  const reduced = state.settings.reducedMotion
  for (const city of state.defenses.cities) {
    drawCity(ctx, city, retro, isThreatened(state, city), time, reduced)
  }
  for (const silo of state.defenses.silos) {
    drawSilo(ctx, silo, state, retro, isThreatened(state, silo), time, reduced)
  }
}

function drawTrail(ctx, missile, color) {
  const trail = missile.trail
  if (!trail || trail.length < 2) return
  const tail = trail[0]
  const head = trail[trail.length - 1]
  if (Math.hypot(head.x - tail.x, head.y - tail.y) < 1) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(tail.x, tail.y)
  for (let i = 1; i < trail.length; i += 1) ctx.lineTo(trail[i].x, trail[i].y)
  if (missile.type !== 'decoy') {
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.22
    ctx.lineWidth = missile.type === 'fast' ? 4 : 6
    ctx.stroke()
  }
  const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.55, color)
  grad.addColorStop(1, '#ffffff')
  ctx.strokeStyle = grad
  ctx.globalAlpha = missile.type === 'decoy' ? 0.35 : 0.95
  ctx.lineWidth = missile.type === 'decoy' ? 1.1 : missile.type === 'fast' ? 1.5 : 2.2
  ctx.stroke()
  ctx.restore()
}

function drawHead(ctx, missile, color, isEnemy, time) {
  if (isEnemy && missile.type === 'decoy') {
    const pulse = 0.65 + Math.sin(time * 7) * 0.2
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.85
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(missile.x, missile.y, 5.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = pulse * 0.45
    ctx.beginPath()
    ctx.arc(missile.x, missile.y, 9, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    return
  }
  ctx.save()
  ctx.globalAlpha = 0.38
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(missile.x, missile.y, isEnemy ? 6 : 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const angle = Math.atan2(missile.targetY - missile.y, missile.targetX - missile.x)
  const len = isEnemy && missile.type === 'fast' ? 13 : 10
  const wing = isEnemy && missile.type === 'split' ? 5.4 : 3.6
  ctx.save()
  ctx.translate(missile.x, missile.y)
  ctx.rotate(angle)
  ctx.fillStyle = color
  ctx.beginPath()
  if (isEnemy && missile.type === 'split') {
    ctx.moveTo(5, 0)
    ctx.lineTo(0, wing)
    ctx.lineTo(-len, 0)
    ctx.lineTo(0, -wing)
  } else if (isEnemy && missile.type === 'zigzag') {
    ctx.moveTo(4, 0)
    ctx.lineTo(-2, wing + 1)
    ctx.lineTo(-len, 0)
    ctx.lineTo(-2, -(wing + 1))
  } else {
    ctx.moveTo(5, 0)
    ctx.lineTo(-len, wing)
    ctx.lineTo(-len * 0.55, 0)
    ctx.lineTo(-len, -wing)
  }
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.arc(2.2, 0, 1.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawMissiles(ctx, missiles, colorFor, isEnemy, time) {
  for (const missile of missiles) {
    const color = colorFor(missile)
    drawTrail(ctx, missile, color)
    drawHead(ctx, missile, color, isEnemy, time)
  }
}

function drawUfos(ctx, ufos, retro, time) {
  const lights = ['#fb7185', '#fde68a', '#34d399', '#60a5fa', '#e879f9']
  for (const ufo of ufos || []) {
    ctx.save()
    ctx.translate(ufo.x, ufo.y)
    const pulse = 0.55 + Math.sin(time * 8 + (ufo.spin || 0)) * 0.45
    if (ufo.dropsLeft > 0 && ufo.dropTimer < 0.4) {
      ctx.globalAlpha = 0.16 + pulse * 0.14
      ctx.fillStyle = retro ? '#4ade80' : '#67e8f9'
      ctx.beginPath()
      ctx.moveTo(-7, 8)
      ctx.lineTo(7, 8)
      ctx.lineTo(16, 78)
      ctx.lineTo(-16, 78)
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
    }
    ctx.globalAlpha = 0.28
    ctx.fillStyle = retro ? '#86efac' : '#22d3ee'
    ctx.beginPath()
    ctx.ellipse(0, 4, 42, 16, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = retro ? '#dcfce7' : '#f8fafc'
    ctx.beginPath()
    ctx.ellipse(0, 4, 36, 11, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = retro ? '#14532d' : '#0f172a'
    ctx.beginPath()
    ctx.ellipse(0, 8, 22, 5, 0, 0, Math.PI)
    ctx.fill()
    ctx.fillStyle = retro ? '#4ade80' : '#38bdf8'
    ctx.beginPath()
    ctx.ellipse(0, -4, 14, 11, 0, Math.PI, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = retro ? '#bbf7d0' : '#e0f2fe'
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.ellipse(-3, -8, 4.2, 2.6, -0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    for (let i = 0; i < 5; i += 1) {
      const a = (ufo.spin || 0) + i * ((Math.PI * 2) / 5)
      const lx = Math.cos(a) * 24
      const ly = 5 + Math.sin(a) * 3
      ctx.fillStyle = retro ? '#4ade80' : lights[i]
      ctx.globalAlpha = 0.55 + pulse * 0.45
      ctx.beginPath()
      ctx.arc(lx, ly, 3.3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

function drawExplosions(ctx, explosions, colorblind, retro) {
  for (const explosion of explosions) {
    if (explosion.radius <= 0) continue
    const fade = explosion.growing ? 1 : Math.max(0.2, explosion.radius / explosion.maxRadius)
    if (retro) {
      ctx.save()
      ctx.strokeStyle = '#4ade80'
      ctx.globalAlpha = fade
      for (const scale of [1, 0.62, 0.3]) {
        ctx.lineWidth = scale === 1 ? 2.4 : 1.2
        ctx.beginPath()
        ctx.arc(explosion.x, explosion.y, Math.max(1, explosion.radius * scale), 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
      continue
    }
    const core = colorblind ? '#e0f2fe' : '#fff7ed'
    const mid = colorblind ? '#67e8f9' : '#fde68a'
    const ring = colorblind ? '#0284c7' : '#fb7185'
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.9 * fade
    const bloom = ctx.createRadialGradient(explosion.x, explosion.y, 0, explosion.x, explosion.y, explosion.radius)
    bloom.addColorStop(0, core)
    bloom.addColorStop(0.18, mid)
    bloom.addColorStop(0.5, ring)
    bloom.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = bloom
    ctx.beginPath()
    ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 0.75 * fade
    ctx.strokeStyle = mid
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.arc(explosion.x, explosion.y, explosion.radius * 0.92, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 0.4 * fade
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(explosion.x, explosion.y, explosion.radius * 0.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

function drawAfterimages(ctx, images) {
  for (const image of images || []) {
    const points = image.points
    if (!points || points.length < 2) continue
    const alpha = Math.max(0, image.life / image.maxLife)
    ctx.save()
    ctx.globalAlpha = alpha * 0.7
    ctx.strokeStyle = image.color
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y)
    ctx.stroke()
    ctx.restore()
  }
}

function drawShockwaves(ctx, waves, retro) {
  for (const wave of waves || []) {
    const t = Math.max(0, wave.life / wave.maxLife)
    ctx.save()
    ctx.globalCompositeOperation = retro ? 'source-over' : 'lighter'
    ctx.globalAlpha = t * 0.75
    ctx.strokeStyle = retro ? '#86efac' : wave.color
    ctx.lineWidth = 1.5 + t * 2
    ctx.beginPath()
    ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

function drawParticles(ctx, particles, retro) {
  ctx.save()
  ctx.lineCap = 'round'
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife)
    ctx.globalAlpha = alpha
    ctx.strokeStyle = retro ? '#4ade80' : p.color
    ctx.fillStyle = ctx.strokeStyle
    if (p.kind === 'streak') {
      const len = Math.hypot(p.vx, p.vy) || 1
      const scale = Math.min(16, 0.04 * len + (p.size || 1))
      ctx.lineWidth = Math.max(1.1, (p.size || 1.4) * 0.55)
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - (p.vx / len) * scale, p.y - (p.vy / len) * scale)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(p.x, p.y, (p.size || 2) * 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawPopups(ctx, popups) {
  ctx.font = '700 16px system-ui, sans-serif'
  ctx.textAlign = 'center'
  for (const p of popups || []) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife)
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.75)'
    ctx.strokeText(p.text, p.x, p.y)
    ctx.fillStyle = p.color || '#fef08a'
    ctx.fillText(p.text, p.x, p.y)
  }
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'
}

function drawScanlines(ctx) {
  ctx.globalAlpha = 0.08
  ctx.fillStyle = '#4ade80'
  for (let y = 0; y < WORLD.height; y += 4) ctx.fillRect(0, y, WORLD.width, 1)
  ctx.globalAlpha = 1
}

function drawFlash(ctx, flash) {
  if (!flash || flash.life <= 0) return
  ctx.save()
  ctx.globalAlpha = flash.alpha * (flash.life / flash.maxLife)
  ctx.fillStyle = flash.color
  ctx.fillRect(0, 0, WORLD.width, WORLD.height)
  ctx.restore()
}

function drawVignette(ctx, retro) {
  if (retro) return
  const g = ctx.createRadialGradient(WORLD.width / 2, WORLD.height / 2, WORLD.width * 0.28, WORLD.width / 2, WORLD.height / 2, WORLD.width * 0.72)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.38)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, WORLD.width, WORLD.height)
}

function drawCard(ctx, y, h) {
  const w = 680
  const x = (WORLD.width - w) / 2
  ctx.fillStyle = 'rgba(2, 6, 23, 0.8)'
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 16)
  ctx.fill()
  ctx.stroke()
}

function drawCentered(ctx, text, y, font, color = '#f8fafc') {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText(text, WORLD.width / 2, y)
  ctx.textAlign = 'left'
}

function entryScore(entry) {
  return typeof entry === 'number' ? entry : entry?.score
}

function entryInitials(entry) {
  if (typeof entry === 'number') return '---'
  return String(entry?.initials || '---').padEnd(3, '-').slice(0, 3)
}

function drawScoreTable(ctx, state, top) {
  const board = state.leaderboard || []
  drawCentered(ctx, 'TOP SCORES', top, '700 28px system-ui, sans-serif')
  if (!board.length) {
    drawCentered(ctx, 'NO SCORES YET', top + 70, '22px system-ui, sans-serif', '#94a3b8')
    drawCentered(ctx, 'Finish a run to put your initials here', top + 104, '16px system-ui, sans-serif', '#64748b')
    return
  }
  ctx.font = '20px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.textAlign = 'center'
  board.slice(0, 8).forEach((entry, index) => {
    const mine = state.lastEntry && entryInitials(entry) === state.lastEntry.initials && entryScore(entry) === state.lastEntry.score
    ctx.fillStyle = mine ? '#fde68a' : '#e2e8f0'
    const rank = String(index + 1).padStart(2, ' ')
    const name = entryInitials(entry)
    const score = String(entryScore(entry)).padStart(7, ' ')
    ctx.fillText(`${rank}   ${name}   ${score}`, WORLD.width / 2, top + 42 + index * 28)
  })
  ctx.textAlign = 'left'
}

function drawAttract(ctx, state) {
  const index = (state.attractIndex || 0) % 3
  drawCard(ctx, 108, 500)
  drawCentered(ctx, 'MISSILE COMMAND', 162, '700 44px system-ui, sans-serif')
  if (index === 0) {
    drawScoreTable(ctx, state, 214)
  } else if (index === 1) {
    drawCentered(ctx, 'HOW TO PLAY', 220, '700 28px system-ui, sans-serif')
    const lines = [
      'Aim with the mouse, touch, or arrows',
      'Click or Space fires the nearest battery',
      'Stop rockets before they reach a city',
      'Shoot a split warhead before it breaks',
      'Hollow decoys fizzle. Saucers drop rockets',
      'P pauses a run. R starts a new one',
    ]
    lines.forEach((line, i) => {
      drawCentered(ctx, line, 270 + i * 32, '18px system-ui, sans-serif', '#cbd5e1')
    })
  } else {
    const blink = Math.floor(performance.now() / 420) % 2 === 0
    drawCentered(ctx, 'NEW GAME', 230, '700 28px system-ui, sans-serif')
    drawCentered(ctx, blink ? 'PRESS START' : ' ', 290, '700 36px system-ui, sans-serif', '#fde68a')
    drawCentered(ctx, 'Click or tap the screen', 350, '20px system-ui, sans-serif', '#cbd5e1')
    drawCentered(ctx, 'or press Space or Enter', 382, '20px system-ui, sans-serif', '#cbd5e1')
    drawCentered(ctx, 'Left and right arrows change this page', 440, '16px system-ui, sans-serif', '#64748b')
  }
  const labels = ['SCORES', 'HOW TO PLAY', 'START']
  drawCentered(ctx, labels[index], 548, '13px system-ui, sans-serif', '#64748b')
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i === index ? '#e2e8f0' : '#334155'
    ctx.beginPath()
    ctx.arc(WORLD.width / 2 - 18 + i * 18, 572, i === index ? 4.5 : 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawInitials(ctx, state) {
  const letters = state.initials || ['A', 'A', 'A']
  const cursor = state.initialCursor || 0
  const blinkOn = Math.floor(performance.now() / 280) % 2 === 0
  const board = state.leaderboard || []
  const rank = board.filter((entry) => entryScore(entry) > state.score).length + 1
  drawCard(ctx, 150, 390)
  drawCentered(ctx, rank === 1 ? 'NEW HIGH SCORE' : 'TOP SCORE', 214, '700 28px system-ui, sans-serif', '#fde68a')
  drawCentered(ctx, `SCORE ${state.score}    RANK ${rank}`, 256, '22px system-ui, sans-serif', '#cbd5e1')
  drawCentered(ctx, 'ENTER INITIALS', 310, '700 24px system-ui, sans-serif')
  ctx.font = '700 54px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.textAlign = 'center'
  letters.forEach((letter, index) => {
    const x = WORLD.width / 2 + (index - 1) * 78
    ctx.strokeStyle = index === cursor ? '#7dd3fc' : '#334155'
    ctx.lineWidth = 2
    ctx.strokeRect(x - 28, 332, 56, 68)
    ctx.fillStyle = '#f8fafc'
    const show = index === cursor && !blinkOn ? ' ' : letter
    ctx.fillText(show, x, 384)
  })
  ctx.textAlign = 'left'
  drawCentered(ctx, 'Type A–Z or 0–9. Arrows change a letter.', 444, '16px system-ui, sans-serif', '#94a3b8')
  drawCentered(ctx, 'Enter saves. Escape skips.', 470, '16px system-ui, sans-serif', '#64748b')
}

function drawHud(ctx, state) {
  const playing = state.mode === GAME_STATES.PLAYING || state.mode === GAME_STATES.PAUSED
  ctx.font = '600 18px system-ui, sans-serif'
  ctx.fillStyle = '#f8fafc'
  ctx.textAlign = 'left'
  ctx.fillText(`SCORE  ${state.score}`, 20, 32)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#94a3b8'
  ctx.fillText(`HIGH  ${state.highScore}`, WORLD.width - 20, 32)
  ctx.textAlign = 'left'

  if (state.settings.muted) {
    drawCentered(ctx, 'MUTED', 32, '600 14px system-ui, sans-serif', '#fca5a5')
  }

  if (playing || state.mode === GAME_STATES.WAVE_CLEAR) {
    const cities = state.defenses.cities.filter((c) => c.alive).length
    const ammo = state.defenses.silos.reduce((n, s) => n + (s.alive ? s.ammo : 0), 0)
    const inbound = state.waveMissilesRemaining + state.entities.enemyMissiles.length
    const bomber = state.entities.bombers?.some((b) => b.alive) ? ' + UFO' : ''
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '16px system-ui, sans-serif'
    ctx.fillText(`WAVE ${state.wave}`, 20, 58)
    ctx.fillText(`CITIES ${cities}`, 20, 80)
    ctx.fillText(`AMMO ${ammo}`, 20, 102)
    ctx.fillText(`COMBO x${state.combo || 0}`, 20, 124)
    if (state.combo > 0) {
      const t = Math.max(0, Math.min(1, state.comboTimer / PLAYER.comboWindow))
      ctx.fillStyle = '#fbbf24'
      ctx.fillRect(118, 116, 72 * t, 4)
    }
    ctx.fillStyle = '#cbd5e1'
    ctx.fillText(`INCOMING ${inbound}${bomber}`, 20, 148)
  }

  if (state.dryTimer > 0 && state.mode === GAME_STATES.PLAYING) {
    drawCentered(ctx, 'BATTERIES EMPTY', 188, '700 22px system-ui, sans-serif', '#fca5a5')
  }

  if (state.mode === GAME_STATES.PLAYING && state.wave === 1 && state.hintTimer > 0) {
    ctx.font = '15px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(226,232,240,0.78)'
    ctx.textAlign = 'left'
    ctx.fillText('Aim with mouse, touch, or arrows. Click or Space fires.', 20, 176)
  }

  if (state.mode === GAME_STATES.MENU) {
    drawAttract(ctx, state)
  } else if (state.mode === GAME_STATES.ENTER_INITIALS) {
    drawInitials(ctx, state)
  } else if (state.mode === GAME_STATES.PAUSED) {
    drawCard(ctx, 250, 140)
    drawCentered(ctx, 'PAUSED', 318, '700 44px system-ui, sans-serif')
    drawCentered(ctx, 'Click, Space, or P to resume', 360, '20px system-ui, sans-serif', '#cbd5e1')
  } else if (state.mode === GAME_STATES.WAVE_CLEAR) {
    const shots = state.shotsFiredThisWave
    const kills = state.enemiesDestroyedThisWave
    const perShot = shots > 0 ? (kills / shots).toFixed(1) : '—'
    drawCard(ctx, 220, 210)
    drawCentered(ctx, `WAVE ${state.wave} CLEAR`, 282, '700 42px system-ui, sans-serif')
    drawCentered(ctx, `Cities saved ${state.defenses.cities.filter((c) => c.alive).length}    Peak combo x${state.peakCombo}`, 328, '18px system-ui, sans-serif', '#cbd5e1')
    drawCentered(ctx, `Kills ${kills}    Kills/shot ${perShot}    Bonus +${state.waveBonusLast}`, 358, '18px system-ui, sans-serif', '#cbd5e1')
    drawCentered(ctx, 'Click or Space to continue', 398, '16px system-ui, sans-serif', '#94a3b8')
  } else if (state.mode === GAME_STATES.GAME_OVER) {
    drawCard(ctx, 210, 220)
    drawCentered(ctx, 'GAME OVER', 272, '700 46px system-ui, sans-serif')
    drawCentered(ctx, `Score ${state.score}    Best ${state.highScore}`, 322, '22px system-ui, sans-serif', '#cbd5e1')
    drawCentered(ctx, 'Click or press Space for the scoreboard', 372, '18px system-ui, sans-serif', '#94a3b8')
  }
}

function drawAim(ctx, state) {
  if (!state.aim || state.mode === GAME_STATES.GAME_OVER) return
  const { x, y, siloId, hasAmmo } = state.aim
  const silo = state.defenses.silos.find((s) => s.id === siloId)
  if (state.mode === GAME_STATES.PLAYING && silo) {
    ctx.save()
    ctx.strokeStyle = hasAmmo ? 'rgba(125, 211, 252, 0.35)' : 'rgba(248, 113, 113, 0.45)'
    ctx.setLineDash([5, 7])
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.moveTo(silo.x, silo.y - 16)
    ctx.lineTo(x, Math.min(y, WORLD.groundY - 14))
    ctx.stroke()
    ctx.restore()
  }

  ctx.save()
  ctx.strokeStyle = hasAmmo || state.mode !== GAME_STATES.PLAYING ? '#f8fafc' : '#fca5a5'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(x, y, 11, 0, Math.PI * 2)
  ctx.moveTo(x - 18, y)
  ctx.lineTo(x - 6, y)
  ctx.moveTo(x + 6, y)
  ctx.lineTo(x + 18, y)
  ctx.moveTo(x, y - 18)
  ctx.lineTo(x, y - 6)
  ctx.moveTo(x, y + 6)
  ctx.lineTo(x, y + 18)
  ctx.stroke()
  ctx.restore()
}

export function render(ctx, state) {
  const reduced = state.settings.reducedMotion
  const retro = state.settings.visualPreset === 'retro'
  const colorblind = state.settings.colorblind
  const shakeScale = reduced ? 0 : (state.settings.shakeIntensity ?? 1)
  const mag = state.camera.shakeTime > 0 ? state.camera.shakeMag * shakeScale : 0
  const ox = mag ? (Math.random() * 2 - 1) * mag : 0
  const oy = mag ? (Math.random() * 2 - 1) * mag : 0
  const time = performance.now() * 0.001

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, WORLD.width, WORLD.height)
  ctx.save()
  ctx.translate(ox, oy)

  drawBackdrop(ctx, colorblind, retro)
  drawStarfield(ctx, reduced, retro, time)
  drawHorizon(ctx, colorblind, retro)
  drawGround(ctx, state, colorblind, retro)
  drawDefenses(ctx, state, retro, time)
  drawUfos(ctx, state.entities.bombers, retro, time)
  const enemyTint = (missile) => (retro ? '#4ade80' : enemyColor(missile.type, colorblind))
  drawMissiles(ctx, state.entities.enemyMissiles, enemyTint, true, time)
  const friendly = playerColor(colorblind, retro)
  drawMissiles(ctx, state.entities.playerMissiles, () => friendly, false, time)
  drawAfterimages(ctx, state.entities.afterimages)
  drawExplosions(ctx, state.entities.explosions, colorblind, retro)
  drawShockwaves(ctx, state.entities.shockwaves, retro)
  drawParticles(ctx, state.entities.particles, retro)
  drawPopups(ctx, state.scorePopups)
  if (retro && !reduced) drawScanlines(ctx)
  drawVignette(ctx, retro)
  if (!reduced) drawFlash(ctx, state.flash)
  ctx.restore()

  drawHud(ctx, state)
  if (state.mode === GAME_STATES.PLAYING || state.mode === GAME_STATES.PAUSED || state.mode === GAME_STATES.WAVE_CLEAR) {
    drawAim(ctx, state)
  }
}
