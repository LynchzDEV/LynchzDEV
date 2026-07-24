import { writeFileSync, readFileSync, existsSync } from "fs";

const [, , trackNameArg, artistNameArg, isPlayingStr, albumImageArg] =
  process.argv;

const LAST_SONG_FILE = ".last-song.json";
const SVG_FILE = "spotify-tv.svg";
const FALLBACK_ART =
  "https://i.scdn.co/image/ab67616d0000b273ec61804d798b2c42fe23f7c3";

const fallback = {
  track: "I'm getting on the bus to the other world, see ya!",
  artist: "TUYU",
  image: FALLBACK_ART,
};

const isNothingPlaying = trackNameArg === "Nothing playing";
const track = isNothingPlaying ? fallback.track : trackNameArg;
const artist = isNothingPlaying ? fallback.artist : artistNameArg || "";
const albumImage = isNothingPlaying
  ? fallback.image
  : albumImageArg || fallback.image;

console.log("📝 Rendering retro CRT-TV README");
console.log("  Track:", track);
console.log("  Artist:", artist);
console.log("  Is Playing:", isPlayingStr);
console.log("  Album Image:", albumImage);

function isSameSong(currentTrack, currentArtist) {
  if (!existsSync(LAST_SONG_FILE)) return false;
  try {
    const last = JSON.parse(readFileSync(LAST_SONG_FILE, "utf8"));
    return last.track === currentTrack && last.artist === currentArtist;
  } catch (error) {
    console.log("⚠️ Could not read last song file:", error.message);
    return false;
  }
}

function saveCurrentSong(currentTrack, currentArtist) {
  try {
    const data = {
      track: currentTrack,
      artist: currentArtist,
      timestamp: new Date().toISOString(),
    };
    writeFileSync(LAST_SONG_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log("⚠️ Could not save current song:", error.message);
  }
}

function escapeXml(value) {
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

function estimateTextWidth(text, fontSize) {
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    width += isWideGlyph(code) ? fontSize : fontSize * 0.6;
  }
  return width;
}

function truncate(text, max) {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, Math.max(0, max - 1)).join("")}…`;
}

async function fetchAlbumArtDataUri(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) throw new Error("empty body");
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch (error) {
    console.log("⚠️ Album art fetch failed, using drawn placeholder:", error.message);
    return null;
  }
}

function renderScreenArt(dataUri) {
  if (dataUri) {
    return `<image href="${dataUri}" x="175" y="135" width="150" height="150" preserveAspectRatio="xMidYMid slice" clip-path="url(#artClip)"/>`;
  }
  return `<g clip-path="url(#artClip)">
      <rect x="175" y="135" width="150" height="150" fill="#0a1712"/>
      <text x="250" y="228" font-family="'Courier New',monospace" font-size="64" fill="#2f5d47" text-anchor="middle">&#9834;</text>
    </g>`;
}

function renderTrackText(trackText) {
  const fontSize = 15;
  const escaped = escapeXml(trackText);
  const width = estimateTextWidth(trackText, fontSize);
  const trackAreaWidth = 300;
  if (width <= trackAreaWidth) {
    return `<text x="250" y="312" font-family="'Courier New',monospace" font-size="${fontSize}" font-weight="bold" fill="#d8ffe6" text-anchor="middle" class="phosphor">${escaped}</text>`;
  }
  const startX = 405;
  const distance = startX + width;
  const duration = Math.max(6, distance / 45).toFixed(1);
  return `<g clip-path="url(#trackClip)">
      <text x="0" y="312" font-family="'Courier New',monospace" font-size="${fontSize}" font-weight="bold" fill="#d8ffe6" class="phosphor">${escaped}<animateTransform attributeName="transform" type="translate" from="${startX} 0" to="-${width.toFixed(0)} 0" dur="${duration}s" repeatCount="indefinite"/></text>
    </g>`;
}

function renderTvSvg(trackText, artistText, dataUri, epochSeconds) {
  const artClipRect = `<rect x="175" y="135" width="150" height="150" rx="4"/>`;
  const screenArt = renderScreenArt(dataUri);
  const trackMarkup = renderTrackText(trackText);
  const artistLine = escapeXml(truncate(artistText, 40));
  const cassetteLabel = escapeXml(truncate(artistText || "SIDE A", 20));

  const speakerRows = Array.from({ length: 7 }, (_, row) => {
    const cy = 145 + row * 22;
    const dots = Array.from({ length: 6 }, (_, col) => {
      const cx = 445 + col * 20;
      return `<circle cx="${cx}" cy="${cy}" r="3.2" fill="#1a1712"/>`;
    }).join("");
    return dots;
  }).join("");

  const dialTicks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 2 * Math.PI;
    const inner = 20;
    const outer = 26;
    const cx = 505;
    const cy = 345;
    const x1 = (cx + Math.cos(angle) * inner).toFixed(1);
    const y1 = (cy + Math.sin(angle) * inner).toFixed(1);
    const x2 = (cx + Math.cos(angle) * outer).toFixed(1);
    const y2 = (cy + Math.sin(angle) * outer).toFixed(1);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5a4a3a" stroke-width="1.5"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 940 520" width="940" height="520" font-family="'Courier New',monospace" role="img" aria-label="Retro CRT television now playing ${escapeXml(trackText)} by ${escapeXml(artistText)}">
  <defs>
    <linearGradient id="scene" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#151221"/>
      <stop offset="1" stop-color="#0b0a12"/>
    </linearGradient>
    <linearGradient id="woodFront" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a3b30"/>
      <stop offset="1" stop-color="#33281f"/>
    </linearGradient>
    <linearGradient id="woodSide" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#2c2219"/>
      <stop offset="1" stop-color="#1c150f"/>
    </linearGradient>
    <linearGradient id="woodTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5a4838"/>
      <stop offset="1" stop-color="#42342a"/>
    </linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75">
      <stop offset="0.55" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.75"/>
    </radialGradient>
    <linearGradient id="screenGlow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d1f18"/>
      <stop offset="1" stop-color="#050b08"/>
    </linearGradient>
    <linearGradient id="cassetteBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#26242c"/>
      <stop offset="1" stop-color="#15141a"/>
    </linearGradient>
    <clipPath id="screenClip"><rect x="85" y="125" width="330" height="250" rx="14"/></clipPath>
    <clipPath id="artClip">${artClipRect}</clipPath>
    <clipPath id="trackClip"><rect x="95" y="298" width="310" height="22"/></clipPath>
    <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill="#000000" fill-opacity="0"/>
      <rect width="4" height="2" fill="#000000" fill-opacity="0.28"/>
    </pattern>
    <style>
      .flicker { animation: flicker 0.18s steps(3) infinite; }
      @keyframes flicker { 0% { opacity: 0.04; } 40% { opacity: 0.09; } 70% { opacity: 0.03; } 100% { opacity: 0.07; } }
      .scandrift { animation: scandrift 6s linear infinite; }
      @keyframes scandrift { from { transform: translateY(0); } to { transform: translateY(4px); } }
      .rec { animation: recblink 1.2s steps(1) infinite; }
      @keyframes recblink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.15; } }
      .led { animation: ledpulse 2.4s ease-in-out infinite; }
      @keyframes ledpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
      .phosphor { paint-order: stroke; }
    </style>
  </defs>

  <rect width="940" height="520" fill="url(#scene)"/>
  <ellipse cx="330" cy="470" rx="300" ry="26" fill="#000000" fill-opacity="0.35"/>

  <g stroke="#8a8a8a" stroke-width="3" stroke-linecap="round" fill="none">
    <path d="M255 82 L175 18"/>
    <path d="M320 82 L400 30"/>
  </g>
  <circle cx="173" cy="16" r="6" fill="#c9c9c9"/>
  <circle cx="402" cy="28" r="6" fill="#c9c9c9"/>

  <polygon points="575,80 605,62 605,418 575,440" fill="url(#woodSide)"/>
  <polygon points="55,80 85,62 605,62 575,80" fill="url(#woodTop)"/>
  <rect x="55" y="80" width="520" height="360" rx="18" fill="url(#woodFront)" stroke="#1c150f" stroke-width="2"/>

  <rect x="70" y="94" width="200" height="18" rx="4" fill="#241c15"/>
  <text x="80" y="108" font-size="12" fill="#c9a86a" letter-spacing="3">RETROTONE</text>
  <g class="rec">
    <circle cx="470" cy="103" r="6" fill="#ff3b30"/>
    <text x="482" y="108" font-size="12" fill="#ff6b63" letter-spacing="1">REC</text>
  </g>

  <rect x="78" y="118" width="344" height="264" rx="18" fill="#0a0a0a"/>
  <rect x="85" y="125" width="330" height="250" rx="14" fill="url(#screenGlow)"/>

  <g clip-path="url(#screenClip)">
    ${screenArt}
    <text x="95" y="140" font-size="10.5" fill="#66e0a0" fill-opacity="0.85" letter-spacing="1">CH-05 &#9834; NOW PLAYING</text>
    <rect x="85" y="288" width="330" height="87" fill="#04100b" fill-opacity="0.82"/>
    ${trackMarkup}
    <text x="250" y="336" font-size="12" fill="#7fe0aa" text-anchor="middle" class="phosphor">${artistLine}</text>
    <g fill="#bafcd4" text-anchor="middle" font-size="20">
      <text x="212" y="366">&#9665;</text>
      <text x="250" y="366">&#9208;</text>
      <text x="288" y="366">&#9655;</text>
    </g>
    <rect x="85" y="125" width="330" height="250" fill="url(#scanlines)" class="scandrift"/>
    <rect x="85" y="125" width="330" height="250" rx="14" fill="url(#vignette)"/>
    <rect x="85" y="125" width="330" height="250" rx="14" fill="#9effc4" class="flicker"/>
  </g>
  <rect x="85" y="125" width="330" height="250" rx="14" fill="none" stroke="#000000" stroke-width="6" stroke-opacity="0.5"/>

  <g>${speakerRows}</g>
  <circle cx="505" cy="345" r="30" fill="#1a140e" stroke="#5a4a3a" stroke-width="2"/>
  <g>${dialTicks}</g>
  <circle cx="505" cy="345" r="16" fill="#2c2219" stroke="#6a5540" stroke-width="1.5"/>
  <line x1="505" y1="345" x2="505" y2="332" stroke="#d8b878" stroke-width="2.5" stroke-linecap="round"/>
  <text x="505" y="392" font-size="9" fill="#8a7355" text-anchor="middle" letter-spacing="1">CHANNEL</text>
  <circle cx="470" cy="410" r="5" fill="#48ff8f" class="led"/>
  <text x="482" y="414" font-size="9" fill="#7a6a52">PWR</text>

  <rect x="120" y="440" width="40" height="22" rx="3" fill="#1c150f"/>
  <rect x="470" y="440" width="40" height="22" rx="3" fill="#1c150f"/>

  <g transform="translate(620 250)">
    <rect x="0" y="0" width="290" height="180" rx="12" fill="url(#cassetteBody)" stroke="#000000" stroke-width="2"/>
    <rect x="16" y="16" width="258" height="86" rx="6" fill="#e9e2d0"/>
    <rect x="16" y="16" width="258" height="20" rx="6" fill="#d24b3e"/>
    <text x="145" y="30" font-size="11" fill="#fbeee0" text-anchor="middle" letter-spacing="2">CASSETTE • 60</text>
    <text x="145" y="66" font-size="15" fill="#2a2620" text-anchor="middle" font-weight="bold">${cassetteLabel}</text>
    <text x="145" y="88" font-size="10" fill="#7a6a55" text-anchor="middle" letter-spacing="1">NOW PLAYING MIX</text>

    <rect x="16" y="112" width="258" height="54" rx="6" fill="#0d0c10"/>
    <g transform="translate(88 139)">
      <circle r="26" fill="#2a2830"/>
      <circle r="9" fill="#4a4752"/>
      <g stroke="#6a6676" stroke-width="3">
        <line x1="0" y1="-24" x2="0" y2="-12"/>
        <line x1="21" y1="-12" x2="10" y2="-6"/>
        <line x1="21" y1="12" x2="10" y2="6"/>
        <line x1="0" y1="24" x2="0" y2="12"/>
        <line x1="-21" y1="12" x2="-10" y2="6"/>
        <line x1="-21" y1="-12" x2="-10" y2="-6"/>
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3s" repeatCount="indefinite"/>
      </g>
    </g>
    <g transform="translate(202 139)">
      <circle r="26" fill="#2a2830"/>
      <circle r="9" fill="#4a4752"/>
      <g stroke="#6a6676" stroke-width="3">
        <line x1="0" y1="-24" x2="0" y2="-12"/>
        <line x1="21" y1="-12" x2="10" y2="-6"/>
        <line x1="21" y1="12" x2="10" y2="6"/>
        <line x1="0" y1="24" x2="0" y2="12"/>
        <line x1="-21" y1="12" x2="-10" y2="6"/>
        <line x1="-21" y1="-12" x2="-10" y2="-6"/>
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="4s" repeatCount="indefinite"/>
      </g>
    </g>
    <circle cx="145" cy="139" r="3" fill="#3a3742"/>
  </g>

  <text x="620" y="470" font-size="11" fill="#5a5568" letter-spacing="2">&#9834; SIDE A &#183; ANALOG MIX</text>
</svg>
`;
}

async function main() {
  if (isSameSong(track, artist)) {
    console.log("🔄 Same song as last update, skipping README update");
    console.log(`🎵 Current track: ${track} by ${artist}`);
    process.exit(0);
  }

  const epochSeconds = Math.floor(Date.now() / 1000);
  const dataUri = await fetchAlbumArtDataUri(albumImage);
  const svg = renderTvSvg(track, artist, dataUri, epochSeconds);

  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const readme = `<div align="center">

# Lynchz

**CS student · J-rock &amp; metal listener · TypeScript developer**

<img src="./${SVG_FILE}?v=${epochSeconds}" width="720" alt="Retro CRT television now playing my latest Spotify track" />

[GitHub · @LynchzDEV](https://github.com/LynchzDEV)

<sub>Auto-updated via GitHub Actions · Last sync: ${timestamp}</sub>

</div>
`;

  try {
    writeFileSync(SVG_FILE, svg);
    writeFileSync("README.md", readme);
    saveCurrentSong(track, artist);
    console.log("✅ README + SVG updated successfully!");
    console.log(`🎵 Current track: ${track} by ${artist}`);
    console.log(`📅 Updated at: ${timestamp}`);
  } catch (error) {
    console.error("❌ Error updating README:", error);
    process.exit(1);
  }
}

await main();
