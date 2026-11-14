// Minimal PNG writer (RGB, 8-bit) using Node's built-in zlib. Used for previews.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const CRC = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
const crc32 = (buf) => {
  let c = -1
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

/** Write RGB `data` (w×h×3) to `file`, scaled up by an integer `scale` with hard pixel edges. */
export function writePng(file, w, h, data, scale = 1) {
  const W = w * scale, H = h * scale
  const raw = Buffer.alloc((W * 3 + 1) * H)
  for (let Y = 0; Y < H; Y++) {
    const row = Y * (W * 3 + 1), y = Math.floor(Y / scale)
    raw[row] = 0
    for (let X = 0; X < W; X++) {
      const s = (y * w + Math.floor(X / scale)) * 3, d = row + 1 + X * 3
      raw[d] = data[s]
      raw[d + 1] = data[s + 1]
      raw[d + 2] = data[s + 2]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]))
}
