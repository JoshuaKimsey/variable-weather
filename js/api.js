/**
 * Main API Coordinator for weather data retrieval
 * 
 * This module acts as the central coordinator for different weather API providers.
 * It determines which API to use based on location and handles fallbacks.
 */

//==============================================================================
// 1. IMPORTS AND DEPENDENCIES
//==============================================================================

import { resetLastUpdateTime } from './autoUpdate.js';
import { saveLocationToCache } from './utils.js';
import { locationChanged } from './astronomicalView.js';
import { showLoading } from './ui.js';
import { fetchNWSWeather } from './api/nwsApi.js';
import { fetchOpenMeteoWeather } from './api/openMeteoApi.js';
import { fetchPirateWeather } from './api/pirateWeatherApi.js';

//==============================================================================
// 2. PUBLIC API FUNCTIONS
//==============================================================================

/**
 * Fetch weather data from the appropriate API
 * This is the main entry point that determines which API to use
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Optional location name
 */
export function fetchWeather(lat, lon, locationName) {
    // Reset the last update time whenever we fetch new weather data
    resetLastUpdateTime();

    // Show loading indicator
    showLoading();

    // Update radar location when fetching new weather data
    try {
        // Check if the function exists and is loaded
        if (typeof updateRadarLocation === 'function') {
            updateRadarLocation(lat, lon);
        }
    } catch (error) {
        console.log('Radar view not yet initialized');
    }

    // Update astronomical information
    try {
        if (typeof updateAstroInfo === 'function') {
            updateAstroInfo(lat, lon);
        }
    } catch (error) {
        console.error('Error updating astronomical data:', error);
    }

    // Determine if the location is in the US
    const countryCode = locationName ? getCountryCode(locationName) : 'us'; // Default to US if unknown

    if (isUSLocation(countryCode)) {
        // Use National Weather Service API for US locations
        // The NWS API implementation has fallbacks to Open-Meteo if it fails
        fetchNWSWeather(lat, lon, locationName);
    } else {
        // Use Open-Meteo API for non-US locations (replacing Pirate Weather as primary)
        fetchOpenMeteoWeather(lat, lon, locationName);
    }

    try {
        // Notify the astro module of location changes
        if (typeof locationChanged === 'function') {
            locationChanged(lat, lon);
        }
    } catch (error) {
        console.error('Error notifying astro module of location change:', error);
    }
    
    // Cache the location after successful fetch request is initiated
    try {
        if (typeof saveLocationToCache === 'function') {
            saveLocationToCache(lat, lon, locationName);
        }
    } catch (error) {
        console.error('Error caching location:', error);
    }
}

//==============================================================================
// 3. ATTRIBUTION FUNCTIONS
//==============================================================================

/**
 * Set the API attribution text based on the data source
 * 
 * @param {string} source - The data source ('nws', 'open-meteo', or 'pirate')
 */
export function setApiAttribution(source) {
    const apiIndicator = document.getElementById('api-indicator');
    if (!apiIndicator) return;
    
    switch(source) {
        case 'nws':
            apiIndicator.innerHTML = 'Data provided by <a href="https://www.weather.gov/" target="_blank" class="attribution-link">National Weather Service</a>';
            break;
        case 'open-meteo':
            apiIndicator.innerHTML = 'Data provided by <a href="https://open-meteo.com/" target="_blank" class="attribution-link">Open-Meteo</a> (CC BY 4.0)';
            break;
        case 'pirate':
            apiIndicator.innerHTML = 'Data provided by <a href="https://pirateweather.net/" target="_blank" class="attribution-link">Pirate Weather</a>';
            break;
        default:
            apiIndicator.innerHTML = 'Weather data provided by multiple services';
    }
    
    apiIndicator.className = 'api-indicator';
}

//==============================================================================
// 4. HELPER FUNCTIONS
//==============================================================================

/**
 * Determine if a location is in the United States
 * @param {string} countryCode - Country code to check
 * @returns {boolean} True if the location is in the US
 */
function isUSLocation(countryCode) {
    return countryCode === 'us';
}

/**
 * Extract country code from a location display name
 * @param {string} displayName - Location display name
 * @returns {string} Country code ('us' for US locations, 'non-us' for others)
 */
function getCountryCode(displayName) {
    const parts = displayName.split(',');
    const lastPart = parts[parts.length - 1].trim().toLowerCase();

    if (lastPart === 'usa' || lastPart === 'united states' || 
        lastPart === 'united states of america' || lastPart === 'us') {
        return 'us';
    }
    return 'non-us';
}