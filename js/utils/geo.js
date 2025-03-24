/**
 * Geographic Utilities
 * 
 * Utility functions for location-related operations
 */

//==============================================================================
// 1. DISTANCE CALCULATION
//==============================================================================

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
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
            ;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
    return deg * (Math.PI / 180);
}

//==============================================================================
// 2. LOCATION CACHING
//==============================================================================

/**
 * Save the user's location to localStorage
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Optional location name
 */
export function saveLocationToCache(lat, lon, locationName = null) {
    const locationData = {
        lat: lat,
        lon: lon,
        locationName: locationName,
        timestamp: Date.now()
    };
    localStorage.setItem('cached_location', JSON.stringify(locationData));
}

/**
 * Get the cached location from localStorage with validation
 * @returns {Object|null} - Location object or null if not found/invalid
 */
export function getCachedLocation() {
    const cachedData = localStorage.getItem('cached_location');
    if (!cachedData) return null;
    
    try {
        const parsedData = JSON.parse(cachedData);
        
        // Validate the data structure
        if (!parsedData || 
            typeof parsedData.lat !== 'number' || 
            typeof parsedData.lon !== 'number' ||
            !parsedData.timestamp) {
            // Invalid or incomplete data
            console.log('Invalid cached location data, clearing cache');
            localStorage.removeItem('cached_location');
            return null;
        }
        
        return parsedData;
    } catch (error) {
        console.error('Error parsing cached location:', error);
        // Clear invalid cache data
        localStorage.removeItem('cached_location');
        return null;
    }
}

/**
 * Calculate if the current location is significantly different from the cached one
 * @param {number} currentLat - Current latitude
 * @param {number} currentLon - Current longitude
 * @param {number} cachedLat - Cached latitude
 * @param {number} cachedLon - Cached longitude
 * @returns {boolean} - True if location has changed significantly
 */
export function hasLocationChangedSignificantly(currentLat, currentLon, cachedLat, cachedLon) {
    // Calculate distance between points
    const distance = calculateDistance(currentLat, currentLon, cachedLat, cachedLon);
    
    // Consider a change significant if more than 10km
    return distance > 10;
}

// Add to utils/geo.js
/**
 * Update URL parameters with location information
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Optional location name
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

//==============================================================================
// 3. DAYLIGHT DETECTION
//==============================================================================

/**
 * Determine if it's currently daytime at a location based on sunrise/sunset
 * Note: This is a simplified version - the full implementation would use astronomicalView.js
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Date} [date=new Date()] - Optional date to check (defaults to now)
 * @returns {boolean} - True if it's daytime, false if nighttime
 */
export function isDaytime(lat, lon, date = new Date()) {
    // If astronomicalView.js is loaded, use that function
    if (typeof calculateSunTimes === 'function') {
        const sunTimes = calculateSunTimes(lat, lon, date);
        return sunTimes.isDaytime;
    }
    
    // Simple fallback calculation
    const hour = date.getHours();
    return hour >= 6 && hour < 18; // Very basic 6am-6pm approximation
}