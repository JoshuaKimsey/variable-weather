/**
 * Astronomical information module for the weather app UI components
 * Provides visualization for sun/moon data and Polar Clock
 */

import {
    calculateSunTimes,
    calculateMoonPhase,
    isDaytime
} from '../../utils/astroCalc.js';

import { loadComponentCSS } from '../../utils/cssLoader.js';

// Global resize handler reference to allow for cleanup
let resizeHandler = null;

// Module state
let currentAstroData = null;
let isInitialized = false;
let pendingUpdate = null;
let containerId = 'astro-view'; // Default container ID

//==============================================================================
// 1. PUBLIC API AND EXPORTED FUNCTIONS
//==============================================================================

/**
 * Initialize the astronomical display with resize handling
 * @param {string} containerElementId - ID of the container element
 */
export function initAstro(containerElementId) {

    loadComponentCSS('./styles/astronomical.css').catch(error => console.warn('Failed to load astronomical styles:', error));

    // Store the container ID for future reference
    containerId = containerElementId;

    // This is just initialization, actual display happens in updateAstroInfo
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Astro container not found in DOM');
        return;
    }

    // Initialize with loading message and spinner
    container.innerHTML = `
        <div class="astro-loading">
            <div class="astro-loading-spinner">
                <div></div>
                <div></div>
                <div></div>
            </div>
            <div>Loading sun & moon data...</div>
        </div>
    `;

    // Mark as initialized
    isInitialized = true;

    // Setup resize handling
    setupResizeHandling();

    // Process any pending update that came in before initialization
    if (pendingUpdate) {
        const { lat, lon } = pendingUpdate;
        pendingUpdate = null;
        updateAstroInfo(lat, lon);
    }
}

/**
 * Update astronomical information for a location
 */
export function updateAstroInfo(lat, lon) {
    // If not initialized yet, store the update for later
    if (!isInitialized) {
        console.log('Astro not initialized yet, storing update for later');
        pendingUpdate = { lat, lon };
        return;
    }

    // Get the container
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Astro container not found in DOM');
        return;
    }

    // First, display loading state to indicate an update is happening
    container.innerHTML = `
        <div class="astro-content-wrapper">
            <div class="astro-loading">
                <div class="astro-loading-spinner">
                    <div></div>
                    <div></div>
                    <div></div>
                </div>
                <div>Updating sun & moon data...</div>
            </div>
        </div>
    `;

    // Use a small timeout to ensure the DOM updates with the loading state
    // before we calculate and render the new data
    setTimeout(() => {
        // Calculate astronomical data
        try {
            const astroData = calculateSunTimes(lat, lon);
            // Store latitude and longitude for moon calculations
            astroData.latitude = lat;
            astroData.longitude = lon;
            currentAstroData = astroData;

            // Create the wrapper first
            container.innerHTML = '<div class="astro-content-wrapper"></div>';
            const contentWrapper = container.querySelector('.astro-content-wrapper');

            // Update with both sun position and moon phase visualizations
            updateAstronomicalDisplay(contentWrapper);
        } catch (error) {
            console.error('Error calculating astronomical data:', error);
            container.innerHTML = `
                <div class="astro-content-wrapper">
                    <div class="astro-error">Unable to calculate sunrise/sunset times</div>
                </div>
            `;
        }
    }, 50);
}

/**
 * Update the astronomical display with current data
 * @param {HTMLElement} container - The container element
 */
function updateAstronomicalDisplay(container) {
    // Clear the container first
    container.innerHTML = '';

    try {
        // Calculate moon phase data
        const moonData = calculateMoonPhase();

        // Update with both sun and moon data integrated into one visualization
        createPolarClock(container, currentAstroData, moonData);

    } catch (error) {
        console.error('Error calculating astronomical data:', error);
        container.innerHTML = `
            <div class="astro-error">Unable to calculate astronomical data</div>
        `;
    }
}

/**
 * Refresh the astronomical display
 * Used for auto-updates or when the user changes location
 */
export function refreshAstroDisplay() {
    // Get current coordinates from URL
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get('lat');
    const lon = urlParams.get('lon');

    if (lat && lon) {
        // Force a new calculation to avoid using cached data
        updateAstroInfo(parseFloat(lat), parseFloat(lon));
    } else {
        console.warn('Cannot refresh astro display - no coordinates in URL');
    }
}

/**
 * Handle location changes from other components
 */
export function locationChanged(lat, lon) {
    if (isInitialized) {
        updateAstroInfo(lat, lon);
    } else {
        pendingUpdate = { lat, lon };
    }
}

/**
 * Improved resize handling function for better scaling
 */
function setupResizeHandling() {
    // Clean up any existing handler first
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
    }

    // Create a debounced resize handler
    resizeHandler = debounce(() => {
        // Only redraw if we have data
        if (currentAstroData && isInitialized) {
            const container = document.getElementById(containerId);
            if (container) {
                // Redraw the visualization with current data
                const contentWrapper = container.querySelector('.astro-content-wrapper');
                if (contentWrapper) {
                    updateAstronomicalDisplay(contentWrapper);
                } else {
                    // If wrapper doesn't exist, create it
                    container.innerHTML = '<div class="astro-content-wrapper"></div>';
                    updateAstronomicalDisplay(container.querySelector('.astro-content-wrapper'));
                }
            }
        }
    }, 250); // 250ms debounce time

    // Add the event listener
    window.addEventListener('resize', resizeHandler);
}

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - The function to debounce
 * @param {number} wait - Time to wait in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Clean up the astronomical display resources
 */
export function cleanupAstro() {
    // Remove resize handler
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
    }

    // Reset state
    isInitialized = false;
    currentAstroData = null;
    pendingUpdate = null;
}

/**
 * Check if it's currently daytime at a location
 * Re-exports the function from astroCalc.js for backward compatibility
 */
export { isDaytime };

// Add hooks for manual refreshing
window.refreshAstronomicalDisplay = refreshAstroDisplay;

// Force recalculation on demand
window.forceAstroRecalculation = function () {
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get('lat');
    const lon = urlParams.get('lon');

    if (lat && lon) {
        // Clear any cached data
        currentAstroData = null;
        updateAstroInfo(parseFloat(lat), parseFloat(lon));
        return "Recalculation triggered";
    } else {
        return "No coordinates found in URL";
    }
};

//==============================================================================
// 2. POLAR CLOCK VISUALIZATION
//==============================================================================

/**
 * Create a polar clock visualization for astronomical data
 * @param {HTMLElement} container - DOM element to append the visualization to
 * @param {Object} sunData - Sun position information
 * @param {Object} moonData - Moon phase information
 */

/**
 * Create a polar clock visualization for astronomical data
 * @param {HTMLElement} container - DOM element to append the visualization to
 * @param {Object} sunData - Sun position information
 * @param {Object} moonData - Moon phase information
 */
function createPolarClock(container, sunData, moonData) {
    // Clear existing content
    container.innerHTML = '';

    // Get dimensions to ensure the clock is responsive
    const containerRect = container.getBoundingClientRect();
    const width = containerRect.width || 400;
    const height = containerRect.height || 400;

    // Calculate the minimum dimension to make sure our clock fits
    const minDim = Math.min(width, height);
    const clockRadius = minDim * 0.42; // 42% of the minimum dimension

    // Create SVG element with viewBox for better scaling
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("class", "polar-clock");

    // Center coordinates 
    const centerX = width / 2;
    const centerY = height / 2;

    // Add a unique ID to ensure filters and gradients don't conflict
    const uniqueId = `astro-clock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Special case handling for polar day/night
    if (sunData.isPolarDay || sunData.isPolarNight) {
        createPolarDayNightVisualization(svg, width, height, sunData.isPolarDay);
        container.appendChild(svg);

        // We'll still add the moon phase to the visualization
        addMoonPhaseToSVG(svg, centerX, centerY * 1.5, clockRadius * 0.4, moonData, uniqueId);
        return;
    }

    //-------------------------------------------
    // Create defs section for filters
    //-------------------------------------------
    const defs = document.createElementNS(svgNS, "defs");

    /* 
    // COMMENTED OUT: Day gradient code
    // Create gradient for day arc with enhanced sunrise/sunset colors
    const dayGradient = document.createElementNS(svgNS, "linearGradient");
    dayGradient.setAttribute("id", `dayGradient-${uniqueId}`);
    dayGradient.setAttribute("x1", "0%");
    dayGradient.setAttribute("y1", "0%");
    dayGradient.setAttribute("x2", "100%");
    dayGradient.setAttribute("y2", "0%");

    // Get sunrise and sunset times
    let sunriseHour = 6, sunsetHour = 18; // Default fallbacks
    
    if (sunData.sunrise && sunData.sunset) {
        sunriseHour = sunData.sunrise.getHours() + sunData.sunrise.getMinutes() / 60;
        sunsetHour = sunData.sunset.getHours() + sunData.sunset.getMinutes() / 60;
        
        // Handle case where sunset is on next day (crosses midnight)
        if (sunsetHour < sunriseHour) {
            sunsetHour += 24;
        }
    }
    
    // Calculate the total day duration in hours
    const dayDuration = sunsetHour - sunriseHour;
    
    // Initialize golden hour times with estimates
    let goldenDawnEndHour = sunriseHour + (dayDuration * 0.15); // Default: 15% after sunrise
    let goldenDuskStartHour = sunsetHour - (dayDuration * 0.15); // Default: 15% before sunset
    
    // Extract actual golden hour times if available from SunCalc3
    // First try to access them directly from sunData
    if (sunData.goldenHourDawnEnd instanceof Date) {
        goldenDawnEndHour = sunData.goldenHourDawnEnd.getHours() + 
                            sunData.goldenHourDawnEnd.getMinutes() / 60;
    }
    
    if (sunData.goldenHourDuskStart instanceof Date) {
        goldenDuskStartHour = sunData.goldenHourDuskStart.getHours() + 
                             sunData.goldenHourDuskStart.getMinutes() / 60;
    }
    
    // If not found directly, try the sunTimes object
    else if (sunData.sunTimes) {
        if (sunData.sunTimes.goldenHourDawnEnd && 
            sunData.sunTimes.goldenHourDawnEnd.value instanceof Date) {
            goldenDawnEndHour = sunData.sunTimes.goldenHourDawnEnd.value.getHours() + 
                              sunData.sunTimes.goldenHourDawnEnd.value.getMinutes() / 60;
        }
        
        if (sunData.sunTimes.goldenHourDuskStart && 
            sunData.sunTimes.goldenHourDuskStart.value instanceof Date) {
            goldenDuskStartHour = sunData.sunTimes.goldenHourDuskStart.value.getHours() + 
                                sunData.sunTimes.goldenHourDuskStart.value.getMinutes() / 60;
        }
    }
    
    // Calculate percentages for gradient stops based on the day length
    const sunriseStartPct = 0;
    const goldenDawnEndPct = ((goldenDawnEndHour - sunriseHour) / dayDuration) * 100;
    const goldenDuskStartPct = ((goldenDuskStartHour - sunriseHour) / dayDuration) * 100;
    const sunsetEndPct = 100;
    
    // Sunrise start - deep orange
    const stop1 = document.createElementNS(svgNS, "stop");
    stop1.setAttribute("offset", `${sunriseStartPct}%`);
    stop1.setAttribute("stop-color", "#FF7F50"); // Coral orange for sunrise

    // After golden hour dawn - blue
    const stop2 = document.createElementNS(svgNS, "stop");
    stop2.setAttribute("offset", `${goldenDawnEndPct}%`);
    stop2.setAttribute("stop-color", "#4A90E2");

    // Before golden hour dusk - blue
    const stop3 = document.createElementNS(svgNS, "stop");
    stop3.setAttribute("offset", `${goldenDuskStartPct}%`);
    stop3.setAttribute("stop-color", "#4A90E2");

    // Sunset - deep red-orange
    const stop4 = document.createElementNS(svgNS, "stop");
    stop4.setAttribute("offset", `${sunsetEndPct}%`);
    stop4.setAttribute("stop-color", "#FF4500"); // OrangeRed for sunset

    dayGradient.appendChild(stop1);
    dayGradient.appendChild(stop2);
    dayGradient.appendChild(stop3);
    dayGradient.appendChild(stop4);
    defs.appendChild(dayGradient);
    */

    // Create gradient for night arc
    const nightGradient = document.createElementNS(svgNS, "linearGradient");
    nightGradient.setAttribute("id", `nightGradient-${uniqueId}`);
    nightGradient.setAttribute("x1", "0%");
    nightGradient.setAttribute("y1", "0%");
    nightGradient.setAttribute("x2", "100%");
    nightGradient.setAttribute("y2", "0%");

    // Evening twilight
    const nightStop1 = document.createElementNS(svgNS, "stop");
    nightStop1.setAttribute("offset", "0%");
    nightStop1.setAttribute("stop-color", "#121620");

    // Deep night
    const nightStop2 = document.createElementNS(svgNS, "stop");
    nightStop2.setAttribute("offset", "50%");
    nightStop2.setAttribute("stop-color", "#0F2027");

    // Dawn twilight
    const nightStop3 = document.createElementNS(svgNS, "stop");
    nightStop3.setAttribute("offset", "100%");
    nightStop3.setAttribute("stop-color", "#121620");

    nightGradient.appendChild(nightStop1);
    nightGradient.appendChild(nightStop2);
    nightGradient.appendChild(nightStop3);
    defs.appendChild(nightGradient);

    // Sun glow filter
    const sunFilter = document.createElementNS(svgNS, "filter");
    sunFilter.setAttribute("id", `sun-glow-${uniqueId}`);
    sunFilter.setAttribute("x", "-50%");
    sunFilter.setAttribute("y", "-50%");
    sunFilter.setAttribute("width", "200%");
    sunFilter.setAttribute("height", "200%");

    const sunGaussianBlur = document.createElementNS(svgNS, "feGaussianBlur");
    sunGaussianBlur.setAttribute("in", "SourceGraphic");
    sunGaussianBlur.setAttribute("stdDeviation", "2");
    sunGaussianBlur.setAttribute("result", "blur");
    sunFilter.appendChild(sunGaussianBlur);

    defs.appendChild(sunFilter);
    svg.appendChild(defs);

    //-------------------------------------------
    // Create the clock background and borders
    //-------------------------------------------

    // Create the background circle
    const bgCircle = document.createElementNS(svgNS, "circle");
    bgCircle.setAttribute("cx", centerX);
    bgCircle.setAttribute("cy", centerY);
    bgCircle.setAttribute("r", clockRadius);
    bgCircle.setAttribute("fill", "#121826");
    bgCircle.setAttribute("stroke", "rgba(255, 255, 255, 0.1)");
    bgCircle.setAttribute("stroke-width", "1");
    svg.appendChild(bgCircle);

    // Parse the sunrise and sunset times from the data
    let sunriseHour = 6, sunsetHour = 18; // Default fallbacks
    let sunriseAngle, sunsetAngle;

    // Get current local time in decimal hours
    const now = new Date();
    const locationTime = sunData.locationTime || (now.getHours() + now.getMinutes() / 60);

    // Replace this entire section in createPolarClock() function
    if (sunData.sunrise && sunData.sunset) {
        // Get sunrise and sunset hours using tz-lookup
        let sunriseHour, sunsetHour;

        // Determine timezone using tzlookup with the location's coordinates
        let timezone = 'UTC';
        try {
            if (typeof window.tzlookup === 'function') {
                // Pass latitude and longitude in the correct order for tzlookup (lat, lon)
                timezone = window.tzlookup(sunData.latitude, sunData.longitude);
            }
        } catch (e) {
            console.warn('Timezone lookup failed:', e);
        }

        try {
            if (timezone !== 'UTC' && timezone) {
                // Format the dates in the location's timezone using Intl API
                const options = {
                    timeZone: timezone,
                    hour12: false,
                    hour: 'numeric',
                    minute: 'numeric'
                };

                // Get formatted time strings in the target timezone
                const srTime = sunData.sunrise.toLocaleString('en-US', options);
                const ssTime = sunData.sunset.toLocaleString('en-US', options);

                // Parse the time strings into hours and minutes
                const [srHours, srMinutes] = srTime.split(':').map(Number);
                const [ssHours, ssMinutes] = ssTime.split(':').map(Number);

                // Convert to decimal hours (in the local timezone)
                sunriseHour = srHours + (srMinutes / 60);
                sunsetHour = ssHours + (ssMinutes / 60);

                // console.log(`Using timezone ${timezone} - Sunrise: ${srTime}, Sunset: ${ssTime}`);

                // Update the formatted times for display
                sunData.formattedSunrise = new Date(sunData.sunrise).toLocaleString('en-US', {
                    timeZone: timezone,
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });

                sunData.formattedSunset = new Date(sunData.sunset).toLocaleString('en-US', {
                    timeZone: timezone,
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
            } else {
                // Fallback to longitude-based timezone approximation
                const sunriseUTC = sunData.sunrise.getUTCHours() + (sunData.sunrise.getUTCMinutes() / 60);
                const sunsetUTC = sunData.sunset.getUTCHours() + (sunData.sunset.getUTCMinutes() / 60);
                const tzOffset = sunData.longitude / 15; // 15° longitude = 1 hour offset

                sunriseHour = ((sunriseUTC + tzOffset) % 24 + 24) % 24;
                sunsetHour = ((sunsetUTC + tzOffset) % 24 + 24) % 24;

                console.log(`Using longitude-based timezone - Sunrise: ${sunriseHour.toFixed(2)}, Sunset: ${sunsetHour.toFixed(2)}`);
            }
        } catch (e) {
            console.error('Error formatting timezone-specific times:', e);
            // Ultimate fallback - use raw Date objects (not ideal, but prevents complete failure)
            sunriseHour = sunData.sunrise.getHours() + (sunData.sunrise.getMinutes() / 60);
            sunsetHour = sunData.sunset.getHours() + (sunData.sunset.getMinutes() / 60);
        }

        // Handle case where sunset is on next day (crosses midnight)
        if (sunsetHour < sunriseHour) {
            sunsetHour += 24;
        }

        // IMPORTANT FIX: The clock display needs these values to be in the range 0-24
        // Calculate angles (0 degrees is at the top, clockwise)
        sunriseAngle = (sunriseHour / 24) * 360;
        sunsetAngle = (sunsetHour / 24) * 360;
    } else {
        // Default values if sunrise/sunset data isn't available
        sunriseAngle = 90;
        sunsetAngle = 270;
    }

    // Calculate the day and night arcs
    const dayArcLength = (sunsetHour - sunriseHour) / 24 * 360;
    const nightArcLength = 360 - dayArcLength;

    //-------------------------------------------
    // Draw the day and night arcs
    //-------------------------------------------

    // Draw the day arc (from sunrise to sunset)
    const dayArc = document.createElementNS(svgNS, "path");
    const dayArcRadius = clockRadius * 0.85;

    // Calculate the arc path
    // We'll rotate everything so noon is at the top and midnight at the bottom
    const midnightOffset = 90; // Start at the bottom (midnight)

    // Calculate arc start and end points
    const dayStart = sunriseAngle + midnightOffset;
    const dayEnd = sunsetAngle + midnightOffset;

    // Convert to radians for calculations
    const dayStartRad = (dayStart * Math.PI) / 180;
    const dayEndRad = (dayEnd * Math.PI) / 180;

    // Calculate points on the arc
    const dayStartX = centerX + dayArcRadius * Math.cos(dayStartRad);
    const dayStartY = centerY + dayArcRadius * Math.sin(dayStartRad);
    const dayEndX = centerX + dayArcRadius * Math.cos(dayEndRad);
    const dayEndY = centerY + dayArcRadius * Math.sin(dayEndRad);

    // Define the arc path (large arc flag depends on whether the angle > 180°)
    const largeArcFlagDay = dayArcLength > 180 ? 1 : 0;
    dayArc.setAttribute("d", `M ${dayStartX} ${dayStartY} A ${dayArcRadius} ${dayArcRadius} 0 ${largeArcFlagDay} 1 ${dayEndX} ${dayEndY}`);
    dayArc.setAttribute("fill", "none");
    // Use a solid color instead of gradient
    dayArc.setAttribute("stroke", "#4A90E2"); // Solid blue color for day arc
    dayArc.setAttribute("stroke-width", clockRadius * 0.07);
    dayArc.setAttribute("stroke-linecap", "round");
    svg.appendChild(dayArc);

    // Draw the night arc (from sunset to sunrise)
    const nightArc = document.createElementNS(svgNS, "path");
    const nightArcRadius = dayArcRadius;

    // Night arc goes from sunset to sunrise (potentially crossing midnight)
    const nightStart = dayEnd;
    const nightEnd = dayStart + 360; // Ensure we go the long way around

    // Convert to radians
    const nightStartRad = (nightStart * Math.PI) / 180;
    const nightEndRad = (nightEnd * Math.PI) / 180;

    // Calculate points
    const nightStartX = centerX + nightArcRadius * Math.cos(nightStartRad);
    const nightStartY = centerY + nightArcRadius * Math.sin(nightStartRad);
    const nightEndX = centerX + nightArcRadius * Math.cos(nightEndRad);
    const nightEndY = centerY + nightArcRadius * Math.sin(nightEndRad);

    // Define night arc path
    const largeArcFlagNight = nightArcLength > 180 ? 1 : 0;
    nightArc.setAttribute("d", `M ${nightStartX} ${nightStartY} A ${nightArcRadius} ${nightArcRadius} 0 ${largeArcFlagNight} 1 ${nightEndX} ${nightEndY}`);
    nightArc.setAttribute("fill", "none");
    nightArc.setAttribute("stroke", `url(#nightGradient-${uniqueId})`);
    nightArc.setAttribute("stroke-width", clockRadius * 0.07);
    nightArc.setAttribute("stroke-linecap", "round");
    svg.appendChild(nightArc);

    //-------------------------------------------
    // Add hour tick marks
    //-------------------------------------------
    const tickGroup = document.createElementNS(svgNS, "g");
    const tickRadius = clockRadius * 0.95;
    const majorTickLength = clockRadius * 0.08;
    const minorTickLength = clockRadius * 0.04;

    for (let hour = 0; hour < 24; hour++) {
        const angle = ((hour / 24) * 360 + midnightOffset) * (Math.PI / 180);
        // Make major ticks at 12am, 6am, 12pm, and 6pm for better readability with the new orientation
        const isMajor = hour % 6 === 0; // Major tick every 6 hours

        const outerX = centerX + tickRadius * Math.cos(angle);
        const outerY = centerY + tickRadius * Math.sin(angle);

        const innerX = centerX + (tickRadius - (isMajor ? majorTickLength : minorTickLength)) * Math.cos(angle);
        const innerY = centerY + (tickRadius - (isMajor ? majorTickLength : minorTickLength)) * Math.sin(angle);

        const tick = document.createElementNS(svgNS, "line");
        tick.setAttribute("x1", outerX);
        tick.setAttribute("y1", outerY);
        tick.setAttribute("x2", innerX);
        tick.setAttribute("y2", innerY);
        tick.setAttribute("stroke", "rgba(255, 255, 255, 0.5)");
        tick.setAttribute("stroke-width", isMajor ? 2 : 1);
        tickGroup.appendChild(tick);

        // Add hour labels for major ticks
        if (isMajor) {
            const labelRadius = tickRadius - majorTickLength - 10;
            const labelX = centerX + labelRadius * Math.cos(angle);
            const labelY = centerY + labelRadius * Math.sin(angle);

            const hourLabel = document.createElementNS(svgNS, "text");
            hourLabel.setAttribute("x", labelX);
            hourLabel.setAttribute("y", labelY);
            hourLabel.setAttribute("text-anchor", "middle");
            hourLabel.setAttribute("dominant-baseline", "middle");
            hourLabel.setAttribute("fill", "rgba(255, 255, 255, 0.7)");
            hourLabel.setAttribute("font-size", "12px");

            // Format hour label - convert 24h to 12h format with AM/PM
            const hour12 = hour % 12 || 12;
            const ampm = hour < 12 ? "AM" : "PM";
            hourLabel.textContent = `${hour12}${ampm}`;

            tickGroup.appendChild(hourLabel);
        }
    }

    svg.appendChild(tickGroup);

    //-------------------------------------------
    // Add sunrise and sunset indicators
    //-------------------------------------------

    // Add a small sun icon for sunrise
    const sunriseIcon = createSunIcon(svgNS, uniqueId, centerX, centerY, sunriseAngle + midnightOffset, dayArcRadius, clockRadius * 0.08);
    svg.appendChild(sunriseIcon);

    // Add a small sun icon for sunset
    const sunsetIcon = createSunIcon(svgNS, uniqueId, centerX, centerY, sunsetAngle + midnightOffset, dayArcRadius, clockRadius * 0.08);
    svg.appendChild(sunsetIcon);

    // Add sunrise/sunset time labels
    const sunriseLabel = document.createElementNS(svgNS, "text");
    const sunriseLabelAngle = dayStartRad;
    const sunriseLabelRadius = dayArcRadius - clockRadius * 0.15;
    const sunriseLabelX = centerX + sunriseLabelRadius * Math.cos(sunriseLabelAngle);
    const sunriseLabelY = centerY + sunriseLabelRadius * Math.sin(sunriseLabelAngle);

    sunriseLabel.setAttribute("x", sunriseLabelX);
    sunriseLabel.setAttribute("y", sunriseLabelY);
    sunriseLabel.setAttribute("text-anchor", "middle");
    sunriseLabel.setAttribute("dominant-baseline", "middle");
    sunriseLabel.setAttribute("fill", "white");
    sunriseLabel.setAttribute("font-size", "12px");
    sunriseLabel.textContent = sunData.formattedSunrise || "N/A";
    svg.appendChild(sunriseLabel);

    const sunsetLabel = document.createElementNS(svgNS, "text");
    const sunsetLabelAngle = dayEndRad;
    const sunsetLabelRadius = dayArcRadius - clockRadius * 0.15;
    const sunsetLabelX = centerX + sunsetLabelRadius * Math.cos(sunsetLabelAngle);
    const sunsetLabelY = centerY + sunsetLabelRadius * Math.sin(sunsetLabelAngle);

    sunsetLabel.setAttribute("x", sunsetLabelX);
    sunsetLabel.setAttribute("y", sunsetLabelY);
    sunsetLabel.setAttribute("text-anchor", "middle");
    sunsetLabel.setAttribute("dominant-baseline", "middle");
    sunsetLabel.setAttribute("fill", "white");
    sunsetLabel.setAttribute("font-size", "12px");
    sunsetLabel.textContent = sunData.formattedSunset || "N/A";
    svg.appendChild(sunsetLabel);

    //-------------------------------------------
    // Add day length indicator in the center
    //-------------------------------------------
    const dayLengthText = document.createElementNS(svgNS, "text");
    dayLengthText.setAttribute("x", centerX);
    dayLengthText.setAttribute("y", centerY - clockRadius * 0.4);
    dayLengthText.setAttribute("text-anchor", "middle");
    dayLengthText.setAttribute("fill", "white");
    dayLengthText.setAttribute("font-size", "14px");
    dayLengthText.setAttribute("font-weight", "bold");
    dayLengthText.textContent = `Day Length: ${sunData.formattedDayLength || "N/A"}`;
    svg.appendChild(dayLengthText);

    //-------------------------------------------
    // Add current time indicator
    //-------------------------------------------

    // Calculate the current time position
    const currentTimeAngle = ((locationTime / 24) * 360 + midnightOffset) * (Math.PI / 180);
    const currentTimeRadius = dayArcRadius;

    // Create a marker for current time
    const currentTimeMarker = document.createElementNS(svgNS, "circle");
    currentTimeMarker.setAttribute("cx", centerX + currentTimeRadius * Math.cos(currentTimeAngle));
    currentTimeMarker.setAttribute("cy", centerY + currentTimeRadius * Math.sin(currentTimeAngle));
    currentTimeMarker.setAttribute("r", clockRadius * 0.04);

    // Determine if current time is during day or night
    const isDaytimeValue = locationTime >= sunriseHour && locationTime <= sunsetHour;

    if (isDaytimeValue) {
        // During day - yellow/orange sun
        currentTimeMarker.setAttribute("fill", "#FFD700");
        currentTimeMarker.setAttribute("filter", `url(#sun-glow-${uniqueId})`);
    } else {
        // During night - white/blue moon
        currentTimeMarker.setAttribute("fill", "#E1E1E1");
        currentTimeMarker.setAttribute("stroke", "#A5B0C3");
        currentTimeMarker.setAttribute("stroke-width", "1");
    }

    svg.appendChild(currentTimeMarker);

    //-------------------------------------------
    // Add moon phase visualization
    //-------------------------------------------
    // Add moon phase to the center of the clock
    addMoonPhaseToSVG(svg, centerX, centerY, clockRadius * 0.3, moonData, uniqueId);

    // Add the SVG to the container
    container.appendChild(svg);
}

/**
 * Create a sun icon for sunrise/sunset indicators
 */
function createSunIcon(svgNS, uniqueId, centerX, centerY, angle, radius, size) {
    // Convert angle to radians
    const angleRad = angle * (Math.PI / 180);

    // Calculate position
    const x = centerX + radius * Math.cos(angleRad);
    const y = centerY + radius * Math.sin(angleRad);

    // Create group for the sun
    const sunGroup = document.createElementNS(svgNS, "g");

    // Create the sun circle
    const sunCircle = document.createElementNS(svgNS, "circle");
    sunCircle.setAttribute("cx", x);
    sunCircle.setAttribute("cy", y);
    sunCircle.setAttribute("r", size);
    sunCircle.setAttribute("fill", "#FFD700");
    sunCircle.setAttribute("filter", `url(#sun-glow-${uniqueId})`);

    sunGroup.appendChild(sunCircle);

    return sunGroup;
}

/**
 * Add a moon phase visualization to the SVG
 * Using SVG paths for accurate moon phase rendering
 */
function addMoonPhaseToSVG(svg, centerX, centerY, radius, moonData, uniqueId) {
    const svgNS = "http://www.w3.org/2000/svg";

    // Create a group for the moon to properly position it
    const moonGroup = document.createElementNS(svgNS, "g");
    moonGroup.setAttribute("transform", `translate(${centerX - radius}, ${centerY - radius})`);

    // Create the moon SVG element
    const moonSvg = document.createElementNS(svgNS, "svg");
    moonSvg.setAttribute("viewBox", `0 0 ${radius * 2} ${radius * 2}`);
    moonSvg.setAttribute("width", radius * 2);
    moonSvg.setAttribute("height", radius * 2);

    // Base circle (background)
    const baseCircle = document.createElementNS(svgNS, "circle");
    baseCircle.setAttribute("r", radius);
    baseCircle.setAttribute("cx", radius);
    baseCircle.setAttribute("cy", radius);
    baseCircle.setAttribute("fill", "#121826"); // Dark background

    // Calculate phase-specific parameters
    const phase = moonData.phase;
    const fraction = moonData.fraction;

    const arcRadius = radius - 2; // Small offset for visual effect
    const arcDiameter = arcRadius * 2;

    let waxingArc = arcRadius;
    let waxingSweep = 1;
    let waningArc = arcRadius;
    let waningSweep = 1;

    let sweep = 0;
    let arcFraction = 1 - fraction * 2;

    if (arcFraction < 0) {
        arcFraction = arcFraction * -1;
        sweep = 1;
    }

    if (phase <= 0.5) {
        // Waxing moon (New to Full)
        waxingArc = arcFraction * arcRadius;
        waxingSweep = sweep;
    } else {
        // Waning moon (Full to New)
        waningArc = arcFraction * arcRadius;
        waningSweep = sweep;
    }

    // Create the illuminated portion of the moon
    const moonPath = document.createElementNS(svgNS, "path");
    moonPath.setAttribute("d", `
        M ${radius} ${radius}
        m 0 ${arcRadius * -1}
        a ${waningArc} ${arcRadius} 0 0 ${waningSweep} 0 ${arcDiameter}
        a ${waxingArc} ${arcRadius} 0 0 ${waxingSweep} 0 ${arcDiameter * -1}
        z
    `);
    moonPath.setAttribute("fill", "#FFFDE7"); // Light yellow for illuminated portion

    // Add elements to the SVG
    moonSvg.appendChild(baseCircle);
    moonSvg.appendChild(moonPath);
    moonGroup.appendChild(moonSvg);
    svg.appendChild(moonGroup);

    // Add text elements directly to the SVG for moon information

    // Add moon phase name
    const moonText = document.createElementNS(svgNS, "text");
    moonText.setAttribute("x", centerX);
    moonText.setAttribute("y", centerY + radius + 20);
    moonText.setAttribute("text-anchor", "middle");
    moonText.setAttribute("fill", "white");
    moonText.setAttribute("font-size", "14px");
    moonText.setAttribute("font-weight", "bold");
    moonText.textContent = moonData.phaseName;
    svg.appendChild(moonText);

    // Add illumination percentage
    const illumText = document.createElementNS(svgNS, "text");
    illumText.setAttribute("x", centerX);
    illumText.setAttribute("y", centerY + radius + 40);
    illumText.setAttribute("text-anchor", "middle");
    illumText.setAttribute("fill", "rgba(255, 255, 255, 0.8)");
    illumText.setAttribute("font-size", "12px");
    illumText.textContent = `${moonData.illumination}% Illuminated`;
    svg.appendChild(illumText);

    // Add next full/new moon
    const now = new Date();

    // Determine which is sooner - next full or new moon
    const daysToFull = (moonData.nextFullMoon - now) / (24 * 60 * 60 * 1000);
    const daysToNew = (moonData.nextNewMoon - now) / (24 * 60 * 60 * 1000);

    const nextEvent = document.createElementNS(svgNS, "text");
    nextEvent.setAttribute("x", centerX);
    nextEvent.setAttribute("y", centerY + radius + 60);
    nextEvent.setAttribute("text-anchor", "middle");
    nextEvent.setAttribute("fill", "rgba(255, 255, 255, 0.7)");
    nextEvent.setAttribute("font-size", "11px");

    let nextEventText;
    if (daysToFull <= daysToNew) {
        // Format date to show month and day
        const fullMoonDate = moonData.nextFullMoon.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
        });
        nextEventText = `Full Moon: ${fullMoonDate}`;
    } else {
        const newMoonDate = moonData.nextNewMoon.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
        });
        nextEventText = `New Moon: ${newMoonDate}`;
    }

    nextEvent.textContent = nextEventText;
    svg.appendChild(nextEvent);
}

/**
 * Moon Painter class for Canvas-based moon rendering
 * Fixed version for proper phase visualization
 */
class MoonPainter {
    constructor(canvas) {
        this.lineWidth = 0; // No outline for our moon
        this.radius = canvas.width / 2;
        this.centerX = this.radius;
        this.centerY = this.radius;

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    _drawDisc() {
        // Draw the full moon disc
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#FFFDE7'; // Light yellow for moon
        this.ctx.fill();
    }

    _drawPhase(phase) {
        // Special case for nearly full moon
        if (Math.abs(phase) > 0.98) {
            return; // Exit the function without drawing anything over the full moon
        }

        // Define the terminator (shadow edge) position
        const terminatorX = this.centerX + this.radius * phase;

        // Clear the right half-circle for waxing phase or left half-circle for waning phase
        this.ctx.beginPath();
        if (phase < 0) {
            // Waxing moon (dark on right side)
            this.ctx.moveTo(this.centerX, this.centerY - this.radius);
            this.ctx.lineTo(this.centerX, this.centerY + this.radius);
            this.ctx.lineTo(this.centerX + this.radius, this.centerY + this.radius);
            this.ctx.lineTo(this.centerX + this.radius, this.centerY - this.radius);
            this.ctx.closePath();
        } else {
            // Waning moon (dark on left side)
            this.ctx.moveTo(this.centerX, this.centerY - this.radius);
            this.ctx.lineTo(this.centerX, this.centerY + this.radius);
            this.ctx.lineTo(this.centerX - this.radius, this.centerY + this.radius);
            this.ctx.lineTo(this.centerX - this.radius, this.centerY - this.radius);
            this.ctx.closePath();
        }
        this.ctx.fillStyle = '#121826'; // Dark color for shadow
        this.ctx.fill();

        // Draw the terminator curve
        this.ctx.beginPath();
        // Draw an ellipse as the terminator
        const x = terminatorX;
        const startAngle = -Math.PI / 2;
        const endAngle = Math.PI / 2;

        // Use ellipse if supported, otherwise use arcs
        if (typeof this.ctx.ellipse === 'function') {
            this.ctx.ellipse(
                x, this.centerY,                    // Center of ellipse
                Math.abs(this.radius * 0.05),       // Radiusm X (narrow)
                this.radius,                        // Radius Y (full height)
                0, startAngle, endAngle             // Rotation and angles
            );
        } else {
            // Fallback for browsers without ellipse support
            const radius = this.radius;
            // Approximate with a series of quadratic curves
            this.ctx.moveTo(x, this.centerY - radius);
            this.ctx.quadraticCurveTo(
                x + (phase < 0 ? -5 : 5), this.centerY,
                x, this.centerY + radius
            );
        }

        // Fill to the left or right based on phase
        if (phase < 0) {
            // Waxing - fill to the left
            this.ctx.lineTo(x - this.radius, this.centerY + this.radius);
            this.ctx.lineTo(x - this.radius, this.centerY - this.radius);
        } else {
            // Waning - fill to the right
            this.ctx.lineTo(x + this.radius, this.centerY + this.radius);
            this.ctx.lineTo(x + this.radius, this.centerY - this.radius);
        }

        this.ctx.closePath();
        this.ctx.fillStyle = '#FFFDE7'; // Light color for illuminated portion
        this.ctx.fill();
    }

    /**
     * @param {Number} phase - The phase expressed as a float in [0,1] range.
     */
    paint(phase) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw the full moon disc first
        this._drawDisc();

        // Calculate the shadow phase parameter
        let shadowPhase;
        if (phase < 0.5) {
            // Waxing moon (New to Full)
            shadowPhase = -1 + (phase * 2); // Maps 0->0.5 to -1->0
        } else {
            // Waning moon (Full to New)
            shadowPhase = (phase - 0.5) * 2; // Maps 0.5->1 to 0->1
        }

        // Draw the shadow
        this._drawPhase(shadowPhase);
    }
}

/**
 * Create a visualization for polar day or night 
 */
function createPolarDayNightVisualization(svg, width, height, isDay) {
    const svgNS = "http://www.w3.org/2000/svg";
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.4;

    // Create background
    const background = document.createElementNS(svgNS, "rect");
    background.setAttribute("x", "0");
    background.setAttribute("y", "0");
    background.setAttribute("width", width);
    background.setAttribute("height", height);

    if (isDay) {
        // Polar day colors
        background.setAttribute("fill", "url(#polarDayGradient)");

        // Create gradient for background
        const defs = document.createElementNS(svgNS, "defs");
        const gradient = document.createElementNS(svgNS, "linearGradient");
        gradient.setAttribute("id", "polarDayGradient");
        gradient.setAttribute("x1", "0%");
        gradient.setAttribute("y1", "0%");
        gradient.setAttribute("x2", "0%");
        gradient.setAttribute("y2", "100%");

        const stop1 = document.createElementNS(svgNS, "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", "#4A90E2");

        const stop2 = document.createElementNS(svgNS, "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("stop-color", "#85C1E9");

        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
        svg.appendChild(defs);
    } else {
        // Polar night colors
        background.setAttribute("fill", "url(#polarNightGradient)");

        // Create gradient for background
        const defs = document.createElementNS(svgNS, "defs");
        const gradient = document.createElementNS(svgNS, "linearGradient");
        gradient.setAttribute("id", "polarNightGradient");
        gradient.setAttribute("x1", "0%");
        gradient.setAttribute("y1", "0%");
        gradient.setAttribute("x2", "0%");
        gradient.setAttribute("y2", "100%");

        const stop1 = document.createElementNS(svgNS, "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", "#0C1445");

        const stop2 = document.createElementNS(svgNS, "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("stop-color", "#1F2A5A");

        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
        svg.appendChild(defs);
    }

    svg.appendChild(background);

    // Create a circular path to represent the 24-hour cycle
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", centerX);
    circle.setAttribute("cy", centerY);
    circle.setAttribute("r", radius);
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", "rgba(255, 255, 255, 0.3)");
    circle.setAttribute("stroke-width", "2");
    circle.setAttribute("stroke-dasharray", "4,4");
    svg.appendChild(circle);

    // Add title text
    const title = document.createElementNS(svgNS, "text");
    title.setAttribute("x", centerX);
    title.setAttribute("y", centerY - radius * 0.5);
    title.setAttribute("text-anchor", "middle");
    title.setAttribute("fill", "white");
    title.setAttribute("font-size", "18");
    title.setAttribute("font-weight", "bold");
    title.textContent = isDay ? "24 Hours of Daylight" : "24 Hours of Night";
    svg.appendChild(title);

    // Add description
    const description = document.createElementNS(svgNS, "text");
    description.setAttribute("x", centerX);
    description.setAttribute("y", centerY - radius * 0.2);
    description.setAttribute("text-anchor", "middle");
    description.setAttribute("fill", "white");
    description.setAttribute("font-size", "14");
    description.textContent = isDay ? "The sun doesn't set today" : "The sun doesn't rise today";
    svg.appendChild(description);

    // Create 24-hour markers
    for (let hour = 0; hour < 24; hour++) {
        const angle = (hour / 24) * 2 * Math.PI + Math.PI / 2; // Start at the bottom with midnight
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        // Create hour marker
        const marker = document.createElementNS(svgNS, "circle");
        marker.setAttribute("cx", x);
        marker.setAttribute("cy", y);
        marker.setAttribute("r", "3");
        marker.setAttribute("fill", isDay ? "#FFD700" : "#E1E1E1");
        svg.appendChild(marker);

        // Add hour label
        if (hour % 6 === 0) { // Only label every 6 hours
            const labelRadius = radius + 15;
            const labelX = centerX + labelRadius * Math.cos(angle);
            const labelY = centerY + labelRadius * Math.sin(angle);

            const label = document.createElementNS(svgNS, "text");
            label.setAttribute("x", labelX);
            label.setAttribute("y", labelY);
            label.setAttribute("text-anchor", "middle");
            label.setAttribute("dominant-baseline", "middle");
            label.setAttribute("fill", "white");
            label.setAttribute("font-size", "12");

            // Format 24h to 12h time
            const hour12 = hour % 12 || 12;
            const ampm = hour < 12 ? "AM" : "PM";
            label.textContent = `${hour12}${ampm}`;

            svg.appendChild(label);
        }
    }

    // Add visual to represent the phenomenon
    if (isDay) {
        // Add a sun for polar day
        const sun = document.createElementNS(svgNS, "circle");
        sun.setAttribute("cx", centerX);
        sun.setAttribute("cy", centerY);
        sun.setAttribute("r", "25");
        sun.setAttribute("fill", "#FFD700");

        // Add sun rays
        const sunGroup = document.createElementNS(svgNS, "g");
        sunGroup.appendChild(sun);

        for (let i = 0; i < 12; i++) {
            const rayAngle = (i / 12) * 2 * Math.PI;
            const rayStartX = centerX + 30 * Math.cos(rayAngle);
            const rayStartY = centerY + 30 * Math.sin(rayAngle);
            const rayEndX = centerX + 45 * Math.cos(rayAngle);
            const rayEndY = centerY + 45 * Math.sin(rayAngle);

            const ray = document.createElementNS(svgNS, "line");
            ray.setAttribute("x1", rayStartX);
            ray.setAttribute("y1", rayStartY);
            ray.setAttribute("x2", rayEndX);
            ray.setAttribute("y2", rayEndY);
            ray.setAttribute("stroke", "#FFD700");
            ray.setAttribute("stroke-width", "2");
            sunGroup.appendChild(ray);
        }

        svg.appendChild(sunGroup);

        // Add animation for the sun
        const animateTransform = document.createElementNS(svgNS, "animateTransform");
        animateTransform.setAttribute("attributeName", "transform");
        animateTransform.setAttribute("type", "rotate");
        animateTransform.setAttribute("from", `0 ${centerX} ${centerY}`);
        animateTransform.setAttribute("to", `360 ${centerX} ${centerY}`);
        animateTransform.setAttribute("dur", "60s");
        animateTransform.setAttribute("repeatCount", "indefinite");
        sunGroup.appendChild(animateTransform);

    } else {
        // Add stars for polar night
        for (let i = 0; i < 30; i++) {
            const starX = centerX + (Math.random() - 0.5) * radius * 1.8;
            const starY = centerY + (Math.random() - 0.5) * radius * 1.8;
            const starSize = Math.random() * 2 + 1;

            const star = document.createElementNS(svgNS, "circle");
            star.setAttribute("cx", starX);
            star.setAttribute("cy", starY);
            star.setAttribute("r", starSize);
            star.setAttribute("fill", "#E1E1E1");
            star.setAttribute("class", "star-twinkle");

            // Add simple animation for twinkling
            const animate = document.createElementNS(svgNS, "animate");
            animate.setAttribute("attributeName", "opacity");
            animate.setAttribute("values", "0.2;1;0.2");
            animate.setAttribute("dur", `${Math.random() * 3 + 2}s`);
            animate.setAttribute("repeatCount", "indefinite");
            star.appendChild(animate);

            svg.appendChild(star);
        }

        // Add a moon
        const moon = document.createElementNS(svgNS, "circle");
        moon.setAttribute("cx", centerX);
        moon.setAttribute("cy", centerY);
        moon.setAttribute("r", "20");
        moon.setAttribute("fill", "#E1E1E1");
        svg.appendChild(moon);
    }
}