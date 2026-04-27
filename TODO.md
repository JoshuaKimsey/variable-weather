# Variable Weather — Outstanding Work

Snapshot of in-flight work as of 2026-04-27, post-v2.4.0. One thread
open: the **alert categorization** rework (just begun). The **radar
refactor** is now complete (Phases 1+2a shipped earlier, 2b skipped
intentionally, 3+4 shipped today).

---

## 1. Alert categorization ✅ COMPLETE

### What shipped
A new **5-tier severity system** with an `EMERGENCY` purple/flashing
category for the highest-priority warnings. Touches:

- `js/standardWeatherFormat.js` — `ALERT_SEVERITY.EMERGENCY = 'emergency'`
- `js/api/alerts/nwsAlerts.js:155` — `determineAlertSeverity` rewritten;
  PDS / `tornado emergency` / `flash flood emergency` / `extreme wind warning`
  detection scans `event + headline + description + parameters.NWSheadline`
- `js/api/pirateWeatherApi.js:930` — `determinePirateAlertSeverity` mirrored,
  scans `title + description`
- `js/ui/components/radar.js` — z-index 1200, weight 3.5,
  `emergency-alert-polygon` className, `EMERGENCY` badge, "SEEK SHELTER NOW"
  guidance, 1 s pulse keyframe, solid `#7B1FA2` color override in
  `getAlertTypeColor`
- `js/ui/components/alertsDisplay.js:55` — `'emergency': 0` in sort
- `styles/base-layout.css:47` — `--emergency-color: #7B1FA2`
- `styles/alerts.css` — `.alert-emergency` rule + `flash-alert-emergency`
  1 s keyframe; also added `.alert-extreme .alert-severity` (the rule was
  missing; the EXTREME badge had no background color)

### Severity tier prescription (user's spec)
- **Emergency:** Tornado Emergency, Flash Flood Emergency, Extreme Wind
  Warning, anything with "Particularly Dangerous Situation" in the
  event/headline/description. Color: purple, fast flash.
- **Extreme:** Tornado Warning, Hurricane Warning, Flash Flood Warning, plus
  Tsunami Warning + Storm Surge Warning (judgment call: imminent threats).
- **Severe:** every other warning except Freeze Warning, **plus** Storm
  Surge Watch (the lone watch promoted).
- **Moderate:** all watches (including Tornado Watch — demoted from severe)
  plus Freeze Warning (demoted because southern offices issue these for any
  sub-32 °F night).
- **Minor:** advisories, statements, outlooks.

### Deferred / future
- Field-testing against live NWS alerts for PDS detection — skipped; rare
  events make this impractical to wait for.
- Dedicated Emergency-tier meteocon icon — deferred; severity is currently
  communicated via color/animation only.

---

## 2. Radar refactor — remaining phases

`js/ui/components/radar.js` is bounded scope (see
`memory/project_radar_refactor.md` and `CLAUDE.md`). Phases 1 + 2a + the
nowcast/recenter feature add shipped in v2.4.0. Phase 2b (lazy-keep) was
skipped intentionally — the user prefers preserved pan/zoom across
modal open/close, so the recenter button covers the use case instead.

### Phase 3 — DOM / CSS hygiene ✅ COMPLETE

All inline `style="…"` attributes extracted into proper CSS classes in
`styles/radar.css`. Changes made:

- **`addAlertAnimationCSS()` deleted**: keyframes and polygon animation
  rules moved to `styles/radar.css` Section 9.
- **`initMap()` template stripped**: all inline styles removed; elements
  rely on `.modal-radar-view`, `.modal-radar-wrapper`, `.modal-map-container`,
  `.radar-modal .timestamp-display`, `.radar-modal .radar-controls`.
- **`updateTimeline()` cleaned**: redundant inline styles removed from
  `.radar-timestamp`, `.radar-frame-marker`, `.radar-position-indicator`;
  only dynamic `left` positioning remains inline.
- **Alert popup builder refactored**: new `.alert-popup-*` class family in
  `styles/radar.css` Section 8; dynamic colors flow through `--alert-color`
  CSS custom property.
- **Helper functions simplified**: `showMapLoadingIndicator()`,
  `showMapErrorMessage()`, `showModalMapError()` now use CSS classes
  instead of inline styles.
- **`styles/alerts.css`**: removed obsolete `@keyframes alertPulse` and
  `.extreme-alert-polygon` rules (superseded by `radar.css`).

### Phase 4 — tile perf / crossfade ✅ COMPLETE

Replaced the 50 ms hard-swap with a CSS-driven opacity crossfade:

- All frame layers are created once (during preload or on-demand) and
  kept in the map at `opacity: 0`.
- `showFrame()` swaps opacity instead of creating/destroying layers.
- CSS `transition: opacity 0.15s ease` on `.radar-frame-layer` handles
  the smooth crossfade.
- `fetchRadarData()` now clears old layers before fetching to prevent
  accumulation across refreshes.
- The `/512/` tile URL with `tileSize: 256` supersampling is unchanged.

---

## 3. Repo-level conventions to know

From `CLAUDE.md` (read it in full before editing):

- **No build step.** Plain ES modules, vendored libs under `resources/`.
  Do not introduce a bundler, transpiler, or framework.
- **`SW_VERSION` in `sw.js` is the single source of truth** for the app
  version. The cache name (`variable-weather-cache-v${SW_VERSION}`)
  drives install/cleanup. Bump only on release commits.
- **`sw.js` `ASSETS` array is atomic** — a missing path aborts the entire
  install. If you add a new file that needs to work offline, add its
  path to `ASSETS` and verify it resolves on disk.
- **Hazard detection is duplicated** in `js/api/alerts/nwsAlerts.js` and
  `js/api/pirateWeatherApi.js` (`identifyAlertHazards` and
  `getPrimaryHazardType`). Update **both** if you change a hazard category.
- **Logger:** use `log` / `warn` / `error` from `js/utils/logger.js` —
  never raw `console.log`. `log` is silent in production unless
  `?debug=1` or `setWeatherDebug(true)` in console.

## 4. Local dev

```bash
python3 dev-server.py     # serves at http://localhost:8000/ with no-cache headers
```

Service worker change → old SW stays active until "Update Now" is
clicked or DevTools → Application → Service Workers → Unregister.

## 5. Pointers

- Project memory (preferences, scope constraints):
  `~/.claude/projects/-var-home-southernwolf-Documents-GitHub-variable-weather/memory/MEMORY.md`
- Radar reference implementation: <https://librewxr.net> (user is the
  author) and <https://github.com/JoshuaKimsey/LibreWXR>
