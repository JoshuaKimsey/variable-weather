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
    forecastContainer, stationInfoElement;

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
    stationInfoElement = document.getElementById('station-info');
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
    
    // Set up geolocation button
    const geoButton = document.getElementById('geo-button');
    if (geoButton) {
        geoButton.addEventListener('click', () => {
            // Call the getUserLocation function from the window object
            // This allows it to be defined in main.js but used here
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
 * Format observation time in a user-friendly way
 */
export function formatObservationTime(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return 'unknown time';
    }
    
    try {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 5) {
            return 'just now';
        } else if (diffMins < 60) {
            return `${diffMins} minutes ago`;
        } else if (diffMins < 120) {
            return '1 hour ago';
        } else if (diffMins < 1440) { // less than a day
            const hours = Math.floor(diffMins / 60);
            return `${hours} hours ago`;
        } else {
            // Format as date/time if more than a day
            return date.toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit' 
            });
        }
    } catch (error) {
        console.error('Error formatting observation time:', error);
        return 'unknown time';
    }
}

/**
 * Display weather data with all necessary error handling
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
        
        // Show weather data section
        weatherData.style.display = 'block';
        
        // Set API indicator (simplified to just show the data source)
        if (data.source === 'nws') {
            apiIndicator.innerHTML = 'Data provided by <a href="https://www.weather.gov/" target="_blank" class="attribution-link">National Weather Service</a>';
        } else {
            apiIndicator.innerHTML = 'Data provided by <a href="https://pirateweather.net/" target="_blank" class="attribution-link">Pirate Weather</a>';
        }
        apiIndicator.className = 'api-indicator';
        
        // Current conditions
        const current = data.currently;
        
        // Set location name
        if (locationName) {
            locationElement.textContent = formatLocationName(locationName);
        } else {
            locationElement.textContent = data.timezone ? data.timezone.replace('/', ', ').replace('_', ' ') : 'Unknown Location';
        }
        
        // Set date
        dateElement.textContent = formatDate(new Date());
        
        // Set temperature with unit formatting
        temperatureElement.textContent = formatTemperature(current.temperature);
        
        // Set weather description
        weatherDescriptionElement.textContent = current.summary || 'Weather conditions not available';
        
        // Format values properly with unit conversions
        windSpeedElement.textContent = formatWindSpeed(current.windSpeed || 0);
        humidityElement.textContent = current.humidity !== undefined ? `${Math.round(current.humidity * 100)}%` : 'N/A';
        pressureElement.textContent = formatPressure(current.pressure || 1015);
        visibilityElement.textContent = formatVisibility(current.visibility || 10);
        
        // Set weather icon
        setWeatherIcon(current.icon || 'cloudy', weatherIconElement);
        
        // Set background based on weather
        setWeatherBackground(current.icon || 'cloudy');
        
        // Update station info display if element exists
        updateStationInfo(data);
        
        // Process forecast data safely
        handleForecastDisplay(data);
        
        // Display alerts if available
        displayAlerts(data.alerts || []);
        
        // Update page title with location and temperature
        updatePageTitle(current.temperature, locationName ? formatLocationName(locationName) : (data.timezone ? data.timezone.replace('/', ', ').replace('_', ' ') : 'Unknown Location'));
        
        // Hide error message
        hideError();
    } catch (error) {
        console.error('Error displaying weather data:', error);
        showError('Error displaying weather data: ' + error.message);
    }
}

/**
 * Update the station info display
 */
function updateStationInfo(data) {
    if (!stationInfoElement) return;
    
    try {
        if (data.source === 'nws') {
            if (data.observation && data.observation.fromStation) {
                let stationInfo = '';
                
                // Add indication about weather description source
                if (data.observation.usingForecastDescription) {
                    stationInfo += '<span class="description-source forecast-description">Forecast conditions</span> • ';
                } else if (data.observation.descriptionAdjusted) {
                    stationInfo += '<span class="description-source">Observed conditions</span> • ';
                }
                
                if (data.observation.stationName) {
                    stationInfo += `<span class="station-name">${data.observation.stationName}</span>`;
                } else {
                    stationInfo += '<span class="station-name">NWS Station</span>';
                }
                
                if (data.observation.stationDistance !== null) {
                    const distanceInMiles = (data.observation.stationDistance * 0.621371).toFixed(1);
                    stationInfo += ` (${distanceInMiles} mi away)`;
                }
                
                if (data.observation.observationTime) {
                    const observationTime = new Date(data.observation.observationTime);
                    stationInfo += ` <span class="observation-time">observed ${formatObservationTime(observationTime)}</span>`;
                }
                
                stationInfoElement.innerHTML = stationInfo;
                stationInfoElement.style.display = 'inline-block';
                stationInfoElement.classList.remove('forecast-data');
            } else {
                stationInfoElement.innerHTML = 'Using forecast data (no station observations available)';
                stationInfoElement.style.display = 'inline-block';
                stationInfoElement.classList.add('forecast-data');
            }
        } else {
            // Hide for Pirate Weather data
            stationInfoElement.style.display = 'none';
        }
    } catch (error) {
        console.error('Error updating station info:', error);
        stationInfoElement.style.display = 'none';
    }
}

/**
 * Safely handle the forecast display with error checking
 */
function handleForecastDisplay(data) {
    try {
        // Make sure the forecast container exists
        if (!forecastContainer) {
            console.error('Forecast container not found in DOM');
            return;
        }
        
        // Clear previous forecast
        forecastContainer.innerHTML = '';
        
        // Get forecast data with proper fallbacks
        let forecastData = [];
        if (data.daily && Array.isArray(data.daily.data)) {
            forecastData = data.daily.data;
        } else if (data.daily && !Array.isArray(data.daily)) {
            forecastData = [data.daily]; // Convert single object to array
        } else if (Array.isArray(data.daily)) {
            forecastData = data.daily;
        }
        
        if (forecastData.length === 0) {
            forecastContainer.innerHTML = '<div class="no-forecast">No forecast data available</div>';
            return;
        }
        
        // Display forecast for 7 days or less if there's not enough data
        const days = Math.min(7, forecastData.length);
        
        for (let i = 0; i < days; i++) {
            const day = forecastData[i];
            if (!day) continue;
            
            const date = new Date((day.time || Date.now() / 1000 + i * 86400) * 1000);
            
            const forecastCard = document.createElement('div');
            forecastCard.className = 'forecast-card';
            
            // Day name (e.g., "Mon", "Tue")
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            
            // Get temperatures with fallbacks
            const highTemp = day.temperatureHigh !== undefined ? day.temperatureHigh : 
                             (day.temperature !== undefined ? day.temperature + 5 : 70);
            
            const lowTemp = day.temperatureLow !== undefined ? day.temperatureLow : 
                            (day.temperature !== undefined ? day.temperature - 5 : 50);
            
            // Format temperatures according to current units
            let tempDisplay;
            if (getDisplayUnits() === 'metric') {
                const highTempC = (highTemp - 32) * (5/9);
                const lowTempC = (lowTemp - 32) * (5/9);
                tempDisplay = `${Math.round(highTempC)}° / ${Math.round(lowTempC)}°`;
            } else {
                tempDisplay = `${Math.round(highTemp)}° / ${Math.round(lowTemp)}°`;
            }
            
            forecastCard.innerHTML = `
                <div class="day">${dayName}</div>
                <div class="forecast-icon" id="forecast-icon-${i}"></div>
                <div class="temp">${tempDisplay}</div>
            `;
            
            forecastContainer.appendChild(forecastCard);
            
            // Set forecast icon
            const forecastIconElement = document.getElementById(`forecast-icon-${i}`);
            if (forecastIconElement) {
                setForecastIcon(day.icon || 'cloudy', forecastIconElement);
            }
        }
    } catch (error) {
        console.error('Error displaying forecast:', error);
        forecastContainer.innerHTML = '<div class="forecast-error">Error displaying forecast</div>';
    }
}

/**
 * Get appropriate severity level based on alert information
 * @param {Object} alert - The alert object from NWS or Pirate Weather
 * @returns {string} - The severity level: 'extreme', 'severe', 'moderate', or 'minor'
 */
function getAlertSeverity(alert) {
    try {
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
    } catch (error) {
        console.error('Error determining alert severity:', error);
        return 'moderate'; // Default fallback
    }
}

/**
 * Display alerts with error handling
 */
function displayAlerts(alerts) {
    try {
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
    } catch (error) {
        console.error('Error displaying alerts:', error);
        alertsContainer.style.display = 'none';
    }
}

/**
 * Format alert text for better readability
 */
function formatAlertText(text) {
    if (!text) return '';
    
    try {
        // Replace * with bullet points
        text = text.replace(/\*/g, '•');
        
        // Replace double line breaks with paragraph breaks
        text = text.replace(/\n\n/g, '</p><p>');
        
        // Replace single line breaks with line breaks
        text = text.replace(/\n/g, '<br>');
        
        // Wrap the text in paragraphs
        text = `<p>${text}</p>`;
        
        return text;
    } catch (error) {
        console.error('Error formatting alert text:', error);
        return text; // Return original text if formatting fails
    }
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
    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (weatherData) weatherData.style.display = 'none';
    hideError();
}

/**
 * Hide loading indicator
 */
export function hideLoading() {
    if (loadingIndicator) loadingIndicator.style.display = 'none';
}

/**
 * Show error message
 */
export function showError(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
    hideLoading();
    if (weatherData) weatherData.style.display = 'none';
}

/**
 * Hide error message
 */
export function hideError() {
    if (errorMessage) errorMessage.style.display = 'none';
}