// Små ljud gjorda direkt med Web Audio – inga ljudfiler behövs.
let ctx = null;
let muted = false;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  shoot: () => tone(520 + Math.random() * 80, 0.08, 'square', 0.04, -250),
  splat: (vol = 1) => tone(180 + Math.random() * 40, 0.12, 'triangle', 0.12 * vol, -120),
  hit: () => { tone(660, 0.08, 'square', 0.07, 200); },
  hurt: () => tone(200, 0.15, 'sawtooth', 0.08, -100),
  yum: () => { tone(700, 0.07, 'sine', 0.12, 300); setTimeout(() => tone(1050, 0.08, 'sine', 0.1, 200), 70); },
  plask: () => { tone(400, 0.3, 'triangle', 0.18, -330); setTimeout(() => tone(150, 0.3, 'sine', 0.15, -80), 120); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.14), i * 120)),
  buy: () => [600, 800, 1000].forEach((f, i) => setTimeout(() => tone(f, 0.1, 'square', 0.06), i * 70)),
  ability: () => tone(300, 0.3, 'sine', 0.12, 600),
  jump: () => tone(300, 0.1, 'sine', 0.06, 250),
  boing: () => { tone(220, 0.25, 'sine', 0.12, 700); setTimeout(() => tone(500, 0.15, 'triangle', 0.06, 400), 60); },
};
