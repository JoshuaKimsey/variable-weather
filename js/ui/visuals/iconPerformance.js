/**
 * Icon Performance and Settings Module
 * 
 * This module handles device detection and preferences
 * for switching between dynamic weather icons and lightweight Meteocons.
 */

// Storage key for icon preference
const ICON_PREFERENCE_STORAGE = 'weather_app_icon_preference';

// DOM elements for icon settings
let dynamicIconsRadio, lightweightIconsRadio;

// Current icon preference ('dynamic' or 'lightweight')
let currentIconPreference = 'dynamic';

/**
 * Initialize the icon settings and detect device type
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

    // Load saved preference or detect device
    loadSavedPreferenceOrDetect();
}

/**
 * Load saved preference or run device detection
 */
function loadSavedPreferenceOrDetect() {
    const savedPreference = localStorage.getItem(ICON_PREFERENCE_STORAGE);
    
    if (savedPreference) {
        // Use saved preference - user's explicit choice overrides automatic detection
        setIconPreference(savedPreference);
    } else {
        // First time - detect device type and set recommendation
        detectDeviceAndSetIcons();
    }
}

/**
 * Set the icon preference UI and save to storage
 */
function setIconPreference(preference) {
    currentIconPreference = preference;
    
    // Update UI if elements exist
    if (lightweightIconsRadio && dynamicIconsRadio) {
        if (preference === 'lightweight') {
            lightweightIconsRadio.checked = true;
        } else {
            dynamicIconsRadio.checked = true;
        }
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
 * Detect device type and set appropriate icons
 */
function detectDeviceAndSetIcons() {
    // Default to dynamic icons for tablets, desktops, etc.
    let recommendation = 'dynamic';
    
    // Set lightweight icons for mobile phones
    if (isMobileDevice()) {
        recommendation = 'lightweight';
    }
    
    // Set the recommendation
    setIconPreference(recommendation);
}

/**
 * Test if the device is a mobile phone (not a tablet)
 * @returns {boolean} True if device is a mobile phone
 */
function isMobileDevice() {
    // Check for mobile user agent
    const mobileUserAgent = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Check if it's a phone-sized screen (typically under 768px width)
    const isPhoneSize = window.innerWidth < 768;
    
    // Try to exclude tablets (they usually have mobile user agents but larger screens)
    const isNotTablet = !/iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
    
    // Consider it a mobile phone if it has a mobile user agent, phone-sized screen, and is not a tablet
    return mobileUserAgent && isPhoneSize && isNotTablet;
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