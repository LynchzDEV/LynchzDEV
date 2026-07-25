export const PLATE = { width: 1000, height: 600 };

export const CAMERA = {
  fov: 40,
  position: [0.5, 1.72, 7.6],
  target: [0.05, 1.3, 0.2],
  near: 0.1,
  far: 60,
};

export const TV = {
  frontZ: 1.2,
  depth: 1.15,
  bodyWidth: 1.94,
  bodyHeight: 1.5,
  centerX: 0.02,
  centerY: 1.36,
};

export const SCREEN_QUAD = {
  center: [-0.1, 1.4, TV.frontZ + 0.012],
  halfWidth: 0.7,
  halfHeight: 0.53,
};

export const GIRL_QUAD = {
  center: [-1.72, 0.62, 2.55],
  halfWidth: 0.82,
  halfHeight: 0.476,
};

export const WINDOW_QUAD = {
  center: [-2.74, 2.1, -1.44],
  halfWidth: 0.94,
  halfHeight: 0.78,
};

export function paletteFor(phase, mood) {
  const base = {
    night: {
      rug: "#33293c",
      ambient: "#2a3352",
      ambientIntensity: 0.55,
      keyColor: "#ffb85c",
      keyIntensity: 2.6,
      keyPosition: [3.15, 2.35, 1.6],
      skyTop: "#0b1226",
      skyBottom: "#22315c",
      sunColor: "#cfe0ff",
      sunIntensity: 0.35,
      wall: "#2b3040",
      floor: "#1d212c",
      fill: "#3a4a78",
      fillIntensity: 0.4,
      exposure: 1.08,
    },
    dawn: {
      rug: "#6a5560",
      ambient: "#5b6a8c",
      ambientIntensity: 0.8,
      keyColor: "#ffd2a1",
      keyIntensity: 1.5,
      keyPosition: [-3.4, 2.6, -0.6],
      skyTop: "#4a6a9e",
      skyBottom: "#e8b98c",
      sunColor: "#ffdcae",
      sunIntensity: 1.5,
      wall: "#5f6272",
      floor: "#4a4550",
      fill: "#8fa8d0",
      fillIntensity: 0.6,
      exposure: 1.0,
    },
    day: {
      rug: "#a3765c",
      ambient: "#9fb0c8",
      ambientIntensity: 1.15,
      keyColor: "#fff3d8",
      keyIntensity: 2.1,
      keyPosition: [-3.6, 3.1, -0.4],
      skyTop: "#6f9ed0",
      skyBottom: "#cfe2f2",
      sunColor: "#fff6e2",
      sunIntensity: 2.4,
      wall: "#b4a58c",
      floor: "#8f7a5c",
      fill: "#cfe0f4",
      fillIntensity: 0.75,
      exposure: 1.0,
    },
    golden: {
      rug: "#9a6a52",
      ambient: "#8a7392",
      ambientIntensity: 0.95,
      keyColor: "#ffb066",
      keyIntensity: 2.9,
      keyPosition: [-3.5, 2.15, -0.5],
      skyTop: "#7a86b8",
      skyBottom: "#f5a35c",
      sunColor: "#ffb570",
      sunIntensity: 2.8,
      wall: "#b09070",
      floor: "#8a6a4c",
      fill: "#ffc38a",
      fillIntensity: 0.7,
      exposure: 1.04,
    },
  };
  const palette = { ...base[phase] || base.day };
  palette.accent = mood.accent;
  palette.neon = mood.neon;
  palette.glow = mood.glow;
  return palette;
}

export function projectPoint(point, camera, plate) {
  const [px, py, pz] = point;
  const [cx, cy, cz] = camera.position;
  const [tx, ty, tz] = camera.target;

  const forward = normalize([tx - cx, ty - cy, tz - cz]);
  const worldUp = [0, 1, 0];
  const right = normalize(cross(forward, worldUp));
  const up = cross(right, forward);

  const rel = [px - cx, py - cy, pz - cz];
  const viewX = dot(rel, right);
  const viewY = dot(rel, up);
  const viewZ = dot(rel, forward);

  const aspect = plate.width / plate.height;
  const halfHeight = Math.tan((camera.fov * Math.PI) / 360);
  const halfWidth = halfHeight * aspect;

  const ndcX = viewX / (viewZ * halfWidth);
  const ndcY = viewY / (viewZ * halfHeight);

  return {
    x: (ndcX * 0.5 + 0.5) * plate.width,
    y: (0.5 - ndcY * 0.5) * plate.height,
  };
}

export function projectQuad(quad, camera = CAMERA, plate = PLATE) {
  const [cx, cy, cz] = quad.center;
  const corners = [
    [cx - quad.halfWidth, cy + quad.halfHeight, cz],
    [cx + quad.halfWidth, cy + quad.halfHeight, cz],
    [cx + quad.halfWidth, cy - quad.halfHeight, cz],
    [cx - quad.halfWidth, cy - quad.halfHeight, cz],
  ].map((corner) => projectPoint(corner, camera, plate));

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);

  return {
    corners,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}
