// Enkla datorstyrda djur. De är med flit lite klantiga så att det är kul för barn.
import { WEAPONS } from '../shared/constants.js';
import { BASES, inBase } from '../shared/map.js';
import { createMover, startFly, stepMover, superHop } from '../shared/movement.js';

export function createBot(p) {
  const bot = {
    mover: createMover(p.x, p.y, p.z, p.animal),
    goal: null,
    enemy: null,
    think: 0,
    jumpCd: 0,
    side: Math.random() < 0.5 ? 1 : -1,
    dodge: 0,
    startFly: false,
    teleport(s) {
      bot.mover.x = s.x; bot.mover.y = s.y; bot.mover.z = s.z; bot.mover.vy = 0;
      bot.goal = null;
    },
  };
  return bot;
}

function think(game, p, now) {
  const bot = p.bot;
  bot.think = 0.3 + Math.random() * 0.3;
  bot.enemy = null;

  // Hitta närmaste fiende som går att träffa
  let best = 16 * 16;
  for (const o of game.players.values()) {
    if (o.id === p.id || o.team === p.team) continue;
    if (inBase(o.x, o.z) === o.base) continue;
    if (now < o.protectUntil || game.isActive(o, 'hide', now)) continue;
    const d2 = (o.x - p.x) ** 2 + (o.z - p.z) ** 2;
    if (d2 < best) { best = d2; bot.enemy = o; }
  }

  // Råd att köpa nästa vapen? Gå hem.
  const next = WEAPONS[p.weapon + 1];
  if (next && p.food >= next.price) {
    const b = BASES[p.base];
    if (inBase(p.x, p.z) === p.base) {
      game.buy(p, p.weapon + 1);
    } else {
      bot.goal = { x: b.x, z: b.z };
      return;
    }
  }

  if (bot.enemy) {
    // Cirkla runt fienden
    const e = bot.enemy;
    const a = Math.atan2(p.x - e.x, p.z - e.z) + bot.side * 0.6;
    bot.goal = { x: e.x + Math.sin(a) * 7, z: e.z + Math.cos(a) * 7 };
    if (Math.random() < 0.1) bot.side *= -1;
    return;
  }

  // Annars: närmaste mat
  let fb = Infinity, fgoal = null;
  for (const f of game.food.values()) {
    const d2 = (f.x - p.x) ** 2 + (f.z - p.z) ** 2;
    if (d2 < fb) { fb = d2; fgoal = { x: f.x, z: f.z }; }
  }
  if (fgoal) bot.goal = fgoal;
  else if (!bot.goal) bot.goal = { x: (Math.random() * 2 - 1) * 25, z: (Math.random() * 2 - 1) * 25 };
}

export function updateBot(game, p, dt, now) {
  const bot = p.bot;
  const m = bot.mover;
  if (game.phase !== 'play') {
    p.moving = 0;
    return;
  }
  bot.think -= dt;
  if (bot.think <= 0) think(game, p, now);

  let mx = 0, mz = 0;
  if (bot.goal) {
    const dx = bot.goal.x - m.x, dz = bot.goal.z - m.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.6) { mx = dx / d; mz = dz / d; }
  }
  if (bot.dodge > 0) {
    bot.dodge -= dt;
    const t = mx;
    mx = -mz * bot.side;
    mz = t * bot.side;
  }

  let jump = false;
  bot.jumpCd -= dt;
  if (m.blocked && bot.jumpCd <= 0) {
    jump = true;
    bot.jumpCd = 0.6;
    if (Math.random() < 0.5) bot.dodge = 0.5;
  }
  if (bot.startFly) { bot.startFly = false; startFly(m); }
  if (bot.superHop) { bot.superHop = false; superHop(m); }
  m.sprint = game.isActive(p, 'sprint', now);
  m.roll = game.isActive(p, 'roll', now);
  m.superJump = game.isActive(p, 'superjump', now);
  // Kaninen studsar hela tiden när superhoppet är igång
  if (m.superJump && m.onGround) jump = true;

  // Delsteg så fysiken blir stabil
  const steps = 3;
  for (let i = 0; i < steps; i++) stepMover(m, { mx, mz, jump: jump && i === 0, jumpHeld: false }, dt / steps, game.map);

  p.x = m.x; p.y = m.y; p.z = m.z;
  p.moving = mx || mz ? 1 : 0;
  p.air = m.onGround ? 0 : 1;

  const e = bot.enemy;
  if (e && game.players.has(e.id)) {
    p.ry = Math.atan2(e.x - p.x, e.z - p.z);
    const w = WEAPONS[p.weapon];
    if (now - p.lastShot > (1000 / w.rate) * 2.2 + Math.random() * 300) {
      const o = [p.x + Math.sin(p.ry) * 0.4, p.y + 1.3, p.z + Math.cos(p.ry) * 0.4];
      const dx = e.x - o[0], dy = e.y + 0.6 - o[1], dz = e.z - o[2];
      const hd = Math.hypot(dx, dz);
      const t = hd / w.speed;
      const err = 0.12;
      const d = [
        dx / hd + (Math.random() * 2 - 1) * err,
        (dy + 0.5 * w.gravity * t * t) / hd + (Math.random() * 2 - 1) * err * 0.5,
        dz / hd + (Math.random() * 2 - 1) * err,
      ];
      game.fire(p, o, d);
    }
    if (now >= p.cdUntil && Math.random() < 0.01) game.useAbility(p);
  } else if (mx || mz) {
    p.ry = Math.atan2(mx, mz);
  }
}
