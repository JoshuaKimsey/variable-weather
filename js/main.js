/**
 * Main entry point for the weather application
 */

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
import { updateURLParameters } from './utils.js';
import { initBackgrounds } from './weatherBackgrounds.js';
import { initApiSettings } from './apiSettings.js';
import { initUnits } from './units.js';

/**
 * Initialize the application
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

    // Check for location in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get('lat');
    const lon = urlParams.get('lon');
    const locationName = urlParams.get('location');

    if (lat && lon) {
        fetchWeather(lat, lon, locationName);
    } else {
        // Check if this is first load with no parameters
        if (localStorage.getItem('geolocation_enabled') === 'true') {
            // Try to get location automatically
            getUserLocation();
        } else if (localStorage.getItem('geolocation_enabled') !== 'false') {
            // Show a prompt for first-time users
            showGeolocationPrompt();
        } else {
            // Just load default location
            fetchWeather(DEFAULT_COORDINATES.lat, DEFAULT_COORDINATES.lon);
        }
    }
}

/**
 * Get the user's current location
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
    geoText.innerHTML = '<i class="fas fa-location-arrow"></i> Getting your location...';
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
            
            console.log(`Location found: ${lat}, ${lon}`);
            
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
 * Show a prompt asking if user wants to enable geolocation
 */
function showGeolocationPrompt() {
    // Create a prompt container
    const promptContainer = document.createElement('div');
    promptContainer.className = 'geo-prompt';
    promptContainer.innerHTML = `
        <div class="geo-prompt-content">
            <div class="geo-prompt-header">
                <i class="fas fa-location-arrow"></i>
                <h3>Enable Location Services?</h3>
            </div>
            <p>Would you like to see weather for your current location?</p>
            <div class="geo-prompt-buttons">
                <button id="geo-prompt-yes" class="geo-prompt-btn geo-prompt-yes">Yes, use my location</button>
                <button id="geo-prompt-no" class="geo-prompt-btn geo-prompt-no">No, use default</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(promptContainer);
    
    // Add event listeners
    document.getElementById('geo-prompt-yes').addEventListener('click', () => {
        localStorage.setItem('geolocation_enabled', 'true');
        promptContainer.remove();
        getUserLocation();
    });
    
    document.getElementById('geo-prompt-no').addEventListener('click', () => {
        localStorage.setItem('geolocation_enabled', 'false');
        promptContainer.remove();
        fetchWeather(DEFAULT_COORDINATES.lat, DEFAULT_COORDINATES.lon);
    });
}

/**
 * Search for location function
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

// Make getUserLocation available globally so it can be called from the UI
window.getUserLocation = getUserLocation;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);