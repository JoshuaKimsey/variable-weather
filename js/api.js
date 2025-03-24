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

import { resetLastUpdateTime } from './utils/autoUpdate.js';
import { saveLocationToCache } from './utils/geo.js';
import { locationChanged } from './ui/components/astronomical.js';
import { showLoading, hideLoading, hideError, displayWeatherWithAlerts, showError } from './ui/core.js';
import { API_METADATA as nwsMetadata, fetchNWSWeather } from './api/nwsApi.js';
import { API_METADATA as openMeteoMetadata, fetchOpenMeteoWeather, fetchOpenMeteoNowcastOnly } from './api/openMeteoApi.js';
import { API_METADATA as pirateMetadata, fetchPirateWeather, fetchPirateWeatherNowcastOnly } from './api/pirateWeatherApi.js';
import { getNowcastSource, getWeatherProvider } from './ui/controls/settings.js';

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

    //   console.log(`Registered API provider: ${provider.name} (${provider.id})`);
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
    nwsMetadata,
    fetchNWSWeather,
    null // NWS doesn't support nowcast
);

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
 * Debug function to understand the current provider settings
 * Add this to your console to check what's stored
 */
function debugProviderSettings() {
    // Check global setting
    const globalProvider = localStorage.getItem('weather_app_weather_provider');
    // console.log('Global provider setting:', globalProvider);

    // Check US setting
    const usProvider = localStorage.getItem('weather_app_us_weather_provider');
    // console.log('US provider setting:', usProvider);

    // Check location metadata
    try {
        const metadata = JSON.parse(localStorage.getItem('weather_location_metadata'));
        // console.log('Location metadata:', metadata);
    } catch (e) {
        console.log('No valid location metadata found');
    }

    // Check all keys in localStorage for weather settings
    const relevantKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('weather_app') && key.includes('provider')) {
            relevantKeys.push({
                key: key,
                value: localStorage.getItem(key)
            });
        }
    }
    // console.log('All provider settings:', relevantKeys);

    // Check available providers
    if (window.getAllProviders) {
        // console.log('Available providers:', window.getAllProviders());
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

            // Select the most appropriate provider based on settings
            let selectedProviderId = selectProviderForLocation();

            // Get nowcast source preference
            const nowcastProviderId = getNowcastSource();

            // Find the selected provider in our registry
            let selectedProvider = getProviderById(selectedProviderId);

            // If provider not found or requires API key we don't have, use open-meteo
            if (!selectedProvider || (selectedProvider.requiresApiKey && !selectedProvider.hasApiKey())) {
                // console.log(`Selected provider ${selectedProviderId} unavailable, using open-meteo instead`);
                selectedProvider = getProviderById('open-meteo');
            }

            // console.log(`Using ${selectedProvider.name} for weather data at ${lat}, ${lon}`);

            // Fetch the weather data
            const weatherPromise = selectedProvider.fetchWeather(lat, lon, locationName, true);

            // Process the weather data
            processWeatherData(weatherPromise, nowcastProviderId, lat, lon, locationName)
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
 * Enhanced selectProviderForLocation that checks provider region compatibility
 */
function selectProviderForLocation() {
    let selectedProviderId = null;

    // Try to retrieve location metadata that was stored
    let countryCode = null;
    let state = null;

    try {
        const metadataString = localStorage.getItem('weather_location_metadata');
        // console.log('Raw location metadata:', metadataString);

        if (metadataString) {
            const metadata = JSON.parse(metadataString);
            countryCode = metadata.countryCode?.toLowerCase();
            state = metadata.state;
            // console.log('Parsed location metadata:', {
            //     countryCode: countryCode,
            //     state: state,
            //     raw: metadata
            // });
        } else {
            console.warn('No location metadata found in localStorage');
        }
    } catch (e) {
        console.warn('Error retrieving location metadata:', e);
    }

    // If we successfully identified a country, check for region-specific provider
    if (countryCode) {
        // console.log(`Detected country code: ${countryCode}`);

        // Get the region-specific provider setting
        const regionStorageKey = `weather_app_${countryCode}_weather_provider`;
        // console.log('Looking for region setting with key:', regionStorageKey);

        const regionProvider = localStorage.getItem(regionStorageKey);
        // console.log('Found region provider setting:', regionProvider);

        if (regionProvider && regionProvider !== 'automatic') {
            // Get the provider metadata to check if it actually supports this region
            const providerObj = getProviderById(regionProvider);

            if (providerObj) {
                // console.log('Provider object found:', providerObj.id);

                // Check if this provider actually supports this region
                const supportsRegion = providerObj.regions?.includes(countryCode) ||
                    providerObj.regions?.includes('global');

                // console.log(`Provider ${providerObj.id} supports region ${countryCode}: ${supportsRegion}`);

                if (supportsRegion) {
                    // console.log(`Using region-specific provider ${regionProvider} for ${countryCode}`);
                    selectedProviderId = regionProvider;
                } else {
                    console.warn(`Provider ${regionProvider} does not support region ${countryCode}, using global provider instead`);
                }
            } else {
                console.warn(`Provider ${regionProvider} not found in registry`);
            }
        } else {
            // console.log(`No valid region-specific provider found for ${countryCode}`);
        }
    } else {
        console.warn('No country code available for region-specific provider lookup');
    }

    // If we don't have a region-specific provider, use the global setting
    if (!selectedProviderId) {
        const globalProvider = getWeatherProvider();
        // console.log(`Using global provider setting: ${globalProvider}`);
        selectedProviderId = globalProvider;

        // If global is automatic, use open-meteo
        if (selectedProviderId === 'automatic') {
            selectedProviderId = 'open-meteo';
            // console.log(`Global set to automatic, using default: ${selectedProviderId}`);
        } else {
            // Check if the selected global provider supports the region
            if (countryCode) {
                const globalProviderObj = getProviderById(selectedProviderId);
                if (globalProviderObj && globalProviderObj.regions) {
                    const supportsRegion = globalProviderObj.regions.includes(countryCode) ||
                        globalProviderObj.regions.includes('global');

                    // console.log(`Global provider ${selectedProviderId} supports region ${countryCode}: ${supportsRegion}`);

                    if (!supportsRegion) {
                        console.warn(`Global provider ${selectedProviderId} doesn't support region ${countryCode}, using open-meteo instead`);
                        selectedProviderId = 'open-meteo';
                    }
                }
            }
        }
    }

    // console.log('Final provider selection:', selectedProviderId);
    // console.log('*** END PROVIDER SELECTION DEBUG ***');

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
 * @returns {Promise} Promise for the complete weather data
 */
async function processWeatherData(weatherPromise, nowcastProviderId, lat, lon, locationName) {
    try {
        // Wait for the main weather data
        const weatherData = await weatherPromise;
        // console.log('Main weather data received from:', weatherData.source);

        // Get the country code from the location metadata if available
        let countryCode = null;
        try {
            const metadataString = localStorage.getItem('weather_location_metadata');
            if (metadataString) {
                const metadata = JSON.parse(metadataString);
                countryCode = metadata.countryCode?.toLowerCase();
            }
        } catch (e) {
            console.warn('Error retrieving location metadata:', e);
        }

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
            console.warn('Error fetching alerts from alerts system:', error);
            // Continue without alerts if there's an error
        }

        // Always get nowcast data from the user's selected nowcast provider
        // regardless of which provider gave us the main weather data
        const nowcastProvider = getProviderById(nowcastProviderId);

        if (nowcastProvider) {
            // console.log(`Using ${nowcastProvider.name} for nowcast data`);

            // Only fetch nowcast if the provider supports it and has required API keys
            if (nowcastProvider.supportsNowcast &&
                (!nowcastProvider.requiresApiKey || nowcastProvider.hasApiKey())) {

                try {
                    // Check if the provider has a fetchNowcast method
                    if (typeof nowcastProvider.fetchNowcast === 'function') {
                        // console.log(`Fetching nowcast data from ${nowcastProvider.name}...`);
                        const nowcastData = await nowcastProvider.fetchNowcast(lat, lon, weatherData.timezone);

                        // Replace the existing nowcast data with the new data
                        weatherData.nowcast = nowcastData;
                        // console.log('Nowcast data added from:', nowcastProvider.name);

                        // Ensure the attribution is set correctly for the nowcast
                        if (weatherData.nowcast && !weatherData.nowcast.attribution) {
                            weatherData.nowcast.attribution = nowcastProvider.attribution || {
                                name: nowcastProvider.name,
                                url: nowcastProvider.apiKeyUrl || '#'
                            };
                        }
                    } else {
                        console.warn(`Provider ${nowcastProvider.name} doesn't have a fetchNowcast method`);
                    }
                } catch (error) {
                    console.error(`Failed to fetch nowcast from ${nowcastProvider.name}:`, error);
                    // Keep existing nowcast data if available, or set to a default state
                    ensureDefaultNowcast(weatherData, nowcastProvider);
                }
            } else {
                // console.log(`Provider ${nowcastProvider.name} either doesn't support nowcast or lacks required API key`);
                ensureDefaultNowcast(weatherData, nowcastProvider);
            }
        } else {
            console.warn(`Nowcast provider ${nowcastProviderId} not found, using Open-Meteo as fallback`);
            // Try to use Open-Meteo as fallback for nowcast
            const openMeteoProvider = getProviderById('open-meteo');
            if (openMeteoProvider && typeof openMeteoProvider.fetchNowcast === 'function') {
                try {
                    const nowcastData = await nowcastProvider.fetchNowcast(lat, lon, weatherData.timezone);
                    weatherData.nowcast = nowcastData;
                    // console.log('Nowcast data added from Open-Meteo (fallback)');
                } catch (err) {
                    console.error('Failed to fetch nowcast from Open-Meteo fallback:', err);
                    ensureDefaultNowcast(weatherData, openMeteoProvider);
                }
            } else {
                console.warn('Open-Meteo fallback not available for nowcast');
                ensureDefaultNowcast(weatherData);
            }
        }

        return weatherData;
    } catch (error) {
        console.error('Error processing weather data:', error);
        throw error; // Re-throw to be handled by the caller
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
    // This function is now just a compatibility wrapper
    // The actual attribution is set by each API implementation
    // console.log(`Attribution source: ${source} (handled by source API)`);
}