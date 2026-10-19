// Ett djur i världen: modell, vapen på ryggen, färgfläckar, namnskylt och animation.
import * as THREE from 'three';
import { PAINT_MAX } from '../../shared/constants.js';
import { createAnimal, createWeapon, poseHold } from './models.js';

const MAX_SPOTS = 28;
const spotGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
const shadowGeo = new THREE.CircleGeometry(0.55, 12);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false });
const shieldGeo = new THREE.SphereGeometry(1.1, 12, 8);

function hexCss(c) {
  return '#' + c.toString(16).padStart(6, '0');
}

export class Avatar {
  constructor(scene, info, isMe) {
    this.id = info.id;
    this.isMe = isMe;
    this.animal = info.an;
    this.color = info.c;
    this.name = info.n;
    this.root = new THREE.Group();
    this.model = createAnimal(info.an);
    this.root.add(this.model.group);

    this.spotMat = new THREE.MeshLambertMaterial();
    this.spots = new THREE.InstancedMesh(spotGeo, this.spotMat, MAX_SPOTS);
    this.spots.count = 0;
    this.spots.frustumCulled = false;
    this.spotNext = 0;
    this.model.group.add(this.spots);

    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = -1;
    scene.add(this.shadow);

    this.shield = new THREE.Mesh(shieldGeo, new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.3, depthWrite: false }));
    this.shield.position.y = 0.6;
    this.shield.visible = false;
    this.root.add(this.shield);

    this.weaponIndex = -1;
    this.setWeapon(info.w || 0);

    // Namnskylt med färgmätare (inte för mig själv)
    this.meter = -1;
    if (!isMe) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 256;
      this.canvas.height = 72;
      this.tex = new THREE.CanvasTexture(this.canvas);
      this.tex.colorSpace = THREE.SRGBColorSpace;
      this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthTest: false, transparent: true }));
      this.label.scale.set(1.8, 0.5, 1);
      this.label.position.y = this.model.def.height + 0.55;
      this.label.renderOrder = 10;
      this.root.add(this.label);
      this.drawLabel(0);
    }

    this.walk = 0;
    this.opacity = 1;
    // Liv: varje djur får egen takt så att de inte rör sig i takt med varandra
    this.seed = Math.random() * 100;
    this.blinkIn = 1 + Math.random() * 3;
    this.lookIn = 0;
    this.look = { y: 0, x: 0, ty: 0, tx: 0 };
    this.eyeLook = this.model.eyes.map(() => ({ y: 0, ty: 0 }));
    this.earTwitch = 0;
    this.earIn = 2 + Math.random() * 4;
    this.ruffle = 0;
    this.ruffleIn = 3 + Math.random() * 5;
    this.squash = 0;
    this.lean = 0;
    this.wasAir = false;
    this.party = 0;
    this.buffer = []; // för interpolering av andra spelare
    this.gapMax = 60; // största mellanrum mellan uppdateringar nyligen (ms)
    this.rollT = 0;
    this.rolling = false;
    this.rollAngle = 0;
    this.earFlop = 0;
    this.pos = new THREE.Vector3(info.x, info.y, info.z);
    this.ry = info.ry || 0;
    this.moving = false;
    this.air = false;
    scene.add(this.root);
  }

  drawLabel(meter) {
    const c = this.canvas.getContext('2d');
    c.clearRect(0, 0, 256, 72);
    c.font = 'bold 30px system-ui, sans-serif';
    c.textAlign = 'center';
    c.lineWidth = 6;
    c.strokeStyle = 'rgba(0,0,0,0.6)';
    c.strokeText(this.name, 128, 32);
    c.fillStyle = hexCss(this.color);
    c.fillText(this.name, 128, 32);
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(48, 46, 160, 16);
    c.fillStyle = hexCss(this.color);
    c.fillRect(50, 48, 156 * Math.min(1, meter / PAINT_MAX), 12);
    this.tex.needsUpdate = true;
  }

  setInfo(info) {
    if (this.label && (info.me !== this.meter || info.c !== this.color)) {
      this.meter = info.me;
      this.color = info.c;
      this.drawLabel(info.me);
    }
    this.color = info.c;
    if (info.w !== this.weaponIndex) this.setWeapon(info.w);
  }

  setWeapon(i) {
    if (this.weaponMesh) this.model.mount.remove(this.weaponMesh);
    this.weaponIndex = i;
    this.weaponMesh = createWeapon(i);
    this.model.mount.add(this.weaponMesh);
  }

  addSpot(color) {
    const b = this.model.def.spotBox;
    const p = [b[0] + Math.random() * (b[3] - b[0]), b[1] + Math.random() * (b[4] - b[1]), b[2] + Math.random() * (b[5] - b[2])];
    // Flytta till ytan på en slumpvis sida (inte undersidan)
    const side = Math.floor(Math.random() * 5);
    if (side === 0) p[0] = b[0];
    else if (side === 1) p[0] = b[3];
    else if (side === 2) p[1] = b[4];
    else if (side === 3) p[2] = b[2];
    else p[2] = b[5];
    const m = new THREE.Matrix4().makeTranslation(p[0], p[1], p[2]);
    const s = 0.7 + Math.random() * 0.8;
    m.scale(new THREE.Vector3(s, s * 0.6, s));
    const i = this.spotNext;
    this.spots.setMatrixAt(i, m);
    this.spots.setColorAt(i, new THREE.Color(color));
    this.spotNext = (i + 1) % MAX_SPOTS;
    this.spots.count = Math.min(MAX_SPOTS, this.spots.count + 1);
    this.spots.instanceMatrix.needsUpdate = true;
    this.spots.instanceColor.needsUpdate = true;
  }

  clearSpots() {
    this.spots.count = 0;
    this.spotNext = 0;
  }

  setOpacity(o) {
    if (Math.abs(o - this.opacity) < 0.01) return;
    this.opacity = o;
    const t = o < 0.99;
    for (const mat of [this.model.material, this.spotMat]) {
      mat.transparent = t;
      mat.opacity = o;
      mat.depthWrite = !t;
      mat.needsUpdate = true;
    }
    if (this.weaponMesh) this.weaponMesh.visible = o > 0.3;
    if (this.label) this.label.visible = o > 0.3;
    this.shadow.visible = o > 0.3;
  }

  // Lägg till en position från servern (andra spelare).
  pushState(s, t) {
    const last = this.buffer[this.buffer.length - 1];
    if (last) {
      // Wi‑Fi skickar ibland klumpar – mät hur ojämnt det kommer och vänta lite längre då
      const gap = t - last.t;
      this.gapMax = Math.max(gap, this.gapMax * 0.98);
    }
    this.buffer.push({ t, x: s.x, y: s.y, z: s.z, ry: s.ry });
    if (this.buffer.length > 12) this.buffer.shift();
    this.moving = !!s.m;
    this.air = !!s.a;
  }

  // Hur långt bakåt i tiden (ms) vi visar andra spelare
  interpDelay() {
    return Math.max(100, Math.min(200, this.gapMax + 40));
  }

  // Ungefärlig fart (m/s) i sidled från de senaste lägena från servern
  velocity() {
    const b = this.buffer;
    const c = b[b.length - 1];
    if (!c) return [0, 0];
    let i = b.length - 2;
    while (i > 0 && c.t - b[i].t < 80) i--;
    const a = b[i];
    if (!a || c.t - a.t < 30 || Math.abs(c.x - a.x) + Math.abs(c.z - a.z) > 3) return [0, 0];
    const s = 1000 / (c.t - a.t);
    return [(c.x - a.x) * s, (c.z - a.z) * s];
  }

  // Interpolera 100–200 ms bakåt i tiden (mer när nätet är ojämnt) för mjuk rörelse.
  interpolate(now) {
    const t = now - this.interpDelay();
    const b = this.buffer;
    if (b.length === 0) return;
    const lastS = b[b.length - 1];
    if (t >= lastS.t) {
      // Inget nytt ännu: fortsätt en liten bit i samma riktning i stället för att stanna tvärt
      const prev = b[b.length - 2];
      const ahead = Math.min(150, t - lastS.t);
      if (prev && lastS.t > prev.t && Math.abs(lastS.x - prev.x) + Math.abs(lastS.z - prev.z) < 3) {
        const k = ahead / (lastS.t - prev.t);
        this.pos.set(lastS.x + (lastS.x - prev.x) * k, lastS.y, lastS.z + (lastS.z - prev.z) * k);
      } else {
        this.pos.set(lastS.x, lastS.y, lastS.z);
      }
      this.ry = lastS.ry;
      return;
    }
    if (t <= b[0].t) {
      this.pos.set(b[0].x, b[0].y, b[0].z);
      this.ry = b[0].ry;
      return;
    }
    let i = 1;
    while (b[i].t < t) i++;
    const a = b[i - 1], c = b[i];
    const k = Math.max(0, Math.min(1, (t - a.t) / (c.t - a.t || 1)));
    // Stora hopp (teleport) ska inte glida
    if (Math.abs(c.x - a.x) + Math.abs(c.z - a.z) > 6) {
      this.pos.set(c.x, c.y, c.z);
    } else {
      this.pos.set(a.x + (c.x - a.x) * k, a.y + (c.y - a.y) * k, a.z + (c.z - a.z) * k);
    }
    let d = c.ry - a.ry;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.ry = a.ry + d * k;
  }

  update(dt, groundY) {
    this.root.position.copy(this.pos);
    this.shadow.position.set(this.pos.x, groundY + 0.03, this.pos.z);
    const h = Math.max(0, this.pos.y - groundY);
    this.shadow.scale.setScalar(Math.max(0.4, 1 - h * 0.15));

    const m = this.model;
    const t = performance.now() / 1000 + this.seed;

    // Gång-animation
    const speed = this.moving ? 1 : 0;
    this.walk += dt * (this.moving ? 11 : 0);
    const swing = this.air ? 0.5 : Math.sin(this.walk) * 0.7 * speed;
    const legs = m.legs;
    for (let i = 0; i < legs.length; i++) {
      const phase = legs.length === 4 ? (i === 0 || i === 3 ? 1 : -1) : i === 0 ? 1 : -1;
      legs[i].rotation.x = swing * phase;
    }
    if (m.def.hold.arms === 'forward') {
      // Apan håller vapnet i händerna – armarna gungar bara lite
      poseHold(m, this.air ? 0.35 : 0, swing * 0.12);
    } else {
      for (let i = 0; i < m.arms.length; i++) m.arms[i].rotation.x = this.air ? -2.4 : -swing * (i === 0 ? 1 : -1);
    }

    // Vingar: ihopfällda på marken, fladdrar i luften och sträcks ut ibland
    if (m.wings.length) {
      this.ruffleIn -= dt;
      if (this.ruffleIn <= 0) { this.ruffle = 0.9; this.ruffleIn = 4 + Math.random() * 6; }
      this.ruffle = Math.max(0, this.ruffle - dt);
      let want = -1.4;
      if (this.air) want = Math.sin(t * 14) * 0.7;
      else if (this.ruffle > 0) want = -1.4 + Math.sin((this.ruffle / 0.9) * Math.PI) * 1.5 + Math.sin(this.ruffle * 30) * 0.15;
      this.flap = this.air ? want : (this.flap ?? want) + (want - (this.flap ?? want)) * Math.min(1, dt * 12);
      m.wings[0].rotation.z = -this.flap;
      m.wings[1].rotation.z = this.flap;
    }

    // Andas
    const breathe = Math.sin(t * (this.moving ? 5 : 2.4)) * (this.moving ? 0.015 : 0.025);
    m.torso.scale.set(1 - breathe * 0.4, 1 + breathe, 1 - breathe * 0.4);

    // Huvudet tittar runt när man står still
    this.lookIn -= dt;
    if (this.lookIn <= 0) {
      this.lookIn = 1 + Math.random() * 2.5;
      const idle = !this.moving && !this.air;
      this.look.ty = idle ? (Math.random() * 2 - 1) * 0.55 : 0;
      this.look.tx = idle ? (Math.random() * 2 - 1) * 0.18 : 0;
    }
    if (this.moving) { this.look.ty = 0; this.look.tx = 0; }
    const k = Math.min(1, dt * 5);
    this.look.y += (this.look.ty - this.look.y) * k;
    this.look.x += (this.look.tx - this.look.x) * k;
    m.head.rotation.y = this.look.y;
    m.head.rotation.x = this.look.x + (this.moving ? Math.sin(this.walk * 2) * 0.05 : Math.sin(t * 1.3) * 0.03);

    // Blinka
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) this.blinkIn = 2 + Math.random() * 3.5;
    const blink = this.blinkIn < 0.13 ? 0.12 : 1;
    for (let i = 0; i < m.eyes.length; i++) {
      const e = m.eyes[i];
      e.scale.y = blink;
      if (m.def.eyesRoam) {
        // Kameleontens ögon tittar åt olika håll
        const el = this.eyeLook[i];
        if (Math.random() < dt * 0.8) el.ty = (Math.random() * 2 - 1) * 0.8;
        el.y += (el.ty - el.y) * Math.min(1, dt * 6);
        e.rotation.y = el.y;
      }
    }

    // Öronen rycker ibland
    this.earIn -= dt;
    if (this.earIn <= 0) { this.earTwitch = 1; this.earIn = 2 + Math.random() * 5; }
    this.earTwitch = Math.max(0, this.earTwitch - dt * 4);
    const twitch = Math.sin(this.earTwitch * Math.PI * 3) * this.earTwitch * 0.5;
    for (let i = 0; i < m.ears.length; i++) m.ears[i].rotation.z = (i === 0 ? 1 : -1) * twitch;

    // Svansen viftar
    if (m.tail) {
      const wag = this.moving ? 9 : 2.5;
      if (this.animal === 'chameleon') m.tail.rotation.x = Math.sin(t * wag * 0.6) * 0.15;
      else if (this.animal === 'eagle') m.tail.rotation.x = Math.sin(t * wag) * 0.08;
      else if (this.animal === 'redpanda') m.tail.rotation.y = Math.sin(t * wag * 0.45) * 0.3;
      else if (this.animal === 'rabbit') m.tail.rotation.z = Math.sin(t * wag * 1.5) * 0.25;
      else m.tail.rotation.z = Math.sin(t * wag) * 0.35;
    }

    // Kaninens långa öron fladdrar bakåt i luften
    if (this.animal === 'rabbit') {
      this.earFlop += ((this.air ? 1 : 0) - this.earFlop) * Math.min(1, dt * (this.air ? 10 : 5));
      for (let i = 0; i < m.ears.length; i++) m.ears[i].rotation.x = -this.earFlop * 0.7;
    }

    // Luta framåt när man springer, töj och tryck ihop vid hopp och landning
    if (this.air && !this.wasAir) this.squash = 0.18;
    if (!this.air && this.wasAir) { this.squash = -0.22; this.landed = true; }
    this.wasAir = this.air;
    this.squash *= Math.exp(-dt * 9);
    const sq = this.squash;
    this.lean += ((this.moving && !this.air ? 0.1 : 0) - this.lean) * Math.min(1, dt * 6);
    m.group.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
    m.group.rotation.x = this.lean;

    // Glädjeskutt och snurr efter ett PLASK
    let hop = 0;
    let spin = 0;
    if (this.party > 0) {
      this.party = Math.max(0, this.party - dt);
      const p = 1 - this.party / 1.1;
      hop = Math.sin(p * Math.PI) * 0.6;
      spin = p * Math.PI * 2;
    }
    m.group.rotation.y = this.ry + spin;
    // Liten studs när man går
    const bounce = this.animal === 'rabbit' ? 0.16 : 0.06; // kaninen skuttar
    m.group.position.y = hop + (this.moving && !this.air ? Math.abs(Math.sin(this.walk)) * bounce : 0);

    // Röda pandan rullar ihop sig till en boll
    this.rollT = Math.max(0, this.rollT - dt);
    const rolling = this.rollT > 0 && !!m.ball;
    if (rolling !== this.rolling) {
      this.rolling = rolling;
      for (const l of m.legs) l.visible = !rolling;
      m.torso.visible = !rolling;
      this.spots.visible = !rolling;
      m.ball.visible = rolling;
      if (rolling) this.squash = 0.25;
    }
    if (rolling) {
      this.rollAngle += dt * (this.moving ? 14 : 4);
      m.ball.rotation.x = this.rollAngle;
      m.group.rotation.x = 0;
    }
  }

  startRoll(seconds) {
    this.rollT = Math.max(this.rollT, seconds);
  }

  celebrate() {
    this.party = 1.1;
  }

  dispose(scene) {
    scene.remove(this.root);
    scene.remove(this.shadow);
    this.model.material.dispose();
    this.spotMat.dispose();
    if (this.tex) this.tex.dispose();
  }
}
