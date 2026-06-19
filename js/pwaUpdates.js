/**
 * PWA Update System
 *
 * - Reads the app version from the active service worker (single source of truth).
 * - Surfaces "Update Now" notification when a new SW is installed and waiting.
 * - Triggers a controlled reload after the user accepts.
 *
 * Browsers automatically re-check sw.js on navigation (and within 24h of an
 * active SW), so we don't poll on a timer. The `updatefound` event from the
 * registration is what fires when a new SW is detected.
 */

import { log, warn } from './utils/logger.js';

const GITHUB_URL = 'https://github.com/JoshuaKimsey/variable-weather';
const VERSION_QUERY_TIMEOUT_MS = 2000;

let registration = null;
let refreshing = false;

/**
 * Initialize the PWA update system
 */
function initUpdateSystem() {
    initVersionDisplay();
    setupUpdateChecking();
    createUpdateNotification();
}

/**
 * Ask the active service worker for its version using a MessageChannel.
 * Prefers `controller`, but falls back to `registration.active` so we get a
 * version even on the first load after install when controller isn't set yet.
 */
function getServiceWorkerVersion(reg) {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);

    const target = navigator.serviceWorker.controller || (reg && reg.active);
    if (!target) return Promise.resolve(null);

    return new Promise(resolve => {
        const channel = new MessageChannel();
        let settled = false;

        const finish = (value) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        channel.port1.onmessage = (event) => finish(event.data?.version || null);

        try {
            target.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
        } catch (err) {
            warn('Failed to query SW for version:', err);
            finish(null);
            return;
        }

        setTimeout(() => finish(null), VERSION_QUERY_TIMEOUT_MS);
    });
}

/**
 * Render the footer immediately with a fallback, then upgrade to the version
 * label asynchronously once the SW responds. Never blocks on SW state — if
 * registration fails (e.g., scope mismatch on localhost), the GitHub-link
 * footer still renders.
 */
function initVersionDisplay() {
    renderVersionFooter(null);

    if (!('serviceWorker' in navigator)) return;

    const ready = Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), VERSION_QUERY_TIMEOUT_MS))
    ]);

    ready
        .then(reg => getServiceWorkerVersion(reg))
        .then(version => {
            if (!version) return;
            window.appVersion = version;
            log(`Variable Weather Version: ${version}`);
            renderVersionFooter(version);
        })
        .catch(err => warn('Could not retrieve SW version:', err));
}

/**
 * Insert (or update) the version line in the attribution footer.
 */
function renderVersionFooter(version) {
    const footerElement = document.querySelector('.attribution-footer');
    if (!footerElement) return;

    let versionDisplay = document.getElementById('app-version-display');
    if (!versionDisplay) {
        versionDisplay = document.createElement('div');
        versionDisplay.id = 'app-version-display';
        versionDisplay.className = 'app-version';
        footerElement.appendChild(versionDisplay);
    }

    const versionLink = version
        ? `<a href="${GITHUB_URL}" target="_blank" rel="noopener" class="version-link">v${version}</a>`
        : `<a href="${GITHUB_URL}" target="_blank" rel="noopener" class="version-link">GitHub</a>`;

    versionDisplay.innerHTML =
        `&copy; Copyright 2025 ` +
        `<a href="https://github.com/JoshuaKimsey" target="_blank" rel="noopener" class="version-link">Joshua Kimsey</a>` +
        ` - Variable Weather: ${versionLink}`;
}

/**
 * Wire up SW update detection. The browser handles polling for us; we just
 * react to `updatefound` and to a SW that's already waiting on page load.
 */
function setupUpdateChecking() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(reg => {
        registration = reg;

        // A new SW from a previous tab/session may already be waiting.
        if (reg.waiting && navigator.serviceWorker.controller) {
            showUpdateNotification();
        }

        reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
                // Only notify if there's already an active controller — otherwise
                // this is the first install, not an update.
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    log('New service worker installed and waiting');
                    showUpdateNotification();
                }
            });
        });
    }).catch(err => {
        warn('Service worker not ready:', err);
    });

    // When the new SW takes control, reload exactly once.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        log('New SW now controlling — reloading');
        window.location.reload();
    });

    // Optional: SW broadcasts VERSION_CHANGE on install. We use it as a hint
    // to surface the notification with the new version label.
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'VERSION_CHANGE') {
            log(`New version available: ${event.data.version}`);
            showUpdateNotification(event.data.version);
        }
    });
}

/**
 * Create the update notification UI (hidden initially)
 */
function createUpdateNotification() {
    const updateNotification = document.createElement('div');
    updateNotification.id = 'update-notification';
    updateNotification.className = 'update-notification';
    updateNotification.style.display = 'none';

    updateNotification.innerHTML = `
        <div class="update-content">
            <div class="update-icon">
                <i class="bi bi-file-arrow-down"></i>
            </div>
            <div class="update-message">
                <strong>Update Available</strong>
                <span id="update-version"></span>
                <p>A new version of Weather App is available.</p>
            </div>
            <div class="update-actions">
                <button id="apply-update" class="update-button">Update Now</button>
                <button id="dismiss-update" class="dismiss-button">Later</button>
            </div>
        </div>
    `;

    document.body.appendChild(updateNotification);

    const style = document.createElement('style');
    style.innerHTML = `
        .update-notification {
            position: fixed;
            bottom: calc(20px + env(safe-area-inset-bottom));
            left: 50%;
            transform: translateX(-50%);
            background-color: #fff;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            width: 90%;
            max-width: 400px;
            overflow: hidden;
            animation: slideUp 0.3s ease-out;
        }

        .update-content {
            padding: 16px;
            display: flex;
            flex-wrap: wrap;
        }

        .update-icon {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: #1e88e5;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 16px;
        }

        .update-icon i {
            font-size: 20px;
        }

        .update-message {
            flex: 1;
            min-width: 150px;
        }

        .update-message strong {
            display: block;
            margin-bottom: 4px;
        }

        .update-message p {
            margin: 4px 0;
            color: #666;
            font-size: 14px;
        }

        #update-version {
            font-size: 12px;
            color: #888;
            display: inline-block;
            margin-left: 8px;
        }

        .update-actions {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 12px;
            width: 100%;
            margin-top: 12px;
        }

        .update-button {
            background-color: #1e88e5;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
        }

        .dismiss-button {
            background: none;
            border: none;
            color: #666;
            cursor: pointer;
            padding: 8px;
        }

        @keyframes slideUp {
            from {
                transform: translate(-50%, 100%);
                opacity: 0;
            }
            to {
                transform: translate(-50%, 0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);

    document.getElementById('apply-update').addEventListener('click', applyUpdate);
    document.getElementById('dismiss-update').addEventListener('click', dismissUpdateNotification);
}

/**
 * Show the update notification to the user
 * @param {string} newVersion - Optional version label
 */
function showUpdateNotification(newVersion = '') {
    const notification = document.getElementById('update-notification');
    if (!notification) return;

    if (newVersion) {
        const versionElement = document.getElementById('update-version');
        if (versionElement) versionElement.textContent = `(${newVersion})`;
    }

    notification.style.display = 'block';
}

function dismissUpdateNotification() {
    const notification = document.getElementById('update-notification');
    if (notification) notification.style.display = 'none';
}

/**
 * Tell the waiting SW to take over. The `controllerchange` listener handles
 * the reload once it does.
 */
function applyUpdate() {
    if (!registration || !registration.waiting) {
        warn('No update available to apply');
        dismissUpdateNotification();
        return;
    }

    log('Applying update...');
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    dismissUpdateNotification();
}

export {
    initUpdateSystem,
    applyUpdate
};
