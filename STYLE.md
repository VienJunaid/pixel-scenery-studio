# Style guide: pixel art

This file is what makes this studio a **pixel-art** studio. The engine and the workflow are shared
with studios in other styles; this guide is not. Follow it for every scene.

## Canvas

- Art is drawn at **320×180** and scaled ×6 to 1920×1080 with nearest-neighbour, so every art pixel
  is a crisp 6×6 square. Never smooth, blur or anti-alias.
- The wallpaper is cropped to fill the screen, so keep the focus inside the middle ~80% horizontally.
- The top ~12 px sit under the Omarchy bar. Keep it simple there: sky, not detail.

## Colour

- **Limited palettes.** Aim for 16–32 colours per scene. Name them in a `C` object at the top of
  `scene.mjs` and use the names. Pull key colours from the references.
- **Ramps, not random shades.** Each material (stone, sand, foliage, cloth) gets a ramp of 3–5
  colours from dark to light. Shift hue along the ramp: shadows cooler (toward blue/purple),
  highlights warmer (toward yellow/orange). Don't just darken with black.
- **Night scenes** are blue-dominant with warm light sources (lanterns, windows, the moon) as accents.
- **Atmospheric perspective:** things far away are lighter, lower in contrast and tinted toward the
  sky colour.

## Light and shading

- **Light comes from the left** unless the scene says otherwise (a sunset on the right, for example):
  lit faces on the left, shade on the right. State it in the brief if it differs.
- **Dither the seams** between two shades of a ramp with the 4×4 Bayer pattern (`bayer`, `shade`,
  `vgradient`). Don't dither everywhere; flat areas of colour read as pixel art too.
- **Glows** are round and stepped: a bright 1–2 px core plus a dithered halo (`c.glow`). Never a
  smooth radial gradient.

## Shapes

- **Clean outlines.** Lines one pixel wide, no doubled corners ("jaggies"). Curves step evenly:
  1-1-2-2-3 pixels, not 1-3-1-2.
- **Minimum readable size.** Shapes under ~5 px turn into symbols: a 5-px diamond reads as `+`, a
  thin tower with a crossbar reads as `†`. Make important details bigger or leave them out.
- **Silhouette first.** Buildings and characters should be recognisable from their outline alone.
  Get the silhouette right before adding detail.
- **Integer positions.** Round everything; anchor repeating patterns on whole numbers.

## Characters

- **Faces are plain:** a skin-coloured shape with no eyes, nose or mouth. A niqab is solid black
  with no eye slit.
- **Proportions:** an adult is about 20–30 px tall at this resolution, about 3 heads tall (chibi-ish,
  so outfits read clearly). Keep everyone in a scene on the same scale.
- **Outfits** follow the culture of the place. His wife always wears hijab (under any traditional
  headpiece).
- Outline characters against busy backgrounds with a darker shade of their own colours, not black.
- **Animation** is a few frames: 2 for idle breathing or cloth in the wind, 4–6 for a walk cycle.
  Pick frames with `frameAt(phase, frames.length, cycles)`.

## Motion

- **Calm.** A wallpaper sits behind work all day. Prefer slow, small, repeating motion: ripples,
  drifting clouds, flickering lights, birds, steam, swaying grass, a slow walk.
- Nothing flashes or changes suddenly, except rare, small events (one shooting star per loop).
- Moving things use whole-pixel steps; sub-pixel motion just jitters.
- **Every motion is periodic in the loop** (see docs/scene-api.md, "Seamless loops").

## Composition

- Horizon at about a third or two thirds of the height, not the middle.
- Layers from far to near, each darker or more saturated than the one behind it.
- One focal point (a landmark, the characters). Everything else supports it.
- A dark foreground element at a corner (rocks, reeds, an arch, a tree) frames the scene and adds
  depth.

## Checklist before showing a preview

- [ ] No faces with features; outfits and hijab per the rules
- [ ] Nothing traced from a reference
- [ ] Palette is limited and named; ramps shift hue
- [ ] Light direction is consistent
- [ ] No tiny shapes that read as symbols
- [ ] Focus sits in the middle 80%; the top strip is quiet
- [ ] Loop check passes
