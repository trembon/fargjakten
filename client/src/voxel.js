// Bygger en enda sammanslagen geometri av voxlar (små kuber). Dolda sidor tas bort.
import * as THREE from 'three';

const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.86 },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.86 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.6 },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.93 },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.93 },
];

export class Vox {
  constructor() {
    this.v = new Map();
  }
  set(x, y, z, c) {
    this.v.set(`${x},${y},${z}`, [x, y, z, c]);
    return this;
  }
  // Fyller en låda, gränserna är inkluderade.
  box(x0, y0, z0, x1, y1, z1, c) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.set(x, y, z, c);
    return this;
  }
  // Samma låda på båda sidor (spegling kring x = 0, där voxel x speglas till -1-x).
  sym(x0, y0, z0, x1, y1, z1, c) {
    this.box(x0, y0, z0, x1, y1, z1, c);
    this.box(-1 - x0, y0, z0, -1 - x1, y1, z1, c);
    return this;
  }
  symSet(x, y, z, c) {
    this.set(x, y, z, c);
    this.set(-1 - x, y, z, c);
    return this;
  }
  has(x, y, z) {
    return this.v.has(`${x},${y},${z}`);
  }
  build(scale = 0.1, jitter = 0.06) {
    const pos = [], nor = [], col = [], idx = [];
    const color = new THREE.Color();
    for (const [x, y, z, c] of this.v.values()) {
      color.set(c);
      const j = 1 - jitter + Math.random() * jitter * 2;
      for (const f of FACES) {
        if (this.has(x + f.n[0], y + f.n[1], z + f.n[2])) continue;
        const base = pos.length / 3;
        for (const p of f.c) {
          pos.push((x + p[0]) * scale, (y + p[1]) * scale, (z + p[2]) * scale);
          nor.push(f.n[0], f.n[1], f.n[2]);
          const s = f.shade * j;
          col.push(color.r * s, color.g * s, color.b * s);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }
}

// Hjälp för att bygga stora lådor (kartan) med vertexfärger i en gemensam geometri.
export class BoxBatch {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.idx = [];
    this.c = new THREE.Color();
  }
  add(x0, y0, z0, x1, y1, z1, hex, opts = {}) {
    // ao: sidornas nederkant blir mörkare – en billig "skugga i hörnet" som gör allt mer 3D
    const { jitter = 0.05, skipBottom = true, ao = 0.28 } = opts;
    this.c.set(hex);
    const j = 1 - jitter + Math.random() * jitter * 2;
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    for (let fi = 0; fi < FACES.length; fi++) {
      if (skipBottom && fi === 3) continue;
      const f = FACES[fi];
      const base = this.pos.length / 3;
      const side = f.n[1] === 0;
      for (const p of f.c) {
        this.pos.push(x0 + p[0] * sx, y0 + p[1] * sy, z0 + p[2] * sz);
        this.nor.push(f.n[0], f.n[1], f.n[2]);
        const s = f.shade * j * (side && p[1] === 0 ? 1 - ao : 1);
        this.col.push(this.c.r * s, this.c.g * s, this.c.b * s);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}
