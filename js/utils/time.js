/**
 * Time Utilities
 * 
 * Utility functions for time-related operations
 */

//==============================================================================
// 1. TIME FORMATTING
//==============================================================================

/**
 * Format time as 12-hour with AM/PM
 * @param {Date} date - Date object
 * @returns {string} - Formatted time (e.g., "2:30 PM")
 */
export function formatTime12Hour(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return 'unknown time';
    }
    
    try {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        
        return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    } catch (error) {
        console.error('Error formatting time:', error);
        return date.toLocaleTimeString();
    }
}

/**
 * Format time from Unix timestamp
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} - Formatted time
 */
export function formatTimeFromTimestamp(timestamp) {
    if (!timestamp) return 'unknown time';
    
    try {
        const date = new Date(timestamp * 1000);
        return formatTime12Hour(date);
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return 'unknown time';
    }
}

/**
 * Get simplified time string (e.g., "3 PM")
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} - Simple hour string with AM/PM
 */
export function getSimpleHourString(timestamp) {
    try {
        const date = new Date(timestamp * 1000);
        const hours = date.getHours();
        const hour12 = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        return `${hour12} ${ampm}`;
    } catch (error) {
        console.error('Error getting simple hour string:', error);
        return 'N/A';
    }
}

//==============================================================================
// 2. RELATIVE TIME
//==============================================================================

/**
 * Format time in a relative way (e.g., "5 minutes ago")
 * @param {Date} date - Date to format relative to now
 * @returns {string} - Relative time description
 */
export function formatRelativeTime(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return 'unknown time';
    }

    try {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) {
            return 'just now';
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        } else if (diffMins < 120) {
            return '1 hour ago';
        } else if (diffMins < 1440) { // less than a day
            const hours = Math.floor(diffMins / 60);
            return `${hours} hours ago`;
        } else if (diffMins < 2880) { // less than 2 days
            return 'yesterday';
        } else {
            // Format as date if more than 2 days ago
            return date.toLocaleDateString();
        }
    } catch (error) {
        console.error('Error formatting relative time:', error);
        return 'unknown time';
    }
}

/**
 * Calculate time until a future date
 * @param {Date} futureDate - Future date
 * @returns {string} - Human readable time until (e.g., "in 3 hours")
 */
export function timeUntil(futureDate) {
    if (!futureDate || !(futureDate instanceof Date) || isNaN(futureDate.getTime())) {
        return 'unknown time';
    }

    try {
        const now = new Date();
        const diffMs = futureDate - now;
        
        // Return immediate if in the past
        if (diffMs <= 0) {
            return 'now';
        }
        
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 60) {
            return `in ${diffMins} minute${diffMins !== 1 ? 's' : ''}`;
        } else if (diffMins < 120) {
            return 'in 1 hour';
        } else if (diffMins < 1440) { // less than a day
            const hours = Math.floor(diffMins / 60);
            return `in ${hours} hours`;
        } else {
            const days = Math.floor(diffMins / 1440);
            return `in ${days} day${days !== 1 ? 's' : ''}`;
        }
    } catch (error) {
        console.error('Error calculating time until:', error);
        return 'unknown time';
    }
}