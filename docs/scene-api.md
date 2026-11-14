# Scene API

A scene is `scenes/<id>/scene.mjs`. It exports two functions:

```js
import { Canvas, osc, hash } from '../../engine/pixels.mjs'

// Runs once. Build everything that doesn't move. Return anything; it comes back as `state`.
export function setup({ w, h, meta, lib }) {
  const base = new Canvas(w, h)
  base.vgradient(0, h * 0.6, ['#0c1230', '#34437a'])
  return { base }
}

// Runs every frame. `c` is a fresh w×h canvas.
export function draw(c, { phase, t, frame, fps, loopSeconds, w, h, state, lib }) {
  c.copy(state.base)
  const bob = Math.round(Math.sin(osc(phase, 4)) * 2)  // up and down 4 times per loop
  c.disc(w / 2, h / 2 + bob, 6, '#ffcf6b')
}
```

| Frame value | Meaning |
|---|---|
| `phase` | 0 → 1 over the loop. **Drive all motion from this.** |
| `t` | seconds into the loop (`phase × loopSeconds`). Handy for speeds, but see "Seamless loops". |
| `frame`, `fps`, `loopSeconds` | frame number and timing |
| `w`, `h` | canvas size in art pixels (320×180 by default) |
| `state` | whatever `setup()` returned |
| `meta` | the scene's `scene.json`, so scenes can read their own options |
| `lib` | the whole `engine/pixels.mjs` module |

## Seamless loops

Videos loop forever, so frame 0 must follow the last frame with no jump. The rule: **every moving
thing repeats a whole number of times per loop.**

```js
Math.sin(osc(phase, 3))            // oscillates 3 times per loop (3 must be a whole number)
Math.sin(osc(phase, 3, 0.25))      // same, offset by a quarter cycle
travel(phase, w + 40, 2) - 20      // crosses the screen 2 times per loop, wrapping (clouds, birds)
pulse(phase, 1, 0.4, 0.02)         // 1 briefly around 40% through the loop (a flash, a shooting star)
frameAt(phase, frames.length, 30)  // runs through an animation 30 times per loop
```

Speeds become cycle counts: a cloud that should cross the screen in ~30 s on a 60 s loop crosses
`2` times per loop. Give different things different counts (and offsets from `hash(i, n)`) so the
motion doesn't look synchronised.

Never use `Math.random()` (each frame would differ and renders wouldn't repeat). Use `hash(i, n)`
for per-object randomness and `rng(seed)` in `setup()`.

`npm run check -- <id>` compares the end of the loop with the start and fails if they differ.

## Canvas

`new Canvas(w, h)` is opaque. `new Canvas(w, h, { alpha: true })` also keeps a mask, so it can be
stamped onto other canvases with only its drawn pixels showing.

Every colour argument is `'#rrggbb'`, `'#rgb'`, a `0xrrggbb` number, `null` (draw nothing) or a
function `(x, y) => colour` for texture and dithering.

| Method | |
|---|---|
| `set(x, y, c)` / `get(x, y)` | one pixel (`get` returns a number, or `null` if transparent) |
| `blend(x, y, c, a)` | mix `c` over the pixel by `a` (0–1) |
| `fill(c)` / `clear()` | whole canvas |
| `rect(x0, y0, x1, y1, c)` | filled rectangle (inclusive) |
| `hline(x0, x1, y, c)` / `vline(x, y0, y1, c)` | straight lines |
| `line(x0, y0, x1, y1, c)` | any line, pixel-perfect |
| `disc(cx, cy, r, c)` / `ellipse(cx, cy, rx, ry, c)` | filled circle / ellipse |
| `poly([[x, y], ...], c)` | filled polygon (mountains, roofs, domes, hills) |
| `vgradient(y0, y1, [colours], x0?, x1?)` | dithered vertical gradient (skies, water) |
| `glow(cx, cy, r, c, strength)` | round stepped light (lamps, the moon, windows) |
| `copy(src)` | copy a same-size canvas (the static base each frame; fast) |
| `stamp(src, x, y, { anchor, flip, tint })` | draw another canvas: `anchor` is `top-left`, `bottom-center` or `center`; `tint(colour) → colour` recolours (shadows, reflections) |
| `clone()` | copy |

## Sprites

```js
const lamp = fromRows([
  '.aa.',
  'abba',
  '.aa.',
], { a: '#3a2416', b: '#ffcf6b' })        // '.' or ' ' is transparent

c.stamp(lamp, x, groundY, { anchor: 'bottom-center' })

const walk = fromFrames([[...rows], [...rows], [...rows], [...rows]], palette)
c.stamp(walk[frameAt(phase, walk.length, 40)], x, y, { anchor: 'bottom-center' })
```

For bigger sprites (characters, buildings), draw them with the canvas tools into an alpha canvas in
`setup()` instead of typing rows: `const him = new Canvas(16, 28, { alpha: true }); him.rect(...)`.
For many frames, write a function `drawPerson(canvas, frameIndex)` and call it per frame.

## Colour and noise helpers

| | |
|---|---|
| `mix(a, b, t)` | blend two colours |
| `rgb(c)` / `hex(n)` | convert |
| `shade([dark, ..., light], light01, x, y, spread?)` | pick from a ramp with dithered seams |
| `bayer(x, y)` | 4×4 ordered-dither threshold, 0–1 |
| `hash(x, y)` | deterministic 0–1 per position or index |
| `rng(seed)` | seeded random generator |
| `noise(x, y)` / `fbm(x, y, octaves)` | smooth value noise / fractal noise, 0–1 (terrain, clouds, texture) |
| `clamp`, `lerp`, `wrap`, `smooth`, `TAU` | math |

## scene.json

```jsonc
{
  "label": "Harbour at Night",
  "subtitle": "Fishing boats and lanterns",

  // Optional overrides of studio.json:
  "resolution": [320, 180],  // keep 1920×1080 a whole multiple of it
  "fps": 24,
  "loopSeconds": 60,

  // Written into the omarchy-live-wallpaper pack by `npm run export`:
  "pack": {
    "label": "Harbour at Night",
    "subtitle": "Fishing boats and lanterns",
    "order": 3,
    "glow": "ffcf6b",                                  // window shadow colour
    "bar": { "background": "0c1230", "alpha": 0.8, "text": "f6f0d4", "active": "ffcf6b", "border": ["34437a", "ffcf6b"] }
  }
}
```

Anything else you add (scene-specific options) is available to the scene as `meta`.

## Performance

Rendering is not real-time, so scenes can afford more than the Raspberry Pi version could. Still,
build static things once in `setup()` and copy them each frame: a 60 s loop is 1,440 frames.
