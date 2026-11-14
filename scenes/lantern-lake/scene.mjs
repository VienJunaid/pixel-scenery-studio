// Lantern Lake: the example scene. A mountain lake at night, a full moon, twinkling stars, a small
// boat with a lantern bobbing on the water, fireflies along the shore, and one shooting star per loop.
//
// It shows the usual structure: a static `base` built once in setup(), a mirrored reflection that
// ripples, a sprite, glows, and every motion driven by `phase` with whole-number cycles.
import { Canvas, TAU, bayer, fbm, fromRows, hash, mix, noise, osc, pulse, rgb, wrap } from '../../engine/pixels.mjs'

const C = {
  sky: ['#070a1c', '#0c1230', '#152048', '#22305e', '#34437a'],
  star: '#f4efd8', starDim: '#8a90b8',
  moon: '#f6f0d4', moonShade: '#d9cfa6', moonCrater: '#c4b98e', moonGlow: '#9fb0e0',
  farRidge: '#2a3766', farRidgeShade: '#222d56', snow: '#aab6dc', snowShade: '#7d8bbd',
  nearRidge: '#151d3c', nearRidgeShade: '#10172f',
  trees: '#090e22', water: '#0a1030',
  glitter: '#f6f0d4', glitterDim: '#9aa3c8',
  lantern: '#ffcf6b', lanternHot: '#fff2c0',
  firefly: '#d8ff8a',
  shore: '#05081a', shoreLit: '#0d1430', reed: '#0b1126',
}

const boat = fromRows([
  '...........p..........',
  '..........lLl.........',
  '..........lLl.........',
  '...........p..........',
  '...........p..........',
  'rrrrrrrrrrrrrrrrrrrrrr',
  '.wwwwwwwwwwwwwwwwwwdd.',
  '..wwwwwwwwwwwwwwwddd..',
  '....dddddddddddddd....',
], { p: '#2a1a10', l: C.lantern, L: C.lanternHot, r: '#8a6040', w: '#5a3b24', d: '#3a2416' })

export function setup({ w, h }) {
  const horizon = Math.round(h * 0.62)
  const moon = { x: Math.round(w * 0.74), y: Math.round(h * 0.2), r: 11 }

  // Everything above the waterline, built once: sky, stars, moon, mountains, tree line.
  const above = new Canvas(w, h)
  above.vgradient(0, horizon, C.sky)
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(hash(i, 11) * w), y = Math.floor(Math.pow(hash(i, 12), 1.4) * horizon * 0.85)
    above.set(x, y, hash(i, 13) < 0.2 ? C.star : mix(C.starDim, above.get(x, y), 0.4))
  }
  above.glow(moon.x, moon.y, moon.r * 4, C.moonGlow, 0.55)
  above.disc(moon.x, moon.y, moon.r, (x, y) => {
    // lit from the upper left, shaded lower right, with dithered seams and a few craters
    const d = (x - moon.x) * 0.7 + (y - moon.y) * 0.7
    if (noise(x * 0.35, y * 0.35) > 0.68) return C.moonCrater
    return d / moon.r + (bayer(x, y) - 0.5) * 0.3 > 0.35 ? C.moonShade : C.moon
  })

  // Ridged noise gives sharp peaks; light comes from the left, so faces sloping down to the right
  // are in shade. Shading uses the slope of a smoothed ridge, dithered at the seam.
  const peaks = (x, base, amp, freq, seed) => base - amp * Math.pow(1 - Math.abs(fbm(x * freq + seed, seed, 4) * 2 - 1), 1.6)
  const range = (base, amp, freq, seed, lit, dark, snowLine) => {
    for (let x = 0; x < w; x++) {
      const top = Math.round(peaks(x, base, amp, freq, seed))
      const slope = peaks(x + 1.5, base, amp, freq, seed) - peaks(x - 1.5, base, amp, freq, seed)
      for (let y = top; y <= horizon; y++) {
        const inShade = slope + (bayer(x, y) - 0.5) * 1.2 > 0.3
        const snow = snowLine && top < snowLine && y - top < (snowLine - top) * 0.55 + noise(x * 0.3, y * 0.2) * 3
        above.set(x, y, snow ? (inShade ? C.snowShade : C.snow) : inShade ? dark : lit)
      }
    }
  }
  range(horizon, 78, 0.014, 3, C.farRidge, C.farRidgeShade, horizon - 46)
  range(horizon + 2, 34, 0.026, 41, C.nearRidge, C.nearRidgeShade, 0)

  // Pine tree line on the far shore
  for (let x = 0; x < w; x += 1 + Math.floor(hash(x, 5) * 3)) {
    const th = 3 + Math.floor(hash(x, 6) * 7)
    for (let k = 0; k < th; k++) above.hline(x - Math.floor(k / 3), x + Math.floor(k / 3), horizon - th + k, C.trees)
  }
  above.hline(0, w - 1, horizon, C.trees)

  // The water: the scene above, mirrored and darkened with depth. Rippled per frame in draw().
  const waterH = h - horizon - 1
  const reflection = new Canvas(w, waterH)
  for (let y = 0; y < waterH; y++) {
    const src = horizon - 1 - Math.floor(y * 0.9)
    const dark = 0.45 + 0.35 * (y / waterH)
    for (let x = 0; x < w; x++) reflection.set(x, y, mix(above.get(x, Math.max(0, src)) ?? C.water, C.water, dark))
  }

  // Foreground shore (bottom left) and reeds (bottom right), drawn over everything
  const shore = new Canvas(w, h, { alpha: true })
  shore.poly([[0, h * 0.8], [w * 0.1, h * 0.83], [w * 0.22, h * 0.9], [w * 0.3, h], [0, h]], (x, y) => (bayer(x, y) < 0.08 ? C.shoreLit : C.shore))
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(hash(i, 21) * w * 0.26), top = h * (0.8 + hash(i, 22) * 0.08) - 2 - hash(i, 23) * 6
    shore.vline(x, top, h, C.shore)
  }
  const reeds = Array.from({ length: 14 }, (_, i) => ({ x: Math.round(w * (0.84 + hash(i, 31) * 0.15)), hgt: 10 + Math.floor(hash(i, 32) * 16) }))

  const fireflies = Array.from({ length: 16 }, (_, i) => ({
    x: hash(i, 41) * w * 0.32, y: h * (0.66 + hash(i, 42) * 0.22),
    ax: 4 + hash(i, 43) * 8, ay: 2 + hash(i, 44) * 4,
    cx: 1 + (i % 3), cy: 2 + (i % 2), blink: 4 + (i % 5), off: hash(i, 45),
  }))
  const twinkle = Array.from({ length: 24 }, (_, i) => ({
    x: Math.floor(hash(i, 51) * w), y: Math.floor(hash(i, 52) * horizon * 0.55), n: 2 + (i % 5), off: hash(i, 53),
  }))

  return { above, reflection, shore, reeds, fireflies, twinkle, horizon, moon, boatX: Math.round(w * 0.42) }
}

export function draw(c, { phase, state, w, h }) {
  const { above, reflection, horizon, moon } = state
  c.copy(above)

  // Twinkling stars
  for (const s of state.twinkle) {
    const v = Math.sin(osc(phase, s.n, s.off))
    if (v > 0.6) { c.set(s.x, s.y, C.star); if (v > 0.95) { c.set(s.x - 1, s.y, C.starDim); c.set(s.x + 1, s.y, C.starDim) } }
  }

  // One shooting star per loop, a short streak from upper left
  const shot = (phase - 0.38) / 0.04
  if (shot > 0 && shot < 1) {
    const x = w * (0.12 + shot * 0.3), y = h * (0.08 + shot * 0.12)
    for (let k = 0; k < 9; k++) c.set(x - k * 2.5, y - k, k < 2 ? C.star : k < 5 ? C.starDim : mix(C.starDim, C.sky[1], 0.5))
  }

  // Water: each row of the reflection slides sideways a little, more near the viewer
  for (let y = 0; y < reflection.h; y++) {
    const depth = y / reflection.h
    const shift = Math.round(Math.sin(osc(phase, 6) + y * 0.9) * (0.5 + depth * 2.5) + Math.sin(osc(phase, 4) + y * 0.31) * depth * 1.5)
    for (let x = 0; x < w; x++) c.set(x, horizon + 1 + y, reflection.get(wrap(x + shift, w), y))
    // faint ripple highlights
    for (let x = 0; x < w; x++) if (noise(x * 0.08 + Math.sin(osc(phase, 2)) * 3, y * 0.6) > 0.83 - depth * 0.05 && (x + y) % 3 === 0) c.blend(x, horizon + 1 + y, C.glitterDim, 0.35)
  }

  // Moon glitter path on the water, flickering
  for (let y = horizon + 2; y < h; y += 1) {
    const spread = 2 + (y - horizon) * 0.35
    for (let k = 0; k < 3; k++) {
      const seed = y * 7 + k
      const x = moon.x + Math.round((hash(seed, 61) - 0.5) * 2 * spread + Math.sin(osc(phase, 5, hash(seed, 62))) * 2)
      const len = 1 + Math.floor(hash(seed, 63) * 3)
      if (Math.sin(osc(phase, 3 + (seed % 4), hash(seed, 64))) > -0.2) c.hline(x, x + len, y, hash(seed, 65) < 0.4 ? C.glitter : C.glitterDim)
    }
  }

  // The boat bobbing, with a dark wobbling reflection and a flickering lantern glow
  const bob = Math.round(Math.sin(osc(phase, 8)) * 1.2)
  const bx = state.boatX, by = horizon + 30 + bob
  for (let y = 0; y < 4; y++) c.hline(bx - 10 + Math.round(Math.sin(osc(phase, 8) + y) ), bx + 10, by + 1 + y, mix('#05081a', C.water, y / 4))
  c.stamp(boat, bx, by, { anchor: 'bottom-center' })
  const flicker = 0.6 + 0.06 * Math.sin(osc(phase, 37)) + 0.04 * Math.sin(osc(phase, 23, 0.3))
  c.glow(bx, by - 7, 20, C.lantern, flicker)
  c.set(bx, by - 7, C.lanternHot)
  // lantern light on the water
  for (let k = 0; k < 6; k++) {
    const y = by + 3 + k * 2, half = 2 + k
    if (y < h && Math.sin(osc(phase, 6, k * 0.15)) > -0.5) c.hline(bx - half + (k % 2), bx - half + (k % 2) + 1 + (k % 3), y, mix(C.lantern, C.water, 0.3 + k * 0.1))
  }

  // Fireflies drifting over the shore, each blinking on its own rhythm
  for (const f of state.fireflies) {
    const x = f.x + Math.sin(osc(phase, f.cx, f.off)) * f.ax
    const y = f.y + Math.sin(osc(phase, f.cy, f.off * 2)) * f.ay
    const on = Math.sin(osc(phase, f.blink, f.off))
    if (on > 0.3) {
      c.set(x, y, C.firefly)
      if (on > 0.8) c.glow(Math.round(x), Math.round(y), 3, C.firefly, 0.5)
    }
  }

  // Foreground
  c.stamp(state.shore, 0, 0)
  for (const [i, r] of state.reeds.entries()) {
    const sway = Math.sin(osc(phase, 2, i * 0.13))
    for (let k = 0; k < r.hgt; k++) {
      const lean = Math.round(sway * (k / r.hgt) * 2)
      c.set(r.x + lean, h - 1 - k, C.reed)
    }
    if (i % 3 === 0) c.rect(r.x + Math.round(sway * 2) - 0, h - r.hgt - 3, r.x + Math.round(sway * 2) + 1, h - r.hgt, '#1a1208')
  }
}
