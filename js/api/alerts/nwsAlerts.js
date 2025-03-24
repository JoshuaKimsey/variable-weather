/**
 * National Weather Service (NWS) Alert System Implementation
 * 
 * This module handles fetching and processing alerts from the US National Weather Service.
 * It maintains all existing functionality from the original implementation.
 */

import { API_ENDPOINTS, createNWSRequestOptions } from '../../config.js';
import { ALERT_SEVERITY } from '../../standardWeatherFormat.js';

/**
 * Fetch alerts from the NWS API for a specific point
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} - Promise resolving to array of standardized alerts
 */
export async function fetchNWSAlerts(lat, lon, options = {}) {
  try {
    // Format coordinates for API request
    const formattedLat = parseFloat(lat).toFixed(4);
    const formattedLon = parseFloat(lon).toFixed(4);
    
    // Create the request URL with proper formatting
    const alertsUrl = `${API_ENDPOINTS.NWS_ALERTS}?point=${formattedLat},${formattedLon}`;
    
    // Create request options with proper headers
    const requestOptions = createNWSRequestOptions();
    
    // Fetch alerts from NWS API
    const response = await fetch(alertsUrl, requestOptions);
    
    // Check for successful response
    if (!response.ok) {
      throw new Error(`NWS API responded with status: ${response.status}`);
    }
    
    // Parse the response JSON
    const data = await response.json();
    
    // Process alerts into standardized format
    return processNWSAlerts(data);
  } catch (error) {
    console.error('Error fetching NWS alerts:', error);
    // Return empty array instead of throwing to allow graceful degradation
    return [];
  }
}

/**
 * Fetch alerts for a specific map area (used by radar)
 * 
 * @param {Object} bounds - Map bounds {north, south, east, west}
 * @param {number} centerLat - Center latitude of the bounds
 * @param {number} centerLon - Center longitude of the bounds
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} - Promise resolving to array of alerts with geometry
 */
export async function fetchNWSAreaAlerts(bounds, centerLat, centerLon, options = {}) {
  try {
    // NWS doesn't have a direct area endpoint, so we'll use the main endpoint
    // with all active alerts and filter as needed
    
    // Create the request URL for all active alerts
    const alertsUrl = API_ENDPOINTS.NWS_ALERTS;
    
    // Create request options with proper headers
    const requestOptions = createNWSRequestOptions();
    
    // Fetch alerts
    const response = await fetch(alertsUrl, requestOptions);
    
    // Check for successful response
    if (!response.ok) {
      throw new Error(`NWS API responded with status: ${response.status}`);
    }
    
    // Parse the response JSON
    const data = await response.json();
    
    // Process alerts with full geometry data
    return processNWSAlerts(data, true);
  } catch (error) {
    console.error('Error fetching NWS area alerts:', error);
    return [];
  }
}

/**
 * Process NWS alerts into standardized format
 * 
 * @param {Object} alertsData - Raw alerts data from NWS API
 * @param {boolean} includeGeometry - Whether to include full geometry data
 * @returns {Array} Standardized alerts
 */
function processNWSAlerts(alertsData, includeGeometry = false) {
  if (!alertsData || !alertsData.features || !Array.isArray(alertsData.features)) {
    return [];
  }

  return alertsData.features.map(alert => {
    if (!alert.properties) return null;

    const props = alert.properties;

    // Create standardized alert object
    const standardAlert = {
      id: props.id || `nws-alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: props.event || 'Weather Alert',
      description: props.headline || '',
      fullText: props.description || '',
      severity: determineAlertSeverity(props),
      urgency: props.urgency || '',
      expires: props.expires || null,
      hazardTypes: identifyAlertHazards(props.event || '', props.headline || '', props.description || ''),
      primaryHazard: getPrimaryHazardType(props.event || ''),
      source: 'nws' // Add source identifier
    };

    // Include geometry data if requested (for map display)
    if (includeGeometry && alert.geometry) {
      standardAlert.geometry = alert.geometry;
    }

    return standardAlert;
  }).filter(alert => alert !== null);
}

/**
 * Determine alert severity based on NWS properties
 * @param {Object} props - Alert properties
 * @returns {string} Standardized severity level
 */
function determineAlertSeverity(props) {
  // First check if the API provides a severity level directly
  if (props.severity) {
    const apiSeverity = props.severity.toLowerCase();

    // If the API says it's extreme or severe, trust it
    if (apiSeverity === 'extreme' || apiSeverity === 'severe') {
      return apiSeverity;
    }
  }

  // Extract the alert title/event for mapping
  const lowerTitle = (props.event || '').toLowerCase();

  // Event-based severity mapping - more comprehensive list
  // Extreme threats - immediate danger to life and property
  if (
    lowerTitle.includes('tornado warning') ||
    lowerTitle.includes('flash flood emergency') ||
    lowerTitle.includes('hurricane warning') && lowerTitle.includes('category 4') ||
    lowerTitle.includes('hurricane warning') && lowerTitle.includes('category 5') ||
    lowerTitle.includes('tsunami warning') ||
    lowerTitle.includes('extreme wind warning') ||
    lowerTitle.includes('particularly dangerous situation')
  ) {
    return ALERT_SEVERITY.EXTREME;
  }

  // Severe threats - significant threat to life or property
  if (
    lowerTitle.includes('severe thunderstorm warning') ||
    lowerTitle.includes('tornado watch') ||
    lowerTitle.includes('flash flood warning') ||
    lowerTitle.includes('hurricane warning') ||
    lowerTitle.includes('blizzard warning') ||
    lowerTitle.includes('ice storm warning') ||
    lowerTitle.includes('winter storm warning') ||
    lowerTitle.includes('storm surge warning') ||
    lowerTitle.includes('hurricane watch') ||
    lowerTitle.includes('avalanche warning') ||
    lowerTitle.includes('fire warning') ||
    lowerTitle.includes('red flag warning') ||
    lowerTitle.includes('excessive heat warning')
  ) {
    return ALERT_SEVERITY.SEVERE;
  }

  // Moderate threats - possible threat to life or property
  if (
    lowerTitle.includes('flood warning') ||
    lowerTitle.includes('thunderstorm watch') ||
    lowerTitle.includes('winter storm watch') ||
    lowerTitle.includes('winter weather advisory') ||
    lowerTitle.includes('wind advisory') ||
    lowerTitle.includes('heat advisory') ||
    lowerTitle.includes('freeze warning') ||
    lowerTitle.includes('dense fog advisory') ||
    lowerTitle.includes('flood advisory') ||
    lowerTitle.includes('rip current statement') ||
    lowerTitle.includes('frost advisory') ||
    lowerTitle.includes('small craft advisory')
  ) {
    return ALERT_SEVERITY.MODERATE;
  }

  // Minor threats - minimal threat to life or property
  if (
    lowerTitle.includes('special weather statement') ||
    lowerTitle.includes('hazardous weather outlook') ||
    lowerTitle.includes('air quality alert') ||
    lowerTitle.includes('hydrologic outlook') ||
    lowerTitle.includes('beach hazards statement') ||
    lowerTitle.includes('urban and small stream') ||
    lowerTitle.includes('lake wind advisory') ||
    lowerTitle.includes('short term forecast')
  ) {
    return ALERT_SEVERITY.MINOR;
  }

  // Check for some general indicators
  if (lowerTitle.includes('warning')) {
    return ALERT_SEVERITY.SEVERE;  // Any unspecified warning is treated as severe
  }

  if (lowerTitle.includes('watch')) {
    return ALERT_SEVERITY.MODERATE;  // Any unspecified watch is treated as moderate
  }

  if (lowerTitle.includes('advisory') || lowerTitle.includes('statement')) {
    return ALERT_SEVERITY.MINOR;  // Any unspecified advisory is treated as minor
  }

  // Default fallback
  return ALERT_SEVERITY.MODERATE;
}

/**
 * Identifies all hazards mentioned in an alert with improved word boundary matching
 * and context awareness to avoid place name false positives
 * 
 * @param {string} alertTitle - Alert title
 * @param {string} alertDescription - Short description
 * @param {string} fullDescription - Full alert text
 * @returns {Array} - Array of identified hazard types
 */
function identifyAlertHazards(alertTitle, alertDescription, fullDescription) {
  // Create a set to store unique hazard types
  const hazards = new Set();

  // Combine all text for analysis
  const combinedText = (alertTitle + " " + alertDescription + " " + fullDescription).toLowerCase();

  // Place name indicators - used to exclude matches that are likely place names
  const placeNamePatterns = [
    /\b(road|rd\.?|street|st\.?|ave\.?|avenue|ln\.?|lane|blvd\.?|boulevard|dr\.?|drive|way|place|pl\.?|parkway|pkwy\.?|highway|hwy\.?)\b/i,
    /\b(city|town|county|village|district|neighborhood|park|plaza|center|square|region|area|zone)\b/i,
    /\b(creek|river|lake|pond|bay|mountain|hill|valley|canyon|ridge|peak|summit|basin)\b/i
  ];

  // Helper function to check if a match is likely part of a place name
  const isLikelyPlaceName = (matchText, context = 50) => {
    // Extract surrounding context from the combined text
    const matchIndex = combinedText.indexOf(matchText.toLowerCase());
    if (matchIndex === -1) return false;

    const start = Math.max(0, matchIndex - context);
    const end = Math.min(combinedText.length, matchIndex + matchText.length + context);
    const surroundingContext = combinedText.substring(start, end);

    // Check if any place name patterns appear in the surrounding context
    return placeNamePatterns.some(pattern => pattern.test(surroundingContext));
  };

  // Define hazard keywords and their corresponding types
  // Using \b for word boundaries to match whole words only
  const hazardPatterns = [
    { pattern: /\btornado\b/g, type: 'tornado' },
    { pattern: /\bhail\b/g, type: 'hail' },
    { pattern: /\bflash flood\b|\bflooding\b|\bflood\b/g, type: 'flood' },
    { pattern: /\bthunder\b|\blightning\b|\bthunderstorm\b|\bsevere thunderstorm\b/g, type: 'thunderstorm' },

    // Improved snow pattern - requires weather context or excludes place name indicators
    {
      pattern: /\b(?:winter storm|winter weather|heavy snow|snowfall|snow accumulation|snow and ice|snow advisory|snow warning|snow emergency|snowstorm|snow covered|snow level)\b/gi,
      type: 'snow'
    },

    { pattern: /\bfreez(e|ing)\b|\bice\b|\bsleet\b/g, type: 'ice' },
    { pattern: /\bwind\b|\bgust\b|\bstrong winds\b/g, type: 'wind' },
    { pattern: /\bdust\b/g, type: 'dust' },
    { pattern: /\bsmoke\b/g, type: 'smoke' },
    { pattern: /\bfog\b/g, type: 'fog' },
    { pattern: /\bheat\b/g, type: 'heat' },
    { pattern: /\bcold\b|\bchill\b/g, type: 'cold' },
    { pattern: /\brain\b|\bshower\b/g, type: 'rain' },

    // Improved hurricane pattern that avoids matching place names
    {
      pattern: /\b(?:hurricane warning|hurricane watch|hurricane advisory|hurricane threat|approaching hurricane|major hurricane|potential hurricane|category \d hurricane|hurricane force|tropical storm|tropical cyclone|tropical depression)\b/g,
      type: 'hurricane'
    }
  ];

  // Check each pattern against the combined text
  hazardPatterns.forEach(({ pattern, type }) => {
    if (pattern.test(combinedText)) {
      hazards.add(type);
    }
  });

  // Special handling for generic "snow" mentions - requires more context checks
  if (!hazards.has('snow')) {
    const snowMatches = combinedText.match(/\bsnow\b/gi);
    if (snowMatches) {
      // Specific exclusion for known false positive
      if (combinedText.includes("snow creek rd")) {
        console.log("Excluded 'Snow Creek Rd' from snow hazards");
      } else {
        // Check if there are weather-related terms near "snow"
        const hasWeatherContext = /snow.{0,30}(weather|forecast|warning|advisory|inches|feet|heavy|condition|expect|potential|accumulation|amount|total|depth|fall|coverage)/gi.test(combinedText);

        // Add snow hazard only if it has weather context and doesn't appear to be a place name
        for (const match of snowMatches) {
          if (hasWeatherContext && !isLikelyPlaceName(match)) {
            hazards.add('snow');
            break;
          }
        }
      }
    }

    // Also check for "blizzard" and "winter" with appropriate context
    const blizzardMatch = /\bblizzard\b/gi.test(combinedText);
    if (blizzardMatch && !isLikelyPlaceName("blizzard")) {
      hazards.add('snow');
    }

    const winterMatch = /\bwinter\b/gi.test(combinedText);
    if (winterMatch && /winter.{0,20}(weather|storm|advisory|warning)/gi.test(combinedText) && !isLikelyPlaceName("winter")) {
      hazards.add('snow');
    }
  }

  // Additional check specifically for hurricane but excluding place names
  if (!hazards.has('hurricane')) {
    // If we have "hurricane" by itself, verify it's not a place name by checking context
    const hurricaneMatch = /\bhurricane\b/gi.test(combinedText);

    if (hurricaneMatch) {
      // Look for contextual clues that suggest it's a weather event, not a place
      const weatherContextMatch = /hurricane.{0,30}(warning|watch|advisory|category|mph|wind|storm|evacuat|weather|intensity|eye|cyclone|damage|impact|approach|strength)/gi.test(combinedText);

      // If it has weather context and doesn't appear to be a place name, add it
      if (weatherContextMatch && !isLikelyPlaceName("hurricane")) {
        hazards.add('hurricane');
      }
    }
  }

  return Array.from(hazards);
}

/**
 * Get the primary hazard type from an alert title with improved pattern matching
 * that avoids false positives from place names
 * 
 * @param {string} alertTitle - The alert title
 * @returns {string} - Primary hazard type
 */
function getPrimaryHazardType(alertTitle) {
  const title = alertTitle.toLowerCase();

  // Helper function to check if a term appears to be part of a place name
  const isLikelyPlaceName = (term) => {
    const placePatterns = [
      /(city|town|county|village|district|road|rd\.?|street|st\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|way|blvd\.?|plaza|park)/i,
      /(creek|river|lake|pond|bay|mountain|hill|valley|canyon|ridge)/i
    ];

    // Check if any place name pattern appears near the term
    return placePatterns.some(pattern =>
      new RegExp(term + '\\s+' + pattern.source, 'i').test(title) ||
      new RegExp(pattern.source + '\\s+' + term, 'i').test(title)
    );
  };

  // Check title for primary hazard type with word boundaries
  if (/\btornado\b/.test(title)) return 'tornado';

  // Improved hurricane detection - look for specific weather phrases, not just "hurricane"
  if (/\bhurricane warning\b|\bhurricane watch\b|\btropical storm\b|\bcategory \d hurricane\b/.test(title)) return 'hurricane';

  if (/\bflash flood\b/.test(title)) return 'flood';
  if (/\bthunderstorm\b/.test(title)) return 'thunderstorm';
  if (/\bflood\b/.test(title)) return 'flood';

  // Improved snow detection with context and exclusions
  if (/\b(winter storm|winter weather|heavy snow|snowfall|snowstorm)\b/.test(title)) return 'snow';
  if (/\bsnow\b/.test(title) && !/\bsnow creek\b/.test(title) && !isLikelyPlaceName('snow')) return 'snow';
  if (/\bblizzard\b/.test(title) && !isLikelyPlaceName('blizzard')) return 'snow';

  if (/\bice\b|\bfreezing\b/.test(title)) return 'ice';
  if (/\bwind\b/.test(title)) return 'wind';
  if (/\bheat\b/.test(title)) return 'heat';
  if (/\bcold\b/.test(title)) return 'cold';
  if (/\bfog\b/.test(title)) return 'fog';
  if (/\bdust\b/.test(title)) return 'dust';
  if (/\bsmoke\b/.test(title)) return 'smoke';
  if (/\brain\b/.test(title)) return 'rain';
  if (/\bweather statement\b/.test(title)) return 'special-weather';

  // Extra check for hurricane that's not part of a place name
  if (/\bhurricane\b/.test(title) && !isLikelyPlaceName('hurricane')) {
    return 'hurricane';
  }

  // Default to the first word of the title as a fallback
  const firstWord = title.split(' ')[0];
  return firstWord === 'watch' || firstWord === 'warning' || firstWord === 'advisory'
    ? title.split(' ')[1] || 'unknown'  // If first word is watch/warning, use second word
    : firstWord;  // Otherwise use first word
}

/**
 * Format alert text for better readability
 * @param {string} text - Alert text
 * @returns {string} - Formatted alert text with HTML
 */
function formatAlertText(text) {
  if (!text) return '';

  try {
    // Replace * with bullet points
    text = text.replace(/\*/g, '•');

    // Replace double line breaks with paragraph breaks
    text = text.replace(/\n\n/g, '</p><p>');

    // Replace single line breaks with line breaks
    text = text.replace(/\n/g, '<br>');

    // Wrap the text in paragraphs
    text = `<p>${text}</p>`;

    return text;
  } catch (error) {
    console.error('Error formatting alert text:', error);
    return text; // Return original text if formatting fails
  }
}

/**
 * Capitalize first letter of a string
 * @param {string} str - Input string
 * @returns {string} - String with first letter capitalized
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}