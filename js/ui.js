/**
 * UI-related functions for the weather application
 * 
 * This module manages all UI components, including:
 * - Weather data display
 * - Weather details and forecast cards
 * - Alert system
 * - Loading and error states
 */

//==============================================================================
// 1. IMPORTS AND DOM ELEMENTS
//==============================================================================

import { setApiAttribution } from './api.js';
import { setWeatherIcon, setForecastIcon } from './weatherIcons.js';
import { setWeatherBackground } from './weatherBackgrounds.js';
import { formatDate, formatLocationName, updatePageTitle, getLocalTimeForLocation } from './utils.js';
import { getDisplayUnits, formatTemperature, formatWindSpeed, formatPressure, formatVisibility } from './units.js';

// DOM elements
let locationInput, searchButton, weatherData, loadingIndicator, errorMessage,
    apiIndicator, alertsContainer, locationElement, dateElement,
    temperatureElement, weatherDescriptionElement, weatherIconElement,
    windSpeedElement, humidityElement, pressureElement, visibilityElement,
    forecastContainer, stationInfoElement;

//==============================================================================
// 2. INITIALIZATION AND SETUP
//==============================================================================

/**
 * Initialize UI elements
 */
export function initUI() {
    // Get all DOM elements
    locationInput = document.getElementById('location-input');
    searchButton = document.getElementById('search-button');
    weatherData = document.getElementById('weather-data');
    loadingIndicator = document.getElementById('loading');
    errorMessage = document.getElementById('error-message');
    apiIndicator = document.getElementById('api-indicator');
    alertsContainer = document.getElementById('alerts-container');
    locationElement = document.getElementById('location');
    dateElement = document.getElementById('date');
    temperatureElement = document.getElementById('temperature');
    weatherDescriptionElement = document.getElementById('weather-description');
    weatherIconElement = document.getElementById('weather-icon');
    windSpeedElement = document.getElementById('wind-speed');
    humidityElement = document.getElementById('humidity');
    pressureElement = document.getElementById('pressure');
    visibilityElement = document.getElementById('visibility');
    forecastContainer = document.getElementById('forecast-container');
    stationInfoElement = document.getElementById('station-info');
}

/**
 * Set up event listeners
 */
export function setupEventListeners(searchCallback) {
    // Initialize UI first
    initUI();

    // Set up search functionality
    searchButton.addEventListener('click', searchCallback);
    locationInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            searchCallback();
        }
    });

    // Set up geolocation button
    const geoButton = document.getElementById('geo-button');
    if (geoButton) {
        geoButton.addEventListener('click', () => {
            // Call the getUserLocation function from the window object
            // This allows it to be defined in main.js but used here
            if (typeof window.getUserLocation === 'function') {
                window.getUserLocation();
            } else {
                console.error('getUserLocation function not available');
                showError('Geolocation functionality is not available');
            }
        });
    }
}

//==============================================================================
// 3. CORE DISPLAY FUNCTIONS
//==============================================================================

/**
 * Display weather data with all necessary error handling
 * Refactored to work with the standardized weather data format
 * 
 * @param {Object} data - Standardized weather data object
 * @param {string} locationName - Optional location name
 */
export function displayWeatherData(data, locationName) {
    try {
        // Make sure we have valid data
        if (!data || !data.currently) {
            console.error('Invalid weather data:', data);
            showError('Received invalid weather data. Please try again.');
            return;
        }

        // Cache the data for unit changes
        window.currentWeatherData = data;

        // Show weather data section
        weatherData.style.display = 'block';

        // Use the centralized attribution function
        setApiAttribution(data.source);

        // Current conditions
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

        // Format values properly with unit conversions
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

        // Apply scrollbar theme based on current weather
        applyScrollbarTheme(current.icon || 'cloudy');

        // Update station info display using the standardized stationInfo object
        updateStationInfo(data);

        // Process forecast data using standardized format
        handleForecastDisplay(data);

        // Process hourly forecast data using standardized format
        handleHourlyForecastDisplay(data);

        // Display alerts if available
        displayAlerts(data.alerts || []);

        // Update page title with location and temperature
        updatePageTitle(current.temperature, locationName ? formatLocationName(locationName) : (data.timezone ? data.timezone.replace('/', ', ').replace('_', ' ') : 'Unknown Location'));

        // Hide error message
        hideError();

        // Update local time display with location's time
        // Don't pass undefined parameters - the function will get coordinates itself
        updateLocalTimeDisplay(data);

    } catch (error) {
        console.error('Error displaying weather data:', error);
        showError('Error displaying weather data: ' + error.message);
    }
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
 * Set the wind direction arrow rotation based on meteorological wind direction
 * @param {number|string} direction - Wind direction in degrees (0 = N, 90 = E, 180 = S, 270 = W) or cardinal direction
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
    // Apply rotation to the arrow element - no need for nested structure anymore
    arrowElement.style.transform = `rotate(${directionDegrees}deg)`;

    // Set the cardinal direction label based on meteorological direction
    labelElement.textContent = getCardinalDirection(directionDegrees);
}

/**
 * Convert degrees to cardinal direction
 * @param {number} degrees - Wind direction in degrees
 * @returns {string} - Cardinal direction (N, NNE, NE, etc.)
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
 * Format observation time in a user-friendly way
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
 * Apply scrollbar theme based on current weather condition
 * @param {string} weatherIcon - The current weather icon code
 */
function applyScrollbarTheme(weatherIcon) {
    const forecastContainers = document.querySelectorAll('.hourly-forecast-container, .forecast-container');

    // Remove existing weather classes
    forecastContainers.forEach(container => {
        container.classList.remove('weather-sunny', 'weather-rainy', 'weather-cloudy', 'weather-snowy', 'weather-fog', 'weather-storm');
    });

    // Add appropriate class based on weather
    if (weatherIcon.includes('clear') || weatherIcon === 'clear-day' || weatherIcon === 'clear-night') {
        forecastContainers.forEach(container => container.classList.add('weather-sunny'));
    } else if (weatherIcon.includes('rain') || weatherIcon === 'rain') {
        forecastContainers.forEach(container => container.classList.add('weather-rainy'));
    } else if (weatherIcon.includes('cloud') || weatherIcon === 'cloudy' ||
        weatherIcon.includes('partly') || weatherIcon === 'partly-cloudy-day' ||
        weatherIcon === 'partly-cloudy-night') {
        forecastContainers.forEach(container => container.classList.add('weather-cloudy'));
    } else if (weatherIcon.includes('snow') || weatherIcon === 'snow') {
        forecastContainers.forEach(container => container.classList.add('weather-snowy'));
    } else if (weatherIcon.includes('fog') || weatherIcon === 'fog') {
        forecastContainers.forEach(container => container.classList.add('weather-fog'));
    } else if (weatherIcon.includes('thunder') || weatherIcon === 'thunderstorm') {
        forecastContainers.forEach(container => container.classList.add('weather-storm'));
    }
}

//==============================================================================
// 4. WEATHER DETAIL COMPONENTS
//==============================================================================

/**
 * Update function for station information display
 * This has been refactored to use the standardized stationInfo format
 * 
 * @param {Object} data - Weather data object with standardized format
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

/**
 * Process and display daily forecast data
 * This has been refactored to use the standardized daily data format
 * 
 * @param {Object} data - Weather data object with standardized format
 */
function handleForecastDisplay(data) {
    try {
        // Make sure the forecast container exists
        if (!forecastContainer) {
            console.error('Forecast container not found in DOM');
            return;
        }

        // Clear previous forecast
        forecastContainer.innerHTML = '';

        // Get forecast data
        const forecastData = data.daily.data;

        if (!forecastData || forecastData.length === 0) {
            forecastContainer.innerHTML = '<div class="no-forecast">No forecast data available</div>';
            return;
        }

        // Display forecast for 7 days or less if there's not enough data
        const days = Math.min(7, forecastData.length);

        for (let i = 0; i < days; i++) {
            const day = forecastData[i];
            if (!day) continue;

            const date = new Date(day.time * 1000);

            const forecastCard = document.createElement('div');
            forecastCard.className = 'forecast-card';

            // Day name (e.g., "Mon", "Tue")
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            
            // Get temperatures
            const highTemp = day.temperatureHigh;
            const lowTemp = day.temperatureLow;

            // Format temperatures according to current units
            let tempDisplay;
            if (getDisplayUnits() === 'metric') {
                const highTempC = (highTemp - 32) * (5 / 9);
                const lowTempC = (lowTemp - 32) * (5 / 9);
                tempDisplay = `${Math.round(highTempC)}° / ${Math.round(lowTempC)}°`;
            } else {
                tempDisplay = `${Math.round(highTemp)}° / ${Math.round(lowTemp)}°`;
            }

            // Get precipitation chance
            const precipChance = day.precipChance !== undefined ? day.precipChance : 0;

            forecastCard.innerHTML = `
                <div class="day">${dayName}</div>
                <div class="forecast-icon" id="forecast-icon-${i}"></div>
                <div class="forecast-details">
                    <div class="temp">${tempDisplay}</div>
                    ${precipChance >= 5 ? 
                        `<div class="precip-chance"><i class="bi bi-droplet-fill"></i> ${precipChance}%</div>` : 
                        ''}
                </div>
            `;

            forecastContainer.appendChild(forecastCard);

            // Set forecast icon - ALWAYS use daytime icons for daily forecast
            const forecastIconElement = document.getElementById(`forecast-icon-${i}`);
            if (forecastIconElement) {
                setForecastIcon(day.icon || 'cloudy', forecastIconElement, true);
            }
        }
    } catch (error) {
        console.error('Error displaying forecast:', error);
        forecastContainer.innerHTML = '<div class="forecast-error">Error displaying forecast</div>';
    }
}

/**
 * Process and display hourly forecast data
 * This has been refactored to use the standardized hourly data format
 * 
 * @param {Object} data - Weather data object with standardized format
 */
function handleHourlyForecastDisplay(data) {
    try {
        // Get the hourly forecast container
        const hourlyForecastContainer = document.getElementById('hourly-forecast-items');
        if (!hourlyForecastContainer) {
            console.error('Hourly forecast container not found in DOM');
            return;
        }

        // Clear previous forecast
        hourlyForecastContainer.innerHTML = '';

        // Get hourly forecast data
        const hourlyForecastData = data.hourly.data;

        if (!hourlyForecastData || hourlyForecastData.length === 0) {
            hourlyForecastContainer.innerHTML = '<div class="no-forecast">No hourly forecast data available</div>';
            return;
        }

        // Display forecast for 12 hours or less if there's not enough data
        const hours = Math.min(12, hourlyForecastData.length);

        for (let i = 0; i < hours; i++) {
            const hour = hourlyForecastData[i];
            if (!hour) continue;

            // Use pre-formatted time from the standardized format
            const timeString = hour.formattedTime || formatSimpleTime(hour.time);

            const hourlyForecastCard = document.createElement('div');
            hourlyForecastCard.className = 'hourly-forecast-card';

            // Get temperature
            const temp = hour.temperature;

            // Format temperature according to current units
            let tempDisplay;
            if (getDisplayUnits() === 'metric') {
                const tempC = (temp - 32) * (5 / 9);
                tempDisplay = `${Math.round(tempC)}°`;
            } else {
                tempDisplay = `${Math.round(temp)}°`;
            }

            // Get precipitation chance
            const precipChance = hour.precipChance !== undefined ? hour.precipChance : 0;

            hourlyForecastCard.innerHTML = `
                <div class="time">${timeString}</div>
                <div class="forecast-icon" id="hourly-forecast-icon-${i}"></div>
                <div class="forecast-details">
                    <div class="temp">${tempDisplay}</div>
                    ${precipChance >= 5 ? 
                        `<div class="precip-chance"><i class="bi bi-droplet-fill"></i> ${precipChance}%</div>` : 
                        ''}
                </div>
            `;

            hourlyForecastContainer.appendChild(hourlyForecastCard);

            // Set forecast icon using the isDaytime flag from hourly data
            const forecastIconElement = document.getElementById(`hourly-forecast-icon-${i}`);
            if (forecastIconElement) {
                setForecastIcon(hour.icon || 'cloudy', forecastIconElement, hour.isDaytime);
            }
        }
    } catch (error) {
        console.error('Error displaying hourly forecast:', error);
        const hourlyForecastContainer = document.getElementById('hourly-forecast-items');
        if (hourlyForecastContainer) {
            hourlyForecastContainer.innerHTML = '<div class="forecast-error">Error displaying hourly forecast</div>';
        }
    }
}

// Simple fallback time formatter - should rarely be needed
function formatSimpleTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const hours = date.getHours();
    const hour12 = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${hour12} ${ampm}`;
}

//==============================================================================
// 5. ALERT SYSTEM
//==============================================================================

/**
 * Identifies all hazards mentioned in an alert with improved word boundary matching
 * @param {string} alertTitle - Alert title
 * @param {string} alertDescription - Short description
 * @param {string} fullDescription - Full alert text
 * @returns {Array} - Array of identified hazard types
 */
function identifyAlertHazards(alertTitle, alertDescription, fullDescription) {
    // Create a set to store unique hazard types
    const hazards = new Set();
    
    // Combine all text for analysis
    const combinedText = (alertTitle + " " + alertDescription + " " + fullDescription).toLowerCase();
    
    // Define hazard keywords and their corresponding types
    // Using \b for word boundaries to match whole words only
    const hazardPatterns = [
        { pattern: /\btornado\b/g, type: 'tornado' },
        { pattern: /\bhail\b/g, type: 'hail' },
        { pattern: /\bflash flood\b|\bflooding\b|\bflood\b/g, type: 'flood' },
        { pattern: /\bthunder\b|\blightning\b|\bthunderstorm\b|\bsevere thunderstorm\b/g, type: 'thunderstorm' },
        { pattern: /\bsnow\b|\bblizzard\b|\bwinter\b/g, type: 'snow' },
        { pattern: /\bfreez(e|ing)\b|\bice\b|\bsleet\b/g, type: 'ice' },
        { pattern: /\bwind\b|\bgust\b/g, type: 'wind' },
        { pattern: /\bdust\b/g, type: 'dust' },
        { pattern: /\bsmoke\b/g, type: 'smoke' },
        { pattern: /\bfog\b/g, type: 'fog' },
        { pattern: /\bheat\b/g, type: 'heat' },
        { pattern: /\bcold\b|\bchill\b/g, type: 'cold' },
        { pattern: /\brain\b|\bshower\b/g, type: 'rain' },
        { pattern: /\bhurricane\b|\btropical\b/g, type: 'hurricane' }
    ];
    
    // Check each pattern against the combined text
    hazardPatterns.forEach(({ pattern, type }) => {
        if (pattern.test(combinedText)) {
            hazards.add(type);
        }
    });
    
    return Array.from(hazards);
}

/**
 * Get the primary hazard type from an alert title with word boundary matching
 * @param {string} alertTitle - The alert title
 * @returns {string} - Primary hazard type
 */
function getPrimaryHazardType(alertTitle) {
    const title = alertTitle.toLowerCase();
    
    // Check title for primary hazard type with word boundaries
    if (/\btornado\b/.test(title)) return 'tornado';
    if (/\bhurricane\b|\btropical storm\b/.test(title)) return 'hurricane';
    if (/\bflash flood\b/.test(title)) return 'flood';
    if (/\bthunderstorm\b/.test(title)) return 'thunderstorm';
    if (/\bflood\b/.test(title)) return 'flood';
    if (/\bsnow\b|\bblizzard\b/.test(title)) return 'snow';
    if (/\bice\b|\bfreezing\b/.test(title)) return 'ice';
    if (/\bwind\b/.test(title)) return 'wind';
    if (/\bheat\b/.test(title)) return 'heat';
    if (/\bcold\b/.test(title)) return 'cold';
    if (/\bfog\b/.test(title)) return 'fog';
    if (/\bdust\b/.test(title)) return 'dust';
    if (/\bsmoke\b/.test(title)) return 'smoke';
    if (/\brain\b/.test(title)) return 'rain';
    
    // Default to the first word of the title as a fallback
    const firstWord = title.split(' ')[0];
    return firstWord === 'watch' || firstWord === 'warning' || firstWord === 'advisory' 
        ? title.split(' ')[1] || 'unknown'  // If first word is watch/warning, use second word
        : firstWord;  // Otherwise use first word
}

/**
 * Get icon path for a specific hazard type
 * @param {string} hazardType - The hazard type
 * @returns {string} - Path to the icon
 */
function getHazardIcon(hazardType) {
    const baseIconPath = './resources/meteocons/all/';
    
    switch(hazardType) {
        case 'tornado': return `${baseIconPath}tornado.svg`;
        case 'hail': return `${baseIconPath}hail.svg`;
        case 'flood': return `${baseIconPath}raindrops.svg`;
        case 'thunderstorm': return `${baseIconPath}thunderstorms-rain.svg`;
        case 'snow': return `${baseIconPath}snow.svg`;
        case 'ice': return `${baseIconPath}sleet.svg`;
        case 'wind': return `${baseIconPath}wind.svg`;
        case 'dust': return `${baseIconPath}dust.svg`;
        case 'smoke': return `${baseIconPath}smoke.svg`;
        case 'fog': return `${baseIconPath}fog.svg`;
        case 'heat': return `${baseIconPath}thermometer-warmer.svg`;
        case 'cold': return `${baseIconPath}thermometer-colder.svg`;
        case 'rain': return `${baseIconPath}rain.svg`;
        case 'hurricane': return `${baseIconPath}hurricane.svg`;
        default: return `${baseIconPath}not-available.svg`; // Fallback icon
    }
}

/**
 * Display alerts with standardized alert format
 * @param {Array} alerts - Standardized array of alert objects
 */
function displayAlerts(alerts) {
    try {
        // Clear previous alerts
        alertsContainer.innerHTML = '';

        // Check if alerts exist
        if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
            alertsContainer.style.display = 'none';
            return;
        }

        // Sort alerts by severity (extreme first, then severe, etc.)
        const sortedAlerts = [...alerts].sort((a, b) => {
            const severityOrder = {
                'extreme': 1,
                'severe': 2,
                'moderate': 3,
                'minor': 4
            };

            return severityOrder[a.severity] - severityOrder[b.severity];
        });

        // Process and display each alert
        sortedAlerts.forEach((alert, index) => {
            // Create alert element
            const alertElement = document.createElement('div');
            alertElement.className = `alert-item alert-${alert.severity}`;
            alertElement.id = `alert-${index}`;

            // Create the collapsed view (shown by default)
            alertElement.innerHTML = `
                <div class="alert-header">
                    <div class="alert-title-row">
                        <div class="alert-title-severity">
                            <span class="alert-severity alert-${alert.severity}">${capitalizeFirst(alert.severity)}</span>
                            <h3 class="alert-title">${alert.title}</h3>
                        </div>
                        <div class="alert-icon-container">
                            <img src="${getHazardIcon(alert.primaryHazard)}" alt="${alert.title} icon" class="alert-meteocon" />
                            ${alert.hazardTypes.filter(hazard => hazard !== alert.primaryHazard).map(hazard => 
                                `<img src="${getHazardIcon(hazard)}" alt="${hazard} hazard" class="alert-meteocon" />`
                            ).join('')}
                        </div>
                        <button class="alert-expand-btn" aria-label="Expand alert details">
                            <i class="bi bi-chevron-down"></i>
                        </button>
                    </div>
                    <div class="alert-subtitle">${alert.description}</div>
                </div>
                <div class="alert-content" style="display: none;">
                    <div class="alert-metadata">
                        ${alert.urgency ? `<div class="alert-urgency">Urgency: ${alert.urgency}</div>` : ''}
                        ${alert.expires ? `<div class="alert-expires">Expires: ${formatDate(new Date(alert.expires))}</div>` : ''}
                    </div>
                    <div class="alert-full-description">${formatAlertText(alert.fullText)}</div>
                </div>
            `;

            alertsContainer.appendChild(alertElement);

            // Add click event to the alert to toggle expansion
            const expandBtn = alertElement.querySelector('.alert-expand-btn');
            const alertContent = alertElement.querySelector('.alert-content');

            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the alert click event from firing

                const isExpanded = alertContent.style.display !== 'none';

                // Toggle the content visibility
                alertContent.style.display = isExpanded ? 'none' : 'block';

                // Toggle the icon
                expandBtn.innerHTML = isExpanded
                    ? '<i class="bi bi-chevron-down"></i>'
                    : '<i class="bi bi-chevron-up"></i>';

                // Add or remove expanded class
                alertElement.classList.toggle('alert-expanded', !isExpanded);
            });

            // Make the whole alert clickable for better mobile UX
            alertElement.addEventListener('click', () => {
                expandBtn.click();
            });
        });

        // Show alerts container
        alertsContainer.style.display = 'block';
    } catch (error) {
        console.error('Error displaying alerts:', error);
        alertsContainer.style.display = 'none';
    }
}

/**
 * Get appropriate severity level based on alert information
 * @param {Object} alert - The alert object from NWS or Pirate Weather
 * @returns {string} - The severity level: 'extreme', 'severe', 'moderate', or 'minor'
 */
function getAlertSeverity(alert) {
    try {
        // First check if the API provides a severity level directly
        if (alert.properties && alert.properties.severity) {
            const apiSeverity = alert.properties.severity.toLowerCase();

            // If the API says it's extreme or severe, trust it
            if (apiSeverity === 'extreme' || apiSeverity === 'severe') {
                return apiSeverity;
            }

            // For other API-provided severities, we'll still check against our event mapping
            // because sometimes the API severity doesn't match the practical impact
        }

        // Extract the alert title/event for mapping
        let alertTitle = '';
        if (alert.properties && alert.properties.event) {
            alertTitle = alert.properties.event;
        } else if (alert.title) {
            alertTitle = alert.title;
        }

        // Convert to lowercase for case-insensitive matching
        const lowerTitle = alertTitle.toLowerCase();

        // Event-based severity mapping - more comprehensive list
        // Extreme threats - immediate danger to life and property
        if (
            lowerTitle.includes('tornado warning') ||
            lowerTitle.includes('flash flood emergency') ||
            lowerTitle.includes('hurricane warning') && lowerTitle.includes('category 4') ||
            lowerTitle.includes('hurricane warning') && lowerTitle.includes('category 5') ||
            lowerTitle.includes('tsunami warning') ||
            lowerTitle.includes('extreme wind warning') ||
            lowerTitle.includes('particularly dangerous situation')
        ) {
            return 'extreme';
        }

        // Severe threats - significant threat to life or property
        if (
            lowerTitle.includes('severe thunderstorm warning') ||
            lowerTitle.includes('tornado watch') ||
            lowerTitle.includes('flash flood warning') ||
            lowerTitle.includes('hurricane warning') ||
            lowerTitle.includes('blizzard warning') ||
            lowerTitle.includes('ice storm warning') ||
            lowerTitle.includes('winter storm warning') ||
            lowerTitle.includes('storm surge warning') ||
            lowerTitle.includes('hurricane watch') ||
            lowerTitle.includes('avalanche warning') ||
            lowerTitle.includes('fire warning') ||
            lowerTitle.includes('red flag warning') ||
            lowerTitle.includes('excessive heat warning')
        ) {
            return 'severe';
        }

        // Moderate threats - possible threat to life or property
        if (
            lowerTitle.includes('flood warning') ||
            lowerTitle.includes('thunderstorm watch') ||
            lowerTitle.includes('winter weather advisory') ||
            lowerTitle.includes('wind advisory') ||
            lowerTitle.includes('heat advisory') ||
            lowerTitle.includes('freeze warning') ||
            lowerTitle.includes('dense fog advisory') ||
            lowerTitle.includes('flood advisory') ||
            lowerTitle.includes('rip current statement') ||
            lowerTitle.includes('frost advisory') ||
            lowerTitle.includes('small craft advisory')
        ) {
            return 'moderate';
        }

        // Minor threats - minimal threat to life or property
        if (
            lowerTitle.includes('special weather statement') ||
            lowerTitle.includes('hazardous weather outlook') ||
            lowerTitle.includes('air quality alert') ||
            lowerTitle.includes('hydrologic outlook') ||
            lowerTitle.includes('beach hazards statement') ||
            lowerTitle.includes('urban and small stream') ||
            lowerTitle.includes('lake wind advisory') ||
            lowerTitle.includes('short term forecast')
        ) {
            return 'minor';
        }

        // If we get to this point, it's not matched any of our specific patterns
        // Check for some general indicators
        if (lowerTitle.includes('warning')) {
            return 'severe';  // Any unspecified warning is treated as severe
        }

        if (lowerTitle.includes('watch')) {
            return 'moderate';  // Any unspecified watch is treated as moderate
        }

        if (lowerTitle.includes('advisory') || lowerTitle.includes('statement')) {
            return 'minor';  // Any unspecified advisory is treated as minor
        }

        // Default fallback
        return 'moderate';
    } catch (error) {
        console.error('Error determining alert severity:', error);
        return 'moderate'; // Default fallback
    }
}

/**
 * Format alert text for better readability
 */
function formatAlertText(text) {
    if (!text) return '';

    try {
        // Replace * with bullet points
        text = text.replace(/\*/g, '•');

        // Replace double line breaks with paragraph breaks
        text = text.replace(/\n\n/g, '</p><p>');

        // Replace single line breaks with line breaks
        text = text.replace(/\n/g, '<br>');

        // Wrap the text in paragraphs
        text = `<p>${text}</p>`;

        return text;
    } catch (error) {
        console.error('Error formatting alert text:', error);
        return text; // Return original text if formatting fails
    }
}

/**
 * Capitalize first letter of a string
 */
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Display weather data and update alert polygons
 * @param {Object} data - Weather data object
 * @param {string} locationName - Location name
 */
export function displayWeatherWithAlerts(data, locationName) {
    // First, call the regular displayWeatherData function
    displayWeatherData(data, locationName);

    // Then, if the radar is initialized, update the alert polygons
    if (typeof updateAlertPolygons === 'function' && isRadarViewInitialized()) {
        updateAlertPolygons(data.alerts || []);
    }
}

//==============================================================================
// 6. LOADING AND ERROR STATES
//==============================================================================

/**
 * Show loading indicator
 */
export function showLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (weatherData) weatherData.style.display = 'none';
    hideError();
}

/**
 * Hide loading indicator
 */
export function hideLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
}

/**
 * Show error message
 */
export function showError(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
    hideLoading();
    if (weatherData) weatherData.style.display = 'none';
}

/**
 * Hide error message
 */
export function hideError() {
    if (errorMessage) errorMessage.style.display = 'none';
}