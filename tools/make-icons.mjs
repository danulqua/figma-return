// Draws the extension icon and writes icons/icon-{16,32,48,128}.png.
// No dependencies: shapes are signed-distance functions, antialiased by
// supersampling, and the PNGs are written by hand with node:zlib.
//
// Run: node tools/make-icons.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const SIZES = [16, 32, 48, 128];
const SAMPLES = 8; // 8x8 samples per pixel

// Design, in units of the icon size (0..1).
const MARGIN = 1 / 16;
const TILE_RADIUS = 0.22 * (1 - 2 * MARGIN);
const COLOR_FROM = [0x7b, 0x61, 0xff]; // violet, top-left
const COLOR_TO = [0xff, 0x4d, 0x8d]; // pink, bottom-right

const STROKE = 0.115; // arrow stroke width
const HOOK_CX = 0.6; // center of the half-circle hook
// Optically centered: the hook carries most of the weight, so the shape sits
// a bit below the middle of its bounding box.
const HOOK_CY = 0.47;
const HOOK_R = 0.155;
const TOP_Y = HOOK_CY - HOOK_R;
const BOTTOM_Y = HOOK_CY + HOOK_R;
const TOP_START_X = 0.3; // left end of the top stroke
const HEAD_TIP_X = 0.2; // arrowhead tip (points left)
const HEAD_BASE_X = 0.43;
const HEAD_HALF = 0.15; // half the height of the arrowhead base

// --- signed distance functions (negative = inside) ---

function sdRoundRect(x, y, cx, cy, halfW, halfH, r) {
  const qx = Math.abs(x - cx) - halfW + r;
  const qy = Math.abs(y - cy) - halfH + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - r;
}

function sdCapsule(x, y, ax, ay, bx, by, halfWidth) {
  const px = x - ax, py = y - ay;
  const dx = bx - ax, dy = by - ay;
  const t = Math.min(Math.max((px * dx + py * dy) / (dx * dx + dy * dy), 0), 1);
  return Math.hypot(px - dx * t, py - dy * t) - halfWidth;
}

// Right half of a ring (the part with x >= cx), with round ends.
function sdHalfRing(x, y, cx, cy, r, halfWidth) {
  if (x >= cx) return Math.abs(Math.hypot(x - cx, y - cy) - r) - halfWidth;
  const top = Math.hypot(x - cx, y - (cy - r));
  const bottom = Math.hypot(x - cx, y - (cy + r));
  return Math.min(top, bottom) - halfWidth;
}

// Inside test for a triangle with vertices a, b, c.
function inTriangle(x, y, ax, ay, bx, by, cx, cy) {
  const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
  const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
  const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

// --- the icon ---

function inTile(x, y) {
  const half = 0.5 - MARGIN;
  return sdRoundRect(x, y, 0.5, 0.5, half, half, TILE_RADIUS) <= 0;
}

function inArrow(x, y) {
  const hw = STROKE / 2;
  return (
    sdCapsule(x, y, TOP_START_X, TOP_Y, HOOK_CX, TOP_Y, hw) <= 0 ||
    sdHalfRing(x, y, HOOK_CX, HOOK_CY, HOOK_R, hw) <= 0 ||
    sdCapsule(x, y, HEAD_BASE_X, BOTTOM_Y, HOOK_CX, BOTTOM_Y, hw) <= 0 ||
    inTriangle(
      x, y,
      HEAD_TIP_X, BOTTOM_Y,
      HEAD_BASE_X, BOTTOM_Y - HEAD_HALF,
      HEAD_BASE_X, BOTTOM_Y + HEAD_HALF,
    )
  );
}

function gradient(x, y) {
  const span = 2 * (1 - 2 * MARGIN);
  const t = Math.min(Math.max((x - MARGIN + (y - MARGIN)) / span, 0), 1);
  return COLOR_FROM.map((from, i) => from + (COLOR_TO[i] - from) * t);
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const n = SAMPLES * SAMPLES;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // Accumulate premultiplied color over the samples.
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) / size;
          const y = (py + (sy + 0.5) / SAMPLES) / size;
          if (!inTile(x, y)) continue;
          const c = inArrow(x, y) ? [255, 255, 255] : gradient(x, y);
          r += c[0]; g += c[1]; b += c[2]; a += 1;
        }
      }
      const i = (py * size + px) * 4;
      if (a > 0) {
        rgba[i] = Math.round(r / a);
        rgba[i + 1] = Math.round(g / a);
        rgba[i + 2] = Math.round(b / a);
        rgba[i + 3] = Math.round((a / n) * 255);
      }
    }
  }
  return rgba;
}

// --- PNG encoding ---

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // compression, filter, interlace: all 0

  // Each row starts with filter type 0 (none).
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = new URL('../icons/', import.meta.url);
mkdirSync(outDir, { recursive: true });
for (const size of SIZES) {
  const file = new URL(`icon-${size}.png`, outDir);
  writeFileSync(file, encodePng(size, render(size)));
  console.log(`wrote icons/icon-${size}.png`);
}
