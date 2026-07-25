import { writeFileSync, readFileSync, existsSync } from "fs";
import { createHash } from "node:crypto";
import { renderPlate } from "./render/plate.mjs";
import {
  fetchWeather,
  fetchDevLife,
  fetchContributions,
  fetchRecentCommits,
  pickChannel,
  summarizeMood,
} from "./render/data-sources.mjs";
import {
  GIRL,
  PLATE,
  SCREEN,
  escapeXml,
  overlayDefs,
  overlayStyle,
  renderDustLayer,
  renderGirlLayer,
  renderRainLayer,
  renderScreenLayer,
} from "./render/overlay.mjs";

const STATE_FILE = ".last-song.json";
const SVG_FILE = "spotify-tv.svg";
const GITHUB_USER = "LynchzDEV";
const FALLBACK_ART =
  "https://i.scdn.co/image/ab67616d0000b273ec61804d798b2c42fe23f7c3";

const fallbackTrack = {
  track: "I'm getting on the bus to the other world, see ya!",
  artist: "TUYU",
  image: FALLBACK_ART,
};

function moodFromGenres(genres) {
  const blob = (genres || []).join(" ").toLowerCase();
  if (/metal|rock|punk|hardcore|emo|grunge|screamo/.test(blob)) {
    return { name: "ROCK", glow: "#ff4d6a", neon: "#ff5470", accent: "#ff3b5c" };
  }
  if (/j-?pop|anime|idol|kawaii|vocaloid|city ?pop|shibuya|denpa/.test(blob)) {
    return { name: "J-POP", glow: "#ff8fd0", neon: "#7cf5ff", accent: "#ff8fd0" };
  }
  return { name: "CHILL", glow: "#ffb347", neon: "#ffcf6b", accent: "#ffb347" };
}

function bangkokClock() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hours = Number(parts.find((part) => part.type === "hour")?.value ?? 12);
  const minutes = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return { hours: hours % 24, minutes };
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
    console.log("⚠️ Album art fetch failed, drawing placeholder:", error.message);
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

async function fetchSpotifyScene(token) {
  const result = {
    track: fallbackTrack.track,
    artist: fallbackTrack.artist,
    image: fallbackTrack.image,
    artistId: null,
    hasTrack: false,
    recent: [],
    genres: [],
  };
  if (!token) {
    console.log("ℹ️ No Spotify token; using fallback track.");
    return result;
  }

  try {
    const current = await spotifyGet(token, "/me/player/currently-playing");
    if (current?.item) {
      result.track = current.item.name;
      result.artist = current.item.artists?.[0]?.name || "";
      result.image = current.item.album?.images?.[0]?.url || fallbackTrack.image;
      result.artistId = current.item.artists?.[0]?.id || null;
      result.hasTrack = true;
    }
  } catch (error) {
    console.log("⚠️ currently-playing failed:", error.message);
  }

  try {
    const recent = await spotifyGet(token, "/me/player/recently-played?limit=5");
    const mapped = (recent?.items || []).map((entry) => ({
      track: entry.track?.name || "",
      artist: entry.track?.artists?.[0]?.name || "",
      artistId: entry.track?.artists?.[0]?.id || null,
      image: entry.track?.album?.images?.[0]?.url || null,
    }));
    if (!result.hasTrack && mapped[0]) {
      result.track = mapped[0].track;
      result.artist = mapped[0].artist;
      result.image = mapped[0].image || fallbackTrack.image;
      result.artistId = mapped[0].artistId;
      result.hasTrack = true;
    }
    result.recent = mapped
      .filter(
        (entry) => !(entry.track === result.track && entry.artist === result.artist)
      )
      .slice(0, 4);
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

async function fetchTopArtist(token) {
  if (!token) return null;
  try {
    const response = await fetch(
      "https://api.spotify.com/v1/me/top/artists?limit=1&time_range=short_term",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.status === 403) {
      console.log("ℹ️ top-artists needs the user-top-read scope; poster stays empty.");
      return null;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const artist = (await response.json()).items?.[0];
    if (!artist) return null;
    const imageUrl = artist.images?.[artist.images.length - 1]?.url;
    const image = imageUrl ? await fetchAlbumArtDataUri(imageUrl) : null;
    return { name: artist.name, image };
  } catch (error) {
    console.log("⚠️ top artist fetch failed:", error.message);
    return null;
  }
}

async function fetchLanguageStats(githubToken) {
  try {
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": `${GITHUB_USER}-readme`,
    };
    if (githubToken) headers.Authorization = `Bearer ${githubToken}`;
    const response = await fetch(
      `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&type=owner&sort=pushed`,
      { headers }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const repos = (await response.json()).filter((repo) => !repo.fork).slice(0, 20);
    const totals = {};
    for (const repo of repos) {
      try {
        const languages = await fetch(
          `https://api.github.com/repos/${repo.full_name}/languages`,
          { headers }
        ).then((r) => (r.ok ? r.json() : {}));
        for (const [name, bytes] of Object.entries(languages)) {
          totals[name] = (totals[name] || 0) + bytes;
        }
      } catch {
        continue;
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

function readState() {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch (error) {
    console.log("⚠️ Could not read state file:", error.message);
    return {};
  }
}

function sceneHash(scene) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        track: scene.track,
        artist: scene.artist,
        phase: scene.phase,
        mood: scene.mood.name,
        channel: scene.channel.id,
        recent: scene.recent,
        commits: scene.commits,
        languages: scene.languages,
        contributions: scene.contributions?.days?.slice(-7),
        weather: [
          scene.weather?.condition,
          Math.round(scene.weather?.tempC ?? 0),
          scene.weather?.isRain,
        ],
        clock: scene.clock.hours,
        topArtist: scene.topArtist?.name || null,
        coffeeCups: scene.coffeeCups,
        tiredMode: scene.tiredMode,
        streakTier: scene.streakTier,
      })
    )
    .digest("hex");
}

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

async function buildScene() {
  const spotifyToken = process.env.SPOTIFY_ACCESS_TOKEN || "";
  const githubToken = process.env.GITHUB_TOKEN || "";
  const previous = readState();

  const [spotify, weather, devLife, contributions, commits, languages, topArtist] =
    await Promise.all([
      fetchSpotifyScene(spotifyToken),
      fetchWeather(),
      fetchDevLife(githubToken),
      fetchContributions(githubToken),
      fetchRecentCommits(githubToken),
      fetchLanguageStats(githubToken),
      fetchTopArtist(spotifyToken),
    ]);

  const albumDataUri = await fetchAlbumArtDataUri(spotify.image);
  const mood = moodFromGenres(spotify.genres);
  const channel = pickChannel(previous.channelIndex, { hasTrack: spotify.hasTrack });
  const summary = summarizeMood(weather, devLife, contributions);

  return {
    track: spotify.track,
    artist: spotify.artist,
    hasTrack: spotify.hasTrack,
    albumDataUri,
    recent: spotify.recent,
    genres: spotify.genres,
    mood,
    weather,
    devLife,
    contributions,
    commits,
    languages,
    channel,
    topArtist,
    phase: weather.phase,
    clock: bangkokClock(),
    ...summary,
  };
}

function plateParams(scene) {
  return {
    phase: scene.phase,
    mood: scene.mood,
    weather: {
      cloudCover: scene.weather?.cloudCover ?? 20,
      isRain: scene.weather?.isRain ?? false,
    },
    recent: scene.recent,
    languages: scene.languages,
    streakTier: scene.streakTier,
    coffeeCups: scene.coffeeCups,
    tiredMode: scene.tiredMode,
    clock: scene.clock,
    poster: scene.topArtist,
    girlTexture: null,
  };
}

function composeSvg(scene, plateBytes, girlFrames) {
  const isNight = scene.phase === "night";
  const plateUri = `data:image/png;base64,${plateBytes.toString("base64")}`;
  const ariaLabel = escapeXml(
    `3D retro room in ${scene.phase} light, Bangkok ${scene.weather?.condition || ""} ${Math.round(scene.weather?.tempC ?? 0)}C, CRT television on channel ${scene.channel.id} showing ${scene.channel.id === "CH-05" ? `${scene.track} by ${scene.artist}` : scene.channel.label}${scene.topArtist?.name ? `, framed poster of ${scene.topArtist.name}` : ""}`
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PLATE.width} ${PLATE.height}" width="${PLATE.width}" height="${PLATE.height}" font-family="'Courier New',monospace" role="img" aria-label="${ariaLabel}">
  <defs>${overlayDefs(scene.mood)}
    <style>${overlayStyle()}</style>
  </defs>

  <image href="${plateUri}" x="0" y="0" width="${PLATE.width}" height="${PLATE.height}"/>
  ${renderRainLayer(scene.weather)}
  ${renderScreenLayer(scene)}
  <ellipse cx="${SCREEN.centerX.toFixed(1)}" cy="${(SCREEN.y + SCREEN.height * 1.9).toFixed(1)}" rx="${(SCREEN.width * 1.5).toFixed(1)}" ry="${(SCREEN.height * 0.8).toFixed(1)}" fill="url(#screenBleed)" opacity="${isNight ? 0.75 : 0.3}"/>
  ${renderGirlLayer(girlFrames)}
  ${renderDustLayer(isNight)}
  <ellipse cx="${GIRL.centerX.toFixed(1)}" cy="${(GIRL.y + GIRL.height).toFixed(1)}" rx="${(GIRL.width * 0.42).toFixed(1)}" ry="12" fill="#000000" fill-opacity="0.2"/>
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
  const weatherLine = `${Math.round(scene.weather?.tempC ?? 0)}°C ${scene.weather?.condition || "CLEAR"}`;
  const posterLine = scene.topArtist?.name
    ? ` · on the wall: ${scene.topArtist.name}`
    : "";
  return `<div align="center">

# Lynchz

**CS student · J-rock &amp; metal listener · TypeScript developer**

<img src="./${SVG_FILE}?v=${epochSeconds}" width="820" alt="Rendered 3D room where a CRT television shows what I am listening to right now" />

<sub>Bangkok ${weatherLine} · ${scene.channel.id} ${scene.channel.label}${posterLine} · rebuilt in 3D every 10 min by GitHub Actions</sub>

[GitHub · @LynchzDEV](https://github.com/LynchzDEV)

<sub>Last sync: ${timestamp}</sub>

</div>
`;
}

const PREVIEW_CHANNELS = {
  "CH-05": "NOW PLAYING",
  "CH-02": "COMMIT GRAPH",
  "CH-07": "LANG STATS",
  "CH-11": "WEATHER RADAR",
  "CH-88": "NO SIGNAL",
};

async function buildPreviewScene(phase, channelId) {
  const [weather, contributions, commits, albumDataUri] = await Promise.all([
    fetchWeather(),
    fetchContributions(process.env.GITHUB_TOKEN || ""),
    fetchRecentCommits(process.env.GITHUB_TOKEN || ""),
    fetchAlbumArtDataUri(FALLBACK_ART),
  ]);
  const genres = phase === "night" ? ["j-pop", "vocaloid"] : ["thrash metal"];
  return {
    track: phase === "night" ? "Young Girl A" : "Master of Puppets",
    artist: phase === "night" ? "Siinamota" : "Metallica",
    hasTrack: channelId !== "CH-88",
    albumDataUri,
    recent: [
      { track: "nigera no hanataba", artist: "sana" },
      { track: "Connect the World", artist: "Nanatsukaze" },
      { track: "my crush", artist: "Kashi Moimi" },
      { track: "少女A & more", artist: "Siinamota" },
    ],
    genres,
    mood: moodFromGenres(genres),
    weather: { ...weather, phase },
    devLife: { lateNightPushes: 2, prsMerged: 1, activeRepos: 7, newestRepo: null },
    contributions,
    commits,
    languages: [
      { name: "TypeScript", pct: 53 },
      { name: "Go", pct: 24 },
      { name: "HTML", pct: 9 },
      { name: "Ruby", pct: 5 },
    ],
    channel: { id: channelId, label: PREVIEW_CHANNELS[channelId], index: 0 },
    phase,
    clock: bangkokClock(),
    tiredMode: true,
    streakTier: 2,
    coffeeCups: 3,
    wetWindow: weather.isRain,
  };
}

async function runPreview(phase, channelId) {
  const scene = await buildPreviewScene(phase, channelId);
  const plateBytes = await renderPlate(plateParams(scene), `.cache/plate-${phase}.png`);
  const svg = composeSvg(scene, plateBytes, loadGirlFrames());
  const output = `.cache/preview-${phase}-${channelId}.svg`;
  writeFileSync(output, svg);
  console.log(`🖼️ ${output} (${svg.length} bytes, plate ${plateBytes.length}b)`);
}

async function main() {
  if (process.argv[2] === "--preview") {
    const phase = process.argv[3] || "night";
    const channels = process.argv[4] ? [process.argv[4]] : Object.keys(PREVIEW_CHANNELS);
    for (const channelId of channels) {
      await runPreview(phase, channelId);
    }
    return;
  }

  if (!process.env.SPOTIFY_ACCESS_TOKEN && process.argv[2] !== "--allow-tokenless") {
    console.log(
      "⛔ No SPOTIFY_ACCESS_TOKEN, refusing to publish a degraded scene. Use --preview to iterate or --allow-tokenless to force."
    );
    process.exit(0);
  }

  const scene = await buildScene();

  console.log("🎬 Scene:");
  console.log("  Track:", scene.track, "—", scene.artist, scene.hasTrack ? "" : "(fallback)");
  console.log("  Phase:", scene.phase, "| Mood:", scene.mood.name, "| Channel:", scene.channel.id);
  console.log("  Weather:", scene.weather?.condition, `${Math.round(scene.weather?.tempC ?? 0)}°C`, scene.weather?.isRain ? "(rain)" : "");
  console.log("  Streak:", scene.contributions?.streakDays, "| Today:", scene.contributions?.commitsToday, "| Commits on ticker:", scene.commits?.length);

  const hash = sceneHash(scene);
  const previous = readState();
  if (previous.hash === hash && existsSync(SVG_FILE)) {
    console.log("🔄 No scene inputs changed, skipping update");
    process.exit(0);
  }

  const girlFrames = loadGirlFrames();
  if (!girlFrames) {
    console.log("⚠️ Girl frames missing in assets/girl/; rendering room without her.");
  }

  const plateBytes = await renderPlate(plateParams(scene));
  console.log("🖼️ 3D plate rendered:", plateBytes.length, "bytes");

  const epochSeconds = Math.floor(Date.now() / 1000);
  const svg = composeSvg(scene, plateBytes, girlFrames);

  writeFileSync(SVG_FILE, svg);
  writeFileSync("README.md", buildReadme(scene, epochSeconds));
  writeFileSync(
    STATE_FILE,
    JSON.stringify(
      {
        hash,
        channelIndex: scene.channel.index,
        track: scene.track,
        artist: scene.artist,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log("✅ README + SVG updated:", svg.length, "bytes of SVG");
}

await main();
