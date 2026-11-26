// Tiny WebAudio synth: engine hum that follows the throttle, ring chimes,
// touchdown thump, crash noise. No audio files, no network. Every call is
// guarded: in a headless run or before the first gesture the context may
// not exist, and the game must keep playing silently.
let ctx = null;
let muted = false;
let engine = null;

function ensure() {
  if (ctx || muted) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { muted = true; return null; }
    ctx = new AC();
  } catch { muted = true; return null; }
  return ctx;
}

function tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slideTo = 0) {
  const c = ensure();
  if (!c) return;
  try {
    const t0 = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  } catch { /* sound is garnish, never a crash */ }
}

function noise(dur, vol = 0.08, when = 0) {
  const c = ensure();
  if (!c) return;
  try {
    const t0 = c.currentTime + when;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.buffer = buf; src.connect(g).connect(c.destination); src.start(t0);
  } catch { /* garnish */ }
}

export function resumeAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function setMuted(m) { muted = m; if (m) stopEngine(); }
export function isMuted() { return muted; }

export function startEngine() {
  const c = ensure();
  if (!c || engine) return;
  try {
    const o = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = 55;
    o2.type = 'sine'; o2.frequency.value = 110;
    g.gain.value = 0.0;
    o.connect(g); o2.connect(g); g.connect(c.destination);
    o.start(); o2.start();
    engine = { o, o2, g };
  } catch { engine = null; }
}

export function setEngine(throttle, speed) {
  if (!engine) return;
  try {
    const t = ctx.currentTime;
    engine.o.frequency.setTargetAtTime(48 + throttle * 0.9 + speed * 0.25, t, 0.1);
    engine.o2.frequency.setTargetAtTime(96 + throttle * 1.8 + speed * 0.5, t, 0.1);
    engine.g.gain.setTargetAtTime(0.015 + throttle * 0.00045, t, 0.1);
  } catch { /* garnish */ }
}

export function stopEngine() {
  if (!engine) return;
  try { engine.o.stop(); engine.o2.stop(); } catch { /* already stopped */ }
  engine = null;
}

export const sfx = {
  ring() { tone(880, 0.12, 'sine', 0.14); tone(1318, 0.22, 'sine', 0.12, 0.09); },
  takeoff() { tone(392, 0.15, 'triangle', 0.12); tone(523, 0.2, 'triangle', 0.12, 0.1); },
  land() { noise(0.25, 0.16); tone(196, 0.2, 'triangle', 0.1); },
  crash() { noise(0.6, 0.22); tone(90, 0.5, 'sawtooth', 0.12, 0, 40); },
  warn() { tone(660, 0.1, 'square', 0.06); tone(660, 0.1, 'square', 0.06, 0.15); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, i * 0.12)); },
  click() { tone(660, 0.05, 'square', 0.06); },
};
