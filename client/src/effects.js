// Färgklickar som flyger och små stänk-partiklar.
import * as THREE from 'three';
import { pointHitsWorld } from '../../shared/map.js';

export class Projectiles {
  constructor(scene, map, max = 160) {
    this.map = map;
    this.list = [];
    this.max = max;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color());
    scene.add(this.mesh);
    this.m = new THREE.Matrix4();
    this.c = new THREE.Color();
  }
  add(s) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ id: s.id, x: s.o[0], y: s.o[1], z: s.o[2], vx: s.v[0], vy: s.v[1], vz: s.v[2], g: s.g, s: s.s, c: s.c, age: 0 });
  }
  remove(id) {
    const i = this.list.findIndex((p) => p.id === id);
    if (i >= 0) this.list.splice(i, 1);
  }
  clear() {
    this.list.length = 0;
  }
  update(dt, onWorldHit) {
    let n = 0;
    let w = 0; // kompaktera listan på plats – ingen ny array varje bildruta
    const list = this.list;
    for (let r = 0; r < list.length; r++) {
      const p = list[r];
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy -= p.g * dt;
      p.age += dt;
      if (p.age > 4 || pointHitsWorld(this.map, p.x, p.y, p.z)) {
        // Servern skickar riktiga fläcken; här bara ett litet stänk
        if (p.age <= 4 && onWorldHit) onWorldHit(p);
        continue;
      }
      list[w++] = p;
      if (this.trail && (p.trail = (p.trail || 0) + dt) > 0.035) {
        p.trail = 0;
        this.trail(p);
      }
      const s = p.s;
      this.m.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, this.c.set(p.c));
      n++;
    }
    list.length = w;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Particles {
  constructor(scene, max = 220) {
    this.max = max;
    this.list = [];
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color());
    scene.add(this.mesh);
    this.m = new THREE.Matrix4();
    this.c = new THREE.Color();
  }
  burst(pos, color, count = 10, power = 4) {
    for (let i = 0; i < count; i++) {
      this.spawn(pos[0], pos[1], pos[2],
        (Math.random() * 2 - 1) * power, Math.random() * power * 1.2, (Math.random() * 2 - 1) * power,
        0.5 + Math.random() * 0.3, color, 15, 1);
    }
  }
  // Mjuka dammpuffar (vid landning och spring) och färgsvans efter skott
  puff(x, y, z, count = 5, color = 0xe8dcc0, size = 1.3) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn(x, y + 0.05, z, Math.cos(a) * 1.6, 0.6 + Math.random() * 0.8, Math.sin(a) * 1.6, 0.35 + Math.random() * 0.2, color, 1, size);
    }
  }
  trail(x, y, z, color, size) {
    this.spawn(x, y, z, 0, 0, 0, 0.22, color, 0, size);
  }
  spawn(x, y, z, vx, vy, vz, life, c, g, s) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ x, y, z, vx, vy, vz, life, c, g, s });
  }
  update(dt) {
    let n = 0;
    let w = 0;
    const list = this.list;
    for (let r = 0; r < list.length; r++) {
      const p = list[r];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy -= p.g * dt;
      list[w++] = p;
      const s = Math.min(1, p.life * 2.5) * p.s;
      this.m.makeScale(s, s, s).setPosition(p.x, p.y, p.z);
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, this.c.set(p.c));
      n++;
    }
    list.length = w;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
