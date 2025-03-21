/**
 * Utility functions for the weather application
 */

import { calculateSunTimes } from './astronomicalView.js';

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
 * Get local time for a location using tz-lookup and the browser's Intl API
 * @param {number} lon - Longitude in decimal degrees
 * @param {number} lat - Latitude in decimal degrees
 * @returns {string} - Formatted local time
 */
export function getLocalTimeForLocation(lon, lat = null) {
    try {
        // If parameters are missing or invalid, return browser's local time
        if (!lon || !lat || isNaN(Number(lon)) || isNaN(Number(lat))) {
            return new Date().toLocaleTimeString(undefined, { 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
            });
        }
        
        // We need to ensure the tzlookup function is loaded
        if (typeof window.tzlookup !== 'function') {
            // Log an error if the library isn't loaded
            console.error('tzlookup function not found. Make sure tz.js is loaded.');
            
            // Fall back to longitude-based calculation
            return calculateTimeFromLongitude(lon);
        }
        
        // Get the timezone identifier using tzlookup
        // Note: tzlookup expects (lat, lon) - the order is important!
        const timezone = window.tzlookup(Number(lat), Number(lon));
        
        if (!timezone) {
            console.warn('Could not determine timezone for coordinates:', lat, lon);
            return calculateTimeFromLongitude(lon);
        }
        
        // Format current time using the determined timezone
        const now = new Date();
        
        // Format options
        const options = {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
        };
        
        return now.toLocaleTimeString(undefined, options);
    } catch (error) {
        console.error('Error getting local time:', error);
        
        // Fall back to simple longitude calculation on error
        return calculateTimeFromLongitude(lon);
    }
}

/**
 * Fallback function that calculates time directly from longitude
 * @param {number} lon - Longitude in decimal degrees
 * @returns {string} - Formatted time string
 */
function calculateTimeFromLongitude(lon) {
    // Ensure longitude is a number
    const longitude = Number(lon);
    if (isNaN(longitude)) {
        return new Date().toLocaleTimeString(undefined, { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
        });
    }
    
    // Get the current UTC time
    const now = new Date();
    
    // Get UTC time components
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    
    // Calculate approximate timezone offset in hours based on longitude
    const timezoneOffsetHours = longitude / 15;
    
    // Add the offset to UTC time
    const totalMinutesUTC = utcHours * 60 + utcMinutes;
    const totalMinutesLocal = totalMinutesUTC + (timezoneOffsetHours * 60);
    
    // Convert back to hours and minutes
    let localHours = Math.floor(totalMinutesLocal / 60) % 24;
    if (localHours < 0) localHours += 24;
    
    const localMinutes = Math.floor(totalMinutesLocal % 60);
    
    // Format as 12-hour time
    const isPM = localHours >= 12;
    const hours12 = localHours % 12 || 12;
    const minutesStr = Math.abs(localMinutes).toString().padStart(2, '0');
    const period = isPM ? 'PM' : 'AM';
    
    return `${hours12}:${minutesStr} ${period}`;
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

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees
 * @returns {number} - Radians
 */
function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Determine if it's currently daytime at a location based on sunrise/sunset
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Date} [date=new Date()] - Optional date to check (defaults to now)
 * @returns {boolean} - True if it's daytime, false if nighttime
 */
export function isDaytime(lat, lon, date = new Date()) {
    // Get sun times (this will now work correctly with our fixed functions)
    const sunTimes = calculateSunTimes(lat, lon, date);
    
    // The function now returns an isDaytime property that we can use directly
    return sunTimes.isDaytime;
}