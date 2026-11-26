// Skyline Courier — Ring Run: flight model, ring course, terrain, scoring.
// The plane starts parked on runway 36. Throttle up, rotate at 55 m/s,
// fly the 8 rings in order, then land back on the runway before the clock
// runs out. Original game, no libraries.
import {
  FLIGHT_SECONDS, RING_POINTS, RING_RADIUS, TAKEOFF_SPEED, STALL_SPEED,
  MAX_SPEED, CRUISE_SPEED, RINGS, RUNWAY, TOWN, RIVER_POINTS,
  ROAD_POINTS, COLORS,
} from './config.js';
import { mulberry32, pick } from './random.js';
import { sfx, startEngine, setEngine, stopEngine } from './audio.js';

const DEG = Math.PI / 180;
const RUNWAY_HALF_W = RUNWAY.width / 2;
const RUNWAY_HALF_L = RUNWAY.length / 2;

export function onRunway(x, z) {
  return Math.abs(x - RUNWAY.x) <= RUNWAY_HALF_W && Math.abs(z - RUNWAY.z) <= RUNWAY_HALF_L;
}

function ringNormal(i) {
  const c = RINGS[i];
  const p = i === 0 ? { x: 0, z: 500 } : RINGS[i - 1];
  const dx = c.x - p.x, dz = c.z - p.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len };
}

export function createWorld(seed = 1) {
  const rng = mulberry32(seed);
  const rings = RINGS.map((r, i) => ({
    x: r.x, alt: r.alt, z: r.z, n: ringNormal(i), done: false, missed: false,
  }));

  // Valley floor: a grid of farm fields in seeded colours.
  const fields = [];
  for (let gx = -3300; gx < 3300; gx += 300) {
    for (let gz = -4200; gz < 3000; gz += 300) {
      fields.push({ x: gx, z: gz, size: 300, color: pick(rng, COLORS.field) });
    }
  }
  // River (a winding polyline) and a country road to the town.
  const river = RIVER_POINTS.map(([x, z]) => ({ x, z }));
  const road = ROAD_POINTS.map(([x, z]) => ({ x, z }));
  // Town: seeded buildings around the town centre, kept off the runway.
  const buildings = [];
  for (let i = 0; i < 48; i++) {
    const a = rng() * Math.PI * 2;
    const d = 40 + rng() * TOWN.radius;
    const x = TOWN.x + Math.cos(a) * d;
    const z = TOWN.z + Math.sin(a) * d * 0.8;
    if (onRunway(x, z)) continue;
    buildings.push({
      x, z, w: 18 + rng() * 34, d: 18 + rng() * 34,
      h: 8 + rng() * 26, roof: pick(rng, COLORS.townRoof), rot: (rng() - 0.5) * 0.6,
    });
  }
  // Trees scattered over the fields, kept off the runway and town streets.
  const trees = [];
  for (let i = 0; i < 260; i++) {
    const x = -3200 + rng() * 6400;
    const z = -4100 + rng() * 7000;
    if (onRunway(x, z)) continue;
    if (Math.hypot(x - TOWN.x, z - TOWN.z) < 120) continue;
    trees.push({ x, z, r: 5 + rng() * 7 });
  }
  // Clouds drift slowly over the valley.
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    clouds.push({
      x: -3500 + rng() * 7000, z: -4200 + rng() * 7000,
      alt: 700 + rng() * 180, r: 90 + rng() * 160, drift: 2 + rng() * 4,
    });
  }

  return {
    seed, state: 'title', result: null, crashReason: '',
    time: FLIGHT_SECONDS, timeLeft: FLIGHT_SECONDS,
    score: 0, ringsDone: 0, best: 0, bestCombo: 0, combo: 0,
    plane: {
      x: 0, z: 480, alt: 0, heading: 0, pitch: 0, roll: 0,
      speed: 0, throttle: 0, vspeed: 0, airborne: false, onGround: true,
    },
    rings, fields, river, road, buildings, trees, clouds,
    popups: [], message: '', messageT: 0, warnT: 0, flashT: 0,
    elapsed: 0, landedSpeed: 0, prevRingD: null, everAirborne: false,
  };
}

export function loadBest(world) {
  try { world.best = Number(window.localStorage.getItem('skyline-courier-best') || 0) || 0; } catch { world.best = 0; }
}

export function saveBest(world) {
  if (world.score > world.best) {
    world.best = world.score;
    try { window.localStorage.setItem('skyline-courier-best', String(world.best)); } catch { /* storage is a bonus */ }
  }
}

function popup(world, text, color) {
  world.popups.push({ text, color: color || '#ffd166', t: 2.2 });
  if (world.popups.length > 4) world.popups.shift();
}

function say(world, text, secs = 2.5) {
  world.message = text; world.messageT = secs;
}

export function nextRing(world) {
  return world.rings.find((r) => !r.done) || null;
}

export function ringDistance(world) {
  const r = nextRing(world);
  if (!r) return 0;
  const p = world.plane;
  return Math.hypot(r.x - p.x, r.alt - p.alt, r.z - p.z);
}

function endFlight(world, state, result, reason) {
  world.state = state;
  world.result = result;
  world.crashReason = reason || '';
  stopEngine();
  if (result === 'win') {
    world.score += 200 + Math.round(world.timeLeft) * 2;
    sfx.win();
  } else if (state === 'crashed') {
    sfx.crash();
  }
  saveBest(world);
}

export function startFlight(world) {
  const w = createWorld(world.seed);
  w.best = world.best;
  Object.keys(w).forEach((k) => { world[k] = w[k]; });
  world.state = 'playing';
  say(world, 'THROTTLE UP — W to spool the engine', 3);
  startEngine();
}

export function update(world, dt, input) {
  const p = world.plane;

  // --- global keys -------------------------------------------------------
  if (input.wasPressed('KeyM')) { /* mute handled in main via audio module */ }
  if (input.wasPressed('KeyR') && world.state !== 'title') {
    startFlight(world);
    return;
  }
  if (world.state === 'title') {
    if (input.wasPressed('Enter', 'Space') || input.takeClick()) {
      sfx.click();
      startFlight(world);
    }
    return;
  }
  if (world.state === 'crashed' || world.state === 'landed' || world.state === 'timeup') {
    if (input.wasPressed('Enter', 'Space') || input.takeClick()) startFlight(world);
    return;
  }

  // --- playing -----------------------------------------------------------
  world.elapsed += dt;
  world.timeLeft = Math.max(0, FLIGHT_SECONDS - world.elapsed);
  if (world.timeLeft <= 0) {
    endFlight(world, 'timeup', p.airborne ? 'timeup' : 'timeup', '');
    return;
  }
  if (world.messageT > 0) world.messageT -= dt;
  if (world.warnT > 0) world.warnT -= dt;
  for (const pop of world.popups) pop.t -= dt;
  world.popups = world.popups.filter((pop) => pop.t > 0);
  world.flashT = Math.max(0, world.flashT - dt);

  const stick = input.stick();
  const drag = input.takeMouseDrag();

  // Throttle: W spools up, S spools down; brakes on the ground with Space.
  if (input.throttleUp()) p.throttle = Math.min(100, p.throttle + 45 * dt);
  if (input.throttleDown()) p.throttle = Math.max(0, p.throttle - 45 * dt);
  const targetSpeed = (p.throttle / 100) * MAX_SPEED;
  const accel = p.onGround ? 14 : 9;
  if (p.speed < targetSpeed) p.speed = Math.min(targetSpeed, p.speed + accel * dt);
  else p.speed = Math.max(targetSpeed, p.speed - 7 * dt);
  if (input.brake() && p.onGround) p.speed = Math.max(0, p.speed - 30 * dt);

  // Pitch / roll from keys and mouse drag.
  p.pitch += stick.pitch * 24 * dt;
  p.roll += stick.roll * 60 * dt;
  if (drag.down) {
    p.roll += drag.dx * 0.14;
    p.pitch += -drag.dy * 0.10;
  }
  p.pitch = Math.max(-14, Math.min(24, p.pitch));
  p.roll = Math.max(-62, Math.min(62, p.roll));
  if (!stick.roll && !drag.down) {
    // Gentle auto-level when the stick is centred.
    p.roll -= Math.sign(p.roll) * Math.min(Math.abs(p.roll), 28 * dt);
  }

  // Turn: banked turns, faster at cruise speed.
  const turnRate = p.roll * 0.32 * Math.min(1.4, Math.max(0.25, p.speed / CRUISE_SPEED));
  p.heading = (p.heading + turnRate * dt + 360) % 360;

  // Vertical flight: pitch drives climb/descent; below stall speed the nose drops.
  const stalled = p.airborne && p.speed < STALL_SPEED;
  if (p.airborne) {
    if (stalled) {
      p.pitch = Math.max(p.pitch - 18 * dt, -12);
      p.vspeed = p.speed * Math.sin(p.pitch * DEG) - (STALL_SPEED - p.speed) * 0.9;
    } else {
      p.vspeed = p.speed * Math.sin(p.pitch * DEG);
    }
    p.alt += p.vspeed * dt;
    if (p.alt > 900) { p.alt = 900; p.vspeed = Math.min(0, p.vspeed); }
  } else {
    p.vspeed = 0;
    p.pitch = Math.max(0, Math.min(p.pitch, 10));
    // Rotate: enough speed + nose up = airborne.
    if (p.speed >= TAKEOFF_SPEED && p.pitch > 4) {
      p.airborne = true; p.onGround = false; p.alt = 0.5;
      world.everAirborne = true;
      say(world, 'AIRBORNE — fly the gold ring!', 2.5);
      sfx.takeoff();
    }
  }

  // Move along the heading.
  const hRad = p.heading * DEG;
  const fx = Math.sin(hRad), fz = -Math.cos(hRad);
  p.x += fx * p.speed * dt;
  p.z += fz * p.speed * dt;

  // Drift the clouds.
  for (const c of world.clouds) { c.x += c.drift * dt; if (c.x > 3800) c.x = -3800; }

  // --- rings ---------------------------------------------------------------
  const ring = nextRing(world);
  if (ring && p.airborne) {
    const d = (p.x - ring.x) * ring.n.x + (p.z - ring.z) * ring.n.z;
    if (world.prevRingD !== null && world.prevRingD < 0 && d >= 0) {
      const lateral = Math.hypot(
        (p.x - ring.x) - ring.n.x * d,
        (p.z - ring.z) - ring.n.z * d,
        p.alt - ring.alt,
      );
      if (lateral <= RING_RADIUS) {
        ring.done = true;
        world.ringsDone += 1;
        world.combo += 1;
        world.bestCombo = Math.max(world.bestCombo, world.combo);
        const pts = RING_POINTS + (world.combo >= 3 ? 25 * (world.combo - 2) : 0);
        world.score += pts;
        popup(world, `RING ${world.ringsDone}/8  +${pts}`, '#ffd166');
        world.flashT = 0.25;
        sfx.ring();
        if (!nextRing(world)) say(world, 'ALL RINGS! Land back on runway 36', 4);
      } else {
        ring.missed = true;
        world.combo = 0;
        popup(world, `MISSED RING ${world.ringsDone + 1} — circle back!`, '#ff5964');
        sfx.warn();
      }
    }
    world.prevRingD = d;
  } else if (ring) {
    world.prevRingD = null;
  }

  // --- ground --------------------------------------------------------------
  if (p.airborne && p.alt <= 0) {
    p.alt = 0;
    if (onRunway(p.x, p.z) && p.vspeed > -9 && p.speed < 100) {
      // Touchdown on the runway.
      p.airborne = false; p.onGround = true; p.pitch = 0;
      world.landedSpeed = p.speed;
      sfx.land();
      say(world, 'TOUCHDOWN — roll out', 2);
    } else {
      endFlight(world, 'crashed', 'crash',
        onRunway(p.x, p.z) ? 'Came down too hard on the runway' : 'Flew into the ground');
      return;
    }
  }
  if (p.onGround && p.speed < 8 && p.alt <= 0 && world.everAirborne) {
    // Rolled to a stop: the sortie is over.
    const allRings = world.ringsDone >= 8;
    endFlight(world, 'landed', allRings ? 'win' : 'landed',
      allRings ? '' : `Landed safely — ${world.ringsDone}/8 rings`);
    return;
  }

  // --- warnings ------------------------------------------------------------
  const low = p.airborne && p.alt < 45 && p.vspeed < -1;
  const stallWarn = stalled;
  if ((low || stallWarn) && world.warnT <= 0) {
    sfx.warn();
    world.warnT = 1.4;
    if (low) say(world, '⚠ PULL UP — terrain!', 1.2);
    else say(world, '⚠ STALL — throttle up, nose down!', 1.2);
  }

  setEngine(p.throttle, p.speed);
}
