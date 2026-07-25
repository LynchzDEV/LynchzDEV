import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  CAMERA,
  GIRL_QUAD,
  PLATE,
  SCREEN_QUAD,
  TV,
  WINDOW_QUAD,
  paletteFor,
} from "./scene-def.mjs";

const WOOD_DARK = "#3a2b1f";
const WOOD_MID = "#5a4231";
const METAL = "#8e8f96";

export function buildRoom(params) {
  const palette = paletteFor(params.phase, params.mood);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.wall).multiplyScalar(0.35);

  const camera = new THREE.PerspectiveCamera(
    CAMERA.fov,
    PLATE.width / PLATE.height,
    CAMERA.near,
    CAMERA.far
  );
  camera.position.set(...CAMERA.position);
  camera.lookAt(...CAMERA.target);

  addShell(scene, palette);
  addWindow(scene, palette, params);
  addCabinet(scene, palette);
  addTelevision(scene, palette, params);
  addShelves(scene, palette, params);
  addLamp(scene, palette, params);
  addPlant(scene, palette, params);
  addRug(scene, palette);
  addNeon(scene, palette, params);
  addDesk(scene, palette, params);
  addClock(scene, palette, params);
  addGirlBillboard(scene, params);
  addLights(scene, palette, params);

  return { scene, camera, palette };
}

function matte(color, roughness = 0.85, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
  });
}

function addShell(scene, palette) {
  const wall = matte(palette.wall, 0.95);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), wall);
  back.position.set(0, 2.4, -1.6);
  back.receiveShadow = true;
  scene.add(back);

  const sideLeft = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), wall.clone());
  sideLeft.rotation.y = Math.PI / 2;
  sideLeft.position.set(-4.6, 2.4, 2.2);
  sideLeft.receiveShadow = true;
  scene.add(sideLeft);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 12),
    matte(palette.floor, 0.62, 0.05)
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  for (let i = -8; i <= 8; i++) {
    const seam = new THREE.Mesh(
      new THREE.PlaneGeometry(0.02, 12),
      matte("#000000", 1, 0)
    );
    seam.material.opacity = 0.35;
    seam.material.transparent = true;
    seam.rotation.x = -Math.PI / 2;
    seam.position.set(i * 0.62, 0.002, 0);
    scene.add(seam);
  }

  const baseboard = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.16, 0.06),
    matte(palette.wall, 0.7)
  );
  baseboard.position.set(0, 0.08, -1.55);
  scene.add(baseboard);
}

function addWindow(scene, palette, params) {
  const group = new THREE.Group();
  const [wx, wy, wz] = WINDOW_QUAD.center;
  const w = WINDOW_QUAD.halfWidth * 2;
  const h = WINDOW_QUAD.halfHeight * 2;

  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map: skyTexture(palette, params),
      toneMapped: false,
    })
  );
  sky.position.set(0, 0, -0.03);
  group.add(sky);

  const frameMat = matte(WOOD_DARK, 0.8);
  const bar = (sx, sy, px, py) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.1), frameMat);
    mesh.position.set(px, py, 0.02);
    mesh.castShadow = true;
    group.add(mesh);
  };
  bar(w + 0.22, 0.12, 0, h / 2 + 0.06);
  bar(w + 0.22, 0.16, 0, -h / 2 - 0.06);
  bar(0.12, h + 0.16, -w / 2 - 0.05, 0);
  bar(0.12, h + 0.16, w / 2 + 0.05, 0);
  bar(0.07, h, 0, 0);
  bar(w, 0.07, 0, 0);

  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.42, 0.1, 0.26),
    matte(WOOD_MID, 0.75)
  );
  sill.position.set(0, -h / 2 - 0.14, 0.1);
  sill.castShadow = true;
  group.add(sill);

  const curtainMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(params.phase === "night" ? "#332c3e" : "#7d5a54"),
    roughness: 1,
    side: THREE.DoubleSide,
  });
  for (const side of [-1, 1]) {
    const curve = new THREE.Shape();
    curve.moveTo(0, 0);
    curve.lineTo(0.24, 0.05);
    curve.bezierCurveTo(0.15, -h * 0.4, 0.28, -h * 0.7, 0.18, -h - 0.1);
    curve.lineTo(-0.02, -h - 0.1);
    curve.bezierCurveTo(0.06, -h * 0.6, -0.04, -h * 0.3, 0, 0);
    const curtain = new THREE.Mesh(
      new THREE.ExtrudeGeometry(curve, { depth: 0.06, bevelEnabled: false }),
      curtainMat
    );
    curtain.position.set(side * (w / 2 + 0.04), h / 2 + 0.02, 0.12);
    curtain.scale.x = side;
    curtain.castShadow = true;
    group.add(curtain);
  }

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, w + 0.9, 12),
    matte(METAL, 0.4, 0.7)
  );
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, h / 2 + 0.16, 0.14);
  group.add(rod);

  group.position.set(wx, wy, wz);
  scene.add(group);
}

function skyTexture(palette, params) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, palette.skyTop);
  gradient.addColorStop(1, palette.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  if (params.phase === "night") {
    ctx.fillStyle = "#eef2ff";
    for (let i = 0; i < 90; i++) {
      const x = (i * 97) % 512;
      const y = (i * 53) % 300;
      const r = i % 7 === 0 ? 2.2 : 1.1;
      ctx.globalAlpha = 0.35 + ((i * 37) % 60) / 100;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const moonGlow = ctx.createRadialGradient(360, 120, 6, 360, 120, 90);
    moonGlow.addColorStop(0, "rgba(220,232,255,0.85)");
    moonGlow.addColorStop(1, "rgba(220,232,255,0)");
    ctx.fillStyle = moonGlow;
    ctx.fillRect(240, 0, 250, 250);
    ctx.fillStyle = "#eef0e0";
    ctx.beginPath();
    ctx.arc(360, 120, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.skyTop;
    ctx.beginPath();
    ctx.arc(343, 106, 30, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const sunY = params.phase === "golden" ? 330 : 150;
    const sunGlow = ctx.createRadialGradient(330, sunY, 10, 330, sunY, 190);
    sunGlow.addColorStop(0, "rgba(255,240,200,0.95)");
    sunGlow.addColorStop(1, "rgba(255,220,170,0)");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(120, sunY - 200, 420, 400);
    ctx.fillStyle = "#fff8e0";
    ctx.beginPath();
    ctx.arc(330, sunY, 38, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#ffffff";
    for (const [cx, cy, rx] of [
      [140, 120, 70],
      [200, 145, 90],
      [400, 96, 60],
    ]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, rx * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const cloudCover = Math.min(100, params.weather?.cloudCover ?? 20) / 100;
  if (cloudCover > 0.45) {
    ctx.globalAlpha = (cloudCover - 0.45) * 0.9;
    ctx.fillStyle = params.phase === "night" ? "#2a3350" : "#8a8f9c";
    ctx.fillRect(0, 0, 512, 512);
    ctx.globalAlpha = 1;
  }

  const skylineColor = params.phase === "night" ? "#0a1020" : "#5d5170";
  ctx.fillStyle = skylineColor;
  let x = 0;
  let i = 0;
  while (x < 512) {
    const w = 34 + ((i * 29) % 46);
    const h = 70 + ((i * 61) % 150);
    ctx.fillRect(x, 512 - h, w, h);
    if (params.phase === "night") {
      ctx.fillStyle = "#ffcf6b";
      for (let k = 0; k < 5; k++) {
        if ((i + k) % 3 === 0) continue;
        ctx.globalAlpha = 0.5 + ((i + k) % 4) / 10;
        ctx.fillRect(x + 6 + (k % 2) * 14, 512 - h + 12 + k * 22, 5, 7);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = skylineColor;
    }
    x += w + 6;
    i++;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addCabinet(scene, palette) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.62, 1.0),
    matte(WOOD_MID, 0.62)
  );
  body.position.set(0, 0.34, 0.75);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(2.62, 0.07, 1.1),
    matte(WOOD_DARK, 0.5)
  );
  top.position.set(0, 0.68, 0.75);
  top.castShadow = true;
  group.add(top);

  for (const side of [-0.62, 0.62]) {
    const drawer = new THREE.Mesh(
      new THREE.BoxGeometry(1.06, 0.4, 0.04),
      matte("#2c2119", 0.7)
    );
    drawer.position.set(side, 0.34, 1.27);
    group.add(drawer);
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.42, 10),
      matte("#c9a86a", 0.35, 0.8)
    );
    handle.rotation.z = Math.PI / 2;
    handle.position.set(side, 0.34, 1.31);
    group.add(handle);
  }

  for (const [x, z] of [
    [-1.1, 0.34],
    [1.1, 0.34],
    [-1.1, 1.16],
    [1.1, 1.16],
  ]) {
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.04, 0.06, 8),
      matte("#1a1310", 0.8)
    );
    foot.position.set(x, 0.03, z);
    group.add(foot);
  }

  scene.add(group);
}

function addTelevision(scene, palette, params) {
  const group = new THREE.Group();
  const [sx, sy, sz] = SCREEN_QUAD.center;
  const frontZ = TV.frontZ;

  const shell = new THREE.Mesh(
    roundedBox(TV.bodyWidth, TV.bodyHeight, TV.depth, 0.08),
    matte(WOOD_MID, 0.55, 0.03)
  );
  shell.position.set(TV.centerX, TV.centerY, frontZ - TV.depth / 2);
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  const bezel = new THREE.Mesh(
    roundedBox(SCREEN_QUAD.halfWidth * 2 + 0.19, SCREEN_QUAD.halfHeight * 2 + 0.19, 0.06, 0.06),
    matte("#191410", 0.6)
  );
  bezel.position.set(sx, sy, frontZ - 0.01);
  group.add(bezel);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN_QUAD.halfWidth * 2, SCREEN_QUAD.halfHeight * 2, 12, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color("#05080a") })
  );
  bulgeGeometry(glass.geometry, 0.04);
  glass.position.set(sx, sy, frontZ + 0.008);
  group.add(glass);

  const grillePanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 1.04, 0.03),
    matte("#221a14", 0.9)
  );
  grillePanel.position.set(sx + 0.87, sy + 0.04, frontZ);
  group.add(grillePanel);
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 3; col++) {
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(0.019, 8),
        matte("#0b0806", 1)
      );
      hole.position.set(sx + 0.8 + col * 0.07, sy + 0.4 - row * 0.14, frontZ + 0.02);
      group.add(hole);
    }
  }

  const dial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.06, 20),
    matte("#2c2219", 0.45, 0.3)
  );
  dial.rotation.x = Math.PI / 2;
  dial.position.set(sx + 0.87, sy - 0.44, frontZ + 0.02);
  group.add(dial);
  const notch = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.062, 0.018),
    matte("#d8b878", 0.4, 0.5)
  );
  notch.position.set(sx + 0.87, sy - 0.39, frontZ + 0.05);
  group.add(notch);

  const rec = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false })
  );
  rec.position.set(sx + 0.87, sy + 0.62, frontZ + 0.03);
  group.add(rec);

  for (const side of [-1, 1]) {
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.007, 1.35, 8),
      matte(METAL, 0.3, 0.85)
    );
    antenna.position.set(
      TV.centerX + side * 0.5,
      TV.centerY + TV.bodyHeight / 2 + 0.52,
      frontZ - TV.depth + 0.15
    );
    antenna.rotation.z = side > 0 ? -0.48 : 0.48;
    group.add(antenna);
    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 12, 12),
      matte("#d6d6d6", 0.25, 0.9)
    );
    tip.position.set(
      TV.centerX + side * 0.81,
      TV.centerY + TV.bodyHeight / 2 + 1.11,
      frontZ - TV.depth + 0.15
    );
    group.add(tip);
  }

  scene.add(group);
}

function bulgeGeometry(geometry, amount) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const falloff = Math.cos((x / 0.75) * 0.9) * Math.cos((y / 0.6) * 0.9);
    position.setZ(i, Math.max(0, falloff) * amount);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

function addShelves(scene, palette, params) {
  const vhsShelf = shelfPlank(2.3, matte(WOOD_MID, 0.7));
  vhsShelf.position.set(-2.62, 1.16, -1.34);
  scene.add(vhsShelf);

  const tapeColors = ["#3d5a80", "#8d5524", "#5a3d6b", "#3d6b4f"];
  (params.recent || []).slice(0, 4).forEach((_, index) => {
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.52, 0.34),
      matte(tapeColors[index % 4], 0.72)
    );
    const lean = index === 2 ? 0.16 : 0;
    tape.position.set(-3.36 + index * 0.25, 1.47, -1.28);
    tape.rotation.z = lean;
    tape.castShadow = true;
    scene.add(tape);

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.34),
      matte("#efe7d4", 0.9)
    );
    label.position.set(-3.36 + index * 0.25, 1.5, -1.108);
    label.rotation.z = lean;
    scene.add(label);
  });

  const langShelf = shelfPlank(2.5, matte(WOOD_MID, 0.7));
  langShelf.position.set(2.28, 2.42, -1.34);
  scene.add(langShelf);

  (params.languages || []).slice(0, 4).forEach((_, index) => {
    const cassette = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.31, 0.13),
      matte(["#7a4a52", "#4a5a7a", "#5a7a52", "#7a6a42"][index % 4], 0.55)
    );
    cassette.position.set(1.42 + index * 0.56, 2.61, -1.24);
    cassette.rotation.x = -0.16;
    cassette.castShadow = true;
    scene.add(cassette);
    const sticker = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.1),
      matte("#d8cdb4", 0.9)
    );
    sticker.position.set(1.42 + index * 0.56, 2.632, -1.166);
    sticker.rotation.x = -0.16;
    scene.add(sticker);
    const window_ = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.07),
      matte("#15131a", 0.5)
    );
    window_.position.set(1.42 + index * 0.56, 2.567, -1.176);
    window_.rotation.x = -0.16;
    scene.add(window_);
  });
}

function shelfPlank(width, material) {
  const group = new THREE.Group();
  const plank = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, 0.42), material);
  plank.castShadow = true;
  plank.receiveShadow = true;
  group.add(plank);
  for (const side of [-1, 1]) {
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.22, 0.2),
      matte("#241c15", 0.8)
    );
    bracket.position.set(side * (width / 2 - 0.24), -0.14, -0.08);
    group.add(bracket);
  }
  return group;
}

function addLamp(scene, palette, params) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, 2.3, 12),
    matte("#4a4048", 0.4, 0.6)
  );
  pole.position.set(0, 1.15, 0);
  pole.castShadow = true;
  group.add(pole);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.4, 0.06, 24),
    matte("#39323c", 0.45, 0.5)
  );
  base.position.set(0, 0.03, 0);
  base.receiveShadow = true;
  group.add(base);

  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.56, 0.56, 28, 1, true),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(params.phase === "night" ? "#e8c890" : "#d8c9a8"),
      roughness: 0.95,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(params.phase === "night" ? "#8a5f22" : "#000000"),
      emissiveIntensity: params.phase === "night" ? 0.55 : 0,
    })
  );
  shade.position.set(0, 2.4, 0);
  group.add(shade);

  const bulbGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 24),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(params.phase === "night" ? "#ffd9a0" : "#efe0bc"),
      toneMapped: false,
      transparent: true,
      opacity: params.phase === "night" ? 0.55 : 0.35,
    })
  );
  bulbGlow.rotation.x = -Math.PI / 2;
  bulbGlow.position.set(0, 2.13, 0);
  group.add(bulbGlow);

  group.position.set(3.15, 0, 0.6);
  scene.add(group);
}

function addPlant(scene, palette, params) {
  const group = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.22, 0.44, 20),
    matte(params.phase === "night" ? "#5a4038" : "#a8683f", 0.8)
  );
  pot.position.set(0, 0.22, 0);
  pot.castShadow = true;
  group.add(pot);
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.33, 0.07, 20),
    matte(params.phase === "night" ? "#6a4c42" : "#bd7749", 0.75)
  );
  rim.position.set(0, 0.44, 0);
  group.add(rim);

  const leafMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(params.phase === "night" ? "#2f4638" : "#4e6b44"),
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const leafCount = 5 + (params.streakTier || 0);
  for (let i = 0; i < leafCount; i++) {
    const angle = (i / leafCount) * Math.PI * 2 + 0.4;
    const height = 0.62 + (i % 3) * 0.28;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.026, height, 8),
      leafMat
    );
    stem.position.set(
      Math.cos(angle) * 0.12,
      0.44 + height / 2,
      Math.sin(angle) * 0.12
    );
    stem.rotation.z = Math.cos(angle) * 0.34;
    stem.rotation.x = -Math.sin(angle) * 0.34;
    group.add(stem);

    const blade = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), leafMat);
    blade.scale.set(1, 0.62, 1);
    blade.position.set(
      Math.cos(angle) * (0.12 + height * 0.34),
      0.44 + height + 0.08,
      Math.sin(angle) * (0.12 + height * 0.34)
    );
    blade.rotation.set(-0.9, angle, 0.2);
    blade.castShadow = true;
    group.add(blade);
  }

  group.position.set(2.42, 0, 2.15);
  scene.add(group);
}

function addRug(scene, palette) {
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 48),
    new THREE.MeshStandardMaterial({ map: rugTexture(palette), roughness: 1 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.scale.set(1, 0.62, 1);
  rug.position.set(-0.1, 0.006, 2.5);
  rug.receiveShadow = true;
  scene.add(rug);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.05, 2.2, 48),
    matte("#000000", 1)
  );
  ring.material.transparent = true;
  ring.material.opacity = 0.22;
  ring.rotation.x = -Math.PI / 2;
  ring.scale.set(1, 0.62, 1);
  ring.position.set(-0.1, 0.008, 2.5);
  scene.add(ring);
}

function rugTexture(palette) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = palette.rug;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 256; i += 7) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i + 3);
    ctx.stroke();
  }
  ctx.strokeStyle = palette.accent;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 6;
  ctx.setLineDash([18, 13]);
  ctx.beginPath();
  ctx.arc(128, 128, 96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 128, 74, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addNeon(scene, palette, params) {
  const group = new THREE.Group();
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.66, 0.05),
    matte("#0d0a12", 0.8)
  );
  group.add(backing);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.52, 0.56),
    new THREE.MeshBasicMaterial({
      map: neonTexture(params.mood),
      transparent: true,
      toneMapped: false,
    })
  );
  sign.position.z = 0.04;
  group.add(sign);

  group.position.set(2.02, 1.58, -1.5);
  group.rotation.y = -0.05;
  scene.add(group);
}

function neonTexture(mood) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 190;
  const ctx = canvas.getContext("2d");

  ctx.strokeStyle = mood.neon;
  ctx.shadowColor = mood.neon;
  ctx.lineJoin = "round";

  ctx.shadowBlur = 26;
  ctx.lineWidth = 7;
  roundedRectPath(ctx, 14, 14, 484, 162, 22);
  ctx.stroke();
  ctx.stroke();

  ctx.fillStyle = mood.neon;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 22;
  ctx.font = "bold 62px 'Courier New', monospace";
  ctx.fillText(`\u266A ${mood.name}`, 256, 76);
  ctx.shadowBlur = 12;
  ctx.font = "26px 'Courier New', monospace";
  ctx.fillText("NOW PLAYING", 256, 132);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function addDesk(scene, palette, params) {
  const cups = Math.max(0, Math.min(4, params.coffeeCups || 0));
  for (let i = 0; i < cups; i++) {
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.072, 0.15, 16),
      matte(i % 2 ? "#d8cfc0" : "#c2b6a4", 0.7)
    );
    mug.position.set(-0.92 + i * 0.3, 0.78, 1.0 + (i % 2) * 0.14);
    mug.castShadow = true;
    scene.add(mug);
    const coffee = new THREE.Mesh(
      new THREE.CircleGeometry(0.082, 16),
      matte("#3a2317", 0.5)
    );
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.set(-0.92 + i * 0.3, 0.855, 1.0 + (i % 2) * 0.14);
    scene.add(coffee);
  }

  if (params.tiredMode) {
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.28, 18),
      matte("#7fd63a", 0.35, 0.7)
    );
    can.position.set(0.88, 0.85, 1.05);
    can.castShadow = true;
    scene.add(can);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.077, 0.077, 0.08, 18),
      matte("#1b1b22", 0.4, 0.5)
    );
    band.position.set(0.88, 0.85, 1.05);
    scene.add(band);
  }
}

function addClock(scene, palette, params) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.07, 28),
    matte(WOOD_DARK, 0.6)
  );
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.29, 28),
    matte(params.phase === "night" ? "#d8d2c4" : "#f2ece0", 0.85)
  );
  face.position.z = 0.04;
  group.add(face);

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, i % 3 === 0 ? 0.06 : 0.035, 0.01),
      matte("#2c2620", 0.7)
    );
    tick.position.set(
      Math.sin(angle) * 0.24,
      Math.cos(angle) * 0.24,
      0.05
    );
    tick.rotation.z = -angle;
    group.add(tick);
  }

  const hours = params.clock?.hours ?? 10;
  const minutes = params.clock?.minutes ?? 10;
  const hourAngle = ((hours % 12) + minutes / 60) * (Math.PI / 6);
  const minuteAngle = minutes * (Math.PI / 30);

  const hand = (length, width, angle, color) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, length, 0.012),
      matte(color, 0.5)
    );
    mesh.position.set(
      (Math.sin(angle) * length) / 2,
      (Math.cos(angle) * length) / 2,
      0.055
    );
    mesh.rotation.z = -angle;
    group.add(mesh);
  };
  hand(0.15, 0.022, hourAngle, "#2c2620");
  hand(0.22, 0.014, minuteAngle, "#2c2620");

  const pin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.03, 10),
    matte("#8a6d3b", 0.4, 0.6)
  );
  pin.rotation.x = Math.PI / 2;
  pin.position.z = 0.065;
  group.add(pin);

  group.position.set(-1.12, 2.56, -1.52);
  scene.add(group);
}

function addGirlBillboard(scene, params) {
  if (!params.girlTexture) return;
  const [gx, gy, gz] = GIRL_QUAD.center;
  const loader = new THREE.TextureLoader();
  const texture = loader.load(params.girlTexture);
  texture.colorSpace = THREE.SRGBColorSpace;

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(GIRL_QUAD.halfWidth * 2, GIRL_QUAD.halfHeight * 2),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    })
  );
  plane.position.set(gx, gy, gz);
  scene.add(plane);

  const contact = new THREE.Mesh(
    new THREE.CircleGeometry(0.86, 28),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.34,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.scale.set(1, 0.42, 1);
  contact.position.set(gx + 0.1, 0.012, gz - 0.1);
  scene.add(contact);
}

function addLights(scene, palette, params) {
  const ambient = new THREE.AmbientLight(
    new THREE.Color(palette.ambient),
    palette.ambientIntensity
  );
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(
    new THREE.Color(palette.fill),
    new THREE.Color(palette.floor),
    palette.fillIntensity
  );
  scene.add(hemi);

  const key = new THREE.PointLight(
    new THREE.Color(palette.keyColor),
    palette.keyIntensity * 3.4,
    14,
    2
  );
  key.position.set(...palette.keyPosition);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0015;
  key.shadow.radius = 4;
  scene.add(key);

  const sun = new THREE.DirectionalLight(
    new THREE.Color(palette.sunColor),
    palette.sunIntensity
  );
  sun.position.set(-6.2, 4.4, -2.4);
  sun.target.position.set(0.4, 0.8, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -7;
  sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7;
  sun.shadow.camera.bottom = -7;
  sun.shadow.bias = -0.0012;
  scene.add(sun);
  scene.add(sun.target);

  const screenLight = new THREE.PointLight(
    new THREE.Color(params.mood.glow),
    params.phase === "night" ? 3.2 : 1.1,
    5.5,
    2
  );
  screenLight.position.set(SCREEN_QUAD.center[0], SCREEN_QUAD.center[1], SCREEN_QUAD.center[2] + 0.7);
  scene.add(screenLight);

  const neonLight = new THREE.PointLight(
    new THREE.Color(params.mood.neon),
    params.phase === "night" ? 1.9 : 0.7,
    4.5,
    2
  );
  neonLight.position.set(2.32, 1.62, -1.0);
  scene.add(neonLight);

  if (params.phase === "night") {
    const moon = new THREE.DirectionalLight(new THREE.Color("#9ec0ff"), 0.5);
    moon.position.set(-5.4, 4.0, -3.0);
    scene.add(moon);
  }
}

function roundedBox(width, height, depth, radius) {
  const shape = new THREE.Shape();
  const w = width / 2 - radius;
  const h = height / 2 - radius;
  shape.moveTo(-w, -height / 2);
  shape.lineTo(w, -height / 2);
  shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -h);
  shape.lineTo(width / 2, h);
  shape.quadraticCurveTo(width / 2, height / 2, w, height / 2);
  shape.lineTo(-w, height / 2);
  shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, h);
  shape.lineTo(-width / 2, -h);
  shape.quadraticCurveTo(-width / 2, -height / 2, -w, -height / 2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: radius * 0.4,
    bevelThickness: radius * 0.4,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

export function createRenderer(canvas, palette) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(PLATE.width, PLATE.height, false);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = palette.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.setSize(PLATE.width, PLATE.height);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(new THREE.Vector2(PLATE.width, PLATE.height), 0.28, 0.55, 0.92)
  );
  composer.addPass(new OutputPass());
  return composer;
}

export function attachEnvironment(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;
}
