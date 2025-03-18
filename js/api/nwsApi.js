/**
 * National Weather Service (NWS) API Implementation
 * 
 * This module handles all interactions with the National Weather Service API,
 * including data fetching, processing, and error handling.
 */

//==============================================================================
// 1. IMPORTS AND DEPENDENCIES
//==============================================================================

import { API_ENDPOINTS, createNWSRequestOptions } from '../config.js';
import { displayWeatherWithAlerts, showLoading, hideLoading, hideError, showError } from '../ui.js';
import { calculateDistance, formatLocationName, isDaytime } from '../utils.js';
import { fetchOpenMeteoWeather } from './openMeteoApi.js';
import { setApiAttribution } from '../api.js';
import { createEmptyWeatherData, ALERT_SEVERITY, WEATHER_ICONS } from '../standardWeatherFormat.js';

//==============================================================================
// 2. PUBLIC API FUNCTIONS
//==============================================================================

/**
 * Fetch weather from National Weather Service API with sequential station checking
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Optional location name
 */
export function fetchNWSWeather(lat, lon, locationName = null) {
    // Format lat and lon properly
    const formattedLat = parseFloat(lat).toFixed(3);
    const formattedLon = parseFloat(lon).toFixed(3);

    const pointsUrl = `${API_ENDPOINTS.NWS_POINTS}/${formattedLat},${formattedLon}`;
    const requestOptions = createNWSRequestOptions();

    fetch(pointsUrl, requestOptions)
        .then(response => {
            if (!response.ok) {
                throw new Error('Unable to get weather data from NWS. Falling back to Open-Meteo.');
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
                                        throw new Error('Unable to get complete weather data from NWS. Falling back to Open Meteo.');
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

                                    setApiAttribution('nws');
                                    // Display the weather data
                                    displayWeatherWithAlerts(weatherData, cityState || locationName);

                                    // Hide loading indicator and error message
                                    hideLoading();
                                    hideError();
                                })
                                .catch(error => {
                                    console.error('Error fetching NWS weather data:', error);
                                    // Fall back to Open Meteo API
                                    console.log('Falling back to Open-Meteo API');
                                    fetchOpenMeteoWeather(lat, lon, locationName);
                                });
                        })
                        .catch(error => {
                            console.error('Error fetching station observations:', error);
                            // Fall back to Open Meteo API
                            console.log('Falling back to Open-Meteo API due to station observation error');
                            fetchOpenMeteoWeather(lat, lon, locationName);
                        });
                })
                .catch(error => {
                    console.error('Error fetching NWS observation stations:', error);
                    // Fall back to Open Meteo API
                    console.log('Falling back to Open-Meteo API');
                    fetchOpenMeteoWeather(lat, lon, locationName);
                });
        })
        .catch(error => {
            console.error('Error fetching NWS points data:', error);
            // Fall back to Open Meteo API
            console.log('Falling back to Open-Meteo API');
            fetchOpenMeteoWeather(lat, lon, locationName);
        });
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
    if (!nwsIconUrl) return WEATHER_ICONS.CLOUDY; // Default fallback

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
    if (!iconCode) return WEATHER_ICONS.CLOUDY;

    // Night prefix for mapped icon codes
    const nightPrefix = timeOfDay === 'night' ? 'n' : '';

    // Base weather conditions with night awareness
    const baseConditions = {
        'skc': timeOfDay === 'night' ? WEATHER_ICONS.CLEAR_NIGHT : WEATHER_ICONS.CLEAR_DAY,
        'few': timeOfDay === 'night' ? WEATHER_ICONS.PARTLY_CLOUDY_NIGHT : WEATHER_ICONS.PARTLY_CLOUDY_DAY,
        'sct': timeOfDay === 'night' ? WEATHER_ICONS.PARTLY_CLOUDY_NIGHT : WEATHER_ICONS.PARTLY_CLOUDY_DAY,
        'bkn': timeOfDay === 'night' ? WEATHER_ICONS.PARTLY_CLOUDY_NIGHT : WEATHER_ICONS.PARTLY_CLOUDY_DAY,
        'ovc': WEATHER_ICONS.CLOUDY,
        'wind_skc': WEATHER_ICONS.WIND,
        'wind_few': WEATHER_ICONS.WIND,
        'wind_sct': WEATHER_ICONS.WIND,
        'wind_bkn': WEATHER_ICONS.WIND,
        'wind_ovc': WEATHER_ICONS.WIND,
        'snow': WEATHER_ICONS.SNOW,
        'rain_snow': WEATHER_ICONS.SLEET,
        'rain_sleet': WEATHER_ICONS.SLEET,
        'snow_sleet': WEATHER_ICONS.SLEET,
        'fzra': WEATHER_ICONS.SLEET,
        'rain_fzra': WEATHER_ICONS.SLEET,
        'snow_fzra': WEATHER_ICONS.SLEET,
        'sleet': WEATHER_ICONS.SLEET,
        'rain': WEATHER_ICONS.RAIN,
        'rain_showers': WEATHER_ICONS.RAIN,
        'rain_showers_hi': WEATHER_ICONS.RAIN,
        'tsra': WEATHER_ICONS.THUNDERSTORM,
        'tsra_sct': WEATHER_ICONS.THUNDERSTORM,
        'tsra_hi': WEATHER_ICONS.THUNDERSTORM,
        'tornado': WEATHER_ICONS.THUNDERSTORM,
        'hurricane': WEATHER_ICONS.THUNDERSTORM,
        'tropical_storm': WEATHER_ICONS.RAIN,
        'dust': WEATHER_ICONS.FOG,
        'smoke': WEATHER_ICONS.FOG,
        'haze': WEATHER_ICONS.FOG,
        'hot': timeOfDay === 'night' ? WEATHER_ICONS.CLEAR_NIGHT : WEATHER_ICONS.CLEAR_DAY,
        'cold': timeOfDay === 'night' ? WEATHER_ICONS.CLEAR_NIGHT : WEATHER_ICONS.CLEAR_DAY,
        'blizzard': WEATHER_ICONS.SNOW,
        'fog': WEATHER_ICONS.FOG
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
            return WEATHER_ICONS.THUNDERSTORM;
        } else if (iconCode.includes('rain')) {
            return WEATHER_ICONS.RAIN;
        } else if (iconCode.includes('snow')) {
            return WEATHER_ICONS.SNOW;
        } else if (iconCode.includes('sleet') || iconCode.includes('fzra')) {
            return WEATHER_ICONS.SLEET;
        } else if (iconCode.includes('fog') || iconCode.includes('dust') || iconCode.includes('smoke')) {
            return WEATHER_ICONS.FOG;
        } else if (iconCode.includes('wind')) {
            return WEATHER_ICONS.WIND;
        } else if (iconCode.includes('cloud') || iconCode.includes('ovc') || iconCode.includes('bkn')) {
            return WEATHER_ICONS.CLOUDY;
        } else if (iconCode.includes('few') || iconCode.includes('sct')) {
            return WEATHER_ICONS.PARTLY_CLOUDY_NIGHT;
        } else if (iconCode.includes('skc') || iconCode.includes('clear')) {
            return WEATHER_ICONS.CLEAR_NIGHT;
        }

        // Night-specific fallback
        return WEATHER_ICONS.PARTLY_CLOUDY_NIGHT;
    }

    // Day condition pattern matching
    if (iconCode.includes('ts') || iconCode.includes('tsra')) {
        return WEATHER_ICONS.THUNDERSTORM;
    } else if (iconCode.includes('rain')) {
        return WEATHER_ICONS.RAIN;
    } else if (iconCode.includes('snow')) {
        return WEATHER_ICONS.SNOW;
    } else if (iconCode.includes('sleet') || iconCode.includes('fzra')) {
        return WEATHER_ICONS.SLEET;
    } else if (iconCode.includes('fog') || iconCode.includes('dust') || iconCode.includes('smoke')) {
        return WEATHER_ICONS.FOG;
    } else if (iconCode.includes('wind')) {
        return WEATHER_ICONS.WIND;
    } else if (iconCode.includes('cloud') || iconCode.includes('ovc') || iconCode.includes('bkn')) {
        return WEATHER_ICONS.CLOUDY;
    } else if (iconCode.includes('few') || iconCode.includes('sct')) {
        return WEATHER_ICONS.PARTLY_CLOUDY_DAY;
    } else if (iconCode.includes('skc') || iconCode.includes('clear')) {
        return WEATHER_ICONS.CLEAR_DAY;
    }

    // Default fallback
    console.warn(`Unknown NWS icon code: ${iconCode}. Using cloudy as fallback.`);
    return WEATHER_ICONS.CLOUDY;
}

//==============================================================================
// 4. OBSERVATION STATION FUNCTIONS
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
    
    // Limit to first 5 stations for performance
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

//==============================================================================
// 5. DATA PROCESSING FUNCTIONS
//==============================================================================

/**
 * Process NWS alerts into standard format
 * @param {Object} alertsData - Raw alerts data from NWS
 * @returns {Array} Standardized alerts
 */
function processNWSAlerts(alertsData) {
    if (!alertsData || !alertsData.features || !Array.isArray(alertsData.features)) {
        return [];
    }
    
    return alertsData.features.map(alert => {
        if (!alert.properties) return null;
        
        const props = alert.properties;
        
        return {
            id: props.id || `nws-alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: props.event || 'Weather Alert',
            description: props.headline || '',
            fullText: props.description || '',
            severity: determineAlertSeverity(props),
            urgency: props.urgency || '',
            expires: props.expires || null,
            hazardTypes: identifyAlertHazards(props.event || '', props.headline || '', props.description || ''),
            primaryHazard: getPrimaryHazardType(props.event || ''),
            geometry: alert.geometry || null
        };
    }).filter(alert => alert !== null);
}

/**
 * Determine alert severity based on NWS properties
 * @param {Object} props - Alert properties
 * @returns {string} Standardized severity level
 */
function determineAlertSeverity(props) {
    // First check if the API provides a severity level directly
    if (props.severity) {
        const apiSeverity = props.severity.toLowerCase();

        // If the API says it's extreme or severe, trust it
        if (apiSeverity === 'extreme' || apiSeverity === 'severe') {
            return apiSeverity;
        }
    }

    // Extract the alert title/event for mapping
    const lowerTitle = (props.event || '').toLowerCase();

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
        return ALERT_SEVERITY.EXTREME;
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
        return ALERT_SEVERITY.SEVERE;
    }

    // Moderate threats - possible threat to life or property
    if (
        lowerTitle.includes('flood warning') ||
        lowerTitle.includes('thunderstorm watch') ||
        lowerTitle.includes('winter storm watch') ||
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
        return ALERT_SEVERITY.MODERATE;
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
        return ALERT_SEVERITY.MINOR;
    }

    // Check for some general indicators
    if (lowerTitle.includes('warning')) {
        return ALERT_SEVERITY.SEVERE;  // Any unspecified warning is treated as severe
    }

    if (lowerTitle.includes('watch')) {
        return ALERT_SEVERITY.MODERATE;  // Any unspecified watch is treated as moderate
    }

    if (lowerTitle.includes('advisory') || lowerTitle.includes('statement')) {
        return ALERT_SEVERITY.MINOR;  // Any unspecified advisory is treated as minor
    }

    // Default fallback
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
    if (/\bsnow\b|\bblizzard\b|\bwinter\b/.test(title)) return 'snow';
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
 * Process station information into standard format
 * @param {Object} observationData - Raw observation data
 * @param {boolean} usingForecastDescription - Whether using forecast for description
 * @param {boolean} descriptionAdjusted - Whether description was adjusted
 * @returns {Object} Standardized station info
 */
function processStationInfo(observationData, usingForecastDescription = false, descriptionAdjusted = false) {
    let stationInfo = {
        display: false,
        stationName: null,
        stationDistance: null,
        observationTime: null,
        usingForecastDescription: usingForecastDescription,
        descriptionAdjusted: descriptionAdjusted,
        isForecastData: false
    };
    
    if (observationData && observationData.stationMetadata) {
        stationInfo.display = true;
        stationInfo.stationName = observationData.stationMetadata.name || 'NWS Station';
        stationInfo.stationDistance = observationData.stationMetadata.distance;
        stationInfo.observationTime = observationData.properties?.timestamp || null;
    }
    
    return stationInfo;
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
    // Create a standardized empty weather data object
    const weatherData = createEmptyWeatherData();
    
    // Set source and timezone
    weatherData.source = 'nws';
    weatherData.timezone = cityState || (locationName ? formatLocationName(locationName) : 'US Location');
    
    // Get current forecast from the hourly forecast (for supplementary data only)
    const currentForecast = hourlyData.properties.periods[0];

    // Check if we have valid observation data
    const hasValidObservation =
        observationData &&
        observationData.properties &&
        observationData.properties.temperature &&
        observationData.properties.temperature.value !== null;

    let usingForecastDescription = false;
    let descriptionAdjusted = false;

    // If we have observation data, use it for current conditions
    if (hasValidObservation) {
        const currentObservation = observationData.properties;

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
                descriptionAdjusted = true;
            } else {
                // Use the observation text as-is
                weatherData.currently.summary = textDescription;
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
            usingForecastDescription = true;
        }

        // Weather icon - determine from observation or text
        let isThunderstorm = false;
        if (currentObservation.textDescription) {
            const obsDescLower = currentObservation.textDescription.toLowerCase();
            if (obsDescLower.includes('thunder') || obsDescLower.includes('tstm') || obsDescLower.includes('lightning')) {
                weatherData.currently.icon = WEATHER_ICONS.THUNDERSTORM;
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
        } else if (forecastData.properties.periods[0].relativeHumidity?.value) {
            weatherData.currently.humidity = forecastData.properties.periods[0].relativeHumidity.value / 100;
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
        
        // Set station info
        weatherData.stationInfo = processStationInfo(observationData, usingForecastDescription, descriptionAdjusted);
    } else {
        // Fallback to forecast data if observation data is invalid or missing
        console.log("Using forecast data (no valid observation found)");

        // Set station info for forecast data
        weatherData.stationInfo = {
            display: true,
            stationName: null,
            stationDistance: null,
            observationTime: null,
            usingForecastDescription: false,
            descriptionAdjusted: false,
            isForecastData: true
        };

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
        if (forecastData.properties.periods[0].relativeHumidity?.value) {
            weatherData.currently.humidity = forecastData.properties.periods[0].relativeHumidity.value / 100;
        }
    }
    
    // Set daylight flag
    weatherData.currently.isDaytime = isDaytime(lat, lon);

    // Process daily forecast data using name-based approach
    processDailyForecast(weatherData, forecastData.properties.periods);

    // Process hourly forecast
    processHourlyForecast(weatherData, hourlyData.properties.periods);

    // Process alerts
    weatherData.alerts = processNWSAlerts(alertsData);

    return weatherData;
}

/**
 * Process NWS daily forecast data
 * @param {Object} weatherData - Weather data object to update
 * @param {Array} forecastPeriods - NWS forecast periods
 */
function processDailyForecast(weatherData, forecastPeriods) {
    // Organize periods into day and night collections
    let dayPeriods = {};
    let nightPeriods = {};

    forecastPeriods.forEach(period => {
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
            icon: dayPeriod ? mapNWSIconToGeneric(dayPeriod.icon) : WEATHER_ICONS.CLOUDY,
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
}

/**
 * Process NWS hourly forecast data
 * @param {Object} weatherData - Weather data object to update
 * @param {Array} hourlyPeriods - NWS hourly forecast periods
 */
function processHourlyForecast(weatherData, hourlyPeriods) {
    // Take first 12 periods (or all if less than 12)
    const periodsToUse = Math.min(12, hourlyPeriods.length);

    for (let i = 1; i < periodsToUse; i++) {
        const period = hourlyPeriods[i];
        
        // Get precipitation chance with robust null checking
        const precipChance = period.probabilityOfPrecipitation && 
                            period.probabilityOfPrecipitation.value !== null ? 
                            period.probabilityOfPrecipitation.value : 0;
        
        // Extract and format time directly from the original timestamp string
        // Format: "2025-03-17T13:00:00-10:00"
        let formattedTime = "N/A";
        if (period.startTime) {
            const timeMatch = period.startTime.match(/T(\d{2}):/);
            if (timeMatch && timeMatch[1]) {
                const hourNum = parseInt(timeMatch[1], 10);
                const hour12 = hourNum % 12 || 12;
                const ampm = hourNum >= 12 ? 'PM' : 'AM';
                formattedTime = `${hour12} ${ampm}`;
            }
        }

        weatherData.hourly.data.push({
            time: new Date(period.startTime).getTime() / 1000, // For sorting/calculations
            formattedTime: formattedTime, // Pre-formatted time string ready for display
            temperature: period.temperature,
            icon: mapNWSIconToGeneric(period.icon),
            summary: period.shortForecast,
            precipChance: precipChance,
            isDaytime: period.isDaytime // Include isDaytime flag for proper icon selection
        });
    }
}