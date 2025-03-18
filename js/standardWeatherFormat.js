//==============================================================================
// 1. WEATHER API INTERFACE REFERENCE
//==============================================================================

/**
 * Weather API Interface
 * 
 * This defines the common interface that all weather API implementations
 * should follow. It acts as a reference/documentation for developers adding new
 * API providers to the system.
 */

/**
 * Each Weather API module should implement:
 * 1. A main fetch function that retrieves weather data from the API
 * 2. Data processing functions to convert API-specific formats to the standard format
 * 3. Helper functions specific to that API
 * 
 * The API module should not have any UI-specific code or direct DOM manipulations.
 * It should only deal with data fetching, processing, and returning the standardized data.
 */

/**
 * Example implementation template:
 * 
 * export async function fetchWeatherFromProvider(lat, lon, locationName = null) {
 *   try {
 *     // 1. Format parameters as needed for the specific API
 *     // 2. Construct the URL with appropriate endpoints and parameters
 *     // 3. Make the API request
 *     // 4. Process the response into the standardized format
 *     // 5. Return the processed data
 *   } catch (error) {
 *     // Handle errors - either return them or implement the fallback logic
 *   }
 * }
 * 
 * function processApiData(apiResponse, lat, lon, locationName) {
 *   // 1. Create an empty standardized data object
 *   // 2. Extract and convert current weather
 *   // 3. Extract and convert daily forecast
 *   // 4. Extract and convert hourly forecast
 *   // 5. Extract and convert alerts
 *   // 6. Return the standardized data
 * }
 */

/**
 * To add a new weather API provider:
 * 
 * 1. Create a new file named [providerName]Api.js in the /api directory
 * 2. Implement the fetch function and all necessary data processing functions
 * 3. Update api.js to include your new provider in the selection logic
 * 4. Add the provider's endpoint to config.js
 * 5. Update apiSettings.js if the provider requires an API key
 */

/**
 * Fallback chain:
 * 
 * If API calls fail, the system currently uses this fallback chain:
 * US locations: NWS -> Open-Meteo
 * Non-US locations: Open-Meteo only (with Pirate Weather as a future option)
 * 
 * When adding new providers, update the fallback logic in the api.js
 * to create appropriate fallback chains.
 */

/**
 * Weather data standard format reference:
 * 
 * {
 *   currently: {
 *     temperature: Number,            // Temperature in Fahrenheit
 *     icon: String,                   // Standard icon code 
 *     summary: String,                // Short text description
 *     windSpeed: Number,              // Wind speed in mph
 *     windDirection: Number|String,   // Wind direction in degrees or cardinal
 *     humidity: Number,               // Humidity as decimal (0-1)
 *     pressure: Number,               // Pressure in hPa/mb
 *     visibility: Number,             // Visibility in miles
 *     isDaytime: Boolean              // Whether it's daytime at the location
 *   },
 *   daily: {
 *     data: [                         // Array of daily forecasts
 *       {
 *         time: Number,               // Unix timestamp
 *         icon: String,               // Standard icon code
 *         temperatureHigh: Number,    // High temperature in Fahrenheit
 *         temperatureLow: Number,     // Low temperature in Fahrenheit
 *         summary: String,            // Day forecast summary
 *         precipChance: Number        // Precipitation chance (0-100)
 *       },
 *       // Additional days...
 *     ]
 *   },
 *   hourly: {
 *     data: [                         // Array of hourly forecasts
 *       {
 *         time: Number,               // Unix timestamp
 *         formattedTime: String,      // Formatted time (e.g., "3 PM")
 *         temperature: Number,        // Temperature in Fahrenheit
 *         icon: String,               // Standard icon code
 *         summary: String,            // Hour forecast summary
 *         precipChance: Number,       // Precipitation chance (0-100)
 *         isDaytime: Boolean          // Whether this hour is daytime
 *       },
 *       // Additional hours...
 *     ]
 *   },
 *   alerts: [                         // Array of weather alerts
 *     {
 *       id: String,                   // Unique alert ID
 *       title: String,                // Alert title/headline
 *       description: String,          // Short description
 *       fullText: String,             // Full alert text
 *       severity: String,             // One of: 'extreme', 'severe', 'moderate', 'minor'
 *       urgency: String,              // Urgency level if available
 *       expires: String|Number,       // Expiration timestamp
 *       hazardTypes: Array,           // Array of hazard type strings
 *       primaryHazard: String         // Primary hazard type
 *     },
 *     // Additional alerts...
 *   ],
 *   stationInfo: {                    // Observation station info
 *     display: Boolean,               // Whether to display station info
 *     stationName: String,            // Station name
 *     stationDistance: Number,        // Distance in kilometers
 *     observationTime: String,        // Timestamp of observation
 *     usingForecastDescription: Boolean, // Whether using forecast for description
 *     descriptionAdjusted: Boolean,   // Whether description was adjusted
 *     isForecastData: Boolean         // Whether using forecast instead of observation
 *   },
 *   source: String,                   // API source identifier
 *   timezone: String,                 // Location timezone
 *   lastUpdated: Number               // Timestamp of when data was processed
 * }
 */

//==============================================================================
// 2. STANDARD WEATHER DATA FORMAT
//==============================================================================

/**
 * Standard Weather Data Format
 * 
 * This module defines the standard data structure that all API implementations
 * should convert their responses to. This ensures a consistent interface for
 * the rest of the application regardless of the data source.
 */

/**
 * Create an empty standard weather data object
 * @returns {Object} A new empty weather data object with the standard structure
 */
export function createEmptyWeatherData() {
    return {
        // Current conditions
        currently: {
            temperature: 0,
            icon: 'cloudy',
            summary: '',
            windSpeed: 0,
            windDirection: '',
            humidity: 0.5,
            pressure: 1015,
            visibility: 10,
            isDaytime: true
        },
        
        // Daily forecast
        daily: {
            data: []
            // Each item should have: time, icon, temperatureHigh, temperatureLow, summary, precipChance
        },
        
        // Hourly forecast
        hourly: {
            data: []
            // Each item should have: time, formattedTime, temperature, icon, summary, precipChance
        },
        
        // Weather alerts
        alerts: [],
        // Each alert should have: id, title, description, fullText, severity, urgency, expires, hazardTypes, primaryHazard
        
        // Station information (for observation data)
        stationInfo: {
            display: false,
            stationName: null,
            stationDistance: null,
            observationTime: null,
            usingForecastDescription: false,
            descriptionAdjusted: false,
            isForecastData: false
        },
        
        // Metadata
        source: '',  // API source identifier (e.g., 'nws', 'open-meteo')
        timezone: 'auto',
        
        // Last update timestamp
        lastUpdated: Date.now()
    };
}

/**
 * Validate a weather data object against the standard format
 * @param {Object} data - The weather data object to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function validateWeatherData(data) {
    // Basic structure validation
    if (!data || typeof data !== 'object') return false;
    if (!data.currently || typeof data.currently !== 'object') return false;
    if (!data.daily || !Array.isArray(data.daily.data)) return false;
    if (!data.hourly || !Array.isArray(data.hourly.data)) return false;
    if (!Array.isArray(data.alerts)) return false;
    
    // Check required fields in current conditions
    const requiredCurrentFields = ['temperature', 'icon', 'summary', 'windSpeed', 'humidity'];
    for (const field of requiredCurrentFields) {
        if (data.currently[field] === undefined) return false;
    }
    
    // Success - data appears to be in the correct format
    return true;
}

/**
 * Standard alert severity levels
 */
export const ALERT_SEVERITY = {
    EXTREME: 'extreme',
    SEVERE: 'severe',
    MODERATE: 'moderate',
    MINOR: 'minor'
};

/**
 * Standard weather icons
 * These are the canonical icon names that should be used across the application
 */
export const WEATHER_ICONS = {
    CLEAR_DAY: 'clear-day',
    CLEAR_NIGHT: 'clear-night',
    RAIN: 'rain',
    SNOW: 'snow',
    SLEET: 'sleet',
    WIND: 'wind',
    FOG: 'fog',
    CLOUDY: 'cloudy',
    PARTLY_CLOUDY_DAY: 'partly-cloudy-day',
    PARTLY_CLOUDY_NIGHT: 'partly-cloudy-night',
    THUNDERSTORM: 'thunderstorm'
};