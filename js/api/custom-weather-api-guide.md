# Adding Custom Weather API Sources to Variable Weather

This guide will walk you through the process of adding a custom weather API source to the Variable Weather application. By following this tutorial, you'll be able to extend the app's capabilities to work with any weather API provider of your choice.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Understanding the Architecture](#understanding-the-architecture)
- [Quick Start](#quick-start)
- [Step 1: Create the API Source File](#step-1-create-the-api-source-file)
- [Step 2: Register the New API Provider](#step-2-register-the-new-api-provider)
- [Step 3: Update the Service Worker](#step-3-update-the-service-worker)
- [Testing Your Implementation](#testing-your-implementation)
- [Example: OpenWeatherMap Implementation](#example-openweathermap-implementation)
- [Troubleshooting](#troubleshooting)
- [Performance Considerations](#performance-considerations)
- [Contributing](#contributing)

## Prerequisites

Before you begin, make sure you have:

- A basic understanding of JavaScript
- Familiarity with REST APIs and how to fetch data
- Access to the API documentation for your chosen weather provider
- An API key for your chosen weather service (if required)

## Understanding the Architecture

Variable Weather uses a modular system for weather data providers, where each API source is self-contained and follows a standardized interface. This architecture makes it easy to add, remove, or switch between different providers.

Key components of the architecture:

1. **API Registry**: Central system in `api.js` that manages all available providers
2. **Standardized Data Format**: Common format for weather data defined in `standardWeatherFormat.js`
3. **Provider-Specific Implementations**: Individual files in the `/api` directory (e.g., `nwsApi.js`, `openMeteoApi.js`)
4. **API Selection Logic**: The system chooses which API to use based on location and user preferences

Each API provider module must export:
- Metadata about the provider
- A main fetch function for retrieving weather data
- (Optional) A nowcast function for minute-by-minute precipitation data
- API key management functions (if the provider requires an API key)

## Quick Start
1. Create `yourProviderApi.js` in the `api` directory
2. Copy the basic structure from the example
3. Implement the required functions:
   - `API_METADATA` object
   - `fetchYourProviderWeather` function
   - Data processing functions
4. Register your provider in `api.js`
5. Add your API domain to `sw.js`

## Step 1: Create the API Source File

First, create a new JavaScript file in the `api` directory for your provider, following this naming convention: `yourProviderNameApi.js`

### 1.1 Basic Structure

Your file should include these main sections:

```javascript
/**
 * Your Provider Name API Implementation
 * 
 * This module handles all interactions with the Your Provider API,
 * including data fetching, processing, and error handling.
 */

//==============================================================================
// 1. IMPORTS AND DEPENDENCIES
//==============================================================================

import { API_ENDPOINTS } from '../config.js';
import { displayWeatherWithAlerts, showError, hideLoading, hideError } from '../ui/core.js';
import { isDaytime } from '../utils/geo.js';
import { setApiAttribution } from '../api.js';
import { createEmptyWeatherData, WEATHER_ICONS, PRECIP_INTENSITY } from '../standardWeatherFormat.js';

//==============================================================================
// 2. API ENDPOINTS AND CONFIGURATION
//==============================================================================

// Define API endpoints locally
const YOUR_PROVIDER_ENDPOINTS = {
    CURRENT: 'https://api.yourprovider.com/current',
    FORECAST: 'https://api.yourprovider.com/forecast'
    // Add any other endpoints you need
};

//==============================================================================
// 3. API KEY MANAGEMENT (if required)
//==============================================================================

// API key management code here

//==============================================================================
// 4. API METADATA
//==============================================================================

// Provider metadata definition here

//==============================================================================
// 5. PUBLIC API FUNCTIONS
//==============================================================================

// Main fetch function and optional nowcast function here

//==============================================================================
// 6. DATA PROCESSING FUNCTIONS
//==============================================================================

// Functions to convert API data to standardized format

//==============================================================================
// 7. HELPER FUNCTIONS
//==============================================================================

// Utility functions for data processing
```

### 1.2 API Key Management (if required)

If your provider requires an API key, include these functions:

```javascript
// Internal storage for API key
let apiKey = null;

/**
 * Update the Provider API key
 * @param {string} newKey - The new API key to use
 */
export function updateProviderApiKey(newKey) {
    apiKey = newKey;
    localStorage.setItem('weather_app_provider_api_key', newKey);
    console.log('Provider API key updated');
}

/**
 * Reset the Provider API key
 */
export function resetProviderApiKey() {
    apiKey = null;
    localStorage.removeItem('weather_app_provider_api_key');
    console.log('Provider API key reset');
}

/**
 * Get the current Provider API key
 * @returns {string|null} The API key or null if not set
 */
export function getProviderApiKey() {
    // If we have a key in memory, use that
    if (apiKey) return apiKey;

    // Otherwise try to get it from localStorage
    const storedKey = localStorage.getItem('weather_app_provider_api_key');

    // If found in localStorage, update our in-memory copy
    if (storedKey) {
        apiKey = storedKey;
        return apiKey;
    }

    // No key found
    return null;
}

// Expose the update and reset functions globally for the settings UI
window.updateProviderApiKey = updateProviderApiKey;
window.resetProviderApiKey = resetProviderApiKey;

// Initialize the API key from localStorage if available
(function initApiKey() {
    const storedKey = localStorage.getItem('weather_app_provider_api_key');
    if (storedKey) {
        apiKey = storedKey;
    }
})();
```

Remember to replace `provider` with your provider's name in the function names and the localStorage keys.

### 1.3 API Metadata

Define metadata for your provider:

```javascript
export const API_METADATA = {
    id: 'your-provider-id',
    name: 'Your Provider Name',
    regions: ['global'],  // or specific regions like ['us', 'eu']
    requiresApiKey: true, // or false if no API key is needed
    description: 'Description of your provider',
    apiKeyUrl: 'https://yourprovider.com/get-api-key',  // URL where users can get an API key
    
    // API key configuration (if apiKey is required)
    apiKeyConfig: {
        storageKey: 'weather_app_your_provider_api_key',
        updateFn: updateProviderApiKey,
        resetFn: resetProviderApiKey,
        validator: (key) => /^[a-zA-Z0-9]{32}$/.test(key),  // Regex to validate key format
        invalidValues: ['']  // Values that aren't valid keys
    },
    
    attribution: {
        name: 'Your Provider Name',
        url: 'https://yourprovider.com/'
    },
    
    // Add a hasApiKey method that settings.js can use
    hasApiKey: function() {
        const key = getProviderApiKey();
        if (!key) return false;
        
        // Check against invalid values
        if (this.apiKeyConfig.invalidValues.includes(key)) return false;
        
        return true;
    },
    
    supportsNowcast: false  // Set to true if provider supports minute-by-minute forecasts
};
```

### 1.4 Public API Functions

Your main fetch function (required):

```javascript
/**
 * Fetch weather from Your Provider API
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Optional location name
 * @param {boolean} returnData - If true, return data instead of updating UI
 * @returns {Promise|undefined} - Promise with the data if returnData is true
 */
export function fetchYourProviderWeather(lat, lon, locationName = null, returnData = false) {
    // Get the API key (if required)
    const apiKey = getProviderApiKey();
    
    // Check if API key is available (if required)
    if (requiresApiKey && (!apiKey || API_METADATA.apiKeyConfig.invalidValues.includes(apiKey))) {
        console.error('No Provider API key configured');
        
        if (returnData) {
            return Promise.reject(new Error('Provider API key required'));
        } else {
            showError('Provider API key required. Please add your API key in Settings to get weather data for this location.');
            hideLoading();
        }
        return;
    }
    
    // Return a Promise
    return new Promise((resolve, reject) => {
        try {
            // Format lat and lon properly
            const formattedLat = parseFloat(lat).toFixed(4);
            const formattedLon = parseFloat(lon).toFixed(4);
            
            // Build the API URL with proper parameters
            const url = `${YOUR_PROVIDER_ENDPOINTS.CURRENT}?lat=${formattedLat}&lon=${formattedLon}&appid=${apiKey}`;
            
            // Make the API request
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Unable to fetch data: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Process the data into our standardized format
                    const processedData = processYourProviderData(data, formattedLat, formattedLon, locationName);
                    
                    // Set API attribution
                    setApiAttribution('your-provider-id');
                    
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
                    console.error('Error fetching Your Provider data:', error);
                    
                    if (returnData) {
                        reject(error);
                    } else {
                        showError(error.message || 'Error fetching weather data. Please try again later.');
                        hideLoading();
                    }
                });
        } catch (error) {
            console.error('Unexpected error in fetchYourProviderWeather:', error);
            
            if (returnData) {
                reject(error);
            } else {
                showError('An unexpected error occurred. Please try again later.');
                hideLoading();
            }
        }
    });
}
```

Optional nowcast function (if your provider supports minute-by-minute precipitation data):

```javascript
/**
 * Fetch only nowcast data from Your Provider
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} - Promise that resolves to nowcast data
 */
export function fetchYourProviderNowcastOnly(lat, lon) {
    // Implementation similar to the main fetch function, but returning only nowcast data
}
```

### 1.5 Data Processing Functions

The most important part is mapping your provider's data to the standardized format:

```javascript
/**
 * Process data from Your Provider API into standardized format
 * 
 * @param {Object} data - Raw data from Your Provider API
 * @param {number} lat - Latitude of the location
 * @param {number} lon - Longitude of the location
 * @param {string} locationName - Optional location name
 * @returns {Object} - Processed weather data in standardized format
 */
function processYourProviderData(data, lat, lon, locationName = null) {
    // Create a standardized empty weather data object
    const weatherData = createEmptyWeatherData();
    
    // Set source and timezone
    weatherData.source = 'your-provider-id';
    weatherData.timezone = extractTimezone(data) || locationName || `Location at ${lat},${lon}`;
    
    // Process current weather
    processCurrentWeather(weatherData, data, lat, lon);
    
    // Process daily forecast
    processDailyForecast(weatherData, data, lat, lon);
    
    // Process hourly forecast
    processHourlyForecast(weatherData, data, lat, lon);
    
    // Add alerts if available
    if (data.alerts) {
        weatherData.alerts = processAlerts(data.alerts);
    }
    
    // Set attribution
    weatherData.attribution = {
        name: 'Your Provider Name',
        url: 'https://yourprovider.com/'
    };
    
    return weatherData;
}

/**
 * Process current weather data
 * @param {Object} weatherData - Weather data object to update
 * @param {Object} apiData - Current weather data from Your Provider
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 */
function processCurrentWeather(weatherData, apiData, lat, lon) {
    try {
        // Map the provider's data to our standard format
        // This will vary based on your provider's data structure
        
        // Example:
        weatherData.currently.temperature = convertTemperature(apiData.temp);
        weatherData.currently.icon = mapWeatherCodeToIcon(apiData.weatherCode);
        weatherData.currently.summary = apiData.description;
        weatherData.currently.windSpeed = convertWindSpeed(apiData.wind);
        // etc.
    } catch (error) {
        console.error('Error processing current weather data:', error);
    }
}

// Similar functions for processDailyForecast, processHourlyForecast, and processAlerts
```

### 1.6 Imports

At the top of your file (or at the end to avoid undeclared dependencies), include necessary imports:

```javascript
import { displayWeatherWithAlerts, showError, hideLoading, hideError } from '../ui/core.js';
import { isDaytime } from '../utils/geo.js';
import { setApiAttribution } from '../api.js';
import { createEmptyWeatherData, ALERT_SEVERITY, WEATHER_ICONS, PRECIP_INTENSITY } from '../standardWeatherFormat.js';
```

## Step 2: Register the New API Provider

Add your provider to the API registry by updating `api.js`:

```javascript
// Add import for your new provider
import { API_METADATA as yourProviderMetadata, fetchYourProviderWeather, fetchYourProviderNowcastOnly } from './api/yourProviderApi.js';

// In the provider registration section, add:
registerApiProvider(
    yourProviderMetadata,
    fetchYourProviderWeather,
    supportsNowcast ? fetchYourProviderNowcastOnly : null  // Include nowcast function if supported
);
```

## Step 3: Update the Service Worker

Add your provider's API domain to the list of API URLs in `sw.js` to ensure it works in offline mode:

```javascript
const API_URLs = [
  'api.weather.gov',
  'api.pirateweather.net',
  'api.open-meteo.com',
  'api.yourprovider.com',  // Add your provider's API domain here
  'nominatim.openstreetmap.org'
]
```

Don't forget to also add your API file to the `ASSETS` array in `sw.js` to ensure it's cached for offline use:

```javascript
const ASSETS = [
  // ... other assets ...
  './js/api/nwsApi.js',
  './js/api/openMeteoApi.js',
  './js/api/yourProviderApi.js',  // Add your API file here
  './js/api/pirateWeatherApi.js',
  // ... other assets ...
];
```

## Testing Your Implementation

Once you've completed the implementation, test it by:

1. Go to the Settings page in your app
2. Select your provider under the Data Sources tab
3. Enter your API key (if required)
4. Weather data should now be fetched from your provider

Check that all aspects of the weather display work correctly:
- Current conditions
- Daily forecast
- Hourly forecast
- Alerts (if supported)
- Nowcast (if supported)

## Example: OpenWeatherMap Implementation

Here's a real-world example using OpenWeatherMap API:

```javascript
/**
 * OpenWeatherMap API Implementation
 * 
 * This module handles all interactions with the OpenWeatherMap API,
 * including data fetching, processing, and error handling.
 */

//==============================================================================
// 1. IMPORTS AND DEPENDENCIES
//==============================================================================

import { API_ENDPOINTS } from '../config.js';
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
```

You would then register this provider in `api.js`:

```javascript
import { API_METADATA as openWeatherMapMetadata, fetchOpenWeatherMapWeather } from './api/openWeatherMapApi.js';

registerApiProvider(
    openWeatherMapMetadata,
    fetchOpenWeatherMapWeather,
    null  // OpenWeatherMap doesn't support nowcast in the free tier
);
```

And add the API URL to `sw.js`:

```javascript
const API_URLs = [
  'api.weather.gov',
  'api.pirateweather.net',
  'api.open-meteo.com',
  'api.openweathermap.org',  // Add OpenWeatherMap API domain
  'nominatim.openstreetmap.org'
]
```

Don't forget to also add the OpenWeatherMap API file to the `ASSETS` array in `sw.js` to ensure it's cached for offline use:

```javascript
const ASSETS = [
  // ... other assets ...
  './js/api/nwsApi.js',
  './js/api/openMeteoApi.js',
  './js/api/openWeatherMapApi.js',  // Add OpenWeatherMap API file
  './js/api/pirateWeatherApi.js',
  // ... other assets ...
];
```

## Troubleshooting

Common issues and solutions:

1. **API key not recognized**: Make sure you're storing the key in localStorage with the correct key name and validating it properly.

2. **Data not appearing in the UI**: Check your data processing functions to ensure they're correctly mapping the API's response to the standardized format.

3. **API errors**: Check your API endpoints and parameters, and ensure your error handling is properly reporting issues.

4. **Provider not showing in settings**: Verify that your provider is properly registered in `api.js`.

5. **CORS errors**: Some APIs might not allow requests from browsers. You might need to set up a proxy server or look for APIs that support CORS.

6. **Data format mismatch**: Carefully review `standardWeatherFormat.js` to ensure you're providing all required fields in the correct format.

7. **Console errors**: Always check the browser console for JavaScript errors that might indicate problems in your implementation.

By following this guide, you should be able to successfully add any weather API provider to Variable Weather. Remember to respect each provider's terms of service and attribution requirements.

## Performance Considerations
- Implement proper caching
- Minimize API calls
- Handle rate limits
- Optimize data processing

## Contributing
When submitting a new API implementation:
1. Follow the existing code style
2. Include proper documentation
3. Add test cases
4. Update the service worker
5. Submit a pull request
