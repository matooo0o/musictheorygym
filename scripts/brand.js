// Draws the ToniKa launcher icon and fixes the Android app label.
// Pure Node (zlib only), so it runs inside the CI build with no extra packages.
//
//   node scripts/brand.js [android/app/src/main/res]
//
// Writes, for every density, ic_launcher.png (rounded square), ic_launcher_round.png
// (circle) and ic_launcher_foreground.png (transparent, for the adaptive icon),
// plus the adaptive icon XMLs and the background colour resource. Rewrites
// values/strings.xml so the launcher and the recents card say "ToniKa".
const fs = require("fs"), path = require("path"), zlib = require("zlib");

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
    const un = pa > 0 ? 255 / pa : 0;                 // undo the premultiply
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

// ---------------------------------------------------------------- output
const DENS = [["mdpi", 48, 108], ["hdpi", 72, 162], ["xhdpi", 96, 216], ["xxhdpi", 144, 324], ["xxxhdpi", 192, 432]];
const ADAPTIVE = kind => `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

// The label shown under the icon and in the recent-apps card. cap add android
// normally copies it from capacitor.config.json, but rewriting strings.xml here
// keeps the name correct even if that step changes.
function writeLabel(res, appName) {
  const file = path.join(res, "values", "strings.xml");
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tag = '<string name="app_name">' + esc(appName) + "</string>";
  let xml = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n';
  if (/<string\s+name="app_name"/.test(xml)) xml = xml.replace(/<string\s+name="app_name"[^>]*>[^<]*<\/string>/, () => tag);
  else xml = xml.replace(/<\/resources>/, () => "    " + tag + "\n</resources>");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, xml);
  return file;
}

function main(res) {
  const made = [];
  const put = (file, buf) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); made.push(file); };
  for (const [d, legacy, fg] of DENS) {
    put(path.join(res, "mipmap-" + d, "ic_launcher.png"), png(legacy, render("square", legacy)));
    put(path.join(res, "mipmap-" + d, "ic_launcher_round.png"), png(legacy, render("round", legacy)));
    put(path.join(res, "mipmap-" + d, "ic_launcher_foreground.png"), png(fg, render("fg", fg)));
  }
  put(path.join(res, "mipmap-anydpi-v26", "ic_launcher.xml"), ADAPTIVE());
  put(path.join(res, "mipmap-anydpi-v26", "ic_launcher_round.xml"), ADAPTIVE());
  put(path.join(res, "values", "ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#5B33E0</color>
</resources>
`);
  return made;
}

module.exports = { render, png, DENS, main, writeLabel };

if (require.main === module) {
  const res = process.argv[2] || path.join("android", "app", "src", "main", "res");
  const made = main(res);
  console.log("brand: wrote " + made.length + " icon files under " + res);
  const cfgFile = path.join(__dirname, "..", "capacitor.config.json");
  if (fs.existsSync(cfgFile)) {
    const appName = JSON.parse(fs.readFileSync(cfgFile, "utf8")).appName;
    console.log("brand: app label -> " + appName + " in " + writeLabel(res, appName));
  }
}
