// The pixel toolkit every scene draws with. No dependencies.
//
// A Canvas is a w×h grid of opaque RGB pixels. A Canvas made with { alpha: true } also keeps a
// mask, so it can be built once (a character, a foreground) and stamped on top of other layers.
//
// Colours are '#rrggbb' / '#rgb' strings or 0xRRGGBB numbers. `null` / `undefined` draws nothing.
// Any colour argument can also be a function (x, y) => colour, for dithering and texture.

export const TAU = Math.PI * 2

// ── colour ────────────────────────────────────────────────────────────────────────────────────

const cache = new Map()

/** Colour → 0xRRGGBB number. */
export function rgb(c) {
  if (typeof c === 'number') return c
  let v = cache.get(c)
  if (v === undefined) {
    let s = String(c).replace('#', '')
    if (s.length === 3) s = [...s].map((ch) => ch + ch).join('')
    v = parseInt(s, 16)
    if (Number.isNaN(v)) throw new Error(`Bad colour: ${c}`)
    cache.set(c, v)
  }
  return v
}

/** 0xRRGGBB → '#rrggbb'. */
export const hex = (n) => '#' + rgb(n).toString(16).padStart(6, '0')

/** Linear mix of two colours, t = 0 → a, 1 → b. Returns a number. */
export function mix(a, b, t) {
  a = rgb(a)
  b = rgb(b)
  t = clamp(t, 0, 1)
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t
  const g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t
  const bl = (a & 255) + ((b & 255) - (a & 255)) * t
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl)
}

// ── math, noise, dithering ────────────────────────────────────────────────────────────────────

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a, b, t) => a + (b - a) * t
/** Always-positive modulo. */
export const wrap = (v, m) => ((v % m) + m) % m
export const smooth = (t) => t * t * (3 - 2 * t)

/** Deterministic 0–1 hash of two numbers. Use it instead of Math.random (renders must repeat). */
export function hash(x, y = 0) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Seeded random number generator (mulberry32). rng() → 0–1. */
export function rng(seed = 1) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Smooth 2D value noise, 0–1. */
export function noise(x, y = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = smooth(xf), v = smooth(yf)
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/** Fractal noise (several octaves of `noise`), 0–1. */
export function fbm(x, y = 0, octaves = 4) {
  let sum = 0, amp = 0.5, norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += noise(x, y) * amp
    norm += amp
    x *= 2.03
    y *= 2.03
    amp *= 0.5
  }
  return sum / norm
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
/** 4×4 ordered-dither threshold for a pixel, 0–1. */
export const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)]

/** Pick from `colours` (dark → light) by a 0–1 light value, with ordered dithering at the seams. */
export function shade(colours, light, x, y, spread = 0.12) {
  const v = clamp(light + (bayer(x, y) - 0.5) * spread, 0, 0.999)
  return colours[Math.floor(v * colours.length)]
}

// ── seamless looping ──────────────────────────────────────────────────────────────────────────
// Every video loops. Drive ALL motion from `phase` (0 → 1 over the loop) with WHOLE-NUMBER
// cycle counts, and the last frame flows into the first. `render.mjs --check-loop` verifies it.

/** Angle for `cycles` full turns per loop. Math.sin(osc(phase, 3)) waves 3 times per loop. */
export const osc = (phase, cycles = 1, offset = 0) => (phase * cycles + offset) * TAU

/** Position that travels `cycles` times across `span` per loop, wrapping (clouds, birds, scrolling). */
export const travel = (phase, span, cycles = 1, start = 0) => wrap(start + phase * cycles * span, span)

/** 0–1 pulse: 1 near the moments `at` (0–1 in each cycle), 0 elsewhere. Good for blinks, flashes. */
export function pulse(phase, cycles = 1, at = 0, width = 0.05) {
  const p = wrap(phase * cycles - at + 0.5, 1) - 0.5
  return Math.max(0, 1 - Math.abs(p) / width)
}

// ── canvas ────────────────────────────────────────────────────────────────────────────────────

export class Canvas {
  constructor(w, h, { alpha = false } = {}) {
    this.w = w
    this.h = h
    this.data = new Uint8Array(w * h * 3)
    this.mask = alpha ? new Uint8Array(w * h) : null
  }

  // pixels

  set(x, y, c) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    if (typeof c === 'function') c = c(x, y)
    if (c == null) return
    const v = rgb(c), i = (y * this.w + x) * 3
    this.data[i] = (v >> 16) & 255
    this.data[i + 1] = (v >> 8) & 255
    this.data[i + 2] = v & 255
    if (this.mask) this.mask[y * this.w + x] = 1
  }

  /** Colour at x, y as a number (or null on a transparent / off-canvas pixel). */
  get(x, y) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null
    if (this.mask && !this.mask[y * this.w + x]) return null
    const i = (y * this.w + x) * 3
    return (this.data[i] << 16) | (this.data[i + 1] << 8) | this.data[i + 2]
  }

  /** Blend `c` over the existing pixel by `a` (0–1). */
  blend(x, y, c, a) {
    const old = this.get(x, y)
    if (old == null || a <= 0) return
    this.set(x, y, mix(old, c, a))
  }

  clear() {
    this.data.fill(0)
    if (this.mask) this.mask.fill(0)
  }

  fill(c) {
    this.rect(0, 0, this.w - 1, this.h - 1, c)
  }

  // shapes (all inclusive of their end pixels)

  rect(x0, y0, x1, y1, c) {
    for (let y = Math.max(0, Math.round(y0)); y <= Math.min(this.h - 1, Math.round(y1)); y++)
      for (let x = Math.max(0, Math.round(x0)); x <= Math.min(this.w - 1, Math.round(x1)); x++) this.set(x, y, c)
  }

  hline(x0, x1, y, c) {
    this.rect(Math.min(x0, x1), y, Math.max(x0, x1), y, c)
  }

  vline(x, y0, y1, c) {
    this.rect(x, Math.min(y0, y1), x, Math.max(y0, y1), c)
  }

  /** Pixel-perfect line (Bresenham). */
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.set(x0, y0, c)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += sx }
      if (e2 <= dx) { err += dx; y0 += sy }
    }
  }

  /** Filled ellipse. */
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / (rx + 0.5), ny = (y - cy) / (ry + 0.5)
        if (nx * nx + ny * ny <= 1) this.set(x, y, c)
      }
  }

  /** Filled circle. */
  disc(cx, cy, r, c) {
    this.ellipse(cx, cy, r, r, c)
  }

  /** Filled polygon from [[x, y], ...] (even-odd rule). */
  poly(points, c) {
    let minY = Infinity, maxY = -Infinity
    for (const [, y] of points) { minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(this.h - 1, Math.ceil(maxY)); y++) {
      const yc = y + 0.5, xs = []
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length]
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax))
      }
      xs.sort((a, b) => a - b)
      for (let i = 0; i + 1 < xs.length; i += 2) this.hline(Math.ceil(xs[i] - 0.5), Math.floor(xs[i + 1] - 0.5), y, c)
    }
  }

  /** Vertical gradient between rows y0 and y1 through `colours` (top → bottom), ordered-dithered. */
  vgradient(y0, y1, colours, x0 = 0, x1 = this.w - 1) {
    const n = colours.length - 1
    for (let y = Math.round(y0); y <= Math.round(y1); y++) {
      const f = (n * (y - y0)) / Math.max(1, y1 - y0)
      const i = Math.min(n - 1, Math.floor(f)), t = f - i
      for (let x = x0; x <= x1; x++) this.set(x, y, t > bayer(x, y) ? colours[i + 1] : colours[i])
    }
  }

  /** Round, dithered light glow (lamps, moon, lanterns). strength 0–1. */
  glow(cx, cy, r, c, strength = 0.6) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy) / r
        if (d >= 1) continue
        const a = strength * (1 - d) * (1 - d)
        const q = Math.floor(clamp(a + (bayer(x, y) - 0.5) * 0.18, 0, 1) * 4) / 4 // stepped, not smooth
        if (q > 0) this.blend(x, y, c, q)
      }
  }

  // layers

  /** Copy every pixel of a same-sized canvas (fast; use for the static background each frame). */
  copy(src) {
    this.data.set(src.data)
    if (this.mask && src.mask) this.mask.set(src.mask)
  }

  clone() {
    const c = new Canvas(this.w, this.h, { alpha: !!this.mask })
    c.copy(this)
    return c
  }

  /**
   * Draw another canvas (usually an alpha one) at x, y. Options:
   *   anchor: 'top-left' (default) | 'bottom-center' | 'center'
   *   flip:   mirror horizontally
   *   tint:   (colour) => colour, to recolour (shadows, reflections, night versions)
   */
  stamp(src, x, y, { anchor = 'top-left', flip = false, tint } = {}) {
    let ox = Math.round(x), oy = Math.round(y)
    if (anchor === 'bottom-center') { ox -= Math.floor(src.w / 2); oy -= src.h - 1 }
    else if (anchor === 'center') { ox -= Math.floor(src.w / 2); oy -= Math.floor(src.h / 2) }
    for (let sy = 0; sy < src.h; sy++)
      for (let sx = 0; sx < src.w; sx++) {
        const v = src.get(sx, sy)
        if (v == null) continue
        this.set(ox + (flip ? src.w - 1 - sx : sx), oy + sy, tint ? tint(v) : v)
      }
  }
}

// ── sprites ───────────────────────────────────────────────────────────────────────────────────

/**
 * Build an alpha Canvas from text rows and a palette: '.' (or ' ') is transparent.
 *   fromRows(['.aa.', 'abba'], { a: '#333', b: '#ffd27a' })
 */
export function fromRows(rows, palette) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length))
  const c = new Canvas(w, h, { alpha: true })
  rows.forEach((row, y) => [...row].forEach((k, x) => {
    if (k !== '.' && k !== ' ') {
      if (!(k in palette)) throw new Error(`Sprite key "${k}" missing from palette`)
      c.set(x, y, palette[k])
    }
  }))
  return c
}

/** Several frames sharing one palette: fromFrames([[rows], [rows]], palette) → Canvas[]. */
export const fromFrames = (frames, palette) => frames.map((rows) => fromRows(rows, palette))

/** Which frame of an animation to show: `cycles` full passes through `frames.length` per loop. */
export const frameAt = (phase, count, cycles) => Math.floor(wrap(phase * cycles, 1) * count) % count
