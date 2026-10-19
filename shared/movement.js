// Rörelse för djur – används av klienten (egen spelare) och servern (botar).
import { ANIMALS, STINK_RADIUS, STINK_SLOW } from './constants.js';
import { GRAVITY, PLAYER_H, POND, ceilingHeight, groundHeight, inPond, resolveXZ } from './map.js';

export function createMover(x, y, z, animal) {
  return { x, y, z, vy: 0, onGround: true, jumpsLeft: 0, animal, flyTime: 0, sprint: false, roll: false, superJump: false, slow: false, blocked: false, inWater: false };
}

// input: { mx, mz } önskad riktning i världen (längd ≤ 1), jump: tryckt nu, jumpHeld
export function stepMover(m, input, dt, map) {
  const a = ANIMALS[m.animal];
  m.inWater = inPond(m.x, m.z) && m.y < -POND.depth + 0.3;
  let speed = a.speed;
  if (m.inWater) speed *= a.swim;
  if (m.sprint) speed *= 1.7;
  if (m.roll) speed *= 1.6;
  if (m.slow) speed *= STINK_SLOW; // fast i ett stinkmoln

  m.blocked = false;
  m.x += input.mx * speed * dt;
  m.z += input.mz * speed * dt;
  resolveXZ(map, m);

  if (input.jump) {
    if (m.onGround) {
      m.vy = a.jump * (m.superJump ? 1.6 : 1);
      m.onGround = false;
      m.jumpsLeft = a.doubleJump ? 1 : 0;
    } else if (m.jumpsLeft > 0) {
      m.vy = a.jump * 0.9;
      m.jumpsLeft--;
    }
  }

  let g = GRAVITY;
  if (m.flyTime > 0) {
    m.flyTime -= dt;
    g *= 0.15;
    if (input.jumpHeld) m.vy = Math.max(m.vy, 5);
  }
  m.vy -= g * dt;
  if (a.glide && input.jumpHeld && m.vy < -2) m.vy = -2;
  const top = m.vy > 0 ? ceilingHeight(map, m.x, m.z, m.y) : Infinity;
  m.y += m.vy * dt;
  if (m.y > 16) { m.y = 16; m.vy = Math.min(m.vy, 0); }
  // Huvudet slår i taket (t.ex. inne i ett hus)
  if (m.y + PLAYER_H > top) { m.y = top - PLAYER_H; m.vy = 0; }

  const gh = groundHeight(map, m.x, m.z, m.y);
  if (m.y <= gh) {
    m.y = gh;
    m.vy = 0;
    m.onGround = true;
  } else {
    m.onGround = false;
  }
}

// Kaninens superhopp: studsar iväg direkt när förmågan startar
export function superHop(m) {
  m.vy = Math.max(m.vy, ANIMALS[m.animal].jump * 1.6);
  m.onGround = false;
  m.jumpsLeft = 0;
}

export function startFly(m) {
  m.vy = 12;
  m.onGround = false;
  m.flyTime = ANIMALS.eagle.duration;
}

// Står man i ett stinkmoln från ett annat lag? clouds: [[x, y, z, lag], …]
export function inStink(clouds, team, x, y, z) {
  if (!clouds) return false;
  for (const c of clouds) {
    if (c[3] === team) continue;
    const dx = x - c[0], dz = z - c[2];
    if (dx * dx + dz * dz < STINK_RADIUS * STINK_RADIUS && y > c[1] - 1 && y < c[1] + 2.5) return true;
  }
  return false;
}
