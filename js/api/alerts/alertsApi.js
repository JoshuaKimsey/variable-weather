/**
 * Unified Alert System — LibreWRX API
 *
 * Single alert source backed by the LibreWRX /v2/alerts endpoint, which
 * aggregates WMO CAP alerts worldwide plus NWS for US coverage.
 *
 * Returns the standardized alert format that alertsDisplay.js and radar.js
 * already expect. Contains the central 5-tier severity classifier and
 * hazard detection shared by all alert consumers.
 */

import { ALERT_SEVERITY } from '../../standardWeatherFormat.js';

const ALERTS_ENDPOINT = 'https://api.librewxr.net/v2/alerts';

//==============================================================================
// 1. PUBLIC FETCH FUNCTIONS
//==============================================================================

/**
 * Fetch all active alerts worldwide (no filter).
 * Used by the radar to cache the full dataset and do client-side filtering.
 */
export async function fetchAllAlerts() {
  try {
    const response = await fetch(ALERTS_ENDPOINT);

    if (!response.ok) {
      throw new Error(`LibreWRX alerts responded with status: ${response.status}`);
    }

    const data = await response.json();
    return processAlerts(data.features, true);
  } catch (error) {
    console.error('Error fetching all alerts from LibreWRX:', error);
    return [];
  }
}

/**
 * Fetch alerts for a point location.
 */
export async function fetchAlerts(lat, lon, options = {}) {
  try {
    const url = `${ALERTS_ENDPOINT}?lat=${lat}&lon=${lon}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`LibreWRX alerts responded with status: ${response.status}`);
    }

    const data = await response.json();
    return processAlerts(data.features, false);
  } catch (error) {
    console.error('Error fetching alerts from LibreWRX:', error);
    return [];
  }
}

/**
 * Fetch alerts for a map area (used by radar overlay).
 */
export async function fetchMapAreaAlerts(bounds, options = {}) {
  try {
    const { west, south, east, north } = bounds;
    const url = `${ALERTS_ENDPOINT}?bbox=${west},${south},${east},${north}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`LibreWRX alerts responded with status: ${response.status}`);
    }

    const data = await response.json();
    return processAlerts(data.features, true);
  } catch (error) {
    console.error('Error fetching map area alerts from LibreWRX:', error);
    return [];
  }
}

//==============================================================================
// 2. ALERT PROCESSING
//==============================================================================

/**
 * Map a GeoJSON FeatureCollection to our standardized alert format.
 *
 * @param {Array} features - GeoJSON feature array from LibreWRX
 * @param {boolean} includeGeometry - Whether to include GeoJSON geometry
 * @returns {Array} Standardized alert objects
 */
function processAlerts(features, includeGeometry) {
  if (!features || !Array.isArray(features)) return [];

  return features.map(feature => {
    if (!feature || !feature.properties) return null;

    const props = feature.properties;
    const event = extractEventFromTitle(props.title || 'Weather Alert');

    const standardAlert = {
      id: props.uri || `librewxr-alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: event,
      description: props.title || '',
      fullText: props.description || '',
      severity: determineAlertSeverity(event, props.title || '', props.description || ''),
      urgency: deriveUrgency(event),
      expires: props.expires ? new Date(props.expires * 1000) : null,
      hazardTypes: identifyAlertHazards(props.title || '', props.description || ''),
      primaryHazard: getPrimaryHazardType(event),
      source: 'librewxr'
    };

    if (includeGeometry && feature.geometry) {
      standardAlert.geometry = feature.geometry;
    }

    return standardAlert;
  }).filter(alert => alert !== null);
}

//==============================================================================
// 3. TITLE PARSING
//==============================================================================

/**
 * Extract the raw event type from a LibreWRX headline.
 *
 * LibreWRX titles follow the pattern:
 *   "EventType issued Month Day at Time [by Source]"
 *
 * e.g. "Tornado Watch issued May 7 at 12:15AM CDT by NWS Birmingham AL"
 *   → "Tornado Watch"
 *
 * @param {string} title - Full alert headline
 * @returns {string} - Extracted event type
 */
function extractEventFromTitle(title) {
  const issuedIdx = title.toLowerCase().indexOf(' issued ');
  if (issuedIdx !== -1) {
    return title.substring(0, issuedIdx);
  }
  return title;
}

//==============================================================================
// 4. FIVE-TIER SEVERITY CLASSIFICATION
//==============================================================================

/**
 * Classify an alert into our 5-tier system based on event type and content.
 *
 *   emergency – immediate, catastrophic, life-saving action required
 *   extreme   – imminent threat to life and property
 *   severe    – significant threat (most warnings)
 *   moderate  – possible threat (most watches, plus freeze warnings)
 *   minor     – low-impact advisories/statements
 *
 * @param {string} event       - Raw event type (e.g. "Tornado Watch")
 * @param {string} title       - Full headline text
 * @param {string} description - Full alert description
 * @returns {string} Standardized severity level
 */
function determineAlertSeverity(event, title, description) {
  const e = event.toLowerCase();
  const combined = `${title} ${description}`.toLowerCase();

  // 1. Emergency
  if (
    e.includes('extreme wind warning') ||
    combined.includes('tornado emergency') ||
    combined.includes('flash flood emergency') ||
    combined.includes('particularly dangerous situation')
  ) {
    return ALERT_SEVERITY.EMERGENCY;
  }

  // 2. Extreme — imminent threat warnings.
  if (
    e.includes('tornado warning') ||
    e.includes('hurricane warning') ||
    e.includes('flash flood warning') ||
    e.includes('tsunami warning') ||
    e.includes('storm surge warning')
  ) {
    return ALERT_SEVERITY.EXTREME;
  }

  // 3. Freeze Warning → Moderate (southern offices issue these for any sub-32°F night)
  if (e.includes('freeze warning')) {
    return ALERT_SEVERITY.MODERATE;
  }

  //    Storm Surge Watch → Severe (promoted from watch)
  if (e.includes('storm surge watch')) {
    return ALERT_SEVERITY.SEVERE;
  }

  // 4. Minor — advisories, statements, outlooks.
  if (
    e.includes('special weather statement') ||
    e.includes('hazardous weather outlook') ||
    e.includes('air quality alert') ||
    e.includes('hydrologic outlook') ||
    e.includes('beach hazards statement') ||
    e.includes('urban and small stream') ||
    e.includes('lake wind advisory') ||
    e.includes('short term forecast') ||
    e.includes('advisory') ||
    e.includes('statement')
  ) {
    return ALERT_SEVERITY.MINOR;
  }

  // 5. Severe — every other warning.
  if (e.includes('warning')) {
    return ALERT_SEVERITY.SEVERE;
  }

  // 6. Moderate — every other watch.
  if (e.includes('watch')) {
    return ALERT_SEVERITY.MODERATE;
  }

  return ALERT_SEVERITY.MODERATE;
}

//==============================================================================
// 5. URGENCY DERIVATION
//==============================================================================

/**
 * Derive an urgency label from the event type.
 *
 * @param {string} event - Raw event type
 * @returns {string} Urgency label
 */
function deriveUrgency(event) {
  const e = event.toLowerCase();
  if (e.includes('warning')) return 'Immediate';
  if (e.includes('watch')) return 'Expected';
  if (e.includes('advisory') || e.includes('statement')) return 'Expected';
  return 'Expected';
}

//==============================================================================
// 6. HAZARD DETECTION
//==============================================================================

/**
 * Identify all hazard types mentioned in an alert.
 * Uses word-boundary matching with place-name false-positive detection.
 *
 * @param {string} alertTitle - Alert title/headline
 * @param {string} fullDescription - Full alert description text
 * @returns {Array} Identified hazard types
 */
function identifyAlertHazards(alertTitle, fullDescription) {
  const hazards = new Set();
  const combinedText = (alertTitle + ' ' + fullDescription).toLowerCase();

  const placeNamePatterns = [
    /\b(road|rd\.?|street|st\.?|ave\.?|avenue|ln\.?|lane|blvd\.?|boulevard|dr\.?|drive|way|place|pl\.?|parkway|pkwy\.?|highway|hwy\.?)\b/i,
    /\b(city|town|county|village|district|neighborhood|park|plaza|center|square|region|area|zone)\b/i,
    /\b(creek|river|lake|pond|bay|mountain|hill|valley|canyon|ridge|peak|summit|basin)\b/i
  ];

  const isLikelyPlaceName = (matchText, context = 50) => {
    const matchIndex = combinedText.indexOf(matchText.toLowerCase());
    if (matchIndex === -1) return false;
    const start = Math.max(0, matchIndex - context);
    const end = Math.min(combinedText.length, matchIndex + matchText.length + context);
    const surroundingContext = combinedText.substring(start, end);
    return placeNamePatterns.some(pattern => pattern.test(surroundingContext));
  };

  const hazardPatterns = [
    { pattern: /\btornado\b/g, type: 'tornado' },
    { pattern: /\bhail\b/g, type: 'hail' },
    { pattern: /\bflash flood\b|\bflooding\b|\bflood\b/g, type: 'flood' },
    { pattern: /\bthunder\b|\bthunderstorm\b|\bsevere thunderstorm\b/g, type: 'thunderstorm' },
    { pattern: /\blightning\b/g, type: 'lightning' },
    { pattern: /\bfire weather\b|\bred flag\b|\bwildfire\b|\bfire warning\b|\bextreme fire\b/g, type: 'fire' },
    { pattern: /\bair quality\b|\bair stagnation\b|\bsmoke advisory\b|\bparticulate\b/g, type: 'air-quality' },
    { pattern: /\bavalanche\b/g, type: 'avalanche' },
    { pattern: /\bstorm surge\b|\bcoastal flood\b/g, type: 'surge' },
    { pattern: /\btsunami\b/g, type: 'tsunami' },
    { pattern: /\bsmall craft\b|\bgale warning\b|\bmarine warning\b|\bmarine weather\b|\bbeach hazard\b|\brip current\b|\bhigh surf\b/g, type: 'marine' },
    { pattern: /\b(?:winter storm|winter weather|heavy snow|snowfall|snow accumulation|snow and ice|snow advisory|snow warning|snow emergency|snowstorm|snow covered|snow level)\b/gi, type: 'snow' },
    { pattern: /\bice storm\b|\bsleet\b|\bfreezing rain\b|\bfreezing drizzle\b|\bice pellets\b/g, type: 'ice' },
    { pattern: /\bfreeze\b|\bfreezing\b|\bfrost\b|\bsub-freezing\b/g, type: 'cold' },
    { pattern: /\bwind\b|\bgust\b|\bstrong winds\b/g, type: 'wind' },
    { pattern: /\bdust\b/g, type: 'dust' },
    { pattern: /\bsmoke\b/g, type: 'smoke' },
    { pattern: /\bfog\b/g, type: 'fog' },
    { pattern: /\bheat\b/g, type: 'heat' },
    { pattern: /\bcold\b|\bchill\b|\bwind chill\b|\bhypothermia\b/g, type: 'cold' },
    { pattern: /\brain\b|\bshower\b/g, type: 'rain' },
    { pattern: /\b(?:hurricane warning|hurricane watch|hurricane advisory|hurricane threat|approaching hurricane|major hurricane|potential hurricane|category \d hurricane|hurricane force|tropical storm|tropical cyclone|tropical depression)\b/g, type: 'hurricane' }
  ];

  hazardPatterns.forEach(({ pattern, type }) => {
    if (pattern.test(combinedText)) {
      hazards.add(type);
    }
  });

  if (!hazards.has('snow')) {
    const snowMatches = combinedText.match(/\bsnow\b/gi);
    if (snowMatches) {
      if (combinedText.includes('snow creek rd')) {
        console.log("Excluded 'Snow Creek Rd' from snow hazards");
      } else {
        const hasWeatherContext = /snow.{0,30}(weather|forecast|warning|advisory|inches|feet|heavy|condition|expect|potential|accumulation|amount|total|depth|fall|coverage)/gi.test(combinedText);
        for (const match of snowMatches) {
          if (hasWeatherContext && !isLikelyPlaceName(match)) {
            hazards.add('snow');
            break;
          }
        }
      }
    }

    const blizzardMatch = /\bblizzard\b/gi.test(combinedText);
    if (blizzardMatch && !isLikelyPlaceName('blizzard')) {
      hazards.add('snow');
    }

    const winterMatch = /\bwinter\b/gi.test(combinedText);
    if (winterMatch && /winter.{0,20}(weather|storm|advisory|warning)/gi.test(combinedText) && !isLikelyPlaceName('winter')) {
      hazards.add('snow');
    }
  }

  if (!hazards.has('hurricane')) {
    const hurricaneMatch = /\bhurricane\b/gi.test(combinedText);
    if (hurricaneMatch) {
      const weatherContextMatch = /hurricane.{0,30}(warning|watch|advisory|category|mph|wind|storm|evacuat|weather|intensity|eye|cyclone|damage|impact|approach|strength)/gi.test(combinedText);
      if (weatherContextMatch && !isLikelyPlaceName('hurricane')) {
        hazards.add('hurricane');
      }
    }
  }

  return Array.from(hazards);
}

/**
 * Get the primary hazard type from an alert title.
 * Uses word-boundary matching with place-name false-positive detection.
 *
 * @param {string} eventType - Raw event type (e.g. "Tornado Watch")
 * @returns {string} - Primary hazard type
 */
function getPrimaryHazardType(eventType) {
  const title = eventType.toLowerCase();

  const isLikelyPlaceName = (term) => {
    const placePatterns = [
      /(city|town|county|village|district|road|rd\.?|street|st\.?|avenue|ave\.?|lane|ln\.?|drive|dr\.?|way|blvd\.?|plaza|park)/i,
      /(creek|river|lake|pond|bay|mountain|hill|valley|canyon|ridge)/i
    ];
    return placePatterns.some(pattern =>
      new RegExp(term + '\\s+' + pattern.source, 'i').test(title) ||
      new RegExp(pattern.source + '\\s+' + term, 'i').test(title)
    );
  };

  if (/\btornado\b/.test(title)) return 'tornado';
  if (/\btsunami\b/.test(title)) return 'tsunami';
  if (/\bhurricane warning\b|\bhurricane watch\b|\btropical storm\b|\bcategory \d hurricane\b/.test(title)) return 'hurricane';
  if (/\bstorm surge\b|\bcoastal flood\b/.test(title)) return 'surge';
  if (/\bfire weather\b|\bred flag\b|\bwildfire\b|\bextreme fire\b/.test(title)) return 'fire';
  if (/\bair quality\b|\bair stagnation\b|\bsmoke advisory\b/.test(title)) return 'air-quality';
  if (/\bavalanche\b/.test(title)) return 'avalanche';
  if (/\bsmall craft\b|\bgale warning\b|\bmarine warning\b|\bmarine weather\b|\bbeach hazard\b|\brip current\b|\bhigh surf\b/.test(title)) return 'marine';
  if (/\bflash flood\b/.test(title)) return 'flood';
  if (/\bthunderstorm\b/.test(title)) return 'thunderstorm';
  if (/\blightning\b/.test(title)) return 'lightning';
  if (/\bflood\b/.test(title)) return 'flood';
  if (/\b(winter storm|winter weather|heavy snow|snowfall|snowstorm)\b/.test(title)) return 'snow';
  if (/\bsnow\b/.test(title) && !/\bsnow creek\b/.test(title) && !isLikelyPlaceName('snow')) return 'snow';
  if (/\bblizzard\b/.test(title) && !isLikelyPlaceName('blizzard')) return 'snow';
  if (/\bice\b|\bfreezing rain\b|\bfreezing drizzle\b|\bice storm\b/.test(title)) return 'ice';
  if (/\bfreeze\b|\bfreezing\b|\bfrost\b/.test(title)) return 'cold';
  if (/\bwind\b/.test(title)) return 'wind';
  if (/\bheat\b/.test(title)) return 'heat';
  if (/\bcold\b/.test(title)) return 'cold';
  if (/\bfog\b/.test(title)) return 'fog';
  if (/\bdust\b/.test(title)) return 'dust';
  if (/\bsmoke\b/.test(title)) return 'smoke';
  if (/\brain\b/.test(title)) return 'rain';
  if (/\bweather statement\b/.test(title)) return 'special-weather';

  if (/\bhurricane\b/.test(title) && !isLikelyPlaceName('hurricane')) {
    return 'hurricane';
  }

  const firstWord = title.split(' ')[0];
  return firstWord === 'watch' || firstWord === 'warning' || firstWord === 'advisory'
    ? title.split(' ')[1] || 'unknown'
    : firstWord;
}
