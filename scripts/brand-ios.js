// Draws the ToniKa launcher icon for iOS (Xcode asset catalog).
// Pure Node (zlib only), so it runs inside the CI build with no extra packages.
//
//   node scripts/brand-ios.js [ios/App/App/Assets.xcassets]
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ---------------------------------------------------------------- the design
const BRAND = [91, 51, 224];    // #5B33E0
const WHITE = [255, 255, 255];
const AMBER = [255, 176, 32];   // #FFB020
const CROSS = { x0: 18, x1: 82, y0: 12, y1: 27, r: 7 };   // the T's bar
const STEM  = { x0: 42, x1: 58, y0: 20, y1: 64, r: 8 };   // the T's stem
const DOT   = { cx: 50, cy: 78, r: 9 };                   // the tonic dot

// ---------------------------------------------------------------- geometry
const inRoundRect = (x, y, q) => {
  if (x < q.x0 || x > q.x1 || y < q.y0 || y > q.y1) return false;
  if (x >= q.x0 + q.r && x <= q.x1 - q.r) return true;
  if (y >= q.y0 + q.r && y <= q.y1 - q.r) return true;
  const cx = Math.min(Math.max(x, q.x0 + q.r), q.x1 - q.r);
  const cy = Math.min(Math.max(y, q.y0 + q.r), q.y1 - q.r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= q.r * q.r;
};
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

// What colour sits at this point of the 100x100 canvas? Painter's order:
// background, then the mark. Returns null outside the icon.
function sample(kind, u, v) {
  let col = null;
  if (kind !== "fg") {
    const bg = kind === "round" ? inCircle(u, v, 50, 50, 49) : inRoundRect(u, v, { x0: 1.5, y0: 1.5, x1: 98.5, y1: 98.5, r: 23 });
    if (!bg) return null;
    col = BRAND;
  }
  const k = kind === "fg" ? 0.62 : 0.66;            // the mark inside the canvas
  const mu = (u - 50) / k + 50, mv = (v - 50) / k + 50;
  if (inCircle(mu, mv, DOT.cx, DOT.cy, DOT.r)) return AMBER;
  if (inRoundRect(mu, mv, STEM)) return WHITE;
  if (inRoundRect(mu, mv, CROSS)) return WHITE;
  return kind === "fg" ? null : col;
}

// ---------------------------------------------------------------- rasteriser
function render(kind, size) {
  const SS = 4, N = SS * SS;
  const acc = new Float64Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const u = ((x + (sx + 0.5) / SS) / size) * 100, v = ((y + (sy + 0.5) / SS) / size) * 100;
      const col = sample(kind, u, v);
      if (!col) continue;
      const al = 1;
      r += col[0] * al; g += col[1] * al; b += col[2] * al; a += al * 255;
    }
    const i = (y * size + x) * 4;
    const pr = r / N, pg = g / N, pb = b / N, pa = a / N;
    const un = pa > 0 ? 255 / pa : 0;
    acc[i] = Math.min(255, Math.round(pr * un));
    acc[i + 1] = Math.min(255, Math.round(pg * un));
    acc[i + 2] = Math.min(255, Math.round(pb * un));
    acc[i + 3] = Math.round(pa);
  }
  return Buffer.from(Array.prototype.map.call(acc, x => Math.max(0, Math.min(255, Math.round(x)))));
}

// ---------------------------------------------------------------- PNG writer
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const t = Buffer.from(type, "ascii"); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([l, t, data, c]); };
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- iOS icon sizes
// iOS App Icon sizes (in points) and their scale factors
const IOS_SIZES = [
  // iPhone
  { idiom: "iphone", size: 20, scales: [2, 3] },   // 40, 60
  { idiom: "iphone", size: 29, scales: [1, 2, 3] }, // 29, 58, 87
  { idiom: "iphone", size: 40, scales: [2, 3] },   // 80, 120
  { idiom: "iphone", size: 60, scales: [2, 3] },   // 120, 180
  // iPad
  { idiom: "ipad", size: 20, scales: [1, 2] },     // 20, 40
  { idiom: "ipad", size: 29, scales: [1, 2] },     // 29, 58
  { idiom: "ipad", size: 40, scales: [1, 2] },     // 40, 80
  { idiom: "ipad", size: 76, scales: [1, 2] },     // 76, 152
  { idiom: "ipad", size: 83.5, scales: [2] },      // 167
  // App Store
  { idiom: "ios-marketing", size: 1024, scales: [1] }, // 1024
];

// ---------------------------------------------------------------- output
function writeContentsJson(dir, images) {
  const contents = {
    images: images,
    info: { version: 1, author: "xcode" }
  };
  fs.writeFileSync(path.join(dir, "Contents.json"), JSON.stringify(contents, null, 2));
}

function main(xcassetsDir) {
  const made = [];
  const appIconDir = path.join(xcassetsDir, "AppIcon.appiconset");
  fs.mkdirSync(appIconDir, { recursive: true });

  const images = [];

  for (const entry of IOS_SIZES) {
    for (const scale of entry.scales) {
      const pixelSize = Math.round(entry.size * scale);
      const filename = `icon_${entry.size}x${entry.size}@${scale}x.png`;
      const filepath = path.join(appIconDir, filename);
      
      // Determine icon kind: square for most, round for some
      const isMarketing = entry.idiom === "ios-marketing";
      const kind = isMarketing ? "square" : "round";
      
      const rgba = render(kind, pixelSize);
      const pngBuf = png(pixelSize, rgba);
      fs.writeFileSync(filepath, pngBuf);
      made.push(filepath);

      images.push({
        idiom: entry.idiom,
        size: `${entry.size}x${entry.size}`,
        scale: `${scale}x`,
        filename: filename,
        role: isMarketing ? "ios-marketing" : undefined,
        subtype: entry.idiom === "ipad" ? "ipad" : undefined
      });
    }
  }

  writeContentsJson(appIconDir, images);
  console.log("brand-ios: wrote " + made.length + " icon files under " + appIconDir);
  return made;
}

module.exports = { render, png, IOS_SIZES, main };

if (require.main === module) {
  const xcassets = process.argv[2] || path.join("ios", "App", "App", "Assets.xcassets");
  main(xcassets);
}