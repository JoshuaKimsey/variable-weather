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
import { initAutoUpdate, startLastUpdatedTimer, resetLastUpdateTime } from './autoUpdate.js';
import {
    initUI,
    setupEventListeners,
    showLoading,
    showError,
    hideLoading,
    hideError
} from './ui.js';
import { 
    updateURLParameters,
    getCachedLocation,
    saveLocationToCache,
    hasLocationChangedSignificantly
} from './utils.js';
import { initBackgrounds } from './weatherBackgrounds.js';
import { initApiSettings } from './apiSettings.js';
import { initUnits } from './units.js';
import { initIconSettings } from './iconPerformance.js';
import { initModalController } from './modalRadarController.js';
import { initAstro, updateAstroInfo, refreshAstroDisplay } from './astronomicalView.js';

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

    // DO NOT initialize radar view on page load
    // We'll handle this from the modal now
    
    // Initialize astronomical display - with a longer delay to ensure it happens after other components
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

            // We'll no longer refresh radar data here since it's now modal-based
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

// Modify the determineInitialLocation function in main.js to remove the custom prompt

/**
 * Determine the initial location to display weather for
 * Checks URL parameters first, then cached location, then directly uses geolocation
 */
function determineInitialLocation() {
    // Check for location in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get('lat');
    const lon = urlParams.get('lon');
    const locationName = urlParams.get('location');

    if (lat && lon) {
        console.log('Using location from URL parameters');
        fetchWeather(lat, lon, locationName);
        return;
    }
    
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

//==============================================================================
// 3. LOCATION SERVICES
//==============================================================================

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
 * Reverse geocode coordinates to get a location name
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<string>} - Promise that resolves to location name
 */
function reverseGeocode(lat, lon) {
    return new Promise((resolve, reject) => {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`;

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to get location name');
                }
                return response.json();
            })
            .then(data => {
                if (data && data.display_name) {
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
// 4. USER INTERFACE INTERACTIONS
//==============================================================================

/**
 * Search for location function
 * Handles the location search input and geocodes it to coordinates
 */
function searchLocation() {
    const locationInput = document.getElementById('location-input');
    const location = locationInput.value.trim();

    if (location === '') {
        showError('Please enter a location');
        return;
    }

    // Show loading
    showLoading();

    // Use OpenStreetMap Nominatim API for geocoding
    const geocodingUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;

    fetch(geocodingUrl)
        .then(response => response.json())
        .then(data => {
            if (data.length === 0) {
                showError('Location not found. Please try a different search term.');
                return;
            }

            const { lat, lon, display_name } = data[0];

            // Update URL with new coordinates and location name
            updateURLParameters(lat, lon, display_name);

            // Fetch weather for the location
            fetchWeather(lat, lon, display_name);
        })
        .catch(error => {
            console.error('Error searching location:', error);
            showError('Error searching for location. Please try again later.');
        });
}

//==============================================================================
// 5. GLOBAL EXPORTS AND INITIALIZATION
//==============================================================================

// Make getUserLocation available globally so it can be called from the UI
window.getUserLocation = getUserLocation;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);