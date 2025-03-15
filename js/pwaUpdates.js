/**
 * PWA Update System
 * 
 * This module provides update functionality for the weather PWA:
 * 1. Detects when a new version is available
 * 2. Shows an update notification to the user
 * 3. Provides a button to apply the update
 * 4. Includes version checking and display
 */

// App version - change this with each release
const APP_VERSION = '1.7.3';

// Configuration
const CHECK_INTERVAL = 60 * 120 * 1000; // Check for updates every 2 hours (in milliseconds)

// Global state
let updateAvailable = false;
let registration = null;

/**
 * Initialize the PWA update system
 */
function initUpdateSystem() {
    // Expose the version in the window object for debugging
    window.appVersion = APP_VERSION;

    console.log(`Variable Weather Version: ${APP_VERSION}`);

    // Display current version in the UI
    displayAppVersion();

    // Setup periodic update checks
    setupUpdateChecking();

    // Create update notification UI (hidden by default)
    createUpdateNotification();
}

/**
 * Display the current app version in the UI with GitHub link
 */
function displayAppVersion() {
    const footerElement = document.querySelector('.attribution-footer');
    const GITHUB_URL = 'https://github.com/JoshuaKimsey/variable-weather';

    if (footerElement) {
        // Create version display element if it doesn't exist
        let versionDisplay = document.getElementById('app-version-display');

        if (!versionDisplay) {
            versionDisplay = document.createElement('div');
            versionDisplay.id = 'app-version-display';
            versionDisplay.className = 'app-version';
            footerElement.appendChild(versionDisplay);
        }

        // Create a link element for the version
        versionDisplay.innerHTML = `&copy; Copyright 2025 <a href="https://github.com/JoshuaKimsey" target="_blank" rel="noopener" class="version-link">Joshua Kimsey</a> - Variable Weather: <a href="${GITHUB_URL}" target="_blank" rel="noopener" class="version-link">v${APP_VERSION}</a>`;
    }
}

/**
 * Setup service worker update checking
 */
function setupUpdateChecking() {
    // Only run in production environments with service worker support
    if ('serviceWorker' in navigator) {
        // Store the registration for later use
        navigator.serviceWorker.ready.then(reg => {
            registration = reg;

            // Check for updates immediately on load
            checkForUpdates();

            // Set up periodic update checks
            setInterval(checkForUpdates, CHECK_INTERVAL);

            // Listen for controlling service worker changes
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                // This fires when the service worker controlling this page changes,
                // which happens when a new service worker is activated.
                console.log('Controller changed - page will reload shortly');

                // Wait a moment to ensure the service worker is fully active,
                // then reload the page to load new assets
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            });
        });

        // Listen for new service workers installing
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data && event.data.type === 'VERSION_CHANGE') {
                console.log(`New version available: ${event.data.version}`);
                showUpdateNotification(event.data.version);
            }
        });
    }
}

/**
 * Check if a service worker update is available
 */
function checkForUpdates() {
    if (!registration) return;

    console.log('Checking for PWA updates...');

    // This method checks the server for an updated service worker
    registration.update()
        .then(() => {
            console.log('Update check completed');

            // After update() resolves, check if there's a new service worker waiting
            if (registration.waiting) {
                console.log('New service worker waiting');
                updateAvailable = true;
                showUpdateNotification();
            }
        })
        .catch(error => {
            console.error('Update check failed:', error);
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

    // Add styles for the notification
    const style = document.createElement('style');
    style.innerHTML = `
        .update-notification {
            position: fixed;
            bottom: 20px;
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

    // Add event listeners
    document.getElementById('apply-update').addEventListener('click', applyUpdate);
    document.getElementById('dismiss-update').addEventListener('click', dismissUpdateNotification);
}

/**
 * Show the update notification to the user
 * @param {string} newVersion - The version of the new update (optional)
 */
function showUpdateNotification(newVersion = '') {
    const notification = document.getElementById('update-notification');
    if (notification) {
        // Show version info if available
        if (newVersion) {
            const versionElement = document.getElementById('update-version');
            if (versionElement) {
                versionElement.textContent = `(${newVersion})`;
            }
        }

        notification.style.display = 'block';
    }
}

/**
 * Hide the update notification
 */
function dismissUpdateNotification() {
    const notification = document.getElementById('update-notification');
    if (notification) {
        notification.style.display = 'none';
    }
}

/**
 * Apply the available update
 */
function applyUpdate() {
    if (!registration || !registration.waiting) {
        console.warn('No update available to apply');
        dismissUpdateNotification();
        return;
    }

    console.log('Applying update...');

    // Send message to the waiting service worker to skip waiting
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Hide the notification
    dismissUpdateNotification();
}

// Export functions for external use
export {
    initUpdateSystem,
    checkForUpdates,
    applyUpdate,
    APP_VERSION
};