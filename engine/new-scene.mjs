#!/usr/bin/env node
// Scaffold a new scene from templates/scene/.
//
//   node engine/new-scene.mjs <id> [--label "Harbour at Night"] [--subtitle "..."] [--from inbox/]
//
// --from copies reference images (a file or a folder of them) into scenes/<id>/reference/.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ROOT, SCENES, parseArgs } from './studio.mjs'

const { args, flags } = parseArgs()
const id = args[0]
if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('Usage: node engine/new-scene.mjs <id> [--label "..."] [--from <image or folder>]')
  console.error('  id: lowercase words joined by dashes, e.g. harbour-at-night')
  process.exit(1)
}
const dir = path.join(SCENES, id)
if (existsSync(dir)) {
  console.error(`scenes/${id} already exists`)
  process.exit(1)
}

const label = flags.label ?? id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
const fill = (text) => text
  .replaceAll('{{id}}', id)
  .replaceAll('{{label}}', label)
  .replaceAll('{{subtitle}}', flags.subtitle ?? '')
  .replaceAll('{{date}}', new Date().toISOString().slice(0, 10))

const tpl = path.join(ROOT, 'templates', 'scene')
mkdirSync(path.join(dir, 'reference'), { recursive: true })
for (const f of readdirSync(tpl)) writeFileSync(path.join(dir, f), fill(readFileSync(path.join(tpl, f), 'utf8')))

const IMG = /\.(png|jpe?g|webp|gif|bmp)$/i
let copied = 0
if (flags.from) {
  const src = path.resolve(flags.from)
  const files = statSync(src).isDirectory() ? readdirSync(src).filter((f) => IMG.test(f)).map((f) => path.join(src, f)) : [src]
  for (const f of files) { copyFileSync(f, path.join(dir, 'reference', path.basename(f))); copied++ }
}

console.log(`Created scenes/${id}/  (${readdirSync(tpl).join(', ')}${copied ? `, ${copied} reference image(s)` : ''})`)
console.log(`Next: fill in scenes/${id}/brief.md, draw in scene.mjs, then \`npm run preview -- ${id}\``)
