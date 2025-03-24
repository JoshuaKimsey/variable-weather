/**
 * Forecasts Component
 * 
 * Handles display of daily and hourly forecasts
 */

//==============================================================================
// 1. IMPORTS
//==============================================================================

import { getDisplayUnits, formatTemperature } from '../../utils/units.js';
import { setForecastIcon } from '../visuals/dynamicIcons.js';

//==============================================================================
// 2. DOM REFERENCES
//==============================================================================

// DOM elements
let forecastContainer, hourlyForecastContainer;

//==============================================================================
// 3. INITIALIZATION
//==============================================================================

/**
 * Initialize the forecasts component
 */
export function initForecasts() {
    forecastContainer = document.getElementById('forecast-container');
    hourlyForecastContainer = document.getElementById('hourly-forecast-items');
}

//==============================================================================
// 4. DAILY FORECAST FUNCTIONS
//==============================================================================

/**
 * Process and display daily forecast data
 * @param {Object} data - Weather data object
 */
export function handleForecastDisplay(data) {
    try {
        // Make sure the forecast container exists
        if (!forecastContainer) {
            console.error('Forecast container not found in DOM');
            return;
        }

        // Clear previous forecast
        forecastContainer.innerHTML = '';

        // Get forecast data
        const forecastData = data.daily.data;

        if (!forecastData || forecastData.length === 0) {
            forecastContainer.innerHTML = '<div class="no-forecast">No forecast data available</div>';
            return;
        }

        // Display forecast for 7 days or less if there's not enough data
        const days = Math.min(7, forecastData.length);

        for (let i = 0; i < days; i++) {
            const day = forecastData[i];
            if (!day) continue;

            const date = new Date(day.time * 1000);

            const forecastCard = document.createElement('div');
            forecastCard.className = 'forecast-card';

            // Day name (e.g., "Mon", "Tue")
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            
            // Get temperatures
            const highTemp = day.temperatureHigh;
            const lowTemp = day.temperatureLow;

            // Format temperatures according to current units
            let tempDisplay;
            if (getDisplayUnits() === 'metric') {
                const highTempC = (highTemp - 32) * (5 / 9);
                const lowTempC = (lowTemp - 32) * (5 / 9);
                tempDisplay = `${Math.round(highTempC)}° / ${Math.round(lowTempC)}°`;
            } else {
                tempDisplay = `${Math.round(highTemp)}° / ${Math.round(lowTemp)}°`;
            }

            // Get precipitation chance
            const precipChance = day.precipChance !== undefined ? day.precipChance : 0;

            forecastCard.innerHTML = `
                <div class="day">${dayName}</div>
                <div class="forecast-icon" id="forecast-icon-${i}"></div>
                <div class="forecast-details">
                    <div class="temp">${tempDisplay}</div>
                    ${precipChance >= 5 ? 
                        `<div class="precip-chance"><i class="bi bi-droplet-fill"></i> ${precipChance}%</div>` : 
                        ''}
                </div>
            `;

            forecastContainer.appendChild(forecastCard);

            // Set forecast icon - ALWAYS use daytime icons for daily forecast
            const forecastIconElement = document.getElementById(`forecast-icon-${i}`);
            if (forecastIconElement) {
                setForecastIcon(day.icon || 'cloudy', forecastIconElement, true);
            }
        }
    } catch (error) {
        console.error('Error displaying forecast:', error);
        forecastContainer.innerHTML = '<div class="forecast-error">Error displaying forecast</div>';
    }
}

//==============================================================================
// 5. HOURLY FORECAST FUNCTIONS
//==============================================================================

/**
 * Process and display hourly forecast data
 * @param {Object} data - Weather data object
 */
export function handleHourlyForecastDisplay(data) {
    try {
        // Check if container exists
        if (!hourlyForecastContainer) {
            console.error('Hourly forecast container not found in DOM');
            return;
        }

        // Clear previous forecast
        hourlyForecastContainer.innerHTML = '';

        // Get hourly forecast data
        const hourlyForecastData = data.hourly.data;

        // Handle empty data
        if (!hourlyForecastData || hourlyForecastData.length === 0) {
            hourlyForecastContainer.innerHTML = '<div class="no-forecast">No hourly forecast data available</div>';
            return;
        }

        // Display forecast for 12 hours or less if there's not enough data
        const hours = Math.min(12, hourlyForecastData.length);

        for (let i = 0; i < hours; i++) {
            const hour = hourlyForecastData[i];
            if (!hour) continue;

            // Use pre-formatted time from the standardized format
            const timeString = hour.formattedTime || formatSimpleTime(hour.time);

            const hourlyForecastCard = document.createElement('div');
            hourlyForecastCard.className = 'hourly-forecast-card';

            // Get temperature
            const temp = hour.temperature;

            // Format temperature according to current units
            let tempDisplay;
            if (getDisplayUnits() === 'metric') {
                const tempC = (temp - 32) * (5 / 9);
                tempDisplay = `${Math.round(tempC)}°`;
            } else {
                tempDisplay = `${Math.round(temp)}°`;
            }

            // Get precipitation chance
            const precipChance = hour.precipChance !== undefined ? hour.precipChance : 0;

            hourlyForecastCard.innerHTML = `
                <div class="time">${timeString}</div>
                <div class="forecast-icon" id="hourly-forecast-icon-${i}"></div>
                <div class="forecast-details">
                    <div class="temp">${tempDisplay}</div>
                    ${precipChance >= 5 ? 
                        `<div class="precip-chance"><i class="bi bi-droplet-fill"></i> ${precipChance}%</div>` : 
                        ''}
                </div>
            `;

            hourlyForecastContainer.appendChild(hourlyForecastCard);

            // Set forecast icon using the isDaytime flag from hourly data
            const forecastIconElement = document.getElementById(`hourly-forecast-icon-${i}`);
            if (forecastIconElement) {
                setForecastIcon(hour.icon || 'cloudy', forecastIconElement, hour.isDaytime);
            }
        }
    } catch (error) {
        console.error('Error displaying hourly forecast:', error);
        hourlyForecastContainer.innerHTML = '<div class="forecast-error">Error displaying hourly forecast</div>';
    }
}

/**
 * Format simple time for hourly display
 * @param {number} timestamp - Unix timestamp
 * @returns {string} - Formatted time string (e.g. "2 PM")
 */
function formatSimpleTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const hours = date.getHours();
    const hour12 = hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${hour12} ${ampm}`;
}

// Make the handler functions available globally
window.handleForecastDisplay = handleForecastDisplay;
window.handleHourlyForecastDisplay = handleHourlyForecastDisplay;