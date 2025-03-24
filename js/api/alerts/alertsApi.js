/**
 * Global Alert System Coordinator
 * 
 * This module orchestrates alert retrieval, focusing on NWS alerts for US locations.
 * It maintains the same functionality as before, just in a separate module.
 */

// Import NWS alerts functionality
import { fetchNWSAlerts, fetchNWSAreaAlerts } from './nwsAlerts.js';

/**
 * Fetch alerts based on location
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Object} options - Additional options
 * @param {string} options.countryCode - Optional country code
 * @returns {Promise<Array>} - Promise resolving to array of standardized alerts
 */
export async function fetchAlerts(lat, lon, options = {}) {
  try {
    // For US locations, use NWS alerts
    if (!options.countryCode || options.countryCode.toLowerCase() === 'us') {
      console.log('Using NWS for alerts');
      return await fetchNWSAlerts(lat, lon, options);
    }
    
    // For non-US locations, currently no alert providers available
    console.log('No alert provider available for this location');
    return [];
  } catch (error) {
    console.error('Error fetching alerts:', error);
    // Return empty array on error rather than failing
    return [];
  }
}

/**
 * Fetch alerts for a map area (used by radar)
 * 
 * @param {Object} bounds - Map bounds {north, south, east, west}
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} - Promise resolving to array of alerts with geometry
 */
export async function fetchMapAreaAlerts(bounds, options = {}) {
  try {
    // Calculate center point of the map
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLon = (bounds.east + bounds.west) / 2;
    
    // Use NWS for map alerts
    return await fetchNWSAreaAlerts(bounds, centerLat, centerLon, options);
  } catch (error) {
    console.error('Error fetching map area alerts:', error);
    return [];
  }
}