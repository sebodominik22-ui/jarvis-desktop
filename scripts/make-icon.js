// Vygeneruje build/icon.png (HUD kruhy) bez externych kniznic.
const fs = require("fs");
const zlib = require("zlib");
const S = 512;
const px = Buffer.alloc(S * S * 4);
const c = S / 2;
function mix(a, b, t) { return a + (b - a) * t; }
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const dx = x - c + 0.5, dy = y - c + 0.5;
    const r = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx);
    let R = 6, G = 9, B = 18, A = 255;
    // zaoblene rohy
    const k = 70, ax = Math.max(Math.abs(dx) - (c - k), 0), ay = Math.max(Math.abs(dy) - (c - k), 0);
    if (Math.sqrt(ax * ax + ay * ay) > k) A = 0;
    // jadro
    if (r < 120) { const t = r / 120; R = mix(180, 20, t); G = mix(245, 140, t); B = 255; }
    // kruhy
    const ring = (r0, w, gap) => Math.abs(r - r0) < w && (!gap || Math.sin(ang * gap) > -0.2);
    if (ring(150, 5, 0)) { R = 56; G = 214; B = 255; }
    if (ring(185, 4, 3)) { R = 56; G = 214; B = 255; }
    if (ring(220, 3, 5)) { R = 90; G = 120; B = 255; }
    // jemna ziara
    if (r >= 120 && r < 150) { const g = 1 - (r - 120) / 30; R = mix(R, 56, g * 0.35); G = mix(G, 214, g * 0.35); B = mix(B, 255, g * 0.35); }
    const i = (y * S + x) * 4;
    px[i] = R; px[i + 1] = G; px[i + 2] = B; px[i + 3] = A;
  }
}
const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4); }
function crc32(buf) { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; }
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, cr]); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
fs.mkdirSync("build", { recursive: true });
fs.writeFileSync("build/icon.png", png);
console.log("build/icon.png hotovo");
