/**
 * Pirate Weather API Implementation
 * 
 * This module handles all interactions with the Pirate Weather API,
 * including data fetching, processing, and error handling.
 */

//==============================================================================
// 1. IMPORTS AND DEPENDENCIES
//==============================================================================

import { API_ENDPOINTS, getPirateWeatherApiKey } from '../config.js';
import { displayWeatherWithAlerts, showError, hideLoading, hideError } from '../ui.js';
import { isDaytime } from '../utils.js';
import { setApiAttribution } from '../api.js';
import { createEmptyWeatherData, WEATHER_ICONS, ALERT_SEVERITY } from '../standardWeatherFormat.js';

//==============================================================================
// 2. PUBLIC API FUNCTIONS
//==============================================================================

/**
 * Fetch weather from Pirate Weather API (fallback for non-US locations)
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Optional location name
 */
export function fetchPirateWeather(lat, lon, locationName = null) {
    // Get the API key
    const apiKey = getPirateWeatherApiKey();

    // Check if it's the default placeholder
    if (apiKey === '*insert-your-api-key-here*' || apiKey === '' || apiKey === null) {
        console.error('No Pirate Weather API key configured');
        showError('Pirate Weather API key required. Please add your API key in Settings to get weather data for this location.');
        // Add a subtle click event on the error to open settings
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.style.cursor = 'pointer';
            errorElement.addEventListener('click', () => {
                const openSettingsBtn = document.getElementById('open-settings');
                if (openSettingsBtn) openSettingsBtn.click();
            });
        }
        hideLoading();
        return;
    }

    const url = `${API_ENDPOINTS.PIRATE_WEATHER}/${apiKey}/${lat},${lon}?units=us`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                // Check if we get a 401 or 403 (auth errors)
                if (response.status === 401 || response.status === 403) {
                    throw new Error('Invalid Pirate Weather API key. Please check your API key in Settings.');
                }
                throw new Error('Weather data not available');
            }
            return response.json();
        })
        .then(data => {
            // Process the Pirate Weather data into our standardized format
            const processedData = processPirateWeatherData(data, lat, lon);
            
            setApiAttribution('pirate');
            // Display the weather data
            displayWeatherWithAlerts(processedData, locationName);

            // Hide loading indicator and error message
            hideLoading();
            hideError();
        })
        .catch(error => {
            console.error('Error fetching Pirate Weather data:', error);
            showError(error.message || 'Error fetching weather data. Please try again later.');
        });
}

//==============================================================================
// 3. DATA PROCESSING FUNCTIONS
//==============================================================================

/**
 * Process data from Pirate Weather API into standardized format
 * 
 * @param {Object} data - The raw data from Pirate Weather API
 * @param {number} lat - Latitude of the location
 * @param {number} lon - Longitude of the location
 * @returns {Object} - Processed weather data in standardized format
 */
function processPirateWeatherData(data, lat, lon) {
    // Create a standardized empty weather data object
    const weatherData = createEmptyWeatherData();
    
    // Set source
    weatherData.source = 'pirate';
    
    // Set timezone if available
    if (data.timezone) {
        weatherData.timezone = data.timezone;
    }
    
    // Process current weather data
    if (data.currently) {
        // Add daylight information
        const isDaylight = isDaytime(lat, lon);
        
        // Set current weather values
        weatherData.currently.temperature = data.currently.temperature;
        weatherData.currently.icon = data.currently.icon;
        weatherData.currently.summary = data.currently.summary;
        weatherData.currently.windSpeed = data.currently.windSpeed;
        weatherData.currently.windDirection = data.currently.windBearing;
        weatherData.currently.humidity = data.currently.humidity;
        weatherData.currently.pressure = data.currently.pressure;
        weatherData.currently.visibility = data.currently.visibility;
        weatherData.currently.isDaytime = isDaylight;
    }
    
    // Process daily forecast
    if (data.daily && data.daily.data && Array.isArray(data.daily.data)) {
        data.daily.data.forEach(day => {
            weatherData.daily.data.push({
                time: day.time,
                icon: day.icon,
                temperatureHigh: day.temperatureHigh,
                temperatureLow: day.temperatureLow,
                summary: day.summary,
                precipChance: day.precipProbability ? Math.round(day.precipProbability * 100) : 0
            });
        });
    }
    
    // Process hourly forecast
    if (data.hourly && data.hourly.data && Array.isArray(data.hourly.data)) {
        // Only take 12 hours
        const hoursToInclude = Math.min(12, data.hourly.data.length);
        
        for (let i = 0; i < hoursToInclude; i++) {
            const hour = data.hourly.data[i];
            
            // Format time string (e.g., "2 PM")
            const date = new Date(hour.time * 1000);
            const hourNum = date.getHours();
            const hour12 = hourNum % 12 || 12;
            const ampm = hourNum >= 12 ? 'PM' : 'AM';
            const formattedTime = `${hour12} ${ampm}`;
            
            // Determine if it's day or night for this hour
            const hourIsDaytime = isDaytime(lat, lon, date);
            
            weatherData.hourly.data.push({
                time: hour.time,
                formattedTime: formattedTime,
                temperature: hour.temperature,
                icon: hour.icon,
                summary: hour.summary,
                precipChance: hour.precipProbability ? Math.round(hour.precipProbability * 100) : 0,
                isDaytime: hourIsDaytime
            });
        }
    }
    
    // Process alerts
    if (data.alerts && Array.isArray(data.alerts)) {
        weatherData.alerts = processPirateWeatherAlerts(data.alerts);
    }
    
    // Reset station info - Pirate Weather doesn't provide station data
    weatherData.stationInfo.display = false;
    
    return weatherData;
}

/**
 * Process Pirate Weather alerts into standardized format
 * @param {Array} alerts - Raw alerts from Pirate Weather
 * @returns {Array} Standardized alerts
 */
function processPirateWeatherAlerts(alerts) {
    if (!alerts || !Array.isArray(alerts)) return [];
    
    return alerts.map(alert => {
        return {
            id: alert.id || `pirate-alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: alert.title || 'Weather Alert',
            description: alert.description ? alert.description.substring(0, 100) + '...' : '',
            fullText: alert.description || '',
            severity: determinePirateAlertSeverity(alert),
            urgency: alert.urgency || 'Unknown',
            expires: alert.expires || null,
            hazardTypes: identifyAlertHazards(alert.title || '', alert.description || '', alert.description || ''),
            primaryHazard: getPrimaryHazardType(alert.title || '')
        };
    });
}

/**
 * Determine severity of a Pirate Weather alert
 * @param {Object} alert - Pirate Weather alert object
 * @returns {string} Standardized severity
 */
function determinePirateAlertSeverity(alert) {
    // First check for explicit severity field
    if (alert.severity) {
        const apiSeverity = alert.severity.toLowerCase();
        if (apiSeverity === 'extreme' || apiSeverity === 'severe') {
            return apiSeverity;
        }
    }
    
    // Check title for keywords
    const title = (alert.title || '').toLowerCase();
    
    // Check for extreme conditions
    if (
        title.includes('tornado warning') ||
        title.includes('flash flood emergency') ||
        title.includes('hurricane warning') && title.includes('category 4') ||
        title.includes('hurricane warning') && title.includes('category 5') ||
        title.includes('tsunami warning') ||
        title.includes('extreme wind warning') ||
        title.includes('particularly dangerous situation')
    ) {
        return ALERT_SEVERITY.EXTREME;
    }
    
    // Check for severe conditions
    if (
        title.includes('severe thunderstorm warning') ||
        title.includes('tornado watch') ||
        title.includes('flash flood warning') ||
        title.includes('hurricane warning') ||
        title.includes('blizzard warning') ||
        title.includes('ice storm warning') ||
        title.includes('winter storm warning') ||
        title.includes('storm surge warning') ||
        title.includes('hurricane watch') ||
        title.includes('avalanche warning') ||
        title.includes('fire warning') ||
        title.includes('red flag warning') ||
        title.includes('excessive heat warning')
    ) {
        return ALERT_SEVERITY.SEVERE;
    }
    
    // Check for moderate conditions
    if (
        title.includes('flood warning') ||
        title.includes('thunderstorm watch') ||
        title.includes('winter weather advisory') ||
        title.includes('wind advisory') ||
        title.includes('heat advisory') ||
        title.includes('freeze warning') ||
        title.includes('dense fog advisory') ||
        title.includes('flood advisory') ||
        title.includes('rip current statement') ||
        title.includes('frost advisory') ||
        title.includes('small craft advisory')
    ) {
        return ALERT_SEVERITY.MODERATE;
    }
    
    // Check for minor conditions
    if (
        title.includes('special weather statement') ||
        title.includes('hazardous weather outlook') ||
        title.includes('air quality alert') ||
        title.includes('hydrologic outlook') ||
        title.includes('beach hazards statement') ||
        title.includes('urban and small stream') ||
        title.includes('lake wind advisory') ||
        title.includes('short term forecast')
    ) {
        return ALERT_SEVERITY.MINOR;
    }
    
    // General indicators if we haven't matched specifics
    if (title.includes('warning')) {
        return ALERT_SEVERITY.SEVERE;
    }
    
    if (title.includes('watch')) {
        return ALERT_SEVERITY.MODERATE;
    }
    
    if (title.includes('advisory') || title.includes('statement')) {
        return ALERT_SEVERITY.MINOR;
    }
    
    // Default
    return ALERT_SEVERITY.MODERATE;
}

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