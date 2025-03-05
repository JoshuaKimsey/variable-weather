/**
 * UI-related functions for the weather application
 */

import { setWeatherIcon, setForecastIcon } from './weatherIcons.js';
import { setWeatherBackground } from './weatherBackgrounds.js';
import { formatDate, formatLocationName, updatePageTitle } from './utils.js';
import { getDisplayUnits, formatTemperature, formatWindSpeed, formatPressure, formatVisibility } from './units.js';

// DOM elements
let locationInput, searchButton, weatherData, loadingIndicator, errorMessage, 
    apiIndicator, alertsContainer, locationElement, dateElement, 
    temperatureElement, weatherDescriptionElement, weatherIconElement,
    windSpeedElement, humidityElement, pressureElement, visibilityElement, 
    forecastContainer;

/**
 * Initialize UI elements
 */
export function initUI() {
    // Get all DOM elements
    locationInput = document.getElementById('location-input');
    searchButton = document.getElementById('search-button');
    weatherData = document.getElementById('weather-data');
    loadingIndicator = document.getElementById('loading');
    errorMessage = document.getElementById('error-message');
    apiIndicator = document.getElementById('api-indicator');
    alertsContainer = document.getElementById('alerts-container');
    locationElement = document.getElementById('location');
    dateElement = document.getElementById('date');
    temperatureElement = document.getElementById('temperature');
    weatherDescriptionElement = document.getElementById('weather-description');
    weatherIconElement = document.getElementById('weather-icon');
    windSpeedElement = document.getElementById('wind-speed');
    humidityElement = document.getElementById('humidity');
    pressureElement = document.getElementById('pressure');
    visibilityElement = document.getElementById('visibility');
    forecastContainer = document.getElementById('forecast-container');
}

/**
 * Set up event listeners
 */
export function setupEventListeners(searchCallback) {
    // Initialize UI first
    initUI();
    
    // Set up search functionality
    searchButton.addEventListener('click', searchCallback);
    locationInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            searchCallback();
        }
    });
}

/**
 * Update the displayWeatherData function to properly format values with unit conversions
 */
export function displayWeatherData(data, locationName) {
    // Cache the data for unit changes
    window.currentWeatherData = data;
    
    // Show weather data section
    weatherData.style.display = 'block';
    
    // Set API indicator
    if (data.source === 'nws') {
        apiIndicator.textContent = 'Data provided by National Weather Service';
        apiIndicator.className = 'api-indicator';
    } else {
        apiIndicator.textContent = 'Data provided by Pirate Weather';
        apiIndicator.className = 'api-indicator';
    }
    
    // Current conditions
    const current = data.currently;
    const daily = data.daily;
    
    // Set location name
    if (locationName) {
        locationElement.textContent = formatLocationName(locationName);
    } else {
        locationElement.textContent = data.timezone.replace('/', ', ').replace('_', ' ');
    }
    
    // Set date
    dateElement.textContent = formatDate(new Date());
    
    // Set temperature with unit formatting
    temperatureElement.textContent = formatTemperature(current.temperature);
    
    // Set weather description
    weatherDescriptionElement.textContent = current.summary;
    
    // Format values properly with unit conversions
    windSpeedElement.textContent = formatWindSpeed(current.windSpeed || 0);
    humidityElement.textContent = current.humidity ? `${Math.round(current.humidity * 100)}%` : 'N/A';
    pressureElement.textContent = formatPressure(current.pressure || 1015);
    visibilityElement.textContent = formatVisibility(current.visibility || 10);
    
    // Set weather icon
    setWeatherIcon(current.icon, weatherIconElement);
    
    // Set background based on weather
    setWeatherBackground(current.icon);
    
    // Display forecast
    displayForecast(daily.data);
    
    // Display alerts if available
    displayAlerts(data.alerts);
    
    // Update page title with location and temperature
    updatePageTitle(current.temperature, locationName ? formatLocationName(locationName) : data.timezone.replace('/', ', ').replace('_', ' '));
}

/**
 * Display weather forecast with proper unit formatting
 */
function displayForecast(forecastData) {
    // Clear previous forecast
    forecastContainer.innerHTML = '';
    
    // Display forecast for 7 days or less if there's not enough data
    const days = Math.min(7, forecastData.length);
    
    for (let i = 0; i < days; i++) {
        const day = forecastData[i];
        const date = new Date(day.time * 1000);
        
        const forecastCard = document.createElement('div');
        forecastCard.className = 'forecast-card';
        
        // Day name (e.g., "Mon", "Tue")
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        
        // Format temperatures according to current units
        let tempDisplay;
        if (getDisplayUnits() === 'metric') {
            const highTempC = (day.temperatureHigh - 32) * (5/9);
            const lowTempC = (day.temperatureLow - 32) * (5/9);
            tempDisplay = `${Math.round(highTempC)}° / ${Math.round(lowTempC)}°`;
        } else {
            tempDisplay = `${Math.round(day.temperatureHigh)}° / ${Math.round(day.temperatureLow)}°`;
        }
        
        forecastCard.innerHTML = `
            <div class="day">${dayName}</div>
            <div class="forecast-icon" id="forecast-icon-${i}"></div>
            <div class="temp">${tempDisplay}</div>
        `;
        
        forecastContainer.appendChild(forecastCard);
        
        // Set forecast icon
        const forecastIconElement = document.getElementById(`forecast-icon-${i}`);
        setForecastIcon(day.icon, forecastIconElement);
    }
}

/**
 * Get appropriate severity level based on alert information
 * @param {Object} alert - The alert object from NWS or Pirate Weather
 * @returns {string} - The severity level: 'extreme', 'severe', 'moderate', or 'minor'
 */
function getAlertSeverity(alert) {
    // First check if the API provides a severity level directly
    if (alert.properties && alert.properties.severity) {
        const apiSeverity = alert.properties.severity.toLowerCase();
        
        // If the API says it's extreme or severe, trust it
        if (apiSeverity === 'extreme' || apiSeverity === 'severe') {
            return apiSeverity;
        }
        
        // For other API-provided severities, we'll still check against our event mapping
        // because sometimes the API severity doesn't match the practical impact
    }
    
    // Extract the alert title/event for mapping
    let alertTitle = '';
    if (alert.properties && alert.properties.event) {
        alertTitle = alert.properties.event;
    } else if (alert.title) {
        alertTitle = alert.title;
    }
    
    // Convert to lowercase for case-insensitive matching
    const lowerTitle = alertTitle.toLowerCase();
    
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
        return 'extreme';
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
        return 'severe';
    }
    
    // Moderate threats - possible threat to life or property
    if (
        lowerTitle.includes('flood warning') ||
        lowerTitle.includes('thunderstorm watch') ||
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
        return 'moderate';
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
        return 'minor';
    }
    
    // If we get to this point, it's not matched any of our specific patterns
    // Check for some general indicators
    if (lowerTitle.includes('warning')) {
        return 'severe';  // Any unspecified warning is treated as severe
    }
    
    if (lowerTitle.includes('watch')) {
        return 'moderate';  // Any unspecified watch is treated as moderate
    }
    
    if (lowerTitle.includes('advisory') || lowerTitle.includes('statement')) {
        return 'minor';  // Any unspecified advisory is treated as minor
    }
    
    // Default fallback
    return 'moderate';
}

/**
 * Update the displayAlerts function to use our new severity mapping
 */
function displayAlerts(alerts) {
    // Clear previous alerts
    alertsContainer.innerHTML = '';
    
    // Check if alerts exist and are in an array
    if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
        alertsContainer.style.display = 'none';
        return;
    }
    
    // Define severity order for sorting (lower number = higher priority)
    const severityOrder = {
        'extreme': 1,
        'severe': 2,
        'moderate': 3,
        'minor': 4
    };
    
    // Sort alerts by severity (extreme first, then severe, etc.)
    const sortedAlerts = [...alerts].sort((a, b) => {
        const severityA = getAlertSeverity(a);
        const severityB = getAlertSeverity(b);
        
        return severityOrder[severityA] - severityOrder[severityB];
    });
    
    // Process and display each alert
    sortedAlerts.forEach((alert, index) => {
        let alertTitle = '';
        let alertDescription = '';
        let fullDescription = '';
        let urgency = '';
        let expires = '';
        
        if (alert.properties) {
            // NWS alert format
            alertTitle = alert.properties.event || 'Weather Alert';
            alertDescription = alert.properties.headline || '';
            fullDescription = alert.properties.description || '';
            urgency = alert.properties.urgency || '';
            
            // Format expiration time if available
            if (alert.properties.expires) {
                const expiresDate = new Date(alert.properties.expires);
                expires = expiresDate.toLocaleString();
            }
        } else if (alert.title) {
            // Pirate Weather alert format
            alertTitle = alert.title;
            alertDescription = alert.description?.substring(0, 100) + '...' || '';
            fullDescription = alert.description || '';
        }
        
        // Get severity class using our mapping function
        const severity = getAlertSeverity(alert);
        const severityClass = `alert-${severity}`;
        
        // Create alert element
        const alertElement = document.createElement('div');
        alertElement.className = `alert-item ${severityClass}`;
        alertElement.id = `alert-${index}`;
        
        // Create the collapsed view (shown by default)
        alertElement.innerHTML = `
            <div class="alert-header">
                <div class="alert-title-row">
                    <span class="alert-severity ${severityClass}">${capitalizeFirst(severity)}</span>
                    <h3 class="alert-title">${alertTitle}</h3>
                    <button class="alert-expand-btn" aria-label="Expand alert details">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
                <div class="alert-subtitle">${alertDescription}</div>
            </div>
            <div class="alert-content" style="display: none;">
                <div class="alert-metadata">
                    ${urgency ? `<div class="alert-urgency">Urgency: ${urgency}</div>` : ''}
                    ${expires ? `<div class="alert-expires">Expires: ${expires}</div>` : ''}
                </div>
                <div class="alert-full-description">${formatAlertText(fullDescription)}</div>
            </div>
        `;
        
        alertsContainer.appendChild(alertElement);
        
        // Add click event to the alert to toggle expansion
        const expandBtn = alertElement.querySelector('.alert-expand-btn');
        const alertContent = alertElement.querySelector('.alert-content');
        
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent the alert click event from firing
            
            const isExpanded = alertContent.style.display !== 'none';
            
            // Toggle the content visibility
            alertContent.style.display = isExpanded ? 'none' : 'block';
            
            // Toggle the icon
            expandBtn.innerHTML = isExpanded 
                ? '<i class="fas fa-chevron-down"></i>' 
                : '<i class="fas fa-chevron-up"></i>';
                
            // Add or remove expanded class
            alertElement.classList.toggle('alert-expanded', !isExpanded);
        });
        
        // Make the whole alert clickable for better mobile UX
        alertElement.addEventListener('click', () => {
            expandBtn.click();
        });
    });
    
    // Show alerts container
    alertsContainer.style.display = 'block';
}

/**
 * Get CSS class based on alert severity
 */
function getSeverityClass(severity) {
    switch(severity.toLowerCase()) {
        case 'extreme':
            return 'alert-extreme';
        case 'severe':
            return 'alert-severe';
        case 'moderate':
            return 'alert-moderate';
        case 'minor':
            return 'alert-minor';
        default:
            return 'alert-moderate';
    }
}

/**
 * Format alert text for better readability
 */
function formatAlertText(text) {
    if (!text) return '';
    
    // Replace * with bullet points
    text = text.replace(/\*/g, '•');
    
    // Replace double line breaks with paragraph breaks
    text = text.replace(/\n\n/g, '</p><p>');
    
    // Replace single line breaks with line breaks
    text = text.replace(/\n/g, '<br>');
    
    // Wrap the text in paragraphs
    text = `<p>${text}</p>`;
    
    return text;
}

/**
 * Capitalize first letter of a string
 */
function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Show loading indicator
 */
export function showLoading() {
    loadingIndicator.style.display = 'flex';
    weatherData.style.display = 'none';
    hideError();
}

/**
 * Hide loading indicator
 */
export function hideLoading() {
    loadingIndicator.style.display = 'none';
}

/**
 * Show error message
 */
export function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    hideLoading();
    weatherData.style.display = 'none';
}

/**
 * Hide error message
 */
export function hideError() {
    errorMessage.style.display = 'none';
}