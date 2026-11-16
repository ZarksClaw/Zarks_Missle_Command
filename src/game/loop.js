import { TIMING } from './constants.js'

export function startLoop({ update, render }) {
  let lastTime = performance.now()
  let accumulator = 0

  function frame(now) {
    const elapsed = Math.min((now - lastTime) / 1000, TIMING.maxFrameDelta)
    lastTime = now
    accumulator += elapsed

    while (accumulator >= TIMING.fixedStep) {
      update(TIMING.fixedStep)
      accumulator -= TIMING.fixedStep
    }

    render()
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}
