/**
 * Loading state management
 * 
 * Handles the loading indicator for the weather application
 */

// DOM elements
let loadingIndicator;

/**
 * Initialize loading elements
 */
export function initLoading() {
    loadingIndicator = document.getElementById('loading');
}

/**
 * Show loading indicator
 */
export function showLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    
    // Also hide weather data while loading
    const weatherData = document.getElementById('weather-data');
    if (weatherData) weatherData.style.display = 'none';
    
    // Hide any errors
    hideError();
}

/**
 * Hide loading indicator
 */
export function hideLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
}

/**
 * Add a geolocation-specific loading message
 */
export function showGeoLocationLoading() {
    if (!loadingIndicator) return;
    
    // Add a special message for geolocation
    const geoText = document.createElement('div');
    geoText.className = 'geo-loading-text';
    geoText.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Getting your location...';
    loadingIndicator.appendChild(geoText);
}

/**
 * Remove geolocation loading message
 */
export function hideGeoLocationLoading() {
    if (!loadingIndicator) return;
    
    // Remove any geo loading text elements
    const geoText = loadingIndicator.querySelector('.geo-loading-text');
    if (geoText && geoText.parentNode) {
        geoText.parentNode.removeChild(geoText);
    }
}

// Importing the error hide function to avoid circular dependencies
function hideError() {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) errorMessage.style.display = 'none';
}