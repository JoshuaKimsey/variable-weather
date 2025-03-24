/**
 * Pirate Weather API Implementation
 * 
 * This module handles all interactions with the Pirate Weather API,
 * including data fetching, processing, and error handling.
 */

//==============================================================================
// 1. IMPORTS AND DEPENDENCIES
//==============================================================================

import { API_ENDPOINTS } from '../config.js';
import { displayWeatherWithAlerts, showError, hideLoading, hideError } from '../ui/core.js';
import { isDaytime } from '../utils/geo.js';
import { setApiAttribution } from '../api.js';
import { createEmptyWeatherData, WEATHER_ICONS, ALERT_SEVERITY, PRECIP_INTENSITY } from '../standardWeatherFormat.js';

//==============================================================================
// 2. API KEY MANAGEMENT
//==============================================================================

// Internal storage for API key
let apiKey = null;

/**
 * Update the Pirate Weather API key
 * @param {string} newKey - The new API key to use
 */
export function updatePirateWeatherApiKey(newKey) {
    apiKey = newKey;
    localStorage.setItem('weather_app_pirate_api_key', newKey);
    console.log('Pirate Weather API key updated');
}

/**
 * Reset the Pirate Weather API key
 */
export function resetPirateWeatherApiKey() {
    apiKey = null;
    localStorage.removeItem('weather_app_pirate_api_key');
    console.log('Pirate Weather API key reset');
}

/**
 * Get the current Pirate Weather API key
 * @returns {string|null} The API key or null if not set
 */
export function getPirateWeatherApiKey() {
    // If we have a key in memory, use that
    if (apiKey) return apiKey;

    // Otherwise try to get it from localStorage
    const storedKey = localStorage.getItem('weather_app_pirate_api_key');

    // If found in localStorage, update our in-memory copy
    if (storedKey) {
        apiKey = storedKey;
        return apiKey;
    }

    // No key found
    return null;
}

//==============================================================================
// 3. PUBLIC API FUNCTIONS
//==============================================================================

/**
 * Provide proper API metadata for Variable Weather to access
 */
export const API_METADATA = {
    id: 'pirate',
    name: 'Pirate Weather',
    regions: ['global'], // Works everywhere
    requiresApiKey: true,
    description: 'DarkSky API replacement with global coverage',
    apiKeyUrl: 'https://pirateweather.net/getting-started',
    nowcastInterval: 1, // 1-minute intervals

    // API key configuration
    apiKeyConfig: {
        storageKey: 'weather_app_pirate_api_key',
        updateFn: updatePirateWeatherApiKey,
        resetFn: resetPirateWeatherApiKey,
        validator: (key) => /^[a-zA-Z0-9]{20,}$/.test(key),
        invalidValues: ['*insert-your-api-key-here*', '']
    },

    attribution: {
        name: 'Pirate Weather',
        url: 'https://pirateweather.net/'
    },

    // Add a hasApiKey method that settings.js can use
    hasApiKey: function () {
        const key = getPirateWeatherApiKey();
        if (!key) return false;

        // Check against invalid values
        if (this.apiKeyConfig.invalidValues.includes(key)) return false;

        return true;
    },

    supportsNowcast: true  // Add this line
};

/**
 * Fetch weather from Pirate Weather API (fallback for non-US locations)
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Optional location name
 * @param {boolean} returnData - If true, return data instead of updating UI
 * @returns {Promise|undefined} - Promise with data if returnData is true
 */
export function fetchPirateWeather(lat, lon, locationName = null, returnData = false) {
    // Get the API key
    const apiKey = getPirateWeatherApiKey();

    // Check if it's the default placeholder or missing
    if (!apiKey || API_METADATA.apiKeyConfig.invalidValues.includes(apiKey)) {
        console.error('No Pirate Weather API key configured');

        if (returnData) {
            return Promise.reject(new Error('Pirate Weather API key required'));
        } else {
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
        }
        return;
    }

    const url = `${API_ENDPOINTS.PIRATE_WEATHER}/${apiKey}/${lat},${lon}`;

    if (returnData) {
        return new Promise((resolve, reject) => {
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
                    resolve(processedData);
                })
                .catch(error => {
                    console.error('Error fetching Pirate Weather data:', error);
                    reject(error);
                });
        });
    } else {
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
}

/**
 * Fetch only nowcast data from Pirate Weather
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} - Promise that resolves to nowcast data
 */
export function fetchPirateWeatherNowcastOnly(lat, lon) {
    return new Promise((resolve, reject) => {
        // Get the API key
        const apiKey = getPirateWeatherApiKey();

        // Check if it's the default placeholder
        if (apiKey === '*insert-your-api-key-here*' || apiKey === '' || apiKey === null) {
            reject(new Error('No Pirate Weather API key configured'));
            return;
        }

        // We want timezone information, so include it with the request
        // Instead of excluding timezone info, let's just exclude longer forecast data
        const url = `${API_ENDPOINTS.PIRATE_WEATHER}/${apiKey}/${lat},${lon}?exclude=hourly,daily,alerts`;

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
                // Create an empty nowcast object
                const nowcastData = {
                    available: true, // Default to true to keep container visible
                    source: 'pirate',
                    interval: 1,
                    timezone: data.timezone || 'UTC', // Store timezone
                    startTime: null,
                    endTime: null,
                    description: 'No precipitation expected in the next hour',
                    data: []
                };

                // Process nowcast data if available
                if (data.minutely) {
                    // Pass the full data object so we have access to timezone info
                    processPirateWeatherNowcastData(nowcastData, data.minutely, data);
                }

                resolve(nowcastData);
            })
            .catch(error => {
                console.error('Error fetching Pirate Weather nowcast data:', error);
                reject(error);
            });
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

    // Process minute-by-minute forecast (nowcast) if available
    if (data.minutely && data.minutely.data && Array.isArray(data.minutely.data)) {
        processMinutelyForecast(weatherData, data.minutely);
    } else {
        // Set default values for nowcast if no minutely data is available
        weatherData.nowcast.available = true;
        weatherData.nowcast.source = 'pirate';
        weatherData.nowcast.description = 'No precipitation forecast available';
    }

    // Process alerts
    if (data.alerts && Array.isArray(data.alerts)) {
        weatherData.alerts = processPirateWeatherAlerts(data.alerts);
    }

    weatherData.source = 'pirate';

    // Set timezone if available
    if (data.timezone) {
        weatherData.timezone = data.timezone;
    }

    // Set attribution
    weatherData.attribution = {
        name: 'Pirate Weather',
        url: 'https://pirateweather.net/'
    };

    // Reset station info - Pirate Weather doesn't provide station data
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
 * Process minute-by-minute forecast data from Pirate Weather
 * @param {Object} weatherData - Weather data object to update
 * @param {Object} minutelyData - Minutely data from Pirate Weather
 */
function processMinutelyForecast(weatherData, minutelyData) {
    try {
        // Always mark nowcast as available to keep container visible
        weatherData.nowcast.available = true;
        weatherData.nowcast.source = 'pirate';
        weatherData.nowcast.interval = 1; // 1 minute for Pirate Weather
        weatherData.nowcast.timezone = weatherData.timezone || 'UTC'; // Use the location's timezone

        // Default description
        weatherData.nowcast.description = 'No precipitation expected in the next hour';

        // If no data, return with defaults
        if (!minutelyData.data || !Array.isArray(minutelyData.data) || minutelyData.data.length === 0) {
            return;
        }

        // Get current time in seconds for comparison with Unix timestamps
        const nowSeconds = Math.floor(Date.now() / 1000);

        // Find the first index that is in the future
        let startIndex = 0;
        let foundFutureTime = false;

        for (let i = 0; i < minutelyData.data.length; i++) {
            if (minutelyData.data[i].time >= nowSeconds) {
                startIndex = i;
                foundFutureTime = true;
                break;
            }
        }

        // If all timestamps are in the past, check if the last one is close enough to use
        if (!foundFutureTime && minutelyData.data.length > 0) {
            const lastTimestamp = minutelyData.data[minutelyData.data.length - 1].time;
            // If the most recent timestamp is within 5 minutes, use it anyway
            if ((nowSeconds - lastTimestamp) < 5 * 60) {
                startIndex = minutelyData.data.length - 1;
                console.log("Using most recent timestamp even though it's in the past");
            } else {
                // All data is too old
                weatherData.nowcast.description = 'No recent precipitation forecast available';
                weatherData.nowcast.data = [];
                return;
            }
        }

        // Set start and end times
        weatherData.nowcast.startTime = minutelyData.data[startIndex].time;
        weatherData.nowcast.endTime = minutelyData.data[minutelyData.data.length - 1].time;

        // Process each data point
        const data = [];
        
        // Maximum points to include (60 minutes for Pirate Weather)
        const pointsToInclude = Math.min(60, minutelyData.data.length - startIndex);

        // Get the location's timezone
        const locationTimezone = weatherData.timezone || 'UTC';

        for (let i = 0; i < pointsToInclude; i++) {
            const minute = minutelyData.data[startIndex + i];
            
            // Format time in the location's timezone
            let formattedTime;
            
            try {
                // Use the Intl.DateTimeFormat with the location's timezone
                formattedTime = new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: locationTimezone
                }).format(new Date(minute.time * 1000));
            } catch (error) {
                console.warn('Error formatting time with timezone:', error);
                // Fallback to simple formatting
                const date = new Date(minute.time * 1000);
                const hours = date.getHours();
                const mins = date.getMinutes();
                const ampm = hours >= 12 ? 'PM' : 'AM';
                const hour12 = hours % 12 || 12;
                formattedTime = `${hour12}:${mins.toString().padStart(2, '0')} ${ampm}`;
            }

            // Get precipitation data
            const precipIntensity = minute.precipIntensity || 0;
            const precipProbability = minute.precipProbability || 0;

            // Convert from inches/hour to mm/hour for consistent display
            const precipIntensityMM = precipIntensity * 25.4;

            // Determine precipitation type (if available)
            let precipType = 'none';
            if (precipIntensity > 0) {
                if (minute.precipType) {
                    precipType = minute.precipType;
                } else {
                    precipType = 'rain'; // Default
                }
            }

            // Calculate precipitation intensity label
            const intensityLabel = getPrecipIntensityLabel(precipIntensityMM);

            data.push({
                time: minute.time,
                formattedTime: formattedTime,
                precipIntensity: precipIntensityMM, // Store as mm/h for consistency
                precipProbability: precipProbability,
                precipType: precipType,
                intensityLabel: intensityLabel
            });
        }

        weatherData.nowcast.data = data;

        // Check if any precipitation is expected
        const hasPrecipitation = data.some(point => point.precipIntensity > 0 && point.precipProbability > 0.05);

        if (hasPrecipitation) {
            // Generate a human-readable description
            weatherData.nowcast.description = generateNowcastDescription(data);
        }

    } catch (error) {
        console.error('Error processing minutely forecast data:', error);
        weatherData.nowcast.description = 'Error processing precipitation forecast';
    }
}

/**
 * Process Pirate Weather nowcast data for standalone nowcast request
 * @param {Object} nowcastData - Nowcast data object to update
 * @param {Object} minutelyData - Minutely data from Pirate Weather
 */
function processPirateWeatherNowcastData(nowcastData, minutelyData, apiData) {
    try {
        // If no minutely data or not valid, leave defaults and return
        if (!minutelyData || !minutelyData.data || !Array.isArray(minutelyData.data) || minutelyData.data.length === 0) {
            return nowcastData;
        }

        nowcastData.attribution = {
            name: 'Pirate Weather',
            url: 'https://pirateweather.net/'
        };

        // Store the location's timezone from the API data
        const locationTimezone = apiData && apiData.timezone ? apiData.timezone : 'UTC';
        nowcastData.timezone = locationTimezone;

        // Get current time in seconds for comparison with Unix timestamps
        const nowSeconds = Math.floor(Date.now() / 1000);

        // Find the first index that is in the future
        let startIndex = 0;
        let foundFutureTime = false;

        for (let i = 0; i < minutelyData.data.length; i++) {
            if (minutelyData.data[i].time >= nowSeconds) {
                startIndex = i;
                foundFutureTime = true;
                break;
            }
        }

        // If all timestamps are in the past, check if the last one is close enough to use
        if (!foundFutureTime && minutelyData.data.length > 0) {
            const lastTimestamp = minutelyData.data[minutelyData.data.length - 1].time;
            // If the most recent timestamp is within 5 minutes, use it anyway
            if ((nowSeconds - lastTimestamp) < 5 * 60) {
                startIndex = minutelyData.data.length - 1;
                console.log("Using most recent timestamp even though it's in the past");
            } else {
                // All data is too old
                nowcastData.description = 'No recent precipitation forecast available';
                nowcastData.data = [];
                return nowcastData;
            }
        }

        // Set start and end times
        nowcastData.startTime = minutelyData.data[startIndex].time;
        nowcastData.endTime = minutelyData.data[minutelyData.data.length - 1].time;

        // Process each data point
        const data = [];
        const pointsToInclude = Math.min(60, minutelyData.data.length - startIndex);

        // Check if we have precipType data
        let isPrecipSnow = false;
        if (minutelyData.data[0].precipType) {
            isPrecipSnow = minutelyData.data[0].precipType === 'snow';
        } else if (minutelyData.summary) {
            const summary = minutelyData.summary.toLowerCase();
            isPrecipSnow = summary.includes('snow') || summary.includes('flurr');
        }

        for (let i = 0; i < pointsToInclude; i++) {
            const minute = minutelyData.data[startIndex + i];
            
            // Get timestamp and format time in the location's timezone
            let formattedTime;
            
            try {
                // Use a library like tz-lookup if available
                if (typeof window.tzlookup === 'function') {
                    // First create a date in UTC
                    const timestamp = new Date(minute.time * 1000);
                    
                    // Format using Intl.DateTimeFormat with the location's timezone
                    formattedTime = new Intl.DateTimeFormat('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                        timeZone: locationTimezone
                    }).format(timestamp);
                } else {
                    // Fallback - use simple offset-based calculation
                    // This is less accurate but works without timezone libraries
                    const date = new Date(minute.time * 1000);
                    const hours = date.getUTCHours(); // Use UTC hours to avoid local conversion
                    const minutes = date.getUTCMinutes();
                    
                    // Apply an estimated timezone offset if possible
                    // We'll use a simple approach based on timezone name if it has a recognizable offset
                    let hourOffset = 0;
                    if (locationTimezone.includes('GMT+') || locationTimezone.includes('GMT-')) {
                        const offsetMatch = locationTimezone.match(/GMT([+-])(\d+)/);
                        if (offsetMatch) {
                            hourOffset = parseInt(offsetMatch[2]) * (offsetMatch[1] === '+' ? 1 : -1);
                        }
                    }
                    
                    // Apply the offset
                    let adjustedHours = (hours + hourOffset) % 24;
                    if (adjustedHours < 0) adjustedHours += 24;
                    
                    // Format as 12-hour time
                    const hour12 = adjustedHours % 12 || 12;
                    const ampm = adjustedHours >= 12 ? 'PM' : 'AM';
                    formattedTime = `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                }
            } catch (error) {
                console.warn('Error formatting time with timezone:', error);
                // Simple fallback method if timezone formatting fails
                const date = new Date(minute.time * 1000);
                const hours = date.getHours();
                const mins = date.getMinutes();
                const ampm = hours >= 12 ? 'PM' : 'AM';
                const hour12 = hours % 12 || 12;
                formattedTime = `${hour12}:${mins.toString().padStart(2, '0')} ${ampm}`;
            }

            // Precipitation data processing
            const precipIntensity = minute.precipIntensity || 0;
            const precipProbability = minute.precipProbability || 0;
            const precipIntensityMM = precipIntensity * 25.4;

            // Determine precipitation type
            let precipType = 'none';
            if (precipIntensity > 0) {
                if (minute.precipType) {
                    precipType = minute.precipType;
                } else if (isPrecipSnow) {
                    precipType = 'snow';
                } else {
                    precipType = 'rain';
                }
            }

            // Calculate precipitation intensity label
            const intensityLabel = getPrecipIntensityLabel(precipIntensityMM);

            data.push({
                time: minute.time,
                formattedTime: formattedTime,
                precipIntensity: precipIntensityMM,
                precipProbability: precipProbability,
                precipType: precipType,
                intensityLabel: intensityLabel
            });
        }

        nowcastData.data = data;

        // Check if any precipitation is expected
        const hasPrecipitation = data.some(point => point.precipIntensity > 0 && point.precipProbability > 0.05);

        if (hasPrecipitation) {
            // Generate a human-readable description
            nowcastData.description = generateNowcastDescription(data);
        } else {
            nowcastData.description = 'No precipitation expected in the next hour';
        }

    } catch (error) {
        console.error('Error processing Pirate Weather nowcast data:', error);
        nowcastData.description = 'Error processing precipitation forecast';
    }

    return nowcastData;
}

/**
 * Generate a human-readable description for the nowcast period
 * @param {Array} data - Nowcast data points
 * @returns {string} - Human-readable description
 */
function generateNowcastDescription(data) {
    if (!data || data.length === 0) {
        return 'No short-term forecast available';
    }

    // Find the first precipitation
    const firstPrecip = data.find(point => point.precipIntensity > 0 && point.precipProbability > 0.2);

    if (!firstPrecip) {
        return 'Slight chance of precipitation';
    }

    // Format the time relative to now
    const now = new Date().getTime() / 1000;
    const timeDiff = Math.round((firstPrecip.time - now) / 60); // in minutes

    // Get precipitation type
    const precipTypeText = firstPrecip.precipType === 'snow' ? 'snow' :
        firstPrecip.precipType === 'sleet' ? 'sleet' :
            firstPrecip.precipType === 'mix' ? 'mixed precipitation' : 'rain';

    if (timeDiff <= 0) {
        return `${capitalizeFirst(precipTypeText)} occurring now (${firstPrecip.intensityLabel})`;
    } else if (timeDiff < 5) {
        return `${capitalizeFirst(precipTypeText)} expected in the next few minutes (${firstPrecip.intensityLabel})`;
    } else if (timeDiff < 60) {
        return `${capitalizeFirst(precipTypeText)} expected in about ${timeDiff} minutes (${firstPrecip.intensityLabel})`;
    } else {
        return `${capitalizeFirst(precipTypeText)} expected in about 1 hour (${firstPrecip.intensityLabel})`;
    }
}

// Helper function
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Map precipitation intensity to a human-readable label
 * @param {number} intensity - Precipitation intensity in mm/h
 * @returns {string} - Intensity label
 */
function getPrecipIntensityLabel(intensity) {
    if (intensity <= 0) return PRECIP_INTENSITY.NONE;
    if (intensity < 0.5) return PRECIP_INTENSITY.VERY_LIGHT;
    if (intensity < 2.5) return PRECIP_INTENSITY.LIGHT;
    if (intensity < 10) return PRECIP_INTENSITY.MODERATE;
    if (intensity < 50) return PRECIP_INTENSITY.HEAVY;
    return PRECIP_INTENSITY.VIOLENT;
}

function processPirateWeatherAlerts(alerts) {
    if (!alerts || !Array.isArray(alerts)) return [];

    return alerts.map(alert => {
        // Create a properly formatted description (first 100 chars with ellipsis)
        const shortDescription = alert.description ?
            (alert.description.length > 100 ? alert.description.substring(0, 100) + '...' : alert.description) :
            (alert.title || 'Weather Alert');

        // Handle timestamps - Pirate Weather uses Unix timestamps in seconds
        const expiresTime = alert.expires ? new Date(alert.expires * 1000) : null;
        const startTime = alert.time ? new Date(alert.time * 1000) : null;

        // Format regions if available
        let locations = '';
        if (alert.regions && Array.isArray(alert.regions) && alert.regions.length > 0) {
            locations = 'Affecting: ' + alert.regions.join(', ');
        }

        // Extract urgency from description (Pirate Weather doesn't provide this directly)
        let urgency = extractUrgencyFromDescription(alert.description);

        // Get the uri if available for the official alert source
        const uri = alert.uri || null;

        // Create alert header text (like in the NWS version)
        const headerText = createAlertHeaderText(alert);

        return {
            id: alert.id || `pirate-alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            title: alert.title || 'Weather Alert',
            description: headerText || shortDescription,
            fullText: alert.description || '',
            severity: alert.severity ? alert.severity.toLowerCase() : determinePirateAlertSeverity(alert),
            urgency: urgency,
            expires: expiresTime,
            time: startTime,
            regions: alert.regions || [],
            locations: locations,
            uri: uri,
            hazardTypes: identifyAlertHazards(alert.title || '', alert.description || '', alert.description || ''),
            primaryHazard: getPrimaryHazardType(alert.title || '')
        };
    });
}

/**
 * Extract urgency information from the alert description
 * @param {string} description - Full alert description text
 * @returns {string} - Extracted urgency value
 */
function extractUrgencyFromDescription(description) {
    if (!description) return 'Unknown';

    // Common urgency keywords to look for
    const urgencyTerms = {
        'expected': ['expected', 'anticipated', 'forecast', 'predicted'],
        'immediate': ['immediate', 'imminent', 'occurring', 'happening now'],
        'future': ['future', 'later', 'upcoming', 'developing']
    };

    // Convert description to lowercase for easier matching
    const lowerDesc = description.toLowerCase();

    // Look for urgency keywords
    for (const [urgency, terms] of Object.entries(urgencyTerms)) {
        for (const term of terms) {
            // Check for terms in typical patterns
            if (lowerDesc.includes(`urgency...${term}`) ||
                lowerDesc.includes(`urgency: ${term}`) ||
                lowerDesc.includes(`when...${term}`)) {
                return capitalizeFirst(urgency);
            }
        }
    }

    // Parse "WHEN" section if it exists
    const whenMatch = description.match(/\*\s*WHEN\.\.\.(.*?)[\.\*]/i) ||
        description.match(/•\s*WHEN\.\.\.(.*?)[\.\*]/i);

    if (whenMatch && whenMatch[1]) {
        const whenText = whenMatch[1].toLowerCase();

        // Check if it mentions "today", "now", or specific time frames
        if (whenText.includes('now') ||
            whenText.includes('immediately') ||
            whenText.includes('currently')) {
            return 'Immediate';
        } else if (whenText.includes('today') ||
            whenText.includes('this afternoon') ||
            whenText.includes('this evening')) {
            return 'Expected';
        } else if (whenText.includes('tomorrow') ||
            whenText.includes('later')) {
            return 'Future';
        }
    }

    // Default based on alert type
    if (lowerDesc.includes('warning')) {
        return 'Immediate';
    } else if (lowerDesc.includes('watch')) {
        return 'Expected';
    } else if (lowerDesc.includes('advisory') || lowerDesc.includes('statement')) {
        return 'Expected';
    }

    return 'Expected'; // Default to "Expected" instead of "Unknown"
}

/**
 * Create a formatted header text similar to NWS style
 * @param {Object} alert - The raw alert object
 * @returns {string} - Formatted header text
 */
function createAlertHeaderText(alert) {
    if (!alert || !alert.title) return '';

    // Format times to be human-readable
    const startTime = alert.time ? new Date(alert.time * 1000) : null;
    const expiresTime = alert.expires ? new Date(alert.expires * 1000) : null;

    // Format the start time if available
    let startFormatted = '';
    if (startTime) {
        startFormatted = startTime.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        });
    }

    // Format the expiration time if available
    let expiresFormatted = '';
    if (expiresTime) {
        expiresFormatted = expiresTime.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        });
    }

    // Create the header text
    let headerText = `${alert.title}`;

    // Add timing information if available
    if (startFormatted && expiresFormatted) {
        headerText += ` issued ${startFormatted} until ${expiresFormatted}`;
    }

    // Add source if we can extract it
    if (alert.description && alert.description.includes('by NWS')) {
        const sourceMatch = alert.description.match(/by (NWS\s+[A-Za-z\s]+)/);
        if (sourceMatch && sourceMatch[1]) {
            headerText += ` by ${sourceMatch[1]}`;
        }
    }

    return headerText;
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
        return ALERT_SEVERITY.SEVERE;  // Any unspecified warning is treated as severe
    }

    if (title.includes('watch')) {
        return ALERT_SEVERITY.MODERATE;  // Any unspecified watch is treated as moderate
    }

    if (title.includes('advisory') || title.includes('statement')) {
        return ALERT_SEVERITY.MINOR;  // Any unspecified advisory is treated as minor
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