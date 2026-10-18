// Kartan byggs likadant på server och klient (samma frö = samma värld).

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

const CELL = 4;

export function createMap(seed = 7) {
  const r = rng(seed);
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

  // Lådor, ibland staplade
  for (let i = 0, tries = 0; i < 34 && tries < 2000; tries++) {
    const x = (r() * 2 - 1) * (H - 3), z = (r() * 2 - 1) * (H - 3);
    if (!free(x, z, 0.8)) continue;
    const s = 0.6;
    add(x - s, z - s, x + s, z + s, 0, 1.2, 'crate', 0xc8893f);
    if (r() < 0.35) add(x - s, z - s, x + s, z + s, 1.2, 2.4, 'crate', 0xb97a33);
    i++;
  }
  // Träd
  for (let i = 0, tries = 0; i < 24 && tries < 2000; tries++) {
    const x = (r() * 2 - 1) * (H - 3), z = (r() * 2 - 1) * (H - 3);
    if (!free(x, z, 1.2)) continue;
    const h = 2.8 + r() * 1.2;
    add(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 0, h, 'trunk', 0x7a4f2a);
    const leaf = r() < 0.5 ? 0x3e9e3e : 0x4fb548;
    decor.push({ x, z, y: h, s: 1.3 + r() * 0.6, color: leaf, kind: 'leaves' });
    i++;
  }
  // Stenar
  for (let i = 0, tries = 0; i < 14 && tries < 2000; tries++) {
    const x = (r() * 2 - 1) * (H - 3), z = (r() * 2 - 1) * (H - 3);
    const w = 0.8 + r() * 0.8, d = 0.8 + r() * 0.8;
    if (!free(x, z, Math.max(w, d))) continue;
    add(x - w, z - d, x + w, z + d, 0, 0.5 + r() * 0.5, 'rock', 0x9a9a9a);
    i++;
  }

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

  return { boxes, decor, grid, seed };
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
      const d = [x - o.x0, o.x1 - x, o.y1 - y, z - o.z0, o.z1 - z];
      let m = 0;
      for (let i = 1; i < 5; i++) if (d[i] < d[m]) m = i;
      return [[-1, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]][m];
    }
  }
  return null;
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
