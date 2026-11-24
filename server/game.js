// Spelets regler: lobby, rundor, skott, träffar, mat, butik och förmågor.
// Faser: 'idle' (inget spel – någon får starta ett) → 'play' → 'end' (resultat) → 'idle'.
import {
  ANIMALS, ANIMAL_IDS, BOT_NAMES, COLORS, clampWin, FOODS, INTERMISSION_SECONDS, MAX_FOOD, MAX_PLAYERS,
  PAINT_MAX, SCORE_PLASK, SPAWN_PROTECT, TEAM_COUNT, TICK_RATE, WASH_RATE, WEAPONS, WIN_SCORE,
} from '../shared/constants.js';
import {
  MAP_HALF, baseSpawn, clearLine, createMap, groundHeight, inBase, inPond, isWashing, mapInfo, pointHitsWorld,
} from '../shared/map.js';
import { createMover, stepMover } from '../shared/movement.js';
import { createBot, updateBot } from './bots.js';

const RAINBOW = [0xff3b3b, 0xff8a1f, 0xffd21f, 0x2fd35a, 0x3b7bff, 0xb44dff];

const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);

export class Game {
  constructor() {
    this.mapId = 'park';
    this.map = createMap(this.mapId);
    // Anslutna som står på startsidan och inte är med i spelet
    this.lobby = new Set();
    this.players = new Map();
    this.projectiles = [];
    this.food = new Map();
    this.decoys = []; // rävens lockbeten
    this.clouds = []; // skunkens stinkmoln
    this.nextId = 1;
    this.nextDecoy = 1;
    this.nextProj = 1;
    this.nextFood = 1;
    this.botCount = 2;
    this.phase = 'idle';
    this.phaseEnds = 0; // bara resultatpausen har en tid
    this.emptySince = 0;
    this.lobbyTimer = 0;
    // WIN_SCORE i miljön tvingar fram vinstgränsen för alla spel (t.ex. lågt för att testa rundslut)
    this.forcedWin = Number(process.env.WIN_SCORE) || 0;
    this.winScore = this.forcedWin || WIN_SCORE;
    this.lastTick = Date.now();
    this.foodTimer = 0;
    // Spelare som gått ut (sid → { p, at }) – köp och poäng finns kvar om de kommer tillbaka
    this.left = new Map();
    // Poäng från spelare som bytt lag eller inte kom tillbaka räknas fortfarande för laget
    this.teamBank = new Array(TEAM_COUNT).fill(0);
    setInterval(() => this.tick(), 1000 / TICK_RATE);
  }

  // ---------- Anslutningar ----------

  connect(ws) {
    let player = null;
    this.lobby.add(ws);
    ws.send(JSON.stringify(this.lobbyState()));
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (!msg || typeof msg.t !== 'string') return;
      if (msg.t === 'ping') { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'pong', c: msg.c })); return; }
      // Gick ut, rundan tog slut eller ersattes av en ny anslutning – då styr den här inte längre
      if (player && player.ws !== ws) player = null;
      if (!player && msg.t === 'join') player = this.join(ws, msg);
      else if (!player && msg.t === 'create') player = this.create(ws, msg);
      else if (player) this.handle(player, msg);
    });
    ws.on('close', () => {
      this.lobby.delete(ws);
      if (!player || player.ws !== ws) return;
      this.leave(player, false);
    });
  }

  // back = tillbaka till startsidan (anslutningen är kvar)
  leave(p, back) {
    const ws = p.ws;
    this.players.delete(p.id);
    p.ws = null;
    if (back && ws && ws.readyState === 1) this.lobby.add(ws);
    if (p.sid) this.left.set(p.sid, { p, at: Date.now() });
    else this.teamBank[p.team] += p.score;
    this.broadcast({ t: 'msg', text: `${p.name} gick ut ur spelet` });
    this.updateBots();
    this.sendLobby();
  }

  lobbyState() {
    const info = mapInfo(this.mapId);
    return {
      t: 'lobby', phase: this.phase, map: this.mapId, mapName: `${info.name} ${info.emoji}`, win: this.winScore,
      ts: this.phase === 'idle' ? [] : this.teamScores(),
      players: [...this.players.values()].map((p) => ({ n: p.name, tm: p.team, an: p.animal, bot: p.bot ? 1 : 0, sc: p.score })),
    };
  }

  sendLobby() {
    const s = JSON.stringify(this.lobbyState());
    for (const ws of this.lobby) if (ws.readyState === 1) ws.send(s);
  }

  // Starta ett nytt spel på vald bana. Hann någon annan före går man med i deras spel i stället.
  create(ws, msg) {
    if (this.phase === 'idle') {
      this.mapId = mapInfo(msg.map).id;
      this.map = createMap(this.mapId);
      this.botCount = Math.max(0, Math.min(4, msg.bots | 0));
      this.winScore = this.forcedWin || clampWin(msg.win);
      this.food.clear();
      this.projectiles = [];
      this.decoys = [];
      this.clouds = [];
      this.left.clear();
      this.teamBank.fill(0);
      for (let i = 0; i < 14; i++) this.spawnFood(false);
      this.phase = 'play';
      this.phaseEnds = 0;
      this.emptySince = 0;
    }
    return this.join(ws, msg);
  }

  // Hitta en tidigare spelare med samma sid: antingen en "zombie" som fortfarande är ansluten
  // (iPaden tappade nätet utan att säga till) eller någon som nyss gick ut.
  takeOver(sid) {
    if (!sid) return null;
    for (const o of this.players.values()) {
      if (!o.bot && o.sid === sid) {
        this.players.delete(o.id);
        const old = o.ws;
        o.ws = null;
        try { old?.terminate(); } catch { /* redan stängd */ }
        return o;
      }
    }
    const l = this.left.get(sid);
    if (!l) return null;
    this.left.delete(sid);
    return l.p;
  }

  humans() {
    return [...this.players.values()].filter((p) => !p.bot);
  }

  join(ws, msg) {
    if (this.phase !== 'play') {
      // Inget spel att gå med i (eller rundan håller på att ta slut) – visa startsidan som den är
      ws.send(JSON.stringify(this.lobbyState()));
      return null;
    }
    const sid = typeof msg.sid === 'string' ? msg.sid.slice(0, 40) : '';
    const old = this.takeOver(sid);
    if (this.humans().length >= MAX_PLAYERS) {
      ws.send(JSON.stringify({ t: 'full' }));
      return null;
    }
    const name = String(msg.name || 'Spelare').replace(/[<>]/g, '').trim().slice(0, 14) || 'Spelare';
    const animal = ANIMAL_IDS.includes(msg.animal) ? msg.animal : 'capybara';
    const wanted = COLORS.findIndex((c) => c.id === msg.color);
    const p = this.createPlayer(name, animal, wanted >= 0 ? wanted : this.smallestTeam(), null);
    p.ws = ws;
    p.sid = sid;
    let restored = false;
    if (old) {
      // Köpen följer med, även om man bytt djur. Poängen följer bara med inom samma lag.
      p.food = old.food;
      p.owned = old.owned;
      p.weapon = old.owned.includes(old.weapon) ? old.weapon : 0;
      if (old.team === p.team) p.score = old.score;
      else this.teamBank[old.team] += old.score;
      restored = old.owned.length > 1;
    }
    this.players.set(p.id, p);
    this.lobby.delete(ws);

    ws.send(JSON.stringify({
      t: 'welcome', id: p.id, map: this.mapId, mh: this.map.hash, animals: ANIMAL_IDS, animal: p.animal, color: p.color, base: p.base, team: p.team, botCount: this.botCount, win: this.winScore,
      x: p.x, y: p.y, z: p.z, ry: p.ry,
      food: [...this.food.values()],
      phase: this.phase, time: this.timeLeft(), restored,
    }));
    this.broadcast({ t: 'msg', text: old ? `${p.name} är tillbaka!` : `${p.name} kom in i spelet!` });
    this.updateBots();
    this.sendLobby();
    return p;
  }

  // Laget bestämmer färg och hembas.
  createPlayer(name, animal, team, bot) {
    const s = baseSpawn(team);
    return {
      id: this.nextId++, ws: null, sid: '', bot, name, animal, team, color: COLORS[team].hex, base: team,
      x: s.x, y: s.y, z: s.z, ry: s.ry, moving: 0, air: 0,
      meter: 0, score: 0, food: 0, owned: [0], weapon: 0,
      lastShot: 0, abUntil: 0, cdUntil: 0, protectUntil: 0, tpSeq: 0,
    };
  }

  teamSizes(exceptId) {
    const n = new Array(TEAM_COUNT).fill(0);
    for (const o of this.players.values()) if (o.id !== exceptId) n[o.team]++;
    return n;
  }

  smallestTeam(exceptId) {
    const n = this.teamSizes(exceptId);
    let best = 0;
    for (let i = 1; i < n.length; i++) if (n[i] < n[best]) best = i;
    return best;
  }

  teamScores() {
    const sc = [...this.teamBank];
    for (const p of this.players.values()) sc[p.team] += p.score;
    for (const l of this.left.values()) sc[l.p.team] += l.p.score;
    return sc;
  }

  setTeam(p, team) {
    if (p.team === team) return;
    p.team = team;
    p.base = team;
    p.color = COLORS[team].hex;
    this.teleportHome(p);
  }

  updateBots() {
    const bots = [...this.players.values()].filter((p) => p.bot);
    const want = this.humans().length > 0 ? this.botCount : 0;
    while (bots.length > want) this.players.delete(bots.pop().id);
    while (bots.length < want) {
      const used = new Set([...this.players.values()].map((p) => p.name));
      const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot';
      const animal = ANIMAL_IDS[Math.floor(Math.random() * ANIMAL_IDS.length)];
      const p = this.createPlayer(name, animal, this.smallestTeam(), true);
      p.bot = createBot(p);
      this.players.set(p.id, p);
      bots.push(p);
    }
    // Fördela botarna så att lagen blir så jämna som möjligt
    for (const b of bots) {
      const n = this.teamSizes(b.id);
      if (n[b.team] > Math.min(...n)) this.setTeam(b, this.smallestTeam(b.id));
    }
  }

  // ---------- Meddelanden från klienter ----------

  handle(p, msg) {
    switch (msg.t) {
      case 'st': {
        if ((msg.k | 0) < p.tpSeq) return; // gammal position från före teleport
        const x = num(msg.x, -MAP_HALF, MAP_HALF), y = num(msg.y, -2, 20), z = num(msg.z, -MAP_HALF, MAP_HALF);
        if (x === null || y === null || z === null) return;
        p.x = x; p.y = y; p.z = z;
        p.ry = num(msg.ry, -100, 100) ?? p.ry;
        p.moving = msg.m ? 1 : 0;
        p.air = msg.a ? 1 : 0;
        break;
      }
      case 'shoot': {
        if (!Array.isArray(msg.o) || !Array.isArray(msg.d)) return;
        const o = msg.o.map((v) => num(v, -100, 100));
        const d = msg.d.map((v) => num(v, -1.5, 1.5));
        if (o.some((v) => v === null) || d.some((v) => v === null)) return;
        this.fire(p, o, d);
        break;
      }
      case 'buy': this.buy(p, msg.w | 0); break;
      case 'equip':
        if (p.owned.includes(msg.w | 0)) p.weapon = msg.w | 0;
        break;
      case 'ab': this.useAbility(p); break;
      case 'animal': this.changeAnimal(p, msg.a); break;
      case 'quit': this.leave(p, true); break;
      case 'bots': {
        const n = Math.max(0, Math.min(4, msg.n | 0));
        if (n !== this.botCount) {
          this.botCount = n;
          this.updateBots();
          this.broadcast({ t: 'msg', text: `${p.name} ändrade till ${n} botar` });
        }
        break;
      }
    }
  }

  send(p, msg) {
    if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
  }

  broadcast(msg) {
    const s = JSON.stringify(msg);
    for (const p of this.players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(s);
  }

  timeLeft() {
    return Math.max(0, Math.round((this.phaseEnds - Date.now()) / 1000));
  }

  // ---------- Handlingar ----------

  fire(p, o, d) {
    const now = Date.now();
    if (this.phase !== 'play') return false;
    const w = WEAPONS[p.weapon];
    if (now - p.lastShot < (1000 / w.rate) * 0.85) return false;
    if (inBase(p.x, p.z) === p.base) return false; // man skjuter inte hemifrån
    if (isWashing(p.x, p.y, p.z)) return false; // den som tvättar sig har inget vapen i händerna
    // Skottet ska starta nära djuret
    const dx = o[0] - p.x, dy = o[1] - p.y, dz = o[2] - p.z;
    if (dx * dx + dy * dy + dz * dz > 9) { o = [p.x, p.y + 1.3, p.z]; }
    p.lastShot = now;
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    const shots = [];
    for (let i = 0; i < w.count; i++) {
      let vx = d[0] / len, vy = d[1] / len, vz = d[2] / len;
      if (w.spread) {
        vx += (Math.random() * 2 - 1) * w.spread;
        vy += (Math.random() * 2 - 1) * w.spread * 0.5;
        vz += (Math.random() * 2 - 1) * w.spread;
        const l = Math.hypot(vx, vy, vz);
        vx /= l; vy /= l; vz /= l;
      }
      const color = w.rainbow ? RAINBOW[(i + Math.floor(Math.random() * 6)) % 6] : p.color;
      const pr = {
        id: this.nextProj++, by: p.id, x: o[0], y: o[1], z: o[2],
        vx: vx * w.speed, vy: vy * w.speed, vz: vz * w.speed,
        team: p.team, g: w.gravity, dmg: w.damage, splash: w.splash, size: w.size, color, age: 0, life: w.range / w.speed,
      };
      this.projectiles.push(pr);
      shots.push({ id: pr.id, by: p.id, o: [r2(pr.x), r2(pr.y), r2(pr.z)], v: [r2(pr.vx), r2(pr.vy), r2(pr.vz)], g: pr.g, s: pr.size, c: color, l: r2(pr.life) });
    }
    this.broadcast({ t: 'shot', list: shots });
    return true;
  }

  buy(p, w) {
    const weapon = WEAPONS[w];
    if (!weapon) return;
    if (inBase(p.x, p.z) !== p.base) {
      this.send(p, { t: 'msg', text: 'Gå hem till din bas för att handla!' });
      return;
    }
    if (p.owned.includes(w)) { p.weapon = w; return; }
    if (p.food < weapon.price) {
      this.send(p, { t: 'msg', text: `Du behöver ${weapon.price - p.food} mat till!` });
      return;
    }
    p.food -= weapon.price;
    p.owned.push(w);
    p.weapon = w;
    this.send(p, { t: 'msg', text: `Du köpte ${weapon.name}! 🎉`, big: true });
  }

  // Byta djur går bara hemma i basen, precis som att handla. Vapen, mat och poäng följer med.
  changeAnimal(p, animal) {
    if (!ANIMAL_IDS.includes(animal) || animal === p.animal || this.phase !== 'play') return;
    if (inBase(p.x, p.z) !== p.base) {
      this.send(p, { t: 'msg', text: 'Gå hem till din bas för att byta djur!' });
      return;
    }
    p.animal = animal;
    p.abUntil = 0;
    p.cdUntil = Date.now() + ANIMALS[animal].cooldown * 1000; // ingen gratis förmåga genom att byta
    this.send(p, { t: 'msg', text: `Du är nu ${ANIMALS[animal].name}! 🐾`, big: true });
    this.sendLobby();
  }

  useAbility(p) {
    const now = Date.now();
    if (now < p.cdUntil || this.phase !== 'play') return;
    const a = ANIMALS[p.animal];
    p.abUntil = now + a.duration * 1000;
    p.cdUntil = now + a.cooldown * 1000;
    if (p.bot && a.ability === 'fly') p.bot.startFly = true;
    if (p.bot && a.ability === 'superjump') p.bot.superHop = true;
    const msg = { t: 'ab', id: p.id, kind: a.ability };
    if (a.ability === 'decoy') {
      // En kopia av räven springer rakt fram åt det håll räven tittar
      const mover = createMover(p.x, p.y, p.z, p.animal);
      this.decoys.push({ id: 100000 + this.nextDecoy++, owner: p.id, team: p.team, ry: p.ry, mover, until: now + a.duration * 1000 });
    } else if (a.ability === 'stink') {
      const c = [r2(p.x), r2(p.y), r2(p.z), p.team];
      this.clouds.push({ c, until: now + a.duration * 1000 });
      msg.p = c.slice(0, 3);
    }
    this.broadcast(msg);
  }

  // Lockbetet springer rakt fram, hoppar över hinder och svänger om det fastnar
  updateDecoys(dt, now) {
    this.decoys = this.decoys.filter((d) => now < d.until && this.players.has(d.owner));
    for (const d of this.decoys) {
      const m = d.mover;
      const jump = m.blocked && m.onGround;
      if (m.blocked && !m.onGround) d.ry += (Math.random() < 0.5 ? 1 : -1) * 1.2;
      const input = { mx: Math.sin(d.ry), mz: Math.cos(d.ry), jump: false, jumpHeld: false };
      for (let i = 0; i < 3; i++) stepMover(m, { ...input, jump: jump && i === 0 }, dt / 3, this.map);
    }
    this.clouds = this.clouds.filter((c) => now < c.until);
  }

  // Lockbetet blev träffat – det försvinner i en rökpuff
  popDecoy(d) {
    this.decoys = this.decoys.filter((o) => o !== d);
    this.broadcast({ t: 'poof', id: d.id, p: [r2(d.mover.x), r2(d.mover.y + 0.6), r2(d.mover.z)] });
  }

  isActive(p, kind, now = Date.now()) {
    return now < p.abUntil && ANIMALS[p.animal].ability === kind;
  }

  teleportHome(p) {
    const s = baseSpawn(p.base);
    p.x = s.x; p.y = s.y; p.z = s.z; p.ry = s.ry;
    p.tpSeq++;
    if (p.bot) p.bot.teleport(s);
    else this.send(p, { t: 'tp', x: s.x, y: s.y, z: s.z, ry: s.ry, k: p.tpSeq });
  }

  damage(target, shooter, amount, color, pos) {
    const now = Date.now();
    if (shooter && shooter.team === target.team) return; // inga träffar på lagkamrater
    if (inBase(target.x, target.z) === target.base || now < target.protectUntil || this.isActive(target, 'shield', now)) {
      this.broadcast({ t: 'block', tg: target.id, p: pos });
      return;
    }
    const roll = this.isActive(target, 'roll', now) ? 0.5 : 1; // röda pandan rullar och tar halva färgen
    target.meter += amount * ANIMALS[target.animal].toughness * roll;
    this.broadcast({ t: 'hit', tg: target.id, by: shooter ? shooter.id : 0, c: color, p: pos });
    if (target.meter >= PAINT_MAX) {
      target.meter = 0;
      target.protectUntil = now + SPAWN_PROTECT * 1000;
      if (shooter) shooter.score += SCORE_PLASK;
      this.broadcast({ t: 'plask', tg: target.id, by: shooter ? shooter.id : 0, c: color });
      this.teleportHome(target);
    }
  }

  // ---------- Mat ----------

  spawnFood(announce = true) {
    for (let tries = 0; tries < 30; tries++) {
      const x = (Math.random() * 2 - 1) * (MAP_HALF - 2);
      const z = (Math.random() * 2 - 1) * (MAP_HALF - 2);
      if (inBase(x, z, 1) >= 0 || inPond(x, z, 0.5)) continue;
      let bad = false, roofed = false;
      // Alla lådor, inte bara rutan punkten ligger i – en stam precis i grannrutan räknas också
      for (const b of this.map.boxes) {
        const near = x > b.x0 - 0.6 && x < b.x1 + 0.6 && z > b.z0 - 0.6 && z < b.z1 + 0.6;
        if (near && (b.kind === 'trunk' || b.kind === 'fence' || b.kind === 'house' || b.kind === 'hedge')) bad = true;
        if (b.kind === 'roof' && x > b.x0 - 0.2 && x < b.x1 + 0.2 && z > b.z0 - 0.2 && z < b.z1 + 0.2) roofed = true;
      }
      if (bad) continue;
      let total = 0;
      for (const f of FOODS) total += f.weight;
      let r = Math.random() * total, kind = FOODS[0].id;
      for (const f of FOODS) { if ((r -= f.weight) < 0) { kind = f.id; break; } }
      // Inne i hus hamnar maten på golvet (eller en låda), inte uppe på taket
      const f = { id: this.nextFood++, k: kind, x: r2(x), y: r2(groundHeight(this.map, x, z, roofed ? 1.5 : 3, 0.1)), z: r2(z) };
      this.food.set(f.id, f);
      if (announce) this.broadcast({ t: 'food', add: [f], rem: [] });
      return;
    }
  }

  // ---------- Rundor ----------

  endRound(winner) {
    this.phase = 'end';
    this.phaseEnds = Date.now() + INTERMISSION_SECONDS * 1000;
    this.projectiles = [];
    this.decoys = [];
    this.clouds = [];
    const ranking = [...this.players.values()]
      .sort((a, b) => b.score - a.score)
      .map((p) => ({ n: p.name, sc: p.score, c: p.color, an: p.animal, tm: p.team }));
    this.broadcast({ t: 'round', phase: 'end', winner, ts: this.teamScores(), ranking });
    this.sendLobby();
  }

  // Rundan är slut: alla går tillbaka till startsidan och någon får starta ett nytt spel.
  closeGame() {
    this.broadcast({ t: 'round', phase: 'over' });
    for (const p of this.players.values()) {
      if (p.ws && p.ws.readyState === 1) this.lobby.add(p.ws);
      p.ws = null;
    }
    this.players.clear();
    this.food.clear();
    this.projectiles = [];
    this.decoys = [];
    this.clouds = [];
    this.left.clear();
    this.teamBank.fill(0);
    this.phase = 'idle';
    this.phaseEnds = 0;
    this.sendLobby();
  }

  // ---------- Spelloopen ----------

  tick() {
    const now = Date.now();
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;

    if (this.phase === 'idle') return;
    if (this.phase === 'play') {
      const ts = this.teamScores();
      const best = ts.indexOf(Math.max(...ts));
      if (ts[best] >= this.winScore) this.endRound(best);
      // Ett spel där alla gått ut stängs efter en stund (lite tid att hinna ansluta igen)
      if (this.humans().length) this.emptySince = 0;
      else if (!this.emptySince) this.emptySince = now;
      else if (now - this.emptySince > 60 * 1000) { this.closeGame(); return; }
    } else if (this.phase === 'end' && now > this.phaseEnds) { this.closeGame(); return; }

    // Startsidan visar poängen medan spelet pågår
    this.lobbyTimer += dt;
    if (this.lobbyTimer > 1) { this.lobbyTimer = 0; this.sendLobby(); }

    for (const p of this.players.values()) if (p.bot) updateBot(this, p, dt, now);
    this.updateDecoys(dt, now);

    // Den som inte kommit tillbaka på 10 minuter glöms – poängen stannar hos laget
    for (const [sid, l] of this.left) {
      if (now - l.at > 10 * 60 * 1000) {
        this.teamBank[l.p.team] += l.p.score;
        this.left.delete(sid);
      }
    }

    // Den som står i dammen tvättar bort färgen
    for (const p of this.players.values()) {
      if (p.meter > 0 && isWashing(p.x, p.y, p.z)) p.meter = Math.max(0, p.meter - WASH_RATE * dt);
    }

    // Mat dyker upp och plockas
    this.foodTimer += dt;
    if (this.foodTimer > 1.4 && this.food.size < MAX_FOOD) {
      this.foodTimer = 0;
      this.spawnFood();
    }
    const rem = [];
    for (const f of this.food.values()) {
      for (const p of this.players.values()) {
        const dx = p.x - f.x, dz = p.z - f.z;
        if (dx * dx + dz * dz < 1.6 && Math.abs(p.y - f.y) < 1.6) {
          p.food += FOODS.find((x) => x.id === f.k).value;
          this.food.delete(f.id);
          rem.push(f.id);
          this.send(p, { t: 'yum', k: f.k });
          break;
        }
      }
    }
    if (rem.length) this.broadcast({ t: 'food', add: [], rem });

    this.updateProjectiles(dt);

    // Ögonblicksbild till alla
    const ps = [];
    for (const p of this.players.values()) {
      ps.push({
        id: p.id, n: p.name, an: p.animal, c: p.color, b: p.base, tm: p.team, bot: p.bot ? 1 : 0,
        x: r2(p.x), y: r2(p.y), z: r2(p.z), ry: r2(p.ry), m: p.moving, a: p.air,
        me: Math.round(p.meter), sc: p.score, f: p.food, w: p.weapon, ow: p.owned,
        ab: now < p.abUntil ? 1 : 0, cd: Math.max(0, Math.ceil((p.cdUntil - now) / 100) / 10),
        pr: now < p.protectUntil ? 1 : 0,
      });
    }
    // Lockbeten ser ut precis som räven (samma namn, färg och färgmätare)
    for (const d of this.decoys) {
      const o = this.players.get(d.owner);
      const m = d.mover;
      ps.push({
        id: d.id, n: o.name, an: 'fox', c: o.color, b: o.base, tm: o.team, bot: o.bot ? 1 : 0, dc: 1,
        x: r2(m.x), y: r2(m.y), z: r2(m.z), ry: r2(d.ry), m: 1, a: m.onGround ? 0 : 1,
        me: Math.round(o.meter), sc: 0, f: 0, w: o.weapon, ow: [], ab: 0, cd: 0, pr: 0,
      });
    }
    const cl = this.clouds.map((c) => c.c);
    const snap = JSON.stringify({ t: 'snap', ps, cl, ts: this.teamScores(), win: this.winScore, time: this.timeLeft(), phase: this.phase });
    for (const p of this.players.values()) {
      // Hoppa över en klient som inte hinner ta emot – annars köas sekunder av gamla lägen
      if (p.ws && p.ws.readyState === 1 && p.ws.bufferedAmount < 64 * 1024) p.ws.send(snap);
    }
  }

  updateProjectiles(dt) {
    const STEPS = 4;
    const sdt = dt / STEPS;
    const keep = [];
    for (const pr of this.projectiles) {
      let done = false;
      for (let s = 0; s < STEPS && !done; s++) {
        pr.x += pr.vx * sdt; pr.y += pr.vy * sdt; pr.z += pr.vz * sdt;
        pr.vy -= pr.g * sdt;
        for (const p of this.players.values()) {
          if (p.id === pr.by || p.team === pr.team) continue; // skotten flyger igenom lagkamrater
          const dx = p.x - pr.x, dy = p.y + 0.6 - pr.y, dz = p.z - pr.z;
          const rr = 0.95 + pr.size; // generöst – det ska vara lätt för barn att träffa
          // Står djuret tätt intill en vägg ska skottet på andra sidan inte räknas
          if (dx * dx + dy * dy + dz * dz < rr * rr && clearLine(this.map, pr.x, pr.y, pr.z, p.x, p.y + 0.6, p.z)) {
            this.impact(pr, p, null);
            done = true;
            break;
          }
        }
        if (done) break;
        for (const d of this.decoys) {
          if (d.team === pr.team) continue;
          const m = d.mover;
          const dx = m.x - pr.x, dy = m.y + 0.6 - pr.y, dz = m.z - pr.z;
          const rr = 0.95 + pr.size;
          if (dx * dx + dy * dy + dz * dz < rr * rr && clearLine(this.map, pr.x, pr.y, pr.z, m.x, m.y + 0.6, m.z)) {
            this.impact(pr, null, null, d);
            done = true;
            break;
          }
        }
        if (done) break;
        const n = pointHitsWorld(this.map, pr.x, pr.y, pr.z);
        if (n) {
          this.impact(pr, null, n);
          done = true;
        }
      }
      pr.age += dt;
      if (!done && pr.age < pr.life && Math.abs(pr.x) < MAP_HALF + 5 && Math.abs(pr.z) < MAP_HALF + 5) keep.push(pr);
    }
    this.projectiles = keep;
  }

  impact(pr, target, normal, decoy) {
    const shooter = this.players.get(pr.by);
    const pos = [r2(pr.x), r2(pr.y), r2(pr.z)];
    if (pr.splash > 0) {
      // En direktträff ger full skada – splashen räknas från träffpunkten som ligger en bit från djurets mitt
      if (target) this.damage(target, shooter, pr.dmg, pr.color, pos);
      if (decoy) this.popDecoy(decoy);
      // Smällen sker strax innanför ytan den träffade – kolla sikten från en punkt strax utanför
      const n = normal || [0, 0, 0];
      const sx = pr.x + n[0] * 0.15, sy = pr.y + n[1] * 0.15, sz = pr.z + n[2] * 0.15;
      for (const p of this.players.values()) {
        if (p.id === pr.by || p.team === pr.team || p === target) continue;
        const d = Math.hypot(p.x - pr.x, p.y + 0.6 - pr.y, p.z - pr.z);
        if (d < pr.splash && clearLine(this.map, sx, sy, sz, p.x, p.y + 0.6, p.z)) this.damage(p, shooter, pr.dmg * (1 - (d / pr.splash) * 0.6), pr.color, [r2(p.x), r2(p.y + 0.6), r2(p.z)]);
      }
      for (const d of [...this.decoys]) {
        if (d.team === pr.team || d === decoy) continue;
        const m = d.mover;
        if (Math.hypot(m.x - pr.x, m.y + 0.6 - pr.y, m.z - pr.z) < pr.splash) this.popDecoy(d);
      }
      this.broadcast({ t: 'splat', id: pr.id, p: pos, n: normal || [0, 1, 0], c: pr.color, s: 2.2 });
      return;
    }
    if (decoy) {
      this.broadcast({ t: 'pend', id: pr.id });
      this.popDecoy(decoy);
    } else if (target) {
      this.broadcast({ t: 'pend', id: pr.id });
      this.damage(target, shooter, pr.dmg, pr.color, pos);
    } else {
      this.broadcast({ t: 'splat', id: pr.id, p: pos, n: normal, c: pr.color, s: 0.7 + pr.size * 2 });
    }
  }
}

function r2(v) {
  return Math.round(v * 100) / 100;
}
