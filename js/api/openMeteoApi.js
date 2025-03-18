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

import { API_ENDPOINTS } from '../config.js';
import { displayWeatherWithAlerts, hideLoading, hideError, showError } from '../ui.js';
import { isDaytime } from '../utils.js';
import { setApiAttribution } from '../api.js';
import { createEmptyWeatherData, WEATHER_ICONS } from '../standardWeatherFormat.js';

//==============================================================================
// 2. PUBLIC API FUNCTIONS
//==============================================================================

/**
 * Fetch weather from Open-Meteo API with a single consolidated request
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Optional location name
 */
export function fetchOpenMeteoWeather(lat, lon, locationName = null) {
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
        'wind_speed_10m_max',
        'wind_gusts_10m_max',
        'wind_direction_10m_dominant'
    ];

    // Construct a single consolidated URL with all parameters
    const url = `${API_ENDPOINTS.OPEN_METEO_FORECAST}?` + 
                `latitude=${formattedLat}&` +
                `longitude=${formattedLon}&` +
                `current=${currentParams.join(',')}&` +
                `hourly=${hourlyParams.join(',')}&` +
                `daily=${dailyParams.join(',')}&` +
                `timezone=auto`;

    // Make a single API request
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

//==============================================================================
// 3. DATA PROCESSING FUNCTIONS
//==============================================================================

/**
 * Process data from Open-Meteo API into standardized format
 * Using the consolidated response format with the previously working approach for hourly data
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
    weatherData.currently.temperature = (current.temperature_2m * 9/5) + 32;
    
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
        processDailyForecast(weatherData, data.daily);
    }

    // Process hourly forecast
    if (data.hourly) {
        processHourlyForecast(weatherData, data, current);
    }

    // Open-Meteo doesn't provide weather alerts
    weatherData.alerts = [];
    
    // Clear station info (Open-Meteo has no station data)
    weatherData.stationInfo.display = false;

    return weatherData;
}

/**
 * Process daily forecast data from Open-Meteo
 * @param {Object} weatherData - Weather data object to update
 * @param {Object} dailyData - Daily forecast data from Open-Meteo
 */
function processDailyForecast(weatherData, dailyData) {
    // Get the number of days in the forecast
    const days = dailyData.time.length;
    
    for (let i = 0; i < days; i++) {
        weatherData.daily.data.push({
            time: new Date(dailyData.time[i]).getTime() / 1000, // Convert to Unix timestamp
            icon: mapOpenMeteoCodeToIcon(dailyData.weather_code[i], true), // Always use daytime icons for daily forecast
            temperatureHigh: (dailyData.temperature_2m_max[i] * 9/5) + 32, // Convert from C to F
            temperatureLow: (dailyData.temperature_2m_min[i] * 9/5) + 32, // Convert from C to F
            summary: getWeatherDescription(dailyData.weather_code[i]),
            precipChance: dailyData.precipitation_probability_max[i] || 0
        });
    }
}

/**
 * Process hourly forecast data from Open-Meteo
 * @param {Object} weatherData - Weather data object to update
 * @param {Object} data - Complete data from Open-Meteo
 * @param {Object} current - Current weather data
 */
function processHourlyForecast(weatherData, data, current) {
    const hourly = data.hourly;
    
    // Important: Use the location's current time from the API response
    // This ensures we're working in the location's timezone
    const currentTimeStr = data.current.time;
    
    let startIndex = 0;
    
    // Find matching hour in hourly forecast that matches or is after current time
    for (let i = 0; i < hourly.time.length; i++) {
        if (hourly.time[i] > currentTimeStr) {
            startIndex = i;
            break;
        }
    }
    
    // Take 12 hours starting from the current hour
    const hoursToInclude = Math.min(12, hourly.time.length - startIndex);
    
    for (let i = 0; i < hoursToInclude; i++) {
        const dataIndex = startIndex + i;
        
        // Use the time directly from the API without any timezone conversion
        // This ensures we display the time in the location's timezone
        const hourTimestamp = new Date(hourly.time[dataIndex]).getTime() / 1000;
        
        // Format time string (e.g., "2 PM")
        const hourDate = new Date(hourly.time[dataIndex]);
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
            temperature: (hourly.temperature_2m[dataIndex] * 9/5) + 32, // Convert from C to F
            icon: mapOpenMeteoCodeToIcon(hourly.weather_code[dataIndex], hourIsDay),
            summary: getWeatherDescription(hourly.weather_code[dataIndex]),
            precipChance: hourly.precipitation_probability ? 
                (hourly.precipitation_probability[dataIndex] || 0) : 0,
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