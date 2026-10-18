// Skapar public/icon.png (hemskärmsikon) utan extra paket. Kör: node scripts/make-icon.js
import fs from 'node:fs';
import zlib from 'node:zlib';

const N = 180;
const px = Buffer.alloc(N * N * 3);
const set = (x, y, c) => {
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  const i = (y * N + x) * 3;
  px[i] = c >> 16; px[i + 1] = (c >> 8) & 255; px[i + 2] = c & 255;
};
const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c); };
const disc = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) set(cx + x, cy + y, c); };

rect(0, 0, N, N, 0x8fd3ff);
rect(0, 120, N, 60, 0x7ccf4a);
disc(30, 40, 16, 0xff3b3b); disc(150, 30, 12, 0x3b7bff); disc(150, 150, 14, 0xffd21f); disc(25, 155, 10, 0xb44dff);
// Capybarahuvud i voxelstil
const s = 10;
const B = 0xa8743f, D = 0x7d5229, K = 0x1a1a1a;
const face = [
  '..DD....DD..',
  '.BBBBBBBBBB.',
  'BBBBBBBBBBBB',
  'BBKBBBBBBKBB',
  'BBBBBBBBBBBB',
  'BBBBBBBBBBBB',
  '.BDDDDDDDDB.',
  '.BDKDDDDKDB.',
  '..DDDDDDDD..',
];
face.forEach((row, y) => [...row].forEach((ch, x) => {
  const c = ch === 'B' ? B : ch === 'D' ? D : ch === 'K' ? K : -1;
  if (c >= 0) rect(30 + x * s, 45 + y * s, s, s, c);
}));
disc(140, 105, 9, 0xff5fc8);

const raw = Buffer.alloc((N * 3 + 1) * N);
for (let y = 0; y < N; y++) px.copy(raw, y * (N * 3 + 1) + 1, y * N * 3, (y + 1) * N * 3);
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/icon.png', Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log('public/icon.png skapad');
