# Variable Weather — Outstanding Work

Snapshot of in-flight work as of 2026-04-27, post-v2.4.0. Two threads are
open: the **alert categorization** rework (just begun) and the **radar
refactor** (Phases 1+2a shipped, 2b skipped intentionally, 3+4 pending).

---

## 1. Alert categorization (in progress)

### What just landed (uncommitted at time of writing — see commit history)
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

### What's left in this thread
- [ ] **Field-test against live NWS alerts.** Detection logic is untested
  against real-world `parameters.NWSheadline` / `description` content.
  Particularly: confirm that the literal phrase "particularly dangerous
  situation" actually appears in NWS payloads (case-insensitive) for PDS
  thunderstorm/tornado warnings — and that "tornado emergency" / "flash
  flood emergency" appear verbatim in headline or description.
- [ ] **Confirm there are no other alert-system changes the user wants.**
  The user said "things I want to change" (plural) before scoping narrowed
  to just the 5-tier work. Ask before assuming this thread is done.
- [ ] **Bump `SW_VERSION` and ship a release** once alert behavior is
  validated. Per `CLAUDE.md`, that's the one and only version bump (cache
  name is derived from it). No second version constant elsewhere.
- [ ] **Optional follow-up:** consider whether Emergency tier wants a
  dedicated meteocon icon. Currently `getHazardIcon()` returns the
  hazard-type icon and severity drives only color/animation.

---

## 2. Radar refactor — remaining phases

`js/ui/components/radar.js` is bounded scope (see
`memory/project_radar_refactor.md` and `CLAUDE.md`). Phases 1 + 2a + the
nowcast/recenter feature add shipped in v2.4.0. Phase 2b (lazy-keep) was
skipped intentionally — the user prefers preserved pan/zoom across
modal open/close, so the recenter button covers the use case instead.

### Phase 3 — DOM / CSS hygiene (next up)

Mechanical but verbose. The goal is to extract inline `style="…"`
attributes into proper CSS classes in `styles/radar.css`.

Largest offenders, by line range in `js/ui/components/radar.js`:
- **Alert popup builder** (~lines 540–650): the `popupContent` template
  literal has inline styles on every element — `<h3>`, severity badges,
  hazard tags, action guidance, `<details>`/`<summary>`, full-text panel.
  Each should become a CSS class.
- **`initMap` HTML template**: similar inline-style pattern for the
  map UI scaffolding.
- **`addAlertAnimationCSS()` keyframes** (~lines 1250+): currently injects
  a `<style id="alert-animation-css">` block at runtime. Move the
  keyframes (`emergency-alert-pulse`, `extreme-alert-pulse`,
  `severe-alert-pulse`, `pulse-text`) and the `.emergency-alert-polygon`
  / `.extreme-alert-polygon` / `.severe-alert-polygon` rules into
  `styles/radar.css` (or `styles/alerts.css`) and delete the function.

**Hard constraint** (from `memory/project_radar_refactor.md`): preserve
all current radar behavior. This is structural cleanup — no
animation timing changes, no layer-lifecycle changes, no tile-source
changes, no UX changes to popup interaction or back-button flow.

### Phase 4 — tile perf / crossfade

- Replace the current 50 ms layer-swap on frame advance with a proper
  opacity crossfade between adjacent radar frames. The flicker is most
  visible on slow connections.
- May want to revisit the Leaflet tile-layer lifecycle (when layers
  are kept vs. destroyed) to reduce reload cost during animation.
- **Do not change** the `/512/` tile URL with `tileSize: 256` Leaflet
  config — that's intentional 2× supersampling for sharpness, not a
  bug. See `memory/feedback_radar_tile_supersampling.md`.

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
