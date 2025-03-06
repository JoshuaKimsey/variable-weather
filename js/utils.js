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
    if (!locationName) return 'Unknown Location';
    
    try {
        // Shorten location name to just city, state/province, country
        const parts = locationName.split(', ');
        let formatted = parts[0]; // City

        if (parts.length > 2) {
            // Add state/province if available
            formatted += ', ' + parts[1];
        }

        return formatted;
    } catch (error) {
        console.error('Error formatting location name:', error);
        return locationName; // Return original if error
    }
}

/**
 * Format date for display
 */
export function formatDate(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return 'Unknown Date';
    }
    
    try {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    } catch (error) {
        console.error('Error formatting date:', error);
        return date.toString(); // Fallback
    }
}

/**
 * Update page title with weather info
 */
export function updatePageTitle(temperature, location) {
    try {
        document.title = `${Math.round(temperature)}°F | ${location} | Variable Weather`;
    } catch (error) {
        console.error('Error updating page title:', error);
        document.title = 'Variable Weather';
    }
}

/**
 * Calculate distance between two points in kilometers using the Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} - Distance in kilometers
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    try {
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2)
        ; 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const distance = R * c; // Distance in km
        return distance;
    } catch (error) {
        console.error('Error calculating distance:', error);
        return 0; // Default to 0 on error
    }
}

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees
 * @returns {number} - Radians
 */
function deg2rad(deg) {
    return deg * (Math.PI/180);
}