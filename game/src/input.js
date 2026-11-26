// Keyboard + mouse state. W/S throttle, arrows pitch/roll, Space brakes,
// R restart, M mute, Enter/click starts. Mouse: hold + drag left/right to
// bank, drag up/down to pitch — the pointer also works on title buttons.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let click = null;
  let mouse = { x: 640, y: 360, down: false, dx: 0, dy: 0 };
  let lastMouse = null;

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseDown(e) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    mouse.x = (e.clientX - r.left) * sx; mouse.y = (e.clientY - r.top) * sy;
    mouse.down = true; lastMouse = { x: mouse.x, y: mouse.y };
    click = { x: mouse.x, y: mouse.y };
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    const x = (e.clientX - r.left) * sx, y = (e.clientY - r.top) * sy;
    if (mouse.down && lastMouse) { mouse.dx += x - lastMouse.x; mouse.dy += y - lastMouse.y; }
    mouse.x = x; mouse.y = y; lastMouse = { x, y };
  }
  function onMouseUp() { mouse.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  return {
    // Held keys: pitch (-1 nose down, +1 nose up), roll (-1 left, +1 right).
    stick() {
      let pitch = 0, roll = 0;
      if (keys.has('ArrowUp')) pitch += 1;
      if (keys.has('ArrowDown')) pitch -= 1;
      if (keys.has('ArrowLeft')) roll -= 1;
      if (keys.has('ArrowRight')) roll += 1;
      return { pitch, roll };
    },
    throttleUp() { return keys.has('KeyW'); },
    throttleDown() { return keys.has('KeyS'); },
    brake() { return keys.has('Space'); },
    wasPressed(...codes) { return codes.some((c) => pressed.has(c)); },
    takeClick() { const c = click; click = null; return c; },
    // Mouse drag deltas since last frame, consumed by the caller.
    takeMouseDrag() { const d = { dx: mouse.dx, dy: mouse.dy, down: mouse.down }; mouse.dx = 0; mouse.dy = 0; return d; },
    endFrame() { pressed.clear(); },
  };
}
