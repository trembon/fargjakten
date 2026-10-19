// Startar webbserver + WebSocket. Kör: npm start
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { PORT as DEFAULT_PORT } from '../shared/constants.js';
import { Game } from './game.js';

const PORT = Number(process.env.PORT) || DEFAULT_PORT;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = {
  '/': ['client/index.html', 'text/html; charset=utf-8'],
  '/index.html': ['client/index.html', 'text/html; charset=utf-8'],
  '/style.css': ['client/style.css', 'text/css; charset=utf-8'],
  '/game.js': ['public/game.js', 'text/javascript; charset=utf-8'],
  '/game.js.map': ['public/game.js.map', 'application/json'],
  '/icon.png': ['public/icon.png', 'image/png'],
  '/favicon.ico': ['public/icon.png', 'image/png'],
  '/manifest.json': ['client/manifest.json', 'application/manifest+json'],
};

// Versionen = när game.js senast byggdes. Läses varje gång så att en ny build märks utan omstart.
function version() {
  try {
    return Math.floor(fs.statSync(path.join(root, 'public/game.js')).mtimeMs).toString(36);
  } catch {
    return '0';
  }
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/version') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ v: version() }));
    return;
  }
  const entry = files[url];
  if (!entry) {
    res.writeHead(404);
    res.end('Hittades inte');
    return;
  }
  fs.readFile(path.join(root, entry[0]), (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end(url === '/game.js' ? 'Kör "npm run build" först.' : 'Fel');
      return;
    }
    if (entry[0] === 'client/index.html') {
      // Sidan pekar på exakt den här versionen av game.js så att gamla filer aldrig fastnar i cachen
      const v = version();
      const html = data.toString('utf8')
        .replace('<script src="game.js"></script>', `<script src="game.js?v=${v}"></script>`)
        .replace('</head>', `  <meta name="app-version" content="${v}">
</head>`);
      res.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-store' });
      res.end(html);
      return;
    }
    res.writeHead(200, { 'Content-Type': entry[1], 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const game = new Game();
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  game.connect(ws);
});
// En iPad som tappat nätet utan att stänga anslutningen svarar inte på ping – koppla bort den
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    ws.ping();
  }
}, 5000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n🎨  Färgjakten är igång!\n');
  console.log(`   På den här datorn: http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) console.log(`   På iPad/iPhone:    http://${n.address}:${PORT}`);
    }
  }
  console.log('\n   Tryck Ctrl+C för att stänga av.\n');
});
