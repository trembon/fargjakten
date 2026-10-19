// Snabbtest: ansluter som en spelare, skjuter på en bot i ett annat lag och kollar att träffar räknas.
// Tips: WIN_SCORE=2 npm start för att se att rundan tar slut när ett lag når målet.
import WebSocket from 'ws';
const ws = new WebSocket(`ws://localhost:${process.env.PORT || 4321}`);
let me = null, snap = null, k = 0, roundEnd = null;
const stats = { hit: 0, splat: 0, plask: 0, shot: 0, food: 0 };
// Startar ett nytt spel om inget pågår, annars går den med i det som pågår
ws.on('open', () => ws.send(JSON.stringify({ t: 'create', map: process.env.MAP || 'park', bots: 2, name: 'Testare', animal: 'monkey', color: 'blue' })));
ws.on('message', (raw) => {
  const m = JSON.parse(raw);
  if (m.t === 'welcome') me = m;
  if (m.t === 'snap') snap = m;
  if (m.t === 'tp') k = m.k;
  if (m.t === 'round' && m.phase === 'end') roundEnd = m;
  if (m.t === 'round' && m.phase === 'over') console.log('round over – back to the start page');
  if (m.t in stats) stats[m.t]++;
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(500);
console.log('welcome', me.id, 'team', me.team, 'base', me.base, 'color', me.color.toString(16), 'win', me.win);
for (let i = 0; i < 60; i++) {
  if (roundEnd) break;
  const bots = snap.ps.filter((p) => p.bot && p.tm !== me.team);
  const b = bots[0];
  // Ställ mig 6 m från boten (utanför min bas) och skjut rakt mot den
  const x = b.x - 6, z = b.z, y = b.y;
  ws.send(JSON.stringify({ t: 'st', x, y, z, ry: Math.PI / 2, m: 0, a: 0, k }));
  await sleep(60);
  const o = [x, y + 1.25, z];
  const dx = b.x - o[0], dy = b.y + 0.6 - o[1], dz = b.z - o[2];
  const t = Math.hypot(dx, dy, dz) / 24;
  const d = [dx / t, dy / t + 4 * t, dz / t]; const l = Math.hypot(...d);
  ws.send(JSON.stringify({ t: 'shoot', o, d: d.map((v) => v / l) }));
  await sleep(200);
}
const mine = snap.ps.find((p) => p.id === me.id);
console.log('events', stats);
console.log('team scores', snap.ts, roundEnd ? `round ended, winner team ${roundEnd.winner}` : 'round still going');
console.log('teams', snap.ps.map((p) => `${p.n}=${p.tm}`).join(' '));
console.log('my score', mine.sc, 'players', snap.ps.map((p) => `${p.n}(${p.an}) sc=${p.sc} food=${p.f} w=${p.w} meter=${p.me}`).join(' | '));
ws.close();
