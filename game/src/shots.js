// Deterministic staged scenes for the screenshots (?shot=start|play|ring|end).
// Each one builds a fixed world state — no randomness, no waiting — so a
// screenshot taken of it shows the game at its best: the runway and valley,
// the plane in frame with instruments lit, a gold ring ahead, and the HUD.
import { createWorld, loadBest, nextRing } from './world.js';
import { FLIGHT_SECONDS } from './config.js';

function base(seed) {
  const world = createWorld(seed);
  loadBest(world);
  world.state = 'playing';
  world.elapsed = FLIGHT_SECONDS - 212; // 3:32 left (update recomputes from elapsed)
  world.time = 212;
  world.timeLeft = 212;
  world.score = 320;
  world.ringsDone = 3;
  world.combo = 2;
  world.bestCombo = 2;
  return world;
}

function placePlane(world, x, z, alt, heading, pitch, roll, speed, throttle) {
  const p = world.plane;
  p.x = x; p.z = z; p.alt = alt; p.heading = heading;
  p.pitch = pitch; p.roll = roll; p.speed = speed; p.throttle = throttle;
  p.airborne = alt > 0; p.onGround = alt <= 0;
  if (alt > 0) world.everAirborne = true;
}

export function stageShot(shot, seed = 1) {
  if (shot === 'start') {
    const world = createWorld(seed);
    loadBest(world);
    world.state = 'title';
    // Parked at the south end of runway 36, nose on the centreline, first
    // gold ring dead ahead over the river valley.
    placePlane(world, 0, 480, 0, 0, 0, 0, 0, 0);
    return world;
  }

  if (shot === 'play') {
    const world = base(seed);
    // Mid-course: southbound toward ring 4, river valley and town behind,
    // ring 3 already banked, ring 4 gold and in frame just right of the nose.
    world.rings[0].done = true; world.rings[1].done = true; world.rings[2].done = true;
    placePlane(world, 2000, -1100, 270, 170, 4, -8, 85, 80);
    world.message = 'RING 3/8 — keep climbing';
    world.messageT = 10;
    return world;
  }

  if (shot === 'ring') {
    const world = base(seed);
    world.score = 520;
    world.ringsDone = 5;
    world.combo = 3;
    world.bestCombo = 3;
    world.rings[0].done = true; world.rings[1].done = true;
    world.rings[2].done = true; world.rings[3].done = true; world.rings[4].done = true;
    // A heartbeat from ring 6: gold ring in frame ahead, the runway and
    // valley below, town behind it.
    placePlane(world, 780, 1290, 296, 233, 2, 8, 88, 82);
    world.popups.push({ text: 'RING 5/8  +100', color: '#ffd166', t: 2.0 });
    world.flashT = 0.18;
    return world;
  }

  if (shot === 'end') {
    const world = base(seed);
    world.state = 'landed';
    world.result = 'win';
    world.score = 1240;
    world.ringsDone = 8;
    world.bestCombo = 4;
    world.best = 1240;
    world.timeLeft = 96;
    for (const r of world.rings) r.done = true;
    placePlane(world, 0, 120, 0, 0, 0, 0, 0, 0);
    return world;
  }

  return null;
}

export function shotNames() { return ['start', 'play', 'ring', 'end']; }
export { nextRing };
