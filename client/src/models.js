// Voxelmodeller för djur, vapen och mat. Framåt = +Z, upp = +Y. 1 voxel = 0.1 m.
import * as THREE from 'three';
import { Vox } from './voxel.js';

const S = 0.1;
const S_ = S;
const BLACK = 0x1a1a1a;
const WHITE = 0xf4f4f0;

const geoCache = new Map();
function cached(key, fn) {
  if (!geoCache.has(key)) geoCache.set(key, fn());
  return geoCache.get(key);
}

// Ett ben/arm: pivot högst upp i origo. "foot" ger tår/händer framtill längst ner.
function limb(w, len, color, foot) {
  const v = new Vox();
  v.box(-w, -len, -w, w - 1, -1, w - 1, color);
  if (foot) v.box(-w, -len, w, w - 1, -len, w, foot);
  return v.build(S);
}

// En rörlig del. Voxlarna ritas i djurets koordinater, sen flyttas geometrin så att
// "pivot" (i voxel-enheter) hamnar i origo – där delen vrids runt.
function part(v, pivot) {
  const g = v.build(S);
  g.translate(-pivot[0] * S, -pivot[1] * S, -pivot[2] * S);
  return { geo: g, pivot };
}

// Ett öga på sidan av huvudet: 2x2 svart med en vit glimt framtill uppe. x = utsidan på höger sida.
function sideEye(x, y, z, side) {
  const v = new Vox();
  const xx = side > 0 ? x : -1 - x;
  v.box(xx, y, z, xx, y + 1, z + 1, BLACK);
  v.set(xx, y + 1, z + 1, WHITE);
  return part(v, [xx + 0.5, y + 1, z + 1]);
}

// ---------------- Djur ----------------
// hold = hur djuret bär vapnet: mount/rot i meter/radianer, arms: 'forward' = håller vapnet i händerna.

const ANIMAL_DEFS = {
  capybara() {
    const B = 0xa8743f, D = 0x7d5229, L = 0xc79766, N = 0x3d2614, R = 0xe0483c, Y = 0xffd21f;
    const body = new Vox();
    body.box(-4, 3, -7, 3, 9, 5, B);
    body.box(-3, 3, -6, 2, 3, 4, L);
    body.box(-3, 4, -8, 2, 8, -8, B); // rund rumpa
    // Mörkare rygg och lite fläckig päls
    body.box(-3, 10, -6, 2, 10, 4, D);
    for (let x = -4; x <= 3; x++) for (let z = -7; z <= 5; z++) if ((x * 3 + z * 5 + 70) % 7 === 0) body.set(x, 9, z, D);
    // Sadel med rem runt magen – här sitter vapnet
    body.box(-5, 3, -1, 4, 10, 0, R);
    body.box(-3, 11, -3, 2, 11, 1, R);
    body.box(-3, 11, -3, 2, 11, -3, Y).box(-3, 11, 1, 2, 11, 1, Y);
    const head = new Vox();
    head.box(-3, 6, 5, 2, 11, 10, B);
    head.box(-3, 6, 11, 2, 9, 12, D);
    head.box(-2, 10, 11, 1, 10, 11, B);
    head.box(-2, 8, 13, 1, 9, 13, N); // nos
    head.set(-2, 9, 13, BLACK).set(1, 9, 13, BLACK); // näsborrar
    head.set(-1, 6, 13, WHITE).set(0, 6, 13, WHITE); // tänder
    head.sym(2, 7, 9, 2, 8, 10, L); // kinder
    const ear = (side) => {
      const v = new Vox();
      const x0 = side > 0 ? 1 : -3;
      v.box(x0, 12, 6, x0 + 1, 13, 6, D);
      v.set(side > 0 ? 1 : -2, 12, 7, 0xe8a07a);
      return part(v, [side > 0 ? 1.5 : -1.5, 12, 6.5]);
    };
    return {
      body: body.build(S),
      head: part(head, [0, 8, 5]),
      eyes: [sideEye(3, 9, 8, -1), sideEye(3, 9, 8, 1)],
      ears: [ear(-1), ear(1)],
      leg: limb(1, 3, D, N),
      legs: [[-3, 3, 3], [3, 3, 3], [-3, 3, -5], [3, 3, -5]],
      height: 1.25,
      hold: { mount: [0, 1.2, -0.1], rot: [0, 0, 0] },
      spotBox: [-0.4, 0.3, -0.7, 0.4, 1.0, 0.6],
    };
  },
  eagle() {
    const B = 0x5e3b1d, B2 = 0x7a5030, Y = 0xffc21f, Y2 = 0xd99a00;
    const body = new Vox();
    body.box(-3, 4, -3, 2, 10, 3, B);
    body.box(-2, 5, 4, 1, 9, 4, B2);
    // Fjädermönster
    for (let y = 5; y <= 9; y += 2) body.set(-2, y, 4, 0x8d6140).set(1, y, 4, 0x8d6140);
    for (let z = -3; z <= 3; z += 2) body.set(-3, 5, z, 0x4a2e15).set(2, 5, z, 0x4a2e15);
    const tail = new Vox();
    tail.box(-3, 4, -6, 2, 5, -4, WHITE);
    tail.box(-2, 4, -7, 1, 5, -7, WHITE);
    tail.set(-3, 4, -6, 0xdddddd).set(2, 4, -6, 0xdddddd);
    const head = new Vox();
    head.box(-2, 10, -1, 1, 14, 4, WHITE);
    head.box(-1, 11, 5, 0, 12, 6, Y);
    head.box(-1, 12, 7, 0, 12, 7, Y);
    head.box(-1, 10, 7, 0, 11, 7, Y2); // krokig näbbspets
    head.sym(0, 15, -1, 0, 15, 1, WHITE); // tofs
    head.set(0, 16, -1, WHITE);
    head.sym(1, 14, 2, 1, 14, 4, 0xe6e6e6); // ögonbryn
    const wing = (side) => {
      const v = new Vox();
      for (let x = 0; x <= 6; x++) {
        const z0 = -3 + Math.floor(x / 3), z1 = 3 - Math.floor(x / 2);
        const xx = side > 0 ? x : -1 - x;
        v.box(xx, -1, z0, xx, 0, z1, x > 4 ? 0x3e2612 : B);
        v.set(xx, -1, z0, 0x2e1a0a); // fjäderkant
      }
      return v.build(S);
    };
    return {
      body: body.build(S),
      head: part(head, [0, 10, 1]),
      eyes: [sideEye(2, 12, 2, -1), sideEye(2, 12, 2, 1)],
      ears: [],
      tail: part(tail, [0, 5, -3]),
      leg: limb(1, 4, Y, 0x333333),
      legs: [[-1.5, 4, 0], [1.5, 4, 0]],
      wingL: wing(-1),
      wingR: wing(1),
      wingPos: [3, 9, 0],
      height: 1.5,
      // Håller vapnet framför bröstet
      hold: { mount: [0, 0.66, 0.62], rot: [0, 0, 0] },
      spotBox: [-0.3, 0.4, -0.3, 0.3, 1.0, 0.3],
    };
  },
  monkey() {
    const B = 0x8b5a2b, D = 0x6e4520, L = 0xe8c39a, P = 0xd99a8a;
    const body = new Vox();
    body.box(-3, 3, -2, 2, 9, 2, B);
    body.box(-2, 4, 3, 1, 8, 3, L);
    body.box(-2, 3, -2, 1, 3, 2, D);
    const head = new Vox();
    head.box(-3, 10, -2, 2, 15, 3, B);
    // Hjärtformad ansiktsmask
    head.box(-2, 10, 4, 1, 13, 4, L);
    head.box(-3, 12, 4, -3, 13, 4, L).box(2, 12, 4, 2, 13, 4, L);
    head.set(-1, 14, 4, L).set(0, 14, 4, L);
    head.box(-2, 10, 5, 1, 11, 5, L); // nos
    head.set(-1, 11, 6, 0x5a3a1a).set(0, 11, 6, 0x5a3a1a); // näsborrar
    head.box(-1, 10, 6, 0, 10, 6, P); // mun
    head.box(-1, 16, -1, 0, 16, 1, D).set(0, 17, 0, D); // hårtofs
    const ear = (side) => {
      const v = new Vox();
      const x0 = side > 0 ? 3 : -5;
      v.box(x0, 11, 0, x0 + 1, 13, 1, B);
      v.box(x0, 12, 2, x0 + 1, 12, 2, P);
      return part(v, [side > 0 ? 3 : -3, 12, 0.5]);
    };
    // Ögonen sitter på ansiktsmasken: 1 bred, 2 hög, glimt överst
    const eye = (x) => {
      const v = new Vox();
      v.set(x, 12, 5, BLACK).set(x, 13, 5, BLACK).set(x, 13, 6, WHITE);
      return part(v, [x + 0.5, 13, 5.5]);
    };
    const tail = new Vox();
    const pts = [[0, 4, -3], [0, 4, -4], [0, 5, -5], [0, 6, -6], [0, 7, -6], [0, 8, -6], [0, 9, -5], [0, 10, -4], [0, 10, -3], [0, 9, -3]];
    pts.forEach((t, i) => tail.set(t[0], t[1], t[2], i >= pts.length - 2 ? D : B));
    return {
      body: body.build(S),
      head: part(head, [0, 10, 0.5]),
      eyes: [eye(-2), eye(1)],
      ears: [ear(-1), ear(1)],
      tail: part(tail, [0, 4, -2]),
      leg: limb(1, 3, B, L),
      legs: [[-2, 3, 0], [2, 3, 0]],
      arm: limb(1, 6, B, L),
      arms: [[-4, 9, 0], [4, 9, 0]],
      height: 1.6,
      // Håller vapnet i händerna framför sig
      hold: { mount: [0, 0.74, 0.5], rot: [0, 0, 0], arms: 'forward' },
      spotBox: [-0.3, 0.3, -0.2, 0.3, 1.5, 0.3],
    };
  },
  chameleon() {
    const G = 0x3fbf4f, D = 0x2a8a37, L = 0x8de05b, E = 0xd7ff5e, R = 0x8a4b2a;
    const body = new Vox();
    body.box(-3, 3, -6, 2, 7, 5, G);
    body.box(-3, 3, -5, 2, 3, 4, L);
    body.box(-3, 4, -6, 2, 4, 5, 0x36a845);
    for (let z = -5; z <= 4; z += 2) body.box(-1, 8, z, 0, 8, z, D); // ryggkam
    for (let z = -5; z <= 4; z += 3) body.box(-3, 5, z, -3, 6, z, L).box(2, 5, z, 2, 6, z, L); // ränder
    body.box(-4, 3, -1, 3, 8, -1, R); // rem som håller vapnet på ryggen
    const head = new Vox();
    head.box(-3, 4, 6, 2, 8, 10, G);
    head.box(-2, 9, 6, 1, 10, 8, D); // hjälm
    head.box(-1, 11, 6, 0, 11, 7, D);
    head.box(-3, 4, 11, 2, 5, 11, L); // mun
    head.box(-2, 6, 11, 1, 7, 11, G);
    head.set(-2, 7, 12, D).set(1, 7, 12, D); // näsborrar
    // Ögontornen vrids var för sig, som riktiga kameleontögon
    const eye = (side) => {
      const v = new Vox();
      const x0 = side > 0 ? 3 : -5;
      v.box(x0, 6, 7, x0 + 1, 8, 9, E);
      v.box(x0, 7, 10, x0 + 1, 7, 10, BLACK);
      v.set(side > 0 ? x0 + 1 : x0, 7, 9, BLACK);
      return part(v, [side > 0 ? 4 : -4, 7.5, 8.5]);
    };
    const tail = new Vox();
    tail.box(-1, 4, -9, 0, 5, -7, G);
    tail.box(-1, 6, -10, 0, 8, -10, G);
    tail.box(-1, 9, -9, 0, 9, -8, G);
    tail.box(-1, 8, -8, 0, 8, -8, D);
    tail.box(-1, 4, -8, 0, 4, -8, L);
    return {
      body: body.build(S),
      head: part(head, [0, 6, 6]),
      eyes: [eye(-1), eye(1)],
      eyesRoam: true,
      ears: [],
      tail: part(tail, [0, 5, -6]),
      leg: limb(1, 3, D, L),
      legs: [[-4, 3, 3], [4, 3, 3], [-4, 3, -4], [4, 3, -4]],
      height: 1.1,
      hold: { mount: [0, 0.98, -0.2], rot: [0, 0, 0] },
      spotBox: [-0.3, 0.3, -0.6, 0.3, 0.8, 0.6],
    };
  },
  redpanda() {
    const R = 0xc8532a, R2 = 0xa8401f, D = 0x3a1f14, W = 0xf4efe6, TL = 0xd9733f, TD = 0x7a2e14, S = 0x2e9e4f;
    const body = new Vox();
    body.box(-3, 4, -6, 2, 8, 4, R);
    body.box(-3, 3, -5, 2, 3, 3, D); // mörk mage
    body.box(-2, 9, -5, 1, 9, 3, R2); // rygg
    for (let z = -5; z <= 3; z += 2) body.set(-3, 7, z, R2).set(2, 7, z, R2); // lite mönster i pälsen
    body.box(-4, 4, -1, 3, 9, -1, S); // rem som håller vapnet
    body.box(-2, 10, -2, 1, 10, 0, S);
    const head = new Vox();
    head.box(-3, 7, 4, 2, 11, 9, R);
    head.box(-2, 7, 10, 1, 8, 11, W); // vit nos
    head.set(-1, 8, 12, BLACK).set(0, 8, 12, BLACK); // nos
    head.set(-1, 7, 12, D).set(0, 7, 12, D);
    head.sym(1, 10, 9, 2, 10, 9, W); // vita "ögonbryn"
    head.sym(2, 7, 9, 2, 8, 9, W); // vita kinder
    head.sym(1, 7, 9, 1, 7, 9, R2); // "tårstreck"
    head.box(-3, 11, 4, 2, 11, 8, R2);
    const ear = (side) => {
      const v = new Vox();
      const x0 = side > 0 ? 1 : -3;
      v.box(x0, 12, 5, x0 + 1, 13, 6, R2);
      v.box(x0, 12, 7, x0 + 1, 12, 7, W); // vit kant framtill
      v.set(side > 0 ? x0 + 1 : x0, 14, 6, W);
      return part(v, [side > 0 ? 2 : -2, 12, 6]);
    };
    // Ögonen sitter framtill i ansiktet: 1 bred, 2 hög, glimt överst
    const eye = (x) => {
      const v = new Vox();
      v.set(x, 8, 10, BLACK).set(x, 9, 10, BLACK).set(x, 9, 11, WHITE);
      return part(v, [x + 0.5, 9, 10.5]);
    };
    // Ihoprullad boll (för ★ Rulla): päls runt om, randig svans lindad som ett band och ansiktet framtill
    const ball = new Vox();
    for (let x = -4; x <= 3; x++) for (let y = -4; y <= 3; y++) for (let z = -4; z <= 3; z++) {
      const cx = x + 0.5, cy = y + 0.5, cz = z + 0.5;
      if (cx * cx + cy * cy + cz * cz > 4.3 * 4.3) continue;
      let c = (x + y + z) % 3 === 0 ? R2 : R;
      if (Math.abs(cx) < 1.6) c = Math.floor((Math.atan2(cy, cz) + Math.PI) / (Math.PI / 4)) % 2 ? TD : TL;
      else if (cy < -2.5) c = D;
      ball.set(x, y, z, c);
    }
    ball.sym(1, 0, 3, 3, 1, 3, W); // vit mask på sidorna av bandet
    ball.symSet(2, 1, 4, BLACK).symSet(2, 2, 4, WHITE); // ögon som kikar fram
    ball.sym(1, 2, 3, 2, 3, 3, R2); // öron
    // Stor randig svans som böjer sig uppåt
    const tail = new Vox();
    for (let i = 0; i < 9; i++) {
      const z = -7 - i, y0 = 5 + Math.floor(i / 3);
      const c = i === 8 ? TD : Math.floor(i / 2) % 2 ? TD : TL;
      tail.box(-2, y0, z, 1, y0 + 2, z, c);
    }
    return {
      body: body.build(S_),
      ball: ball.build(S_),
      head: part(head, [0, 8, 4]),
      eyes: [eye(-3), eye(2)],
      ears: [ear(-1), ear(1)],
      tail: part(tail, [0, 6, -6]),
      leg: limb(1, 4, D, BLACK),
      legs: [[-2, 4, 2], [2, 4, 2], [-2, 4, -4], [2, 4, -4]],
      height: 1.2,
      hold: { mount: [0, 1.05, -0.15], rot: [0, 0, 0] },
      spotBox: [-0.3, 0.4, -0.6, 0.3, 0.9, 0.5],
    };
  },
  rabbit() {
    const G = 0xd9d2c7, G2 = 0xbfb6a8, W = 0xfafafa, P = 0xff9fb8, O = 0xff8a1f;
    const body = new Vox();
    body.box(-3, 3, -4, 2, 8, 3, G);
    body.box(-2, 3, 4, 1, 7, 4, W); // vitt bröst
    body.box(-2, 9, -3, 1, 9, 2, G2);
    body.box(-3, 3, -5, 2, 7, -5, G); // rund rumpa
    body.box(-4, 3, 0, 3, 8, 0, O); // rem som håller vapnet
    body.box(-3, 9, 0, 2, 9, 0, O);
    const head = new Vox();
    head.box(-3, 8, 2, 2, 12, 6, G);
    head.box(-2, 8, 7, 1, 9, 7, W); // vit nos
    head.set(-1, 10, 7, P).set(0, 10, 7, P); // rosa nos
    head.set(-1, 7, 7, W).set(0, 7, 7, W); // framtänder
    head.sym(2, 9, 5, 2, 9, 6, 0xf0c8c8); // kinder
    const ear = (side) => {
      const v = new Vox();
      const x0 = side > 0 ? 1 : -3;
      v.box(x0, 13, 3, x0 + 1, 19, 3, G);
      v.box(x0, 14, 4, x0 + 1, 18, 4, P); // rosa insida
      v.box(x0, 20, 3, x0 + 1, 20, 3, G2);
      return part(v, [side > 0 ? 2 : -2, 13, 3.5]);
    };
    const tail = new Vox();
    tail.box(-1, 5, -7, 0, 6, -6, W); // bomullssvans
    tail.set(-1, 7, -6, W).set(0, 4, -6, W);
    return {
      body: body.build(S_),
      head: part(head, [0, 9, 3]),
      eyes: [sideEye(3, 10, 4, -1), sideEye(3, 10, 4, 1)],
      ears: [ear(-1), ear(1)],
      tail: part(tail, [0, 5.5, -5]),
      leg: limb(1, 3, G, W),
      legs: [[-2, 3, 2], [2, 3, 2], [-2, 3, -3], [2, 3, -3]],
      height: 1.6,
      hold: { mount: [0, 1.02, 0], rot: [0, 0, 0] },
      spotBox: [-0.3, 0.3, -0.4, 0.3, 0.85, 0.4],
    };
  },
  fox() {
    const O = 0xe8731c, O2 = 0xc75a10, W = 0xfaf6ee, D = 0x2b1a12, B = 0x2f6fd6;
    const body = new Vox();
    body.box(-3, 4, -6, 2, 8, 4, O);
    body.box(-2, 3, -4, 1, 3, 3, W); // vit mage
    body.box(-2, 5, 5, 1, 8, 5, W); // vitt bröst
    body.box(-2, 9, -5, 1, 9, 3, O2); // mörkare rygg
    body.box(-4, 4, -1, 3, 9, -1, B); // rem som håller vapnet
    body.box(-2, 10, -2, 1, 10, 0, B);
    const head = new Vox();
    head.box(-3, 7, 4, 2, 11, 8, O);
    head.box(-2, 7, 9, 1, 9, 11, O); // spetsig nos
    head.box(-2, 7, 9, 1, 7, 11, W); // vit haka
    head.sym(2, 7, 6, 2, 8, 8, W); // vita kinder
    head.set(-1, 9, 12, BLACK).set(0, 9, 12, BLACK); // nos
    head.set(-1, 8, 12, D).set(0, 8, 12, D);
    // Stora spetsiga öron med svarta toppar
    const ear = (side) => {
      const v = new Vox();
      const x0 = side > 0 ? 1 : -3;
      v.box(x0, 12, 5, x0 + 1, 13, 6, O);
      v.box(x0, 12, 7, x0 + 1, 12, 7, W); // vit insida
      v.box(x0, 14, 5, x0 + 1, 14, 6, D);
      v.set(side > 0 ? x0 + 1 : x0, 15, 6, D);
      return part(v, [side > 0 ? 2 : -2, 12, 6]);
    };
    // Yvig svans med vit spets
    const tail = new Vox();
    for (let i = 0; i < 8; i++) {
      const z = -7 - i, y0 = 5 + Math.floor(i / 3), w = i > 1 && i < 6 ? 2 : 1;
      tail.box(-w, y0, z, w - 1, y0 + 2, z, i >= 6 ? W : O);
    }
    return {
      body: body.build(S_),
      head: part(head, [0, 8, 4]),
      eyes: [sideEye(3, 9, 7, -1), sideEye(3, 9, 7, 1)],
      ears: [ear(-1), ear(1)],
      tail: part(tail, [0, 6, -6]),
      leg: limb(1, 4, D, BLACK),
      legs: [[-2, 4, 2], [2, 4, 2], [-2, 4, -4], [2, 4, -4]],
      height: 1.3,
      hold: { mount: [0, 1.05, -0.15], rot: [0, 0, 0] },
      spotBox: [-0.3, 0.4, -0.6, 0.3, 0.9, 0.5],
    };
  },
  skunk() {
    const K = 0x26262e, K2 = 0x3a3a46, W = 0xf6f6f2, P = 0xff9fb8, V = 0x9b5de5;
    const body = new Vox();
    body.box(-3, 3, -6, 2, 8, 4, K);
    body.box(-1, 9, -6, 0, 9, 4, W); // vit rand längs ryggen
    body.sym(1, 8, -6, 2, 8, 4, K2);
    body.box(-4, 3, -1, 3, 8, -1, V); // rem som håller vapnet
    body.box(-3, 9, -1, -2, 9, -1, V).box(1, 9, -1, 2, 9, -1, V);
    const head = new Vox();
    head.box(-3, 6, 4, 2, 10, 8, K);
    head.box(-2, 6, 9, 1, 8, 10, K); // nos
    head.set(-1, 8, 11, P).set(0, 8, 11, P); // rosa nos
    head.box(-1, 9, 8, 0, 10, 8, W); // vit rand ner i pannan
    head.box(-1, 11, 4, 0, 11, 8, W); // och över huvudet
    const ear = (side) => {
      const v = new Vox();
      const x0 = side > 0 ? 1 : -3;
      v.box(x0, 11, 5, x0 + 1, 12, 6, K);
      v.set(side > 0 ? x0 + 1 : x0, 11, 7, P);
      return part(v, [side > 0 ? 2 : -2, 11, 6]);
    };
    // Jättestor yvig svans som står rakt upp och böjer sig fram över ryggen, med vit rand
    const tail = new Vox();
    tail.box(-2, 5, -9, 1, 9, -7, K);
    tail.box(-2, 10, -9, 1, 14, -6, K);
    tail.box(-2, 15, -8, 1, 16, -4, K);
    tail.box(-1, 6, -9, 0, 14, -9, W);
    tail.box(-1, 16, -8, 0, 16, -4, W);
    tail.box(-2, 15, -3, 1, 15, -3, W); // vit tofs längst fram
    return {
      body: body.build(S_),
      head: part(head, [0, 8, 4]),
      eyes: [sideEye(3, 8, 6, -1), sideEye(3, 8, 6, 1)],
      ears: [ear(-1), ear(1)],
      tail: part(tail, [0, 6, -6]),
      leg: limb(1, 3, K, BLACK),
      legs: [[-2, 3, 2], [2, 3, 2], [-2, 3, -4], [2, 3, -4]],
      height: 1.7,
      hold: { mount: [0, 0.98, -0.1], rot: [0, 0, 0] },
      spotBox: [-0.3, 0.3, -0.6, 0.3, 0.85, 0.5],
    };
  },
};

export function animalDef(id) {
  return cached('a:' + id, () => (ANIMAL_DEFS[id] || ANIMAL_DEFS.capybara)());
}

function placePart(p, parent, material, parentPivot = [0, 0, 0]) {
  const m = new THREE.Mesh(p.geo, material);
  m.position.set((p.pivot[0] - parentPivot[0]) * S, (p.pivot[1] - parentPivot[1]) * S, (p.pivot[2] - parentPivot[2]) * S);
  parent.add(m);
  return m;
}

// Skapar ett djur. Varje djur får eget material så att det kan bli genomskinligt.
// group (ben + torso) → torso (kropp, huvud, svans, armar, vingar, vapenfäste) → huvud (ögon, öron).
export function createAnimal(id) {
  const def = animalDef(id);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: false });
  const g = new THREE.Group();
  g.rotation.order = 'YXZ'; // vrid först, luta sen – så lutningen följer djurets riktning
  const torso = new THREE.Group();
  g.add(torso);
  const body = new THREE.Mesh(def.body, material);
  torso.add(body);
  const head = placePart(def.head, torso, material);
  const eyes = def.eyes.map((e) => placePart(e, head, material, def.head.pivot));
  const ears = def.ears.map((e) => placePart(e, head, material, def.head.pivot));
  const tail = def.tail ? placePart(def.tail, torso, material) : null;
  const legs = [];
  for (const l of def.legs) {
    const m = new THREE.Mesh(def.leg, material);
    m.position.set(l[0] * S, l[1] * S, l[2] * S);
    g.add(m);
    legs.push(m);
  }
  const arms = [];
  if (def.arms) {
    for (const a of def.arms) {
      const m = new THREE.Mesh(def.arm, material);
      m.position.set(a[0] * S, a[1] * S, a[2] * S);
      torso.add(m);
      arms.push(m);
    }
  }
  const wings = [];
  if (def.wingL) {
    const wl = new THREE.Mesh(def.wingL, material);
    wl.position.set(-def.wingPos[0] * S, def.wingPos[1] * S, def.wingPos[2] * S);
    const wr = new THREE.Mesh(def.wingR, material);
    wr.position.set(def.wingPos[0] * S, def.wingPos[1] * S, def.wingPos[2] * S);
    torso.add(wl, wr);
    wings.push(wl, wr);
  }
  const mount = new THREE.Group();
  mount.position.set(...def.hold.mount);
  mount.rotation.set(...def.hold.rot);
  torso.add(mount);
  let ball = null;
  if (def.ball) {
    ball = new THREE.Mesh(def.ball, material);
    ball.position.y = 0.43;
    ball.visible = false;
    g.add(ball);
  }
  const a = { group: g, torso, body, head, eyes, ears, tail, legs, arms, wings, mount, ball, material, def };
  poseHold(a, 0);
  for (let i = 0; i < wings.length; i++) wings[i].rotation.z = i === 0 ? 1.4 : -1.4; // ihopfällda
  return a;
}

// Armarna runt vapnet. lift = extra lyft (t.ex. i luften), swing = lite gungning när man går.
export function poseHold(a, lift, swing = 0) {
  const hold = a.def.hold;
  if (hold.arms === 'forward') {
    for (let i = 0; i < a.arms.length; i++) {
      const side = i === 0 ? -1 : 1;
      a.arms[i].rotation.x = -1.25 - lift + swing * side;
      a.arms[i].rotation.z = -side * 0.22;
    }
  }
}

// ---------------- Vapen ----------------

const WEAPON_DEFS = [
  () => {
    const v = new Vox();
    v.box(-1, 0, -3, 0, 1, 3, 0x2f7bff);
    v.box(-2, 2, -3, 1, 4, 0, 0x8fd8ff);
    v.box(-1, 0, 4, 0, 0, 5, 0xff8a1f);
    v.box(-1, -2, -2, 0, -1, -1, 0x2f7bff);
    return v;
  },
  () => {
    const v = new Vox();
    v.box(-1, 0, -4, 0, 1, 6, 0xff8a1f);
    v.box(-2, -1, -1, 1, 2, -1, 0x333333);
    v.box(-2, -1, 3, 1, 2, 3, 0x333333);
    v.box(-2, 2, -4, 1, 4, -1, 0xb44dff);
    v.box(-1, 0, 7, 0, 1, 7, 0xffef5e);
    return v;
  },
  () => {
    const v = new Vox();
    const cols = [0xff3b3b, 0xff8a1f, 0xffd21f, 0x2fd35a, 0x3b7bff];
    for (let i = 0; i < 5; i++) v.box(i * 2 - 5, 0, -3, i * 2 - 4, 1, 5, cols[i]);
    v.box(-5, -1, -4, 4, -1, 0, 0xffffff);
    v.box(-2, 2, -4, 1, 3, -1, 0xff5fc8);
    return v;
  },
  () => {
    const v = new Vox();
    v.box(-2, -1, -6, 1, 2, 6, 0x2e9e4f);
    v.box(-2, -1, 7, 1, 2, 7, 0x1d1d1d);
    v.box(-2, -1, -7, 1, 2, -7, 0x1d1d1d);
    v.box(-1, 0, 8, 0, 1, 8, 0xff3b3b);
    v.box(-1, 3, -2, 0, 3, 2, 0x1d1d1d);
    return v;
  },
  () => {
    const v = new Vox();
    v.box(-2, 1, -6, 1, 4, -2, 0x1fc8c8); // tank
    v.box(-2, 5, -5, 1, 5, -3, 0xffffff);
    v.box(-1, 0, -2, 0, 1, 8, 0x1fc8c8); // lång slang
    v.box(-2, -1, 2, 1, 2, 2, 0xffffff);
    v.box(-2, -1, 5, 1, 2, 5, 0xffffff);
    v.box(-1, -1, 9, 0, 2, 9, 0x3b7bff); // munstycke
    v.box(-1, -2, -1, 0, -1, 0, 0x1fc8c8);
    return v;
  },
];

const weaponMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
export function createWeapon(i) {
  const geo = cached('w:' + i, () => (WEAPON_DEFS[i] || WEAPON_DEFS[0])().build(0.07));
  return new THREE.Mesh(geo, weaponMaterial);
}

// ---------------- Mat ----------------

const FOOD_DEFS = {
  apple: () => {
    const v = new Vox();
    v.box(-2, 0, -2, 1, 3, 1, 0xe8322b);
    v.box(-1, 4, -1, 0, 4, 0, 0xe8322b);
    v.set(0, 5, 0, 0x6b4423);
    v.set(1, 5, 0, 0x3fbf4f);
    return v;
  },
  carrot: () => {
    const v = new Vox();
    v.box(-1, 0, -1, 0, 1, 0, 0xff8a1f);
    v.box(-2, 2, -2, 1, 4, 1, 0xff8a1f);
    v.box(-1, 5, -1, 0, 7, 0, 0x3fbf4f);
    v.set(1, 6, 0, 0x3fbf4f);
    return v;
  },
  banana: () => {
    const v = new Vox();
    const pts = [[-3, 3], [-2, 2], [-1, 1], [0, 1], [1, 1], [2, 2], [3, 3]];
    for (const [x, y] of pts) v.box(x, y, -1, x, y + 1, 0, 0xffe14a);
    v.set(-4, 4, 0, 0x6b4423);
    v.set(4, 4, 0, 0x6b4423);
    return v;
  },
  cake: () => {
    const v = new Vox();
    v.box(-3, 0, -3, 2, 1, 2, 0xf7d6a0);
    v.box(-3, 2, -3, 2, 2, 2, 0xff7eb6);
    v.box(-3, 3, -3, 2, 4, 2, 0xf7d6a0);
    v.box(-3, 5, -3, 2, 5, 2, 0xffffff);
    v.box(-1, 6, -1, 0, 6, 0, 0xe8322b);
    return v;
  },
};

export function foodGeometry(kind) {
  return cached('f:' + kind, () => {
    const g = (FOOD_DEFS[kind] || FOOD_DEFS.apple)().build(0.09);
    g.translate(0, 0.25, 0);
    return g;
  });
}
