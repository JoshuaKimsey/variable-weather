/**
 * Unit conversion and display utilities for the weather app
 */

// Default to imperial units (°F)
let currentDisplayUnits = 'imperial';

// Initialize the units system
export function initUnits() {
    // Load saved units from localStorage if available
    const savedUnits = localStorage.getItem('weather_app_units') || 'imperial';
    currentDisplayUnits = savedUnits;

    // Make the setter available globally so it can be called from settings
    window.setDisplayUnits = setDisplayUnits;
    window.refreshWeatherWithCurrentUnits = refreshWeatherWithCurrentUnits;
}

/**
 * Set the display units for the app
 */
export function setDisplayUnits(units) {
    currentDisplayUnits = units;
    //console.log(`Display units set to: ${units}`);
}

/**
 * Get the current display units
 */
export function getDisplayUnits() {
    return currentDisplayUnits;
}

/**
 * Convert temperature from F to C if needed
 */
export function formatTemperature(tempF) {
    if (currentDisplayUnits === 'metric') {
        // Convert F to C
        const tempC = (tempF - 32) * (5 / 9);
        return `${Math.round(tempC)}°C`;
    }
    return `${Math.round(tempF)}°F`;
}

/**
 * Format wind speed in appropriate units
 */
export function formatWindSpeed(speedMph) {
    if (currentDisplayUnits === 'metric') {
        // Convert mph to km/h
        const speedKmh = speedMph * 1.60934;
        return `${Math.round(speedKmh)} km/h`;
    }
    return `${Math.round(speedMph)} mph`;
}

/**
 * Format pressure in appropriate units
 */
export function formatPressure(pressureMb) {
    if (currentDisplayUnits === 'metric') {
        // Display in hPa (same as mb, just different label)
        return `${Math.round(pressureMb)} hPa`;
    }
    return `${Math.round(pressureMb)} mB`;
}

/**
 * Format visibility in appropriate units
 */
export function formatVisibility(visibilityMi) {
    if (currentDisplayUnits === 'metric') {
        // Convert miles to kilometers
        const visibilityKm = visibilityMi * 1.60934;
        return `${Math.round(visibilityKm)} km`;
    }
    return `${Math.round(visibilityMi)} mi`;
}

/**
 * Refreshes the weather display with current units
 * This requires data to be cached or re-fetched
 */
export function refreshWeatherWithCurrentUnits() {
    // Basic approach: get the current elements and update them
    const temperatureElement = document.getElementById('temperature');
    const windSpeedElement = document.getElementById('wind-speed');
    const pressureElement = document.getElementById('pressure');
    const visibilityElement = document.getElementById('visibility');

    // If we have current weather data in a global variable or cache
    if (window.currentWeatherData) {
        const data = window.currentWeatherData;

        // Update current conditions
        if (temperatureElement && data.currently) {
            temperatureElement.textContent = formatTemperature(data.currently.temperature);
        }

        if (windSpeedElement && data.currently) {
            windSpeedElement.textContent = formatWindSpeed(data.currently.windSpeed);
        }

        if (pressureElement && data.currently) {
            pressureElement.textContent = formatPressure(data.currently.pressure);
        }

        if (visibilityElement && data.currently) {
            visibilityElement.textContent = formatVisibility(data.currently.visibility);
        }

        updateHourlyForecastUnits(data.hourly?.data || data.hourlyForecast);

        // Update forecast if available
        updateForecastUnits(data.daily?.data);
    }
}

/**
 * Updates the 7-day forecast cards with the appropriate units
 */
function updateForecastUnits(forecastData) {
    if (!forecastData) return;

    const forecastContainer = document.getElementById('forecast-container');
    const forecastCards = forecastContainer.querySelectorAll('.forecast-card');

    forecastCards.forEach((card, index) => {
        if (index < forecastData.length) {
            const tempElement = card.querySelector('.temp');
            if (tempElement) {
                const highTemp = forecastData[index].temperatureHigh;
                const lowTemp = forecastData[index].temperatureLow;
            
                if (currentDisplayUnits === 'metric') {
                    const highTempC = (highTemp - 32) * (5 / 9);
                    const lowTempC = (lowTemp - 32) * (5 / 9);
                    tempElement.textContent = `${Math.round(highTempC)}° / ${Math.round(lowTempC)}°`;
                } else {
                    tempElement.textContent = `${Math.round(highTemp)}° / ${Math.round(lowTemp)}°`;
                }
            }
        }
    });
}

/**
 * Updates the hourly forecast cards with the appropriate units
 */
function updateHourlyForecastUnits(hourlyData) {
    if (!hourlyData) return;

    const hourlyForecastContainer = document.getElementById('hourly-forecast-items');
    if (!hourlyForecastContainer) return;

    const hourlyCards = hourlyForecastContainer.querySelectorAll('.hourly-forecast-card');

    hourlyCards.forEach((card, index) => {
        if (index < hourlyData.length) {
            const tempElement = card.querySelector('.temp');
            if (tempElement) {
                const temp = hourlyData[index].temperature;

                if (currentDisplayUnits === 'metric') {
                    const tempC = (temp - 32) * (5 / 9);
                    tempElement.textContent = `${Math.round(tempC)}°`;
                } else {
                    tempElement.textContent = `${Math.round(temp)}°`;
                }
            }
        }
    });
}