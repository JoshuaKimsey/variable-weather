/**
 * Weather Icon System
 * 
 * This module handles the creation and rendering of weather icons
 * using Meteocons SVG icons for lightweight, mobile-friendly display.
 */

//----------------------------------------------------------------------
// ICON MAPPING
//----------------------------------------------------------------------

// Mapping from weather codes to Meteocons file names
const meteoconsMapping = {
    // Day icons
    'skc': 'clear-day',
    'few': 'partly-cloudy-day',
    'sct': 'partly-cloudy-day',
    'bkn': 'overcast-day',
    'ovc': 'cloudy',
    'wind': 'wind',
    'snow': 'snow',
    'rain': 'rain',
    'rain_showers': 'rain',
    'rain_showers_hi': 'rain',
    'tsra': 'thunderstorms-rain',
    'tsra_sct': 'thunderstorms-rain',
    'tsra_hi': 'thunderstorms-rain',
    'tornado': 'tornado',
    'hurricane': 'hurricane',
    'tropical_storm': 'hurricane',
    'dust': 'dust',
    'smoke': 'smoke',
    'haze': 'haze',
    'hot': 'thermometer-warmer',
    'cold': 'thermometer-colder',
    'blizzard': 'snow',
    'fog': 'fog',
    'sleet': 'sleet',
    'fzra': 'sleet',
    'ip': 'sleet',
    'mix': 'sleet',
    'raip': 'sleet',
    'rasn': 'sleet',
    'shra': 'rain',
    'fzrara': 'sleet',
    'hi_shwrs': 'rain',
    'hi_nshwrs': 'rain',
    'frhza': 'fog',
    'hi_tsra': 'thunderstorms-rain',
    'fc': 'tornado',
    'hurr': 'hurricane',
    'hur_warn': 'hurricane',
    'waterspout': 'tornado',
    'hurricane_warning': 'hurricane',
    'ts_warn': 'thunderstorms-rain',
    'tor_warn': 'tornado',
    'hurricane_watch': 'hurricane',
    'ts_watch': 'thunderstorms-rain',
    'tor_watch': 'tornado',

    // Night icons
    'nskc': 'clear-night',
    'nfew': 'partly-cloudy-night',
    'nsct': 'partly-cloudy-night',
    'nbkn': 'overcast-night',
    'novc': 'cloudy',
    'nrain': 'rain',
    'ntsra': 'thunderstorms-night-rain',
    'nfog': 'fog-night',
    'nsnow': 'snow',
    'nsleet': 'sleet',
    'nfzra': 'sleet',
    'nip': 'sleet',
    'nmix': 'sleet',
    'nraip': 'sleet',
    'nrasn': 'sleet',
    'nshra': 'rain',
    'nfzrara': 'sleet',
    'nwind': 'wind',

    // Pirate Weather / Open-Meteo codes
    'clear-day': 'clear-day',
    'clear-night': 'clear-night',
    'partly-cloudy-day': 'partly-cloudy-day',
    'partly-cloudy-night': 'partly-cloudy-night',
    'cloudy': 'cloudy',
    'rain': 'rain',
    'sleet': 'sleet',
    'snow': 'snow',
    'wind': 'wind',
    'fog': 'fog',
    'thunderstorm': 'thunderstorms-rain'
};

//----------------------------------------------------------------------
// ICON CREATION
//----------------------------------------------------------------------

/**
 * Create a Meteocon icon
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {string} iconName - The Meteocon icon name
 * @param {boolean} isForecast - Whether this is a smaller forecast icon
 */
function createMeteoconIcon(element, iconName, isForecast = false) {
    const size = isForecast ? 60 : 150;

    try {
        // Create an img element for the SVG
        const icon = document.createElement('img');
        icon.src = `./resources/meteocons/all/${iconName}.svg`;
        icon.alt = iconName.replace(/-/g, ' ') + ' weather icon';
        icon.style.width = `${size}px`;
        icon.style.height = `${size}px`;
        icon.style.display = 'block';

        element.appendChild(icon);
    } catch (error) {
        console.error(`Error creating Meteocon icon for ${iconName}:`, error);
        // Fallback to a simple text representation if image fails
        const fallback = document.createElement('div');
        fallback.textContent = iconName.replace(/-/g, ' ');
        fallback.style.width = `${size}px`;
        fallback.style.height = `${size}px`;
        fallback.style.display = 'flex';
        fallback.style.alignItems = 'center';
        fallback.style.justifyContent = 'center';
        fallback.style.textAlign = 'center';
        fallback.style.fontSize = isForecast ? '12px' : '16px';
        fallback.style.color = '#FFF';
        element.appendChild(fallback);
    }
}

/**
 * Get the Meteocon name for a given icon code and daytime status
 * @param {string} iconCode - The weather icon code
 * @param {boolean} isDaytime - Whether it's daytime
 * @returns {string} - The Meteocon file name
 */
function getMeteoconsName(iconCode, isDaytime) {
    // First, check if we have a direct mapping
    let meteoconsName = meteoconsMapping[iconCode];
    
    if (meteoconsName) {
        // If it's nighttime and we have a day icon, try to find night variant
        if (!isDaytime) {
            // For NWS codes, check if there's a night version
            const nightIconCode = 'n' + iconCode;
            if (meteoconsMapping[nightIconCode]) {
                return meteoconsMapping[nightIconCode];
            }
            
            // Convert day variants to night for generic codes
            if (meteoconsName === 'clear-day') {
                return 'clear-night';
            } else if (meteoconsName === 'partly-cloudy-day') {
                return 'partly-cloudy-night';
            } else if (meteoconsName === 'overcast-day') {
                return 'overcast-night';
            }
        }
        return meteoconsName;
    }
    
    // Default fallback
    return isDaytime ? 'cloudy' : 'cloudy';
}

//----------------------------------------------------------------------
// EXPORTS
//----------------------------------------------------------------------

/**
 * Set weather icon for current conditions
 * @param {string} iconCode - The weather icon code
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isDaytime - Whether it's daytime (default: true)
 */
export function setWeatherIcon(iconCode, element, isDaytime = true) {
    // Clear previous icon
    element.innerHTML = '';

    // Create a wrapper to ensure proper positioning
    const wrapper = document.createElement('div');
    wrapper.className = 'weather-icon-wrapper';
    element.appendChild(wrapper);

    // Get the appropriate Meteocon name
    const meteoconsName = getMeteoconsName(iconCode, isDaytime);

    // Create the Meteocon
    createMeteoconIcon(wrapper, meteoconsName, false);
}

/**
 * Set weather icon for forecast display (smaller size)
 * @param {string} iconCode - The weather icon code
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isDaytime - Whether it's daytime (default: true)
 */
export function setForecastIcon(iconCode, element, isDaytime = true) {
    // Clear previous icon
    element.innerHTML = '';

    // Create a wrapper to ensure proper positioning
    const wrapper = document.createElement('div');
    wrapper.className = 'weather-icon-wrapper';
    element.appendChild(wrapper);

    // Get the appropriate Meteocon name
    const meteoconsName = getMeteoconsName(iconCode, isDaytime);

    // Create the Meteocon (smaller size for forecast)
    createMeteoconIcon(wrapper, meteoconsName, true);
}
