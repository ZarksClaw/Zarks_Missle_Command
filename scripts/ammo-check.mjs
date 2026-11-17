import assert from 'node:assert/strict'
import { drawAmmoRack } from '../src/game/render-details.js'
import { PLAYER } from '../src/game/constants.js'
function measure(ammo, retro = false) {
  const fills = []
  const ctx = { save(){}, restore(){}, beginPath(){}, moveTo(){}, lineTo(){}, closePath(){}, fill(){ fills.push(this.fillStyle) }, fillRect(){} }
  drawAmmoRack(ctx, { x: 100, y: 500, ammo, alive: true }, retro)
  return fills
}
for (const retro of [false, true]) {
  assert.equal(measure(0, retro).length, 0)
  assert.equal(measure(3, retro).length, 3)
  assert.equal(measure(PLAYER.siloAmmo, retro).length, PLAYER.siloAmmo)
  assert.equal(measure(PLAYER.siloAmmo + 20, retro).length, PLAYER.siloAmmo)
}
console.log('PASS ammo rack draws one miniature rocket per round in both presets')
