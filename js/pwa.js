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
