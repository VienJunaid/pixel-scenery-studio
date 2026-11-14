#!/usr/bin/env node
// Render a scene.
//
//   node engine/render.mjs <id> --preview        PNG stills in out/<id>/ (fast; look at these first)
//   node engine/render.mjs <id> --at 0.3          one still at that point in the loop (0–1)
//   node engine/render.mjs <id> --check-loop      does the last frame flow into the first?
//   node engine/render.mjs <id>                   the full looping MP4: out/<id>/<id>.mp4
//
// Options: --seconds N (loop length), --fps N, --scale N (preview zoom, default 3)
//
// Frames are drawn in Node and piped straight into ffmpeg as raw pixels, then scaled up with
// nearest-neighbour so the pixels stay crisp. Deterministic: the same scene always renders the
// same video.
import { spawn } from 'node:child_process'
import { mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { Canvas } from './pixels.mjs'
import * as lib from './pixels.mjs'
import { writePng } from './png.mjs'
import { OUT, loadScene, parseArgs } from './studio.mjs'

const { args, flags } = parseArgs()
const id = args[0]
if (!id) {
  console.error('Usage: node engine/render.mjs <scene-id> [--preview | --at 0.3 | --check-loop]')
  process.exit(1)
}

const { cfg, mod } = await loadScene(id)
if (flags.seconds) cfg.loopSeconds = Number(flags.seconds)
if (flags.fps) cfg.fps = Number(flags.fps)
const { width: w, height: h, fps, loopSeconds } = cfg
const outDir = path.join(OUT, id)
mkdirSync(outDir, { recursive: true })

if (typeof mod.draw !== 'function') throw new Error(`scenes/${id}/scene.mjs must export draw(c, frame)`)
const state = (await mod.setup?.({ w, h, meta: cfg.meta, lib })) ?? {}

/** Draw the scene at loop position `phase` (0–1). `t` is seconds into the loop. */
function frameAt(phase, index = 0) {
  const c = new Canvas(w, h)
  mod.draw(c, { phase, t: phase * loopSeconds, frame: index, fps, loopSeconds, w, h, state, lib })
  return c
}

const diffPct = (a, b) => {
  let n = 0
  for (let i = 0; i < a.data.length; i += 3)
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++
  return (100 * n) / (w * h)
}

/** Compare the very start of the loop with the very end (phase 1 should equal phase 0). */
function checkLoop() {
  const pct = diffPct(frameAt(0), frameAt(1))
  const ok = pct < 0.5
  console.log(`[${id}] loop check: ${pct.toFixed(2)}% of pixels differ between the end and the start ${ok ? '✓ seamless' : '✗ will visibly jump'}`)
  if (!ok) console.log('  Fix: drive motion from `phase` with whole-number cycle counts (osc, travel, pulse), not from `t`.')
  return ok
}

const scale = Number(flags.scale ?? 3)

if (flags.preview) {
  // One big still plus a 2×2 sheet across the loop, so motion can be judged without a video.
  const shots = [0, 0.25, 0.5, 0.75].map((p, i) => frameAt(p, i))
  writePng(path.join(outDir, 'preview.png'), w, h, shots[0].data, scale)
  const gap = 2, sheet = new Canvas(w * 2 + gap, h * 2 + gap)
  sheet.fill('#000000')
  shots.forEach((s, i) => sheet.stamp(s, (i % 2) * (w + gap), Math.floor(i / 2) * (h + gap)))
  writePng(path.join(outDir, 'sheet.png'), sheet.w, sheet.h, sheet.data, 2)
  console.log(`[${id}] ${w}×${h} px`)
  console.log(`  ${path.relative(process.cwd(), path.join(outDir, 'preview.png'))}   (start of loop, ×${scale})`)
  console.log(`  ${path.relative(process.cwd(), path.join(outDir, 'sheet.png'))}     (0%, 25%, 50%, 75% through the loop)`)
  checkLoop()
} else if (flags.at !== undefined) {
  const p = Number(flags.at)
  const file = path.join(outDir, `at-${p}.png`)
  writePng(file, w, h, frameAt(p).data, scale)
  console.log(`[${id}] ${path.relative(process.cwd(), file)}`)
} else if (flags['check-loop']) {
  process.exit(checkLoop() ? 0 : 1)
} else {
  checkLoop()
  const total = Math.round(loopSeconds * fps)
  const file = path.join(outDir, `${id}.mp4`)
  const { outWidth, outHeight } = cfg
  if (outWidth % w || outHeight % h) console.warn(`  note: ${outWidth}×${outHeight} is not a whole multiple of ${w}×${h}, so pixels will be uneven`)
  console.log(`[${id}] ${total} frames (${loopSeconds}s at ${fps} fps), ${w}×${h} → ${outWidth}×${outHeight}`)

  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-',
    '-vf', `scale=${outWidth}:${outHeight}:flags=neighbor`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-tune', 'animation',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
    file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((res, rej) => {
    ff.on('error', (e) => rej(e.code === 'ENOENT' ? new Error('ffmpeg is not installed') : e))
    ff.on('exit', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited with ${code}`))))
  })

  const started = Date.now()
  for (let i = 0; i < total; i++) {
    const c = frameAt(i / total, i)
    if (!ff.stdin.write(Buffer.from(c.data.buffer, c.data.byteOffset, c.data.byteLength)))
      await new Promise((r) => ff.stdin.once('drain', r))
    if (i % (fps * 10) === 0) process.stdout.write(`  frame ${i}/${total}\r`)
  }
  ff.stdin.end()
  await done
  const mb = (statSync(file).size / 1e6).toFixed(1)
  console.log(`  done in ${((Date.now() - started) / 1000).toFixed(1)}s → ${path.relative(process.cwd(), file)} (${mb} MB)`)
}
