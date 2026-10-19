// Startar riktiga servern på en ledig port och kollar att sidan, versionen och ett spel via WebSocket fungerar.
// Kräver att public/game.js är byggd (npm test bygger först).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const PORT = 4500 + Math.floor(Math.random() * 400);
const base = `http://localhost:${PORT}`;
let server;

before(async () => {
  server = spawn(process.execPath, [fileURLToPath(new URL('../server/index.js', import.meta.url))], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('servern startade inte')), 10000);
    server.stdout.on('data', (d) => { if (d.toString().includes('igång')) { clearTimeout(timer); resolve(); } });
    server.on('exit', (code) => reject(new Error(`servern avslutades (${code})`)));
  });
});

after(() => server?.kill());

test('startsidan pekar på aktuell version av game.js', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  const { v } = await (await fetch(`${base}/version`)).json();
  assert.notEqual(v, '0', 'public/game.js saknas – kör npm run build');
  assert.ok(html.includes(`game.js?v=${v}`));
});

test('statiska filer serveras och okända ger 404', async () => {
  for (const path of ['/game.js', '/style.css', '/icon.png', '/manifest.json']) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200, path);
    await res.arrayBuffer();
  }
  assert.equal((await fetch(`${base}/finns-inte`)).status, 404);
});

test('man kan starta ett spel med botar via WebSocket', async () => {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const got = {};
  ws.on('message', (raw) => { const m = JSON.parse(raw); got[m.t] ??= m; });
  await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
  ws.send(JSON.stringify({ t: 'create', map: 'town', bots: 2, name: 'Testare', animal: 'monkey', color: 'blue' }));
  const deadline = Date.now() + 5000;
  while (!(got.welcome && got.snap) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  ws.close();
  assert.ok(got.lobby, 'fick ingen lobby');
  assert.ok(got.welcome, 'fick inget välkommen');
  assert.equal(got.welcome.map, 'town');
  assert.ok(got.snap, 'fick ingen ögonblicksbild');
  assert.equal(got.snap.ps.filter((p) => p.bot).length, 2);
  assert.ok(got.snap.ps.some((p) => p.id === got.welcome.id && p.n === 'Testare'));
});
