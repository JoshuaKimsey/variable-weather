# Variable Weather — Repo Notes for Claude

Animated PWA weather app, plain-JS, served from GitHub Pages at
`joshuakimsey.github.io/variable-weather`.

## Stack reality

- Plain HTML/CSS/JS (ES2015+), Bootstrap for styling/icons, native ES modules.
- **No build step. No bundler. No transpilation. No React/Vue.** Don't introduce them.
- Vendored libs under `resources/`: leaflet, maplibre, suncalc3, tz-lookup, meteocons, font-awesome, bootstrap.
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
- API requests (matched against `API_URLs`): network-first with a 10s `AbortController` timeout. On timeout or network failure, falls back to the cached response if one exists; otherwise returns a JSON `504` so callers' `response.json()` doesn't choke on HTML. **Never return `offline.html` for API requests** — callers parse the body as JSON.
- Static assets: cache-first, then network with cache-write.

## Alerts come from LibreWXR

Weather alerts are pulled from a single unified source — LibreWXR's `/v2/alerts` endpoint (`https://api.librewxr.net/v2/alerts`) — which combines the WMO CAP feed and NOAA NWS public API into one GeoJSON FeatureCollection.

- `js/api/alerts/alertsApi.js` is the sole alerts module. It exports `fetchAlerts(lat, lon, options)` (used by `js/api.js` in the main weather flow) and `fetchAllAlerts` (used by `js/ui/components/radar.js` for the radar overlay).
- Hazard detection — `identifyAlertHazards()` and `getPrimaryHazardType()` — lives inline in `alertsApi.js`. Don't reintroduce per-provider duplication.
- Icon mapping is centralized in `getHazardIcon()` in `js/ui/components/alertsDisplay.js`. Icon paths point into `resources/meteocons/fill/`.

## Local dev

`python3 dev-server.py` (gitignored). Serves at `http://localhost:8000/` with no-cache headers.

The service worker registers at `./sw.js` (relative path) so it works on both localhost and GitHub Pages without modification.

When iterating: a service worker change leaves the old SW active until the user clicks "Update Now" or unregisters via DevTools. To force an unstuck state during dev: DevTools → Application → Service Workers → Unregister, then hard-refresh.

## Debug logging

`js/utils/logger.js` exposes `log` / `warn` / `error`. `log` is silent in production unless one of:
- `setWeatherDebug(true)` is called from the console (persists in localStorage)
- The page is opened with `?debug=1` in the URL

`warn` and `error` always pass through. Don't reintroduce raw `console.log` — route through the logger.

## Hourly curve is a shared renderer

`js/ui/components/hourlyCurve.js` exports `renderHourlyCurve(container, hours, options)` and is used by **both** the main page's "next 12 hours" chart (`forecasts.js`) and the per-day chart inside the daily detail modal (`dailyDetail.js`). When tweaking the curve, precipitation bars, axis labels, gridlines, or hover tooltip, do it in `hourlyCurve.js` once — don't duplicate the logic in either caller.

The two callers differ only in what they pass: `iconStride` (1 for main page desktop, 3 for mobile + modal), `idPrefix` (so SVG gradient/icon IDs don't collide), and `timezone` (location's IANA TZ for hour labels).

## Commit / release style

- Bump `SW_VERSION` for release commits.
- First line of release commits: `Version X.Y.Z - <short summary>`.
- Body: bullet list of user-visible changes (terse).
- GitHub Releases follow: tag `vX.Y.Z`, title `Variable Weather vX.Y.Z`, body is a few terse user-facing bullets ending with a `**Full Changelog**: <compare URL>` line.

## Project memory

User-specific preferences and project status notes are kept in the auto-memory system at `~/.claude/projects/.../memory/`, not in this repo. CLAUDE.md captures *repo-level* conventions only.
