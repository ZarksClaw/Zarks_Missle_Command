import { PLAYER } from './constants.js'

// Deterministic silhouettes: no per-frame randomness, sprite allocation or timers.
const SKYLINES = [
  [15, 24, 31, 19, 13], [23, 15, 27, 33, 18], [14, 30, 21, 26, 16],
  [19, 27, 34, 16, 23], [27, 18, 24, 31, 14], [16, 32, 20, 28, 22],
]

function polygon(ctx, points, fill) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(points[0], points[1])
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1])
  ctx.closePath()
  ctx.fill()
}

export function drawModernCity(ctx, city) {
  ctx.save()
  ctx.translate(city.x, city.y)
  // Pads stay inside the existing defense hit radius; artwork never changes it.
  polygon(ctx, [-29, 0, -24, -5, 24, -5, 29, 0, 26, 4, -26, 4], '#111c30')
  ctx.fillStyle = '#475569'
  ctx.fillRect(-25, 0, 50, 2)
  if (!city.alive) {
    for (let i = 0; i < 5; i += 1) {
      const x = -22 + i * 9
      polygon(ctx, [x, 0, x, -4 - (i % 3) * 3, x + 4, -3, x + 8, -6, x + 8, 0], '#334155')
    }
    ctx.fillStyle = '#64748b'
    ctx.fillRect(-15, -3, 5, 1)
    ctx.fillRect(8, -5, 4, 1)
    ctx.restore()
    return
  }
  const heights = SKYLINES[city.id % SKYLINES.length]
  for (let i = 0; i < heights.length; i += 1) {
    const x = -23 + i * 9
    const h = heights[i]
    ctx.fillStyle = i % 2 ? '#334b63' : '#263b55'
    ctx.fillRect(x, -h, 8, h)
    ctx.fillStyle = '#142339'
    ctx.fillRect(x + 6, -h, 3, h)
    polygon(ctx, [x, -h, x + 3, -h - 3, x + 9, -h - 3, x + 6, -h], '#65849a')
    ctx.fillStyle = '#8fb9c9'
    ctx.fillRect(x, -h, 1, h)
    for (let row = 0; row < Math.floor((h - 4) / 5); row += 1) {
      for (let col = 0; col < 2; col += 1) {
        ctx.fillStyle = (row + col + i + city.id) % 4 === 0 ? '#1b3047' : i % 2 ? '#fde6a0' : '#9fe9ed'
        ctx.fillRect(x + 2 + col * 3, -h + 4 + row * 5, 2, 2)
      }
    }
    if (i === city.id % 5) {
      ctx.fillStyle = '#94a3b8'
      ctx.fillRect(x + 4, -h - 8, 1, 5)
      ctx.fillStyle = '#fda4af'
      ctx.fillRect(x + 4, -h - 9, 2, 2)
    }
  }
  ctx.fillStyle = '#17283c'
  ctx.fillRect(-25, -3, 50, 3)
  ctx.fillStyle = '#67e8f9'
  for (let x = -21; x <= 21; x += 7) ctx.fillRect(x, 1, 3, 1)
  ctx.restore()
}

export function drawModernSilo(ctx, silo, state, selected) {
  ctx.save()
  ctx.translate(silo.x, silo.y)
  polygon(ctx, [-27, 0, -22, -5, 22, -5, 27, 0, 25, 4, -25, 4], '#111c30')
  ctx.fillStyle = '#64748b'
  ctx.fillRect(-23, 0, 46, 2)
  if (!silo.alive) {
    polygon(ctx, [-18, 0, -15, -10, -5, -5, 0, -13, 7, -6, 14, -9, 19, 0], '#334155')
    ctx.fillStyle = '#64748b'
    ctx.fillRect(-11, -8, 7, 2)
    ctx.restore()
    return
  }
  polygon(ctx, [-20, 0, -15, -13, -9, -17, 9, -17, 15, -13, 20, 0], '#344d68')
  polygon(ctx, [-20, 0, -15, -13, -9, -17, -9, -4, 15, -4, 20, 0], '#1b2d43')
  ctx.fillStyle = '#7a9cb4'
  ctx.fillRect(-9, -17, 18, 3)
  ctx.fillStyle = selected ? '#a5f3fc' : '#38bdf8'
  ctx.fillRect(-15, -8, 5, 2)
  ctx.fillRect(10, -8, 5, 2)
  // The hinge matches the existing launch origin. Only art rotates.
  const aim = state.aim
  const angle = aim ? Math.atan2(Math.min(aim.y, silo.y - 18) - (silo.y - 16), aim.x - silo.x) : -Math.PI / 2
  ctx.save()
  ctx.translate(0, -16)
  ctx.rotate(angle)
  polygon(ctx, [-4, -6, 10, -6, 14, -4, 14, 4, 10, 6, -4, 6], '#52748e')
  ctx.fillStyle = '#b6cbd9'
  ctx.fillRect(3, -4, 18, 3)
  ctx.fillStyle = '#334155'
  ctx.fillRect(3, 1, 18, 3)
  ctx.fillStyle = selected ? '#e0f2fe' : '#7dd3fc'
  ctx.fillRect(18, -5, 4, 10)
  ctx.fillStyle = '#0b1729'
  ctx.fillRect(21, -3, 2, 6)
  ctx.restore()
  ctx.fillStyle = '#94a3b8'
  ctx.beginPath()
  ctx.arc(0, -16, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1e293b'
  ctx.beginPath()
  ctx.arc(0, -16, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// A compact row of actual rockets: one silhouette per remaining shot.
export function drawAmmoRack(ctx, silo, retro) {
  if (!silo.alive) return
  const count = Math.max(0, Math.min(PLAYER.siloAmmo, Math.floor(silo.ammo)))
  const spacing = 6
  const start = silo.x - (PLAYER.siloAmmo - 1) * spacing / 2
  ctx.save()
  for (let i = 0; i < count; i += 1) {
    const x = start + i * spacing
    const y = silo.y + 19
    polygon(ctx, [x, y - 13, x - 2, y - 9, x - 2, y - 4, x - 3, y - 1, x, y - 3, x + 3, y - 1, x + 2, y - 4, x + 2, y - 9], retro ? '#4ade80' : (silo.ammo <= 3 ? '#fbbf24' : '#bae6fd'))
    ctx.fillStyle = retro ? '#14532d' : '#38bdf8'
    ctx.fillRect(x - 1, y - 7, 2, 2)
  }
  ctx.restore()
}

export function drawModernRocket(ctx, missile, color, isEnemy, time, reduced) {
  // Last sampled position tracks actual weave direction, not just the destination.
  const previous = missile.trail?.[missile.trail.length - 1]
  const moving = previous && Math.hypot(missile.x - previous.x, missile.y - previous.y) > 0.01
  const angle = moving
    ? Math.atan2(missile.y - previous.y, missile.x - previous.x)
    : Math.atan2(missile.targetY - missile.y, missile.targetX - missile.x)
  const type = isEnemy ? missile.type : 'interceptor'
  ctx.save()
  ctx.translate(missile.x, missile.y)
  ctx.rotate(angle)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.4
  if (type === 'decoy') {
    // Hollow diamond + open center remain recognizable without color.
    ctx.beginPath()
    ctx.moveTo(6, 0)
    ctx.lineTo(-2, -5)
    ctx.lineTo(-10, 0)
    ctx.lineTo(-2, 5)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(-2, 0, 2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    return
  }
  const length = type === 'fast' ? 18 : type === 'split' ? 16 : 13
  const width = type === 'split' ? 4 : type === 'fast' ? 1.8 : 2.6
  const flame = reduced ? 8 : 8 + Math.sin(time * 25 + missile.x * 0.1) * 2
  polygon(ctx, [-length + 2, -2, -length - flame, 0, -length + 2, 2], color)
  polygon(ctx, [-length + 2, -1, -length - flame * 0.6, 0, -length + 2, 1], '#fff7ed')
  const wing = type === 'zigzag' ? 7 : type === 'fast' ? 3 : 5
  polygon(ctx, [-length + 7, 0, -length, -wing, -length + 1, 0, -length, wing], color)
  polygon(ctx, [5, 0, 0, -width, -length + 2, -width, -length, 0, -length + 2, width, 0, width], '#b9c8d9')
  polygon(ctx, [5, 0, -length, 0, -length + 2, width, 0, width], '#52657e')
  polygon(ctx, [5, 0, 0, -width, -2, -width, -2, width, 0, width], color)
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(-length + 3, -width, length - 6, 0.8)
  ctx.fillStyle = color
  ctx.fillRect(-6, -width, 2, width * 2)
  if (type === 'split') {
    // Paired outboard warheads identify MIRVs by silhouette.
    for (const side of [-1, 1]) {
      polygon(ctx, [0, side * 5, -5, side * 7, -13, side * 7, -13, side * 4, -5, side * 4], color)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(-11, side * 5, 5, 1)
    }
  } else if (type === 'zigzag') {
    polygon(ctx, [-2, -2, -7, -7, -9, -7, -6, -2], color)
    polygon(ctx, [-2, 2, -7, 7, -9, 7, -6, 2], color)
  }
  ctx.restore()
}
