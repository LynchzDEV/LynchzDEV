const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const GITHUB_USER = "LynchzDEV";
const OPEN_METEO_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m&daily=sunrise,sunset&timezone=Asia%2FBangkok&forecast_days=1";
const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const CONTRIBUTIONS_QUERY = `query { user(login: "${GITHUB_USER}") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount weekday } } } } } }`;

const DAWN_BEFORE_MS = 40 * 60 * 1000;
const DAWN_AFTER_MS = 50 * 60 * 1000;
const GOLDEN_BEFORE_MS = 70 * 60 * 1000;
const GOLDEN_AFTER_MS = 40 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const CONTRIBUTION_DAYS_WINDOW = 91;
const RECENT_REPO_COUNT = 4;
const COMMITS_PER_REPO = 3;
const RECENT_COMMIT_COUNT = 6;

function bangkokDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function bangkokHour(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: BANGKOK_TIME_ZONE,
      hour: "2-digit",
      hour12: false,
    }).format(date)
  );
  return hour % 24;
}

function bangkokLocalToMs(localTime) {
  if (!localTime) return null;
  const ms = new Date(`${localTime}:00+07:00`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function bangkokDefaultTimeISO(hour, minute) {
  const date = bangkokDateString();
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${date}T${hh}:${mm}:00+07:00`).toISOString();
}

function weatherCodeToCondition(code) {
  if (code === 0) return "CLEAR";
  if (code >= 1 && code <= 3) return "PARTLY CLOUDY";
  if (code === 45 || code === 48) return "FOG";
  if (code >= 51 && code <= 67) return "RAIN";
  if (code >= 71 && code <= 77) return "SNOW";
  if (code >= 80 && code <= 82) return "SHOWERS";
  if (code >= 95 && code <= 99) return "THUNDERSTORM";
  return "UNKNOWN";
}

function isRainWeatherCode(code) {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99);
}

function isStormWeatherCode(code) {
  return code >= 95 && code <= 99;
}

function computePhase(nowMs, sunriseMs, sunsetMs) {
  if (nowMs < sunriseMs - DAWN_BEFORE_MS || nowMs > sunsetMs + GOLDEN_AFTER_MS) return "night";
  if (nowMs <= sunriseMs + DAWN_AFTER_MS) return "dawn";
  if (nowMs >= sunsetMs - GOLDEN_BEFORE_MS) return "golden";
  return "day";
}

function fallbackWeather() {
  const hour = bangkokHour();
  return {
    tempC: 30,
    humidity: 70,
    cloudCover: 40,
    windKph: 10,
    weatherCode: 0,
    condition: "CLEAR",
    isRain: false,
    isStorm: false,
    sunriseISO: bangkokDefaultTimeISO(6, 0),
    sunsetISO: bangkokDefaultTimeISO(18, 30),
    phase: hour >= 6 && hour < 18 ? "day" : "night",
    minutesToSunset: 0,
  };
}

export async function fetchWeather() {
  try {
    const response = await fetch(OPEN_METEO_URL);
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
    const payload = await response.json();
    const current = payload.current || {};
    const daily = payload.daily || {};
    const sunriseMs = bangkokLocalToMs(daily.sunrise?.[0]);
    const sunsetMs = bangkokLocalToMs(daily.sunset?.[0]);
    if (!sunriseMs || !sunsetMs) throw new Error("missing sunrise/sunset in response");
    const weatherCode = Number(current.weather_code);
    const nowMs = Date.now();
    return {
      tempC: Number(current.temperature_2m),
      humidity: Number(current.relative_humidity_2m),
      cloudCover: Number(current.cloud_cover),
      windKph: Number(current.wind_speed_10m),
      weatherCode,
      condition: weatherCodeToCondition(weatherCode),
      isRain: isRainWeatherCode(weatherCode),
      isStorm: isStormWeatherCode(weatherCode),
      sunriseISO: new Date(sunriseMs).toISOString(),
      sunsetISO: new Date(sunsetMs).toISOString(),
      phase: computePhase(nowMs, sunriseMs, sunsetMs),
      minutesToSunset: Math.round((sunsetMs - nowMs) / 60000),
    };
  } catch (error) {
    console.log("⚠️ fetchWeather failed, using fallback:", error.message);
    return fallbackWeather();
  }
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

async function safeGithubList(path, token) {
  try {
    const data = await githubGet(path, token);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.log(`⚠️ GitHub fetch failed for ${path}:`, error.message);
    return [];
  }
}

function collectPushEvents(events) {
  return events.filter((event) => event.type === "PushEvent");
}

function countLateNightPushes(pushEvents) {
  return pushEvents.filter((event) => {
    const hour = bangkokHour(new Date(event.created_at));
    return hour >= 1 && hour < 5;
  }).length;
}

function countPrsMerged(events) {
  return events.filter((event) => {
    if (event.type !== "PullRequestEvent") return false;
    const payload = event.payload || {};
    return payload.action === "closed" && payload.pull_request?.merged === true;
  }).length;
}

function findNewestRepo(repos) {
  const owned = repos.filter((repo) => !repo.fork);
  if (owned.length === 0) return null;
  const newest = owned.reduce((latest, repo) =>
    new Date(repo.created_at).getTime() > new Date(latest.created_at).getTime() ? repo : latest
  );
  return { name: newest.name, language: newest.language || null };
}

function countActiveRepos(events) {
  return new Set(events.map((event) => event.repo?.name).filter(Boolean)).size;
}

export async function fetchDevLife(githubToken) {
  const events = await safeGithubList(`/users/${GITHUB_USER}/events/public`, githubToken);
  const repos = await safeGithubList(
    `/users/${GITHUB_USER}/repos?per_page=100&type=owner&sort=updated`,
    githubToken
  );

  const pushEvents = collectPushEvents(events);

  return {
    lateNightPushes: countLateNightPushes(pushEvents),
    prsMerged: countPrsMerged(events),
    newestRepo: findNewestRepo(repos),
    activeRepos: countActiveRepos(events),
  };
}

function fallbackContributions() {
  return { totalYear: 0, days: [], commitsToday: 0, commitsWeek: 0, streakDays: 0, maxDay: 0 };
}

function buildDayMap(days) {
  return new Map(days.map((day) => [day.date, day.count]));
}

function sumLastNDays(dayMap, todayDateString, days) {
  let sum = 0;
  let cursorMs = bangkokLocalToMs(`${todayDateString}T00:00`);
  for (let i = 0; i < days; i++) {
    sum += dayMap.get(bangkokDateString(new Date(cursorMs))) || 0;
    cursorMs -= DAY_MS;
  }
  return sum;
}

function computeContributionStreak(dayMap, todayDateString) {
  let cursorMs = bangkokLocalToMs(`${todayDateString}T00:00`);
  if ((dayMap.get(todayDateString) || 0) === 0) cursorMs -= DAY_MS;
  let streak = 0;
  while (true) {
    const count = dayMap.get(bangkokDateString(new Date(cursorMs)));
    if (!count) break;
    streak += 1;
    cursorMs -= DAY_MS;
  }
  return streak;
}

export async function fetchContributions(githubToken) {
  if (!githubToken) {
    console.log("⚠️ fetchContributions skipped, no GitHub token");
    return fallbackContributions();
  }
  try {
    const response = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/json",
        "User-Agent": `${GITHUB_USER}-readme`,
      },
      body: JSON.stringify({ query: CONTRIBUTIONS_QUERY }),
    });
    if (!response.ok) throw new Error(`GitHub GraphQL HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.errors) throw new Error(payload.errors.map((entry) => entry.message).join("; "));
    const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar || !Array.isArray(calendar.weeks)) throw new Error("malformed contribution calendar response");

    const allDays = calendar.weeks.flatMap((week) => week.contributionDays);
    const days = allDays
      .slice(-CONTRIBUTION_DAYS_WINDOW)
      .map((day) => ({ date: day.date, count: day.contributionCount }));
    const dayMap = buildDayMap(days);
    const today = bangkokDateString();

    return {
      totalYear: calendar.totalContributions,
      days,
      commitsToday: dayMap.get(today) || 0,
      commitsWeek: sumLastNDays(dayMap, today, 7),
      streakDays: computeContributionStreak(dayMap, today),
      maxDay: days.reduce((max, day) => Math.max(max, day.count), 0),
    };
  } catch (error) {
    console.log("⚠️ fetchContributions failed, using fallback:", error.message);
    return fallbackContributions();
  }
}

async function fetchRepoCommits(fullName, githubToken) {
  try {
    const commits = await githubGet(`/repos/${fullName}/commits?per_page=${COMMITS_PER_REPO}`, githubToken);
    if (!Array.isArray(commits)) return [];
    return commits.map((entry) => ({
      repo: fullName,
      message: (entry.commit?.message || "").split("\n")[0],
      sha: (entry.sha || "").slice(0, 7),
      date: entry.commit?.author?.date || entry.commit?.committer?.date || null,
    }));
  } catch (error) {
    console.log(`⚠️ commits for ${fullName} failed:`, error.message);
    return [];
  }
}

export async function fetchRecentCommits(githubToken) {
  try {
    const repos = await githubGet(
      `/users/${GITHUB_USER}/repos?per_page=100&type=owner&sort=pushed`,
      githubToken
    );
    const owned = (Array.isArray(repos) ? repos : [])
      .filter((repo) => !repo.fork)
      .slice(0, RECENT_REPO_COUNT);
    const commitLists = await Promise.all(
      owned.map((repo) => fetchRepoCommits(repo.full_name, githubToken))
    );
    const commits = commitLists.flat();
    commits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return commits.slice(0, RECENT_COMMIT_COUNT).map(({ repo, message, sha }) => ({ repo, message, sha }));
  } catch (error) {
    console.log("⚠️ fetchRecentCommits failed:", error.message);
    return [];
  }
}

const CHANNELS = [
  { id: "CH-05", label: "NOW PLAYING" },
  { id: "CH-02", label: "COMMIT GRAPH" },
  { id: "CH-07", label: "LANG STATS" },
  { id: "CH-11", label: "WEATHER RADAR" },
  { id: "CH-88", label: "NO SIGNAL" },
];

const ROTATION_ORDER = ["CH-05", "CH-02", "CH-05", "CH-07", "CH-05", "CH-11"];

function findChannel(channelId) {
  return CHANNELS.find((channel) => channel.id === channelId) || CHANNELS[0];
}

function buildChannelResult(channelId, index) {
  const channel = findChannel(channelId);
  return { id: channel.id, label: channel.label, index };
}

export function pickChannel(previousIndex, scene) {
  const nextIndex = (Number.isInteger(previousIndex) ? previousIndex + 1 : 0) % ROTATION_ORDER.length;
  if (scene?.hasTrack === false) return buildChannelResult("CH-88", nextIndex);
  return buildChannelResult(ROTATION_ORDER[nextIndex], nextIndex);
}

function streakTierFor(streakDays) {
  if (streakDays >= 10) return 3;
  if (streakDays >= 5) return 2;
  if (streakDays >= 2) return 1;
  return 0;
}

export function summarizeMood(weather, devLife, contributions) {
  return {
    tiredMode: devLife.lateNightPushes > 0,
    streakTier: streakTierFor(contributions.streakDays),
    coffeeCups: Math.min(4, Math.floor(contributions.commitsToday / 3)),
    wetWindow: weather.isRain,
  };
}
