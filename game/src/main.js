// Skyline Courier — bootstrap. Fixed-timestep loop, ?shot= staging for
// screenshots, and the __shotReady flag the screenshot runner waits on.
import { VIEW } from './config.js';
import { createWorld, loadBest, update } from './world.js';
import { render } from './render.js';
import { stageShot } from './shots.js';
import { createInput } from './input.js';
import { resumeAudio, setMuted, isMuted } from './audio.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 1) || 1;

const canvas = document.getElementById('game');
canvas.width = VIEW.w;
canvas.height = VIEW.h;
const ctx = canvas.getContext('2d');
const input = createInput(canvas);

let world;
if (shotName) {
  world = stageShot(shotName, seed) || createWorld(seed);
  // Staged scenes set their own best score; don't overwrite it from storage.
} else {
  world = createWorld(seed);
  loadBest(world);
}
window.__world = world; // for play-testing and debugging from the console

let last = performance.now();
let acc = 0;
const STEP = 1 / 60;
let frames = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= STEP) {
    if (input.wasPressed('KeyM')) setMuted(!isMuted());
    update(world, STEP, input);
    input.endFrame();
    acc -= STEP;
  }
  render(ctx, world);
  frames += 1;
  if (shotName && frames >= 3) window.__shotReady = true;
  requestAnimationFrame(frame);
}

window.addEventListener('pointerdown', resumeAudio, { once: true });
window.addEventListener('keydown', resumeAudio, { once: true });
requestAnimationFrame(frame);
