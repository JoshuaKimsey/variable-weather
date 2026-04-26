# Variable Weather — Repo Notes for Claude

Animated PWA weather app, plain-JS, served from GitHub Pages at
`joshuakimsey.github.io/variable-weather`.

## Stack reality

- Plain HTML/CSS/JS (ES2015+), Bootstrap for styling/icons, native ES modules.
- **No build step. No bundler. No transpilation. No React/Vue.** Don't introduce them.
- Vendored libs under `resources/`: leaflet, suncalc3, tz-lookup, meteocons, font-awesome, bootstrap.
- `@meteocons/svg` is pulled as a one-shot tarball into `resources/meteocons/fill/` — it is **not** a build dependency. Same applies if you ever pull other meteocon styles (flat/line/monochrome).

## Version is the service worker

`SW_VERSION` in `sw.js` is the single source of truth for the app version.

- The page asks the active SW for its version via a `MessageChannel` (`{ type: 'GET_VERSION' }`) — see `js/pwaUpdates.js`.
- The cache name (`variable-weather-cache-v${SW_VERSION}`) is what causes the browser to install a new SW and clean up old caches on activation.
- **On release: bump `SW_VERSION` only.** Don't introduce a second version constant elsewhere.
- `skipWaiting` is intentionally disabled so users control updates via the "Update Now" banner.

## Adding a file? Update `sw.js`

`sw.js` has an explicit `ASSETS` array used by `cache.addAll()` during install. `addAll` is **atomic** — one missing path aborts the entire install, leaves the SW in a broken state, and breaks the version footer downstream.

When you add a new JS/CSS/icon/etc. that needs to work offline, add its path to `ASSETS`. After editing, sanity-check that every path resolves on disk before relying on the SW.

## Service worker fetch handler

- Skips non-GET requests and non-http(s) schemes (extensions, blob:, data:) — Cache API can't store those.
- API requests (matched against `API_URLs`): network-first with 5s timeout fallback to cached / `offline.html`.
- Static assets: cache-first, then network with cache-write.

## Alerts: hazard detection lives in two places

`identifyAlertHazards()` and `getPrimaryHazardType()` are **duplicated** in:
- `js/api/alerts/nwsAlerts.js` (NWS source)
- `js/api/pirateWeatherApi.js` (Pirate Weather source)

If you add or change a hazard category, update **both**. The icon mapping is centralized in `getHazardIcon()` in `js/ui/components/alertsDisplay.js`. Icon paths point into `resources/meteocons/fill/`.

## Local dev

`python3 dev-server.py` (gitignored). Serves at `http://localhost:8000/` with no-cache headers.

The service worker registers at `./sw.js` (relative path) so it works on both localhost and GitHub Pages without modification.

When iterating: a service worker change leaves the old SW active until the user clicks "Update Now" or unregisters via DevTools. To force an unstuck state during dev: DevTools → Application → Service Workers → Unregister, then hard-refresh.

## Debug logging

`js/utils/logger.js` exposes `log` / `warn` / `error`. `log` is silent in production unless one of:
- `setWeatherDebug(true)` is called from the console (persists in localStorage)
- The page is opened with `?debug=1` in the URL

`warn` and `error` always pass through. Don't reintroduce raw `console.log` — route through the logger.

## NWS user-agent

`NWS_USER_AGENT` in `js/api/alerts/nwsAlerts.js` and `js/config.js` should stay as-is for the canonical deployment. Forks should change it for their own deployment.

## radar.js is bounded scope

`js/ui/components/radar.js` is intentionally out of scope for general efficiency or cleanup tasks. A dedicated refactor is planned as its own project. If a task incidentally touches radar code, surface that and ask before editing.

## Commit / release style

- Bump `SW_VERSION` for release commits.
- First line of release commits: `Version X.Y.Z - <short summary>`.
- Body: bullet list of user-visible changes (terse).
- GitHub Releases follow: tag `vX.Y.Z`, title `Variable Weather vX.Y.Z`, body is a few terse user-facing bullets ending with a `**Full Changelog**: <compare URL>` line.

## Project memory

User-specific preferences and project status notes are kept in the auto-memory system at `~/.claude/projects/.../memory/`, not in this repo. CLAUDE.md captures *repo-level* conventions only.
