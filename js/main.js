/**
 * Main entry point for the weather application
 * 
 * This module coordinates the application's initialization and handles
 * user interactions for location detection and search functionality.
 */

//==============================================================================
// 1. IMPORTS AND DEPENDENCIES
//==============================================================================

import { DEFAULT_COORDINATES } from './config.js';
import { fetchWeather } from './api.js';
import { initAutoUpdate, startLastUpdatedTimer, resetLastUpdateTime } from './utils/autoUpdate.js';
import {
    initUI,
    setupEventListeners,
    showLoading,
    showError,
    hideLoading,
    hideError
} from './ui/core.js';
import {
    updateURLParameters,
    getCachedLocation,
    saveLocationToCache,
    hasLocationChangedSignificantly
} from './utils/geo.js';
import { initBackgrounds } from './ui/visuals/dynamicBackgrounds.js';
import { initApiSettings } from './ui/controls/settings.js';
import { initUnits } from './utils/units.js';
import { initIconSettings } from './ui/visuals/iconPerformance.js';
import { initModalController } from './ui/components/radar.js';
import { initAstro, updateAstroInfo, refreshAstroDisplay } from './ui/components/astronomical.js';
import { searchLocation } from './ui/controls/searchBar.js';

//==============================================================================
// 2. APPLICATION INITIALIZATION
//==============================================================================

/**
 * Initialize the application
 * Entry point that sets up all components and checks for initial location
 */
function initApp() {
    // Initialize UI components first
    initUI();

    // Initialize weather backgrounds
    initBackgrounds('weather-background');

    // Initialize units system first (so window.setDisplayUnits is available)
    initUnits();

    // Then initialize API settings that might use the units system
    initApiSettings();

    // Initialize icon settings and performance detection
    initIconSettings();

    // Initialize astronomical display with a longer delay
    setTimeout(() => {
        initAstro('astro-view');

        // Force refresh the astro display after initialization
        const urlParams = new URLSearchParams(window.location.search);
        const lat = urlParams.get('lat');
        const lon = urlParams.get('lon');

        if (lat && lon) {
            // Small additional delay to ensure initialization is complete
            setTimeout(() => {
                updateAstroInfo(parseFloat(lat), parseFloat(lon));
            }, 100);
        }
    }, 200); // Longer delay to ensure other components are loaded first

    // Set up event listeners
    setupEventListeners(searchLocation);

    // Initialize auto-update functionality
    initAutoUpdate(() => {
        // Re-fetch weather using the last known coordinates
        const urlParams = new URLSearchParams(window.location.search);
        const lat = urlParams.get('lat');
        const lon = urlParams.get('lon');
        const locationName = urlParams.get('location');

        if (lat && lon) {
            fetchWeather(lat, lon, locationName);
        } else {
            fetchWeather(DEFAULT_COORDINATES.lat, DEFAULT_COORDINATES.lon);
        }
    });

    // Start the timer to update the "Last Updated" text
    startLastUpdatedTimer();

    // Check for initial location source
    determineInitialLocation();

    // Initialize the modal controller
    initModalController();
}

//==============================================================================
// 3. LOCATION SERVICES
//==============================================================================

/**
 * Modified determineInitialLocation function that ensures location metadata is always retrieved
 * Replace the existing function in main.js
 */
function determineInitialLocation() {
    // Check for location in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get('lat');
    const lon = urlParams.get('lon');
    const locationName = urlParams.get('location');

    if (lat && lon) {
        console.log('Using location from URL parameters');

        // Even if we have URL params, we need to fetch location metadata for API selection
        // We'll do this in the background so the UI remains responsive
        fetchLocationMetadata(lat, lon).then(() => {
            console.log('Location metadata updated in background');
        }).catch(error => {
            console.warn('Failed to update location metadata:', error);
        });

        fetchWeather(lat, lon, locationName);
        return;
    }

    // Rest of the function remains unchanged
    // Check for cached location
    const cachedLocation = getCachedLocation();

    if (cachedLocation) {
        console.log('Using cached location from localStorage');
        // Use cached location data immediately
        fetchWeather(cachedLocation.lat, cachedLocation.lon, cachedLocation.locationName);

        // Update URL with cached location
        updateURLParameters(cachedLocation.lat, cachedLocation.lon, cachedLocation.locationName);

        // Check if we should get current location in the background
        const cacheAge = Date.now() - cachedLocation.timestamp;
        const cacheAgeHours = cacheAge / (1000 * 60 * 60);

        // If cache is older than 2 hours, check for location changes
        if (cacheAgeHours > 2) {
            // Get current location in the background
            checkLocationChange();
        }
    } else {
        console.log('No cached location found');
        // Check if user has explicitly disabled geolocation
        const geoEnabled = localStorage.getItem('geolocation_enabled');

        if (geoEnabled === 'false') {
            // User has explicitly opted out of geolocation
            console.log('Geolocation disabled, using default location');
            fetchWeather(DEFAULT_COORDINATES.lat, DEFAULT_COORDINATES.lon);
        } else {
            // First time user or geolocation is enabled - directly try geolocation
            console.log('Attempting to get user location');
            getUserLocation();
        }
    }
}

/**
 * Fetch location metadata from coordinates without updating the UI
 * This function will be added to main.js
 */
function fetchLocationMetadata(lat, lon) {
    return new Promise((resolve, reject) => {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to get location metadata');
                }
                return response.json();
            })
            .then(data => {
                if (data && data.address) {
                    // Store the location data for provider selection
                    try {
                        // Save countryCode and other relevant data to localStorage
                        const locationMetadata = {
                            countryCode: data.address?.country_code || null,
                            country: data.address?.country || null,
                            state: data.address?.state || null,
                            timestamp: Date.now()
                        };

                        // Save the location data
                        localStorage.setItem('weather_location_metadata', JSON.stringify(locationMetadata));
                        // console.log('Stored location metadata:', locationMetadata);
                        resolve(locationMetadata);
                    } catch (e) {
                        console.warn('Error storing location metadata:', e);
                        reject(e);
                    }
                } else {
                    const error = new Error('No valid location data found');
                    console.warn(error);
                    reject(error);
                }
            })
            .catch(error => {
                console.error('Error fetching location metadata:', error);
                reject(error);
            });
    });
}

/**
 * Get the user's current location
 * Uses browser's geolocation API with appropriate error handling
 */
function getUserLocation() {
    // First check if geolocation is available in the browser
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        return;
    }

    // Show loading indicator
    showLoading();

    // Add a special message for geolocation
    const loadingElement = document.getElementById('loading');
    const geoText = document.createElement('div');
    geoText.className = 'geo-loading-text';
    geoText.innerHTML = '<i class="bi bi-geo-alt-fill"></i> Getting your location...';
    loadingElement.appendChild(geoText);

    // Options for geolocation request
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    // Request the user's current position
    navigator.geolocation.getCurrentPosition(
        // Success callback
        (position) => {
            // Remove special geolocation message
            if (geoText.parentNode) {
                geoText.parentNode.removeChild(geoText);
            }

            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // Remember that user enabled geolocation
            localStorage.setItem('geolocation_enabled', 'true');

            // Get location name using reverse geocoding
            reverseGeocode(lat, lon)
                .then(locationName => {
                    // Update URL with new coordinates and location name
                    updateURLParameters(lat, lon, locationName);

                    // Fetch weather for the location
                    fetchWeather(lat, lon, locationName);
                })
                .catch(error => {
                    console.error('Error getting location name:', error);

                    // Still try to get location metadata even if display name fails
                    fetchLocationMetadata(lat, lon).catch(e => {
                        console.warn('Also failed to get location metadata:', e);
                    });

                    // Even without a location name, we can still get weather
                    updateURLParameters(lat, lon);
                    fetchWeather(lat, lon);
                });
        },
        // Error callback
        (error) => {
            // Remove special geolocation message
            if (geoText.parentNode) {
                geoText.parentNode.removeChild(geoText);
            }

            hideLoading();

            let errorMsg = '';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg = 'Location access denied. Please allow location access in your browser settings or enter a location manually.';
                    localStorage.setItem('geolocation_enabled', 'false'); // Remember that user denied permission
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg = 'Location information is unavailable. Please enter a location manually.';
                    break;
                case error.TIMEOUT:
                    errorMsg = 'Location request timed out. Please try again or enter a location manually.';
                    break;
                default:
                    errorMsg = 'An unknown error occurred while getting your location. Please enter a location manually.';
                    break;
            }

            showError(errorMsg);

            // Fall back to default location after a short delay
            setTimeout(() => {
                fetchWeather(DEFAULT_COORDINATES.lat, DEFAULT_COORDINATES.lon);
            }, 2000);
        },
        // Options
        options
    );
}

/**
 * Modify the existing reverseGeocode function to store structured data
 * This should be placed in main.js to replace the existing reverseGeocode function
 */
function reverseGeocode(lat, lon) {
    return new Promise((resolve, reject) => {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to get location name');
                }
                return response.json();
            })
            .then(data => {
                if (data && data.display_name) {
                    // Store the location data for provider selection
                    try {
                        // Save countryCode and other relevant data to localStorage
                        const locationMetadata = {
                            countryCode: data.address?.country_code || null,
                            country: data.address?.country || null,
                            state: data.address?.state || null,
                            timestamp: Date.now()
                        };

                        // Save with the location data
                        localStorage.setItem('weather_location_metadata', JSON.stringify(locationMetadata));
                        console.log('Stored location metadata:', locationMetadata);
                    } catch (e) {
                        console.warn('Error storing location metadata:', e);
                    }

                    resolve(data.display_name);
                } else {
                    throw new Error('No location name found');
                }
            })
            .catch(error => {
                console.error('Reverse geocoding error:', error);
                reject(error);
            });
    });
}

/**
 * Check if the user's location has changed significantly
 * If it has, update the weather for the new location
 */
function checkLocationChange() {
    // Get cached location
    const cachedLocation = getCachedLocation();
    if (!cachedLocation) return;

    // Check current location in the background without showing UI indicators
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            // Success callback
            (position) => {
                const currentLat = position.coords.latitude;
                const currentLon = position.coords.longitude;

                // Check if location has changed significantly
                if (hasLocationChangedSignificantly(
                    currentLat, currentLon,
                    cachedLocation.lat, cachedLocation.lon
                )) {
                    console.log('Location has changed significantly, updating weather');

                    // Get location name using reverse geocoding
                    reverseGeocode(currentLat, currentLon)
                        .then(locationName => {
                            // Update URL and fetch new weather
                            updateURLParameters(currentLat, currentLon, locationName);
                            fetchWeather(currentLat, currentLon, locationName);

                            // Update the cache
                            saveLocationToCache(currentLat, currentLon, locationName);
                        })
                        .catch(error => {
                            console.error('Error getting location name:', error);
                            // Even without a location name, we can still update
                            updateURLParameters(currentLat, currentLon);
                            fetchWeather(currentLat, currentLon);

                            // Update the cache
                            saveLocationToCache(currentLat, currentLon);
                        });
                } else {
                    console.log('Location has not changed significantly');
                }
            },
            // Error callback - silent fail, just keep using cached location
            (error) => {
                console.log('Unable to get current location, using cached location');
            },
            // Options - quick timeout for background check
            {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 60000
            }
        );
    }
}

//==============================================================================
// 5. GLOBAL EXPORTS AND INITIALIZATION
//==============================================================================

// Make getUserLocation available globally so it can be called from the UI
window.getUserLocation = getUserLocation;

// Make fetchWeather available globally for other modules
window.fetchWeather = fetchWeather;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);