/**
 * Auto-update functionality for the weather app
 */

import { refreshAstroDisplay } from '../ui/components/astronomical.js'

// Constants
const UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutes in milliseconds
let updateTimer;
let lastUpdateTime;

/**
 * Initialize auto-update functionality
 * @param {Function} updateCallback - Function to call when update is needed
 */
export function initAutoUpdate(updateCallback) {
    // Set the initial update time
    lastUpdateTime = new Date();
    updateLastUpdatedText();

    // Set up the update timer
    scheduleNextUpdate(updateCallback);

    // Add a function to the window object to check if updates are active
    window.isAutoUpdateActive = () => updateTimer !== undefined;

    // Add a function to manually trigger an update
    window.manualUpdate = () => {
        if (updateCallback && typeof updateCallback === 'function') {
            clearTimeout(updateTimer);
            performUpdate(updateCallback);
        }
    };
}

/**
 * Schedule the next update
 * @param {Function} updateCallback - Function to call when update is needed
 */
function scheduleNextUpdate(updateCallback) {
    // Clear any existing timer
    if (updateTimer) {
        clearTimeout(updateTimer);
    }

    // Set a new timer
    updateTimer = setTimeout(() => {
        performUpdate(updateCallback);
    }, UPDATE_INTERVAL);

    console.log(`Next weather update scheduled in ${UPDATE_INTERVAL / 60000} minutes`);
}

/**
 * Perform the update
 * @param {Function} updateCallback - Function to call to update the weather
 */
function performUpdate(updateCallback) {
    // console.log('Performing automatic weather update...');

    // Call the update callback
    if (updateCallback && typeof updateCallback === 'function') {
        updateCallback();

        // After calling updateCallback:
        try {
            if (typeof refreshAstroDisplay === 'function') {
                refreshAstroDisplay();
            }
        } catch (error) {
            console.error('Error refreshing astronomical display:', error);

        }
    }

    // Update the timestamp
    lastUpdateTime = new Date();
    updateLastUpdatedText();

    // Schedule the next update
    scheduleNextUpdate(updateCallback);
}

/**
 * Update the "Last Updated" text
 */
export function updateLastUpdatedText() {
    const lastUpdatedElement = document.getElementById('last-updated');
    if (!lastUpdatedElement || !lastUpdateTime) return;

    const now = new Date();
    const diffMs = now - lastUpdateTime;
    const diffMins = Math.floor(diffMs / 60000);

    let updatedText;
    if (diffMins < 1) {
        updatedText = 'Updated just now';
    } else if (diffMins === 1) {
        updatedText = 'Updated 1 minute ago';
    } else if (diffMins < 60) {
        updatedText = `Updated ${diffMins} minutes ago`;
    } else {
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        if (hours === 1) {
            updatedText = mins > 0 ?
                `Updated 1 hour ${mins} min ago` :
                'Updated 1 hour ago';
        } else {
            updatedText = mins > 0 ?
                `Updated ${hours} hours ${mins} min ago` :
                `Updated ${hours} hours ago`;
        }
    }

    lastUpdatedElement.textContent = updatedText;
}

/**
 * Start a timer to update the "Last Updated" text every minute
 */
export function startLastUpdatedTimer() {
    // Update the text immediately
    updateLastUpdatedText();

    // Set up an interval to update the text every minute
    setInterval(() => {
        updateLastUpdatedText();
    }, 60000); // Update every minute
}

/**
 * Reset the last update time
 * Call this when weather data is manually refreshed
 */
export function resetLastUpdateTime() {
    lastUpdateTime = new Date();
    updateLastUpdatedText();
}