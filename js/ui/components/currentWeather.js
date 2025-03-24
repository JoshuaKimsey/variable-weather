/**
 * Current Weather Component
 * 
 * Handles the display of current weather conditions
 */

//==============================================================================
// 1. IMPORTS
//==============================================================================

import { formatTemperature, formatWindSpeed, formatPressure, formatVisibility } from '../../utils/units.js';
import { setWeatherIcon } from '../visuals/dynamicIcons.js';
import { setWeatherBackground } from '../visuals/dynamicBackgrounds.js';
import { formatDate, updatePageTitle, getLocalTimeForLocation } from '../../utils/formatting.js';

//==============================================================================
// 2. DOM REFERENCES
//==============================================================================

// DOM elements
let locationElement, dateElement, temperatureElement, weatherDescriptionElement, weatherIconElement,
    windSpeedElement, humidityElement, pressureElement, visibilityElement, stationInfoElement;

//==============================================================================
// 3. INITIALIZATION
//==============================================================================

/**
 * Initialize the current weather component
 */
export function initCurrentWeather() {
    // Get all DOM elements
    locationElement = document.getElementById('location');
    dateElement = document.getElementById('date');
    temperatureElement = document.getElementById('temperature');
    weatherDescriptionElement = document.getElementById('weather-description');
    weatherIconElement = document.getElementById('weather-icon');
    windSpeedElement = document.getElementById('wind-speed');
    humidityElement = document.getElementById('humidity');
    pressureElement = document.getElementById('pressure');
    visibilityElement = document.getElementById('visibility');
    stationInfoElement = document.getElementById('station-info');
}

//==============================================================================
// 4. DISPLAY FUNCTIONS
//==============================================================================

/**
 * Update the current weather display
 * @param {Object} data - Weather data object
 * @param {string} locationName - Location name
 */
export function updateCurrentWeather(data, locationName) {
    // Get current weather data
    const current = data.currently;

    // Set location name
    if (locationName) {
        locationElement.textContent = formatLocationName(locationName);
    } else {
        locationElement.textContent = data.timezone ? data.timezone.replace('/', ', ').replace('_', ' ') : 'Unknown Location';
    }

    // Set date
    dateElement.textContent = formatDate(new Date());

    // Set temperature with unit formatting
    temperatureElement.textContent = formatTemperature(current.temperature);

    // Set weather description
    weatherDescriptionElement.textContent = current.summary || 'Weather conditions not available';

    // Set other weather details
    windSpeedElement.textContent = formatWindSpeed(current.windSpeed || 0);
    
    // Set wind direction arrow
    if (current.windDirection !== undefined) {
        setWindDirection(current.windDirection);
    } else {
        // If no direction data, hide the direction indicator
        const container = document.querySelector('.wind-direction-container');
        if (container) container.classList.add('no-data');
    }
    
    humidityElement.textContent = current.humidity !== undefined ? `${Math.round(current.humidity * 100)}%` : 'N/A';
    pressureElement.textContent = formatPressure(current.pressure || 1015);
    visibilityElement.textContent = formatVisibility(current.visibility || 10);

    // Set weather icon with isDaytime from standardized format
    setWeatherIcon(current.icon || 'cloudy', weatherIconElement, current.isDaytime);

    // Set background based on weather and time of day
    setWeatherBackground(current.icon || 'cloudy', current.isDaytime);

    // Update station info display
    updateStationInfo(data);

    // Update page title with location and temperature
    updatePageTitle(current.temperature, locationName ? formatLocationName(locationName) : (data.timezone ? data.timezone.replace('/', ', ').replace('_', ' ') : 'Unknown Location'));

    // Update local time display
    updateLocalTimeDisplay(data);
}

// Format location name for display
function formatLocationName(locationName) {
    if (!locationName) return 'Unknown Location';

    try {
        // Shorten location name to just city, state/province, country
        const parts = locationName.split(', ');
        let formatted = parts[0]; // City

        if (parts.length > 2) {
            // Add state/province if available
            formatted += ', ' + parts[1];
        }

        return formatted;
    } catch (error) {
        console.error('Error formatting location name:', error);
        return locationName; // Return original if error
    }
}

//==============================================================================
// 5. HELPER FUNCTIONS
//==============================================================================

/**
 * Set the wind direction arrow rotation
 * @param {number|string} direction - Wind direction in degrees or cardinal direction
 */
function setWindDirection(direction) {
    const arrowElement = document.getElementById('wind-direction-arrow');
    const labelElement = document.getElementById('wind-direction-label');
    const container = document.querySelector('.wind-direction');

    if (!arrowElement || !labelElement || !container) return;

    // Check if we have valid direction data
    if (direction === undefined || direction === null) {
        container.classList.add('no-data');
        return;
    } else {
        container.classList.remove('no-data');
    }

    // Convert string cardinal direction to degrees if needed
    let directionDegrees = direction;
    if (typeof direction === 'string') {
        directionDegrees = cardinalToDirection(direction);
    }

    // Make sure we have a valid number
    if (isNaN(directionDegrees)) {
        container.classList.add('no-data');
        return;
    }

    // In meteorology, wind direction is reported as the direction FROM which the wind is coming
    // Apply rotation to the arrow element
    arrowElement.style.transform = `rotate(${directionDegrees}deg)`;

    // Set the cardinal direction label
    labelElement.textContent = getCardinalDirection(directionDegrees);
}

/**
 * Convert degrees to cardinal direction
 * @param {number} degrees - Wind direction in degrees
 * @returns {string} - Cardinal direction
 */
function getCardinalDirection(degrees) {
    // Define 16 cardinal directions for more precision
    const directions = [
        'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
    ];

    // Convert degrees to index (using 22.5 degrees per direction)
    // Add 11.25 degrees to ensure correct rounding to nearest direction
    const index = Math.floor(((degrees + 11.25) % 360) / 22.5);

    return directions[index];
}

/**
 * Convert cardinal direction to degrees
 * @param {string} cardinal - Cardinal direction (N, NE, E, etc.)
 * @returns {number} - Direction in degrees or NaN if invalid
 */
function cardinalToDirection(cardinal) {
    if (!cardinal || typeof cardinal !== 'string') return NaN;

    // Clean up input
    const dir = cardinal.trim().toUpperCase();

    // Map of cardinal directions to degrees
    const directionMap = {
        'N': 0,
        'NNE': 22.5,
        'NE': 45,
        'ENE': 67.5,
        'E': 90,
        'ESE': 112.5,
        'SE': 135,
        'SSE': 157.5,
        'S': 180,
        'SSW': 202.5,
        'SW': 225,
        'WSW': 247.5,
        'W': 270,
        'WNW': 292.5,
        'NW': 315,
        'NNW': 337.5
    };

    return directionMap[dir] !== undefined ? directionMap[dir] : NaN;
}

/**
 * Update local time display based on data
 * @param {Object} data - Weather data
 */
function updateLocalTimeDisplay(data) {
    // Extract lat/lon from URL parameters or data object
    let locationLat, locationLon;
    
    // Try to get coordinates from URL first
    if (window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        locationLat = urlParams.get('lat');
        locationLon = urlParams.get('lon');
    }
    
    // If we still don't have coordinates, try to extract them from data
    if ((!locationLat || !locationLon) && data) {
        // Some APIs include lat/lon in the data object
        if (data.latitude !== undefined && data.longitude !== undefined) {
            locationLat = data.latitude;
            locationLon = data.longitude;
        } else if (data.lat !== undefined && data.lon !== undefined) {
            locationLat = data.lat;
            locationLon = data.lon;
        }
    }

    // Update the time if we have coordinates
    if (locationLon && locationLat) {
        const localTimeElement = document.getElementById('local-time');
        if (localTimeElement) {
            // Pass both longitude AND latitude
            const localTime = getLocalTimeForLocation(locationLon, locationLat);
            localTimeElement.textContent = localTime;

            // Clear any existing interval
            if (window.localTimeInterval) {
                clearInterval(window.localTimeInterval);
            }

            // Update local time every 30 seconds
            window.localTimeInterval = setInterval(() => {
                // Pass both longitude AND latitude
                const updatedTime = getLocalTimeForLocation(locationLon, locationLat);
                localTimeElement.textContent = updatedTime;
            }, 30000);
        }
    }
}

/**
 * Format observation time in a user-friendly way
 * @param {Date} date - Observation date
 * @returns {string} - Formatted time string
 */
export function formatObservationTime(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return 'unknown time';
    }

    try {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 5) {
            return 'just now';
        } else if (diffMins < 60) {
            return `${diffMins} minutes ago`;
        } else if (diffMins < 120) {
            return '1 hour ago';
        } else if (diffMins < 1440) { // less than a day
            const hours = Math.floor(diffMins / 60);
            return `${hours} hours ago`;
        } else {
            // Format as date/time if more than a day
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        }
    } catch (error) {
        console.error('Error formatting observation time:', error);
        return 'unknown time';
    }
}

/**
 * Update station information display
 * @param {Object} data - Weather data object
 */
function updateStationInfo(data) {
    if (!stationInfoElement) return;

    try {
        if (data.stationInfo && data.stationInfo.display) {
            // Special handling for forecast data
            if (data.stationInfo.isForecastData) {
                // For forecast data, show a clear message
                stationInfoElement.innerHTML = 'Using forecast data (no station observations available)';
                stationInfoElement.style.display = 'inline-block';
                stationInfoElement.classList.add('forecast-data');
                return;
            }

            // Normal station info processing for observation data
            let stationInfo = '';
            
            // Add indication about weather description source
            if (data.stationInfo.usingForecastDescription) {
                stationInfo += '<span class="description-source forecast-description">Using forecast description</span> • ';
            } else if (data.stationInfo.descriptionAdjusted) {
                stationInfo += '<span class="description-source">Observed conditions</span> • ';
            }

            if (data.stationInfo.stationName) {
                stationInfo += `<span class="station-name">${data.stationInfo.stationName}</span>`;
            } else {
                stationInfo += '<span class="station-name">Weather Station</span>';
            }

            if (data.stationInfo.stationDistance !== null) {
                const distanceInMiles = (data.stationInfo.stationDistance * 0.621371).toFixed(1);
                stationInfo += ` (${distanceInMiles} mi away)`;
            }

            if (data.stationInfo.observationTime) {
                const observationTime = new Date(data.stationInfo.observationTime);
                stationInfo += ` <span class="observation-time">observed ${formatObservationTime(observationTime)}</span>`;
            }

            stationInfoElement.innerHTML = stationInfo;
            stationInfoElement.style.display = 'inline-block';
            stationInfoElement.classList.remove('forecast-data'); // Make sure we remove the class if it's not forecast data
        } else {
            // Hide if no station info
            stationInfoElement.style.display = 'none';
        }
    } catch (error) {
        console.error('Error updating station info:', error);
        stationInfoElement.style.display = 'none';
    }
}

// Make the update function available globally
window.updateCurrentWeather = updateCurrentWeather;