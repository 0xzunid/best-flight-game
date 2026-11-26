// Skyline Courier — Ring Run: tuning, course, terrain palette.
// A small prop courier plane takes off from runway 36, flies a loop course
// through 8 glowing rings over farmland, river and town, then lands back
// on the runway. All distances in metres, speeds in m/s, angles in degrees.
export const VIEW = { w: 1280, h: 720 };
export const FLIGHT_SECONDS = 300; // 5-minute sortie
export const RING_POINTS = 100;
export const LANDING_BONUS = 200;
export const TIME_BONUS_PER_SECOND = 2;
export const RING_RADIUS = 26;
export const TAKEOFF_SPEED = 55; // m/s — rotate speed
export const STALL_SPEED = 34; // m/s — below this the nose drops
export const MAX_SPEED = 125;
export const CRUISE_SPEED = 82;
export const MAX_ALT = 900;

export const COLORS = {
  skyTop: '#2f6fd0', skyMid: '#7db4e8', skyLow: '#cfe8f7',
  sun: '#fff3b0', cloud: 'rgba(255,255,255,0.92)',
  groundNear: '#5d9b4a', groundFar: '#7fae62',
  field: ['#6fae4e', '#8fbf5a', '#c2a95c', '#a8c46a', '#5d9b4a', '#d9c06a', '#7fb069'],
  river: '#4f9fd8', road: '#5a5a5e', roadLine: '#f5f0dc',
  runway: '#3c3f45', runwayLine: '#f8f8f8', runwayEdge: '#ffd166',
  townRoof: ['#b0563a', '#7a6a58', '#96503f', '#5e7a8c', '#a8763e'],
  tree: '#2f6b2f', treeLight: '#4c8a3f',
  ringNext: '#ffd166', ringDone: '#2ec4b6', ringTodo: '#e8f4ff',
  planeBody: '#e8452c', planeWing: '#f4f1e8', planeAccent: '#ffd166',
  hud: '#0d1b2a', hudGlow: '#39ff88', hudAmber: '#ffb703', hudRed: '#ff5964',
  panel: 'rgba(10, 22, 34, 0.88)', panelEdge: '#39ff88',
};

// The ring course: a loop out over the river valley and back to the runway.
// Each ring: x (east), alt (m), z (north is negative), and the course
// direction the ring faces is computed from the previous ring.
export const RINGS = [
  { x: 0,     alt: 180, z: -1400 },
  { x: 750,   alt: 260, z: -2500 },
  { x: 1700,  alt: 320, z: -1900 },
  { x: 2100,  alt: 280, z: -500 },
  { x: 1500,  alt: 220, z: 900 },
  { x: 500,   alt: 300, z: 1500 },
  { x: -700,  alt: 340, z: 1100 },
  { x: -200,  alt: 200, z: -300 },
];

// Runway 36: along north (heading 0), centred on the origin.
export const RUNWAY = { x: 0, z: 0, length: 1200, width: 42, heading: 0 };

// Town centre (buildings + roads) and river control points.
export const TOWN = { x: 650, z: 700, radius: 420 };
export const RIVER_POINTS = [
  [-2900, 2900], [-2200, 1900], [-1500, 900], [-900, -200],
  [-300, -1300], [400, -2300], [1300, -2900], [2300, -3300],
];
export const ROAD_POINTS = [
  [0, 2400], [0, 1200], [120, 900], [650, 700], [1500, 500], [2600, 300],
];
