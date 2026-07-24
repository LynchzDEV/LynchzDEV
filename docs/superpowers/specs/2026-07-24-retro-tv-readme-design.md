# Retro CRT-TV Profile README — Design

Date: 2026-07-24
Repo: LynchzDEV/LynchzDEV (GitHub profile README)

## Goal

Replace the whole README with a retro-analog design centered on one animated SVG scene:
an isometric CRT television showing the currently-playing Spotify track, cassette tape
beside it. Most old sections dropped (owner approved "most of em can drop out").

## Requirements

- Spotify integration stays (existing GitHub Action pipeline, 10-min cron).
- Pause symbol `⏸` renders ALWAYS — never switches to play `▷` based on `is_playing`.
- Unique look; no shields.io badges, no github-readme-stats.
- Animations must run on github.com README (SMIL/CSS inside SVG file).

## Architecture

- `update-readme.js` gains `renderTvSvg()`:
  - fetches album art URL passed by workflow, converts to base64 data URI
    (external images inside README-embedded SVGs are blocked by GitHub camo).
  - writes `spotify-tv.svg` at repo root.
- README.md regenerated as short markdown: intro line, the SVG scene
  (`./spotify-tv.svg?v=<timestamp>` — cache-bust for camo), plain-text links,
  auto-update footer.
- Same-song skip logic (`.last-song.json`) unchanged.
- Workflow commits both README.md and spotify-tv.svg.

## Visual design (single SVG scene)

- Dark scene background baked into SVG (theme-independent).
- Isometric 3/4-angle CRT TV: charcoal/wood body, front-facing screen, antenna,
  channel dial, blinking `REC ●`, corner OSD `CH-05 ♪ NOW PLAYING`.
- Screen: album art with CRT curvature vignette, animated scanlines + flicker,
  track + artist in mono/pixel font, transport row `◁ ⏸ ▷` (⏸ static).
- Cassette beside TV: spinning reels (SMIL rotate), label shows artist name.
- Long track names: marquee scroll animation.

## Error handling

- Album art fetch failure → baked-in fallback art (TUYU placeholder).
- Text escaped for SVG/XML (quotes, ampersands in track names).

## Testing

- Local: open generated SVG + README preview in browser, verify animations/layout.
- Real: after push, verify rendered profile on github.com (camo can strip features).
- Edge cases: long track name, Japanese/Thai characters, missing art.
