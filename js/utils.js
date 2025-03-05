/**
 * Utility functions for the weather application
 */

/**
 * Update URL parameters with location information
 */
export function updateURLParameters(lat, lon, locationName) {
    const url = new URL(window.location);
    url.searchParams.set('lat', lat);
    url.searchParams.set('lon', lon);
    if (locationName) {
        url.searchParams.set('location', locationName);
    }
    window.history.pushState({}, '', url);
}

/**
 * Check if location is in the US
 */
export function isUSLocation(countryCode) {
    return countryCode === 'us';
}

/**
 * Determine country code from Nominatim results
 */
export function getCountryCode(displayName) {
    // Try to extract country code from display name
    const parts = displayName.split(',');
    const lastPart = parts[parts.length - 1].trim().toLowerCase();

    // Check if it's US
    if (lastPart === 'usa' || lastPart === 'united states' || lastPart === 'united states of america' || lastPart === 'us') {
        return 'us';
    }

    // For demonstration purposes, assume non-US for all other locations
    return 'non-us';
}

/**
 * Format location name for display
 */
export function formatLocationName(locationName) {
    // Shorten location name to just city, state/province, country
    const parts = locationName.split(', ');
    let formatted = parts[0]; // City

    if (parts.length > 2) {
        // Add state/province if available
        formatted += ', ' + parts[1];
    }

    return formatted;
}

/**
 * Format date for display
 */
export function formatDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Update page title with weather info
 */
export function updatePageTitle(temperature, location) {
    document.title = `${Math.round(temperature)}°F | ${location} | Weather App`;
}