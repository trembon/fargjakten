// Färgjakten – klienten. Startsida, nätverk, spelloop och kamera.
import * as THREE from 'three';
import { ANIMALS, ANIMAL_IDS, COLORS, FOODS, PAINT_MAX, SCORE_PLASK, TICK_RATE, WEAPONS, WIN_SCORE } from '../../shared/constants.js';
import { MAPS, POND, ceilingHeight, createMap, groundHeight, inBase, inPond, pointHitsWorld } from '../../shared/map.js';
import { createMover, startFly, stepMover, superHop } from '../../shared/movement.js';
import { Controls } from './controls.js';
import { Particles, Projectiles } from './effects.js';
import { createAnimal, createWeapon } from './models.js';
import { Avatar } from './players.js';
import { sfx, toggleMute, unlockAudio } from './sound.js';
import { FoodView, Splats, buildWorld, createBaseBeacon } from './world.js';

const $ = (id) => document.getElementById(id);
const css = (hex) => '#' + hex.toString(16).padStart(6, '0');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const WEAPON_INFO = [
  { icon: '💧', desc: 'Startvapnet. Lagom snabbt.' },
  { icon: '⚡', desc: 'Skjuter dubbelt så snabbt!' },
  { icon: '🌈', desc: 'Fem regnbågsklickar på en gång!' },
  { icon: '💥', desc: 'Stor smäll som färgar alla runt omkring!' },
  { icon: '🌊', desc: 'Sprutar en lång färgstråle i full fart!' },
];

// Stoppa zoom/scroll-gester i Safari
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault());

// ---------------- Inställningar som sparas ----------------

const prefs = { name: '', animal: 'capybara', color: 'red', bots: 2, map: 'park' };
try { Object.assign(prefs, JSON.parse(localStorage.getItem('fargjakten') || '{}')); } catch { /* inget sparat */ }
if (!COLORS.some((c) => c.id === prefs.color)) prefs.color = 'red'; // gamla färger finns inte längre
if (!MAPS.some((m) => m.id === prefs.map)) prefs.map = 'park';
const savePrefs = () => { try { localStorage.setItem('fargjakten', JSON.stringify(prefs)); } catch { /* privat läge */ } };

// Sessions-id: samma flik = samma spelare, så köpen finns kvar efter omladdning eller byte av djur.
// sessionStorage (inte localStorage) så att två flikar på datorn blir två spelare.
const session = (key, value) => {
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch { /* privat läge */ }
  return null;
};
let sid = session('fj-sid');
if (!sid) {
  sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
  session('fj-sid', sid);
}

// ---------------- 3D-scenen ----------------

let map = createMap(prefs.map);
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const maxRatio = Math.min(window.devicePixelRatio || 1, 1.5);
let pixelRatio = maxRatio;
renderer.setPixelRatio(pixelRatio);

const scene = new THREE.Scene();
const SKY = 0x8fd3ff;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 35, 80);
const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 90);
scene.add(new THREE.HemisphereLight(0xdff3ff, 0x6a8f3a, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(20, 40, 10);
scene.add(sun);

let world = buildWorld(scene, map);
const splats = new Splats(scene, map);
const foodView = new FoodView(scene);
const projectiles = new Projectiles(scene, map);
const particles = new Particles(scene, 420);
projectiles.trail = (p) => particles.trail(p.x, p.y, p.z, p.c, p.s * 3);
projectiles.fizzle = (p) => particles.burst([p.x, p.y, p.z], p.c, 4, 1.5);

// Byt bana: riv den gamla världen och bygg den nya
function loadMap(id) {
  if (id === map.id) return;
  world.dispose();
  map = createMap(id);
  world = buildWorld(scene, map);
  splats.map = map;
  projectiles.map = map;
  splats.clear();
}

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------- Startsidan ----------------

function makeThumbs() {
  const out = {};
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(160, 160);
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.8));
    const l = new THREE.DirectionalLight(0xffffff, 1.6);
    l.position.set(2, 4, 3);
    sc.add(l);
    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 30);
    for (const id of ANIMAL_IDS) {
      const a = createAnimal(id);
      a.mount.add(createWeapon(0));
      a.group.rotation.y = 0.65;
      sc.add(a.group);
      const h = a.def.height;
      cam.position.set(0, h * 0.75, 2.4 + h * 1.4);
      cam.lookAt(0, h * 0.48, 0);
      r.render(sc, cam);
      out[id] = r.domElement.toDataURL();
      sc.remove(a.group);
      a.material.dispose();
    }
    r.dispose();
    r.forceContextLoss();
  } catch { /* bilder är inte nödvändiga */ }
  return out;
}

let thumbs = {};
let lobbyInfo = null; // senaste lobbystatus från servern: finns det ett spel att gå med i?

function buildLobby() {
  $('name').value = prefs.name;
  thumbs = makeThumbs();
  const animals = $('animals');
  for (const id of ANIMAL_IDS) {
    const d = document.createElement('div');
    d.className = 'animal';
    d.dataset.id = id;
    d.innerHTML = `${thumbs[id] ? `<img src="${thumbs[id]}" alt="">` : ''}${ANIMALS[id].name}`;
    d.onclick = () => { prefs.animal = id; refreshLobby(); };
    animals.appendChild(d);
  }
  for (const c of COLORS) {
    const d = document.createElement('div');
    d.className = 'color';
    d.dataset.id = c.id;
    d.style.background = css(c.hex);
    d.textContent = c.team;
    d.onclick = () => { prefs.color = c.id; refreshLobby(); };
    $('colors').appendChild(d);
  }
  for (const m of MAPS) {
    const d = document.createElement('div');
    d.className = 'map';
    d.dataset.id = m.id;
    d.innerHTML = `${m.emoji} ${m.name}<small>${m.desc}</small>`;
    d.onclick = () => {
      prefs.map = m.id;
      savePrefs();
      refreshLobby();
      if (!myId && lobbyInfo?.phase === 'idle') loadMap(m.id); // visa banan bakom startsidan
    };
    $('maps').appendChild(d);
  }
  for (const segId of ['bots', 'menu-bots']) {
    for (let n = 0; n <= 4; n++) {
      const b = document.createElement('button');
      b.textContent = n;
      b.dataset.n = n;
      b.onclick = () => {
        prefs.bots = n;
        savePrefs();
        refreshLobby();
        if (segId === 'menu-bots') send({ t: 'bots', n });
      };
      $(segId).appendChild(b);
    }
  }
  $('play').onclick = start;
  $('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { $('name').blur(); } });
  refreshLobby();
}

function refreshLobby() {
  for (const el of document.querySelectorAll('#animals .animal')) el.classList.toggle('sel', el.dataset.id === prefs.animal);
  for (const el of document.querySelectorAll('.color')) el.classList.toggle('sel', el.dataset.id === prefs.color);
  for (const el of document.querySelectorAll('.map')) el.classList.toggle('sel', el.dataset.id === prefs.map);
  for (const el of document.querySelectorAll('.seg button')) el.classList.toggle('sel', +el.dataset.n === prefs.bots);
  $('animal-desc').textContent = ANIMALS[prefs.animal].desc;
  // Pågår ett spel går man med i det, annars startar man ett nytt och väljer bana
  const L = lobbyInfo;
  const joining = !!L && L.phase !== 'idle';
  $('lobby').classList.toggle('joining', joining);
  $('play').textContent = joining ? 'Gå med! ▶' : 'Starta nytt spel! ▶';
  $('play').disabled = !L || L.phase === 'end';
  const status = $('lobby-status');
  if (!L) status.textContent = 'Ansluter till servern… 🔌';
  else if (L.phase === 'idle') status.textContent = 'Inget spel just nu – välj bana och starta ett! 🎨';
  else {
    const title = L.phase === 'end' ? 'Rundan är slut – strax kan ni starta ett nytt spel ⏳' : `Ett spel pågår på ${esc(L.mapName)}!`;
    const scores = L.ts.map((v, i) => `<span style="background:${css(COLORS[i].hex)}">${v}</span>`).join('');
    const who = L.players.length
      ? L.players.map((p) => `<span><i style="background:${css(COLORS[p.tm].hex)}"></i>${esc(p.n)}${p.bot ? ' 🤖' : ''} · ${ANIMALS[p.an]?.name || ''}</span>`).join('')
      : '<span>Alla har gått ut – spelet stängs snart om ingen går med</span>';
    status.innerHTML = `${title}<div class="scores">${scores}</div><div class="who">${who}</div>`;
  }
}

function start() {
  const name = $('name').value.trim();
  if (!name) {
    $('lobby-msg').textContent = 'Skriv ditt namn först! ✏️';
    $('name').focus();
    return;
  }
  prefs.name = name;
  savePrefs();
  unlockAudio();
  if (!lobbyInfo || !ws || ws.readyState !== 1) {
    $('lobby-msg').textContent = 'Ansluter… försök igen om en stund';
    return;
  }
  const who = { name, animal: prefs.animal, color: prefs.color, sid };
  if (lobbyInfo.phase === 'idle') send({ t: 'create', map: prefs.map, bots: prefs.bots, ...who });
  else if (lobbyInfo.phase === 'play') send({ t: 'join', ...who });
  else return;
  $('lobby-msg').textContent = 'Startar…';
}

// ---------------- Nätverk ----------------

let ws = null;
let myId = 0;
let me = null;
let mover = null;
let myBase = 0;
let myTeam = 0;
let winScore = WIN_SCORE;
let tpSeq = 0;
let phase = 'play';
let myState = null;
let myAnimal = 'capybara'; // djuret servern faktiskt gav oss
let abilityKind = '';
let abilityUntil = 0;
let beacon = null;
const avatars = new Map();
const info = new Map(); // senaste snapshot per id

function send(m) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
}

// Anslutningen öppnas direkt när sidan laddas – servern berättar om det finns ett spel att gå med i.
function connect() {
  ws = new WebSocket(`ws://${location.host}`);
  ws.onmessage = (e) => {
    lastMsgAt = performance.now();
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    handlers[m.t]?.(m);
  };
  ws.onclose = () => {
    if (myId) {
      reconnect();
      return;
    }
    // På startsidan: försök igen tills servern svarar
    lobbyInfo = null;
    refreshLobby();
    setTimeout(connect, 1000);
  };
}

// Efter tappad kontakt mitt i spelet laddas sidan om – gå då med igen direkt om spelet fortfarande pågår
let autoJoin = !!session('fj-autojoin');
session('fj-autojoin', null);

// Tappad kontakt: ladda om och gå direkt in i spelet igen. Servern känner igen sid och
// ger tillbaka mat, vapen och poäng.
let reconnecting = false;
function reconnect() {
  if (reconnecting) return;
  reconnecting = true;
  try { ws.onclose = null; ws.close(); } catch { /* redan stängd */ }
  controls.enabled = false;
  $('lobby').classList.remove('hidden');
  $('lobby-msg').textContent = 'Tappade kontakten… ansluter igen 🔌';
  session('fj-autojoin', '1');
  const retry = setInterval(() => {
    fetch('/', { cache: 'no-store' }).then((r) => { if (r.ok) { clearInterval(retry); location.reload(); } }).catch(() => {});
  }, 1000);
}

// Vakthund: iOS kan lämna anslutningen "öppen" fast inget kommer fram (skärmlås, strömsparläge).
// Då rör sig djuret bara på skärmen men servern vet inget – så det går inte att skjuta eller plocka mat.
let lastMsgAt = 0;
function watchdog(limit) {
  if (!myId || reconnecting || document.hidden) return;
  if (performance.now() - lastMsgAt > limit) reconnect();
}
setInterval(() => watchdog(3000), 500);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  // Ge anslutningen en chans att höra av sig innan vi bestämmer oss
  lastMsgAt = Math.max(lastMsgAt, performance.now() - 1000);
  setTimeout(() => watchdog(2000), 1200);
});

// Ping för ?fps-visningen
let ping = 0;
let snapGap = 0;
let lastSnapAt = 0;
setInterval(() => send({ t: 'ping', c: performance.now() }), 2000);

// Servern säger vilket djur man är – t.ex. efter ett byte hemma i basen
function applyAnimal(s) {
  myAnimal = ANIMALS[s.an] ? s.an : 'capybara';
  mover.animal = myAnimal;
  const ry = me.ry;
  me.dispose(scene);
  me = new Avatar(scene, { ...s, n: prefs.name }, true);
  me.ry = ry;
  me.pos.set(mover.x, mover.y, mover.z);
  avatars.set(myId, me);
  $('ab-name').textContent = ANIMALS[myAnimal].abilityName;
  abilityUntil = 0;
  particles.puff(mover.x, mover.y, mover.z, 14);
  if (!$('zoo').classList.contains('hidden')) renderZoo();
}

// Tillbaka till startsidan: släpp allt från spelet
function resetGame() {
  closeShop();
  closeZoo();
  closeMenu();
  $('results').classList.add('hidden');
  controls.reset();
  controls.enabled = false;
  document.exitPointerLock?.();
  for (const av of avatars.values()) av.dispose(scene);
  avatars.clear();
  info.clear();
  if (beacon) {
    scene.remove(beacon);
    beacon.geometry.dispose();
    beacon.material.dispose();
    beacon = null;
  }
  foodView.set([]);
  splats.clear();
  projectiles.clear();
  myId = 0;
  me = null;
  mover = null;
  myState = null;
  abilityUntil = 0;
  inHome = false;
  for (const id of ['home-hint', 'btn-shop', 'btn-zoo']) $(id).classList.remove('on');
  $('btn-shoot').classList.remove('disabled');
  for (const k in hudCache) delete hudCache[k];
  $('lobby-msg').textContent = '';
  $('lobby').classList.remove('hidden');
  refreshLobby();
}

const handlers = {
  full() {
    $('lobby-msg').textContent = 'Spelet är fullt just nu.';
  },
  lobby(m) {
    lobbyInfo = m;
    if (myId) return;
    // Bakom startsidan syns banan som spelas, eller den man valt att starta
    loadMap(m.phase === 'idle' ? prefs.map : m.map);
    if ($('lobby-msg').textContent === 'Startar…') $('lobby-msg').textContent = '';
    refreshLobby();
    if (autoJoin) {
      autoJoin = false;
      if (m.phase === 'play' && prefs.name) start();
    }
  },
  welcome(m) {
    loadMap(m.map);
    myId = m.id;
    myBase = m.base;
    myTeam = m.team;
    winScore = m.win || WIN_SCORE;
    tpSeq = 0;
    myAnimal = m.animal || prefs.animal;
    mover = createMover(m.x, m.y, m.z, myAnimal);
    yaw = m.ry;
    pitch = 0.18;
    me = new Avatar(scene, { id: m.id, an: myAnimal, c: m.color, n: prefs.name, x: m.x, y: m.y, z: m.z, ry: m.ry, w: 0 }, true);
    avatars.set(myId, me);
    beacon = createBaseBeacon(myBase, m.color);
    scene.add(beacon);
    foodView.set(m.food);
    phase = m.phase;
    $('ab-name').textContent = ANIMALS[myAnimal].abilityName;
    $('meter-fill').style.background = css(m.color);
    $('lobby').classList.add('hidden');
    controls.enabled = true;
    $('lobby-msg').textContent = '';
    prefs.bots = m.botCount;
    lastMsgAt = performance.now();
    if (m.mh !== map.hash) showBig('⚠️ Starta om servern', 'Servern kör en äldre version av banan – färgen kan fastna på osynliga väggar.');
    else if (m.restored) showBig('Välkommen tillbaka! 🎉', 'Dina vapen är kvar');
    else showBig(`${COLORS[myTeam].emoji} ${COLORS[myTeam].team}`, `Först till ${winScore} poäng vinner! Samla mat 🍎 och köp vapen hemma`);
  },
  pong(m) {
    ping = performance.now() - m.c;
  },
  snap(m) {
    const now = performance.now();
    if (lastSnapAt) snapGap = Math.max(snapGap, now - lastSnapAt);
    lastSnapAt = now;
    phase = m.phase;
    if (m.win) winScore = m.win;
    const seen = new Set();
    for (const s of m.ps) {
      seen.add(s.id);
      info.set(s.id, s);
      if (s.id === myId) {
        if (s.an !== myAnimal) applyAnimal(s);
        myState = s;
        me.setInfo(s);
        continue;
      }
      let av = avatars.get(s.id);
      if (!av || av.animal !== s.an) {
        if (av) av.dispose(scene);
        av = new Avatar(scene, s, false);
        avatars.set(s.id, av);
      }
      av.setInfo(s);
      av.pushState(s, now);
    }
    for (const [id, av] of avatars) {
      if (!seen.has(id) && id !== myId) {
        av.dispose(scene);
        avatars.delete(id);
        info.delete(id);
      }
    }
    updateHud(m);
  },
  shot(m) {
    for (const s of m.list) {
      projectiles.add(s);
      if (s.by === myId) sfx.shoot();
    }
  },
  pend(m) {
    projectiles.remove(m.id);
  },
  hit(m) {
    avatars.get(m.tg)?.addSpot(m.c);
    particles.burst(m.p, m.c, 10, 4);
    if (m.tg === myId) {
      flash(m.c);
      sfx.hurt();
    } else if (m.by === myId) {
      sfx.hit();
    }
  },
  block(m) {
    particles.burst(m.p, 0xffffff, 8, 3);
  },
  splat(m) {
    projectiles.remove(m.id);
    splats.add(m.p, m.n, m.c, m.s);
    particles.burst(m.p, m.c, m.s > 2 ? 30 : 6, m.s > 2 ? 7 : 2.5);
    if (mover) {
      const d = Math.hypot(m.p[0] - mover.x, m.p[2] - mover.z);
      if (d < 25) sfx.splat(1 - d / 25);
    }
  },
  plask(m) {
    const av = avatars.get(m.tg);
    const tgName = info.get(m.tg)?.n || '';
    const byName = info.get(m.by)?.n || '';
    if (av) {
      splats.add([av.pos.x, av.pos.y + 0.02, av.pos.z], [0, 1, 0], m.c, 2.6);
      particles.burst([av.pos.x, av.pos.y + 0.6, av.pos.z], m.c, 30, 6);
      av.clearSpots();
    }
    avatars.get(m.by)?.celebrate();
    if (m.tg === myId) {
      showBig('PLASK! 💦', `${esc(byName)} färgade dig helt! Tillbaka hem…`);
      sfx.plask();
    } else if (m.by === myId) {
      showBig(`PLASK! +${SCORE_PLASK} ⭐`, `Du färgade ${esc(tgName)} helt!`);
      sfx.plask();
    }
  },
  tp(m) {
    mover.x = m.x; mover.y = m.y; mover.z = m.z; mover.vy = 0;
    tpSeq = m.k;
    yaw = m.ry;
    me.clearSpots();
  },
  food(m) {
    foodView.add(m.add);
    foodView.remove(m.rem);
  },
  yum(m) {
    sfx.yum();
    const f = FOODS.find((x) => x.id === m.k);
    toast(`Mums! ${f.name} +${f.value} 🍎`);
  },
  ab(m) {
    if (m.kind === 'roll') avatars.get(m.id)?.startRoll(ANIMALS.redpanda.duration);
    if (m.kind === 'superjump') {
      const av = avatars.get(m.id);
      if (av) {
        particles.burst([av.pos.x, av.pos.y + 0.1, av.pos.z], 0xffe14a, 16, 4);
        particles.puff(av.pos.x, av.pos.y, av.pos.z, 10);
      }
    }
    if (m.id !== myId) return;
    sfx.ability();
    if (m.kind === 'fly') startFly(mover);
    if (m.kind === 'superjump') { superHop(mover); sfx.boing(); }
    abilityKind = m.kind;
    abilityUntil = performance.now() + ANIMALS[myAnimal].duration * 1000;
  },
  round(m) {
    if (m.phase === 'end') {
      closeShop();
      closeZoo();
      const t = COLORS[m.winner] || COLORS[0];
      const title = $('results-title');
      title.textContent = `🏆 ${t.team} vann!`;
      title.style.color = css(t.hex);
      $('results-teams').innerHTML = COLORS.map((c, i) => `<span style="background:${css(c.hex)}">${m.ts[i]}</span>`).join('');
      const list = $('results-list');
      list.innerHTML = m.ranking.map((r) => `<li><i style="background:${css(r.c)}"></i>${esc(r.n)} – ${r.sc} ⭐</li>`).join('');
      $('results-next').textContent = m.winner === myTeam
        ? 'Grattis, ditt lag vann! 🎉 Tillbaka till startsidan snart…'
        : 'Tillbaka till startsidan snart…';
      document.exitPointerLock?.();
      $('results').classList.remove('hidden');
      sfx.win();
    } else if (m.phase === 'over') {
      resetGame();
    }
  },
  msg(m) {
    toast(m.text);
    if (m.big) sfx.buy();
  },
};

// ---------------- HUD ----------------

let toastTimer = 0;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
}

let bigTimer = 0;
function showBig(title, sub) {
  const b = $('big-text');
  b.innerHTML = `${title}<small>${sub || ''}</small>`;
  b.classList.add('on');
  clearTimeout(bigTimer);
  bigTimer = setTimeout(() => b.classList.remove('on'), 2200);
}

function flash(color) {
  const f = $('hit-flash');
  f.style.color = css(color);
  f.style.transition = 'none';
  f.style.opacity = '0.8';
  requestAnimationFrame(() => {
    f.style.transition = 'opacity .4s';
    f.style.opacity = '0';
  });
}

// Skriv bara till sidan när något faktiskt ändrats – att bygga om HUD:en 20 gånger i sekunden
// får Safari att räkna om layouten ovanpå 3D-bilden, och det hackar på iPad.
const hudCache = {};
function setHtml(id, html) {
  if (hudCache[id] === html) return;
  hudCache[id] = html;
  $(id).innerHTML = html;
}
function setStyle(id, prop, value) {
  const k = id + '.' + prop;
  if (hudCache[k] === value) return;
  hudCache[k] = value;
  $(id).style[prop] = value;
}

function updateHud(m) {
  const s = myState;
  if (!s) return;
  setHtml('stat-food', `🍎 <b>${s.f}</b>`);
  setHtml('stat-score', `⭐ <b>${s.sc}</b>`);
  // Lagpoäng: en liten stapel per lag, mitt lag markerat
  setHtml('teams', COLORS.map((c, i) => {
    const v = m.ts ? m.ts[i] : 0;
    return `<div class="team${i === myTeam ? ' mine' : ''}"><div class="team-fill" style="background:${css(c.hex)};width:${Math.min(100, (v / winScore) * 100)}%"></div><b>${v}</b></div>`;
  }).join('') + `<div class="team-goal">${m.phase === 'end' ? 'Paus' : `Mål ${winScore}`}</div>`);
  setStyle('meter-fill', 'width', `${Math.min(100, (s.me / PAINT_MAX) * 100)}%`);
  const a = ANIMALS[myAnimal];
  setStyle('ab-cd', 'height', `${Math.min(100, (s.cd / a.cooldown) * 100)}%`);
  if (hudCache.ab !== !!s.ab) {
    hudCache.ab = !!s.ab;
    $('btn-ability').classList.toggle('active', !!s.ab);
  }
  const sorted = [...m.ps].sort((x, y) => (x.tm === myTeam ? -1 : 0) - (y.tm === myTeam ? -1 : 0) || x.tm - y.tm || y.sc - x.sc);
  setHtml('scoreboard', sorted
    .map((p) => `<div class="${p.id === myId ? 'me' : ''}"><i style="background:${css(p.c)}"></i>${esc(p.n)}${p.bot ? ' 🤖' : ''}<b>${p.sc}</b></div>`)
    .join(''));
  if (!$('shop').classList.contains('hidden')) renderShop();
}

// ---------------- Butik och meny ----------------

// Bygg bara om listan när något ändrats – annars byts knapparna ut mitt i ett musklick.
let shopKey = '';
function renderShop(force) {
  const s = myState;
  if (!s) return;
  const key = `${s.f}|${s.w}|${s.ow.join(',')}`;
  if (!force && key === shopKey) return;
  shopKey = key;
  $('shop-food').textContent = s.f;
  $('shop-list').innerHTML = WEAPONS.map((w, i) => {
    const owned = s.ow.includes(i);
    const eq = s.w === i;
    let btn;
    if (eq) btn = `<button class="owned" data-w="${i}" data-a="equip">Vald ✓</button>`;
    else if (owned) btn = `<button class="owned" data-w="${i}" data-a="equip">Välj</button>`;
    else btn = `<button data-w="${i}" data-a="buy" ${s.f < w.price ? 'disabled' : ''}>Köp 🍎${w.price}</button>`;
    return `<div class="weapon ${eq ? 'equipped' : ''}"><div class="w-icon">${WEAPON_INFO[i].icon}</div>
      <div class="w-info"><div class="w-name">${w.name}</div><div class="w-desc">${WEAPON_INFO[i].desc}</div></div>${btn}</div>`;
  }).join('');
}

$('shop-list').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  send({ t: b.dataset.a, w: +b.dataset.w });
});

function openShop() {
  if (!inHome) {
    toast('Gå hem till din bas för att handla! 🏠');
    return;
  }
  controls.reset();
  controls.enabled = false;
  document.exitPointerLock?.();
  renderShop(true);
  $('shop').classList.remove('hidden');
}
function closeShop() {
  if ($('shop').classList.contains('hidden')) return;
  $('shop').classList.add('hidden');
  controls.enabled = true;
}
$('shop-close').onclick = closeShop;

// Djurbytet fungerar som butiken: bara hemma i basen, men gratis
function renderZoo() {
  $('zoo-list').innerHTML = ANIMAL_IDS.map((id) => `<div class="animal${id === myAnimal ? ' sel' : ''}" data-id="${id}">
    ${thumbs[id] ? `<img src="${thumbs[id]}" alt="">` : ''}${ANIMALS[id].name}<small>★ ${ANIMALS[id].abilityName}</small></div>`).join('');
}
$('zoo-list').addEventListener('click', (e) => {
  const d = e.target.closest('.animal');
  if (!d) return;
  if (d.dataset.id !== myAnimal) {
    send({ t: 'animal', a: d.dataset.id });
    prefs.animal = d.dataset.id;
    savePrefs();
  }
  closeZoo();
});
function openZoo() {
  if (!inHome) {
    toast('Gå hem till din bas för att byta djur! 🏠');
    return;
  }
  controls.reset();
  controls.enabled = false;
  document.exitPointerLock?.();
  renderZoo();
  $('zoo').classList.remove('hidden');
}
function closeZoo() {
  if ($('zoo').classList.contains('hidden')) return;
  $('zoo').classList.add('hidden');
  controls.enabled = true;
}
$('zoo-close').onclick = closeZoo;

function openMenu() {
  controls.reset();
  controls.enabled = false;
  document.exitPointerLock?.();
  refreshLobby();
  $('menu').classList.remove('hidden');
}
function closeMenu() {
  if ($('menu').classList.contains('hidden')) return;
  $('menu').classList.add('hidden');
  controls.enabled = true;
}
$('menu-close').onclick = closeMenu;

// Tangentbord: B/Esc stänger butiken, N/Esc djurbytet, Esc/M öppnar och stänger menyn
window.addEventListener('keydown', (e) => {
  if (!myId || e.target.tagName === 'INPUT') return;
  const shopOpen = !$('shop').classList.contains('hidden');
  const zooOpen = !$('zoo').classList.contains('hidden');
  const menuOpen = !$('menu').classList.contains('hidden');
  let handled = true;
  if (shopOpen && (e.code === 'KeyB' || e.code === 'Escape')) closeShop();
  else if (zooOpen && (e.code === 'KeyN' || e.code === 'Escape')) closeZoo();
  else if (menuOpen && (e.code === 'KeyM' || e.code === 'Escape')) closeMenu();
  else if (!shopOpen && !zooOpen && !menuOpen && e.code === 'KeyM') openMenu();
  else handled = false;
  // Registreras före Controls, så B inte öppnar butiken igen direkt
  if (handled) e.stopImmediatePropagation();
});
$('menu-sound').onclick = () => {
  $('menu-sound').textContent = toggleMute() ? '🔇 Ljud av' : '🔊 Ljud på';
};
$('menu-lobby').onclick = () => {
  send({ t: 'quit' });
  resetGame();
};

// ---------------- Uppdateringar ----------------
// Hemskärmsappen på iOS kan hålla kvar en gammal sida. Servern skickar med versionen i
// <meta name="app-version">, och /version säger vilken som är nyast.

const myVersion = document.querySelector('meta[name="app-version"]')?.content || '';

async function latestVersion() {
  try {
    const r = await fetch(`/version?t=${Date.now()}`, { cache: 'no-store' });
    return (await r.json()).v;
  } catch {
    return null;
  }
}

function reloadTo(v) {
  location.replace(`/?v=${v || Date.now()}`);
}

function say(text) {
  if ($('lobby').classList.contains('hidden')) toast(text);
  else $('lobby-msg').textContent = text;
}

async function checkUpdate() {
  say('Letar efter uppdatering…');
  const v = await latestVersion();
  if (!v) say('Kunde inte nå servern 😕');
  else if (v !== myVersion) {
    say('Ny version hittad – laddar om! ✨');
    setTimeout(() => reloadTo(v), 400);
  } else say('Du har senaste versionen ✓');
}
$('menu-update').onclick = checkUpdate;
$('lobby-update').onclick = checkUpdate;
$('update-banner').onclick = () => reloadTo();

// Kolla själv när appen öppnas igen, och visa en knapp om det finns något nytt
async function autoCheck() {
  const v = await latestVersion();
  if (v && myVersion && v !== myVersion) $('update-banner').classList.remove('hidden');
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) autoCheck(); });
setInterval(autoCheck, 60000);

// ---------------- Kontroller och kamera ----------------

const controls = new Controls($('game'), { stick: $('stick'), knob: $('knob') });
controls.onButton = (name) => {
  if (name === 'shop') openShop();
  if (name === 'zoo') openZoo();
  if (name === 'menu') openMenu();
};

let yaw = 0;
let pitch = 0.18;
let camDist = 4.4;
let inHome = false;
let washing = false;
let lastSend = 0;
let lastShot = 0;
const camDir = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const tmp = new THREE.Vector3();

// Hitta en fiende nära siktet (hjälp att sikta för små händer)
function findAimTarget() {
  let best = null;
  let bestAngle = 0.22;
  for (const [id, av] of avatars) {
    if (id === myId) continue;
    const s = info.get(id);
    if (s && s.tm === myTeam) continue; // sikta inte på lagkamrater
    if (s && s.ab && ANIMALS[s.an]?.ability === 'hide') continue;
    tmp.set(av.pos.x, av.pos.y + 0.6, av.pos.z).sub(camera.position);
    const d = tmp.length();
    if (d > aimRange() + camDist || d < 1) continue;
    const ang = Math.acos(Math.min(1, tmp.dot(camDir) / d));
    if (ang < bestAngle) {
      bestAngle = ang;
      best = av;
    }
  }
  return best;
}

function aimRange() {
  return WEAPONS[myState ? myState.w : 0].range;
}

function shoot(now, target) {
  const w = WEAPONS[myState ? myState.w : 0];
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const o = [mover.x + fx * 0.3, mover.y + 1.25, mover.z + fz * 0.3];
  let P;
  if (target) {
    // Sikta dit djuret är när skottet kommer fram – vi ser det lite i efterskott och skottet tar tid
    const [tvx, tvz] = target.velocity();
    const lag = (target.interpDelay() + 80) / 1000;
    P = [target.pos.x, target.pos.y + 0.6, target.pos.z];
    for (let k = 0; k < 2; k++) {
      const ahead = lag + Math.hypot(P[0] - o[0], P[1] - o[1], P[2] - o[2]) / w.speed;
      P = [target.pos.x + tvx * ahead, target.pos.y + 0.6, target.pos.z + tvz * ahead];
    }
  } else {
    P = null;
    const far = camDist + w.range;
    for (let d = camDist; d < far; d += 0.5) {
      const x = camera.position.x + camDir.x * d, y = camera.position.y + camDir.y * d, z = camera.position.z + camDir.z * d;
      if (pointHitsWorld(map, x, y, z)) { P = [x, y, z]; break; }
    }
    if (!P) P = [camera.position.x + camDir.x * far, camera.position.y + camDir.y * far, camera.position.z + camDir.z * far];
  }
  const dx = P[0] - o[0], dy = P[1] - o[1], dz = P[2] - o[2];
  const t = Math.max(0.05, Math.hypot(dx, dy, dz) / w.speed);
  let vx = dx / t, vy = dy / t + 0.5 * w.gravity * t, vz = dz / t;
  const l = Math.hypot(vx, vy, vz);
  vx /= l; vy /= l; vz /= l;
  send({ t: 'shoot', o, d: [vx, vy, vz] });
  lastShot = now;
}

function updateLocal(dt, now) {
  const [lx, ly] = controls.consumeLook();
  yaw -= lx;
  pitch = Math.max(-1.05, Math.min(0.85, pitch + ly)); // högt upp så man når flygande örnar

  const [ix, iy] = controls.getMove();
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const mx = fx * iy - fz * ix;
  const mz = fz * iy + fx * ix;

  let jump = controls.jumpPressed;
  controls.jumpPressed = false;
  // Under superhoppet studsar kaninen av sig själv varje gång den landar
  const bouncing = now < abilityUntil && abilityKind === 'superjump';
  if (bouncing && mover.onGround) {
    jump = true;
    sfx.boing();
  } else if (jump && (mover.onGround || mover.jumpsLeft > 0)) sfx.jump();
  if (controls.abilityPressed) {
    controls.abilityPressed = false;
    if (myState && myState.cd <= 0) send({ t: 'ab' });
  }

  const abOn = now < abilityUntil;
  mover.sprint = abOn && abilityKind === 'sprint';
  mover.roll = abOn && abilityKind === 'roll';
  mover.superJump = abOn && abilityKind === 'superjump';
  const steps = dt > 0.025 ? 2 : 1;
  for (let i = 0; i < steps; i++) {
    stepMover(mover, { mx, mz, jump: jump && i === 0, jumpHeld: controls.jumpHeld }, dt / steps, map);
  }

  me.pos.set(mover.x, mover.y, mover.z);
  let d = yaw - me.ry;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  me.ry += d * Math.min(1, dt * 14);
  me.moving = ix !== 0 || iy !== 0;
  me.air = !mover.onGround;

  if (now - lastSend > 1000 / TICK_RATE) {
    lastSend = now;
    send({ t: 'st', x: mover.x, y: mover.y, z: mover.z, ry: yaw, m: me.moving ? 1 : 0, a: me.air ? 1 : 0, k: tpSeq });
  }

  // Tvätta av färgen i dammen
  const wash = mover.inWater && myState && myState.me > 0;
  if (wash && !washing) toast('Du tvättar dig! 🫧');
  washing = wash;

  const home = inBase(mover.x, mover.z) === myBase;
  if (home !== inHome) {
    inHome = home;
    $('home-hint').classList.toggle('on', home);
    $('btn-shop').classList.toggle('on', home);
    $('btn-zoo').classList.toggle('on', home);
    $('btn-shoot').classList.toggle('disabled', home);
    if (!home) {
      closeShop();
      closeZoo();
    }
  }

  // Kamera bakom djuret
  camDir.set(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  camTarget.set(mover.x, mover.y + 1.75, mover.z);
  // Under ett tak (inne i ett hus) sänks siktpunkten så att kameran ryms under taket
  const roof = ceilingHeight(map, mover.x, mover.z, mover.y);
  if (camTarget.y > roof - 0.45) camTarget.y = Math.max(mover.y + 0.9, roof - 0.45);
  let want = 4.4;
  for (let s = 0.3; s <= want; s += 0.15) {
    if (pointHitsWorld(map, camTarget.x - camDir.x * s, camTarget.y - camDir.y * s, camTarget.z - camDir.z * s)) {
      want = Math.max(0.5, s - 0.35);
      break;
    }
  }
  camDist += (want - camDist) * Math.min(1, dt * (want < camDist ? 20 : 4));
  camera.position.copy(camTarget).addScaledVector(camDir, -camDist);
  // När man tittar uppåt hamnar kameran lågt – inte genom marken. Bara mark i djurets höjd räknas,
  // annars blir husets tak "mark" och kameran hamnar ovanpå taket.
  camera.position.y = Math.max(camera.position.y, groundHeight(map, camera.position.x, camera.position.z, mover.y + 0.5) + 0.3);
  if (roof < Infinity) camera.position.y = Math.min(camera.position.y, roof - 0.2);
  tmp.copy(camTarget).add(camDir);
  camera.lookAt(tmp);

  const target = findAimTarget();
  $('crosshair').classList.toggle('lock', !!target);

  const w = WEAPONS[myState ? myState.w : 0];
  if (controls.shooting && phase === 'play' && !home && now - lastShot >= 1000 / w.rate) shoot(now, target);
}

// ---------------- Spelloopen ----------------

let last = performance.now();
let frames = 0;
let fpsTime = last;
let goodStreak = 0;
let lobbyAngle = 0;
let drops = 0; // hur många gånger upplösningen sänkts – efter två slutar vi pendla upp igen
const showFps = location.search.includes('fps');

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (mover) updateLocal(dt, now);
  else {
    // Startsidan: kameran glider sakta runt banan
    lobbyAngle += dt * 0.06;
    camera.position.set(Math.sin(lobbyAngle) * 34, 18, Math.cos(lobbyAngle) * 34);
    camera.lookAt(0, 0, 0);
  }

  for (const [id, av] of avatars) {
    if (av !== me) av.interpolate(now);
    const s = info.get(id);
    let op = 1;
    if (s) {
      const kind = ANIMALS[s.an]?.ability;
      if (s.ab && kind === 'hide') op = av === me ? 0.35 : 0.07;
      else if (s.pr) op = Math.floor(now / 150) % 2 ? 0.45 : 0.9; // blinkar men förblir genomskinlig
      av.shield.visible = !!(s.ab && kind === 'shield');
      if (s.ab && kind === 'roll' && !av.rolling) av.startRoll(0.3); // kom in mitt i en rullning
      // Glitter runt kaninen medan superhoppet är igång
      if (s.ab && kind === 'superjump' && op > 0.3 && Math.random() < dt * 25) {
        particles.trail(av.pos.x + (Math.random() - 0.5) * 0.6, av.pos.y + 0.3 + Math.random() * 0.8, av.pos.z + (Math.random() - 0.5) * 0.6, Math.random() < 0.5 ? 0xffe14a : 0xffffff, 0.8);
      }
    }
    av.setOpacity(op);
    // I dammen tvättas färgen bort – bubblor tills man är ren
    if (s && av.spots.count && inPond(av.pos.x, av.pos.z) && av.pos.y < -POND.depth + 0.3) {
      if (s.me === 0) av.clearSpots();
      else if (op > 0.3 && Math.random() < dt * 20) {
        particles.puff(av.pos.x + (Math.random() - 0.5) * 0.8, av.pos.y + 0.3, av.pos.z + (Math.random() - 0.5) * 0.8, 1, Math.random() < 0.5 ? 0xffffff : 0xbfe8ff, 1.1);
      }
    }
    const gy = groundHeight(map, av.pos.x, av.pos.z, av.pos.y + 0.1);
    av.update(dt, gy);
    // Dammpuffar när man landar eller springer
    if (av.landed) {
      av.landed = false;
      particles.puff(av.pos.x, gy, av.pos.z, 7);
    } else if (av.moving && !av.air && op > 0.3 && Math.random() < dt * (av.rolling ? 14 : 3)) {
      particles.puff(av.pos.x, gy, av.pos.z, 1, 0xe8dcc0, 0.9);
    }
  }
  if (beacon) beacon.material.opacity = inHome ? 0.06 : 0.22;

  projectiles.update(dt);
  particles.update(dt);
  splats.update();
  world.update(dt, camera);
  foodView.update(dt);
  renderer.render(scene, camera);

  // Anpassa upplösningen efter hur snabb enheten är
  frames++;
  if (now - fpsTime > 2000) {
    const fps = (frames * 1000) / (now - fpsTime);
    frames = 0;
    fpsTime = now;
    if (showFps) {
      $('fps').textContent = `${fps.toFixed(0)} fps · ${pixelRatio.toFixed(2)}x · ping ${ping.toFixed(0)} ms · lucka ${snapGap.toFixed(0)} ms`;
      snapGap = 0;
    }
    if (fps < 5) {
      goodStreak = 0; // fliken är i bakgrunden – mät inte
    } else if (mover && fps < 40 && pixelRatio > 0.75) {
      pixelRatio -= 0.25;
      renderer.setPixelRatio(pixelRatio);
      resize();
      goodStreak = 0;
      drops++;
    } else if (fps > 58 && pixelRatio < maxRatio && drops < 2) {
      // Höj bara efter ~10 s stabil bildfrekvens; varje byte av upplösning ger ett litet hack
      if (++goodStreak >= 5) {
        pixelRatio = Math.min(maxRatio, pixelRatio + 0.25);
        renderer.setPixelRatio(pixelRatio);
        resize();
        goodStreak = 0;
      }
    } else {
      goodStreak = 0;
    }
  }
}

buildLobby();
connect();
requestAnimationFrame(frame);

// För felsökning i webbläsarens konsol
window.fj = { scene, camera, renderer, Avatar, get ws() { return ws; }, get mover() { return mover; }, get yaw() { return yaw; }, set yaw(v) { yaw = v; }, get pitch() { return pitch; }, set pitch(v) { pitch = v; } };
