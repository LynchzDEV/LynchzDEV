import { writeFileSync, readFileSync, existsSync } from "fs";
import { createHash } from "node:crypto";

const LAST_SONG_FILE = ".last-song.json";
const SVG_FILE = "spotify-tv.svg";
const GITHUB_USER = "LynchzDEV";
const FALLBACK_ART =
  "https://i.scdn.co/image/ab67616d0000b273ec61804d798b2c42fe23f7c3";

const fallbackTrack = {
  track: "I'm getting on the bus to the other world, see ya!",
  artist: "TUYU",
  image: FALLBACK_ART,
};

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
  const chars = Array.from(String(text));
  if (chars.length <= max) return String(text);
  return `${chars.slice(0, Math.max(0, max - 1)).join("")}…`;
}

function isDaytimeBangkok() {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );
  const normalized = hour % 24;
  return normalized >= 6 && normalized < 18;
}

function moodFromGenres(genres) {
  const blob = (genres || []).join(" ").toLowerCase();
  if (/metal|rock|punk|hardcore|emo|grunge|screamo/.test(blob)) {
    return {
      name: "ROCK",
      glow: "#ff2d55",
      neon: "#ff5470",
      accent: "#ff3b5c",
      hoodie: "#a02338",
    };
  }
  if (/j-?pop|anime|idol|kawaii|vocaloid|city ?pop|shibuya|denpa/.test(blob)) {
    return {
      name: "J-POP",
      glow: "#ff8fd0",
      neon: "#7cf5ff",
      accent: "#ff8fd0",
      hoodie: "#c96aa8",
    };
  }
  return {
    name: "CHILL",
    glow: "#ffb347",
    neon: "#ffcf6b",
    accent: "#ffb347",
    hoodie: "#8a6d3b",
  };
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

async function spotifyGet(token, path) {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`Spotify ${path} -> HTTP ${response.status}`);
  return response.json();
}

async function githubGet(path, token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": `${GITHUB_USER}-readme`,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub ${path} -> HTTP ${response.status}`);
  return response.json();
}

async function fetchSpotifyScene(token) {
  const result = {
    track: fallbackTrack.track,
    artist: fallbackTrack.artist,
    image: fallbackTrack.image,
    artistId: null,
    recent: [],
    genres: [],
  };
  if (!token) {
    console.log("ℹ️ No Spotify token; using fallback track.");
    return result;
  }

  try {
    const current = await spotifyGet(token, "/me/player/currently-playing");
    if (current && current.item) {
      result.track = current.item.name;
      result.artist = current.item.artists?.[0]?.name || "";
      result.image = current.item.album?.images?.[0]?.url || fallbackTrack.image;
      result.artistId = current.item.artists?.[0]?.id || null;
    }
  } catch (error) {
    console.log("⚠️ currently-playing failed:", error.message);
  }

  try {
    const recent = await spotifyGet(token, "/me/player/recently-played?limit=5");
    const items = recent?.items || [];
    const mapped = items.map((entry) => ({
      track: entry.track?.name || "",
      artist: entry.track?.artists?.[0]?.name || "",
      artistId: entry.track?.artists?.[0]?.id || null,
      image: entry.track?.album?.images?.[0]?.url || null,
    }));
    const deduped = mapped.filter(
      (entry) =>
        !(entry.track === result.track && entry.artist === result.artist)
    );
    result.recent = deduped.slice(0, 4);
    if (!result.artistId && result.track === fallbackTrack.track && mapped[0]) {
      result.track = mapped[0].track;
      result.artist = mapped[0].artist;
      result.image = mapped[0].image || fallbackTrack.image;
      result.artistId = mapped[0].artistId;
      result.recent = deduped.slice(0, 4);
    }
  } catch (error) {
    console.log("⚠️ recently-played failed:", error.message);
  }

  try {
    if (result.artistId) {
      const artist = await spotifyGet(token, `/artists/${result.artistId}`);
      result.genres = artist?.genres || [];
    }
  } catch (error) {
    console.log("⚠️ artist genres failed:", error.message);
  }

  return result;
}

async function fetchCommitTicker(token) {
  try {
    const events = await githubGet(`/users/${GITHUB_USER}/events/public`, token);
    const commits = [];
    for (const event of events) {
      if (event.type !== "PushEvent") continue;
      for (const commit of event.payload?.commits || []) {
        commits.push({
          repo: event.repo?.name || GITHUB_USER,
          message: (commit.message || "").split("\n")[0],
        });
        if (commits.length >= 5) return commits;
      }
    }
    return commits;
  } catch (error) {
    console.log("⚠️ commit ticker failed:", error.message);
    return [];
  }
}

async function fetchLanguageStats(token) {
  try {
    const repos = await githubGet(
      `/users/${GITHUB_USER}/repos?per_page=100&type=owner&sort=updated`,
      token
    );
    const owned = repos.filter((repo) => !repo.fork).slice(0, 25);
    const totals = {};
    for (const repo of owned) {
      try {
        const languages = await githubGet(
          `/repos/${repo.full_name}/languages`,
          token
        );
        for (const [name, bytes] of Object.entries(languages)) {
          totals[name] = (totals[name] || 0) + bytes;
        }
      } catch (error) {
        console.log(`⚠️ languages for ${repo.full_name} failed:`, error.message);
      }
    }
    const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, bytes]) => ({ name, pct: Math.round((bytes / sum) * 100) }));
  } catch (error) {
    console.log("⚠️ language stats failed:", error.message);
    return [];
  }
}

async function buildLiveScene() {
  const spotifyToken = process.env.SPOTIFY_ACCESS_TOKEN || "";
  const githubToken = process.env.GITHUB_TOKEN || "";

  const spotify = await fetchSpotifyScene(spotifyToken);
  const [ticker, languages, albumDataUri] = await Promise.all([
    fetchCommitTicker(githubToken),
    fetchLanguageStats(githubToken),
    fetchAlbumArtDataUri(spotify.image),
  ]);

  return {
    track: spotify.track,
    artist: spotify.artist,
    albumDataUri,
    isDay: isDaytimeBangkok(),
    mood: moodFromGenres(spotify.genres),
    genres: spotify.genres,
    recent: spotify.recent.map((entry) => ({
      track: entry.track,
      artist: entry.artist,
    })),
    ticker,
    languages,
  };
}

const SAMPLE_SCENES = {
  current: {
    track: "Young Girl A",
    artist: "Siinamota",
    isDay: null,
    genres: ["j-pop", "vocaloid"],
    image: FALLBACK_ART,
    recent: [
      { track: "nigera no hanataba", artist: "sana" },
      { track: "Connect the World", artist: "Nanatsukaze" },
      { track: "my crush", artist: "Kashi Moimi" },
      { track: "少女A", artist: "Siinamota" },
    ],
    ticker: [
      { repo: "LynchzDEV/LynchzDEV", message: "docs: phase 2 spec - room scene, anime girl, ticker" },
      { repo: "LynchzDEV/LynchzDEV", message: "ci: commit svg and last-song artifacts so skip logic persists" },
      { repo: "LynchzDEV/LynchzDEV", message: "feat: retro CRT-TV animated SVG Spotify widget" },
    ],
    languages: [
      { name: "TypeScript", pct: 53 },
      { name: "Go", pct: 24 },
      { name: "HTML", pct: 9 },
      { name: "Ruby", pct: 5 },
    ],
  },
  "day-metal": {
    track: "Master of Puppets",
    artist: "Metallica",
    isDay: true,
    genres: ["thrash metal", "metal"],
    image: FALLBACK_ART,
    recent: [
      { track: "Enter Sandman", artist: "Metallica" },
      { track: "Raining Blood", artist: "Slayer" },
      { track: "Chop Suey! & Toxicity", artist: "System of a Down" },
      { track: "Bury the Light", artist: "Casey Edwards" },
    ],
    ticker: [
      { repo: "LynchzDEV/LynchzDEV", message: "feat: room scene & anime girl" },
      { repo: "LynchzDEV/app", message: "fix: escape <ticker> & marquee bug" },
      { repo: "LynchzDEV/api", message: "chore: bump deps" },
    ],
    languages: [
      { name: "TypeScript", pct: 52 },
      { name: "JavaScript", pct: 23 },
      { name: "CSS", pct: 15 },
      { name: "Shell", pct: 10 },
    ],
  },
  "night-jpop": {
    track: "夜に駆ける & more",
    artist: "YOASOBI",
    isDay: false,
    genres: ["j-pop", "anime"],
    image: FALLBACK_ART,
    recent: [
      { track: "アイドル", artist: "YOASOBI" },
      { track: "怪物 & beyond", artist: "YOASOBI" },
      { track: "Young Girl A", artist: "Siinamota" },
      { track: "group_inou", artist: "tofubeats & friends" },
    ],
    ticker: [
      { repo: "LynchzDEV/LynchzDEV", message: "feat: 夜 ticker & <marquee>" },
      { repo: "LynchzDEV/site", message: "style: pastel neon mood" },
    ],
    languages: [
      { name: "TypeScript", pct: 60 },
      { name: "Vue", pct: 20 },
      { name: "SCSS", pct: 12 },
      { name: "Python", pct: 8 },
    ],
  },
};

async function buildSampleScene(name) {
  const sample = SAMPLE_SCENES[name];
  if (!sample) {
    const available = Object.keys(SAMPLE_SCENES).join(", ");
    throw new Error(`Unknown sample "${name}". Available: ${available}`);
  }
  const albumDataUri = await fetchAlbumArtDataUri(sample.image);
  return {
    track: sample.track,
    artist: sample.artist,
    albumDataUri,
    isDay: sample.isDay == null ? isDaytimeBangkok() : sample.isDay,
    mood: moodFromGenres(sample.genres),
    genres: sample.genres,
    recent: sample.recent,
    ticker: sample.ticker,
    languages: sample.languages,
  };
}

function sceneHash(scene) {
  const payload = JSON.stringify({
    track: scene.track,
    artist: scene.artist,
    isDay: scene.isDay,
    mood: scene.mood.name,
    recent: scene.recent,
    ticker: scene.ticker,
    languages: scene.languages,
  });
  return createHash("sha256").update(payload).digest("hex");
}

function isSameScene(hash) {
  if (!existsSync(LAST_SONG_FILE)) return false;
  try {
    const last = JSON.parse(readFileSync(LAST_SONG_FILE, "utf8"));
    return last.hash === hash;
  } catch (error) {
    console.log("⚠️ Could not read last scene file:", error.message);
    return false;
  }
}

function saveScene(scene, hash) {
  try {
    const data = {
      hash,
      track: scene.track,
      artist: scene.artist,
      timestamp: new Date().toISOString(),
    };
    writeFileSync(LAST_SONG_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log("⚠️ Could not save scene state:", error.message);
  }
}

function renderScreenArt(dataUri) {
  if (dataUri) {
    return `<image href="${dataUri}" x="360" y="284" width="84" height="84" preserveAspectRatio="xMidYMid slice" clip-path="url(#artClip)"/>`;
  }
  return `<g clip-path="url(#artClip)">
      <rect x="360" y="284" width="84" height="84" fill="#0a1712"/>
      <text x="402" y="342" font-size="40" fill="#2f5d47" text-anchor="middle">&#9834;</text>
    </g>`;
}

function renderTrackText(trackText) {
  const fontSize = 13;
  const escaped = escapeXml(trackText);
  const width = estimateTextWidth(trackText, fontSize);
  const areaWidth = 138;
  if (width <= areaWidth) {
    return `<text x="527" y="304" font-size="${fontSize}" font-weight="bold" fill="#d8ffe6" text-anchor="middle" class="phosphor">${escaped}</text>`;
  }
  const startX = 596;
  const distance = startX + width;
  const duration = Math.max(6, distance / 42).toFixed(1);
  return `<g clip-path="url(#trackClip)">
      <text x="0" y="304" font-size="${fontSize}" font-weight="bold" fill="#d8ffe6" class="phosphor">${escaped}<animateTransform attributeName="transform" type="translate" from="${startX} 0" to="-${width.toFixed(0)} 0" dur="${duration}s" repeatCount="indefinite"/></text>
    </g>`;
}

function renderEqBars(mood) {
  const delays = [0, -0.2, -0.5, -0.1, -0.7, -0.35, -0.6, -0.15, -0.45];
  const bars = delays
    .map((delay, index) => {
      const x = 470 + index * 10;
      return `<rect class="eqbar" x="${x}" y="332" width="6" height="30" rx="1" fill="${mood.accent}" style="animation-delay:${delay}s"/>`;
    })
    .join("");
  return `<g opacity="0.9">${bars}</g>`;
}

function renderTicker(ticker) {
  const items =
    ticker && ticker.length
      ? ticker.map(
          (entry) => `${escapeXml(entry.repo)}: ${escapeXml(entry.message)}`
        )
      : ["NO SIGNAL", "NO SIGNAL", "NO SIGNAL"];
  const raw = ticker && ticker.length
    ? ticker.map((entry) => `${entry.repo}: ${entry.message}`)
    : ["NO SIGNAL", "NO SIGNAL", "NO SIGNAL"];
  const sep = "   +++   ";
  const text = items.join(sep) + sep;
  const rawText = raw.join(sep) + sep;
  const width = Math.max(260, estimateTextWidth(rawText, 9));
  const duration = Math.max(12, (width * 2) / 40).toFixed(0);
  return `<g clip-path="url(#tickerClip)">
      <rect x="350" y="440" width="250" height="20" fill="#020806" fill-opacity="0.9"/>
      <g font-size="9" fill="#7dffb0" font-family="'Courier New',monospace">
        <text x="0" y="453">${text}${text}<animateTransform attributeName="transform" type="translate" from="600 0" to="${(600 - width).toFixed(0)} 0" dur="${duration}s" repeatCount="indefinite"/></text>
      </g>
    </g>`;
}

function renderWindow(isDay) {
  const frame = `
    <rect x="52" y="44" width="266" height="216" rx="9" fill="url(#windowFrame)"/>
    <rect x="62" y="54" width="246" height="196" rx="5" fill="#000000" fill-opacity="0.35"/>`;
  const frameTop = `
    <rect x="183" y="62" width="7" height="180" fill="url(#muntin)"/>
    <rect x="70" y="149" width="230" height="7" fill="url(#muntin)"/>
    <rect x="52" y="44" width="266" height="216" rx="9" fill="none" stroke="#0000004d" stroke-width="2"/>
    <rect x="60" y="240" width="250" height="12" rx="3" fill="url(#windowSill)"/>
    <rect x="60" y="250" width="250" height="4" fill="#000000" fill-opacity="0.35"/>`;
  const curtains = `<g>
    <rect x="30" y="30" width="312" height="8" rx="4" fill="url(#curtainRod)"/>
    <circle cx="30" cy="34" r="6" fill="url(#curtainRod)"/><circle cx="342" cy="34" r="6" fill="url(#curtainRod)"/>
    <path d="M34 38 Q52 120 40 260 L84 260 Q66 140 74 38 Z" fill="url(#curtain)"/>
    <path d="M46 38 Q58 130 50 258 L64 258 Q58 140 62 38 Z" fill="#000000" fill-opacity="0.18"/>
    <path d="M336 38 Q318 120 330 260 L288 260 Q304 140 298 38 Z" fill="url(#curtain)"/>
    <path d="M324 38 Q314 130 320 258 L306 258 Q312 140 310 38 Z" fill="#000000" fill-opacity="0.18"/>
  </g>`;
  if (isDay) {
    const clouds = `<g fill="#ffe6c4" fill-opacity="0.85">
        <ellipse cx="120" cy="132" rx="30" ry="11"/><ellipse cx="150" cy="138" rx="38" ry="13"/><ellipse cx="98" cy="140" rx="24" ry="10"/>
        <animateTransform attributeName="transform" type="translate" values="0 0; 26 0; 0 0" dur="26s" repeatCount="indefinite"/>
      </g>`;
    return `<g>
      ${frame}
      <g clip-path="url(#glassClip)">
        <rect x="70" y="62" width="230" height="180" fill="url(#goldenSky)"/>
        <circle cx="150" cy="196" r="34" fill="#ffdf9e" filter="url(#soft)"/>
        <circle cx="150" cy="196" r="19" fill="#fff4d6"/>
        ${clouds}
        <path d="M70 216 Q150 200 210 210 T300 206 L300 242 L70 242 Z" fill="#7d6d8a" fill-opacity="0.6"/>
        <path d="M70 228 Q140 218 210 224 T300 222 L300 242 L70 242 Z" fill="#5d5170" fill-opacity="0.65"/>
        <polygon points="96,62 150,62 96,242 42,242" fill="#fff1cc" fill-opacity="0.16"/>
        <polygon points="160,62 182,62 128,242 106,242" fill="#fff1cc" fill-opacity="0.10"/>
      </g>
      ${frameTop}
      ${curtains}
    </g>`;
  }
  const stars = Array.from({ length: 18 }, (_, i) => {
    const x = 76 + ((i * 53) % 216);
    const y = 68 + ((i * 37) % 120);
    const delay = ((i % 5) * 0.6).toFixed(1);
    const r = i % 3 === 0 ? 1.6 : 1.1;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#eaf0ff" class="twinkle" style="animation-delay:-${delay}s"/>`;
  }).join("");
  const city = `<g fill="#0b1120">
      <rect x="70" y="196" width="26" height="46"/><rect x="98" y="176" width="18" height="66"/>
      <rect x="120" y="206" width="30" height="36"/><rect x="152" y="186" width="20" height="56"/>
      <rect x="176" y="210" width="24" height="32"/><rect x="204" y="182" width="16" height="60"/>
      <rect x="224" y="200" width="30" height="42"/><rect x="258" y="190" width="18" height="52"/><rect x="280" y="208" width="20" height="34"/>
    </g>`;
  const cityWindows = `<g fill="#ffcf6b" fill-opacity="0.55">
      <rect x="102" y="184" width="3" height="4"/><rect x="108" y="192" width="3" height="4"/><rect x="158" y="196" width="3" height="4"/>
      <rect x="208" y="190" width="3" height="4"/><rect x="230" y="210" width="3" height="4"/><rect x="264" y="200" width="3" height="4"/>
    </g>`;
  return `<g>
    ${frame}
    <g clip-path="url(#glassClip)">
      <rect x="70" y="62" width="230" height="180" fill="url(#nightGlass)"/>
      ${stars}
      <circle cx="236" cy="106" r="40" fill="#cfe0ff" fill-opacity="0.22" filter="url(#softbig)"/>
      <circle cx="236" cy="106" r="27" fill="#cfe0ff" fill-opacity="0.25" filter="url(#soft)"/>
      <circle cx="236" cy="106" r="19" fill="#eef0e0"/>
      <circle cx="227" cy="99" r="17" fill="#16223f"/>
      ${city}
      ${cityWindows}
      <polygon points="96,62 150,62 96,242 42,242" fill="#8fb4ff" fill-opacity="0.08"/>
    </g>
    ${frameTop}
    ${curtains}
  </g>`;
}

const HORIZON = 418;

function renderRoomLight(isDay, mood) {
  if (isDay) {
    return `<g>
      <polygon points="70,258 310,258 430,${HORIZON + 6} 430,560 40,560 20,${HORIZON + 6}" fill="url(#dayBeam)" opacity="0.5" filter="url(#softbig)"/>
      <polygon points="90,262 180,262 240,540 60,540" fill="#ffdf9e" fill-opacity="0.12"/>
    </g>`;
  }
  return `<g>
    <polygon points="120,430 320,430 356,530 66,530" fill="#aecbff" fill-opacity="0.055" filter="url(#soft)"/>
    <polygon points="352,466 600,466 700,596 260,596" fill="url(#screenBeam)" filter="url(#softbig)"/>
    <ellipse cx="480" cy="548" rx="230" ry="46" fill="${mood.glow}" fill-opacity="0.10" filter="url(#softbig)"/>
    <ellipse cx="944" cy="540" rx="120" ry="36" fill="#ffb35c" fill-opacity="0.10" filter="url(#softbig)"/>
  </g>`;
}

function renderDustMotes(isDay) {
  const zone = isDay
    ? [
        [120, 480], [180, 420], [230, 500], [90, 380], [160, 330], [260, 440], [200, 370],
      ]
    : [
        [400, 500], [460, 530], [520, 490], [570, 545], [430, 555], [610, 520], [490, 470],
      ];
  return zone
    .map(([x, y], i) => {
      const r = 1 + (i % 3) * 0.4;
      const dur = (8 + (i % 4) * 2.6).toFixed(1);
      const delay = (-(i * 1.7) % 10).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff6de" opacity="0.35" class="mote" style="animation-duration:${dur}s;animation-delay:${delay}s"/>`;
    })
    .join("");
}

function renderFairyLights(isDay, mood) {
  const points = Array.from({ length: 20 }, (_, i) => {
    const t = i / 19;
    return {
      x: 24 + t * 952,
      y: 14 + Math.sin(Math.PI * t) * 26,
      i,
    };
  });
  const wire = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(0)} ${p.y.toFixed(0)}`).join(" ");
  const bulbs = points
    .map(({ x, y, i }) => {
      const delay = ((i % 6) * 0.45).toFixed(2);
      const color = i % 5 === 0 ? mood.neon : "#ffd9a0";
      const dim = isDay ? 0.35 : 0.95;
      return `<circle cx="${x.toFixed(0)}" cy="${(y + 5).toFixed(0)}" r="2.6" fill="${color}" opacity="${dim}" class="twinkle" style="animation-delay:-${delay}s" filter="url(#neonGlow)"/>`;
    })
    .join("");
  return `<g>
    <path d="${wire}" fill="none" stroke="#00000055" stroke-width="1.6"/>
    ${bulbs}
  </g>`;
}

function renderPlant(isDay) {
  const leaf = isDay ? "#4e6b44" : "#2c3d34";
  const leafLit = isDay ? "#6d8a58" : "#3d5646";
  return `<g>
    <ellipse cx="790" cy="574" rx="46" ry="10" fill="#000000" fill-opacity="0.35" filter="url(#soft)"/>
    <g stroke="${leaf}" stroke-width="5" fill="none" stroke-linecap="round">
      <path d="M790 540 Q764 470 728 448"/>
      <path d="M790 540 Q790 452 776 424"/>
      <path d="M790 540 Q816 468 846 444"/>
      <path d="M790 540 Q836 496 862 492"/>
    </g>
    <path d="M728 448 q-26 -8 -34 -30 q24 -4 38 12 q10 10 -4 18 Z" fill="${leafLit}"/>
    <path d="M776 424 q-10 -28 6 -46 q18 16 8 40 q-4 12 -14 6 Z" fill="${leaf}"/>
    <path d="M846 444 q26 -12 30 -36 q-26 -2 -38 16 q-8 12 8 20 Z" fill="${leafLit}"/>
    <path d="M862 492 q28 -2 38 -22 q-24 -8 -40 6 q-10 8 2 16 Z" fill="${leaf}"/>
    <path d="M762 540 L818 540 L810 584 L770 584 Z" fill="url(#pot)"/>
    <rect x="758" y="534" width="64" height="10" rx="3" fill="url(#potRim)"/>
  </g>`;
}

function renderCable() {
  return `<g fill="none" stroke="#0c0e14" stroke-width="3" stroke-linecap="round">
    <path d="M700 512 Q740 560 792 566 Q822 568 830 540 Q836 518 822 470 Q816 448 822 424"/>
    <rect x="812" y="404" width="20" height="22" rx="3" fill="#20242f" stroke="none"/>
    <circle cx="822" cy="412" r="1.6" fill="#0c0e14" stroke="none"/><circle cx="822" cy="418" r="1.6" fill="#0c0e14" stroke="none"/>
  </g>`;
}

function renderRug(isDay, mood) {
  const base = isDay ? "#a3765c" : "#3c3244";
  const ring = isDay ? "#8a5f47" : "#2e2636";
  const accent = mood.accent;
  return `<g>
    <ellipse cx="500" cy="556" rx="360" ry="42" fill="${base}"/>
    <ellipse cx="500" cy="556" rx="360" ry="42" fill="none" stroke="${ring}" stroke-width="8"/>
    <ellipse cx="500" cy="556" rx="300" ry="33" fill="none" stroke="${accent}" stroke-opacity="0.28" stroke-width="3" stroke-dasharray="14 10"/>
    <ellipse cx="500" cy="556" rx="360" ry="42" fill="#000000" fill-opacity="${isDay ? 0.06 : 0.22}"/>
  </g>`;
}

function renderLamp(isDay, mood) {
  const glow = isDay
    ? `<ellipse cx="944" cy="300" rx="60" ry="80" fill="#ffe9b0" fill-opacity="0.08"/>`
    : `<g>
        <ellipse cx="944" cy="330" rx="130" ry="180" fill="#ffb35c" fill-opacity="0.16" filter="url(#softbig)" class="glowpulse"/>
        <polygon points="908,306 980,306 1010,560 878,560" fill="#ffcf8a" fill-opacity="0.10" filter="url(#softbig)"/>
      </g>`;
  const shadeGrad = isDay ? "url(#lampDay)" : "url(#lampNight)";
  const bulb = isDay ? "#f0dca0" : "#ffd9a0";
  return `<g>
    ${glow}
    <ellipse cx="944" cy="570" rx="42" ry="11" fill="#000000" fill-opacity="0.4" filter="url(#soft)"/>
    <rect x="940" y="304" width="8" height="262" rx="3" fill="url(#lampPole)"/>
    <ellipse cx="944" cy="562" rx="34" ry="9" fill="url(#lampBase)"/>
    <path d="M906 306 L982 306 L966 250 L922 250 Z" fill="${shadeGrad}"/>
    <path d="M906 306 L982 306 L966 250 L922 250 Z" fill="none" stroke="#00000033" stroke-width="1.5"/>
    <path d="M922 250 L966 250 L964 258 L924 258 Z" fill="#ffffff" fill-opacity="0.18"/>
    <ellipse cx="944" cy="306" rx="38" ry="7" fill="${bulb}" fill-opacity="0.92"/>
    <ellipse cx="944" cy="306" rx="38" ry="7" fill="${mood.glow}" fill-opacity="${isDay ? 0 : 0.25}"/>
  </g>`;
}

function renderNeonSign(mood) {
  return `<g transform="rotate(-1.5 820 246)">
    <rect x="728" y="210" width="184" height="72" rx="11" fill="#0b0910" fill-opacity="0.55"/>
    <g class="neonpulse" filter="url(#neonGlow)">
      <rect x="728" y="210" width="184" height="72" rx="11" fill="none" stroke="${mood.neon}" stroke-width="2.5"/>
      <text x="820" y="247" font-size="24" fill="${mood.neon}" text-anchor="middle" font-weight="bold" letter-spacing="3">&#9834; ${escapeXml(mood.name)}</text>
    </g>
    <text x="820" y="268" font-size="10" fill="${mood.neon}" text-anchor="middle" letter-spacing="3" opacity="0.85">NOW PLAYING</text>
  </g>`;
}

function renderShelfPlank(x, y, w) {
  return `<g>
    <polygon points="${x},${y} ${x + w},${y} ${x + w + 8},${y - 5} ${x + 8},${y - 5}" fill="url(#plankTop)"/>
    <rect x="${x}" y="${y}" width="${w}" height="10" fill="url(#plankFront)"/>
    <rect x="${x}" y="${y + 10}" width="${w}" height="4" fill="#000000" fill-opacity="0.3"/>
    <rect x="${x + 18}" y="${y + 12}" width="8" height="16" fill="#2f2822"/>
    <rect x="${x + w - 26}" y="${y + 12}" width="8" height="16" fill="#2f2822"/>
  </g>`;
}

function renderVhsShelf(recent) {
  const boxes = Array.from({ length: 4 }, (_, index) => {
    const x = 74 + index * 56;
    const top = 286;
    const h = 70;
    const entry = recent[index];
    if (!entry) {
      return `<g opacity="0.55">
        <polygon points="${x},${top} ${x + 44},${top} ${x + 50},${top - 5} ${x + 6},${top - 5}" fill="none" stroke="#7a6a54" stroke-width="1.2" stroke-dasharray="4 3"/>
        <rect x="${x}" y="${top}" width="44" height="${h}" rx="2" fill="none" stroke="#7a6a54" stroke-width="1.2" stroke-dasharray="4 3"/>
        <text x="${x + 22}" y="${top + 42}" font-size="15" fill="#7a6a54" text-anchor="middle">&#183;&#183;&#183;</text>
      </g>`;
    }
    const grad = ["url(#vhs0)", "url(#vhs1)", "url(#vhs2)", "url(#vhs3)"][index % 4];
    const label = truncate(entry.track, 11);
    const lean = index === 2 ? ` transform="rotate(-7 ${x + 40} ${top + h})"` : "";
    return `<g${lean}>
      <clipPath id="vhsClip${index}"><rect x="${x}" y="${top}" width="44" height="${h}" rx="1.5"/></clipPath>
      <polygon points="${x},${top} ${x + 44},${top} ${x + 50},${top - 5} ${x + 6},${top - 5}" fill="#00000055"/>
      <rect x="${x}" y="${top}" width="44" height="${h}" rx="1.5" fill="${grad}"/>
      <rect x="${x}" y="${top}" width="3" height="${h}" fill="#ffffff" fill-opacity="0.12"/>
      <g clip-path="url(#vhsClip${index})">
        <rect x="${x + 5}" y="${top + 5}" width="34" height="42" rx="1.5" fill="#efe7d4"/>
        <rect x="${x + 5}" y="${top + 5}" width="34" height="8" fill="#00000018"/>
        <text x="${x + 22}" y="${top + 29}" font-size="7" fill="#2c2620" text-anchor="middle" transform="rotate(-90 ${x + 22} ${top + 26})" font-family="'Courier New',monospace">${escapeXml(label)}</text>
      </g>
      <rect x="${x + 8}" y="${top + 54}" width="28" height="8" rx="1" fill="#2a2620" fill-opacity="0.5"/>
    </g>`;
  }).join("");
  return `<g>
    <text x="74" y="278" font-size="10" fill="url(#labelInk)" letter-spacing="2" font-weight="bold">&#9660; RECENTLY PLAYED</text>
    ${boxes}
    ${renderShelfPlank(62, 356, 248)}
  </g>`;
}

function renderCassetteWall(languages) {
  const slots = Array.from({ length: 4 }, (_, index) => {
    const x = 686 + index * 60;
    const y = 116;
    const entry = languages[index];
    if (!entry) {
      return `<g opacity="0.55">
        <polygon points="${x},${y} ${x + 54},${y} ${x + 58},${y - 4} ${x + 4},${y - 4}" fill="none" stroke="#7a6a54" stroke-width="1" stroke-dasharray="3 3"/>
        <rect x="${x}" y="${y}" width="54" height="34" rx="3" fill="none" stroke="#7a6a54" stroke-width="1" stroke-dasharray="3 3"/>
      </g>`;
    }
    const grad = ["url(#cas0)", "url(#cas1)", "url(#cas2)", "url(#cas3)"][index % 4];
    return `<g>
      <polygon points="${x},${y} ${x + 54},${y} ${x + 58},${y - 4} ${x + 4},${y - 4}" fill="#00000066"/>
      <rect x="${x}" y="${y}" width="54" height="34" rx="3" fill="${grad}"/>
      <rect x="${x}" y="${y}" width="54" height="3" rx="1" fill="#ffffff" fill-opacity="0.14"/>
      <rect x="${x + 5}" y="${y + 4}" width="44" height="15" rx="2" fill="#efe7d4"/>
      <text x="${x + 27}" y="${y + 14}" font-size="8" fill="#2a2620" text-anchor="middle" font-family="'Courier New',monospace" font-weight="bold">${escapeXml(truncate(entry.name, 8))}</text>
      <rect x="${x + 7}" y="${y + 22}" width="40" height="9" rx="1.5" fill="#15131a"/>
      <circle cx="${x + 19}" cy="${y + 26.5}" r="3.2" fill="#3a3742"/><circle cx="${x + 19}" cy="${y + 26.5}" r="1.3" fill="#5a5666"/>
      <circle cx="${x + 35}" cy="${y + 26.5}" r="3.2" fill="#3a3742"/><circle cx="${x + 35}" cy="${y + 26.5}" r="1.3" fill="#5a5666"/>
      <text x="${x + 27}" y="${y + 29}" font-size="6.5" fill="#c9b98a" text-anchor="middle" font-family="'Courier New',monospace">${entry.pct}%</text>
    </g>`;
  }).join("");
  return `<g>
    <text x="686" y="110" font-size="10" fill="url(#labelInk)" letter-spacing="2" font-weight="bold">&#9660; TOP LANGUAGES</text>
    ${slots}
    ${renderShelfPlank(676, 152, 262)}
  </g>`;
}

function renderTv(scene) {
  const { mood } = scene;
  const screenArt = renderScreenArt(scene.albumDataUri);
  const trackMarkup = renderTrackText(scene.track);
  const artistLine = escapeXml(truncate(scene.artist, 20));
  const eqBars = renderEqBars(mood);
  const ticker = renderTicker(scene.ticker);

  const speaker = Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 3 }, (_, col) => {
      const cx = 632 + col * 20;
      const cy = 288 + row * 24;
      return `<circle cx="${cx}" cy="${cy}" r="3" fill="#1a1712"/>`;
    }).join("")
  ).join("");

  const grain = Array.from({ length: 9 }, (_, i) => {
    const gx = 326 + i * 44;
    return `<rect x="${gx}" y="242" width="1.5" height="270" fill="#000000" fill-opacity="0.06"/>`;
  }).join("");

  return `<g transform="rotate(-1 518 400)">
    <ellipse cx="520" cy="580" rx="230" ry="18" fill="#000000" fill-opacity="0.38" filter="url(#softbig)"/>

    <g stroke="url(#antenna)" stroke-width="2.5" stroke-linecap="round" fill="none">
      <path d="M470 236 L420 190"/>
      <path d="M540 236 L600 198"/>
    </g>
    <circle cx="418" cy="188" r="5" fill="#d6d6d6"/>
    <circle cx="602" cy="196" r="5" fill="#d6d6d6"/>

    <g>
      <rect x="348" y="514" width="326" height="52" rx="5" fill="url(#tvStand)"/>
      <rect x="348" y="514" width="326" height="7" rx="3" fill="#ffffff" fill-opacity="0.08"/>
      <rect x="366" y="530" width="130" height="26" rx="3" fill="#000000" fill-opacity="0.25"/>
      <circle cx="431" cy="543" r="3" fill="#c9a86a" fill-opacity="0.6"/>
      <rect x="516" y="530" width="140" height="26" rx="3" fill="#000000" fill-opacity="0.18"/>
      <rect x="524" y="536" width="52" height="15" rx="2" fill="#15131a"/>
      <rect x="584" y="536" width="24" height="15" rx="2" fill="#efe7d4" fill-opacity="0.25"/>
      <rect x="356" y="566" width="12" height="14" fill="#1c150f"/>
      <rect x="654" y="566" width="12" height="14" fill="#1c150f"/>
    </g>

    <rect x="316" y="238" width="404" height="278" rx="16" fill="url(#tvBody)" stroke="#1c150f" stroke-width="2"/>
    ${grain}
    <rect x="319" y="241" width="398" height="4" rx="2" fill="#ffffff" fill-opacity="0.14"/>
    <path d="M316 254 Q316 238 332 238" fill="none" stroke="#6a5442" stroke-width="2" stroke-opacity="0.5"/>
    <rect x="316" y="238" width="404" height="278" rx="16" fill="url(#tvSheen)"/>
    <g class="rec">
      <circle cx="690" cy="256" r="5" fill="#ff3b30" filter="url(#neonGlow)"/>
      <text x="654" y="260" font-size="9" fill="#ff6b63" letter-spacing="1">REC</text>
    </g>

    <rect x="344" y="256" width="264" height="212" rx="14" fill="#0a0a0a"/>
    <rect x="350" y="262" width="252" height="200" rx="11" fill="url(#screenGlow)"/>
    <rect x="350" y="262" width="252" height="200" rx="11" fill="none" stroke="${mood.accent}" stroke-width="2" stroke-opacity="0.5" class="borderglow"/>

    <g clip-path="url(#screenClip)">
      ${screenArt}
      <text x="360" y="277" font-size="9" fill="#66e0a0" fill-opacity="0.85" letter-spacing="1">CH-05 &#9834; NOW PLAYING</text>
      ${trackMarkup}
      <text x="527" y="322" font-size="11" fill="#7fe0aa" text-anchor="middle" class="phosphor">${artistLine}</text>
      ${eqBars}
      <g fill="#bafcd4" text-anchor="middle" font-size="17">
        <text x="452" y="404">&#9665;</text>
        <text x="476" y="404">&#9208;</text>
        <text x="500" y="404">&#9655;</text>
      </g>
      ${ticker}
      <rect x="350" y="262" width="252" height="200" fill="url(#scanlines)" class="scandrift"/>
      <rect x="350" y="262" width="252" height="200" rx="11" fill="url(#vignette)"/>
      <rect x="350" y="262" width="252" height="200" rx="11" fill="#9effc4" class="flicker"/>
      <path d="M368 268 Q450 262 594 276 L594 262 L368 262 Z" fill="#ffffff" fill-opacity="0.05"/>
    </g>

    <g>${speaker}</g>
    <circle cx="672" cy="424" r="22" fill="#1a140e" stroke="#5a4a3a" stroke-width="2"/>
    <circle cx="672" cy="424" r="11" fill="#2c2219" stroke="#6a5540" stroke-width="1.5"/>
    <line x1="672" y1="424" x2="672" y2="415" stroke="#d8b878" stroke-width="2" stroke-linecap="round"/>
    <text x="672" y="458" font-size="8" fill="#8a7355" text-anchor="middle" letter-spacing="1">CH</text>
    <text x="352" y="500" font-size="9" fill="#c9a86a" fill-opacity="0.8" letter-spacing="2">RETROTONE</text>
  </g>`;
}

const GIRL = { x: 6, y: 382, w: 350, h: 203 };
const GIRL_KEYTIMES = "0;0.12;0.24;0.36;1";
const GIRL_FRAME_VALUES = ["1;0;0;0;0", "0;1;0;0;0", "0;0;1;0;0", "0;0;0;1;1"];

function loadGirlFrames() {
  const frames = [];
  for (let i = 1; i <= 4; i++) {
    const path = `assets/girl/frame-${i}.png`;
    if (!existsSync(path)) return null;
    try {
      frames.push(`data:image/png;base64,${readFileSync(path).toString("base64")}`);
    } catch (error) {
      console.log(`⚠️ Could not read ${path}:`, error.message);
      return null;
    }
  }
  return frames;
}

function renderGirl(isDay, mood, frames) {
  if (!frames) {
    return `<ellipse cx="${GIRL.x + GIRL.w / 2}" cy="${GIRL.y + GIRL.h}" rx="120" ry="16" fill="#000000" fill-opacity="0.25" filter="url(#soft)"/>`;
  }
  const shadow = `<ellipse cx="${GIRL.x + GIRL.w * 0.36}" cy="${GIRL.y + GIRL.h - 4}" rx="130" ry="14" fill="#000000" fill-opacity="0.32" filter="url(#softbig)"/>`;
  const floorPool = isDay
    ? ""
    : `<ellipse cx="${GIRL.x + GIRL.w * 0.42}" cy="${GIRL.y + GIRL.h - 2}" rx="120" ry="20" fill="${mood.glow}" fill-opacity="0.07" filter="url(#softbig)"/>`;
  const images = frames
    .map(
      (uri, i) =>
        `<image id="girl-frame-${i + 1}" href="${uri}" x="${GIRL.x}" y="${GIRL.y}" width="${GIRL.w}" height="${GIRL.h}" opacity="${i === 3 ? 1 : 0}"><animate attributeName="opacity" values="${GIRL_FRAME_VALUES[i]}" keyTimes="${GIRL_KEYTIMES}" calcMode="discrete" dur="1.25s" repeatCount="indefinite"/></image>`
    )
    .join("");
  return `<g>
    ${shadow}
    ${floorPool}
    ${images}
  </g>`;
}

function renderScreenCast(isDay, mood) {
  if (isDay) return "";
  return `<ellipse cx="476" cy="524" rx="240" ry="72" fill="url(#screenCast)" opacity="0.45"/>`;
}

function renderFloor(isDay) {
  const planks = Array.from({ length: 7 }, (_, i) => {
    const x0 = 60 + i * 140;
    const spread = (x0 - 500) * 0.22;
    return `<line x1="${x0}" y1="${HORIZON}" x2="${x0 + spread}" y2="600" stroke="#000000" stroke-opacity="${isDay ? 0.10 : 0.16}" stroke-width="2"/>`;
  }).join("");
  const boards = Array.from({ length: 3 }, (_, i) => {
    const y = HORIZON + 44 + i * 52;
    return `<line x1="0" y1="${y}" x2="1000" y2="${y}" stroke="#000000" stroke-opacity="${isDay ? 0.06 : 0.1}" stroke-width="1.5"/>`;
  }).join("");
  return `<g>
    <rect y="${HORIZON}" width="1000" height="${600 - HORIZON}" fill="${isDay ? "url(#dayFloor)" : "url(#nightFloor)"}"/>
    ${planks}
    ${boards}
    <rect y="${HORIZON - 10}" width="1000" height="10" fill="${isDay ? "url(#baseboardDay)" : "url(#baseboardNight)"}"/>
    <rect y="${HORIZON}" width="1000" height="6" fill="#000000" fill-opacity="0.35"/>
    <rect y="${HORIZON}" width="1000" height="${600 - HORIZON}" fill="url(#grain)" opacity="${isDay ? 0.04 : 0.06}"/>
    <rect y="${HORIZON}" width="1000" height="60" fill="url(#floorAo)"/>
  </g>`;
}

function renderSceneSvg(scene, girlFrames) {
  const { isDay, mood } = scene;
  const wallFill = isDay ? "url(#dayWall)" : "url(#nightWall)";
  const wallGrainOpacity = isDay ? 0.05 : 0.07;
  const sceneVignetteId = isDay ? "sceneVignetteDay" : "sceneVignetteNight";
  const ariaLabel = escapeXml(
    `Retro room, ${isDay ? "day" : "night"}, CRT TV now playing ${scene.track} by ${scene.artist}`
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" width="1000" height="600" font-family="'Courier New',monospace" role="img" aria-label="${ariaLabel}">
  <defs>
    <linearGradient id="dayWall" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0" stop-color="#e6d2ac"/><stop offset="0.55" stop-color="#cfb58c"/><stop offset="1" stop-color="#b39a74"/></linearGradient>
    <linearGradient id="nightWall" x1="0" y1="0" x2="0.15" y2="1"><stop offset="0" stop-color="#272c3a"/><stop offset="0.55" stop-color="#1b1f2b"/><stop offset="1" stop-color="#121520"/></linearGradient>
    <linearGradient id="dayFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c2a67f"/><stop offset="1" stop-color="#8f7452"/></linearGradient>
    <linearGradient id="nightFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e222e"/><stop offset="1" stop-color="#0e1118"/></linearGradient>
    <linearGradient id="baseboardDay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a08464"/><stop offset="1" stop-color="#7a6248"/></linearGradient>
    <linearGradient id="baseboardNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2330"/><stop offset="1" stop-color="#0d0f16"/></linearGradient>
    <linearGradient id="floorAo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000000" stop-opacity="0.30"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></linearGradient>
    <linearGradient id="goldenSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb0d0"/><stop offset="0.5" stop-color="#e8b87a"/><stop offset="1" stop-color="#f5a35c"/></linearGradient>
    <linearGradient id="curtain" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${isDay ? "#c07a5e" : "#4a4152"}"/><stop offset="0.5" stop-color="${isDay ? "#a5604a" : "#3a3344"}"/><stop offset="1" stop-color="${isDay ? "#8a4b3e" : "#2c2736"}"/></linearGradient>
    <linearGradient id="curtainRod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a5c50"/><stop offset="1" stop-color="#3c332c"/></linearGradient>
    <linearGradient id="poster" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0" stop-color="${isDay ? "#efe3c4" : "#262b3d"}"/><stop offset="1" stop-color="${isDay ? "#d8c6a0" : "#1b2030"}"/></linearGradient>
    <linearGradient id="pot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${isDay ? "#b06e4a" : "#5a4038"}"/><stop offset="1" stop-color="${isDay ? "#8a5238" : "#3a2a26"}"/></linearGradient>
    <linearGradient id="potRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${isDay ? "#c47e56" : "#6a4c42"}"/><stop offset="1" stop-color="${isDay ? "#9a5e40" : "#46322c"}"/></linearGradient>
    <linearGradient id="screenBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mood.glow}" stop-opacity="0.14"/><stop offset="1" stop-color="${mood.glow}" stop-opacity="0"/></linearGradient>
    <linearGradient id="tvSheen" x1="0" y1="0" x2="1" y2="0.2"><stop offset="0" stop-color="#ffffff" stop-opacity="0.06"/><stop offset="0.25" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.8" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.18"/></linearGradient>
    <linearGradient id="girlRim" x1="1" y1="0.3" x2="0" y2="0.6"><stop offset="0" stop-color="${mood.glow}" stop-opacity="0.30"/><stop offset="0.35" stop-color="${mood.glow}" stop-opacity="0.06"/><stop offset="1" stop-color="${mood.glow}" stop-opacity="0"/></linearGradient>
    <linearGradient id="dayGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bcd0d2"/><stop offset="0.6" stop-color="#d6e2dc"/><stop offset="1" stop-color="#e6ebe2"/></linearGradient>
    <linearGradient id="nightGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e1830"/><stop offset="0.6" stop-color="#1a2645"/><stop offset="1" stop-color="#243257"/></linearGradient>
    <linearGradient id="windowFrame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${isDay ? "#6a5646" : "#3a3038"}"/><stop offset="1" stop-color="${isDay ? "#463628" : "#241c26"}"/></linearGradient>
    <linearGradient id="windowSill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${isDay ? "#7a6450" : "#443a44"}"/><stop offset="1" stop-color="${isDay ? "#4a3826" : "#221c26"}"/></linearGradient>
    <linearGradient id="muntin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${isDay ? "#7a6450" : "#443a44"}"/><stop offset="0.5" stop-color="${isDay ? "#5a4634" : "#2e2632"}"/><stop offset="1" stop-color="${isDay ? "#4a3826" : "#221c26"}"/></linearGradient>
    <linearGradient id="dayBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4" stop-opacity="0.55"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></linearGradient>
    <linearGradient id="tvBody" x1="0" y1="0" x2="0.1" y2="1"><stop offset="0" stop-color="#4c3d31"/><stop offset="0.5" stop-color="#3c3025"/><stop offset="1" stop-color="#2c2219"/></linearGradient>
    <linearGradient id="tvStand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3e3024"/><stop offset="1" stop-color="#281e15"/></linearGradient>
    <linearGradient id="antenna" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6a6a6a"/><stop offset="0.5" stop-color="#cfcfcf"/><stop offset="1" stop-color="#8a8a8a"/></linearGradient>
    <linearGradient id="screenGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1f18"/><stop offset="1" stop-color="#050b08"/></linearGradient>
    <linearGradient id="plankTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${isDay ? "#7a6248" : "#463a3e"}"/><stop offset="1" stop-color="${isDay ? "#5f4a34" : "#332a2e"}"/></linearGradient>
    <linearGradient id="plankFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${isDay ? "#5a4632" : "#2e2529"}"/><stop offset="1" stop-color="${isDay ? "#3f3020" : "#1e181c"}"/></linearGradient>
    <linearGradient id="lampDay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6d6b2"/><stop offset="1" stop-color="#b89a68"/></linearGradient>
    <linearGradient id="lampNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8c890"/><stop offset="1" stop-color="#b08850"/></linearGradient>
    <linearGradient id="lampPole" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a4048"/><stop offset="0.5" stop-color="#6a606a"/><stop offset="1" stop-color="#3a3038"/></linearGradient>
    <radialGradient id="lampBase" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="#4a4048"/><stop offset="1" stop-color="#241f26"/></radialGradient>
    <linearGradient id="labelInk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${isDay ? "#8a7355" : "#9a92a8"}"/><stop offset="1" stop-color="${isDay ? "#6a563c" : "#6a6480"}"/></linearGradient>
    ${["#3d5a80,#274060", "#8d5524,#5f3616", "#5a3d6b,#3a2648", "#3d6b4f,#254733"].map((pair, i) => { const [a, b] = pair.split(","); return `<linearGradient id="vhs${i}" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`; }).join("")}
    ${["#2f2d38,#1c1a24", "#38302f,#221c1b", "#2c3634,#181f1d", "#332c38,#1e1824"].map((pair, i) => { const [a, b] = pair.split(","); return `<linearGradient id="cas${i}" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`; }).join("")}
    <radialGradient id="screenCast" cx="0.5" cy="0.15" r="0.85"><stop offset="0" stop-color="#9effd0" stop-opacity="0.5"/><stop offset="1" stop-color="#9effd0" stop-opacity="0"/></radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.72"/></radialGradient>
    <radialGradient id="sceneVignetteDay" cx="0.5" cy="0.46" r="0.72"><stop offset="0.6" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#1a1206" stop-opacity="0.28"/></radialGradient>
    <radialGradient id="sceneVignetteNight" cx="0.5" cy="0.46" r="0.72"><stop offset="0.5" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#05060a" stop-opacity="0.55"/></radialGradient>
    <clipPath id="screenClip"><rect x="350" y="262" width="252" height="200" rx="11"/></clipPath>
    <clipPath id="artClip"><rect x="360" y="284" width="84" height="84" rx="4"/></clipPath>
    <clipPath id="trackClip"><rect x="458" y="290" width="140" height="20"/></clipPath>
    <clipPath id="tickerClip"><rect x="350" y="440" width="252" height="22"/></clipPath>
    <clipPath id="glassClip"><rect x="70" y="62" width="230" height="180"/></clipPath>
    <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000000" fill-opacity="0.28"/></pattern>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="softbig" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="neonGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
    <style>
      .flicker { animation: flicker 0.18s steps(3) infinite; }
      @keyframes flicker { 0% { opacity: 0.04; } 40% { opacity: 0.09; } 70% { opacity: 0.03; } 100% { opacity: 0.07; } }
      .scandrift { animation: scandrift 6s linear infinite; }
      @keyframes scandrift { from { transform: translateY(0); } to { transform: translateY(4px); } }
      .rec { animation: recblink 1.2s steps(1) infinite; }
      @keyframes recblink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0.15; } }
      .eqbar { transform-box: fill-box; transform-origin: 50% 100%; animation: eq 0.9s ease-in-out infinite; }
      @keyframes eq { 0%, 100% { transform: scaleY(0.28); } 50% { transform: scaleY(1); } }
      .twinkle { animation: twinkle 2.4s ease-in-out infinite; }
      @keyframes twinkle { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
      .mote { animation: mote 10s linear infinite; }
      @keyframes mote { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 0.35; } 85% { opacity: 0.3; } 100% { transform: translateY(-46px); opacity: 0; } }
      .glowpulse { animation: glowpulse 4s ease-in-out infinite; }
      @keyframes glowpulse { 0%, 100% { opacity: 0.85; } 50% { opacity: 1; } }
      .neonpulse { animation: neonpulse 2.6s ease-in-out infinite; }
      @keyframes neonpulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.72; } }
      .borderglow { animation: borderglow 3s ease-in-out infinite; }
      @keyframes borderglow { 0%, 100% { stroke-opacity: 0.35; } 50% { stroke-opacity: 0.7; } }
      .phosphor { paint-order: stroke; }
    </style>
  </defs>

  <rect width="1000" height="600" fill="${wallFill}"/>
  <rect width="1000" height="600" fill="url(#grain)" opacity="${wallGrainOpacity}"/>
  ${renderWindow(isDay)}
  ${renderNeonSign(mood)}
  ${renderCassetteWall(scene.languages)}
  ${renderVhsShelf(scene.recent)}

  ${renderFloor(isDay)}
  ${renderRoomLight(isDay, mood)}
  ${renderScreenCast(isDay, mood)}
  ${renderRug(isDay, mood)}

  ${renderCable()}
  ${renderPlant(isDay)}
  ${renderLamp(isDay, mood)}
  ${renderTv(scene)}
  ${renderGirl(isDay, mood, girlFrames)}
  ${renderDustMotes(isDay)}
  ${renderFairyLights(isDay, mood)}

  <rect width="1000" height="600" fill="${isDay ? "#ff9a3c" : "#1b2340"}" opacity="${isDay ? 0.05 : 0.12}"/>
  <rect width="1000" height="600" fill="url(#${sceneVignetteId})"/>
</svg>
`;
}

function buildReadme(scene, epochSeconds) {
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `<div align="center">

# Lynchz

**CS student · J-rock &amp; metal listener · TypeScript developer**

<img src="./${SVG_FILE}?v=${epochSeconds}" width="760" alt="Retro room scene with a CRT television now playing my latest Spotify track" />

[GitHub · @LynchzDEV](https://github.com/LynchzDEV)

<sub>Auto-updated via GitHub Actions · Last sync: ${timestamp}</sub>

</div>
`;
}

async function main() {
  const isSample = process.argv[2] === "--sample";
  const sampleName = isSample ? process.argv[3] : null;

  const scene = isSample
    ? await buildSampleScene(sampleName)
    : await buildLiveScene();

  console.log("🎬 Scene:");
  console.log("  Track:", scene.track, "—", scene.artist);
  console.log("  Phase:", scene.isDay ? "day" : "night");
  console.log("  Mood:", scene.mood.name, `(genres: ${(scene.genres || []).join(", ") || "none"})`);
  console.log("  Recent:", scene.recent.length, "| Ticker:", scene.ticker.length, "| Languages:", scene.languages.length);

  const hash = sceneHash(scene);
  if (!isSample && isSameScene(hash)) {
    console.log("🔄 No scene inputs changed, skipping update");
    process.exit(0);
  }

  const girlFrames = loadGirlFrames();
  if (!girlFrames) {
    console.log("⚠️ Girl frames missing in assets/girl/; rendering scene without character.");
  }

  const epochSeconds = Math.floor(Date.now() / 1000);
  const svg = renderSceneSvg(scene, girlFrames);
  const readme = buildReadme(scene, epochSeconds);

  try {
    writeFileSync(SVG_FILE, svg);
    writeFileSync("README.md", readme);
    saveScene(scene, hash);
    console.log("✅ README + SVG updated successfully!");
  } catch (error) {
    console.error("❌ Error writing output:", error);
    process.exit(1);
  }
}

await main();
