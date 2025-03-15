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
import { getPirateWeatherApiKey, API_ENDPOINTS, createNWSRequestOptions } from './config.js';
import { displayWeatherData, displayWeatherWithAlerts, showLoading, hideLoading, hideError, showError } from './ui.js';
import { 
    getCountryCode, 
    isUSLocation, 
    formatLocationName, 
    calculateDistance, 
    isDaytime,
    saveLocationToCache 
} from './utils.js';
import { locationChanged } from './astronomicalView.js';

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
        fetchNWSWeather(lat, lon, locationName);
    } else {
        // Use Pirate Weather API for non-US locations
        fetchPirateWeather(lat, lon, locationName);
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
 * Fetch the observation data from stations sequentially with improved logging and handling
 * @param {Array} stations - Array of station objects with ids
 * @param {number} lat - User's requested latitude
 * @param {number} lon - User's requested longitude
 * @returns {Promise<Object>} - Promise resolving to valid observation data or null
 */
async function fetchStationObservationsSequentially(stations, lat, lon) {
    // Sort stations by distance if coordinates are available
    const stationsWithDistance = stations.map(station => {
        let distance = null;
        
        // Calculate distance if station has coordinates
        if (station.geometry && station.geometry.coordinates) {
            const stationLon = station.geometry.coordinates[0];
            const stationLat = station.geometry.coordinates[1];
            distance = calculateDistance(lat, lon, stationLat, stationLon);
        }
        
        return {
            ...station,
            distance
        };
    });
    
    // Sort by distance (null distances will be at the end)
    const sortedStations = stationsWithDistance.sort((a, b) => {
        // If both have distance, compare them
        if (a.distance !== null && b.distance !== null) {
            return a.distance - b.distance;
        }
        // If only a has distance, put a first
        if (a.distance !== null) {
            return -1;
        }
        // If only b has distance, put b first
        if (b.distance !== null) {
            return 1;
        }
        // If neither has distance, keep original order
        return 0;
    });
    
    // Limit to first 3 stations for performance
    const stationsToTry = sortedStations.slice(0, 5);
    
    console.log(`Attempting to fetch data from ${stationsToTry.length} weather stations`);
    
    // Track best observation in case all have some issues
    let bestObservation = null;
    let bestObservationAge = Infinity;
    let bestObservationHasDescription = false;
    
    // Try stations one by one
    for (const station of stationsToTry) {
        try {
            console.log(`Trying station: ${station.properties?.name || station.id}`);
            
            // Create metadata for the station
            const stationMetadata = {
                id: station.id,
                name: station.properties?.name || 'Weather Station',
                distance: station.distance
            };
            
            // Fetch observation data
            const response = await fetch(`${station.id}/observations/latest`);
            
            // Check if response is OK
            if (!response.ok) {
                console.warn(`Station ${stationMetadata.name} returned error: ${response.status}`);
                continue; // Try next station
            }
            
            // Parse the response
            const data = await response.json();
            
            // Attach station metadata to data
            data.stationMetadata = stationMetadata;
            
            // Check if observation has valid temperature data
            if (data.properties && 
                data.properties.temperature && 
                data.properties.temperature.value !== null) {
                
                // Check if observation is not too old (less than 2 hours old)
                const observationTime = new Date(data.properties.timestamp);
                const now = new Date();
                const timeDiffMs = now - observationTime;
                const hoursDiff = timeDiffMs / (1000 * 60 * 60);
                
                // Check if this observation has a textDescription
                const hasDescription = data.properties.textDescription !== undefined && 
                                      data.properties.textDescription !== null &&
                                      data.properties.textDescription !== '';
                                      
                console.log(`Station ${stationMetadata.name}: age=${hoursDiff.toFixed(1)}h, hasDescription=${hasDescription}`);
                
                if (hoursDiff < 2) {
                    // This is a valid observation based on age
                    
                    // If it has a description, return it immediately as it's complete
                    if (hasDescription) {
                        console.log(`Using complete observation from ${stationMetadata.name}`);
                        return data;
                    }
                    
                    // No description but still a valid observation - keep track of it 
                    // as our best option so far, especially if it's newer
                    if (hoursDiff < bestObservationAge) {
                        bestObservation = data;
                        bestObservationAge = hoursDiff;
                        bestObservationHasDescription = hasDescription;
                        console.log(`Setting as best observation so far (age: ${hoursDiff.toFixed(1)}h)`);
                    }
                } else {
                    console.warn(`Observation from ${stationMetadata.name} is too old: ${hoursDiff.toFixed(1)} hours`);
                }
            } else {
                console.warn(`Station ${stationMetadata.name} missing temperature data`);
            }
        } catch (error) {
            console.warn(`Error fetching from station:`, error);
        }
    }
    
    // After trying all stations, return the best one we found (even if it's missing description)
    if (bestObservation) {
        console.log(`Using best observation (age: ${bestObservationAge.toFixed(1)}h, hasDescription: ${bestObservationHasDescription})`);
        return bestObservation;
    }
    
    // If we get here, no valid observations were found
    console.warn('No valid observations found from any station');
    return null;
}

/**
 * Fetch weather from National Weather Service API with sequential station checking
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Optional location name
 */
function fetchNWSWeather(lat, lon, locationName = null) {
    // Format lat and lon properly
    const formattedLat = parseFloat(lat).toFixed(3);
    const formattedLon = parseFloat(lon).toFixed(3);

    const pointsUrl = `${API_ENDPOINTS.NWS_POINTS}/${formattedLat},${formattedLon}`;
    const requestOptions = createNWSRequestOptions();

    fetch(pointsUrl, requestOptions)
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
            fetch(observationStationsUrl, requestOptions)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Unable to get observation stations from NWS.');
                    }
                    return response.json();
                })
                .then(stationsData => {
                    // Now fetch observations sequentially using our new function
                    fetchStationObservationsSequentially(stationsData.features, lat, lon, requestOptions)
                        .then(validObservation => {
                            // Now get forecast, hourly forecast, and alerts in parallel
                            Promise.all([
                                // Get forecast
                                fetch(`${API_ENDPOINTS.NWS_GRIDPOINTS}/${gridId}/${gridX},${gridY}/forecast`, requestOptions),
                                // Get hourly forecast
                                fetch(`${API_ENDPOINTS.NWS_GRIDPOINTS}/${gridId}/${gridX},${gridY}/forecast/hourly`, requestOptions),
                                // Get alerts
                                fetch(`${API_ENDPOINTS.NWS_ALERTS}?point=${formattedLat},${formattedLon}`, requestOptions)
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
                                        locationName,
                                        formattedLat,
                                        formattedLon
                                    );

                                    // Display the weather data
                                    displayWeatherWithAlerts(weatherData, cityState || locationName);

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
                            console.error('Error fetching station observations:', error);
                            // Fall back to Pirate Weather API
                            console.log('Falling back to Pirate Weather API due to station observation error');
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
 * @param {number} lat - Latitude of the location
 * @param {number} lon - Longitude of the location
 * @returns {Object} - Processed weather data in standardized format
 */
function processNWSData(forecastData, hourlyData, alertsData, observationData, cityState, locationName, lat, lon) {
    // Get current forecast from the hourly forecast (for supplementary data only)
    const currentForecast = hourlyData.properties.periods[0];

    // Get daily forecast
    const dailyForecast = forecastData.properties.periods;

    // Get alerts
    const alerts = alertsData.features.map(alert => {
        // Keep existing alert properties
        const alertObj = {
            properties: alert.properties,
            // ...other existing properties
        };

        // Add geometry data if available
        if (alert.geometry) {
            alertObj.geometry = alert.geometry;
        }

        return alertObj;
    });

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
            isDaytime: isDaytime(lat, lon)
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
            weatherData.currently.temperature = (currentObservation.temperature.value * 9 / 5) + 32;
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

    // Process daily forecast data using name-based approach
    // Organize periods into day and night collections
    let dayPeriods = {};
    let nightPeriods = {};

    dailyForecast.forEach(period => {
        if (period.isDaytime) {
            // This is a day period (e.g., "Saturday", "Sunday")
            dayPeriods[period.name] = period;
        } else {
            // This is a night period (e.g., "Saturday Night", "Sunday Night")
            // Extract the day name from "X Night" format
            const dayName = period.name.replace(" Night", "");
            nightPeriods[dayName] = period;
        }
    });

    // Get unique day names (e.g., "Saturday", "Sunday", etc.)
    const dayNames = Object.keys(dayPeriods);

    // Create properly paired day/night forecast data
    dayNames.forEach(dayName => {
        const dayPeriod = dayPeriods[dayName];
        const nightPeriod = nightPeriods[dayName]; // Corresponding night period
        
        // Get precipitation chances with null checking
        const dayPrecipChance = dayPeriod && dayPeriod.probabilityOfPrecipitation && 
                              dayPeriod.probabilityOfPrecipitation.value !== null ? 
                              dayPeriod.probabilityOfPrecipitation.value : 0;
                              
        const nightPrecipChance = nightPeriod && nightPeriod.probabilityOfPrecipitation && 
                                nightPeriod.probabilityOfPrecipitation.value !== null ? 
                                nightPeriod.probabilityOfPrecipitation.value : 0;
        
        // Use the higher of the day and night precipitation chances
        const precipChance = Math.max(dayPrecipChance, nightPrecipChance);
        
        // Create the forecast entry for this day
        weatherData.daily.data.push({
            time: dayPeriod ? new Date(dayPeriod.startTime).getTime() / 1000 : Date.now() / 1000,
            icon: dayPeriod ? mapNWSIconToGeneric(dayPeriod.icon) : 'cloudy',
            temperatureHigh: dayPeriod ? dayPeriod.temperature : 70,
            temperatureLow: nightPeriod ? nightPeriod.temperature : 50,
            summary: dayPeriod ? dayPeriod.shortForecast : 'Forecast unavailable',
            precipChance: precipChance
        });
    });

    // Ensure we have at least 7 days of forecast data
    while (weatherData.daily.data.length < 7) {
        const lastDay = weatherData.daily.data[weatherData.daily.data.length - 1];
        const nextDay = { ...lastDay };
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
            
            // Get precipitation chance with robust null checking
            const precipChance = period.probabilityOfPrecipitation && 
                                period.probabilityOfPrecipitation.value !== null ? 
                                period.probabilityOfPrecipitation.value : 0;

            weatherData.hourlyForecast.push({
                time: new Date(period.startTime).getTime() / 1000, // Convert to Unix timestamp
                temperature: period.temperature,
                icon: mapNWSIconToGeneric(period.icon),
                summary: period.shortForecast,
                precipChance: precipChance // Add precipitation chance
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

            data.currently.isDaytime = isDaytime(lat, lon);
            
            // Process precipitation chances for Pirate Weather data
            // Pirate Weather uses precipProbability as a decimal (0.4 = 40%)
            
            // Process daily forecast precipitation
            if (data.daily && data.daily.data) {
                data.daily.data.forEach(day => {
                    if (day.precipProbability !== undefined) {
                        // Convert decimal to percentage and round
                        day.precipChance = Math.round(day.precipProbability * 100);
                    } else {
                        day.precipChance = 0;
                    }
                });
            }
            
            // Process hourly forecast precipitation
            if (data.hourly && data.hourly.data) {
                data.hourly.data.forEach(hour => {
                    if (hour.precipProbability !== undefined) {
                        // Convert decimal to percentage and round
                        hour.precipChance = Math.round(hour.precipProbability * 100);
                    } else {
                        hour.precipChance = 0;
                    }
                });
            }

            // Display the weather data
            displayWeatherWithAlerts(data, locationName);

            // Hide loading indicator and error message
            hideLoading();
            hideError();
        })
        .catch(error => {
            console.error('Error fetching Pirate Weather data:', error);
            showError(error.message || 'Error fetching weather data. Please try again later.');
        });
}