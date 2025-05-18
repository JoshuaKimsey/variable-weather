/**
 * OpenWeatherMap API Implementation
 * 
 * This module handles all interactions with the OpenWeatherMap API,
 * including data fetching, processing, and error handling.
 */

//==============================================================================
// 1. IMPORTS AND DEPENDENCIES
//==============================================================================

import { displayWeatherWithAlerts, showError, hideLoading, hideError } from '../ui/core.js';
import { isDaytime } from '../utils/geo.js';
import { setApiAttribution } from '../api.js';
import { createEmptyWeatherData, WEATHER_ICONS, PRECIP_INTENSITY } from '../standardWeatherFormat.js';

//==============================================================================
// 2. API ENDPOINTS AND CONFIGURATION
//==============================================================================

// Define API endpoints locally
const OPENWEATHERMAP_ENDPOINTS = {
    CURRENT: 'https://api.openweathermap.org/data/2.5/weather',
    FORECAST: 'https://api.openweathermap.org/data/2.5/forecast'
};

// Internal storage for API key
let apiKey = null;

//==============================================================================
// 3. API KEY MANAGEMENT
//==============================================================================

/**
 * Update the OpenWeatherMap API key
 * @param {string} newKey - The new API key to use
 */
export function updateOpenWeatherMapApiKey(newKey) {
    apiKey = newKey;
    localStorage.setItem('weather_app_openweathermap_api_key', newKey);
    console.log('OpenWeatherMap API key updated');
}

/**
 * Reset the OpenWeatherMap API key
 */
export function resetOpenWeatherMapApiKey() {
    apiKey = null;
    localStorage.removeItem('weather_app_openweathermap_api_key');
    console.log('OpenWeatherMap API key reset');
}

/**
 * Get the current OpenWeatherMap API key
 * @returns {string|null} The API key or null if not set
 */
export function getOpenWeatherMapApiKey() {
    // If we have a key in memory, use that
    if (apiKey) return apiKey;

    // Otherwise try to get it from localStorage
    const storedKey = localStorage.getItem('weather_app_openweathermap_api_key');

    // If found in localStorage, update our in-memory copy
    if (storedKey) {
        apiKey = storedKey;
        return apiKey;
    }

    // No key found
    return null;
}

// Expose the update and reset functions globally for the settings UI
window.updateOpenWeatherMapApiKey = updateOpenWeatherMapApiKey;
window.resetOpenWeatherMapApiKey = resetOpenWeatherMapApiKey;

// Initialize the API key from localStorage if available
(function initApiKey() {
    const storedKey = localStorage.getItem('weather_app_openweathermap_api_key');
    if (storedKey) {
        apiKey = storedKey;
    }
})();

//==============================================================================
// 4. API METADATA
//==============================================================================

/**
 * Metadata for the OpenWeatherMap API provider
 * This information is used by the API registry system
 */
export const API_METADATA = {
    id: 'openweathermap',
    name: 'OpenWeatherMap',
    regions: ['global'], // Works everywhere
    requiresApiKey: true,
    description: 'Global weather data from OpenWeatherMap',
    apiKeyUrl: 'https://openweathermap.org/api',
    
    // API key configuration
    apiKeyConfig: {
        storageKey: 'weather_app_openweathermap_api_key',
        updateFn: updateOpenWeatherMapApiKey,
        resetFn: resetOpenWeatherMapApiKey,
        validator: (key) => /^[0-9a-f]{32}$/.test(key),
        invalidValues: ['']
    },
    
    attribution: {
        name: 'OpenWeatherMap',
        url: 'https://openweathermap.org/'
    },
    
    // Add a hasApiKey method that settings.js can use
    hasApiKey: function() {
        const key = getOpenWeatherMapApiKey();
        if (!key) return false;
        
        // Check against invalid values
        if (this.apiKeyConfig.invalidValues.includes(key)) return false;
        
        return true;
    },
    
    supportsNowcast: false  // OpenWeatherMap doesn't have minute-by-minute precipitation data in the free tier
};

//==============================================================================
// 5. PUBLIC API FUNCTIONS
//==============================================================================

/**
 * Fetch weather from OpenWeatherMap API
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Optional location name
 * @param {boolean} returnData - If true, return data instead of updating UI
 * @returns {Promise|undefined} - Promise with the data if returnData is true
 */
export function fetchOpenWeatherMapWeather(lat, lon, locationName = null, returnData = false) {
    // Get the API key
    const apiKey = getOpenWeatherMapApiKey();
    
    // Check if API key is available
    if (!apiKey || API_METADATA.apiKeyConfig.invalidValues.includes(apiKey)) {
        console.error('No OpenWeatherMap API key configured');
        
        if (returnData) {
            return Promise.reject(new Error('OpenWeatherMap API key required'));
        } else {
            showError('OpenWeatherMap API key required. Please add your API key in Settings to get weather data for this location.');
            hideLoading();
        }
        return;
    }
    
    // Always return a Promise
    return new Promise((resolve, reject) => {
        try {
            // Format lat and lon properly
            const formattedLat = parseFloat(lat).toFixed(4);
            const formattedLon = parseFloat(lon).toFixed(4);
            
            // We need to fetch both current weather and forecast
            Promise.all([
                // Current weather
                fetch(`${OPENWEATHERMAP_ENDPOINTS.CURRENT}?lat=${formattedLat}&lon=${formattedLon}&appid=${apiKey}&units=imperial`),
                // 5-day forecast
                fetch(`${OPENWEATHERMAP_ENDPOINTS.FORECAST}?lat=${formattedLat}&lon=${formattedLon}&appid=${apiKey}&units=imperial`)
            ])
            .then(responses => {
                // Check if responses are OK
                if (!responses[0].ok || !responses[1].ok) {
                    let errorMsg = 'Unable to fetch weather data from OpenWeatherMap.';
                    
                    // Check for specific error conditions
                    if (responses[0].status === 401 || responses[1].status === 401) {
                        errorMsg = 'Invalid OpenWeatherMap API key. Please check your API key in Settings.';
                    }
                    
                    throw new Error(errorMsg);
                }
                
                // Parse the JSON responses
                return Promise.all(responses.map(response => response.json()));
            })
            .then(([currentData, forecastData]) => {
                // Process the data into our standardized format
                const processedData = processOpenWeatherMapData(
                    currentData, 
                    forecastData, 
                    formattedLat, 
                    formattedLon, 
                    locationName
                );
                
                // Set API attribution
                setApiAttribution('openweathermap');
                
                if (returnData) {
                    // Return processed data
                    resolve(processedData);
                } else {
                    // Display the weather data
                    displayWeatherWithAlerts(processedData, locationName);
                    hideLoading();
                    hideError();
                    resolve(); // Resolve with no data when not returning data
                }
            })
            .catch(error => {
                console.error('Error fetching OpenWeatherMap data:', error);
                
                if (returnData) {
                    reject(error);
                } else {
                    showError(error.message || 'Error fetching weather data. Please try again later.');
                    hideLoading();
                }
            });
        } catch (error) {
            console.error('Unexpected error in fetchOpenWeatherMapWeather:', error);
            
            if (returnData) {
                reject(error);
            } else {
                showError('An unexpected error occurred. Please try again later.');
                hideLoading();
            }
        }
    });
}

//==============================================================================
// 6. DATA PROCESSING FUNCTIONS
//==============================================================================

/**
 * Process data from OpenWeatherMap API into standardized format
 * 
 * @param {Object} currentData - Current weather data from OpenWeatherMap
 * @param {Object} forecastData - Forecast data from OpenWeatherMap
 * @param {number} lat - Latitude of the location
 * @param {number} lon - Longitude of the location
 * @param {string} locationName - Optional location name
 * @returns {Object} - Processed weather data in standardized format
 */
function processOpenWeatherMapData(currentData, forecastData, lat, lon, locationName = null) {
    // Create a standardized empty weather data object
    const weatherData = createEmptyWeatherData();
    
    // Set source and timezone
    weatherData.source = 'openweathermap';
    weatherData.timezone = currentData.timezone || 'UTC';
    
    // Process current weather
    processCurrentWeather(weatherData, currentData, lat, lon);
    
    // Process daily forecast
    processDailyForecast(weatherData, forecastData);
    
    // Process hourly forecast
    processHourlyForecast(weatherData, forecastData);
    
    // Set attribution
    weatherData.attribution = {
        name: 'OpenWeatherMap',
        url: 'https://openweathermap.org/'
    };
    
    // OpenWeatherMap doesn't provide weather alerts in the free tier
    weatherData.alerts = [];
    
    // Reset station info - OpenWeatherMap doesn't provide station data
    weatherData.stationInfo = {
        display: false,
        stationName: null,
        stationDistance: null,
        observationTime: null,
        usingForecastDescription: false,
        descriptionAdjusted: false,
        isForecastData: false
    };
    
    return weatherData;
}

/**
 * Process current weather data from OpenWeatherMap
 * @param {Object} weatherData - Weather data object to update
 * @param {Object} currentData - Current weather data from OpenWeatherMap
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 */
function processCurrentWeather(weatherData, currentData, lat, lon) {
    try {
        // Temperature is already in Fahrenheit (units=imperial)
        weatherData.currently.temperature = currentData.main.temp;
        
        // Map weather code to icon
        weatherData.currently.icon = mapOpenWeatherMapCodeToIcon(currentData.weather[0].id);
        
        // Weather description
        weatherData.currently.summary = currentData.weather[0].description;
        
        // Wind speed (convert from m/s to mph)
        weatherData.currently.windSpeed = currentData.wind.speed * 2.237;
        
        // Wind direction (already in degrees)
        weatherData.currently.windDirection = currentData.wind.deg;
        
        // Humidity (convert from percentage to decimal)
        weatherData.currently.humidity = currentData.main.humidity / 100;
        
        // Pressure (already in hPa)
        weatherData.currently.pressure = currentData.main.pressure;
        
        // Visibility (convert from meters to miles)
        if (currentData.visibility) {
            weatherData.currently.visibility = currentData.visibility * 0.000621371;
        }
        
        // Set daylight status
        weatherData.currently.isDaytime = isDaytime(lat, lon);
        
    } catch (error) {
        console.error('Error processing current weather data:', error);
    }
}

/**
 * Process daily forecast data from OpenWeatherMap
 * @param {Object} weatherData - Weather data object to update
 * @param {Object} forecastData - Forecast data from OpenWeatherMap
 */
function processDailyForecast(weatherData, forecastData) {
    try {
        // Group forecast data by day
        const dailyData = {};
        
        forecastData.list.forEach(item => {
            const date = new Date(item.dt * 1000);
            const day = date.toISOString().split('T')[0];
            
            if (!dailyData[day]) {
                dailyData[day] = {
                    temps: [],
                    weather: [],
                    precip: []
                };
            }
            
            dailyData[day].temps.push(item.main.temp);
            dailyData[day].weather.push(item.weather[0]);
            if (item.pop) dailyData[day].precip.push(item.pop);
        });
        
        // Process each day
        Object.entries(dailyData).forEach(([day, data]) => {
            const date = new Date(day);
            
            weatherData.daily.data.push({
                time: date.getTime() / 1000,
                icon: mapOpenWeatherMapCodeToIcon(data.weather[0].id),
                temperatureHigh: Math.max(...data.temps),
                temperatureLow: Math.min(...data.temps),
                summary: data.weather[0].description,
                precipChance: data.precip.length ? Math.max(...data.precip) * 100 : 0
            });
        });
        
    } catch (error) {
        console.error('Error processing daily forecast data:', error);
    }
}

/**
 * Process hourly forecast data from OpenWeatherMap
 * @param {Object} weatherData - Weather data object to update
 * @param {Object} forecastData - Forecast data from OpenWeatherMap
 */
function processHourlyForecast(weatherData, forecastData) {
    try {
        // Take first 12 hours of forecast
        const hoursToInclude = Math.min(12, forecastData.list.length);
        
        for (let i = 0; i < hoursToInclude; i++) {
            const hour = forecastData.list[i];
            
            // Format time string (e.g., "2 PM")
            const date = new Date(hour.dt * 1000);
            const hourNum = date.getHours();
            const hour12 = hourNum % 12 || 12;
            const ampm = hourNum >= 12 ? 'PM' : 'AM';
            const formattedTime = `${hour12} ${ampm}`;
            
            weatherData.hourly.data.push({
                time: hour.dt,
                formattedTime: formattedTime,
                temperature: hour.main.temp,
                icon: mapOpenWeatherMapCodeToIcon(hour.weather[0].id),
                summary: hour.weather[0].description,
                precipChance: hour.pop ? hour.pop * 100 : 0,
                isDaytime: hour.weather[0].icon.includes('d')
            });
        }
        
    } catch (error) {
        console.error('Error processing hourly forecast data:', error);
    }
}

//==============================================================================
// 7. HELPER FUNCTIONS
//==============================================================================

/**
 * Map OpenWeatherMap weather code to our icon system
 * Based on OpenWeatherMap weather codes: https://openweathermap.org/weather-conditions
 * 
 * @param {number} code - OpenWeatherMap weather code
 * @returns {string} - Icon code for our application
 */
function mapOpenWeatherMapCodeToIcon(code) {
    // Thunderstorm
    if (code >= 200 && code < 300) {
        return WEATHER_ICONS.THUNDERSTORM;
    }
    
    // Drizzle
    if (code >= 300 && code < 400) {
        return WEATHER_ICONS.RAIN;
    }
    
    // Rain
    if (code >= 500 && code < 600) {
        return WEATHER_ICONS.RAIN;
    }
    
    // Snow
    if (code >= 600 && code < 700) {
        return WEATHER_ICONS.SNOW;
    }
    
    // Atmosphere (fog, mist, etc.)
    if (code >= 700 && code < 800) {
        return WEATHER_ICONS.FOG;
    }
    
    // Clear
    if (code === 800) {
        return WEATHER_ICONS.CLEAR_DAY;
    }
    
    // Clouds
    if (code > 800) {
        if (code === 801) return WEATHER_ICONS.PARTLY_CLOUDY_DAY;
        if (code === 802) return WEATHER_ICONS.PARTLY_CLOUDY_DAY;
        return WEATHER_ICONS.CLOUDY;
    }
    
    // Default fallback
    return WEATHER_ICONS.CLOUDY;
} 