/**
 * Main API Coordinator for weather data retrieval
 * 
 * This module acts as the central coordinator for different weather API providers.
 * It maintains a registry of providers, handles provider selection based on location,
 * and manages fallbacks when providers are unavailable.
 */

//==============================================================================
// 1. IMPORTS AND DEPENDENCIES
//==============================================================================

// Core utility imports
import { resetLastUpdateTime } from './utils/autoUpdate.js';
import { saveLocationToCache } from './utils/geo.js';
import { locationChanged } from './ui/components/astronomical.js';
import { showLoading, hideLoading, hideError, displayWeatherWithAlerts, showError } from './ui/core.js';
import { getNowcastSource, getWeatherProvider } from './ui/controls/settings.js';
import { log, warn } from './utils/logger.js';

//==============================================================================
// API PROVIDER IMPORTS
// Add new API provider imports below this line
//==============================================================================

// Open-Meteo API
import { API_METADATA as openMeteoMetadata, fetchOpenMeteoWeather, fetchOpenMeteoNowcastOnly } from './api/openMeteoApi.js';

// Pirate Weather API
import { API_METADATA as pirateMetadata, fetchPirateWeather, fetchPirateWeatherNowcastOnly } from './api/pirateWeatherApi.js';

//==============================================================================
// 2. API PROVIDER REGISTRY
//==============================================================================

// Initialize the API registry
const API_REGISTRY = {
    providers: [],
    regions: new Set(['global']), // Always include global as default
    regionNameMap: new Map() // Map region names to region codes
};

/**
 * Register an API provider with the registry
 * @param {Object} providerMetadata - Metadata about the provider
 * @param {Function} fetchFunction - The provider's main weather fetch function
 * @param {Function} [nowcastFunction] - Optional nowcast fetch function
 */
export function registerApiProvider(providerMetadata, fetchFunction, nowcastFunction = null) {
    // Validate the provider has required fields
    if (!providerMetadata.id || !providerMetadata.name) {
        console.error('Provider registration failed: Missing required metadata fields');
        return;
    }

    if (!fetchFunction || typeof fetchFunction !== 'function') {
        console.error(`Provider registration failed for ${providerMetadata.id}: Missing fetch function`);
        return;
    }

    // Create the complete provider entry
    const provider = {
        ...providerMetadata,
        fetchWeather: fetchFunction,
        fetchNowcast: nowcastFunction,

        // Add helper methods to verify API key status
        hasApiKey: function () {
            if (!this.requiresApiKey) return true;

            // Check for API key in localStorage
            const storageKey = this.apiKeyStorageKey || `weather_app_${this.id}_api_key`;
            const apiKey = localStorage.getItem(storageKey);

            return apiKey && apiKey !== (this.defaultApiKey || '*insert-your-api-key-here*') && apiKey !== '';
        },

        // Helper to determine if this provider can handle a specific region
        supportsRegion: function (region) {
            if (!this.regions || this.regions.includes('global')) return true;
            return this.regions.includes(region.toLowerCase());
        },

        // Helper to check if this provider supports nowcast
        supportsNowcast: function () {
            return typeof this.fetchNowcast === 'function';
        }
    };

    // Add the provider to the registry
    API_REGISTRY.providers.push(provider);

    // Add regions to the registry
    if (provider.regions && Array.isArray(provider.regions)) {
        provider.regions.forEach(region => {
            const regionLower = region.toLowerCase();
            API_REGISTRY.regions.add(regionLower);

            // If this provider has regionNames, add each to the region name map
            if (provider.regionNames && Array.isArray(provider.regionNames)) {
                provider.regionNames.forEach(name => {
                    // Store the region name in lowercase for case-insensitive matching
                    const nameLower = name.toLowerCase();
                    API_REGISTRY.regionNameMap.set(nameLower, regionLower);
                });
            }
        });
    }
}

/**
 * Get all registered API providers
 * @returns {Array} Array of provider objects
 */
export function getAllProviders() {
    return [...API_REGISTRY.providers];
}

/**
 * Get providers that support a specific region
 * @param {string} region - Region code (e.g., 'us', 'eu')
 * @returns {Array} Array of provider objects supporting this region
 */
export function getProvidersByRegion(region) {
    const regionLower = region.toLowerCase();
    return API_REGISTRY.providers.filter(provider => provider.supportsRegion(regionLower));
}

/**
 * Get all available regions from registered providers
 * @returns {Array} Array of unique region codes
 */
export function getAvailableRegions() {
    return [...API_REGISTRY.regions];
}

/**
 * Get a map of all region names to their region codes
 * @returns {Map} Map where keys are region names (lowercase) and values are region codes
 */
export function getRegionNameMap() {
    return new Map(API_REGISTRY.regionNameMap);
}

/**
 * Find a provider by ID
 * @param {string} providerId - Provider ID to look for
 * @returns {Object|null} Provider object or null if not found
 */
export function getProviderById(providerId) {
    return API_REGISTRY.providers.find(p => p.id === providerId) || null;
}

/**
 * Get providers that support nowcast
 * @returns {Array} Array of provider objects supporting nowcast
 */
export function getNowcastProviders() {
    return API_REGISTRY.providers.filter(provider => provider.supportsNowcast());
}

/**
 * Detect region from location name using the registered region names
 * @param {string} locationName - Name of the location
 * @returns {Array} Array of potential region codes (always includes 'global')
 */
export function detectRegionsFromLocation(locationName) {
    const regions = new Set(['global']); // Always include global

    if (!locationName) return [...regions];

    const locationLower = locationName.toLowerCase();

    // Look for matches in our region name map
    for (const [regionName, regionCode] of API_REGISTRY.regionNameMap.entries()) {
        if (locationLower.includes(regionName)) {
            regions.add(regionCode);
        }
    }

    return [...regions];
}

/**
 * Get display name for a region code
 * @param {string} regionCode - Region code ('us', 'uk', etc.)
 * @returns {string} Human-readable name for the region
 */
export function getRegionDisplayName(regionCode) {
    // If it's global, just return "Global"
    if (regionCode === 'global') return 'Global';

    // Look through all providers to find one that includes this region
    for (const provider of API_REGISTRY.providers) {
        if (provider.regions && provider.regions.includes(regionCode) &&
            provider.regionNames && provider.regionNames.length > 0) {
            // Return the first region name (assumed to be the primary one)
            return provider.regionNames[0];
        }
    }

    // Fallback: Return uppercase region code if no name found
    return regionCode.toUpperCase();
}

/**
 * Check if a specific region has dedicated providers
 * @param {string} region - Region code (e.g., 'us', 'eu')
 * @returns {boolean} True if there are providers specific to this region
 */
export function hasRegionSpecificProviders(region) {
    const regionLower = region.toLowerCase();
    return API_REGISTRY.providers.some(provider =>
        provider.regions?.includes(regionLower) &&
        !provider.regions.includes('global') // Only providers that don't work globally
    );
}

//==============================================================================
// 3. PROVIDER REGISTRATION
//==============================================================================

// Register all available providers
registerApiProvider(
    openMeteoMetadata,
    fetchOpenMeteoWeather,
    fetchOpenMeteoNowcastOnly
);

registerApiProvider(
    pirateMetadata,
    fetchPirateWeather,
    fetchPirateWeatherNowcastOnly
);

//==============================================================================
// 4. WEATHER FETCHING FUNCTIONS
//==============================================================================

/**
 * Read and parse the cached location metadata from localStorage exactly once.
 * Returns an object with normalized fields, or {} if nothing usable is stored.
 */
function readLocationMetadata() {
    try {
        const raw = localStorage.getItem('weather_location_metadata');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return {
            countryCode: parsed?.countryCode?.toLowerCase() || null,
            state: parsed?.state || null,
            country: parsed?.country || null
        };
    } catch (e) {
        warn('Error retrieving location metadata:', e);
        return {};
    }
}

/**
 * Main fetch weather function - entry point for weather data retrieval
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude 
 * @param {string} locationName - Optional location name
 * @returns {Promise} Promise that resolves when weather is fetched and displayed
 */
export function fetchWeather(lat, lon, locationName) {
    // Reset the last update time whenever we fetch new weather data
    resetLastUpdateTime();

    // Show loading indicator
    showLoading();

    // Create a promise to wrap the entire operation
    return new Promise((resolve, reject) => {
        try {
            // Update UI components
            updateUIComponents(lat, lon);

            // Read location metadata once and reuse for both provider selection and alerts
            const locationMetadata = readLocationMetadata();

            // Select the most appropriate provider based on settings
            let selectedProviderId = selectProviderForLocation(locationMetadata);

            // Get nowcast source preference
            const nowcastProviderId = getNowcastSource();

            // Find the selected provider in our registry
            let selectedProvider = getProviderById(selectedProviderId);

            // If provider not found or requires API key we don't have, use open-meteo
            if (!selectedProvider || (selectedProvider.requiresApiKey && !selectedProvider.hasApiKey())) {
                selectedProvider = getProviderById('open-meteo');
            }

            // Fetch the weather data
            const weatherPromise = selectedProvider.fetchWeather(lat, lon, locationName, true);

            // Process the weather data
            processWeatherData(weatherPromise, nowcastProviderId, lat, lon, locationName, locationMetadata)
                .then(weatherData => {
                    // Display the weather data and resolve the promise
                    displayWeatherWithAlerts(weatherData, locationName);
                    hideLoading();
                    hideError();
                    resolve(weatherData);
                })
                .catch(error => {
                    console.error('Error fetching weather data:', error);
                    showError(error.message || 'Error fetching weather data. Please try again later.');
                    hideLoading();
                    reject(error);
                });

            // Notify modules of location changes and cache the location
            handleLocationUpdates(lat, lon, locationName);
        } catch (error) {
            console.error('Unexpected error in fetchWeather:', error);
            showError('An unexpected error occurred. Please try again later.');
            hideLoading();
            reject(error);
        }
    });
}

/**
 * Pick the right provider for the current location based on region preferences.
 * Takes pre-parsed metadata so we don't re-read localStorage in the same fetch.
 *
 * @param {{countryCode?: string|null, state?: string|null}} metadata
 */
function selectProviderForLocation(metadata) {
    const { countryCode } = metadata;
    let selectedProviderId = null;

    // If we successfully identified a country, check for region-specific provider
    if (countryCode) {
        const regionStorageKey = `weather_app_${countryCode}_weather_provider`;
        const regionProvider = localStorage.getItem(regionStorageKey);

        if (regionProvider && regionProvider !== 'automatic') {
            const providerObj = getProviderById(regionProvider);

            if (providerObj) {
                const supportsRegion = providerObj.regions?.includes(countryCode) ||
                    providerObj.regions?.includes('global');

                if (supportsRegion) {
                    selectedProviderId = regionProvider;
                } else {
                    warn(`Provider ${regionProvider} does not support region ${countryCode}, using global provider instead`);
                }
            } else {
                warn(`Provider ${regionProvider} not found in registry`);
            }
        }
    }

    // If we don't have a region-specific provider, use the global setting
    if (!selectedProviderId) {
        selectedProviderId = getWeatherProvider();

        // If global is automatic, use open-meteo
        if (selectedProviderId === 'automatic') {
            selectedProviderId = 'open-meteo';
        } else if (countryCode) {
            // Check if the selected global provider supports the region
            const globalProviderObj = getProviderById(selectedProviderId);
            if (globalProviderObj && globalProviderObj.regions) {
                const supportsRegion = globalProviderObj.regions.includes(countryCode) ||
                    globalProviderObj.regions.includes('global');

                if (!supportsRegion) {
                    warn(`Global provider ${selectedProviderId} doesn't support region ${countryCode}, using open-meteo instead`);
                    selectedProviderId = 'open-meteo';
                }
            }
        }
    }

    return selectedProviderId;
}

/**
 * Update UI components when fetching new weather data
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 */
function updateUIComponents(lat, lon) {
    try {
        // Update radar location if available
        if (typeof updateRadarLocation === 'function') {
            updateRadarLocation(lat, lon);
        }

        // Update astronomical information if available
        if (typeof updateAstroInfo === 'function') {
            updateAstroInfo(lat, lon);
        }
    } catch (error) {
        console.error('Error updating UI components:', error);
    }
}

/**
 * Process weather data and add nowcast if needed
 * @param {Promise} weatherPromise - Promise for the main weather data
 * @param {string} nowcastProviderId - Preferred nowcast provider ID
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Location name
 * @param {{countryCode?: string|null}} metadata - Pre-parsed location metadata
 * @returns {Promise} Promise for the complete weather data
 */
async function processWeatherData(weatherPromise, nowcastProviderId, lat, lon, locationName, metadata = {}) {
    try {
        // Wait for the main weather data
        const weatherData = await weatherPromise;

        const countryCode = metadata.countryCode || null;

        // Process alerts using the dedicated alerts system
        try {
            // Only import and use the alerts system if the weather data doesn't already have alerts
            // This allows API-specific alert handling to still work if needed
            if (!weatherData.alerts || !weatherData.alerts.length) {
                const { fetchAlerts } = await import('./api/alerts/alertsApi.js');
                const alerts = await fetchAlerts(lat, lon, { countryCode });

                if (alerts && Array.isArray(alerts)) {
                    weatherData.alerts = alerts;
                }
            }
        } catch (error) {
            warn('Error fetching alerts from alerts system:', error);
            // Continue without alerts if there's an error
        }

        // Always get nowcast data from the user's selected nowcast provider
        // regardless of which provider gave us the main weather data
        const nowcastProvider = getProviderById(nowcastProviderId);

        if (nowcastProvider) {
            // Only fetch nowcast if the provider supports it and has required API keys
            if (nowcastProvider.supportsNowcast &&
                (!nowcastProvider.requiresApiKey || nowcastProvider.hasApiKey())) {

                try {
                    // Check if the provider has a fetchNowcast method
                    if (typeof nowcastProvider.fetchNowcast === 'function') {
                        const nowcastData = await nowcastProvider.fetchNowcast(lat, lon, weatherData.timezone);

                        // If using Pirate Weather, also fetch Open-Meteo for extended forecast
                        // and merge the two datasets into a unified timeline
                        if (nowcastProviderId === 'pirate') {
                            const openMeteoProvider = getProviderById('open-meteo');
                            if (openMeteoProvider && typeof openMeteoProvider.fetchNowcast === 'function') {
                                try {
                                    const extendedData = await openMeteoProvider.fetchNowcast(lat, lon, weatherData.timezone);
                                    weatherData.nowcast = mergeNowcastData(nowcastData, extendedData);
                                } catch (extendedError) {
                                    warn('Failed to fetch extended forecast from Open-Meteo:', extendedError);
                                    // Use just Pirate Weather data if Open-Meteo fails
                                    weatherData.nowcast = nowcastData;
                                }
                            } else {
                                weatherData.nowcast = nowcastData;
                            }
                        } else {
                            weatherData.nowcast = nowcastData;
                        }

                        // Ensure the attribution is set correctly for the nowcast
                        if (weatherData.nowcast && !weatherData.nowcast.attribution) {
                            weatherData.nowcast.attribution = nowcastProvider.attribution || {
                                name: nowcastProvider.name,
                                url: nowcastProvider.apiKeyUrl || '#'
                            };
                        }
                    } else {
                        warn(`Provider ${nowcastProvider.name} doesn't have a fetchNowcast method`);
                    }
                } catch (error) {
                    console.error(`Failed to fetch nowcast from ${nowcastProvider.name}:`, error);
                    ensureDefaultNowcast(weatherData, nowcastProvider);
                }
            } else {
                ensureDefaultNowcast(weatherData, nowcastProvider);
            }
        } else {
            warn(`Nowcast provider ${nowcastProviderId} not found, using Open-Meteo as fallback`);
            const openMeteoProvider = getProviderById('open-meteo');
            if (openMeteoProvider && typeof openMeteoProvider.fetchNowcast === 'function') {
                try {
                    const nowcastData = await openMeteoProvider.fetchNowcast(lat, lon, weatherData.timezone);
                    weatherData.nowcast = nowcastData;
                } catch (err) {
                    console.error('Failed to fetch nowcast from Open-Meteo fallback:', err);
                    ensureDefaultNowcast(weatherData, openMeteoProvider);
                }
            } else {
                warn('Open-Meteo fallback not available for nowcast');
                ensureDefaultNowcast(weatherData);
            }
        }

        return weatherData;
    } catch (error) {
        console.error('Error processing weather data:', error);
        throw error;
    }
}

/**
 * Helper function to ensure the weather data has a proper nowcast section
 * @param {Object} weatherData - The weather data object to update
 * @param {Object} provider - The provider to use for attribution
 */
function ensureDefaultNowcast(weatherData, provider = null) {
    // If we already have a nowcast object, keep it
    if (!weatherData.nowcast || !weatherData.nowcast.available) {
        weatherData.nowcast = {
            available: false,
            source: provider ? provider.id : 'unknown',
            interval: 15,
            startTime: null,
            endTime: null,
            description: 'No precipitation forecast available',
            data: []
        };
    }

    // Ensure the attribution is set properly
    if (provider) {
        weatherData.nowcast.attribution = provider.attribution || {
            name: provider.name,
            url: provider.apiKeyUrl || '#'
        };
    } else {
        weatherData.nowcast.attribution = {
            name: 'Open-Meteo',
            url: 'https://open-meteo.com/',
            license: 'CC BY 4.0'
        };
    }
}

/**
 * Merge Pirate Weather's detailed 1-minute nowcast with Open-Meteo's extended 15-minute forecast
 * Creates a unified timeline with high resolution for the first hour and extended coverage for hours 1-5
 * 
 * @param {Object} pirateData - Pirate Weather nowcast data (1-minute intervals, ~60 minutes)
 * @param {Object} openMeteoData - Open-Meteo nowcast data (15-minute intervals, ~5 hours)
 * @returns {Object} - Merged nowcast data with transition point marked
 */
function mergeNowcastData(pirateData, openMeteoData) {
    // If Pirate Weather data is missing or empty, just use Open-Meteo
    if (!pirateData || !pirateData.data || pirateData.data.length === 0) {
        return openMeteoData;
    }

    // If Open-Meteo data is missing or empty, just use Pirate Weather
    if (!openMeteoData || !openMeteoData.data || openMeteoData.data.length === 0) {
        return pirateData;
    }

    // Get the end time of Pirate Weather data (approximately 1 hour from now)
    const pirateEndTime = pirateData.data[pirateData.data.length - 1].time;
    
    // Sample Pirate Weather data to reduce the number of bars while keeping detail
    // Take every 2nd point for the first 60 minutes (30 bars instead of 60)
    const sampledPirateData = [];
    for (let i = 0; i < pirateData.data.length; i += 2) {
        const point = { ...pirateData.data[i] };
        point.source = 'pirate'; // Mark the source
        sampledPirateData.push(point);
    }

    // Filter Open-Meteo data to only include points AFTER Pirate Weather ends
    // Add a small buffer (2 minutes) to avoid overlap
    const extendedData = openMeteoData.data
        .filter(point => point.time > pirateEndTime + 120)
        .map(point => ({
            ...point,
            source: 'open-meteo' // Mark the source
        }));

    // Find the transition point index (where we switch from Pirate to Open-Meteo)
    const transitionIndex = sampledPirateData.length;

    // Combine the datasets
    const mergedData = [...sampledPirateData, ...extendedData];

    // Create the merged nowcast object
    const mergedNowcast = {
        available: true,
        source: 'combined', // Indicate this is combined data
        sources: ['pirate', 'open-meteo'], // List of sources used
        interval: 'variable', // Variable intervals (1-min then 15-min)
        startTime: pirateData.startTime,
        endTime: extendedData.length > 0 
            ? extendedData[extendedData.length - 1].time 
            : pirateData.endTime,
        description: generateCombinedDescription(sampledPirateData, extendedData),
        transitionIndex: transitionIndex, // Mark where the transition occurs
        transitionTime: pirateEndTime, // Time when transition happens
        data: mergedData,
        // Combined attribution
        attribution: {
            name: 'Pirate Weather + Open-Meteo',
            sources: [
                { name: 'Pirate Weather', url: 'https://pirateweather.net/', range: 'Next hour (detailed)' },
                { name: 'Open-Meteo', url: 'https://open-meteo.com/', range: 'Extended forecast', license: 'CC BY 4.0' }
            ]
        }
    };

    return mergedNowcast;
}

/**
 * Generate a description for the combined nowcast data
 * @param {Array} pirateData - Sampled Pirate Weather data
 * @param {Array} extendedData - Extended Open-Meteo data
 * @returns {string} - Human-readable description
 */
function generateCombinedDescription(pirateData, extendedData) {
    // Check for precipitation in the detailed (first hour) data
    const hasPrecipNearTerm = pirateData.some(point => 
        point.precipIntensity > 0 && point.precipProbability > 0.2
    );
    
    // Check for precipitation in the extended data
    const hasPrecipExtended = extendedData.some(point => 
        point.precipProbability > 0.2
    );

    if (hasPrecipNearTerm) {
        // Find the first precipitation point
        const firstPrecip = pirateData.find(point => 
            point.precipIntensity > 0 && point.precipProbability > 0.2
        );
        
        if (firstPrecip) {
            const now = Date.now() / 1000;
            const timeDiff = Math.round((firstPrecip.time - now) / 60);
            const precipType = firstPrecip.precipType === 'snow' ? 'Snow' : 
                               firstPrecip.precipType === 'mix' ? 'Mixed precipitation' : 'Rain';
            
            if (timeDiff <= 0) {
                return `${precipType} occurring now`;
            } else if (timeDiff < 5) {
                return `${precipType} expected in the next few minutes`;
            } else {
                return `${precipType} expected in about ${timeDiff} minutes`;
            }
        }
    } else if (hasPrecipExtended) {
        // Find the first precipitation in extended data
        const firstExtendedPrecip = extendedData.find(point => point.precipProbability > 0.2);
        if (firstExtendedPrecip) {
            const now = Date.now() / 1000;
            const hoursDiff = Math.round((firstExtendedPrecip.time - now) / 3600);
            
            if (hoursDiff <= 1) {
                return 'Precipitation possible within the next hour';
            } else {
                return `Precipitation possible in about ${hoursDiff} hours`;
            }
        }
    }

    return 'No precipitation expected in the next few hours';
}

/**
 * Handle location updates and caching
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Location name
 */
function handleLocationUpdates(lat, lon, locationName) {
    try {
        // Notify the astro module of location changes
        if (typeof locationChanged === 'function') {
            locationChanged(lat, lon);
        }

        // Cache the location
        if (typeof saveLocationToCache === 'function') {
            saveLocationToCache(lat, lon, locationName);
        }
    } catch (error) {
        console.error('Error handling location updates:', error);
    }
}

//==============================================================================
// 5. ATTRIBUTION FUNCTIONS
//==============================================================================

/**
 * Set the API attribution text (kept for backward compatibility)
 * This function is kept for backward compatibility but now uses the attribution from the weather data
 * 
 * @param {string} source - The data source ('nws', 'open-meteo', or 'pirate')
 */
export function setApiAttribution(source) {
    // Compatibility wrapper. Actual attribution is set by each API implementation.
}