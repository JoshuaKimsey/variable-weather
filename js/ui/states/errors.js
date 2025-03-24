/**
 * Error state management
 * 
 * Handles error messages for the weather application
 */

// DOM elements
let errorMessage;

/**
 * Initialize error message elements
 */
export function initErrors() {
    errorMessage = document.getElementById('error-message');
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
export function showError(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
    
    // Hide loading indicator
    hideLoading();
    
    // Hide weather data
    const weatherData = document.getElementById('weather-data');
    if (weatherData) weatherData.style.display = 'none';
}

/**
 * Hide error message
 */
export function hideError() {
    if (errorMessage) errorMessage.style.display = 'none';
}

// Importing the loading hide function to avoid circular dependencies
function hideLoading() {
    const loadingIndicator = document.getElementById('loading');
    if (loadingIndicator) loadingIndicator.style.display = 'none';
}