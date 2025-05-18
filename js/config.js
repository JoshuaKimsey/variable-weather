/**
 * Configuration constants for the weather application
 */

// Default API key for Pirate Weather (fallback for minute-by-minute forecasts)
let PIRATE_WEATHER_API_KEY = '*insert-your-api-key-here*';

// Function to update the API key
window.updatePirateWeatherApiKey = function (newKey) {
    PIRATE_WEATHER_API_KEY = newKey;
    console.log('Pirate Weather API key updated');
};

// Function to reset to default API key
window.resetPirateWeatherApiKey = function () {
    PIRATE_WEATHER_API_KEY = '';
    console.log('Pirate Weather API key reset to default');
};

// Export the key as a getter to always get the current value
export const getPirateWeatherApiKey = () => PIRATE_WEATHER_API_KEY;

// Default coordinates (New York City)
export const DEFAULT_COORDINATES = {
    lat: 40.7128,
    lon: -74.0060
};