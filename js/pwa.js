/**
 * PWA functionality for the Weather App
 *
 * Owns: service worker registration and the install prompt UX.
 * Update detection / reload-on-controller-change lives in pwaUpdates.js.
 */

import { initUpdateSystem } from './pwaUpdates.js';
import { log, warn } from './utils/logger.js';

if ('serviceWorker' in navigator) {
    // Registering immediately (not on window 'load') so static PWA analyzers
    // like PWABuilder see the SW without waiting for full page load. The
    // inline <script> in index.html also calls register() as a belt-and-
    // suspenders measure; duplicate register() calls are idempotent.
    navigator.serviceWorker.register('./sw.js')
        .then(registration => {
            log('ServiceWorker registration successful with scope:', registration.scope);
        })
        .catch(error => {
            warn('ServiceWorker registration failed:', error);
        });

    // Register periodic background sync so the cached weather stays fresh
    // even when the app is closed. Android Chrome only (fine for the TWA
    // target); silently no-ops elsewhere. The browser gates the actual
    // firing on minInterval + site engagement, so this never hammers battery.
    navigator.serviceWorker.ready.then(reg => {
        if (!('periodicSync' in reg)) return; // unsupported (iOS Safari, desktop Firefox)
        reg.periodicSync.permissionState().then(state => {
            if (state !== 'granted') return;
            // 12h minimum interval. The SW records every API URL the page
            // fetches; the periodicsync handler replays them into the cache.
            const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
            reg.periodicSync.register('refresh-weather', { minInterval: TWELVE_HOURS_MS })
                .then(() => log('Periodic background sync registered (12h min interval)'))
                .catch(err => warn('Periodic sync registration failed:', err));
        }).catch(err => warn('periodicSync.permissionState() failed:', err));
    }).catch(() => { /* SW not ready; non-fatal */ });
}

let deferredPrompt;
const installButton = document.getElementById('install-button');
const installContainer = document.getElementById('install-container');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    deferredPrompt = e;

    if (installContainer) {
        installContainer.style.display = 'block';

        installButton.addEventListener('click', () => {
            installContainer.style.display = 'none';
            deferredPrompt.prompt();

            deferredPrompt.userChoice.then((choiceResult) => {
                log(`Install prompt outcome: ${choiceResult.outcome}`);
                deferredPrompt = null;
            });
        });
    }
});

window.addEventListener('appinstalled', () => {
    log('Weather App was installed');
});

document.addEventListener('DOMContentLoaded', () => {
    initUpdateSystem();
});
