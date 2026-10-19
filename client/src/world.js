// Ritar kartan, färgfläckar i världen och maten.
import * as THREE from 'three';
import { FOODS } from '../../shared/constants.js';
import { BASES, BASE_HALF, MAP_HALF, POND, boxesNear, fenceRails, hitBox, inBase, inPond, pointHitsWorld } from '../../shared/map.js';
import { BoxBatch } from './voxel.js';
import { foodGeometry } from './models.js';

const worldMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

// Fröad slump så att gräs och blommor hamnar på samma ställe varje gång
function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  return c.multiplyScalar(k).getHex();
}

const GRASS = [0x7ccf4a, 0x72c443, 0x79c946, 0x6fbf40];
const FLOWERS = [0xffffff, 0xffd21f, 0xff6fa8, 0xb44dff, 0xff3b3b];

// Allt läggs i en grupp så att världen kan rivas och byggas om när banan byts.
export function buildWorld(scene, map) {
  const group = new THREE.Group();
  scene.add(group);
  // Mark i rutor
  const ground = new BoxBatch();
  const T = 2;
  // Gräset går en bit utanför staketet så att staketet står på marken
  const EDGE = MAP_HALF + 4;
  for (let x = -EDGE; x < EDGE; x += T) {
    for (let z = -EDGE; z < EDGE; z += T) {
      const cx = x + T / 2, cz = z + T / 2;
      if (cx > POND.x0 && cx < POND.x1 && cz > POND.z0 && cz < POND.z1) continue;
      const even = ((x + z) / T) % 2 === 0;
      const tone = GRASS[(even ? 0 : 1) + (Math.abs(x * 7 + z * 13) % 5 === 0 ? 2 : 0)];
      ground.add(x, -0.3, z, x + T, 0, z + T, tone, { jitter: 0.04, ao: 0 });
    }
  }
  // Damm: sandbotten
  ground.add(POND.x0, -POND.depth - 0.2, POND.z0, POND.x1, -POND.depth, POND.z1, 0xe3cf8f, { jitter: 0 });

  // Baser: färgad platta, butiksdisk med tak och flagga
  for (const b of BASES) {
    ground.add(b.x - BASE_HALF, 0, b.z - BASE_HALF, b.x + BASE_HALF, 0.05, b.z + BASE_HALF, b.color, { jitter: 0 });
    ground.add(b.x - BASE_HALF + 1, 0.05, b.z - BASE_HALF + 1, b.x + BASE_HALF - 1, 0.07, b.z + BASE_HALF - 1, 0xffffff, { jitter: 0 });
    ground.add(b.x - BASE_HALF + 1.4, 0.07, b.z - BASE_HALF + 1.4, b.x + BASE_HALF - 1.4, 0.09, b.z + BASE_HALF - 1.4, b.color, { jitter: 0 });
    // Butik i hörnet längst från mitten
    const sx = b.x + Math.sign(b.x) * 3, sz = b.z + Math.sign(b.z) * 3;
    ground.add(sx - 1.2, 0, sz - 0.5, sx + 1.2, 1.0, sz + 0.5, 0xd9a066);
    ground.add(sx - 1.2, 1.0, sz - 0.5, sx - 1.0, 2.4, sz - 0.3, 0x8a5a2a);
    ground.add(sx + 1.0, 1.0, sz - 0.5, sx + 1.2, 2.4, sz - 0.3, 0x8a5a2a);
    ground.add(sx - 1.0, 1.0, sz + 0.3, sx - 0.8, 2.4, sz + 0.5, 0x8a5a2a);
    ground.add(sx + 0.8, 1.0, sz + 0.3, sx + 1.0, 2.4, sz + 0.5, 0x8a5a2a);
    for (let i = 0; i < 6; i++) {
      ground.add(sx - 1.4 + i * 0.47, 2.4, sz - 0.8, sx - 1.4 + (i + 1) * 0.47, 2.7, sz + 0.8, i % 2 ? 0xffffff : b.color, { jitter: 0 });
    }
    // Varor på disken
    ground.add(sx - 0.8, 1.0, sz - 0.2, sx - 0.4, 1.3, sz + 0.2, 0x3b7bff);
    ground.add(sx - 0.2, 1.0, sz - 0.2, sx + 0.2, 1.4, sz + 0.2, 0xff8a1f);
    ground.add(sx + 0.4, 1.0, sz - 0.2, sx + 0.8, 1.25, sz + 0.2, 0x2e9e4f);
    // Flaggstång
    const fx = b.x - Math.sign(b.x) * 4, fz = b.z + Math.sign(b.z) * 4;
    ground.add(fx - 0.08, 0, fz - 0.08, fx + 0.08, 4, fz + 0.08, 0xdddddd);
    ground.add(fx + 0.08, 3.1, fz - 0.04, fx + 1.4, 3.9, fz + 0.04, b.color, { jitter: 0 });
  }
  // Grästuvor och blommor
  const rnd = seeded(1234);
  const indoors = (x, z) => boxesNear(map, x, z).some((b) => b.kind === 'roof' && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
  const freeSpot = (x, z) => inBase(x, z, 0.3) < 0 && !inPond(x, z, 0.3) && !pointHitsWorld(map, x, 0.02, z) && !indoors(x, z);
  for (let i = 0; i < 420; i++) {
    const x = (rnd() * 2 - 1) * (MAP_HALF - 0.5), z = (rnd() * 2 - 1) * (MAP_HALF - 0.5);
    if (!freeSpot(x, z)) continue;
    const c = rnd() < 0.5 ? 0x5fae36 : 0x8ad65a;
    for (let k = 0; k < 3; k++) {
      const bx = x + (rnd() - 0.5) * 0.25, bz = z + (rnd() - 0.5) * 0.25, h = 0.12 + rnd() * 0.18;
      ground.add(bx - 0.025, 0, bz - 0.025, bx + 0.025, h, bz + 0.025, c, { ao: 0.4 });
    }
  }
  for (let i = 0; i < 110; i++) {
    const x = (rnd() * 2 - 1) * (MAP_HALF - 0.5), z = (rnd() * 2 - 1) * (MAP_HALF - 0.5);
    if (!freeSpot(x, z)) continue;
    const h = 0.18 + rnd() * 0.12;
    ground.add(x - 0.02, 0, z - 0.02, x + 0.02, h, z + 0.02, 0x4f9e2e, { ao: 0 });
    ground.add(x - 0.07, h, z - 0.07, x + 0.07, h + 0.07, z + 0.07, FLOWERS[Math.floor(rnd() * FLOWERS.length)], { jitter: 0, ao: 0 });
    ground.add(x - 0.03, h + 0.07, z - 0.03, x + 0.03, h + 0.09, z + 0.03, 0xffc21f, { jitter: 0, ao: 0 });
  }
  group.add(new THREE.Mesh(ground.build(), worldMaterial));

  // Hinder
  const solid = new BoxBatch();
  for (const b of map.boxes) {
    if (b.kind === 'shop') continue;
    if (b.kind === 'crate') {
      solid.add(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, b.color);
      // Mörka kanter så att det ser ut som en trälåda
      const e = 0.08;
      solid.add(b.x0 - 0.01, b.y1 - e, b.z0 - 0.01, b.x1 + 0.01, b.y1 + 0.01, b.z0 + e, 0x8a5420);
      solid.add(b.x0 - 0.01, b.y1 - e, b.z1 - e, b.x1 + 0.01, b.y1 + 0.01, b.z1 + 0.01, 0x8a5420);
      solid.add(b.x0 - 0.01, b.y1 - e, b.z0, b.x0 + e, b.y1 + 0.01, b.z1, 0x8a5420);
      solid.add(b.x1 - e, b.y1 - e, b.z0, b.x1 + 0.01, b.y1 + 0.01, b.z1, 0x8a5420);
    } else if (b.kind === 'fence') {
      // Staketet: stolpar och ribbor i stället för en hel vägg
      const long = b.x1 - b.x0 > b.z1 - b.z0;
      const len = long ? b.x1 - b.x0 : b.z1 - b.z0;
      for (let t = 0; t <= len; t += 2) {
        const px = long ? b.x0 + t : (b.x0 + b.x1) / 2;
        const pz = long ? (b.z0 + b.z1) / 2 : b.z0 + t;
        solid.add(px - 0.15, -0.3, pz - 0.15, px + 0.15, b.y1, pz + 0.15, 0x8a5a2a);
      }
      for (const y of fenceRails(b)) {
        if (long) solid.add(b.x0, y, (b.z0 + b.z1) / 2 - 0.08, b.x1, y + 0.25, (b.z0 + b.z1) / 2 + 0.08, b.color);
        else solid.add((b.x0 + b.x1) / 2 - 0.08, y, b.z0, (b.x0 + b.x1) / 2 + 0.08, y + 0.25, b.z1, b.color);
      }
    } else if (b.kind === 'trunk') {
      solid.add(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, b.color, { jitter: 0.08 });
      // Bark: mörkare ränder och rötter vid foten
      const dark = shade(b.color, 0.75);
      for (let y = 0.5 + rnd() * 0.4; y < b.y1 - 0.6; y += 0.7 + rnd() * 0.5) {
        solid.add(b.x0 - 0.02, y, b.z0 - 0.02, b.x1 + 0.02, y + 0.08, b.z1 + 0.02, dark, { jitter: 0, ao: 0 });
      }
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      solid.add(b.x0 - 0.2, 0, cz - 0.12, b.x0, 0.2, cz + 0.12, dark);
      solid.add(b.x1, 0, cz - 0.12, b.x1 + 0.2, 0.15, cz + 0.12, dark);
      solid.add(cx - 0.12, 0, b.z1, cx + 0.12, 0.18, b.z1 + 0.2, dark);
    } else if (b.kind === 'rock') {
      solid.add(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, b.color, { jitter: 0.08 });
      // En mindre sten bredvid och lite mossa på toppen
      const w = (b.x1 - b.x0) * 0.3, d = (b.z1 - b.z0) * 0.3;
      solid.add(b.x1 - w * 0.5, 0, b.z1 - d * 0.5, b.x1 + w * 0.6, (b.y1 - b.y0) * 0.5, b.z1 + d * 0.6, 0x8a8a8a, { jitter: 0.1 });
      if (rnd() < 0.6) solid.add(b.x0 + w * 0.4, b.y1, b.z0 + d * 0.4, b.x1 - w, b.y1 + 0.04, b.z1 - d, 0x6aa84f, { jitter: 0.1, ao: 0 });
    } else if (b.kind === 'wall') {
      solid.add(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, b.color, { jitter: 0.08 });
      // Tegelrader och en kant överst
      const long = b.x1 - b.x0 > b.z1 - b.z0;
      for (const y of [0.4, 0.8, 1.2]) {
        if (long) solid.add(b.x0, y, b.z0 - 0.01, b.x1, y + 0.04, b.z1 + 0.01, shade(b.color, 0.85), { jitter: 0, ao: 0 });
        else solid.add(b.x0 - 0.01, y, b.z0, b.x1 + 0.01, y + 0.04, b.z1, shade(b.color, 0.85), { jitter: 0, ao: 0 });
      }
      solid.add(b.x0 - 0.06, b.y1, b.z0 - 0.06, b.x1 + 0.06, b.y1 + 0.1, b.z1 + 0.06, shade(b.color, 1.08), { jitter: 0 });
    } else if (b.kind === 'house') {
      solid.add(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, b.color, { jitter: 0.03 });
      // Mörkare sockel längs golvet
      if (b.y0 === 0 && b.y1 > 0.3) solid.add(b.x0 - 0.01, 0, b.z0 - 0.01, b.x1 + 0.01, 0.25, b.z1 + 0.01, shade(b.color, 0.75), { jitter: 0, ao: 0 });
    } else if (b.kind === 'roof') {
      solid.add(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, b.color, { jitter: 0.04, skipBottom: false });
      // Trägolv inne i huset (gavlarna och skorstenen är egna lådor i kartan)
      solid.add(b.x0 + 0.5, 0, b.z0 + 0.5, b.x1 - 0.5, 0.03, b.z1 - 0.5, 0xb88a55, { jitter: 0.02, ao: 0 });
    } else if (b.kind === 'plaza') {
      // Stenplattor i två toner
      for (let x = b.x0; x < b.x1; x += 1) {
        for (let z = b.z0; z < b.z1; z += 1) {
          const tone = (Math.floor(x) + Math.floor(z)) % 2 ? b.color : shade(b.color, 0.92);
          solid.add(x, b.y0, z, x + 1, b.y1, z + 1, tone, { jitter: 0.02, ao: 0 });
        }
      }
    } else if (b.kind === 'road') {
      // Kullersten i två toner med en mörkare kantsten längs sidorna
      const long = b.x1 - b.x0 > b.z1 - b.z0;
      const S = 1.2;
      for (let x = b.x0; x < b.x1 - 0.01; x += S) {
        for (let z = b.z0; z < b.z1 - 0.01; z += S) {
          const k = Math.round((x - b.x0) / S) + Math.round((z - b.z0) / S);
          const tone = k % 2 ? b.color : shade(b.color, 0.9);
          solid.add(x, b.y0, z, Math.min(x + S, b.x1), b.y1, Math.min(z + S, b.z1), tone, { jitter: 0.03, ao: 0 });
        }
      }
      const kerb = shade(b.color, 0.7);
      if (long) {
        solid.add(b.x0, 0, b.z0 - 0.15, b.x1, 0.08, b.z0, kerb, { jitter: 0, ao: 0 });
        solid.add(b.x0, 0, b.z1, b.x1, 0.08, b.z1 + 0.15, kerb, { jitter: 0, ao: 0 });
      } else {
        solid.add(b.x0 - 0.15, 0, b.z0, b.x0, 0.08, b.z1, kerb, { jitter: 0, ao: 0 });
        solid.add(b.x1, 0, b.z0, b.x1 + 0.15, 0.08, b.z1, kerb, { jitter: 0, ao: 0 });
      }
    } else if (b.kind === 'hedge') {
      solid.add(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, b.color, { jitter: 0.12 });
      solid.add(b.x0 + 0.05, b.y1, b.z0 + 0.05, b.x1 - 0.05, b.y1 + 0.08, b.z1 - 0.05, shade(b.color, 1.2), { jitter: 0.1, ao: 0 });
    } else if (b.kind === 'gable') {
      solid.add(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, b.color, { jitter: 0.03 });
    } else if (b.kind === 'pool') {
      solid.add(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, b.color, { jitter: 0.03, ao: 0 });
    } else {
      solid.add(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1, b.color, { jitter: 0.08 });
    }
  }
  // Lövverk: en stor klump, några mindre runt om, ljusare topp och ibland äpplen eller blommor
  for (const d of map.decor) {
    const s = d.s;
    const light = shade(d.color, 1.18);
    solid.add(d.x - s, d.y - 0.4, d.z - s, d.x + s, d.y + s, d.z + s, d.color, { skipBottom: false });
    solid.add(d.x - s * 0.6, d.y + s, d.z - s * 0.6, d.x + s * 0.6, d.y + s * 1.6, d.z + s * 0.6, light, { skipBottom: false, ao: 0.15 });
    const clumps = [];
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + rnd() * 0.8;
      const cs = s * (0.45 + rnd() * 0.15);
      const cx = d.x + Math.cos(a) * s * 0.95, cz = d.z + Math.sin(a) * s * 0.95, cy = d.y + (rnd() - 0.3) * s * 0.6;
      solid.add(cx - cs, cy - cs, cz - cs, cx + cs, cy + cs, cz + cs, k % 2 ? light : shade(d.color, 0.92), { skipBottom: false });
      clumps.push([cx, cy, cz, cs]);
    }
    const fruit = rnd();
    if (fruit < 0.55) {
      const col = fruit < 0.35 ? 0xe8322b : 0xffb3d1;
      for (let k = 0; k < 6; k++) {
        const [cx, cy, cz, cs] = clumps[k % clumps.length];
        const a = rnd() * Math.PI * 2;
        const fx = cx + Math.cos(a) * (cs + 0.04), fz = cz + Math.sin(a) * (cs + 0.04), fy = cy + (rnd() - 0.5) * cs;
        solid.add(fx - 0.09, fy - 0.09, fz - 0.09, fx + 0.09, fy + 0.09, fz + 0.09, col, { skipBottom: false, ao: 0 });
      }
    }
  }
  group.add(new THREE.Mesh(solid.build(), worldMaterial));

  // Vatten
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(POND.x1 - POND.x0, POND.z1 - POND.z0),
    new THREE.MeshLambertMaterial({ color: 0x3fa9f5, transparent: true, opacity: 0.6 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((POND.x0 + POND.x1) / 2, -0.15, (POND.z0 + POND.z1) / 2);
  group.add(water);
  // Dammens väggar
  const pw = new BoxBatch();
  pw.add(POND.x0 - 0.01, -POND.depth, POND.z0, POND.x0, 0, POND.z1, 0x9c7b4a);
  pw.add(POND.x1, -POND.depth, POND.z0, POND.x1 + 0.01, 0, POND.z1, 0x9c7b4a);
  pw.add(POND.x0, -POND.depth, POND.z0 - 0.01, POND.x1, 0, POND.z0, 0x9c7b4a);
  pw.add(POND.x0, -POND.depth, POND.z1, POND.x1, 0, POND.z1 + 0.01, 0x9c7b4a);
  group.add(new THREE.Mesh(pw.build(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));

  // Näckrosblad på vattnet
  const lily = new BoxBatch();
  for (let i = 0; i < 7; i++) {
    const x = POND.x0 + 1 + rnd() * (POND.x1 - POND.x0 - 2), z = POND.z0 + 1 + rnd() * (POND.z1 - POND.z0 - 2), s = 0.3 + rnd() * 0.2;
    lily.add(x - s, -0.14, z - s, x + s, -0.11, z + s, 0x3f9e3a, { ao: 0 });
    if (i % 3 === 0) lily.add(x - 0.1, -0.11, z - 0.1, x + 0.1, 0.02, z + 0.1, 0xff9fd0, { jitter: 0, ao: 0 });
  }
  group.add(new THREE.Mesh(lily.build(), worldMaterial));

  // Himmel: mjuk övergång från ljust vid horisonten till blått uppåt
  const skyGeo = new THREE.SphereGeometry(85, 20, 10);
  const top = new THREE.Color(0x4aa8f0), horizon = new THREE.Color(0x8fd3ff), col = [];
  const sp = skyGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const k = Math.max(0, sp.getY(i) / 85);
    const c = horizon.clone().lerp(top, Math.pow(k, 0.7));
    col.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -10;
  group.add(sky);

  // Moln av vita kuber som driver långsamt
  const cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false });
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const cb = new BoxBatch();
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const w = 2 + rnd() * 2.5, h = 1 + rnd() * 0.8, d = 2 + rnd() * 2;
      const ox = k * 2.2 - n, oz = (rnd() - 0.5) * 2, oy = rnd() * 0.8;
      cb.add(ox - w, oy, oz - d, ox + w, oy + h, oz + d, 0xffffff, { jitter: 0.02, skipBottom: false, ao: 0.12 });
    }
    const c = new THREE.Mesh(cb.build(), cloudMat);
    c.position.set((rnd() * 2 - 1) * 70, 26 + rnd() * 8, (rnd() * 2 - 1) * 60);
    c.userData.speed = 0.6 + rnd() * 0.8;
    group.add(c);
    clouds.push(c);
  }

  let t = 0;
  return {
    water,
    update(dt, camera) {
      t += dt;
      sky.position.copy(camera.position);
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 75) c.position.x = -75;
      }
      // Vattnet glittrar lite
      water.material.opacity = 0.58 + Math.sin(t * 1.7) * 0.05;
      water.material.emissive.setRGB(0.02, 0.06 + Math.sin(t * 2.3) * 0.03, 0.12);
    },
    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        if (o.material !== worldMaterial) o.material.dispose();
      });
    },
  };
}

// Ljuspelare över den egna basen så man hittar hem.
export function createBaseBeacon(baseIndex, color) {
  const b = BASES[baseIndex];
  const geo = new THREE.CylinderGeometry(0.6, 0.6, 30, 10, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(b.x, 15, b.z);
  return m;
}

// ---------------- Färgfläckar i världen ----------------

const SPLAT_LIFE = 30; // sekunder innan en fläck börjar torka bort
const SPLAT_FADE = 2; // sekunder det tar att krympa bort

// En oregelbunden färgklick med några droppar runt – vit, så att varje fläck kan färgas.
function splatTexture() {
  const N = 64;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  const pts = 18;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const r = N * (0.3 + Math.random() * 0.08 + (i % 3 === 0 ? 0.05 : 0));
    const x = N / 2 + Math.cos(a) * r, y = N / 2 + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.fill();
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2, d = N * (0.36 + Math.random() * 0.09);
    g.beginPath();
    g.arc(N / 2 + Math.cos(a) * d, N / 2 + Math.sin(a) * d, N * (0.025 + Math.random() * 0.035), 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

export class Splats {
  constructor(scene, map, max = 320) {
    this.map = map;
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshLambertMaterial({
      map: splatTexture(), alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.max = max;
    this.next = 0;
    this.used = 0;
    this.base = new Float32Array(max * 16); // fläckens matris i full storlek
    this.born = new Float64Array(max).fill(-1); // -1 = borta
    this.m = new THREE.Matrix4();
    this.c = new THREE.Color();
    this.u = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.n = new THREE.Vector3();
    this.p = new THREE.Vector3();
    this.mesh.setColorAt(0, this.c.set(0xffffff));
    scene.add(this.mesh);
  }

  // Lägg en fläck. Den anpassas efter ytan den träffar så att den inte sticker ut i luften.
  add(pos, normal, color, size) {
    const axis = normal[0] ? 0 : normal[1] ? 1 : 2;
    const sign = normal[axis] > 0 ? 1 : -1;
    // Ytans två riktningar (u × v = normalen, annars vänder fläcken baksidan till)
    const a = (axis + 1) % 3, b = (axis + 2) % 3;
    const ua = sign > 0 ? a : b, va = sign > 0 ? b : a;
    const p = [pos[0], pos[1], pos[2]];
    let r = size * 0.5 * (0.8 + Math.random() * 0.4);
    let ru = r, rv = r;
    let spin = true;

    const box = hitBox(this.map, pos[0], pos[1], pos[2], normal);
    if (box) {
      let lo = [box.x0, box.y0, box.z0], hi = [box.x1, box.y1, box.z1];
      if (box.kind === 'fence') {
        const f = fenceFace(box, p, axis, sign);
        if (!f) return false; // mellan ribborna finns inget att färga
        lo = f.lo; hi = f.hi;
      }
      p[axis] = sign > 0 ? hi[axis] : lo[axis];
      // Krymp fläcken till en ellips som ryms på ytan och flytta in den från kanterna
      ru = Math.min(r, (hi[ua] - lo[ua]) / 2);
      rv = Math.min(r, (hi[va] - lo[va]) / 2);
      p[ua] = Math.max(lo[ua] + ru, Math.min(hi[ua] - ru, p[ua]));
      p[va] = Math.max(lo[va] + rv, Math.min(hi[va] - rv, p[va]));
      spin = Math.abs(ru - rv) < 0.01;
    } else if (axis === 1 && sign > 0 && Math.abs(pos[1]) < 0.5) {
      p[1] = Math.max(p[1], 0); // marken ligger på y=0
    }

    this.n.set(normal[0], normal[1], normal[2]);
    this.u.copy(AXES[ua]);
    this.v.copy(AXES[va]);
    if (spin) {
      // Runda fläckar vrids slumpvis så att de inte ser likadana ut
      const ang = Math.random() * Math.PI * 2, cs = Math.cos(ang), sn = Math.sin(ang);
      const ux = this.u.x * cs + this.v.x * sn, uy = this.u.y * cs + this.v.y * sn, uz = this.u.z * cs + this.v.z * sn;
      this.v.set(this.v.x * cs - this.u.x * sn, this.v.y * cs - this.u.y * sn, this.v.z * cs - this.u.z * sn);
      this.u.set(ux, uy, uz);
    }
    this.u.multiplyScalar(ru * 2);
    this.v.multiplyScalar(rv * 2);
    this.p.set(p[0], p[1], p[2]).addScaledVector(this.n, 0.02);
    this.m.makeBasis(this.u, this.v, this.n).setPosition(this.p);

    const i = this.next;
    this.m.toArray(this.base, i * 16);
    this.born[i] = performance.now() / 1000;
    this.mesh.setMatrixAt(i, this.m);
    this.mesh.setColorAt(i, this.c.set(color));
    this.next = (this.next + 1) % this.max;
    this.used = Math.min(this.max, this.used + 1);
    this.mesh.count = this.used;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    return true;
  }

  // Gamla fläckar krymper bort
  update() {
    const t = performance.now() / 1000;
    let dirty = false;
    for (let i = 0; i < this.used; i++) {
      const born = this.born[i];
      if (born < 0) continue;
      const age = t - born;
      if (age < SPLAT_LIFE) continue;
      const k = 1 - (age - SPLAT_LIFE) / SPLAT_FADE;
      this.m.fromArray(this.base, i * 16);
      if (k <= 0) {
        this.born[i] = -1;
        this.m.makeScale(0, 0, 0);
      } else {
        const e = this.m.elements;
        for (let j = 0; j < 8; j++) e[j] *= k; // krymp i ytans två riktningar
      }
      this.mesh.setMatrixAt(i, this.m);
      dirty = true;
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.used = 0;
    this.next = 0;
    this.mesh.count = 0;
    this.born.fill(-1);
  }
}

// Staketet krockar som en hel vägg men ser ut som stolpar och ribbor (se buildWorld).
// Returnerar ytan på den stolpe eller ribba som träffades, eller null om skottet gick mellan.
function fenceFace(b, p, axis, sign) {
  const long = b.x1 - b.x0 > b.z1 - b.z0;
  const thin = long ? 2 : 0; // axeln tvärs genom staketet
  if (axis !== thin) return null;
  const along = long ? 0 : 2;
  const mid = long ? (b.z0 + b.z1) / 2 : (b.x0 + b.x1) / 2;
  const start = long ? b.x0 : b.z0, stop = long ? b.x1 : b.z1;
  const off = (p[along] - start) % 2;
  const lo = [0, 0, 0], hi = [0, 0, 0];
  if (off < 0.15 || off > 1.85) {
    const post = start + Math.round((p[along] - start) / 2) * 2;
    lo[along] = post - 0.15; hi[along] = post + 0.15;
    lo[1] = 0; hi[1] = b.y1;
    lo[thin] = mid - 0.15; hi[thin] = mid + 0.15;
    return { lo, hi };
  }
  for (const y of fenceRails(b)) {
    if (p[1] > y - 0.05 && p[1] < y + 0.3) {
      lo[along] = start; hi[along] = stop;
      lo[1] = y; hi[1] = y + 0.25;
      lo[thin] = mid - 0.08; hi[thin] = mid + 0.08;
      return { lo, hi };
    }
  }
  return null;
}

// ---------------- Mat ----------------

export class FoodView {
  constructor(scene) {
    this.items = new Map();
    this.meshes = {};
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const f of FOODS) {
      const m = new THREE.InstancedMesh(foodGeometry(f.id), mat, 40);
      m.count = 0;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
      this.meshes[f.id] = m;
    }
    // Lysande ring under maten så den syns på håll
    const ringGeo = new THREE.RingGeometry(0.32, 0.5, 16);
    ringGeo.rotateX(-Math.PI / 2);
    this.rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0xfff3a0, transparent: true, opacity: 0.55, depthWrite: false,
    }), 160);
    this.rings.count = 0;
    this.rings.frustumCulled = false;
    this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.rings);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
    this.p = new THREE.Vector3();
    this.one = new THREE.Vector3(1, 1, 1);
    this.rs = new THREE.Vector3();
    this.t = 0;
  }
  set(list) {
    this.items.clear();
    for (const f of list) this.items.set(f.id, f);
  }
  add(list) {
    for (const f of list) this.items.set(f.id, f);
  }
  remove(ids) {
    for (const id of ids) this.items.delete(id);
  }
  update(dt) {
    this.t += dt;
    const counts = {};
    let rings = 0;
    for (const k in this.meshes) counts[k] = 0;
    for (const f of this.items.values()) {
      const mesh = this.meshes[f.k];
      if (!mesh || counts[f.k] >= 40) continue;
      this.q.setFromAxisAngle(this.up, this.t * 1.5 + f.id);
      this.p.set(f.x, f.y + 0.15 + Math.sin(this.t * 3 + f.id) * 0.12, f.z);
      this.m.compose(this.p, this.q, this.one);
      mesh.setMatrixAt(counts[f.k]++, this.m);
      const pulse = 0.9 + Math.sin(this.t * 4 + f.id) * 0.15;
      this.rs.set(pulse, 1, pulse);
      this.p.set(f.x, f.y + 0.03, f.z);
      this.m.compose(this.p, this.q.identity(), this.rs);
      this.rings.setMatrixAt(rings++, this.m);
    }
    this.rings.count = rings;
    this.rings.instanceMatrix.needsUpdate = true;
    for (const k in this.meshes) {
      this.meshes[k].count = counts[k];
      this.meshes[k].instanceMatrix.needsUpdate = true;
    }
  }
}
