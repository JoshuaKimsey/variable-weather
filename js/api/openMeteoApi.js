/**
 * Complete replacement for openMeteoApi.js with fixed nowcast processing
 */

/**
 * Open-Meteo API Implementation
 * 
 * This module handles all interactions with the Open-Meteo API,
 * including data fetching, processing, and error handling.
 * Open-Meteo is used as the primary international weather provider
 * and as a fallback when NWS is unavailable.
 */

//==============================================================================
// 1. IMPORTS AND DEPENDENCIES
//==============================================================================

import { displayWeatherWithAlerts, hideLoading, hideError, showError } from '../ui/core.js';
import { isDaytime } from '../utils/geo.js';
import { setApiAttribution } from '../api.js';
import { createEmptyWeatherData, WEATHER_ICONS, PRECIP_INTENSITY } from '../standardWeatherFormat.js';

//==============================================================================
// 2. API ENDPOINTS AND CONFIGURATION
//==============================================================================

// Define Open-Meteo API endpoint
const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

//==============================================================================
// 3. PUBLIC API FUNCTIONS
//==============================================================================

/**
 * Provide proper API metadata for Variable Weather to access
 */
export const API_METADATA = {
    id: 'open-meteo',
    name: 'Open-Meteo',
    regions: ['global'], // Works everywhere
    requiresApiKey: false,
    description: 'Open source weather data for worldwide locations',
    attribution: {
        name: 'Open-Meteo',
        url: 'https://open-meteo.com/',
        license: 'CC BY 4.0'
    },
    supportsNowcast: true  // Add this line
};

/**
 * Fetch weather from Open-Meteo API with a single consolidated request
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Optional location name
 * @param {boolean} returnData - If true, return the data instead of updating UI
 * @returns {Promise|undefined} - Promise with the data if returnData is true
 */
export function fetchOpenMeteoWeather(lat, lon, locationName = null, returnData = false) {
    // Format coordinates to appropriate precision
    const formattedLat = parseFloat(lat).toFixed(4);
    const formattedLon = parseFloat(lon).toFixed(4);

    // Define parameter lists by category for better organization and maintainability
    const currentParams = [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'rain',
        'showers',
        'snowfall',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'surface_pressure',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m'
    ];

    const hourlyParams = [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation_probability',
        'precipitation',
        'rain',
        'showers',
        'snowfall',
        'weather_code',
        'pressure_msl',
        'surface_pressure',
        'cloud_cover',
        'visibility',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'is_day'
    ];

    const dailyParams = [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'apparent_temperature_max',
        'apparent_temperature_min',
        'sunrise',
        'sunset',
        'precipitation_sum',
        'precipitation_hours',
        'precipitation_probability_max',
        'precipitation_probability_mean',
        'wind_speed_10m_max',
        'wind_gusts_10m_max',
        'wind_direction_10m_dominant',
        'uv_index_max',
        'snowfall_sum',
        'cloud_cover_mean',
        'dew_point_2m_mean',
        'relative_humidity_2m_mean',
        'visibility_mean'
    ];

    // Always include 15-minute data for nowcasting
    const minutely15Params = [
        'precipitation',
        'precipitation_probability',
        'snowfall'
    ];

    // Construct a single consolidated URL with all parameters
    const url = `${OPEN_METEO_ENDPOINT}?` +
        `latitude=${formattedLat}&` +
        `longitude=${formattedLon}&` +
        `elevation=nan&` +
        `current=${currentParams.join(',')}&` +
        `hourly=${hourlyParams.join(',')}&` +
        `daily=${dailyParams.join(',')}&` +
        `timezone=auto`;

    // Return a promise if returnData is true
    if (returnData) {
        return new Promise((resolve, reject) => {
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Process the Open-Meteo data into our standardized format
                    const processedData = processOpenMeteoData(data, lat, lon, locationName);

                    // Set attribution
                    setApiAttribution('open-meteo');

                    // Return the processed data
                    resolve(processedData);
                })
                .catch(error => {
                    console.error('Error fetching Open-Meteo data:', error);
                    reject(error);
                });
        });
    } else {
        // Make a single API request and update the UI
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // Process the Open-Meteo data into our standardized format
                const processedData = processOpenMeteoData(data, lat, lon, locationName);

                // Set attribution
                setApiAttribution('open-meteo');

                // Display the processed weather data
                displayWeatherWithAlerts(processedData, locationName);

                // Hide loading indicator and error message
                hideLoading();
                hideError();
            })
            .catch(error => {
                console.error('Error fetching Open-Meteo data:', error);
                showError(error.message || 'Error fetching weather data. Please try again later.');
                hideLoading();
            });
    }
}

/**
 * Simplified function to fetch only nowcast data from Open-Meteo
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} - Promise that resolves to nowcast data
 */
export function fetchOpenMeteoNowcastOnly(lat, lon) {
    return new Promise((resolve, reject) => {
        // Format coordinates to appropriate precision
        const formattedLat = parseFloat(lat).toFixed(4);
        const formattedLon = parseFloat(lon).toFixed(4);

        // Only fetch the minutely_15 data with automatic timezone detection
        const url = `${OPEN_METEO_ENDPOINT}?` +
            `latitude=${formattedLat}&` +
            `longitude=${formattedLon}&` +
            `minutely_15=precipitation,precipitation_probability,snowfall&forecast_minutely_15=24&past_minutely_15=0&` +
            `timezone=auto`;  // Let the API handle the timezone

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // Create nowcast data using our unified processor
                const nowcastData = processOpenMeteoNowcast(data.minutely_15);
                resolve(nowcastData);
            })
            .catch(error => {
                console.error('Error fetching Open-Meteo nowcast data:', error);
                reject(error);
            });
    });
}

//==============================================================================
// 4. DATA PROCESSING FUNCTIONS
//==============================================================================

/**
 * Process data from Open-Meteo API into standardized format
 * 
 * @param {Object} data - Consolidated data from Open-Meteo including current, hourly, and daily forecasts
 * @param {number} lat - Latitude of the location
 * @param {number} lon - Longitude of the location
 * @param {string} locationName - Optional location name
 * @returns {Object} - Processed weather data in standardized format
 */
function processOpenMeteoData(data, lat, lon, locationName) {
    // Create an empty standardized weather data object
    const weatherData = createEmptyWeatherData();

    // Set source and timezone
    weatherData.source = 'open-meteo';
    weatherData.timezone = data.timezone || 'auto';

    // Process current weather
    const current = data.current;

    // Set daylight status
    weatherData.currently.isDaytime = (current.is_day !== undefined)
        ? current.is_day === 1
        : isDaytime(lat, lon);

    // Temperature (convert from C to F)
    weatherData.currently.temperature = (current.temperature_2m * 9 / 5) + 32;

    // Weather icon based on weather code
    weatherData.currently.icon = mapOpenMeteoCodeToIcon(current.weather_code, weatherData.currently.isDaytime);

    // Weather description based on weather code
    weatherData.currently.summary = getWeatherDescription(current.weather_code);

    // Wind speed (convert from km/h to mph)
    weatherData.currently.windSpeed = current.wind_speed_10m * 0.621371;

    // Wind direction (already in degrees)
    weatherData.currently.windDirection = current.wind_direction_10m;

    // Humidity (already in percentage, convert to decimal)
    weatherData.currently.humidity = current.relative_humidity_2m / 100;

    // Pressure (already in hPa)
    weatherData.currently.pressure = current.pressure_msl || current.surface_pressure;

    // Visibility (convert to miles if available)
    if (data.hourly && data.hourly.visibility && data.hourly.visibility.length > 0) {
        // Get visibility from the first hour of the forecast (convert from meters to miles)
        weatherData.currently.visibility = data.hourly.visibility[0] * 0.000621371;
    }

    // Process daily forecast
    if (data.daily) {
        processDailyForecast(weatherData, data.daily, data.utc_offset_seconds);
    }

    // Process hourly forecast
    if (data.hourly) {
        processHourlyForecast(weatherData, data, current);
    }

    // Process 15-minute nowcast data using the unified processor
    if (data.minutely_15) {
        // Use the unified processor and directly set the result to weatherData.nowcast
        weatherData.nowcast = processOpenMeteoNowcast(data.minutely_15, weatherData.nowcast);
    }

    // Set source and timezone
    weatherData.source = 'open-meteo';
    weatherData.timezone = data.timezone || 'auto';

    // Set attribution
    weatherData.attribution = {
        name: 'Open-Meteo',
        url: 'https://open-meteo.com/',
        license: 'CC BY 4.0'
    };

    // Open-Meteo doesn't provide weather alerts
    weatherData.alerts = [];

    // Clear station info (Open-Meteo has no station data)
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
 * Unified function to process Open-Meteo nowcast data - Fixed version
 * 
 * @param {Object} minutely15Data - The minutely_15 data from Open-Meteo
 * @param {Object} [targetObject={}] - The object to populate with nowcast data
 * @returns {Object} - Processed nowcast data
 */
function processOpenMeteoNowcast(minutely15Data, targetObject = {}) {
    // Initialize nowcast object with default values if not provided
    const nowcastData = targetObject || {
        available: true,
        source: 'open-meteo',
        interval: 15,
        startTime: null,
        endTime: null,
        description: 'No precipitation expected in the next few hours',
        data: []
    };

    try {
        // Basic validation for required fields
        if (!minutely15Data || !minutely15Data.time || !minutely15Data.precipitation_probability) {
            console.warn("Missing required nowcast data fields");
            return nowcastData;
        }

        // Current time in milliseconds
        const now = new Date().getTime();

        // Find the first index that is in the future or at current time
        let startIndex = 0;
        let foundFutureTime = false;

        for (let i = 0; i < minutely15Data.time.length; i++) {
            const timestamp = new Date(minutely15Data.time[i]).getTime();
            if (timestamp >= now) {
                startIndex = i;
                foundFutureTime = true;
                break;
            }
        }

        // If all timestamps are in the past, check if the last one is close enough to use
        if (!foundFutureTime && minutely15Data.time.length > 0) {
            const lastTimestamp = new Date(minutely15Data.time[minutely15Data.time.length - 1]).getTime();
            // If the most recent timestamp is within 30 minutes, use it anyway
            if ((now - lastTimestamp) < 30 * 60 * 1000) {
                startIndex = minutely15Data.time.length - 1;
                console.log("Using most recent timestamp even though it's in the past");
            } else {
                // All data is too old
                nowcastData.description = 'No recent precipitation forecast available';
                nowcastData.data = [];
                return nowcastData;
            }
        }

        // Set start and end times based on future data points
        nowcastData.startTime = new Date(minutely15Data.time[startIndex]).getTime() / 1000;
        nowcastData.endTime = new Date(minutely15Data.time[minutely15Data.time.length - 1]).getTime() / 1000;

        // Process each data point
        const data = [];
        const timeFormat = { hour: 'numeric', minute: '2-digit', hour12: true };

        // Maximum points to include (approximately 5 hours of data for 15-minute intervals)
        const maxPoints = 20;
        const pointsToInclude = Math.min(maxPoints, minutely15Data.time.length - startIndex);

        let hasSignificantProbability = false;

        for (let i = 0; i < pointsToInclude; i++) {
            const dataIndex = startIndex + i;

            // Get the timestamp directly from the API response
            const timestamp = new Date(minutely15Data.time[dataIndex]);
            
            // Format time using the timestamp's inherent timezone 
            // (which is already correct from the API response)
            const hours = timestamp.getHours();
            const minutes = timestamp.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const hour12 = hours % 12 || 12;
            const formattedTime = `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;

            // Get precipitation data - default to 0 if not present
            const precipIntensity = (minutely15Data.precipitation && dataIndex < minutely15Data.precipitation.length)
                ? minutely15Data.precipitation[dataIndex] || 0
                : 0;

            // Fix: The precipitation_probability in Open-Meteo is a percentage (0-100), not decimal (0-1)
            const precipProbability = (minutely15Data.precipitation_probability &&
                dataIndex < minutely15Data.precipitation_probability.length)
                ? minutely15Data.precipitation_probability[dataIndex] / 100 || 0
                : 0;

            // If we have any significant probability, remember that
            if (precipProbability > 0.1) {
                hasSignificantProbability = true;
            }

            // Get snowfall data - default to 0 if not present
            const snowfall = (minutely15Data.snowfall && dataIndex < minutely15Data.snowfall.length)
                ? minutely15Data.snowfall[dataIndex] || 0
                : 0;

            // Determine precipitation type
            let precipType = 'none';
            if (snowfall > 0) {
                if (precipIntensity > snowfall) {
                    precipType = 'mix';
                } else {
                    precipType = 'snow';
                }
            } else if (precipIntensity > 0) {
                precipType = 'rain';
            }

            // Calculate precipitation intensity label with snow/mix multiplier
            const snowFraction = precipIntensity > 0 ? Math.min(1, (snowfall || 0) / precipIntensity) : 0;
            const displayIntensity = precipType === 'snow' ? precipIntensity * 10
                : precipType === 'mix' ? precipIntensity * (1 + snowFraction * 9)
                : precipIntensity;
            const intensityLabel = getPrecipIntensityLabel(displayIntensity);

            data.push({
                time: timestamp.getTime() / 1000,
                formattedTime: formattedTime,
                precipIntensity: displayIntensity,
                precipProbability: precipProbability,
                snowfall: snowfall,
                precipType: precipType,
                intensityLabel: intensityLabel
            });
        }

        nowcastData.data = data;

        // Set appropriate description based on probability
        if (hasSignificantProbability) {
            // Find the highest probability
            const maxProb = Math.max(...data.map(point => point.precipProbability));
            const probPercent = Math.round(maxProb * 100);

            // Simple description that avoids complex calculations
            nowcastData.description = `Precipitation likely (${probPercent}% chance)`;
        } else {
            nowcastData.description = 'No significant precipitation expected';
        }
    } catch (error) {
        console.error('Error processing Open-Meteo nowcast data:', error);
        nowcastData.description = 'Error processing precipitation forecast';
    }

    nowcastData.attribution = {
        name: 'Open-Meteo',
        url: 'https://open-meteo.com/',
        license: 'CC BY 4.0'
    };

    return nowcastData;
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

/**
 * Process daily forecast data from Open-Meteo with proper timezone handling
 * @param {Object} weatherData - Weather data object to update
 * @param {Object} dailyData - Daily forecast data from Open-Meteo
 * @param {number} utcOffset - utc_offset_seconds from the API response
 */
function processDailyForecast(weatherData, dailyData, utcOffset = 0) {
    // Get the number of days in the forecast
    const days = dailyData.time.length;

    for (let i = 0; i < days; i++) {
        const dateStr = dailyData.time[i]; // "2026-05-19" — location's local date

        const apparentMax = dailyData.apparent_temperature_max?.[i];
        const apparentMin = dailyData.apparent_temperature_min?.[i];
        const sunriseIso = dailyData.sunrise?.[i];
        const sunsetIso = dailyData.sunset?.[i];
        const windMaxKmh = dailyData.wind_speed_10m_max?.[i];
        const windGustsMaxKmh = dailyData.wind_gusts_10m_max?.[i];
        const humidityPct = dailyData.relative_humidity_2m_mean?.[i];
        const dewPointC = dailyData.dew_point_2m_mean?.[i];
        const visibilityM = dailyData.visibility_mean?.[i];

        weatherData.daily.data.push({
            // Real UTC instant of midnight in the location's timezone
            time: locationIsoToUtcSeconds(`${dateStr}T00:00`, utcOffset),
            icon: mapOpenMeteoCodeToIcon(dailyData.weather_code[i], true), // Always use daytime icons for daily forecast
            temperatureHigh: (dailyData.temperature_2m_max[i] * 9 / 5) + 32, // Convert from C to F
            temperatureLow: (dailyData.temperature_2m_min[i] * 9 / 5) + 32, // Convert from C to F
            summary: getWeatherDescription(dailyData.weather_code[i]),
            precipChance: dailyData.precipitation_probability_max?.[i] || 0,
            apparentTemperatureHigh: apparentMax != null ? (apparentMax * 9 / 5) + 32 : null,
            apparentTemperatureLow: apparentMin != null ? (apparentMin * 9 / 5) + 32 : null,
            sunrise: sunriseIso ? locationIsoToUtcSeconds(sunriseIso, utcOffset) : null,
            sunset: sunsetIso ? locationIsoToUtcSeconds(sunsetIso, utcOffset) : null,
            precipSum: dailyData.precipitation_sum?.[i] ?? null, // mm
            snowfallSum: dailyData.snowfall_sum?.[i] ?? null, // cm
            precipHours: dailyData.precipitation_hours?.[i] ?? null,
            precipProbabilityMean: dailyData.precipitation_probability_mean?.[i] ?? null,
            windMax: windMaxKmh != null ? windMaxKmh * 0.621371 : null, // km/h → mph
            windGustsMax: windGustsMaxKmh != null ? windGustsMaxKmh * 0.621371 : null,
            windDirection: dailyData.wind_direction_10m_dominant?.[i] ?? null,
            uvIndex: dailyData.uv_index_max?.[i] ?? null,
            cloudCover: dailyData.cloud_cover_mean?.[i] ?? null, // 0-100
            humidity: humidityPct != null ? humidityPct / 100 : null, // 0-1
            dewPoint: dewPointC != null ? (dewPointC * 9 / 5) + 32 : null,
            visibility: visibilityM != null ? visibilityM * 0.000621371 : null // m → mi
        });
    }
}

/**
 * Convert a naked ISO string from Open-Meteo (location-local, no TZ suffix) to
 * a real UTC Unix timestamp by applying the response's utc_offset_seconds.
 * Parsing the string as if UTC, then subtracting the offset, recovers the
 * real UTC instant regardless of the user's browser timezone.
 */
function locationIsoToUtcSeconds(iso, utcOffset) {
    const asUtc = new Date(iso + 'Z').getTime() / 1000;
    return asUtc - (utcOffset || 0);
}

/**
 * Process hourly forecast data from Open-Meteo
 * @param {Object} weatherData - Weather data object to update
 * @param {Object} data - Complete data from Open-Meteo
 * @param {Object} current - Current weather data
 */
function processHourlyForecast(weatherData, data, current) {
    const hourly = data.hourly;

    // Push all hours from the API response (typically 168 = 24h × 7 days starting
    // at the location's midnight). Renderers slice the window they need.
    const hoursToInclude = hourly.time.length;

    // Open-Meteo returns naked ISO strings (e.g. "2026-05-19T09:00") that
    // represent the *location's* local time. JS would parse them as the user's
    // local time, so apply utc_offset_seconds to recover the real UTC instant.
    const utcOffset = typeof data.utc_offset_seconds === 'number' ? data.utc_offset_seconds : 0;

    for (let i = 0; i < hoursToInclude; i++) {
        const dataIndex = i;

        const hourTimestamp = locationIsoToUtcSeconds(hourly.time[dataIndex], utcOffset);

        // Pre-format hour label for any caller that still uses formattedTime.
        // The hourly chart re-formats using the location timezone, but
        // legacy callers fall back to this string.
        const hourDate = new Date(hourTimestamp * 1000);
        const hour = hourDate.getHours();
        const hour12 = hour % 12 || 12;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const formattedTime = `${hour12} ${ampm}`;

        const hourIsDay = (hourly.is_day && hourly.is_day[dataIndex] !== undefined)
            ? hourly.is_day[dataIndex] === 1
            : isDaytime(lat, lon);

        weatherData.hourly.data.push({
            time: hourTimestamp,
            formattedTime: formattedTime,
            temperature: (hourly.temperature_2m[dataIndex] * 9 / 5) + 32, // Convert from C to F
            icon: mapOpenMeteoCodeToIcon(hourly.weather_code[dataIndex], hourIsDay),
            summary: getWeatherDescription(hourly.weather_code[dataIndex]),
            precipChance: hourly.precipitation_probability ?
                (hourly.precipitation_probability[dataIndex] || 0) : 0,
            precipIntensity: hourly.precipitation?.[dataIndex] ?? null, // mm/h
            isDaytime: hourIsDay
        });
    }
}

/**
 * Map Open-Meteo weather code to our icon system
 * Based on WMO codes: https://open-meteo.com/en/docs
 * 
 * @param {number} code - Open-Meteo weather code
 * @param {boolean} isDay - Whether it's daytime
 * @returns {string} - Icon code for our application
 */
function mapOpenMeteoCodeToIcon(code, isDay) {
    // WMO Weather codes mapping
    switch (code) {
        // Clear, Mainly clear
        case 0:
        case 1:
            return isDay ? WEATHER_ICONS.CLEAR_DAY : WEATHER_ICONS.CLEAR_NIGHT;

        // Partly cloudy
        case 2:
            return isDay ? WEATHER_ICONS.PARTLY_CLOUDY_DAY : WEATHER_ICONS.PARTLY_CLOUDY_NIGHT;

        // Overcast
        case 3:
            return WEATHER_ICONS.CLOUDY;

        // Fog, depositing rime fog
        case 45:
        case 48:
            return WEATHER_ICONS.FOG;

        // Drizzle (light, moderate, dense)
        case 51:
        case 53:
        case 55:
        // Freezing drizzle (light, dense)
        case 56:
        case 57:
            return WEATHER_ICONS.RAIN;

        // Rain (slight, moderate, heavy)
        case 61:
        case 63:
        case 65:
        // Freezing rain (light, heavy)
        case 66:
        case 67:
            return WEATHER_ICONS.RAIN;

        // Snow (slight, moderate, heavy)
        case 71:
        case 73:
        case 75:
        // Snow grains
        case 77:
            return WEATHER_ICONS.SNOW;

        // Rain showers (slight, moderate, violent)
        case 80:
        case 81:
        case 82:
            return WEATHER_ICONS.RAIN;

        // Snow showers (slight, heavy)
        case 85:
        case 86:
            return WEATHER_ICONS.SNOW;

        // Thunderstorm (slight/moderate, with hail)
        case 95:
        case 96:
        case 99:
            return WEATHER_ICONS.THUNDERSTORM;

        // Default fallback
        default:
            return isDay ? WEATHER_ICONS.CLOUDY : WEATHER_ICONS.CLOUDY;
    }
}

/**
 * Get a human-readable weather description based on Open-Meteo weather code
 * 
 * @param {number} code - Open-Meteo weather code
 * @returns {string} - Weather description
 */
function getWeatherDescription(code) {
    // WMO Weather codes descriptions
    switch (code) {
        case 0: return 'Clear sky';
        case 1: return 'Mainly clear';
        case 2: return 'Partly cloudy';
        case 3: return 'Overcast';
        case 45: return 'Fog';
        case 48: return 'Depositing rime fog';
        case 51: return 'Light drizzle';
        case 53: return 'Moderate drizzle';
        case 55: return 'Dense drizzle';
        case 56: return 'Light freezing drizzle';
        case 57: return 'Dense freezing drizzle';
        case 61: return 'Slight rain';
        case 63: return 'Moderate rain';
        case 65: return 'Heavy rain';
        case 66: return 'Light freezing rain';
        case 67: return 'Heavy freezing rain';
        case 71: return 'Slight snow fall';
        case 73: return 'Moderate snow fall';
        case 75: return 'Heavy snow fall';
        case 77: return 'Snow grains';
        case 80: return 'Slight rain showers';
        case 81: return 'Moderate rain showers';
        case 82: return 'Violent rain showers';
        case 85: return 'Slight snow showers';
        case 86: return 'Heavy snow showers';
        case 95: return 'Thunderstorm';
        case 96: return 'Thunderstorm with slight hail';
        case 99: return 'Thunderstorm with heavy hail';
        default: return 'Unknown weather';
    }
}

// ==============================================================================
// 6. DERIVED 1-MINUTE NOWCAST FUNCTIONS
// ==============================================================================

/**
 * Fetch a 1-minute interpolated nowcast derived from Open-Meteo's 15-minute data.
 * This replicates Pirate Weather's minutely approach by linearly interpolating
 * 15-minute HRRR model output down to 60 one-minute points for the next hour.
 *
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} - Promise resolving to a standard nowcast object
 */
export function fetchOpenMeteoDerivedNowcast(lat, lon) {
    return new Promise((resolve, reject) => {
        const formattedLat = parseFloat(lat).toFixed(4);
        const formattedLon = parseFloat(lon).toFixed(4);

        const url = `${OPEN_METEO_ENDPOINT}?` +
            `latitude=${formattedLat}&` +
            `longitude=${formattedLon}&` +
            `minutely_15=temperature_2m,precipitation,precipitation_probability,snowfall,rain,showers,weather_code&` +
            `forecast_minutely_15=4&past_minutely_15=1&` +
            `timezone=auto`;

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (!data.minutely_15) {
                    throw new Error('No minutely_15 data available for interpolation');
                }
                const timezone = data.timezone || 'auto';
                const derived = interpolateOpenMeteoNowcast(data.minutely_15, timezone);
                resolve(derived);
            })
            .catch(error => {
                console.error('Error fetching derived nowcast data:', error);
                reject(error);
            });
    });
}

/**
 * Interpolate Open-Meteo 15-minute data to 1-minute resolution.
 *
 * @param {Object} minutely15Data - Open-Meteo minutely_15 response object
 * @returns {Object} - Standard nowcast object with 60 one-minute data points
 */
function interpolateOpenMeteoNowcast(minutely15Data, timezone) {
    const now = Date.now();
    const nowSec = Math.floor(now / 1000);

    // Build array of known 15-minute data points with numeric timestamps
    const points = [];
    for (let i = 0; i < minutely15Data.time.length; i++) {
        points.push({
            time: new Date(minutely15Data.time[i]).getTime() / 1000,
            precip: ((minutely15Data.precipitation && minutely15Data.precipitation[i]) || 0) * 4,
            prob: ((minutely15Data.precipitation_probability && minutely15Data.precipitation_probability[i]) || 0) / 100,
            snowfall: ((minutely15Data.snowfall && minutely15Data.snowfall[i]) || 0) * 4,
            temp: (minutely15Data.temperature_2m && minutely15Data.temperature_2m[i]) || 0,
            wmoCode: (minutely15Data.weather_code && minutely15Data.weather_code[i]) ?? null
        });
    }

    if (points.length < 2) {
        return {
            available: false,
            source: 'open-meteo-derived',
            interval: 1,
            startTime: null,
            endTime: null,
            description: 'Insufficient data for derived nowcast',
            data: []
        };
    }

    // Generate 60 one-minute points starting from the next whole minute
    const firstMinute = Math.ceil(nowSec / 60) * 60;
    const data = [];

    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: timezone
    });

    for (let m = 0; m < 60; m++) {
        const t = firstMinute + m * 60;

        const precip = linearInterpolate(t, points, 'precip');
        const prob = Math.max(0, Math.min(1, linearInterpolate(t, points, 'prob')));
        const temp = linearInterpolate(t, points, 'temp');
        const snowfall = linearInterpolate(t, points, 'snowfall');
        const wmoCode = nearestWeatherCode(t, points);

        // Determine precipitation type: snowfall ratio first, then WMO code, then temperature fallback
        let precipType = wmoCodeToPrecipType(wmoCode);

        if (snowfall > 0) {
            if (precip > 0 && precip > snowfall) {
                precipType = 'mix';
            } else {
                precipType = 'snow';
            }
        } else if (precip > 0 && precipType === 'none') {
            if (temp >= 2) precipType = 'rain';
            else if (temp <= 0) precipType = 'snow';
            else precipType = 'sleet';
        }

        // Convert liquid-equivalent to accumulation rate for snow/mix
        const snowFraction = precip > 0 ? Math.min(1, snowfall / precip) : 0;
        const displayIntensity = precipType === 'snow' ? precip * 10
            : precipType === 'mix' ? precip * (1 + snowFraction * 9)
            : precip;

        const intensityLabel = getPrecipIntensityLabel(displayIntensity);

        // Format time string in the location's timezone
        const formattedTime = timeFormatter.format(new Date(t * 1000));

        data.push({
            time: t,
            formattedTime: formattedTime,
            precipIntensity: displayIntensity,
            precipProbability: prob,
            precipType: precipType,
            intensityLabel: intensityLabel,
            source: 'open-meteo-derived'
        });
    }

    // Generate description
    const maxProb = Math.max(...data.map(p => p.precipProbability));
    const hasPrecip = data.some(p => p.precipIntensity > 0 || p.precipProbability > 0.1);
    const description = hasPrecip
        ? `Precipitation likely (${Math.round(maxProb * 100)}% chance)`
        : 'No significant precipitation expected';

    return {
        available: true,
        source: 'open-meteo-derived',
        interval: 1,
        startTime: firstMinute,
        endTime: firstMinute + 59 * 60,
        description: description,
        data: data,
        attribution: {
            name: 'Open-Meteo (Derived)',
            url: 'https://open-meteo.com/',
            license: 'CC BY 4.0'
        }
    };
}

/**
 * Linearly interpolate a field value at a target time between known points.
 *
 * @param {number} targetTime - Unix timestamp (seconds)
 * @param {Array<Object>} points - Sorted array of points with .time and .[field]
 * @param {string} field - Name of the field to interpolate
 * @returns {number} - Interpolated value
 */
function linearInterpolate(targetTime, points, field) {
    // Find the two bracketing points
    for (let i = 0; i < points.length - 1; i++) {
        const t0 = points[i].time;
        const t1 = points[i + 1].time;
        if (targetTime >= t0 && targetTime <= t1) {
            const ratio = (targetTime - t0) / (t1 - t0);
            return points[i][field] + ratio * (points[i + 1][field] - points[i][field]);
        }
    }
    // Extrapolate: before first point -> first value, after last -> last value
    if (targetTime <= points[0].time) return points[0][field];
    return points[points.length - 1][field];
}

/**
 * Find the nearest weather code (categorical) to a target time.
 *
 * @param {number} targetTime - Unix timestamp (seconds)
 * @param {Array<Object>} points - Sorted array of points with .time and .wmoCode
 * @returns {number|null} - Nearest WMO weather code
 */
function nearestWeatherCode(targetTime, points) {
    let nearest = points[0];
    let minDist = Math.abs(targetTime - points[0].time);
    for (let i = 1; i < points.length; i++) {
        const dist = Math.abs(targetTime - points[i].time);
        if (dist < minDist) {
            minDist = dist;
            nearest = points[i];
        }
    }
    return nearest.wmoCode;
}

/**
 * Map a WMO weather code to a precipitation type.
 *
 * @param {number|null} code - WMO weather code
 * @returns {string} - 'rain', 'snow', 'sleet', or 'none'
 */
function wmoCodeToPrecipType(code) {
    if (code === null || code === undefined) return 'none';
    // Clear / cloudy / fog
    if (code === 0 || (code >= 1 && code <= 3) || code === 45 || code === 48) return 'none';
    // Rain: drizzle, rain, rain showers, thunderstorm
    if ((code >= 51 && code <= 55) || (code >= 61 && code <= 65) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return 'rain';
    // Snow: snow fall, snow grains, snow showers
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
    // Sleet: freezing drizzle, freezing rain, rain and snow showers
    if (code === 56 || code === 57 || code === 66 || code === 67 || code === 83 || code === 84) return 'sleet';
    return 'none';
}