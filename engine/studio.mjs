// Shared helpers for the CLI scripts: paths, settings, loading a scene.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const SCENES = path.join(ROOT, 'scenes')
export const OUT = path.join(ROOT, 'out')

export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
export const studio = () => readJson(path.join(ROOT, 'studio.json'))

// Flags that never take a value, so `--preview my-scene` keeps `my-scene` as the scene id.
const BOOLEAN = new Set(['preview', 'check-loop', 'all'])

/** Split argv into positional args and --flags (`--fps 30`, `--preview`). */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = [], flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) { args.push(a); continue }
    const [k, v] = a.slice(2).split('=')
    if (v !== undefined) flags[k] = v
    else if (BOOLEAN.has(k)) flags[k] = true
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[k] = argv[++i]
    else flags[k] = true
  }
  return { args, flags }
}

/** Load scenes/<id>: its scene.json merged over studio.json defaults, plus its scene.mjs module. */
export async function loadScene(id) {
  const dir = path.join(SCENES, id)
  if (!existsSync(path.join(dir, 'scene.mjs'))) throw new Error(`No scene at scenes/${id}/scene.mjs`)
  const s = studio()
  const meta = existsSync(path.join(dir, 'scene.json')) ? readJson(path.join(dir, 'scene.json')) : {}
  const cfg = {
    id,
    dir,
    meta,
    width: meta.resolution?.[0] ?? s.resolution[0],
    height: meta.resolution?.[1] ?? s.resolution[1],
    outWidth: meta.output?.[0] ?? s.output[0],
    outHeight: meta.output?.[1] ?? s.output[1],
    fps: meta.fps ?? s.fps,
    loopSeconds: meta.loopSeconds ?? s.loopSeconds,
  }
  // Query string so a re-render in the same process (or after an edit) never gets a stale module.
  const mod = await import(pathToFileURL(path.join(dir, 'scene.mjs')).href + `?v=${Date.now()}`)
  return { cfg, mod }
}
