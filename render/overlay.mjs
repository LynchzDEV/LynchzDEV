import { GIRL_QUAD, PLATE, SCREEN_QUAD, WINDOW_QUAD, projectQuad } from "./scene-def.mjs";

export const SCREEN = projectQuad(SCREEN_QUAD);
export const GIRL = projectQuad(GIRL_QUAD);
export const WINDOW = projectQuad(WINDOW_QUAD);

const GIRL_KEYTIMES = "0;0.12;0.24;0.36;1";
const GIRL_FRAME_VALUES = ["1;0;0;0;0", "0;1;0;0;0", "0;0;1;0;0", "0;0;0;1;1"];

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isWideGlyph(codePoint) {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff)
  );
}

export function estimateTextWidth(text, fontSize) {
  let width = 0;
  for (const char of String(text)) {
    width += isWideGlyph(char.codePointAt(0)) ? fontSize : fontSize * 0.6;
  }
  return width;
}

export function truncate(text, max) {
  const chars = Array.from(String(text));
  if (chars.length <= max) return String(text);
  return `${chars.slice(0, Math.max(0, max - 1)).join("")}…`;
}

function screenX(fraction) {
  return SCREEN.x + SCREEN.width * fraction;
}

function screenY(fraction) {
  return SCREEN.y + SCREEN.height * fraction;
}

function marqueeText(text, fontSize, yFraction, fill, clipId, region) {
  const escaped = escapeXml(text);
  const width = estimateTextWidth(text, fontSize);
  const y = screenY(yFraction);
  const areaLeft = screenX(region.from);
  const areaWidth = SCREEN.width * (region.to - region.from);
  if (width <= areaWidth) {
    return `<text x="${(areaLeft + areaWidth / 2).toFixed(1)}" y="${y.toFixed(1)}" font-size="${fontSize}" font-weight="bold" fill="${fill}" text-anchor="middle">${escaped}</text>`;
  }
  const from = areaLeft + areaWidth;
  const duration = Math.max(7, (from - areaLeft + width) / 34).toFixed(1);
  return `<g clip-path="url(#${clipId})">
      <text x="0" y="${y.toFixed(1)}" font-size="${fontSize}" font-weight="bold" fill="${fill}">${escaped}<animateTransform attributeName="transform" type="translate" from="${from.toFixed(0)} 0" to="-${width.toFixed(0)} 0" dur="${duration}s" repeatCount="indefinite"/></text>
    </g>`;
}

function renderAlbumArt(dataUri, x, y, size) {
  if (dataUri) {
    return `<image href="${dataUri}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#artClip)"/>`;
  }
  return `<g clip-path="url(#artClip)">
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" fill="#0a1712"/>
      <text x="${(x + size / 2).toFixed(1)}" y="${(y + size * 0.68).toFixed(1)}" font-size="${(size * 0.5).toFixed(0)}" fill="#2f5d47" text-anchor="middle">&#9834;</text>
    </g>`;
}

function renderEqBars(mood, baseline, height) {
  const delays = [0, -0.2, -0.5, -0.1, -0.7, -0.35, -0.6, -0.15, -0.45];
  const barWidth = SCREEN.width * 0.028;
  const gap = SCREEN.width * 0.014;
  const startX = screenX(0.47);
  return `<g opacity="0.92">${delays
    .map((delay, index) => {
      const x = startX + index * (barWidth + gap);
      return `<rect class="eqbar" x="${x.toFixed(1)}" y="${(baseline - height).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${height.toFixed(1)}" rx="1" fill="${mood.accent}" style="animation-delay:${delay}s"/>`;
    })
    .join("")}</g>`;
}

function renderTransport() {
  const y = screenY(0.84);
  const cx = SCREEN.centerX;
  const step = SCREEN.width * 0.09;
  const size = Math.max(11, SCREEN.width * 0.075);
  return `<g fill="#bafcd4" text-anchor="middle" font-size="${size.toFixed(0)}">
      <text x="${(cx - step).toFixed(1)}" y="${y.toFixed(1)}">&#9665;</text>
      <text x="${cx.toFixed(1)}" y="${y.toFixed(1)}">&#9208;</text>
      <text x="${(cx + step).toFixed(1)}" y="${y.toFixed(1)}">&#9655;</text>
    </g>`;
}

function renderTicker(commits) {
  const entries = commits && commits.length
    ? commits.map((entry) => `${entry.repo.split("/").pop()}: ${entry.message}`)
    : ["NO SIGNAL"];
  const separator = "   +++   ";
  const raw = entries.join(separator) + separator;
  const fontSize = Math.max(7, SCREEN.width * 0.045);
  const width = Math.max(SCREEN.width, estimateTextWidth(raw, fontSize));
  const duration = Math.max(14, (width * 2) / 34).toFixed(0);
  const bandTop = screenY(0.87);
  const bandHeight = SCREEN.height * 0.11;
  const bandLeft = screenX(0.03);
  const bandWidth = SCREEN.width * 0.94;
  return `<g clip-path="url(#tickerClip)">
      <rect x="${bandLeft.toFixed(1)}" y="${bandTop.toFixed(1)}" width="${bandWidth.toFixed(1)}" height="${bandHeight.toFixed(1)}" fill="#020806" fill-opacity="0.82"/>
      <text x="0" y="${(bandTop + bandHeight * 0.7).toFixed(1)}" font-size="${fontSize.toFixed(1)}" fill="#7dffb0">${escapeXml(raw)}${escapeXml(raw)}<animateTransform attributeName="transform" type="translate" from="${(bandLeft + bandWidth).toFixed(0)} 0" to="${(bandLeft - width).toFixed(0)} 0" dur="${duration}s" begin="-${Math.round(duration / 3)}s" repeatCount="indefinite"/></text>
    </g>`;
}

function channelHeader(channel) {
  return `<text x="${screenX(0.05).toFixed(1)}" y="${screenY(0.11).toFixed(1)}" font-size="${Math.max(7, SCREEN.width * 0.05).toFixed(1)}" fill="#66e0a0" fill-opacity="0.9" letter-spacing="1">${escapeXml(channel.id)} &#9834; ${escapeXml(channel.label)}</text>`;
}

function channelNowPlaying(scene) {
  const artSize = SCREEN.height * 0.46;
  const artX = screenX(0.06);
  const artY = screenY(0.2);
  const textRegion = { from: 0.44, to: 0.98 };
  const textCenter = screenX((textRegion.from + textRegion.to) / 2);
  return `${renderAlbumArt(scene.albumDataUri, artX, artY, artSize)}
    ${marqueeText(scene.track, Math.max(9, SCREEN.width * 0.062), 0.3, "#d8ffe6", "trackClip", textRegion)}
    <text x="${textCenter.toFixed(1)}" y="${screenY(0.42).toFixed(1)}" font-size="${Math.max(7, SCREEN.width * 0.05).toFixed(1)}" fill="#7fe0aa" text-anchor="middle">${escapeXml(truncate(scene.artist, 16))}</text>
    ${renderEqBars(scene.mood, screenY(0.72), SCREEN.height * 0.16)}
    ${renderTransport()}`;
}

function channelCommitGraph(scene) {
  const days = (scene.contributions?.days || []).slice(-70);
  if (!days.length) {
    return `<text x="${SCREEN.centerX.toFixed(1)}" y="${screenY(0.5).toFixed(1)}" font-size="${Math.max(9, SCREEN.width * 0.06).toFixed(1)}" fill="#7dffb0" text-anchor="middle">AWAITING SIGNAL</text>`;
  }
  const max = Math.max(1, ...days.map((day) => day.count));
  const columns = 10;
  const rows = 7;
  const cell = Math.min(SCREEN.width * 0.068, SCREEN.height * 0.075);
  const gap = cell * 0.22;
  const gridWidth = columns * (cell + gap);
  const startX = SCREEN.centerX - gridWidth / 2;
  const startY = screenY(0.22);
  const cells = days
    .slice(-columns * rows)
    .map((day, index) => {
      const column = Math.floor(index / rows);
      const row = index % rows;
      const intensity = day.count === 0 ? 0 : 0.28 + (day.count / max) * 0.72;
      const fill = day.count === 0 ? "#123024" : "#7dffb0";
      return `<rect x="${(startX + column * (cell + gap)).toFixed(1)}" y="${(startY + row * (cell + gap)).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" rx="1" fill="${fill}" fill-opacity="${intensity.toFixed(2)}"/>`;
    })
    .join("");
  const total = scene.contributions.totalYear || 0;
  const streak = scene.contributions.streakDays || 0;
  return `${cells}
    <text x="${SCREEN.centerX.toFixed(1)}" y="${screenY(0.83).toFixed(1)}" font-size="${Math.max(8, SCREEN.width * 0.05).toFixed(1)}" fill="#bafcd4" text-anchor="middle">${total} COMMITS &#183; ${streak}d STREAK</text>`;
}

function channelLangStats(scene) {
  const languages = (scene.languages || []).slice(0, 4);
  if (!languages.length) {
    return `<text x="${SCREEN.centerX.toFixed(1)}" y="${screenY(0.5).toFixed(1)}" font-size="${Math.max(9, SCREEN.width * 0.06).toFixed(1)}" fill="#7dffb0" text-anchor="middle">NO DATA</text>`;
  }
  const fontSize = Math.max(8, SCREEN.width * 0.052);
  const barMaxWidth = SCREEN.width * 0.42;
  return languages
    .map((entry, index) => {
      const y = screenY(0.26 + index * 0.16);
      const width = Math.max(4, (entry.pct / 100) * barMaxWidth);
      return `<g>
        <text x="${screenX(0.07).toFixed(1)}" y="${(y + fontSize * 0.35).toFixed(1)}" font-size="${fontSize.toFixed(1)}" fill="#bafcd4">${escapeXml(truncate(entry.name, 9))}</text>
        <rect x="${screenX(0.46).toFixed(1)}" y="${(y - fontSize * 0.6).toFixed(1)}" width="${barMaxWidth.toFixed(1)}" height="${(fontSize * 0.9).toFixed(1)}" rx="1" fill="#123024"/>
        <rect x="${screenX(0.46).toFixed(1)}" y="${(y - fontSize * 0.6).toFixed(1)}" width="${width.toFixed(1)}" height="${(fontSize * 0.9).toFixed(1)}" rx="1" fill="#7dffb0" fill-opacity="0.8"/>
        <text x="${screenX(0.95).toFixed(1)}" y="${(y + fontSize * 0.35).toFixed(1)}" font-size="${(fontSize * 0.85).toFixed(1)}" fill="#7fe0aa" text-anchor="end">${entry.pct}%</text>
      </g>`;
    })
    .join("");
}

function channelWeatherRadar(scene) {
  const weather = scene.weather || {};
  const cx = screenX(0.28);
  const cy = screenY(0.52);
  const radius = Math.min(SCREEN.width * 0.2, SCREEN.height * 0.3);
  const rings = [0.4, 0.7, 1]
    .map(
      (scale) =>
        `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(radius * scale).toFixed(1)}" fill="none" stroke="#7dffb0" stroke-opacity="0.35" stroke-width="1"/>`
    )
    .join("");
  const blips = [
    [0.42, -0.3],
    [-0.5, 0.36],
    [0.14, 0.62],
  ]
    .map(
      ([dx, dy], index) =>
        `<circle cx="${(cx + dx * radius).toFixed(1)}" cy="${(cy + dy * radius).toFixed(1)}" r="${(radius * 0.1).toFixed(1)}" fill="${weather.isRain ? "#6cc8ff" : "#7dffb0"}" fill-opacity="0.55" class="twinkle" style="animation-delay:-${index * 0.7}s"/>`
    )
    .join("");
  const fontSize = Math.max(8, SCREEN.width * 0.052);
  return `${rings}
    ${blips}
    <line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(cx + radius).toFixed(1)}" y2="${cy.toFixed(1)}" stroke="#bafcd4" stroke-width="1.4" opacity="0.8">
      <animateTransform attributeName="transform" type="rotate" from="0 ${cx.toFixed(1)} ${cy.toFixed(1)}" to="360 ${cx.toFixed(1)} ${cy.toFixed(1)}" dur="4s" repeatCount="indefinite"/>
    </line>
    <text x="${screenX(0.56).toFixed(1)}" y="${screenY(0.4).toFixed(1)}" font-size="${fontSize.toFixed(1)}" fill="#bafcd4">BANGKOK</text>
    <text x="${screenX(0.56).toFixed(1)}" y="${screenY(0.56).toFixed(1)}" font-size="${(fontSize * 1.5).toFixed(1)}" fill="#d8ffe6" font-weight="bold">${(weather.tempC ?? 30).toFixed(0)}&#176;C</text>
    <text x="${screenX(0.56).toFixed(1)}" y="${screenY(0.72).toFixed(1)}" font-size="${(fontSize * 0.85).toFixed(1)}" fill="#7fe0aa">${escapeXml(truncate(weather.condition || "CLEAR", 14))}</text>`;
}

function channelNoSignal() {
  const bars = Array.from({ length: 7 }, (_, index) => {
    const width = SCREEN.width / 7;
    const colors = ["#c8c8c8", "#c8c832", "#32c8c8", "#32c832", "#c832c8", "#c83232", "#3232c8"];
    return `<rect x="${(SCREEN.x + index * width).toFixed(1)}" y="${screenY(0.18).toFixed(1)}" width="${width.toFixed(1)}" height="${(SCREEN.height * 0.44).toFixed(1)}" fill="${colors[index]}" fill-opacity="0.5"/>`;
  }).join("");
  return `${bars}
    <text x="${SCREEN.centerX.toFixed(1)}" y="${screenY(0.78).toFixed(1)}" font-size="${Math.max(10, SCREEN.width * 0.07).toFixed(1)}" fill="#e8ffe8" text-anchor="middle" font-weight="bold" class="rec">NO SIGNAL</text>`;
}

export function renderScreenLayer(scene) {
  const channel = scene.channel;
  const body =
    channel.id === "CH-02"
      ? channelCommitGraph(scene)
      : channel.id === "CH-07"
        ? channelLangStats(scene)
        : channel.id === "CH-11"
          ? channelWeatherRadar(scene)
          : channel.id === "CH-88"
            ? channelNoSignal()
            : channelNowPlaying(scene);

  return `<g clip-path="url(#screenClip)">
    <rect x="${SCREEN.x.toFixed(1)}" y="${SCREEN.y.toFixed(1)}" width="${SCREEN.width.toFixed(1)}" height="${SCREEN.height.toFixed(1)}" fill="url(#screenBase)"/>
    ${channelHeader(channel)}
    ${body}
    ${renderTicker(scene.commits)}
    <rect x="${SCREEN.x.toFixed(1)}" y="${SCREEN.y.toFixed(1)}" width="${SCREEN.width.toFixed(1)}" height="${SCREEN.height.toFixed(1)}" fill="url(#scanlines)" class="scandrift"/>
    <rect x="${SCREEN.x.toFixed(1)}" y="${SCREEN.y.toFixed(1)}" width="${SCREEN.width.toFixed(1)}" height="${SCREEN.height.toFixed(1)}" fill="url(#screenVignette)"/>
    <rect x="${SCREEN.x.toFixed(1)}" y="${SCREEN.y.toFixed(1)}" width="${SCREEN.width.toFixed(1)}" height="${SCREEN.height.toFixed(1)}" fill="#9effc4" class="flicker"/>
    <path d="M${SCREEN.x.toFixed(1)} ${screenY(0.06).toFixed(1)} Q${SCREEN.centerX.toFixed(1)} ${SCREEN.y.toFixed(1)} ${(SCREEN.x + SCREEN.width).toFixed(1)} ${screenY(0.1).toFixed(1)} L${(SCREEN.x + SCREEN.width).toFixed(1)} ${SCREEN.y.toFixed(1)} L${SCREEN.x.toFixed(1)} ${SCREEN.y.toFixed(1)} Z" fill="#ffffff" fill-opacity="0.06"/>
  </g>`;
}

export function renderGirlLayer(frames) {
  if (!frames || !frames.length) return "";
  return `<g>${frames
    .map(
      (uri, index) =>
        `<image id="girl-frame-${index + 1}" href="${uri}" x="${GIRL.x.toFixed(1)}" y="${GIRL.y.toFixed(1)}" width="${GIRL.width.toFixed(1)}" height="${GIRL.height.toFixed(1)}" opacity="${index === 3 ? 1 : 0}"><animate attributeName="opacity" values="${GIRL_FRAME_VALUES[index]}" keyTimes="${GIRL_KEYTIMES}" calcMode="discrete" dur="1.25s" repeatCount="indefinite"/></image>`
    )
    .join("")}</g>`;
}

export function renderRainLayer(weather) {
  if (!weather?.isRain) return "";
  const streaks = Array.from({ length: 26 }, (_, index) => {
    const x = WINDOW.x + ((index * 37) % WINDOW.width);
    const length = 14 + (index % 4) * 8;
    const delay = ((index % 9) * 0.13).toFixed(2);
    const duration = (0.7 + (index % 5) * 0.12).toFixed(2);
    return `<line x1="${x.toFixed(1)}" y1="${WINDOW.y.toFixed(1)}" x2="${(x - 5).toFixed(1)}" y2="${(WINDOW.y + length).toFixed(1)}" stroke="#dbeeff" stroke-opacity="0.75" stroke-width="1.8" stroke-linecap="round" class="raindrop" style="animation-delay:-${delay}s;animation-duration:${duration}s"/>`;
  }).join("");
  const droplets = Array.from({ length: 9 }, (_, index) => {
    const x = WINDOW.x + 12 + ((index * 53) % (WINDOW.width - 24));
    const y = WINDOW.y + 18 + ((index * 41) % (WINDOW.height - 36));
    const r = 1.8 + (index % 3) * 0.9;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#eaf4ff" fill-opacity="0.5"/>`;
  }).join("");
  const storm = weather.isStorm
    ? `<rect x="${WINDOW.x.toFixed(1)}" y="${WINDOW.y.toFixed(1)}" width="${WINDOW.width.toFixed(1)}" height="${WINDOW.height.toFixed(1)}" fill="#dce9ff" class="lightning"/>`
    : "";
  return `<g clip-path="url(#windowClip)">${streaks}${droplets}${storm}</g>`;
}

export function renderDustLayer(isNight) {
  const zone = isNight
    ? { x: SCREEN.x - 40, y: SCREEN.y + 60, width: SCREEN.width + 120, height: 220 }
    : { x: WINDOW.x - 30, y: WINDOW.y + 80, width: WINDOW.width + 190, height: 300 };
  return Array.from({ length: 14 }, (_, index) => {
    const x = zone.x + ((index * 71) % zone.width);
    const y = zone.y + ((index * 53) % zone.height);
    const r = 0.9 + (index % 3) * 0.5;
    const duration = (9 + (index % 5) * 2.4).toFixed(1);
    const delay = ((index * 1.7) % 11).toFixed(1);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#fff6de" opacity="0.3" class="mote" style="animation-duration:${duration}s;animation-delay:-${delay}s"/>`;
  }).join("");
}

export function overlayDefs(mood) {
  return `
    <linearGradient id="screenBase" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1f18"/><stop offset="1" stop-color="#050b08"/></linearGradient>
    <radialGradient id="screenVignette" cx="0.5" cy="0.5" r="0.72"><stop offset="0.5" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.62"/></radialGradient>
    <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000000" fill-opacity="0.26"/></pattern>
    <clipPath id="screenClip"><path d="${screenPath()}"/></clipPath>
    <clipPath id="artClip"><rect x="${screenX(0.06).toFixed(1)}" y="${screenY(0.2).toFixed(1)}" width="${(SCREEN.height * 0.46).toFixed(1)}" height="${(SCREEN.height * 0.46).toFixed(1)}" rx="3"/></clipPath>
    <clipPath id="trackClip"><rect x="${screenX(0.44).toFixed(1)}" y="${screenY(0.16).toFixed(1)}" width="${(SCREEN.width * 0.54).toFixed(1)}" height="${(SCREEN.height * 0.22).toFixed(1)}"/></clipPath>
    <clipPath id="tickerClip"><rect x="${screenX(0.03).toFixed(1)}" y="${screenY(0.87).toFixed(1)}" width="${(SCREEN.width * 0.94).toFixed(1)}" height="${(SCREEN.height * 0.11).toFixed(1)}"/></clipPath>
    <clipPath id="windowClip"><rect x="${WINDOW.x.toFixed(1)}" y="${WINDOW.y.toFixed(1)}" width="${WINDOW.width.toFixed(1)}" height="${WINDOW.height.toFixed(1)}"/></clipPath>
    <radialGradient id="screenBleed" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${mood.glow}" stop-opacity="0.22"/><stop offset="1" stop-color="${mood.glow}" stop-opacity="0"/></radialGradient>`;
}

function screenPath() {
  const [tl, tr, br, bl] = SCREEN.corners;
  const bulge = SCREEN.height * 0.03;
  return [
    `M${tl.x.toFixed(1)} ${tl.y.toFixed(1)}`,
    `Q${SCREEN.centerX.toFixed(1)} ${(SCREEN.y - bulge).toFixed(1)} ${tr.x.toFixed(1)} ${tr.y.toFixed(1)}`,
    `Q${(SCREEN.x + SCREEN.width + bulge).toFixed(1)} ${SCREEN.centerY.toFixed(1)} ${br.x.toFixed(1)} ${br.y.toFixed(1)}`,
    `Q${SCREEN.centerX.toFixed(1)} ${(SCREEN.y + SCREEN.height + bulge).toFixed(1)} ${bl.x.toFixed(1)} ${bl.y.toFixed(1)}`,
    `Q${(SCREEN.x - bulge).toFixed(1)} ${SCREEN.centerY.toFixed(1)} ${tl.x.toFixed(1)} ${tl.y.toFixed(1)}`,
    "Z",
  ].join(" ");
}

export function overlayStyle() {
  return `
      .flicker { animation: flicker 0.18s steps(3) infinite; }
      @keyframes flicker { 0% { opacity: 0.04; } 40% { opacity: 0.09; } 70% { opacity: 0.03; } 100% { opacity: 0.07; } }
      .scandrift { animation: scandrift 6s linear infinite; }
      @keyframes scandrift { from { transform: translateY(0); } to { transform: translateY(4px); } }
      .rec { animation: recblink 1.2s steps(1) infinite; }
      @keyframes recblink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.2; } }
      .eqbar { transform-box: fill-box; transform-origin: 50% 100%; animation: eq 0.9s ease-in-out infinite; }
      @keyframes eq { 0%, 100% { transform: scaleY(0.24); } 50% { transform: scaleY(1); } }
      .twinkle { animation: twinkle 2.4s ease-in-out infinite; }
      @keyframes twinkle { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
      .mote { animation: mote 10s linear infinite; }
      @keyframes mote { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 0.32; } 85% { opacity: 0.28; } 100% { transform: translateY(-52px); opacity: 0; } }
      .raindrop { animation-name: raindrop; animation-timing-function: linear; animation-iteration-count: infinite; }
      @keyframes raindrop { from { transform: translateY(-24px); opacity: 0; } 20% { opacity: 0.6; } to { transform: translateY(${WINDOW.height.toFixed(0)}px); opacity: 0; } }
      .lightning { animation: lightning 7s steps(1) infinite; opacity: 0; }
      @keyframes lightning { 0%, 92% { opacity: 0; } 93% { opacity: 0.55; } 94% { opacity: 0.1; } 95% { opacity: 0.42; } 97%, 100% { opacity: 0; } }
      .glowpulse { animation: glowpulse 4s ease-in-out infinite; }
      @keyframes glowpulse { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }`;
}

export { PLATE };
