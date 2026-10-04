// Generate the Pactmark PNG icon set with zero dependencies.
//
// Usage (from the repository root):
//
//   node scripts/icons/generate-icons.mjs
//
// Renders the seal mark programmatically (rounded ink tile, wax-red disc,
// cream ring and check) into antialiased RGBA buffers and writes standards
// sizes for favicons, apple-touch-icon, web manifest icons and a maskable
// variant under public/icons/, plus public/site.webmanifest. Everything is
// drawn with signed distance fields, so any output size stays crisp.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const outDir = resolve(root, "public", "icons");

// ---------------------------------------------------------------- PNG encoder

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (stride + 1);
    raw[row] = 0; // filter: none
    rgba.copy(raw, row + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ------------------------------------------------------------- signed fields

const sdCircle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r;

function sdSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function sdRoundBox(px, py, halfW, halfH, radius) {
  const qx = Math.abs(px) - (halfW - radius);
  const qy = Math.abs(py) - (halfH - radius);
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    radius
  );
}

const smooth = (edge0, edge1, x) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const cover = (dist, aa) => smooth(aa, -aa, dist);
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

function over(dst, dstA, src, srcA) {
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return [[0, 0, 0], 0];
  const out = dst.map((c, i) => (src[i] * srcA + c * dstA * (1 - srcA)) / outA);
  return [out, outA];
}

// ------------------------------------------------------------ the seal mark

const INK_TOP = [34, 26, 16];
const INK_BOTTOM = [20, 15, 10];
const WAX_CENTER = [198, 58, 34];
const WAX_EDGE = [141, 33, 15];
const CREAM = [242, 231, 206];
const SHADOW = [8, 5, 3];

function render(size, { maskable = false } = {}) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const R = (maskable ? 0.3 : 0.36) * s;
  const simple = s <= 32; // drop the thin ring at favicon sizes
  const aa = Math.max(0.75, s / 512);
  const rgba = Buffer.alloc(s * s * 4);

  const checkA = [-0.155 * s, 0.005 * s];
  const checkB = [-0.035 * s, 0.125 * s];
  const checkC = [0.175 * s, -0.115 * s];
  const checkW = (simple ? 0.1 : 0.075) * s;
  const ringR = 0.262 * s;
  const ringW = 0.016 * s;

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const px = x + 0.5;
      const py = y + 0.5;

      // base tile
      let color = mix3(INK_TOP, INK_BOTTOM, py / s);
      let alpha = 1;
      if (!maskable) {
        const dTile = sdRoundBox(px - cx, py - cy, s / 2, s / 2, 0.24 * s);
        alpha = cover(dTile, aa);
      }

      // soft contact shadow under the disc
      const dShadow = sdCircle(px, py, cx + 0.012 * s, cy + 0.03 * s, R * 1.02);
      const shadowA = cover(dShadow, 0.055 * s) * 0.5 * alpha;
      [color, alpha] = over(color, alpha, SHADOW, shadowA);

      // wax disc with radial shading
      const distCenter = Math.hypot(px - cx, py - cy);
      const dDisc = distCenter - R;
      const discA = cover(dDisc, aa) * alpha;
      const wax = mix3(WAX_CENTER, WAX_EDGE, Math.pow(Math.min(distCenter / R, 1), 1.25));
      [color, alpha] = over(color, alpha, wax, discA);

      if (!simple) {
        const dRing = Math.abs(distCenter - ringR) - ringW / 2;
        const ringA = cover(dRing, aa) * 0.92 * discA;
        [color, alpha] = over(color, alpha, CREAM, ringA);
      }

      // the check stroke
      const dCheck =
        Math.min(
          sdSegment(px, py, cx + checkA[0], cy + checkA[1], cx + checkB[0], cy + checkB[1]),
          sdSegment(px, py, cx + checkB[0], cy + checkB[1], cx + checkC[0], cy + checkC[1])
        ) - checkW / 2;
      const checkA_ = cover(dCheck, aa) * discA;
      [color, alpha] = over(color, alpha, CREAM, checkA_);

      const i = (y * s + x) * 4;
      rgba[i] = Math.round(Math.max(0, Math.min(255, color[0])));
      rgba[i + 1] = Math.round(Math.max(0, Math.min(255, color[1])));
      rgba[i + 2] = Math.round(Math.max(0, Math.min(255, color[2])));
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return rgba;
}

// ------------------------------------------------------------------ outputs

mkdirSync(outDir, { recursive: true });

const sizes = [16, 32, 48, 64, 120, 180, 192, 512];
const written = [];
for (const size of sizes) {
  const file = resolve(outDir, `icon-${size}.png`);
  writeFileSync(file, encodePng(size, render(size)));
  written.push(`public/icons/icon-${size}.png`);
}
writeFileSync(resolve(outDir, "maskable-512.png"), encodePng(512, render(512, { maskable: true })));
written.push("public/icons/maskable-512.png");

const manifest = {
  name: "Pactmark",
  short_name: "Pactmark",
  description: "Evidence-based agreement protocol for digital work on GenLayer Studionet.",
  start_url: "/",
  display: "standalone",
  background_color: "#f4efe4",
  theme_color: "#141009",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
writeFileSync(resolve(root, "public", "site.webmanifest"), JSON.stringify(manifest, null, 2) + "\n");
written.push("public/site.webmanifest");

console.log("Pactmark icon set generated:");
for (const file of written) console.log("  " + file);
console.log("");
console.log("Reference them from index.html, e.g. apple-touch-icon: /icons/icon-180.png");
