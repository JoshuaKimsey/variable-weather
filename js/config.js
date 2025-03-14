/**
 * Configuration constants for the weather application
 */

// Default API key for Pirate Weather (fallback for non-US locations)
let PIRATE_WEATHER_API_KEY = '*insert-your-api-key-here*';

// User Agent for NWS API
export const NWS_USER_AGENT = '(joshuakimsey.github.io/variable-weather, https://github.com/JoshuaKimsey)';

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

// API endpoints
export const API_ENDPOINTS = {
    NWS_POINTS: 'https://api.weather.gov/points',
    NWS_GRIDPOINTS: 'https://api.weather.gov/gridpoints',
    NWS_ALERTS: 'https://api.weather.gov/alerts/active',
    PIRATE_WEATHER: 'https://api.pirateweather.net/forecast',
    GEOCODING: 'https://nominatim.openstreetmap.org/search'
};

// Create request options with proper headers for NWS API calls
export function createNWSRequestOptions() {
    return {
        headers: {
            'User-Agent': NWS_USER_AGENT,
            'Accept': 'application/geo+json'
        }
    };
}