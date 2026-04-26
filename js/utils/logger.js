/**
 * Lightweight debug-gated logger.
 *
 * `log` and `debug` are silenced unless debug mode is on. `warn` and `error`
 * always pass through.
 *
 * Enable debug mode either way:
 *   - URL param:    ?debug=1
 *   - localStorage: setWeatherDebug(true)  (then reload)
 */

const DEBUG_STORAGE_KEY = 'weather_app_debug';

const isDebug = (() => {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('debug') === '1') return true;
        return localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
})();

const noop = () => {};

// Bind to console so DevTools shows the original call site (file:line).
export const log = isDebug ? console.log.bind(console) : noop;
export const debug = isDebug ? console.debug.bind(console) : noop;
export const warn = console.warn.bind(console);
export const error = console.error.bind(console);

export function isDebugEnabled() {
    return isDebug;
}

window.setWeatherDebug = function (enabled) {
    localStorage.setItem(DEBUG_STORAGE_KEY, enabled ? 'true' : 'false');
    console.log(`Weather app debug ${enabled ? 'enabled' : 'disabled'} — reload to take effect`);
};
