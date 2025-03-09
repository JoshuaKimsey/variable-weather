/**
 * API functions for weather data retrieval
 * 
 * This module handles fetching weather data from different providers:
 * - National Weather Service (NWS) API for US locations
 * - Pirate Weather API for international locations
 * 
 * The module also provides data processing and error handling for each API.
 */

//==============================================================================
// 1. IMPORTS AND DEPENDENCIES
//==============================================================================

import { resetLastUpdateTime } from './autoUpdate.js';
import { getPirateWeatherApiKey, API_ENDPOINTS } from './config.js';
import { displayWeatherData, showLoading, hideLoading, hideError, showError } from './ui.js';
import { getCountryCode, isUSLocation, formatLocationName, calculateDistance } from './utils.js';
import { updateRadarLocation } from './radarView.js';

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

    // Determine if the location is in the US
    const countryCode = locationName ? getCountryCode(locationName) : 'us'; // Default to US if unknown

    if (isUSLocation(countryCode)) {
        // Use National Weather Service API for US locations
        fetchNWSWeather(lat, lon, locationName);
    } else {
        // Use Pirate Weather API for non-US locations
        fetchPirateWeather(lat, lon, locationName);
    }
}

//==============================================================================
// 3. UTILITY FUNCTIONS
//==============================================================================

/**
 * Extract the numeric wind speed from NWS wind speed string
 * 
 * @param {string} windSpeedString - Wind speed string like "10 mph" or "5 to 10 mph"
 * @returns {number|null} - Numeric wind speed value or null if not found
 */
function extractWindSpeed(windSpeedString) {
    if (!windSpeedString) return null;
    
    // Check if it's a range like "5 to 10 mph"
    if (windSpeedString.includes('to')) {
        // Take the higher value in the range
        const parts = windSpeedString.split('to');
        if (parts.length > 1) {
            const match = parts[1].match(/(\d+)/);
            if (match && match[1]) {
                return parseInt(match[1], 10);
            }
        }
    }
    
    // Otherwise extract the first number found
    const match = windSpeedString.match(/(\d+)/);
    if (match && match[1]) {
        return parseInt(match[1], 10);
    }
    
    return null;
}

/**
 * Map NWS icon to generic icon code with improved handling
 * 
 * @param {string} nwsIconUrl - URL of the NWS icon
 * @returns {string} - Generalized icon code for our application
 */
function mapNWSIconToGeneric(nwsIconUrl) {
    if (!nwsIconUrl) return 'cloudy'; // Default fallback

    // Extract the icon code from the URL
    // Example: https://api.weather.gov/icons/land/day/tsra,40?size=medium
    const parts = nwsIconUrl.split('/');
    let timeOfDay = 'day'; // default
    let iconCode = '';
    let hasChance = false;

    // Look for the part containing the icon code
    for (let i = 0; i < parts.length; i++) {
        if (parts[i] === 'day' || parts[i] === 'night') {
            timeOfDay = parts[i];
            // The next part should contain the icon code
            if (i + 1 < parts.length) {
                const codePart = parts[i + 1];

                // Extract the base icon code
                if (codePart.includes(',')) {
                    // Has probability number, e.g. "tsra,40"
                    const splitCode = codePart.split(',');
                    iconCode = splitCode[0];
                    hasChance = parseInt(splitCode[1], 10) < 50; // Consider it a "chance" if < 50%
                } else if (codePart.includes('?')) {
                    // Has query parameters
                    iconCode = codePart.split('?')[0];
                } else {
                    iconCode = codePart;
                }
                break;
            }
        }
    }

    // If no icon code found, default to cloudy
    if (!iconCode) return 'cloudy';

    // Night prefix for mapped icon codes
    const nightPrefix = timeOfDay === 'night' ? 'n' : '';
    
    // Base weather conditions with night awareness
    const baseConditions = {
        'skc': timeOfDay === 'night' ? 'clear-night' : 'clear-day',
        'few': timeOfDay === 'night' ? 'partly-cloudy-night' : 'partly-cloudy-day',
        'sct': timeOfDay === 'night' ? 'partly-cloudy-night' : 'partly-cloudy-day',
        'bkn': timeOfDay === 'night' ? 'partly-cloudy-night' : 'partly-cloudy-day',
        'ovc': 'cloudy',
        'wind_skc': 'wind',
        'wind_few': 'wind',
        'wind_sct': 'wind',
        'wind_bkn': 'wind',
        'wind_ovc': 'wind',
        'snow': 'snow',
        'rain_snow': 'sleet',
        'rain_sleet': 'sleet',
        'snow_sleet': 'sleet',
        'fzra': 'sleet',
        'rain_fzra': 'sleet',
        'snow_fzra': 'sleet',
        'sleet': 'sleet',
        'rain': 'rain',
        'rain_showers': 'rain',
        'rain_showers_hi': 'rain',
        'tsra': 'thunderstorm',
        'tsra_sct': 'thunderstorm',
        'tsra_hi': 'thunderstorm',
        'tornado': 'thunderstorm',
        'hurricane': 'thunderstorm',
        'tropical_storm': 'rain',
        'dust': 'fog',
        'smoke': 'fog',
        'haze': 'fog',
        'hot': timeOfDay === 'night' ? 'clear-night' : 'clear-day',
        'cold': timeOfDay === 'night' ? 'clear-night' : 'clear-day',
        'blizzard': 'snow',
        'fog': 'fog'
    };

    // Check if we have a direct match
    if (baseConditions[iconCode]) {
        return baseConditions[iconCode];
    }

    // For night prefixed codes, check the base code
    if (iconCode.startsWith('n') && baseConditions[iconCode.substring(1)]) {
        const baseCode = iconCode.substring(1);
        return baseConditions[baseCode];
    }

    // Pattern-based matching for codes not explicitly listed
    // Check for night-specific conditions first
    if (timeOfDay === 'night') {
        if (iconCode.includes('ts') || iconCode.includes('tsra')) {
            return 'thunderstorm';
        } else if (iconCode.includes('rain')) {
            return 'rain';
        } else if (iconCode.includes('snow')) {
            return 'snow';
        } else if (iconCode.includes('sleet') || iconCode.includes('fzra')) {
            return 'sleet';
        } else if (iconCode.includes('fog') || iconCode.includes('dust') || iconCode.includes('smoke')) {
            return 'fog';
        } else if (iconCode.includes('wind')) {
            return 'wind';
        } else if (iconCode.includes('cloud') || iconCode.includes('ovc') || iconCode.includes('bkn')) {
            return 'cloudy';
        } else if (iconCode.includes('few') || iconCode.includes('sct')) {
            return 'partly-cloudy-night';
        } else if (iconCode.includes('skc') || iconCode.includes('clear')) {
            return 'clear-night';
        }
        
        // Night-specific fallback
        return 'partly-cloudy-night';
    }
    
    // Day condition pattern matching
    if (iconCode.includes('ts') || iconCode.includes('tsra')) {
        return 'thunderstorm';
    } else if (iconCode.includes('rain')) {
        return 'rain';
    } else if (iconCode.includes('snow')) {
        return 'snow';
    } else if (iconCode.includes('sleet') || iconCode.includes('fzra')) {
        return 'sleet';
    } else if (iconCode.includes('fog') || iconCode.includes('dust') || iconCode.includes('smoke')) {
        return 'fog';
    } else if (iconCode.includes('wind')) {
        return 'wind';
    } else if (iconCode.includes('cloud') || iconCode.includes('ovc') || iconCode.includes('bkn')) {
        return 'cloudy';
    } else if (iconCode.includes('few') || iconCode.includes('sct')) {
        return 'partly-cloudy-day';
    } else if (iconCode.includes('skc') || iconCode.includes('clear')) {
        return 'clear-day';
    }

    // Default fallback
    console.warn(`Unknown NWS icon code: ${iconCode}. Using cloudy as fallback.`);
    return 'cloudy';
}

//==============================================================================
// 4. NATIONAL WEATHER SERVICE (NWS) API IMPLEMENTATION
//==============================================================================

/**
 * Fetch weather from National Weather Service API with proper current conditions
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Optional location name
 */
function fetchNWSWeather(lat, lon, locationName = null) {
    // First, we need to get the grid points
    // Make sure lat and lon are properly formatted
    const formattedLat = parseFloat(lat).toFixed(4);
    const formattedLon = parseFloat(lon).toFixed(4);
    
    const pointsUrl = `${API_ENDPOINTS.NWS_POINTS}/${formattedLat},${formattedLon}`;
    
    fetch(pointsUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Unable to get weather data from NWS. Falling back to Pirate Weather.');
            }
            return response.json();
        })
        .then(pointData => {
            // Extract grid information
            const { gridId, gridX, gridY, relativeLocation } = pointData.properties;
            
            // Get observation stations URL from the response
            const observationStationsUrl = pointData.properties.observationStations;
            
            // Get city and state from relative location
            let cityState = '';
            if (relativeLocation && relativeLocation.properties) {
                const { city, state } = relativeLocation.properties;
                cityState = `${city}, ${state}`;
            }
            
            // First, get nearby observation stations
            fetch(observationStationsUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Unable to get observation stations from NWS.');
                    }
                    return response.json();
                })
                .then(stationsData => {
                    // Instead of just grabbing the first station, let's try to get one that has recent data
                    const stationPromises = [];
                    
                    // Try the first 3 stations (to increase chances of getting good data)
                    const maxStations = Math.min(3, stationsData.features.length);
                    
                    for (let i = 0; i < maxStations; i++) {
                        if (stationsData.features[i] && stationsData.features[i].id) {
                            const station = stationsData.features[i];
                            const stationUrl = station.id;
                            
                            // Capture station metadata for later use
                            const stationMetadata = {
                                id: stationUrl,
                                name: station.properties.name,
                                distance: null // Will calculate this later if coordinates are available
                            };
                            
                            // If station has coordinates, calculate distance from requested location
                            if (station.geometry && station.geometry.coordinates) {
                                const stationLon = station.geometry.coordinates[0];
                                const stationLat = station.geometry.coordinates[1];
                                stationMetadata.distance = calculateDistance(lat, lon, stationLat, stationLon);
                            }
                            
                            // Create a promise for each station's latest observation
                            stationPromises.push(
                                fetch(`${stationUrl}/observations/latest`)
                                    .then(response => {
                                        if (!response.ok) {
                                            // If this station fails, we'll try the next one
                                            return { properties: null, stationMetadata: null };
                                        }
                                        return response.json().then(data => {
                                            // Attach station metadata to the observation data
                                            return { ...data, stationMetadata };
                                        });
                                    })
                                    .catch(() => {
                                        // If this station fails, we'll try the next one
                                        return { properties: null, stationMetadata: null };
                                    })
                            );
                        }
                    }
                    
                    // Try to get data from any of the stations
                    Promise.all(stationPromises)
                        .then(stationResults => {
                            // Find the first station with valid data
                            let validObservation = null;
                            
                            for (const result of stationResults) {
                                if (result.properties && 
                                    result.properties.temperature && 
                                    result.properties.temperature.value !== null) {
                                    validObservation = result;
                                    break;
                                }
                            }
                            
                            if (!validObservation) {
                                console.warn('No valid observation data found from any nearby stations.');
                            }
                            
                            // Now get forecast, hourly forecast, and alerts in parallel
                            Promise.all([
                                // Get forecast
                                fetch(`${API_ENDPOINTS.NWS_GRIDPOINTS}/${gridId}/${gridX},${gridY}/forecast`),
                                // Get hourly forecast
                                fetch(`${API_ENDPOINTS.NWS_GRIDPOINTS}/${gridId}/${gridX},${gridY}/forecast/hourly`),
                                // Get alerts
                                fetch(`${API_ENDPOINTS.NWS_ALERTS}?point=${formattedLat},${formattedLon}`)
                            ])
                            .then(responses => {
                                // Check if all responses are ok
                                if (!responses.every(response => response.ok)) {
                                    throw new Error('Unable to get complete weather data from NWS. Falling back to Pirate Weather.');
                                }
                                
                                // Parse all responses as JSON
                                return Promise.all(responses.map(response => response.json()));
                            })
                            .then(([forecastData, hourlyData, alertsData]) => {
                                // Process the NWS data
                                const weatherData = processNWSData(
                                    forecastData, 
                                    hourlyData, 
                                    alertsData, 
                                    validObservation, // Use the valid observation data we found
                                    cityState, 
                                    locationName
                                );
                                
                                // Display the weather data
                                displayWeatherData(weatherData, cityState || locationName);
                                
                                // Hide loading indicator and error message
                                hideLoading();
                                hideError();
                            })
                            .catch(error => {
                                console.error('Error fetching NWS weather data:', error);
                                // Fall back to Pirate Weather API
                                console.log('Falling back to Pirate Weather API');
                                fetchPirateWeather(lat, lon, locationName);
                            });
                        })
                        .catch(error => {
                            console.error('Error processing station observations:', error);
                            // Fall back to Pirate Weather API
                            console.log('Falling back to Pirate Weather API');
                            fetchPirateWeather(lat, lon, locationName);
                        });
                })
                .catch(error => {
                    console.error('Error fetching NWS observation stations:', error);
                    // Fall back to Pirate Weather API
                    console.log('Falling back to Pirate Weather API');
                    fetchPirateWeather(lat, lon, locationName);
                });
        })
        .catch(error => {
            console.error('Error fetching NWS points data:', error);
            // Fall back to Pirate Weather API
            console.log('Falling back to Pirate Weather API');
            fetchPirateWeather(lat, lon, locationName);
        });
}

/**
 * Process data from NWS API into standardized format with improved current conditions handling
 * 
 * @param {Object} forecastData - The forecast data from NWS API
 * @param {Object} hourlyData - The hourly forecast data from NWS API
 * @param {Object} alertsData - The alerts data from NWS API
 * @param {Object} observationData - The station observation data
 * @param {string} cityState - The city and state formatted as "City, State"
 * @param {string} locationName - The raw location name from the input
 * @returns {Object} - Processed weather data in standardized format
 */
function processNWSData(forecastData, hourlyData, alertsData, observationData, cityState, locationName) {
    // Get current forecast from the hourly forecast (for supplementary data only)
    const currentForecast = hourlyData.properties.periods[0];
    
    // Get daily forecast
    const dailyForecast = forecastData.properties.periods;
    
    // Get alerts
    const alerts = alertsData.features || [];
    
    // Create a combined data object that we'll fill with data
    const weatherData = {
        currently: {
            // Default values that will be overridden below
            temperature: 0,
            icon: 'cloudy',
            summary: '',
            windSpeed: 0,
            windDirection: '',
            humidity: 0.5,
            pressure: 1015,
            visibility: 10,
            isDaytime: currentForecast.isDaytime
        },
        daily: {
            data: []
        },
        hourlyForecast: [],
        alerts: alerts,
        source: 'nws',
        timezone: cityState || (locationName ? formatLocationName(locationName) : 'US Location'),
        observation: {
            // New field for observation metadata
            fromStation: false,
            stationName: null,
            stationDistance: null,
            observationTime: null
        }
    };
    
    // Check if we have valid observation data
    const hasValidObservation = 
        observationData && 
        observationData.properties && 
        observationData.properties.temperature && 
        observationData.properties.temperature.value !== null;
    
    // If we have observation data, use it for current conditions
    if (hasValidObservation) {
        const currentObservation = observationData.properties;
        
        // Add observation metadata
        weatherData.observation.fromStation = true;
        
        // Add station name if available
        if (observationData.stationMetadata && observationData.stationMetadata.name) {
            weatherData.observation.stationName = observationData.stationMetadata.name;
        }
        
        // Add station distance if available
        if (observationData.stationMetadata && observationData.stationMetadata.distance !== null) {
            weatherData.observation.stationDistance = observationData.stationMetadata.distance;
        }
        
        // Add observation time if available
        if (currentObservation.timestamp) {
            weatherData.observation.observationTime = currentObservation.timestamp;
        }
        
        // Temperature - using observed temperature
        if (currentObservation.temperature.unitCode === 'wmoUnit:degC') {
            // Convert from C to F if needed
            weatherData.currently.temperature = (currentObservation.temperature.value * 9/5) + 32;
        } else {
            weatherData.currently.temperature = currentObservation.temperature.value;
        }
        
        // Weather description - use actual observed weather condition
        if (currentObservation.textDescription) {
            // Extract the actual observation text and check if it contains forecast-like language
            const textDescription = currentObservation.textDescription;
            
            // Check for forecast-like phrases that shouldn't be in an observation
            const forecastPhrases = ['likely', 'chance', 'possible', 'expect', 'will be', 'tonight', 'tomorrow'];
            const containsForecastLanguage = forecastPhrases.some(phrase => 
                textDescription.toLowerCase().includes(phrase));
            
            if (containsForecastLanguage) {
                // Try to clean up the description to make it more observation-like
                let cleanedDescription = textDescription;
                
                // Remove forecast words
                forecastPhrases.forEach(phrase => {
                    const regex = new RegExp('\\b' + phrase + '\\b', 'gi');
                    cleanedDescription = cleanedDescription.replace(regex, '');
                });
                
                // Simplify "Showers And Thunderstorms Likely" to just "Showers And Thunderstorms"
                cleanedDescription = cleanedDescription
                    .replace(/Showers And Thunderstorms Likely/i, 'Showers And Thunderstorms')
                    .replace(/Chance of/i, '')
                    .replace(/  +/g, ' ') // Replace multiple spaces with a single space
                    .trim();
                    
                weatherData.currently.summary = cleanedDescription || textDescription;
                
                // Also mark that this observation text was adjusted
                weatherData.observation.descriptionAdjusted = true;
            } else {
                // Use the observation text as-is
                weatherData.currently.summary = textDescription;
                weatherData.observation.descriptionAdjusted = false;
            }
            
            // Check if we need to add wind info when not mentioned
            if (!weatherData.currently.summary.toLowerCase().includes('wind') && 
                currentObservation.windSpeed && 
                currentObservation.windSpeed.value > 15) {
                weatherData.currently.summary += " and Windy";
            }
        } else {
            // Fall back to forecast description only if observation doesn't have one
            weatherData.currently.summary = currentForecast.shortForecast;
            
            // Mark that we're using forecast description
            weatherData.observation.usingForecastDescription = true;
        }
        
        // Weather icon - determine from observation or text
        let isThunderstorm = false;
        if (currentObservation.textDescription) {
            const obsDescLower = currentObservation.textDescription.toLowerCase();
            if (obsDescLower.includes('thunder') || obsDescLower.includes('tstm') || obsDescLower.includes('lightning')) {
                weatherData.currently.icon = 'thunderstorm';
                isThunderstorm = true;
            }
        }
        
        // If no thunderstorm found in text, use icon
        if (!isThunderstorm) {
            if (currentObservation.icon) {
                weatherData.currently.icon = mapNWSIconToGeneric(currentObservation.icon);
            } else if (currentForecast.icon) {
                weatherData.currently.icon = mapNWSIconToGeneric(currentForecast.icon);
            }
        }
        
        // Wind speed
        if (currentObservation.windSpeed && currentObservation.windSpeed.value !== null) {
            if (currentObservation.windSpeed.unitCode === 'wmoUnit:m_s-1') {
                // Convert from m/s to mph
                weatherData.currently.windSpeed = currentObservation.windSpeed.value * 2.23694;
            } else if (currentObservation.windSpeed.unitCode === 'wmoUnit:km_h-1') {
                // Convert from km/h to mph
                weatherData.currently.windSpeed = currentObservation.windSpeed.value * 0.621371;
            } else {
                weatherData.currently.windSpeed = currentObservation.windSpeed.value;
            }
        } else {
            // Fall back to forecast wind if necessary
            weatherData.currently.windSpeed = extractWindSpeed(currentForecast.windSpeed);
        }
        
        // Humidity
        if (currentObservation.relativeHumidity && currentObservation.relativeHumidity.value !== null) {
            weatherData.currently.humidity = currentObservation.relativeHumidity.value / 100;
        } else if (dailyForecast[0].relativeHumidity?.value) {
            weatherData.currently.humidity = dailyForecast[0].relativeHumidity.value / 100;
        }
        
        // Pressure
        if (currentObservation.barometricPressure && currentObservation.barometricPressure.value !== null) {
            if (currentObservation.barometricPressure.unitCode === 'wmoUnit:Pa') {
                // Convert from Pascal to hPa (hectopascal)
                weatherData.currently.pressure = currentObservation.barometricPressure.value / 100;
            } else {
                weatherData.currently.pressure = currentObservation.barometricPressure.value;
            }
        }
        
        // Visibility
        if (currentObservation.visibility && currentObservation.visibility.value !== null) {
            if (currentObservation.visibility.unitCode === 'wmoUnit:m') {
                // Convert from meters to miles
                weatherData.currently.visibility = currentObservation.visibility.value * 0.000621371;
            } else {
                weatherData.currently.visibility = currentObservation.visibility.value;
            }
        }
        
        // Wind direction
        if (currentObservation.windDirection) {
            weatherData.currently.windDirection = currentObservation.windDirection.value;
        } else {
            weatherData.currently.windDirection = currentForecast.windDirection;
        }
    } else {
        // Fallback to forecast data if observation data is invalid or missing
        console.log("Using forecast data (no valid observation found)");
        
        // Set observation metadata to indicate we're using forecast data
        weatherData.observation.fromStation = false;
        
        // Temperature
        weatherData.currently.temperature = currentForecast.temperature;
        
        // Weather description
        weatherData.currently.summary = currentForecast.shortForecast;
        
        // Weather icon
        weatherData.currently.icon = mapNWSIconToGeneric(currentForecast.icon);
        
        // Wind speed
        weatherData.currently.windSpeed = extractWindSpeed(currentForecast.windSpeed);
        
        // Wind direction
        weatherData.currently.windDirection = currentForecast.windDirection;
        
        // Humidity (if available in forecast)
        if (dailyForecast[0].relativeHumidity?.value) {
            weatherData.currently.humidity = dailyForecast[0].relativeHumidity.value / 100;
        }
    }
    
    // Process daily forecast data
    // NWS provides separate day and night forecasts, so we need to combine them
    for (let i = 0; i < dailyForecast.length; i += 2) {
        if (i + 1 < dailyForecast.length) {
            const day = dailyForecast[i];
            const night = dailyForecast[i + 1];
            
            weatherData.daily.data.push({
                time: new Date(day.startTime).getTime() / 1000, // Convert to Unix timestamp
                icon: mapNWSIconToGeneric(day.icon),
                temperatureHigh: day.temperature,
                temperatureLow: night.temperature,
                summary: day.shortForecast
            });
        } else {
            // Handle case where we only have one period left
            const period = dailyForecast[i];
            
            weatherData.daily.data.push({
                time: new Date(period.startTime).getTime() / 1000,
                icon: mapNWSIconToGeneric(period.icon),
                temperatureHigh: period.isDaytime ? period.temperature : period.temperature + 10,
                temperatureLow: !period.isDaytime ? period.temperature : period.temperature - 10,
                summary: period.shortForecast
            });
        }
    }
    
    // Ensure we have at least 7 days of forecast data
    while (weatherData.daily.data.length < 7) {
        const lastDay = weatherData.daily.data[weatherData.daily.data.length - 1];
        const nextDay = {...lastDay};
        nextDay.time = lastDay.time + 86400; // Add one day in seconds
        weatherData.daily.data.push(nextDay);
    }

    // Process hourly forecast
    if (hourlyData && hourlyData.properties && Array.isArray(hourlyData.properties.periods)) {
        const hourlyPeriods = hourlyData.properties.periods;
        
        // Take first 12 periods (or all if less than 12)
        const periodsToUse = Math.min(12, hourlyPeriods.length);
        
        for (let i = 0; i < periodsToUse; i++) {
            const period = hourlyPeriods[i];
            
            weatherData.hourlyForecast.push({
                time: new Date(period.startTime).getTime() / 1000, // Convert to Unix timestamp
                temperature: period.temperature,
                icon: mapNWSIconToGeneric(period.icon),
                summary: period.shortForecast
            });
        }
    }
    
    return weatherData;
}

//==============================================================================
// 5. PIRATE WEATHER API IMPLEMENTATION
//==============================================================================

/**
 * Fetch weather from Pirate Weather API (fallback for non-US locations)
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Optional location name
 */
function fetchPirateWeather(lat, lon, locationName = null) {
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
            // Add source information
            data.source = 'pirate';

            // Display the weather data
            displayWeatherData(data, locationName);

            // Hide loading indicator and error message
            hideLoading();
            hideError();
        })
        .catch(error => {
            console.error('Error fetching Pirate Weather data:', error);
            showError(error.message || 'Error fetching weather data. Please try again later.');
        });
}