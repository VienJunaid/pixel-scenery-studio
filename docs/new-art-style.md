# Making a studio for another art style

This repo is the **pixel-art** studio. Its structure is meant to be reused for other styles
(watercolour, ink, low-poly, anime, vector, ...), one repo per style, each producing live wallpapers
the same way.

## What's shared and what's style-specific

| Part | Shared across styles | Pixel-art specific |
|---|---|---|
| The interview and workflow in `CLAUDE.md` | ✓ | the "Art style" line and links |
| `scenes/<id>/` layout: `brief.md`, `scene.json`, `scene.mjs`, `reference/` | ✓ | |
| `engine/render.mjs` previews, loop check, MP4 | ✓ | the nearest-neighbour upscale |
| `engine/export.mjs`, `engine/new-scene.mjs` | ✓ | |
| `studio.json` | the fields | the values: `style`, `resolution`, `pack` |
| `STYLE.md` | | ✓ all of it |
| `engine/pixels.mjs` | Canvas, noise, loop helpers | dithering, stepped glows, `fromRows` |
| The owner's standing rules (plain faces, hijab, culture-matched outfits, no tracing) | ✓ keep them | |

## Steps

1. Copy the repo: `cp -r pixel-scenery-studio <style>-scenery-studio`, delete `.git`, `out/`, the
   scenes you don't want, then `git init`.
2. **`studio.json`:** set `name`, `style` (e.g. `"watercolor"`), and `pack.id` / `pack.name` so its
   wallpapers go into their own pack in the picker.
3. **`STYLE.md`:** rewrite it for the new style: palette rules, how light and shading work, line
   quality, texture, how characters are drawn, what motion suits it. Keep the character rules and
   the checklist shape.
4. **Resolution and scaling.** Pixel art draws small and upscales with hard edges. A smooth style
   should draw at full size: set `resolution` to `[1920, 1080]` so the upscale is ×1, and use
   anti-aliased drawing.
5. **The drawing engine.** For a smooth style, the simplest swap is a real 2D canvas library
   (`@napi-rs/canvas` or `skia-canvas`: gradients, curves, blur, anti-aliasing, image textures).
   Keep the scene contract the same (`setup` / `draw(c, { phase, ... })`) and the frame handed to
   ffmpeg as raw RGB, and `render.mjs`, the loop check and export keep working.
6. **`CLAUDE.md`:** change the title and the "Art style" line, point at the new `STYLE.md`, and
   replace the worked example (`lantern-lake`) with one in the new style. Keep the interview, the
   preview loop and the standing rules.
7. Make one example scene, check the loop and the export, and you have a new studio.

## Naming

`<style>-scenery-studio`, e.g. `watercolor-scenery-studio`, with pack id `<style>-scenery`, so
every studio's wallpapers sit in their own pack in the same picker.
