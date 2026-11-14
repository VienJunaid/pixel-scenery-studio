#!/usr/bin/env node
// Install a rendered scene into an omarchy-live-wallpaper pack, so it shows up in the picker.
//
//   node engine/export.mjs <id>                 → ~/.config/omarchy-live-wallpaper/packs/<studio pack>/
//   node engine/export.mjs <id> --pack my-pack  → a different pack folder
//   node engine/export.mjs --all                → every scene that has a rendered MP4
//
// Copies out/<id>/<id>.mp4 to the pack's videos/ and merges the scene's "pack" block from
// scene.json (label, subtitle, order, glow, bar colours) into pack.json. Other packs and other
// scenes in the pack are left alone.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { OUT, SCENES, parseArgs, readJson, studio } from './studio.mjs'

const { args, flags } = parseArgs()
const s = studio()
const packId = flags.pack ?? s.pack.id
const packDir = path.join(os.homedir(), '.config', 'omarchy-live-wallpaper', 'packs', packId)

const ids = flags.all
  ? readdirSync(SCENES).filter((d) => existsSync(path.join(OUT, d, `${d}.mp4`)))
  : args
if (!ids.length) {
  console.error('Usage: node engine/export.mjs <scene-id> [--pack <pack-id>] | --all')
  process.exit(1)
}

mkdirSync(path.join(packDir, 'videos'), { recursive: true })
const packFile = path.join(packDir, 'pack.json')
const pack = existsSync(packFile) ? readJson(packFile) : { name: s.pack.name, description: s.pack.description }
pack.scenes ??= {}

for (const id of ids) {
  const video = path.join(OUT, id, `${id}.mp4`)
  if (!existsSync(video)) {
    console.error(`[${id}] not rendered yet: run \`npm run render -- ${id}\` first`)
    process.exitCode = 1
    continue
  }
  copyFileSync(video, path.join(packDir, 'videos', `${id}.mp4`))
  const metaFile = path.join(SCENES, id, 'scene.json')
  const info = existsSync(metaFile) ? readJson(metaFile).pack ?? {} : {}
  pack.scenes[id] = { ...pack.scenes[id], ...info }
  console.log(`[${id}] → ${path.join(packDir, 'videos', `${id}.mp4`)}`)
}

writeFileSync(packFile, JSON.stringify(pack, null, 2) + '\n')
console.log(`pack.json updated: ${packFile}`)
console.log(`Try it:  live-wallpaper set ${packId}/${ids[0]}`)
