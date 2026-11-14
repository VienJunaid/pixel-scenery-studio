// {{label}}
// See docs/scene-api.md for the drawing API and STYLE.md for the pixel-art rules.
//
// setup() runs once: build everything that never moves into `base`.
// draw() runs every frame: copy `base`, then draw only what moves, driven by `phase` (0 → 1 over
// the loop) with whole-number cycle counts so the video loops seamlessly.
import { Canvas, bayer, hash, osc } from '../../engine/pixels.mjs'

const C = {
  skyTop: '#1b2a4a',
  skyLow: '#e08a5a',
  ground: '#2a3326',
  star: '#f4efd8',
}

export function setup({ w, h }) {
  const base = new Canvas(w, h)
  const horizon = Math.round(h * 0.7)
  base.vgradient(0, horizon, [C.skyTop, '#3c3f6a', '#8a5a6a', C.skyLow])
  base.rect(0, horizon + 1, w - 1, h - 1, (x, y) => (bayer(x, y) < 0.15 ? '#334030' : C.ground))
  return { base, horizon }
}

export function draw(c, { phase, state, w }) {
  c.copy(state.base)
  // Example motion: a few stars twinkling, 3–6 times per loop each.
  for (let i = 0; i < 20; i++) {
    const x = Math.floor(hash(i, 1) * w), y = Math.floor(hash(i, 2) * state.horizon * 0.5)
    if (Math.sin(osc(phase, 3 + (i % 4), hash(i, 3))) > 0.2) c.set(x, y, C.star)
  }
}
