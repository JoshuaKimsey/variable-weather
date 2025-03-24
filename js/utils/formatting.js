/**
 * Formatting Utilities
 * 
 * Utility functions for formatting text, dates, and other display values
 */

//==============================================================================
// 1. DATE FORMATTING
//==============================================================================

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
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

//==============================================================================
// 2. LOCATION FORMATTING
//==============================================================================

/**
 * Format location name for display
 * @param {string} locationName - Raw location name
 * @returns {string} - Formatted location name
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

//==============================================================================
// 3. PAGE TITLE
//==============================================================================

/**
 * Update page title with weather info
 * @param {number} temperature - Current temperature
 * @param {string} location - Location name
 */
export function updatePageTitle(temperature, location) {
    try {
        document.title = `${Math.round(temperature)}°F | ${location} | Variable Weather`;
    } catch (error) {
        console.error('Error updating page title:', error);
        document.title = 'Variable Weather';
    }
}

//==============================================================================
// 4. TIME UTILITIES
//==============================================================================

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
            console.error('tzlookup function not found. Make sure tz.js is loaded.');
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