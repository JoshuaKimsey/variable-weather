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
    showError
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
        // Use default coordinates for New York City
        fetchWeather(DEFAULT_COORDINATES.lat, DEFAULT_COORDINATES.lon);
    }
}

// Search for location function
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

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);