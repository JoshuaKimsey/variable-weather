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
import { openDailyDetail } from './dailyDetail.js';
import { renderHourlyCurve } from './hourlyCurve.js';

//==============================================================================
// 2. DOM REFERENCES
//==============================================================================

// DOM elements
let forecastContainer, hourlyForecastContainer;

// Use the same compact layout (every 3rd hour) on mobile so 12 hours don't
// crowd the icons + labels. Above 600px we keep all 12 icons visible.
const mobileChartMatcher = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(max-width: 600px)')
    : null;
let mobileChartListenerAttached = false;

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
            forecastCard.dataset.dayIndex = i;
            forecastCard.setAttribute('role', 'button');
            forecastCard.setAttribute('tabindex', '0');
            forecastCard.setAttribute('aria-label', 'Open day detail');

            // Day name in the location's timezone (e.g., "Mon", "Tue"). Falls
            // back to user-local if data.timezone is missing or 'auto'.
            const tz = (data.timezone && data.timezone !== 'auto') ? data.timezone : undefined;
            const dayNameOpts = { weekday: 'short' };
            if (tz) dayNameOpts.timeZone = tz;
            const dayName = date.toLocaleDateString('en-US', dayNameOpts);
            
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

            const dayIndex = i;
            forecastCard.addEventListener('click', () => openDailyDetail(dayIndex));
            forecastCard.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openDailyDetail(dayIndex);
                }
            });
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
 * Render the main "next 12 hours" temperature curve.
 * Delegates to the shared renderer after slicing 12 hours from the current hour.
 * @param {Object} data - Weather data object
 */
export function handleHourlyForecastDisplay(data) {
    try {
        if (!hourlyForecastContainer) {
            console.error('Hourly forecast container not found in DOM');
            return;
        }

        const all = data.hourly?.data;
        if (!all || all.length === 0) {
            hourlyForecastContainer.innerHTML = '<div class="no-forecast">No hourly forecast data available</div>';
            return;
        }

        // Pirate Weather's array starts at the current hour; Open-Meteo's starts at
        // the location's midnight. Pick the first hour >= now to handle both.
        const nowSec = Date.now() / 1000;
        let startIndex = all.findIndex(h => h.time >= nowSec - 1800); // include the just-passed hour
        if (startIndex < 0) startIndex = 0;
        // 13 hours so a "12-hour forecast" reads inclusively (e.g. 7 AM → 7 PM)
        // and the start/end labels are both anchored to round times.
        const hours = all.slice(startIndex, startIndex + 13);

        const iconStride = mobileChartMatcher && mobileChartMatcher.matches ? 3 : 1;
        renderHourlyCurve(hourlyForecastContainer, hours, {
            iconStride,
            idPrefix: 'hourly-curve',
            timezone: data.timezone
        });

        // Re-render once on a viewport-crossing so stride switches between
        // mobile and desktop without needing a manual refresh.
        if (mobileChartMatcher && !mobileChartListenerAttached) {
            mobileChartMatcher.addEventListener('change', () => {
                if (window.currentWeatherData) {
                    handleHourlyForecastDisplay(window.currentWeatherData);
                }
            });
            mobileChartListenerAttached = true;
        }
    } catch (error) {
        console.error('Error displaying hourly forecast:', error);
        hourlyForecastContainer.innerHTML = '<div class="forecast-error">Error displaying hourly forecast</div>';
    }
}

// Make the handler functions available globally
window.handleForecastDisplay = handleForecastDisplay;
window.handleHourlyForecastDisplay = handleHourlyForecastDisplay;