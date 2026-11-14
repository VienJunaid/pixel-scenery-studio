# CLAUDE.md: Pixel Scenery Studio

Read this first in every session. This repo turns a description and a few reference images into a
**pixel-art live wallpaper**: a seamless looping MP4 that plays on the Omarchy desktop through
[omarchy-live-wallpaper](https://github.com/VienJunaid/omarchy-live-wallpaper).

**Art style: pixel art.** This is the pixel-art studio. The repo is laid out so it can be copied to
make studios in other styles; only `STYLE.md`, `studio.json` and (sometimes) the drawing helpers
change. See [docs/new-art-style.md](docs/new-art-style.md).

## Your job

The owner (Vien) wants making a new scene to be easy. When they ask for a new scene, or run
`/new-scene`, **interview them first, then build it**. Don't start drawing from a one-line request.

Claude writes all the code here. The owner describes, supplies images and judges previews.

## The workflow

### 1. Interview

Ask in small rounds, not one wall of questions. Use the AskUserQuestion tool for anything with
obvious choices; ask in plain text for descriptions. Skip anything they already told you.

1. **The scene.** What place or idea? Real or imagined? What is the main focus?
2. **References.** Are there images? Check `inbox/` first and say what you found. They can also
   give a path or a folder. For each image, ask what to take from it: the composition, the colours,
   a building, a person's outfit, or the whole vibe.
3. **Time and mood.** Time of day, weather, season, where the light comes from, calm or lively.
4. **Characters.** None, or who? For each: who they are, outfit, pose, what they're doing, where
   they stand. If one of them is drawn from a photo, ask which person in the photo is which.
   Apply the owner's standing rules (below) without asking again.
5. **Motion.** What should move? Offer ideas that fit the place (water ripples, clouds, birds,
   lanterns, steam, flags, walking people, falling snow). Wallpapers should be calm.
6. **Wallpaper details.** The picker label and a short subtitle. Optionally a schedule slot (a prayer
   time or a clock time) for the pack. Loop length if not the 60 s default.

Then **read back a short summary** and get a yes before drawing.

### 2. Set up the scene folder

```bash
npm run new -- <id> --label "Label" --subtitle "Subtitle" --from inbox/    # --from is optional
```

`<id>` is lowercase words with dashes (`harbour-at-night`). This makes `scenes/<id>/` with
`scene.json`, `brief.md`, `scene.mjs` and `reference/`. After copying images from `inbox/`, ask
before deleting them from the inbox.

Write the interview answers into `scenes/<id>/brief.md`. It is the source of truth for the scene.

### 3. Study the references

Open every reference image with the Read tool. Note the composition (horizon height, where the focus
sits, what's in front and behind), the key colours as hex, and details of buildings and outfits.
Write these into the brief. **References are for composition and colour only: draw everything
fresh, never trace pixels from or embed a photo.**

### 4. Draw

Write `scenes/<id>/scene.mjs`. Read [docs/scene-api.md](docs/scene-api.md) for the API and
[STYLE.md](STYLE.md) for the rules of the style. `scenes/lantern-lake/scene.mjs` is a complete
worked example. In short:

- `setup()` builds everything static once (sky, landscape, buildings) into canvases.
- `draw()` copies the static layer, then draws only what moves.
- **All motion comes from `phase` (0 → 1 over the loop) with whole-number cycle counts**, so the
  video loops with no jump. Never use `Math.random()`; use `hash()` or `rng(seed)`.
- Characters are sprites (`fromRows` with a palette, or drawn with the canvas tools into an alpha
  canvas). Walk cycles are several frames picked with `frameAt()`.

Plan in layers, far to near: sky → far scenery → main landmark → middle ground → characters →
foreground. Reuse helpers from earlier scenes when they fit (copy them in; scenes don't import each
other, so each one stays independent).

### 5. Preview and iterate

```bash
npm run preview -- <id>
```

Writes `out/<id>/preview.png` (the first frame, ×3) and `out/<id>/sheet.png` (four moments across
the loop), and checks the loop. **Look at both images yourself with Read before showing the owner.**
Fix anything that breaks STYLE.md first. Then tell the owner the file paths and ask what to change.
Repeat until they're happy, and log each round of changes in the brief's "Decisions" section.

`npm run render -- <id> --at 0.4` grabs a single moment if you need to check something mid-loop.

### 6. Render and install

```bash
npm run render -- <id>      # out/<id>/<id>.mp4, 1920×1080, seamless loop (a few seconds)
npm run export -- <id>      # copies it into the omarchy-live-wallpaper pack + updates pack.json
live-wallpaper set pixel-scenery/<id>
```

Fill in `scene.json → pack` before exporting: `glow` and `bar` colours (hex without `#`) taken from
the scene's palette, so the Omarchy bar matches. Without them, live-wallpaper samples colours from
the video. If the owner wants the scene on a schedule, edit the pack's `schedule` in
`~/.config/omarchy-live-wallpaper/packs/pixel-scenery/pack.json` (format in
omarchy-live-wallpaper's `docs/creating-a-pack.md`).

### 7. Wrap up

Tell the owner what was made, where the video is, and how to switch to it. Don't commit or push
unless they ask.

## Owner's standing rules (apply without asking)

- **Faces are always plain:** no eyes, nose or mouth on any character. A niqab is solid black with
  no eye slit.
- **Outfits follow the culture of the place** in the scene.
- **His wife always wears hijab**, even if a reference photo shows her without one. When the local
  dress has a hat or headpiece, she wears the hijab under it.
- **References are for composition only.** Draw original pixel art; never trace or embed a photo
  (some are watermarked stock images).
- **Personal images** (wedding photos, photos of the couple) stay in that scene's `reference/`
  folder. Never put them in `docs/` or the README.
- **No sound.** Wallpapers are silent (the render adds no audio track).
- **Don't commit or push without being asked.**

## Commands

| Command | What it does |
|---|---|
| `npm run new -- <id> [--label ..] [--subtitle ..] [--from inbox/]` | scaffold `scenes/<id>/` |
| `npm run preview -- <id>` | `preview.png` + `sheet.png` in `out/<id>/`, plus a loop check |
| `npm run render -- <id> --at 0.3` | one still at 30% through the loop |
| `npm run check -- <id>` | loop check only (exit code 1 if it would jump) |
| `npm run render -- <id>` | the full MP4 |
| `npm run export -- <id>` / `--all` | install into the live-wallpaper pack |

Needs only Node 20+ and `ffmpeg`. No npm install.

## Layout

```
studio.json          the style name, resolution (320×180 art → 1920×1080 video), fps, loop, pack id
STYLE.md             the pixel-art rules: what makes a scene look right
engine/pixels.mjs    the drawing toolkit (Canvas, shapes, gradients, dithering, glows, sprites, noise, loop helpers)
engine/render.mjs    previews, loop check, MP4 (frames piped raw into ffmpeg, nearest-neighbour upscale)
engine/export.mjs    install into an omarchy-live-wallpaper pack
engine/new-scene.mjs scaffold from templates/scene/
scenes/<id>/         scene.json (labels, pack colours, overrides), brief.md, scene.mjs, reference/
inbox/               drop images here before a new scene (gitignored)
out/                 renders (gitignored)
```

## History

This studio was split out of `rpi-dashboard`, where the original scenes (Al-Aqsa, the Kaaba,
Madinah, Hagia Sophia, the Al-Farooq night market, the Kazakh meadow, the horse journey) are drawn
by a Svelte/WebGL app and recorded to video with puppeteer. Their effect code
(`rpi-dashboard/apps/web/src/scene/backgrounds/*.ts`) and sprite generators
(`rpi-dashboard/scripts/art/*.mjs`) are a good source of techniques to port: the drawing ideas carry
over directly, only the API names differ. Here, scenes render straight to video with no browser,
and loops are exact.

## Gotchas

- **Tiny shapes read as crosses.** A 5-px diamond looks like `+`; a minaret with a balcony
  crossbar looks like `†`. Use diamonds of 9 px or more, round glows, and domes or cones instead of
  crossbars. (Learned in rpi-dashboard.)
- **Fractional pattern centres:** `(x − cx) % n` with a fractional `cx` never hits 0, so pattern
  lines vanish. Use integer anchors.
- **Loop jumps** come from motion driven by `t` or from non-integer cycle counts. The loop check
  catches them.
- **Upscale must be a whole number.** 320×180 → 1920×1080 is ×6. For another resolution, keep the
  ratio exact or pixels come out uneven (render warns).
