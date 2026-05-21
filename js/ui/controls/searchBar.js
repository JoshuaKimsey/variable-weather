/**
 * Search Bar Component
 * 
 * Handles location search functionality
 */

//==============================================================================
// 1. IMPORTS
//==============================================================================

import { showLoading } from '../states/loading.js';

//==============================================================================
// 2. DOM REFERENCES
//==============================================================================

// DOM elements
let locationInput, searchButton, geoButton;

//==============================================================================
// 3. INITIALIZATION
//==============================================================================

/**
 * Initialize the search bar component
 */
export function initSearchBar() {
    // Get DOM elements
    locationInput = document.getElementById('location-input');
    searchButton = document.getElementById('search-button');
    geoButton = document.getElementById('geo-button');
}

//==============================================================================
// 4. SEARCH FUNCTIONS
//==============================================================================

/**
 * Search for location and fetch weather
 * This is the main function called when the search button is clicked
 */
export function searchLocation() {
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

            // Update URL with new coordinates (name stays out of URL)
            updateURLParameters(lat, lon);

            // Fetch weather for the location
            if (typeof window.fetchWeather === 'function') {
                window.fetchWeather(lat, lon, display_name);
            } else {
                console.error('fetchWeather function not available');
                showError('Weather data service unavailable');
            }
        })
        .catch(error => {
            console.error('Error searching location:', error);
            showError('Error searching for location. Please try again later.');
        });
}

//==============================================================================
// 5. HELPER FUNCTIONS
//==============================================================================

/**
 * Update URL parameters with lat/lon. See geo.js for the canonical version;
 * this duplicate exists because searchBar.js is loaded before the geo module
 * is initialized in the import graph and historically kept its own copy.
 *
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 */
function updateURLParameters(lat, lon) {
    const url = new URL(window.location);
    url.searchParams.set('lat', lat);
    url.searchParams.set('lon', lon);
    url.searchParams.delete('location');
    window.history.pushState({}, '', url);

    window.dispatchEvent(new CustomEvent('location-changed', { detail: { lat, lon } }));
}

// Make searchLocation available globally
window.searchLocation = searchLocation;