// Kartan byggs likadant på server och klient (samma bana = samma värld).

export const MAP_HALF = 36;
export const BASE_HALF = 5;
export const BASES = [
  { x: -28, z: -28, color: 0xff6b6b, name: 'Röda basen' },
  { x: 28, z: 28, color: 0x6b9bff, name: 'Blå basen' },
  { x: 28, z: -28, color: 0xffdf5e, name: 'Gula basen' },
  { x: -28, z: 28, color: 0x6be08a, name: 'Gröna basen' },
];
export const POND = { x0: 6, x1: 18, z0: -18, z1: -6, depth: 0.55 };

export const GRAVITY = 24;
export const PLAYER_R = 0.5;
export const PLAYER_H = 1.3;
export const STEP = 0.65;

// Banorna man kan välja när man startar ett spel. Baser, butiker, damm och staket är likadana på alla.
export const MAPS = [
  { id: 'park', name: 'Parken', emoji: '🌳', desc: 'Kulle i mitten, lådor, träd och stenar.' },
  { id: 'town', name: 'Byn', emoji: '🏠', desc: 'Gator, hus att springa in i, fönster att hoppa igenom och en fontän.' },
];

export function mapInfo(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}

function rng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function inBase(x, z, margin = 0) {
  for (let i = 0; i < BASES.length; i++) {
    const b = BASES[i];
    if (Math.abs(x - b.x) < BASE_HALF + margin && Math.abs(z - b.z) < BASE_HALF + margin) return i;
  }
  return -1;
}

export function inPond(x, z, margin = 0) {
  return x > POND.x0 - margin && x < POND.x1 + margin && z > POND.z0 - margin && z < POND.z1 + margin;
}

// Nere i dammen tvättar man sig – och kan inte skjuta samtidigt
export function isWashing(x, y, z) {
  return inPond(x, z) && y < -POND.depth + 0.3;
}

const CELL = 4;

export function createMap(id = 'park') {
  const info = mapInfo(id);
  const boxes = [];
  const decor = []; // bara utseende (lövverk m.m.)

  const add = (x0, z0, x1, z1, y0, y1, kind, color) => {
    const b = { x0, z0, x1, z1, y0, y1, kind, color };
    boxes.push(b);
    return b;
  };
  const free = (x, z, rad) => {
    if (Math.abs(x) > MAP_HALF - 2 - rad || Math.abs(z) > MAP_HALF - 2 - rad) return false;
    if (inBase(x, z, 2.5 + rad) >= 0) return false;
    if (inPond(x, z, 1.5 + rad)) return false;
    if (Math.abs(x) < 8 + rad && Math.abs(z) < 8 + rad) return false;
    for (const b of boxes) {
      if (x + rad + 1.2 > b.x0 && x - rad - 1.2 < b.x1 && z + rad + 1.2 > b.z0 && z - rad - 1.2 < b.z1) return false;
    }
    return true;
  };

  // Staket runt kanten
  const H = MAP_HALF;
  add(-H - 1, -H - 1, H + 1, -H, 0, 2.2, 'fence', 0xb07a45);
  add(-H - 1, H, H + 1, H + 1, 0, 2.2, 'fence', 0xb07a45);
  add(-H - 1, -H, -H, H, 0, 2.2, 'fence', 0xb07a45);
  add(H, -H, H + 1, H, 0, 2.2, 'fence', 0xb07a45);

  // Butiksdiskar i baserna (ritas av klienten tillsammans med basen)
  for (const b of BASES) {
    const sx = b.x + Math.sign(b.x) * 3, sz = b.z + Math.sign(b.z) * 3;
    add(sx - 1.2, sz - 0.5, sx + 1.2, sz + 0.5, 0, 1.0, 'shop', 0xd9a066);
  }

  if (info.id === 'town') buildTown(add, free, decor);
  else buildPark(add, free, decor);

  // Rutnät för snabb kollision
  const grid = new Map();
  for (const b of boxes) {
    for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++) {
      for (let cz = Math.floor(b.z0 / CELL); cz <= Math.floor(b.z1 / CELL); cz++) {
        const k = cx * 1000 + cz;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(b);
      }
    }
  }

  return { id: info.id, boxes, decor, grid, hash: mapHash(boxes) };
}

// Fingeravtryck av banan. Servern skickar sitt så att klienten märker om servern kör en äldre bana.
function mapHash(boxes) {
  let h = boxes.length;
  for (const b of boxes) h = (Math.imul(h, 31) + Math.round((b.x0 + b.z1 * 7 + b.y1 * 13) * 100)) | 0;
  return h;
}

// Lådor (ibland staplade), träd och stenar på lediga platser
function scatter(r, add, free, decor, crates, trees, rocks) {
  const H = MAP_HALF;
  for (let i = 0, tries = 0; i < crates && tries < 2000; tries++) {
    const x = (r() * 2 - 1) * (H - 3), z = (r() * 2 - 1) * (H - 3);
    if (!free(x, z, 0.8)) continue;
    const s = 0.6;
    add(x - s, z - s, x + s, z + s, 0, 1.2, 'crate', 0xc8893f);
    if (r() < 0.35) add(x - s, z - s, x + s, z + s, 1.2, 2.4, 'crate', 0xb97a33);
    i++;
  }
  for (let i = 0, tries = 0; i < trees && tries < 2000; tries++) {
    const x = (r() * 2 - 1) * (H - 3), z = (r() * 2 - 1) * (H - 3);
    if (!free(x, z, 1.2)) continue;
    const h = 2.8 + r() * 1.2;
    add(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 0, h, 'trunk', 0x7a4f2a);
    const leaf = r() < 0.5 ? 0x3e9e3e : 0x4fb548;
    decor.push({ x, z, y: h, s: 1.3 + r() * 0.6, color: leaf, kind: 'leaves' });
    i++;
  }
  for (let i = 0, tries = 0; i < rocks && tries < 2000; tries++) {
    const x = (r() * 2 - 1) * (H - 3), z = (r() * 2 - 1) * (H - 3);
    const w = 0.8 + r() * 0.8, d = 0.8 + r() * 0.8;
    if (!free(x, z, Math.max(w, d))) continue;
    add(x - w, z - d, x + w, z + d, 0, 0.5 + r() * 0.5, 'rock', 0x9a9a9a);
    i++;
  }
}

function buildPark(add, free, decor) {
  // Kulle i mitten med trappsteg
  add(-6, -6, 6, 6, 0, 0.6, 'hill', 0x8fcf5a);
  add(-4.5, -4.5, 4.5, 4.5, 0, 1.2, 'hill', 0x83c450);
  add(-3, -3, 3, 3, 0, 1.8, 'hill', 0x77b847);
  add(-1.5, -1.5, 1.5, 1.5, 0, 2.4, 'hill', 0x6aab3d);

  // Skyddsväggar (symmetriska)
  const walls = [
    [-16, -3, -15, 3], [15, -3, 16, 3], [-3, 15, 3, 16], [-3, -16, 3, -15],
    [-20, 12, -12, 13], [12, 20, 13, 12], [20, -12, 12, -13], [-12, -20, -13, -12],
  ];
  for (const w of walls) {
    const x0 = Math.min(w[0], w[2]), x1 = Math.max(w[0], w[2]);
    const z0 = Math.min(w[1], w[3]), z1 = Math.max(w[1], w[3]);
    add(x0, z0, x1, z1, 0, 1.6, 'wall', 0xd9c7a3);
  }

  scatter(rng(7), add, free, decor, 34, 24, 14);
}

export const HOUSE_H = 2.6; // väggarnas höjd, taket ligger ovanpå
const WALL_T = 0.3;
const DOOR = { w: 1.6, y0: 0, y1: 2.0 };
const WINDOW = { w: 1.8, y0: 0.7, y1: 2.25 }; // så stort att man kan hoppa in och ut

// En vägg längs x (along='x') eller z, med hål för dörr och fönster. c = hålets mitt längs väggen.
function wallRun(add, along, a0, a1, t0, t1, holes, color) {
  const box = (s0, s1, y0, y1) => {
    if (s1 - s0 < 0.01 || y1 - y0 < 0.01) return;
    if (along === 'x') add(s0, t0, s1, t1, y0, y1, 'house', color);
    else add(t0, s0, t1, s1, y0, y1, 'house', color);
  };
  let at = a0;
  for (const h of holes) {
    const h0 = h.c - h.w / 2, h1 = h.c + h.w / 2;
    box(at, h0, 0, HOUSE_H);
    box(h0, h1, 0, h.y0);
    box(h0, h1, h.y1, HOUSE_H);
    at = h1;
  }
  box(at, a1, 0, HOUSE_H);
}

// Ett hus med dörr på sidan door ('n','s','w','e') och ett fönster på varje annan sida.
function house(add, cx, cz, w, d, door, color, roof) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const hole = (side, mid) => [{ c: mid, ...(side === door ? DOOR : WINDOW) }];
  wallRun(add, 'x', x0, x1, z0, z0 + WALL_T, hole('n', cx), color);
  wallRun(add, 'x', x0, x1, z1 - WALL_T, z1, hole('s', cx), color);
  wallRun(add, 'z', z0 + WALL_T, z1 - WALL_T, x0, x0 + WALL_T, hole('w', cz), color);
  wallRun(add, 'z', z0 + WALL_T, z1 - WALL_T, x1 - WALL_T, x1, hole('e', cz), color);
  const r = add(x0 - 0.4, z0 - 0.4, x1 + 0.4, z1 + 0.4, HOUSE_H, HOUSE_H + 0.3, 'roof', roof);
  // Trappstegsgavel och skorsten ovanpå taket – man kan gå upp på dem och färgen fastnar på dem
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  const half = (alongX ? r.z1 - r.z0 : r.x1 - r.x0) / 2;
  for (let k = 1; k <= 3; k++) {
    const inset = (half * k) / 4, y = r.y1 + (k - 1) * 0.35;
    const col = k % 2 ? darker(roof, 0.88) : roof;
    if (alongX) add(r.x0 + 0.1, r.z0 + inset, r.x1 - 0.1, r.z1 - inset, y, y + 0.35, 'gable', col);
    else add(r.x0 + inset, r.z0 + 0.1, r.x1 - inset, r.z1 - 0.1, y, y + 0.35, 'gable', col);
  }
  const chx = r.x1 - 1.4, chz = r.z0 + 1.4;
  add(chx - 0.25, chz - 0.25, chx + 0.25, chz + 0.25, r.y1, r.y1 + 1.3, 'chimney', 0x9a4a3a);
}

function darker(hex, k) {
  const c = (v) => Math.round(v * k);
  return (c((hex >> 16) & 255) << 16) | (c((hex >> 8) & 255) << 8) | c(hex & 255);
}

function buildTown(add, free, decor) {
  // Torg med fontän i mitten
  add(-7, -7, 7, 7, 0, 0.05, 'plaza', 0xc9c1b0);
  add(-3, -3, 3, -2.6, 0, 0.7, 'stone', 0xb8b0a0);
  add(-3, 2.6, 3, 3, 0, 0.7, 'stone', 0xb8b0a0);
  add(-3, -2.6, -2.6, 2.6, 0, 0.7, 'stone', 0xb8b0a0);
  add(2.6, -2.6, 3, 2.6, 0, 0.7, 'stone', 0xb8b0a0);
  add(-2.6, -2.6, 2.6, 2.6, 0, 0.35, 'pool', 0x3fa9f5);
  add(-0.4, -0.4, 0.4, 0.4, 0, 1.8, 'stone', 0xa8a090);
  add(-1.1, -1.1, 1.1, 1.1, 1.8, 2.1, 'stone', 0xb8b0a0);

  // Gator: två huvudgator genom torget och en ringväg som binder ihop baserna
  const R = 1.2; // halva gatubredden
  add(-26.8, -R, -7, R, 0, 0.04, 'road', 0xbcae90);
  add(7, -R, 26.8, R, 0, 0.04, 'road', 0xbcae90);
  add(-R, -26.8, R, -7, 0, 0.04, 'road', 0xbcae90);
  add(-R, 7, R, 26.8, 0, 0.04, 'road', 0xbcae90);
  add(-23, -28 - R, 23, -28 + R, 0, 0.04, 'road', 0xbcae90);
  add(-23, 28 - R, 23, 28 + R, 0, 0.04, 'road', 0xbcae90);
  add(-28 - R, -23, -28 + R, 23, 0, 0.04, 'road', 0xbcae90);
  add(28 - R, -23, 28 + R, 23, 0, 0.04, 'road', 0xbcae90);

  // Hus i rader längs huvudgatorna med dörren mot gatan: x, z, bredd, djup, dörr, väggfärg, takfärg
  const houses = [
    // Västra gatan
    [-12, -5, 6, 5, 's', 0xf2d7a6, 0xc0392b],
    [-20, -5, 6, 5, 's', 0xfff1b8, 0x8e5a2b],
    [-12, 5, 6, 5, 'n', 0xe0d0f5, 0x8e5a2b],
    [-20, 5, 6, 5, 'n', 0xbfe3f2, 0xc0392b],
    // Östra gatan (dammen ligger norr om den)
    [21.5, -5, 5, 5, 's', 0xc8f0e0, 0x8e5a2b],
    [12, 5, 6, 5, 'n', 0xf5d0b5, 0xc0392b],
    [20, 5, 6, 5, 'n', 0xf7c6d9, 0x8e5a2b],
    // Norra gatan
    [-5, -12, 5, 6, 'e', 0xd6f2bf, 0xc0392b],
    [-5, -20, 5, 6, 'e', 0xf2d7a6, 0x8e5a2b],
    [5, -22, 5, 6, 'w', 0xe0d0f5, 0xc0392b],
    // Södra gatan
    [-5, 12, 5, 6, 'e', 0xfff1b8, 0xc0392b],
    [-5, 20, 5, 6, 'e', 0xbfe3f2, 0x8e5a2b],
    [5, 12, 5, 6, 'w', 0xc8f0e0, 0xc0392b],
    [5, 20, 5, 6, 'w', 0xf7c6d9, 0x8e5a2b],
  ];
  for (const [x, z, w, d, door, color, roof] of houses) house(add, x, z, w, d, door, color, roof);
  // Lådor att gömma sig bakom (och klättra upp till fönstret från) inne i några hus
  add(-14.4, -7.0, -13.2, -5.8, 0, 1.2, 'crate', 0xc8893f);
  add(13.2, 5.8, 14.4, 7.0, 0, 1.2, 'crate', 0xc8893f);
  add(-7.0, 21.2, -5.8, 22.4, 0, 1.2, 'crate', 0xc8893f);

  // Häckar och trädgårdsstaket ute mellan kvarteren
  add(-22, -13, -14, -12.4, 0, 1.0, 'hedge', 0x3f8f3a);
  add(-22, 12.4, -14, 13, 0, 1.0, 'hedge', 0x3f8f3a);
  add(14, 12.4, 22, 13, 0, 1.0, 'hedge', 0x3f8f3a);
  add(-13, 15, -12.4, 22, 0, 1.0, 'hedge', 0x3f8f3a);
  add(10, 16, 10.2, 22, 0, 1.2, 'fence', 0xf0f0f0);
  add(-22, -20.2, -16, -20, 0, 1.2, 'fence', 0xf0f0f0);

  scatter(rng(11), add, free, decor, 22, 16, 6);
}

const EMPTY = [];
export function boxesNear(map, x, z) {
  return map.grid.get(Math.floor(x / CELL) * 1000 + Math.floor(z / CELL)) || EMPTY;
}

// Högsta marken man kan stå på vid (x,z) givet nuvarande höjd y.
export function groundHeight(map, x, z, y, r = PLAYER_R * 0.7) {
  let g = inPond(x, z) ? -POND.depth : 0;
  for (let i = -1; i <= 1; i += 2) {
    for (let j = -1; j <= 1; j += 2) {
      const list = boxesNear(map, x + i * r, z + j * r);
      for (const b of list) {
        if (b.y1 > g && b.y1 <= y + STEP && x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1) g = b.y1;
      }
    }
  }
  return g;
}

// Lägsta taket ovanför den som står på höjd y vid (x,z). Infinity om det inte finns något.
export function ceilingHeight(map, x, z, y, r = PLAYER_R * 0.7) {
  let c = Infinity;
  for (let i = -1; i <= 1; i += 2) {
    for (let j = -1; j <= 1; j += 2) {
      for (const b of boxesNear(map, x + i * r, z + j * r)) {
        if (b.y0 > y + STEP && b.y0 < c && x + r > b.x0 && x - r < b.x1 && z + r > b.z0 && z - r < b.z1) c = b.y0;
      }
    }
  }
  return c;
}

// Skjuter ut en kropp ur väggar/lådor.
export function resolveXZ(map, b) {
  const R = PLAYER_R;
  for (let pass = 0; pass < 2; pass++) {
    const list = boxesNear(map, b.x, b.z);
    for (const o of list) {
      if (o.y1 <= b.y + STEP || o.y0 >= b.y + PLAYER_H) continue;
      const cx = Math.max(o.x0, Math.min(b.x, o.x1));
      const cz = Math.max(o.z0, Math.min(b.z, o.z1));
      const dx = b.x - cx, dz = b.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        b.x = cx + (dx / d) * R;
        b.z = cz + (dz / d) * R;
      } else {
        const px = Math.min(b.x - o.x0, o.x1 - b.x);
        const pz = Math.min(b.z - o.z0, o.z1 - b.z);
        if (px < pz) b.x = b.x - o.x0 < o.x1 - b.x ? o.x0 - R : o.x1 + R;
        else b.z = b.z - o.z0 < o.z1 - b.z ? o.z0 - R : o.z1 + R;
      }
      b.blocked = true;
    }
  }
  const lim = MAP_HALF - R;
  b.x = Math.max(-lim, Math.min(lim, b.x));
  b.z = Math.max(-lim, Math.min(lim, b.z));
}

// Träffar en punkt något fast? Returnerar normal eller null.
export function pointHitsWorld(map, x, y, z) {
  const g = inPond(x, z) ? -POND.depth + 0.4 : 0;
  if (y <= g) return [0, 1, 0];
  for (const o of boxesNear(map, x, z)) {
    if (x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1 && y > o.y0 && y < o.y1) {
      if (o.kind === 'fence' && !onFence(o, x, y, z)) continue; // mellan ribborna
      const d = [x - o.x0, o.x1 - x, o.y1 - y, z - o.z0, o.z1 - z];
      let m = 0;
      for (let i = 1; i < 5; i++) if (d[i] < d[m]) m = i;
      return [[-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]][m];
    }
  }
  return null;
}

// Staketet krockar som en hel vägg för djuren men ser ut som stolpar (var 2:a meter) och två ribbor.
export function fenceRails(b) {
  return [b.y1 * 0.32, b.y1 * 0.73];
}

// Ligger punkten i en stolpe eller ribba? (staketet är 1 tjockt runt kanten, men ritas i mitten)
function onFence(b, x, y, z) {
  const long = b.x1 - b.x0 > b.z1 - b.z0;
  const p = long ? x : z, start = long ? b.x0 : b.z0;
  const off = (p - start) % 2;
  if (off < 0.15 || off > 1.85) return true;
  for (const r of fenceRails(b)) if (y > r - 0.05 && y < r + 0.3) return true;
  return false;
}

// Fri sikt mellan två punkter? Används så att skott inte träffar genom väggar.
export function clearLine(map, ax, ay, az, bx, by, bz) {
  const d = Math.hypot(bx - ax, by - ay, bz - az);
  const n = Math.ceil(d / 0.1);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (pointHitsWorld(map, ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

// Vilken låda och sida träffades vid (x,y,z) med normalen n? Punkten ligger strax innanför ytan.
// Lådor kan överlappa (kullen), så välj den vars yta i normalens riktning ligger närmast.
export function hitBox(map, x, y, z, n) {
  const q = [x - n[0] * 0.05, y - n[1] * 0.05, z - n[2] * 0.05];
  const axis = n[0] ? 0 : n[1] ? 1 : 2;
  const sign = n[axis] > 0 ? 1 : -1;
  let best = null, bestD = Infinity;
  for (const o of boxesNear(map, q[0], q[2])) {
    if (q[0] < o.x0 || q[0] > o.x1 || q[2] < o.z0 || q[2] > o.z1 || q[1] < o.y0 || q[1] > o.y1) continue;
    const lo = [o.x0, o.y0, o.z0][axis], hi = [o.x1, o.y1, o.z1][axis];
    const d = sign > 0 ? hi - q[axis] : q[axis] - lo;
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

export function baseSpawn(baseIndex) {
  const b = BASES[baseIndex % BASES.length];
  const a = Math.random() * Math.PI * 2;
  const x = b.x + Math.cos(a) * 2;
  const z = b.z + Math.sin(a) * 2;
  return { x, y: 0, z, ry: Math.atan2(-b.x, -b.z) };
}
