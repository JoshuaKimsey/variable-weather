/**
 * Icon Performance and Settings Module
 * 
 * This module handles the performance measurement and preferences
 * for switching between dynamic weather icons and lightweight Meteocons.
 */

// Storage key for icon preference
const ICON_PREFERENCE_STORAGE = 'weather_app_icon_preference';

// DOM elements for icon settings
let dynamicIconsRadio, lightweightIconsRadio;

// Current icon preference ('dynamic' or 'lightweight')
let currentIconPreference = 'dynamic';

/**
 * Initialize the icon settings and detect performance
 */
export function initIconSettings() {
    // Get DOM elements
    dynamicIconsRadio = document.getElementById('dynamic-icons');
    lightweightIconsRadio = document.getElementById('lightweight-icons');

    // Add event listeners
    if (dynamicIconsRadio && lightweightIconsRadio) {
        dynamicIconsRadio.addEventListener('change', updateIconPreference);
        lightweightIconsRadio.addEventListener('change', updateIconPreference);
    }

    // Load saved preference or detect performance
    loadSavedPreferenceOrDetect();
}

/**
 * Load saved preference or run performance detection
 */
function loadSavedPreferenceOrDetect() {
    const savedPreference = localStorage.getItem(ICON_PREFERENCE_STORAGE);
    
    if (savedPreference) {
        // Use saved preference
        setIconPreference(savedPreference);
    } else {
        // First time - detect performance and set recommendation
        detectPerformanceAndRecommend();
    }
}

/**
 * Set the icon preference UI and save to storage
 */
function setIconPreference(preference) {
    currentIconPreference = preference;
    
    // Update UI
    if (preference === 'lightweight') {
        lightweightIconsRadio.checked = true;
    } else {
        dynamicIconsRadio.checked = true;
    }
    
    // Save to storage
    localStorage.setItem(ICON_PREFERENCE_STORAGE, preference);
    
    // Make preference available globally
    window.currentIconPreference = preference;
}

/**
 * Update icons preference based on user selection with page reload
 */
function updateIconPreference() {
    const selectedIconType = document.querySelector('input[name="icon-type"]:checked')?.value || 'dynamic';
    
    // Save the previous preference to check if it changed
    const previousPreference = currentIconPreference;
    
    // Update the preference
    setIconPreference(selectedIconType);
    
    // Only reload if the preference actually changed
    if (previousPreference !== selectedIconType) {
        // Show a brief message indicating the page will reload
        const statusEl = document.getElementById('api-key-status');
        if (statusEl) {
            statusEl.textContent = "Icon style changed. Refreshing page...";
            statusEl.className = "status-success";
        }
        
        // Wait a brief moment so the user sees the success message
        setTimeout(() => {
            // Simply reload the page to apply changes everywhere
            window.location.reload();
        }, 800);
    }
}

/**
 * Detect performance and recommend appropriate icon type
 */
function detectPerformanceAndRecommend() {
    // Start with a default of dynamic icons
    let recommendation = 'dynamic';
    
    // Check if the device is likely low-powered
    if (isLowPoweredDevice()) {
        recommendation = 'lightweight';
    } else {
        // Measure performance of creating a dynamic icon
        if (testIconPerformance()) {
            recommendation = 'lightweight';
        }
    }
    
    // Set the recommendation
    setIconPreference(recommendation);
}

/**
 * Test if the device appears to be low-powered
 * @returns {boolean} True if device seems low-powered
 */
function isLowPoweredDevice() {
    // Check hardware concurrency (CPU cores)
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
        return true;
    }
    
    // Check device memory
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        return true;
    }
    
    // Check for battery saver mode or connection save-data
    if (navigator.connection && navigator.connection.saveData) {
        return true;
    }
    
    // Check if it's a mobile device (simplified check)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        // Mobile devices are more likely to have performance constraints
        return Math.random() > 0.7; // 30% chance for mobile to use lightweight
    }
    
    return false;
}

/**
 * Test the performance of creating a dynamic weather icon
 * @returns {boolean} True if dynamic icons might be too heavy
 */
function testIconPerformance() {
    // Create a test container off-screen
    const testContainer = document.createElement('div');
    testContainer.style.position = 'absolute';
    testContainer.style.left = '-9999px';
    testContainer.style.top = '-9999px';
    document.body.appendChild(testContainer);
    
    // Measure time to create several DOM elements to simulate icon creation
    try {
        const startTime = performance.now();
        
        // Create a bunch of elements with styles to simulate icon creation
        for (let i = 0; i < 30; i++) {
            const div = document.createElement('div');
            div.className = 'test-element';
            div.style.width = '10px';
            div.style.height = '10px';
            div.style.borderRadius = '50%';
            div.style.position = 'absolute';
            div.style.backgroundColor = '#FFFFFF';
            div.style.opacity = Math.random().toString();
            div.style.top = (Math.random() * 100) + 'px';
            div.style.left = (Math.random() * 100) + 'px';
            testContainer.appendChild(div);
        }
        
        const endTime = performance.now();
        
        // Clean up
        document.body.removeChild(testContainer);
        
        // If creation took more than 50ms, recommend lightweight icons
        return (endTime - startTime) > 50;
    } catch (error) {
        // On error, clean up and default to not having performance issues
        if (document.body.contains(testContainer)) {
            document.body.removeChild(testContainer);
        }
        return false;
    }
}

/**
 * Get the current icon preference
 * @returns {string} 'dynamic' or 'lightweight'
 */
export function getIconPreference() {
    return currentIconPreference;
}

/**
 * Check if lightweight icons should be used
 * @returns {boolean} True if lightweight icons should be used
 */
export function useLightweightIcons() {
    return currentIconPreference === 'lightweight';
}