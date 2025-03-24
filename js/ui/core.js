/**
 * Core UI functionality for the weather application
 * 
 * This module manages basic UI initialization and event setup
 */

//==============================================================================
// 1. IMPORTS AND DEPENDENCIES
//==============================================================================

import { initCurrentWeather } from './components/currentWeather.js';
import { initForecasts } from './components/forecasts.js';
import { displayNowcast } from './components/nowcast.js';
import { initAlertsDisplay } from './components/alertsDisplay.js';
import { initSearchBar } from './controls/searchBar.js';
import { initLoading, showLoading, hideLoading } from './states/loading.js';
import { initErrors, showError, hideError } from './states/errors.js';

// DOM elements that are used across multiple components
let apiIndicator;

//==============================================================================
// 2. INITIALIZATION
//==============================================================================

/**
 * Initialize the UI components
 */
export function initUI() {
    // Initialize core UI elements
    apiIndicator = document.getElementById('api-indicator');
    
    // Initialize UI components
    initCurrentWeather();
    initForecasts();
    initAlertsDisplay();
    initLoading();
    initErrors();
    initSearchBar();
    
    // Initialize nowcast component if available
    if (typeof initNowcast === 'function') {
        initNowcast();
    }
}

/**
 * Set up event listeners
 */
export function setupEventListeners(searchCallback) {
    // Initialize UI first
    initUI();
    
    // Set up search functionality
    const searchButton = document.getElementById('search-button');
    const locationInput = document.getElementById('location-input');
    
    if (searchButton && locationInput) {
        searchButton.addEventListener('click', searchCallback);
        locationInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                searchCallback();
            }
        });
    }

    // Set up geolocation button
    const geoButton = document.getElementById('geo-button');
    if (geoButton) {
        geoButton.addEventListener('click', () => {
            if (typeof window.getUserLocation === 'function') {
                window.getUserLocation();
            } else {
                console.error('getUserLocation function not available');
                showError('Geolocation functionality is not available');
            }
        });
    }
}

/**
 * Update API attribution display based on weather data
 * @param {Object} data - Weather data with attribution information
 */
export function updateAttributionDisplay(data) {
    if (!apiIndicator) return;
    
    if (data && data.attribution && data.attribution.name) {
        let attributionText = `Data provided by <a href="${data.attribution.url}" target="_blank" class="attribution-link">${data.attribution.name}</a>`;
        
        // Add license info if available
        if (data.attribution.license) {
            attributionText += ` (${data.attribution.license})`;
        }
        
        apiIndicator.innerHTML = attributionText;
    } else {
        // Fallback if attribution is missing
        apiIndicator.innerHTML = 'Weather data provided by multiple services';
    }
}

/**
 * Apply scrollbar theme based on current weather condition
 * @param {string} weatherIcon - The current weather icon code
 */
export function applyScrollbarTheme(weatherIcon) {
    const forecastContainers = document.querySelectorAll('.hourly-forecast-container, .forecast-container');

    // Remove existing weather classes
    forecastContainers.forEach(container => {
        container.classList.remove('weather-sunny', 'weather-rainy', 'weather-cloudy', 'weather-snowy', 'weather-fog', 'weather-storm');
    });

    // Add appropriate class based on weather
    if (weatherIcon.includes('clear') || weatherIcon === 'clear-day' || weatherIcon === 'clear-night') {
        forecastContainers.forEach(container => container.classList.add('weather-sunny'));
    } else if (weatherIcon.includes('rain') || weatherIcon === 'rain') {
        forecastContainers.forEach(container => container.classList.add('weather-rainy'));
    } else if (weatherIcon.includes('cloud') || weatherIcon === 'cloudy' ||
        weatherIcon.includes('partly') || weatherIcon === 'partly-cloudy-day' ||
        weatherIcon === 'partly-cloudy-night') {
        forecastContainers.forEach(container => container.classList.add('weather-cloudy'));
    } else if (weatherIcon.includes('snow') || weatherIcon === 'snow') {
        forecastContainers.forEach(container => container.classList.add('weather-snowy'));
    } else if (weatherIcon.includes('fog') || weatherIcon === 'fog') {
        forecastContainers.forEach(container => container.classList.add('weather-fog'));
    } else if (weatherIcon.includes('thunder') || weatherIcon === 'thunderstorm') {
        forecastContainers.forEach(container => container.classList.add('weather-storm'));
    }
}

//==============================================================================
// 3. WEATHER DISPLAY FUNCTIONS
//==============================================================================

/**
 * Display weather data with alerts
 * @param {Object} data - Weather data object
 * @param {string} locationName - Location name
 */
export function displayWeatherWithAlerts(data, locationName) {
    // First display the weather data
    displayWeatherData(data, locationName);

    // Then, if the radar is initialized, update the alert polygons
    if (typeof updateAlertPolygons === 'function' && typeof isRadarViewInitialized === 'function') {
        if (isRadarViewInitialized()) {
            updateAlertPolygons(data.alerts || []);
        }
    }
}

/**
 * Display weather data
 * @param {Object} data - Weather data object
 * @param {string} locationName - Location name
 */
export function displayWeatherData(data, locationName) {
    try {
        // Make sure we have valid data
        if (!data || !data.currently) {
            console.error('Invalid weather data:', data);
            showError('Received invalid weather data. Please try again.');
            return;
        }

        // Cache the data for unit changes
        window.currentWeatherData = data;

        // Update API attribution
        updateAttributionDisplay(data);

        // Show weather data section
        document.getElementById('weather-data').style.display = 'block';

        // Update current weather display
        updateCurrentWeather(data, locationName);
        
        // Update forecasts
        handleForecastDisplay(data);
        handleHourlyForecastDisplay(data);

        // Apply scrollbar theme
        applyScrollbarTheme(data.currently.icon || 'cloudy');

        // Display nowcast data if available
        if (data.nowcast) {
            // console.log("Displaying nowcast data:", data.nowcast);
            displayNowcast(data.nowcast);
        } else {
            console.warn("No nowcast data available");
        }

        // Display alerts if available
        displayAlerts(data.alerts || []);

        // Hide error message
        hideError();

    } catch (error) {
        console.error('Error displaying weather data:', error);
        showError('Error displaying weather data: ' + error.message);
    }
}

// Export loading and error management functions
export { showLoading, hideLoading, showError, hideError };