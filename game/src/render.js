// Skyline Courier — chase-view renderer. A small perspective projector
// turns the valley (fields, river, road, town, runway, rings) into a
// cockpit/chase view, then the aircraft, HUD and lit instruments are drawn
// on top. No images, no network — everything is canvas paths.
import { VIEW, COLORS, RUNWAY, RING_RADIUS } from './config.js';
import { nextRing, ringDistance, onRunway } from './world.js';

const DEG = Math.PI / 180;
const FOCAL = 620;
const CX = VIEW.w / 2;
const CY = VIEW.h / 2;

function fmt(n, digits = 0) { return n.toFixed(digits); }

function makeCamera(world) {
  const p = world.plane;
  const hRad = p.heading * DEG;
  const fx = Math.sin(hRad), fz = -Math.cos(hRad);
  const rx = Math.cos(hRad), rz = Math.sin(hRad);
  // Chase camera: behind the tail and a little above the plane.
  const camX = p.x - fx * 26;
  const camZ = p.z - fz * 26;
  const camY = p.alt + 7;
  const camPitch = p.pitch * 0.6;
  const horizonY = CY + FOCAL * Math.tan(camPitch * DEG);
  return { camX, camY, camZ, fx, fz, rx, rz, camPitch, roll: p.roll, horizonY };
}

// Project a world point to screen space. Returns null when behind the camera.
function project(cam, x, y, z) {
  const dx = x - cam.camX, dy = y - cam.camY, dz = z - cam.camZ;
  const cRight = dx * cam.rx + dz * cam.rz;
  const cFwd = dx * cam.fx + dz * cam.fz;
  const pr = cam.camPitch * DEG;
  const y2 = dy * Math.cos(pr) - cFwd * Math.sin(pr);
  const z2 = dy * Math.sin(pr) + cFwd * Math.cos(pr);
  if (z2 < 4) return null;
  let sx = CX + (FOCAL * cRight) / z2;
  let sy = CY - (FOCAL * y2) / z2;
  // Roll the view around the horizon centre, as a camera fixed to the plane does.
  const rr = -cam.roll * DEG;
  const ox = sx - CX, oy = sy - cam.horizonY;
  sx = CX + ox * Math.cos(rr) - oy * Math.sin(rr);
  sy = cam.horizonY + ox * Math.sin(rr) + oy * Math.cos(rr);
  return { x: sx, y: sy, z: z2, s: FOCAL / z2 };
}

function poly(ctx, pts, fill) {
  if (!pts.length) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
}

function quad(ctx, cam, corners, fill) {
  const pts = corners.map(([x, y, z]) => project(cam, x, y, z));
  if (pts.some((p) => !p)) return;
  poly(ctx, pts, fill);
}

function strip(ctx, cam, points, halfWidth, fill) {
  // Draw a flat ribbon along a polyline (river, road).
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * halfWidth, nz = (dx / len) * halfWidth;
    quad(ctx, cam, [
      [a.x - nx, 0.15, a.z - nz], [a.x + nx, 0.15, a.z + nz],
      [b.x + nx, 0.15, b.z + nz], [b.x - nx, 0.15, b.z - nz],
    ], fill);
  }
}

function drawSky(ctx, cam, world) {
  const g = ctx.createLinearGradient(0, 0, 0, cam.horizonY + 40);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(0.55, COLORS.skyMid);
  g.addColorStop(1, COLORS.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  // Sun: fixed in the west, projected so it tracks the heading.
  const sunDir = { x: -0.9, z: 0.44 }; // west-northwest
  const sp = project(cam, cam.camX + sunDir.x * 6000, cam.camY + 1500, cam.camZ + sunDir.z * 6000);
  if (sp && sp.x > -80 && sp.x < VIEW.w + 80 && sp.y > -80 && sp.y < cam.horizonY) {
    const sg = ctx.createRadialGradient(sp.x, sp.y, 4, sp.x, sp.y, 90);
    sg.addColorStop(0, 'rgba(255,243,176,0.95)');
    sg.addColorStop(0.35, 'rgba(255,243,176,0.45)');
    sg.addColorStop(1, 'rgba(255,243,176,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sp.x - 90, sp.y - 90, 180, 180);
    ctx.fillStyle = COLORS.sun;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 22, 0, Math.PI * 2); ctx.fill();
  }
  // Clouds as soft ellipses at altitude.
  for (const c of world.clouds) {
    const cp = project(cam, c.x, c.alt, c.z);
    if (!cp || cp.z > 9000) continue;
    const r = Math.max(6, c.r * cp.s * 0.9);
    if (cp.x < -r * 2 || cp.x > VIEW.w + r * 2 || cp.y < -r || cp.y > cam.horizonY + 20) continue;
    ctx.fillStyle = COLORS.cloud;
    ctx.beginPath();
    ctx.ellipse(cp.x, cp.y, r, r * 0.32, 0, 0, Math.PI * 2);
    ctx.ellipse(cp.x - r * 0.5, cp.y + r * 0.06, r * 0.6, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGround(ctx, cam, world) {
  // Ground plane below the (rolled) horizon line.
  ctx.save();
  ctx.translate(CX, cam.horizonY);
  ctx.rotate(-cam.roll * DEG);
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  g.addColorStop(0, COLORS.groundFar);
  g.addColorStop(1, COLORS.groundNear);
  ctx.fillStyle = g;
  ctx.fillRect(-1600, 0, 3200, 1600);
  ctx.restore();

  const p = world.plane;
  // Farm fields (far to near). Cells under the camera are skipped by the
  // projector; the base green shows through, so no holes appear.
  const fields = world.fields
    .map((f) => ({ f, d: Math.hypot(f.x - p.x, f.z - p.z) }))
    .filter((o) => o.d < 5200)
    .sort((a, b) => b.d - a.d);
  for (const { f } of fields) {
    const h = f.size / 2 - 4;
    quad(ctx, cam, [
      [f.x - h, 0.1, f.z - h], [f.x + h, 0.1, f.z - h],
      [f.x + h, 0.1, f.z + h], [f.x - h, 0.1, f.z + h],
    ], f.color);
  }
  strip(ctx, cam, world.river, 26, COLORS.river);
  strip(ctx, cam, world.road, 7, COLORS.road);
  // Road centre dashes.
  for (let i = 0; i < world.road.length - 1; i++) {
    const a = world.road[i], b = world.road[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.floor(len / 60);
    for (let s = 0; s < steps; s += 2) {
      const t0 = s / steps, t1 = (s + 0.6) / steps;
      const ax = a.x + (b.x - a.x) * t0, az = a.z + (b.z - a.z) * t0;
      const bx = a.x + (b.x - a.x) * t1, bz = a.z + (b.z - a.z) * t1;
      const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      const nx = (-dz / l) * 1.2, nz = (dx / l) * 1.2;
      quad(ctx, cam, [
        [ax - nx, 0.25, az - nz], [ax + nx, 0.25, az + nz],
        [bx + nx, 0.25, bz + nz], [bx - nx, 0.25, bz - nz],
      ], COLORS.roadLine);
    }
  }
  drawRunway(ctx, cam);
  drawBuildings(ctx, cam, world);
  drawTrees(ctx, cam, world);
}

function drawRunway(ctx, cam) {
  const hw = RUNWAY.width / 2, hl = RUNWAY.length / 2;
  quad(ctx, cam, [
    [-hw, 0.3, -hl], [hw, 0.3, -hl], [hw, 0.3, hl], [-hw, 0.3, hl],
  ], COLORS.runway);
  // Edge lights (amber, lit).
  for (let z = -hl + 30; z <= hl - 30; z += 60) {
    for (const x of [-hw + 2, hw - 2]) {
      const pt = project(cam, x, 0.6, z);
      if (!pt || pt.z > 4000) continue;
      ctx.fillStyle = COLORS.runwayEdge;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(1.2, 3.5 * pt.s * 0.4), 0, Math.PI * 2); ctx.fill();
    }
  }
  // Centreline dashes.
  for (let z = -hl + 60; z <= hl - 60; z += 90) {
    quad(ctx, cam, [
      [-1.5, 0.35, z - 18], [1.5, 0.35, z - 18],
      [1.5, 0.35, z + 18], [-1.5, 0.35, z + 18],
    ], COLORS.runwayLine);
  }
  // Threshold bars at both ends.
  for (const zc of [-hl + 18, hl - 18]) {
    for (let i = -2; i <= 2; i++) {
      quad(ctx, cam, [
        [i * 7 - 2.5, 0.35, zc - 10], [i * 7 + 2.5, 0.35, zc - 10],
        [i * 7 + 2.5, 0.35, zc + 10], [i * 7 - 2.5, 0.35, zc + 10],
      ], COLORS.runwayLine);
    }
  }
  // Runway number 36 at the north end.
  const num = project(cam, 0, 0.4, -hl + 70);
  if (num && num.z < 5000) {
    ctx.fillStyle = COLORS.runwayLine;
    ctx.font = `bold ${Math.max(10, Math.round(26 * num.s * 0.8))}px "Courier New", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('36', num.x, num.y);
  }
}

function drawBuildings(ctx, cam, world) {
  const p = world.plane;
  const list = world.buildings
    .map((b) => ({ b, d: Math.hypot(b.x - p.x, b.z - p.z) }))
    .filter((o) => o.d < 4200)
    .sort((a, b) => b.d - a.d);
  for (const { b } of list) {
    const c = Math.cos(b.rot), s = Math.sin(b.rot);
    const hw = b.w / 2, hd = b.d / 2;
    const corners = [
      [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd],
    ].map(([lx, lz]) => [b.x + lx * c - lz * s, b.z + lx * s + lz * c]);
    const base = corners.map(([x, z]) => project(cam, x, 0, z));
    const top = corners.map(([x, z]) => project(cam, x, b.h, z));
    if (base.some((q) => !q) || top.some((q) => !q)) continue;
    // Two side faces sharing the corner nearest the camera, then the roof.
    let nearest = 0;
    for (let i = 1; i < 4; i++) if (base[i].z < base[nearest].z) nearest = i;
    const prev = (nearest + 3) % 4, next = (nearest + 1) % 4;
    ctx.fillStyle = 'rgba(30,30,34,0.85)';
    poly(ctx, [base[nearest], base[next], top[next], top[nearest]]);
    ctx.fillStyle = 'rgba(60,60,66,0.85)';
    poly(ctx, [base[prev], base[nearest], top[nearest], top[prev]]);
    poly(ctx, top, b.roof);
  }
}

function drawTrees(ctx, cam, world) {
  const p = world.plane;
  for (const t of world.trees) {
    const d = Math.hypot(t.x - p.x, t.z - p.z);
    if (d > 3200) continue;
    const pt = project(cam, t.x, t.r, t.z);
    if (!pt) continue;
    const r = Math.max(1, t.r * pt.s * 0.9);
    if (pt.x < -20 || pt.x > VIEW.w + 20 || pt.y < 0 || pt.y > VIEW.h) continue;
    ctx.fillStyle = COLORS.tree;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.treeLight;
    ctx.beginPath(); ctx.arc(pt.x - r * 0.25, pt.y - r * 0.25, r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
}

function drawRings(ctx, cam, world) {
  const p = world.plane;
  const sorted = world.rings
    .map((r, i) => ({ r, i, d: Math.hypot(r.x - p.x, r.alt - p.alt, r.z - p.z) }))
    .sort((a, b) => b.d - a.d);
  for (const { r, i } of sorted) {
    const isNext = !r.done && world.rings.findIndex((q) => !q.done) === i;
    const color = r.done ? COLORS.ringDone : isNext ? COLORS.ringNext : COLORS.ringTodo;
    // Ring plane: horizontal side vector + vertical.
    const sx = r.n.z, sz = -r.n.x;
    const pts = [];
    let ok = true;
    for (let a = 0; a < 28; a++) {
      const th = (a / 28) * Math.PI * 2;
      const wx = r.x + Math.cos(th) * RING_RADIUS * sx;
      const wz = r.z + Math.cos(th) * RING_RADIUS * sz;
      const wy = r.alt + Math.sin(th) * RING_RADIUS;
      const pt = project(cam, wx, wy, wz);
      if (!pt) { ok = false; break; }
      pts.push(pt);
    }
    if (!ok) continue;
    const avgS = pts.reduce((s, q) => s + q.s, 0) / pts.length;
    // Guide line down to the ground so the ring's height reads at a glance.
    const gTop = project(cam, r.x, r.alt - RING_RADIUS, r.z);
    const gBot = project(cam, r.x, 0, r.z);
    if (gTop && gBot) {
      ctx.strokeStyle = isNext ? 'rgba(255,209,102,0.5)' : 'rgba(232,244,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(gTop.x, gTop.y); ctx.lineTo(gBot.x, gBot.y); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.save();
    if (isNext) { ctx.shadowColor = color; ctx.shadowBlur = 18; }
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, Math.min(9, 5.5 * avgS));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    // Label at the ring's top.
    const top = project(cam, r.x, r.alt + RING_RADIUS + 12, r.z);
    if (top && top.z < 6000) {
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.max(11, Math.round(15 * Math.min(1.6, top.s)))}px "Courier New", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(r.done ? `✓ RING ${i + 1}` : `RING ${i + 1}`, top.x, top.y);
    }
  }
}

// The courier plane, chase view from just behind the tail. Drawn in screen
// space, level in frame — the bank reads through the tilted horizon.
function drawPlane(ctx, world) {
  const p = world.plane;
  const px = CX, py = 438;
  const blink = Math.floor(world.elapsed * 2) % 2 === 0;
  ctx.save();
  ctx.translate(px, py);
  const bob = p.airborne ? Math.sin(world.elapsed * 2.2) * 1.5 : 0;
  ctx.translate(0, bob);
  // Soft shadow on the ground when low.
  if (p.alt < 120) {
    const sh = projectShadow(world);
    if (sh) {
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0.04, 0.28 - p.alt * 0.002)})`;
      ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 46 * sh.k, 10 * sh.k, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Wings (wide, pale, with red tips and a gold stripe).
  ctx.fillStyle = COLORS.planeWing;
  ctx.beginPath();
  ctx.moveTo(-142, -4); ctx.lineTo(-24, -18); ctx.lineTo(-16, 8); ctx.lineTo(-142, 18); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(142, -4); ctx.lineTo(24, -18); ctx.lineTo(16, 8); ctx.lineTo(142, 18); ctx.closePath(); ctx.fill();
  ctx.fillStyle = COLORS.planeAccent;
  ctx.fillRect(-142, 2, 118, 3);
  ctx.fillRect(24, 2, 118, 3);
  ctx.fillStyle = COLORS.planeBody;
  ctx.fillRect(-142, -4, 11, 22);
  ctx.fillRect(131, -4, 11, 22);
  // Spinning prop disc at the nose (far end, up the screen).
  ctx.fillStyle = 'rgba(200,220,235,0.35)';
  ctx.beginPath(); ctx.ellipse(0, -88, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(60,60,70,0.8)';
  ctx.beginPath(); ctx.arc(0, -88, 4, 0, Math.PI * 2); ctx.fill();
  // Fuselage: tapered body, nose away from the viewer (up the screen).
  const body = ctx.createLinearGradient(0, -88, 0, 46);
  body.addColorStop(0, '#ff7a5c');
  body.addColorStop(0.5, COLORS.planeBody);
  body.addColorStop(1, '#b02a18');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -88);
  ctx.bezierCurveTo(20, -64, 24, -28, 22, 10);
  ctx.lineTo(17, 44);
  ctx.lineTo(-17, 44);
  ctx.lineTo(-22, 10);
  ctx.bezierCurveTo(-24, -28, -20, -64, 0, -88);
  ctx.fill();
  // Canopy glint, seen from behind-above.
  ctx.fillStyle = 'rgba(190,235,255,0.9)';
  ctx.beginPath(); ctx.ellipse(0, -38, 8, 15, 0, 0, Math.PI * 2); ctx.fill();
  // Tail fin + tailplane.
  ctx.fillStyle = COLORS.planeBody;
  ctx.beginPath(); ctx.moveTo(0, 44); ctx.lineTo(-9, 76); ctx.lineTo(9, 76); ctx.closePath(); ctx.fill();
  ctx.fillStyle = COLORS.planeWing;
  ctx.beginPath();
  ctx.moveTo(-58, 52); ctx.lineTo(0, 44); ctx.lineTo(58, 52); ctx.lineTo(52, 63); ctx.lineTo(-52, 63); ctx.closePath(); ctx.fill();
  // Gold cheatline + registration.
  ctx.fillStyle = COLORS.planeAccent;
  ctx.fillRect(-19, -6, 38, 3);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px "Courier New", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('SKY-01', 0, 26);
  // Nav lights: red left, green right, white tail strobe.
  ctx.fillStyle = '#ff2e2e';
  ctx.beginPath(); ctx.arc(-144, 7, blink ? 5 : 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#39ff88';
  ctx.beginPath(); ctx.arc(144, 7, blink ? 5 : 3, 0, Math.PI * 2); ctx.fill();
  if (blink) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 76, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Engine exhaust glow when the throttle is up.
  if (p.throttle > 10 && p.airborne) {
    const eg = ctx.createRadialGradient(0, 48, 2, 0, 48, 26);
    eg.addColorStop(0, `rgba(255,180,80,${0.25 + p.throttle * 0.004})`);
    eg.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(0, 48, 26, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function projectShadow(world) {
  const p = world.plane;
  const hRad = p.heading * DEG;
  const fx = Math.sin(hRad), fz = -Math.cos(hRad);
  const cam = makeCamera(world);
  const pt = project(cam, p.x, 0.2, p.z);
  if (!pt) return null;
  return { x: pt.x, y: pt.y, k: Math.max(0.3, Math.min(1.4, pt.s)) };
}

function drawHUD(ctx, world) {
  const p = world.plane;
  const altFt = Math.round(p.alt * 3.281);
  const spdKt = Math.round(p.speed * 1.944);
  const hdg = Math.round(p.heading);
  const compass = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(hdg / 22.5) % 16];
  const ring = nextRing(world);
  const t = Math.max(0, Math.ceil(world.timeLeft));
  const mm = String(Math.floor(t / 60)), ss = String(t % 60).padStart(2, '0');

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 15px "Courier New", monospace';
  const items = [
    { label: 'ALT', value: `${altFt} FT`, color: COLORS.hudGlow },
    { label: 'SPD', value: `${spdKt} KT`, color: COLORS.hudGlow },
    { label: 'HDG', value: `${String(hdg).padStart(3, '0')}° ${compass}`, color: COLORS.hudGlow },
    { label: 'THR', value: `${Math.round(p.throttle)}%`, color: p.throttle > 85 ? COLORS.hudAmber : COLORS.hudGlow },
    { label: 'RINGS', value: `${world.ringsDone}/8`, color: world.ringsDone >= 8 ? COLORS.hudGlow : COLORS.hudAmber },
    { label: 'SCORE', value: String(world.score), color: '#fff' },
    { label: 'TIME', value: `${mm}:${ss}`, color: t < 30 ? COLORS.hudRed : COLORS.hudGlow },
  ];
  let x = 12;
  for (const it of items) {
    const w = 34 + ctx.measureText(it.value).width + 26;
    ctx.fillStyle = COLORS.panel;
    ctx.strokeStyle = 'rgba(57,255,136,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x, 10, w, 34, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(180,220,200,0.75)';
    ctx.font = '11px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(it.label, x + 10, 27);
    ctx.fillStyle = it.color;
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText(it.value, x + 44, 27);
    x += w + 8;
  }
  // Throttle bar under the HUD.
  const bw = 180;
  ctx.fillStyle = COLORS.panel;
  ctx.beginPath(); ctx.roundRect(12, 50, bw, 10, 5); ctx.fill();
  ctx.fillStyle = p.throttle > 85 ? COLORS.hudAmber : COLORS.hudGlow;
  ctx.beginPath(); ctx.roundRect(12, 50, (bw * p.throttle) / 100, 10, 5); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,200,0.75)';
  ctx.font = '11px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('THROTTLE', 198, 55);

  // Next-ring guidance: distance + an edge arrow when it is off-screen.
  if (ring && world.state === 'playing') {
    const d = ringDistance(world);
    const cam = makeCamera(world);
    const rp = project(cam, ring.x, ring.alt, ring.z);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'center';
    const label = `◈ NEXT RING ${world.ringsDone + 1} — ${(d / 1000).toFixed(1)} km`;
    if (rp && rp.x > 60 && rp.x < VIEW.w - 60 && rp.y > 90 && rp.y < 560) {
      ctx.fillText(label, rp.x, Math.max(64, rp.y - 42));
    } else {
      // Point at the ring from the screen edge.
      const ang = rp ? Math.atan2(rp.y - 300, rp.x - CX) : 0;
      const ax = CX + Math.cos(ang) * 420;
      const ay = 300 + Math.sin(ang) * 200;
      ctx.save();
      ctx.translate(Math.max(90, Math.min(VIEW.w - 90, ax)), Math.max(80, Math.min(540, ay)));
      ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillText(label, CX, 66);
    }
  }
  ctx.restore();
}

// Lit instrument panel along the bottom: artificial horizon, altimeter and
// speed tapes, compass strip, vertical-speed needle.
function drawInstruments(ctx, world) {
  const p = world.plane;
  const y0 = 596, h = 112;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 18, 28, 0.92)';
  ctx.fillRect(0, y0, VIEW.w, h);
  ctx.strokeStyle = 'rgba(57,255,136,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, y0 + 0.5); ctx.lineTo(VIEW.w, y0 + 0.5); ctx.stroke();

  const glow = (color) => { ctx.shadowColor = color; ctx.shadowBlur = 8; };
  const unglow = () => { ctx.shadowBlur = 0; };

  // --- Artificial horizon ---
  const ahX = 120, ahY = y0 + 56, ahR = 44;
  ctx.save();
  ctx.beginPath(); ctx.arc(ahX, ahY, ahR, 0, Math.PI * 2); ctx.clip();
  ctx.translate(ahX, ahY);
  ctx.rotate(-p.roll * DEG);
  const pitchOff = Math.max(-ahR, Math.min(ahR, p.pitch * 1.6));
  ctx.fillStyle = '#3f8fd2'; ctx.fillRect(-ahR, -ahR - pitchOff, ahR * 2, ahR + pitchOff);
  ctx.fillStyle = '#7a5a34'; ctx.fillRect(-ahR, pitchOff, ahR * 2, ahR);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-ahR, pitchOff); ctx.lineTo(ahR, pitchOff); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = COLORS.panelEdge; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(ahX, ahY, ahR, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.moveTo(ahX - 22, ahY); ctx.lineTo(ahX - 6, ahY); ctx.lineTo(ahX - 6, ahY + 3); ctx.lineTo(ahX + 6, ahY + 3); ctx.lineTo(ahX + 6, ahY); ctx.lineTo(ahX + 22, ahY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,200,0.8)';
  ctx.font = '11px "Courier New", monospace'; ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', ahX, y0 + h - 8);

  // --- Altimeter tape ---
  tape(ctx, 300, y0 + 12, 150, 88, 'ALT FT', Math.round(p.alt * 3.281), 500, COLORS.hudGlow);
  // --- Speed tape ---
  tape(ctx, 480, y0 + 12, 150, 88, 'SPD KT', Math.round(p.speed * 1.944), 40, COLORS.hudGlow);
  // --- Compass strip ---
  ctx.save();
  ctx.fillStyle = COLORS.panel;
  ctx.beginPath(); ctx.roundRect(660, y0 + 12, 300, 88, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(57,255,136,0.35)'; ctx.stroke();
  ctx.beginPath(); ctx.rect(660, y0 + 12, 300, 88); ctx.clip();
  const hdg = p.heading;
  for (let d = -90; d <= 90; d += 15) {
    const a = (Math.round(hdg + d) + 360) % 360;
    const x = 810 + d * 1.5;
    const major = a % 90 === 0;
    ctx.strokeStyle = major ? COLORS.hudGlow : 'rgba(180,220,200,0.6)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(x, y0 + 44); ctx.lineTo(x, y0 + (major ? 62 : 56)); ctx.stroke();
    if (major) {
      ctx.fillStyle = COLORS.hudGlow; glow(COLORS.hudGlow);
      ctx.font = 'bold 13px "Courier New", monospace'; ctx.textAlign = 'center';
      ctx.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[a], x, y0 + 34);
      unglow();
    }
  }
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.moveTo(810, y0 + 66); ctx.lineTo(802, y0 + 76); ctx.lineTo(818, y0 + 76); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,200,0.8)';
  ctx.font = '11px "Courier New", monospace'; ctx.textAlign = 'center';
  ctx.fillText('HEADING', 810, y0 + h - 8);
  ctx.restore();

  // --- Vertical speed ---
  const vs = Math.round(p.vspeed * 3.281 * 60); // ft/min
  ctx.save();
  ctx.fillStyle = COLORS.panel;
  ctx.beginPath(); ctx.roundRect(990, y0 + 12, 130, 88, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(57,255,136,0.35)'; ctx.stroke();
  ctx.fillStyle = vs >= 0 ? COLORS.hudGlow : COLORS.hudAmber;
  glow(vs >= 0 ? COLORS.hudGlow : COLORS.hudAmber);
  ctx.font = 'bold 20px "Courier New", monospace'; ctx.textAlign = 'center';
  ctx.fillText((vs >= 0 ? '+' : '') + vs, 1055, y0 + 52);
  unglow();
  ctx.fillStyle = 'rgba(180,220,200,0.8)';
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText('V/S FT/MIN', 1055, y0 + 76);
  ctx.fillText('CLIMB / SINK', 1055, y0 + 90);
  ctx.restore();

  // --- Flaps/gear state light ---
  ctx.save();
  const gear = p.onGround ? 'ON GROUND' : 'AIRBORNE';
  ctx.fillStyle = COLORS.panel;
  ctx.beginPath(); ctx.roundRect(1150, y0 + 12, 118, 88, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(57,255,136,0.35)'; ctx.stroke();
  ctx.fillStyle = p.airborne ? COLORS.hudGlow : COLORS.hudAmber;
  glow(p.airborne ? COLORS.hudGlow : COLORS.hudAmber);
  ctx.beginPath(); ctx.arc(1209, y0 + 42, 9, 0, Math.PI * 2); ctx.fill();
  unglow();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px "Courier New", monospace'; ctx.textAlign = 'center';
  ctx.fillText(gear, 1209, y0 + 70);
  ctx.fillStyle = 'rgba(180,220,200,0.8)';
  ctx.font = '11px "Courier New", monospace';
  ctx.fillText('SKY-01', 1209, y0 + 90);
  ctx.restore();
  ctx.restore();
}

function tape(ctx, x, y, w, h, label, value, step, color) {
  ctx.save();
  ctx.fillStyle = COLORS.panel;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(57,255,136,0.35)'; ctx.stroke();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const centre = value;
  const pxPerUnit = h / (step * 2.4);
  const base = Math.floor(centre / step) * step;
  for (let v = base - step * 2; v <= base + step * 2; v += step) {
    const yy = y + h / 2 + (centre - v) * pxPerUnit;
    if (yy < y + 14 || yy > y + h - 6) continue;
    ctx.strokeStyle = 'rgba(180,220,200,0.6)';
    ctx.beginPath(); ctx.moveTo(x + 8, yy); ctx.lineTo(x + 20, yy); ctx.stroke();
    ctx.fillStyle = 'rgba(180,220,200,0.85)';
    ctx.font = '11px "Courier New", monospace'; ctx.textAlign = 'left';
    ctx.fillText(String(v), x + 24, yy + 4);
  }
  ctx.fillStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.font = 'bold 22px "Courier New", monospace'; ctx.textAlign = 'right';
  ctx.fillText(String(value), x + w - 10, y + h / 2 + 8);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(180,220,200,0.8)';
  ctx.font = '11px "Courier New", monospace'; ctx.textAlign = 'left';
  ctx.fillText(label, x + 10, y + 14);
  ctx.restore();
}

function drawPopups(ctx, world) {
  ctx.save();
  ctx.textAlign = 'center';
  let y = 150;
  for (const pop of world.popups) {
    const a = Math.min(1, pop.t / 0.6);
    ctx.globalAlpha = a;
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillStyle = pop.color;
    ctx.shadowColor = pop.color; ctx.shadowBlur = 12;
    ctx.fillText(pop.text, CX, y);
    ctx.shadowBlur = 0;
    y += 34;
  }
  ctx.restore();
}

function overlay(ctx, lines, accent) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 14, 22, 0.72)';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.textAlign = 'center';
  let y = 150;
  for (const line of lines) {
    ctx.fillStyle = line.color || '#fff';
    ctx.font = line.font || 'bold 20px "Courier New", monospace';
    if (line.glow) { ctx.shadowColor = line.color || '#fff'; ctx.shadowBlur = 14; }
    ctx.fillText(line.text, CX, y);
    ctx.shadowBlur = 0;
    y += line.gap || 36;
  }
  ctx.restore();
}

export function render(ctx, world) {
  const cam = makeCamera(world);
  drawSky(ctx, cam, world);
  drawGround(ctx, cam, world);
  drawRings(ctx, cam, world);
  drawPlane(ctx, world); // the courier, in frame (parked on the title screen)
  drawHUD(ctx, world);
  drawInstruments(ctx, world);
  drawPopups(ctx, world);

  if (world.flashT > 0) {
    ctx.fillStyle = `rgba(255,209,102,${world.flashT * 0.8})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  if (world.messageT > 0 && world.state === 'playing') {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 19px "Courier New", monospace';
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
    ctx.fillText(world.message, CX, 560);
    ctx.restore();
  }

  if (world.state === 'title') {
    overlay(ctx, [
      { text: '✈ SKYLINE COURIER', font: 'bold 54px "Courier New", monospace', color: '#ffd166', glow: true, gap: 66 },
      { text: '— RING RUN —', font: 'bold 24px "Courier New", monospace', color: '#39ff88', gap: 44 },
      { text: 'Take off from runway 36, fly all 8 gold rings over the valley,', font: '18px "Courier New", monospace', gap: 28 },
      { text: 'then land back on the runway before the 5-minute clock runs out.', font: '18px "Courier New", monospace', gap: 40 },
      { text: 'W / S — throttle    ↑ / ↓ — pitch    ← / → — bank & turn', font: 'bold 17px "Courier New", monospace', color: '#e8f4ff', gap: 28 },
      { text: 'Mouse: hold + drag to steer    Space — brakes    R — restart', font: '17px "Courier New", monospace', color: '#e8f4ff', gap: 44 },
      { text: 'Ring +100 pts  •  Landing +200  •  Best score: ' + world.best, font: 'bold 17px "Courier New", monospace', color: '#39ff88', gap: 52 },
      { text: '▶  PRESS ENTER OR CLICK TO FLY  ◀', font: 'bold 22px "Courier New", monospace', color: '#ffd166', glow: true },
    ]);
  }

  if (world.state === 'crashed') {
    overlay(ctx, [
      { text: '💥 CRASHED', font: 'bold 48px "Courier New", monospace', color: '#ff5964', glow: true, gap: 60 },
      { text: world.crashReason || 'The courier is down.', font: '19px "Courier New", monospace', gap: 40 },
      { text: `Rings ${world.ringsDone}/8   •   Score ${world.score}   •   Best ${world.best}`, font: 'bold 20px "Courier New", monospace', color: '#39ff88', gap: 52 },
      { text: 'PRESS R OR ENTER TO FLY AGAIN', font: 'bold 20px "Courier New", monospace', color: '#ffd166', glow: true },
    ]);
  }

  if (world.state === 'landed') {
    const win = world.result === 'win';
    overlay(ctx, [
      { text: win ? '🏆 SORTIE COMPLETE!' : '🛬 LANDED', font: 'bold 48px "Courier New", monospace', color: win ? '#ffd166' : '#39ff88', glow: true, gap: 60 },
      { text: win ? 'All 8 rings + a safe landing on runway 36.' : (world.crashReason || `Landed safely — ${world.ringsDone}/8 rings.`), font: '19px "Courier New", monospace', gap: 40 },
      { text: `Score ${world.score}   •   Best ${world.best}   •   Best combo x${world.bestCombo}`, font: 'bold 20px "Courier New", monospace', color: '#39ff88', gap: 52 },
      { text: 'PRESS R OR ENTER TO FLY AGAIN', font: 'bold 20px "Courier New", monospace', color: '#ffd166', glow: true },
    ]);
  }

  if (world.state === 'timeup') {
    overlay(ctx, [
      { text: '⏱ OUT OF TIME', font: 'bold 48px "Courier New", monospace', color: '#ffb703', glow: true, gap: 60 },
      { text: 'The 5-minute clock ran out over the valley.', font: '19px "Courier New", monospace', gap: 40 },
      { text: `Rings ${world.ringsDone}/8   •   Score ${world.score}   •   Best ${world.best}`, font: 'bold 20px "Courier New", monospace', color: '#39ff88', gap: 52 },
      { text: 'PRESS R OR ENTER TO FLY AGAIN', font: 'bold 20px "Courier New", monospace', color: '#ffd166', glow: true },
    ]);
  }
}
