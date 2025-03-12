/**
 * Astronomical information module for the weather app
 * Provides sun/moon calculations and Polar Clock visualization
 */

import { setWeatherIcon } from "./weatherIcons.js";

// Global resize handler reference to allow for cleanup
let resizeHandler = null;

//==============================================================================
// 1. CALCULATIONS AND UTILITIES
//==============================================================================

/**
 * Calculate sunrise, sunset, and other sun information for a specific location
 * Enhanced with tz-lookup for accurate timezone information
 * 
 * @param {number} lat - Latitude in decimal degrees
 * @param {number} lon - Longitude in decimal degrees
 * @param {Date} date - Date object for the calculation (defaults to today)
 * @returns {Object} - Object containing astronomical times and information
 */
export function calculateSunTimes(lat, lon, date = new Date()) {
    // Get timezone for the location
    let timezone = 'UTC';
    try {
        if (typeof window.tzlookup === 'function') {
            timezone = window.tzlookup(lat, lon);
        } else {
            console.warn('tzlookup not available, using approximate calculations');
        }
    } catch (error) {
        console.error('Error getting timezone:', error);
    }

    // Create a fresh Date object to avoid caching issues
    const now = new Date();

    // Calculate sunrise/sunset using the standalone function
    const sunCalcResult = calcSunriseSunset(now, lat, lon, timezone);
    const { sunrise, sunset, dayLength, isPolarDay, isPolarNight } = sunCalcResult;

    // Calculate current sun position
    let sunPosition = 0.5; // Default to mid-day
    let locationCurrentTime = null; // Declare at function scope for availability in return

    try {
        // Get current local time in the timezone of the location
        if (timezone !== 'UTC') {
            // Use the timezone to get the current time at the location
            const options = {
                timeZone: timezone,
                hour12: false,
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric'
            };

            const timeStr = now.toLocaleString('en-US', options);
            const [hours, minutes, seconds] = timeStr.split(':').map(Number);

            // Convert to decimal hours for sun position calculation
            locationCurrentTime = hours + (minutes / 60) + (seconds / 3600);
        } else {
            // Fall back to longitude-based calculation if timezone is not available
            const utcHours = now.getUTCHours() + (now.getUTCMinutes() / 60) + (now.getUTCSeconds() / 3600);
            const timezoneOffset = lon / 15; // Approximate timezone offset based on longitude
            locationCurrentTime = ((utcHours + timezoneOffset) % 24 + 24) % 24;
        }

        // When calculating sun position:
        if (isPolarDay) {
            // During polar day, use time of day to determine position (circular path)
            sunPosition = ((locationCurrentTime - 0) % 24) / 24;
        } else if (isPolarNight) {
            // During polar night, sun is always below horizon
            sunPosition = -1; // Use negative value to indicate below horizon
        } else if (sunrise && sunset) {
            // Extract hour values
            const sunriseHour = sunrise.getHours() + (sunrise.getMinutes() / 60);
            const sunsetHour = sunset.getHours() + (sunset.getMinutes() / 60);

            // Special case for when sunset is on next day (crosses midnight)
            let adjustedSunsetHour = sunsetHour;
            if (sunsetHour < sunriseHour) {
                adjustedSunsetHour += 24;
            }

            if (locationCurrentTime < sunriseHour) {
                // Before sunrise - use negative value to indicate below horizon
                // Scale from -1 (midnight) to -0.1 (just before sunrise)
                const nightProgress = locationCurrentTime / sunriseHour;
                sunPosition = -1 + (nightProgress * 0.9);
            } else if (locationCurrentTime > sunsetHour && sunsetHour > sunriseHour) {
                // After sunset (same day) - use negative value
                const nightProgress = (locationCurrentTime - sunsetHour) / (24 - sunsetHour + sunriseHour);
                sunPosition = -0.1 - (nightProgress * 0.9);
                sunPosition = Math.max(-1, sunPosition); // Cap at -1
            } else if (locationCurrentTime > 0 && locationCurrentTime < sunriseHour + 24 && sunsetHour < sunriseHour) {
                // After sunset (next day) - use negative value
                sunPosition = -0.5; // Arbitrary value to indicate below horizon
            } else {
                // During daylight - calculate position along arc
                sunPosition = (locationCurrentTime - sunriseHour) / (adjustedSunsetHour - sunriseHour);

                // Ensure value is between 0 and 1
                sunPosition = Math.max(0, Math.min(1, sunPosition));
            }
        }
    } catch (error) {
        console.error('Error calculating sun position:', error);
        sunPosition = 0.5; // Default to mid-day if there's an error
    }

    // Before clamping, calculate isDaytime from raw value
    const isDaytimeValue = sunPosition >= 0;

    // For visualization purposes, clamp sunPosition to 0-1 range
    const visualSunPosition = Math.max(0, Math.min(1, sunPosition));

    // Format sunrise and sunset times for display
    let formattedSunrise = 'N/A';
    let formattedSunset = 'N/A';

    if (sunrise) {
        formattedSunrise = sunrise.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    if (sunset) {
        formattedSunset = sunset.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    // Format day length for display
    const dayHours = Math.floor(dayLength);
    const dayMinutes = Math.round((dayLength % 1) * 60);
    const formattedDayLength = `${dayHours}h ${dayMinutes}m`;

    return {
        sunrise,
        sunset,
        dayLength,
        sunPosition: visualSunPosition, // Clamped version for visualization
        rawSunPosition: sunPosition,     // Raw version that can be negative
        isPolarDay,
        isPolarNight,
        isDaytime: isDaytimeValue,      // Boolean for day/night detection
        formattedSunrise,
        formattedSunset,
        formattedDayLength,
        timezone,
        locationTime: locationCurrentTime // Add the location's time to the returned data
    };
}

/**
 * Calculate sunrise and sunset times for a specific date and location
 * Standalone function moved outside of calculateSunTimes
 * 
 * @param {Date} date - Date to calculate for
 * @param {number} lat - Latitude in decimal degrees
 * @param {number} lng - Longitude in decimal degrees
 * @param {string} timezone - Timezone string (e.g. 'America/New_York')
 * @return {Object} - Object containing sunrise, sunset, dayLength and polar day/night flags
 */
function calcSunriseSunset(date, lat, lng, timezone) {
    // Date variables
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Convert latitude and longitude to radians
    const PI = Math.PI;
    const latRad = lat * (PI / 180);
    const lngRad = -lng * (PI / 180); // Negate longitude for calculations

    // Calculate day of the year
    const N1 = Math.floor(275 * month / 9);
    const N2 = Math.floor((month + 9) / 12);
    const N3 = (1 + Math.floor((year - 4 * Math.floor(year / 4) + 2) / 3));
    const N = N1 - (N2 * N3) + day - 30;

    // Calculate solar mean anomaly
    const M = (357.5291 + 0.98560028 * N) % 360;

    // Calculate center equation
    const MRad = M * (PI / 180);
    const C = 1.9148 * Math.sin(MRad) + 0.0200 * Math.sin(2 * MRad) + 0.0003 * Math.sin(3 * MRad);

    // Calculate ecliptic longitude
    const lambda = (M + C + 180 + 102.9372) % 360;

    // Calculate solar declination
    const lambdaRad = lambda * (PI / 180);
    const delta = Math.asin(Math.sin(lambdaRad) * Math.sin(23.45 * (PI / 180)));

    // Calculate hour angle for sunrise/sunset
    const cosOmega = (Math.sin(-0.83 * (PI / 180)) - Math.sin(latRad) * Math.sin(delta)) /
        (Math.cos(latRad) * Math.cos(delta));

    // Handle polar day/night
    const isPolarDay = cosOmega < -1;
    const isPolarNight = cosOmega > 1;

    // Calculate solar noon in UTC
    const J2000 = 2451545; // January 1, 2000, at noon
    const currentJulianDay = J2000 + (date - new Date(2000, 0, 1, 12)) / 86400000;
    const solarNoonUTC = 12 - (lng / 15);

    // Initialize variables that will be set in the conditional blocks
    let sunriseUTC = 0;
    let sunsetUTC = 0;
    let dayLength = 0;
    let omega = 0;

    if (!isPolarDay && !isPolarNight) {
        // Calculate sunrise and sunset hour angles in radians
        omega = Math.acos(cosOmega);

        // Calculate day length in hours
        dayLength = 24 * omega / PI;

        // Calculate sunrise and sunset in UTC
        sunriseUTC = solarNoonUTC - (dayLength / 2);
        sunsetUTC = solarNoonUTC + (dayLength / 2);
    } else if (isPolarDay) {
        // 24 hours of sunlight
        dayLength = 24;
        sunriseUTC = 0; // Arbitrary, sun doesn't rise
        sunsetUTC = 24; // Arbitrary, sun doesn't set
    } else { // isPolarNight
        // 0 hours of sunlight
        dayLength = 0;
        sunriseUTC = 12; // Arbitrary, sun doesn't rise
        sunsetUTC = 12; // Arbitrary, sun doesn't set
    }

    // Convert UTC times to Date objects in specified timezone
    const getSunTimeDate = (hour) => {
        // Create a date at midnight on the input date
        const sunTime = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

        // Calculate hours, minutes, and seconds
        let hours = Math.floor(hour);
        const minutes = Math.floor((hour - hours) * 60);
        const seconds = Math.floor(((hour - hours) * 60 - minutes) * 60);

        // Set the hours, minutes, seconds
        sunTime.setUTCHours(hours, minutes, seconds);

        // Format using the timezone if available
        try {
            if (timezone !== 'UTC') {
                const options = {
                    timeZone: timezone,
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                };

                const timeStr = sunTime.toLocaleString('en-US', options);

                // Parse the time string back to a date in the local timezone
                const [timePart] = timeStr.split(', ');
                const [hours, minutes, seconds] = timePart.split(':').map(Number);

                // Create a new date in the local timezone
                const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(),
                    hours, minutes, seconds);

                return localDate;
            }
        } catch (e) {
            console.error('Error formatting time with timezone:', e);
        }

        return sunTime;
    };

    // Convert to dates for return
    const sunriseDate = isPolarDay || isPolarNight ? null : getSunTimeDate(sunriseUTC);
    const sunsetDate = isPolarDay || isPolarNight ? null : getSunTimeDate(sunsetUTC);

    return {
        sunrise: sunriseDate,
        sunset: sunsetDate,
        dayLength: dayLength,
        isPolarDay: isPolarDay,
        isPolarNight: isPolarNight,
        timezone: timezone
    };
}

/**
 * Calculate the current moon phase and related information
 * Based on MoonFx calculations
 * @returns {Object} - Object containing moon phase data
 */
function calculateMoonPhase() {
    // Constants
    const SYNODIC_PERIOD = 29.530589; // Moon's synodic period in days
    const ONE_DAY = 86400; // Length of one day in seconds
    
    // Helper functions from MoonFx
    function normalize(value) {
        value = value - parseInt(value);
        
        if (value < 0) {
            value = value + 1;
        }
        
        return value;
    }
    
    function deg2rad(x) {
        return x * (Math.PI / 180);
    }
    
    // Current date
    const date = new Date();
    const moonDate = date.getTime();
    
    // Calculate Julian Date
    const julianDate = ((moonDate / 1000) / ONE_DAY) + 2440587.5;
    
    // Calculate Synodic Phase (Moon's age)
    const synodicPhase = normalize((julianDate - 2451550.1) / SYNODIC_PERIOD) * SYNODIC_PERIOD;
    
    // Calculate Phase Angle
    const phaseAngle = synodicPhase * (360 / SYNODIC_PERIOD);
    const normalizedPhaseAngle = phaseAngle > 360 ? phaseAngle - 360 : phaseAngle;
    
    // Calculate Illumination Ratio
    const illuminationRatio = 0.5 * (1 - Math.cos(deg2rad(normalizedPhaseAngle)));
    const illuminationPercent = Math.round(illuminationRatio * 100);
    
    // Convert phase angle to phase value (0-1)
    // Where 0/1 = new moon, 0.5 = full moon
    let phase = normalizedPhaseAngle / 360;
    
    // Determine if waxing or waning
    const isWaxing = phase < 0.5;
    const isWaning = !isWaxing;
    
    // Determine phase name
    const phaseName = getMoonPhaseName(phase);
    
    // Calculate moon age in days from the new moon
    const moonAgeDays = synodicPhase;
    
    // Calculate next full and new moon dates
    const daysToFullMoon = ((0.5 - phase) % 1) * SYNODIC_PERIOD;
    const nextFullMoon = new Date(date.getTime() + (daysToFullMoon * 24 * 60 * 60 * 1000));
    
    const daysToNewMoon = ((1 - phase) % 1) * SYNODIC_PERIOD;
    const nextNewMoon = new Date(date.getTime() + (daysToNewMoon * 24 * 60 * 60 * 1000));
    
    return {
        phase: phase,
        ageDays: moonAgeDays,
        illumination: illuminationPercent,
        phaseName: phaseName,
        nextFullMoon: nextFullMoon,
        nextNewMoon: nextNewMoon,
        isWaxing: isWaxing,
        isWaning: isWaning
    };
}

/**
 * Get the name of the moon phase based on the phase value
 * @param {number} phase - The moon phase value (0-1)
 * @returns {string} - The name of the moon phase
 */
function getMoonPhaseName(phase) {
    // Normalize phase to ensure it's between 0 and 1
    phase = ((phase % 1) + 1) % 1;
    
    // Define phase ranges and names based on astronomical definitions
    if (phase < 0.03 || phase >= 0.97) {
        return "New Moon";
    } else if (phase < 0.22) {
        return "Waxing Crescent";
    } else if (phase < 0.28) {
        return "First Quarter";
    } else if (phase < 0.47) {
        return "Waxing Gibbous";
    } else if (phase < 0.53) {
        return "Full Moon";
    } else if (phase < 0.72) {
        return "Waning Gibbous";
    } else if (phase < 0.78) {
        return "Last Quarter";
    } else { // phase < 0.97
        return "Waning Crescent";
    }
}

//==============================================================================
// 2. POLAR CLOCK VISUALIZATION
//==============================================================================

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
    // Create defs section for gradients/filters
    //-------------------------------------------
    const defs = document.createElementNS(svgNS, "defs");
    
    // Create gradient for day arc 
    const dayGradient = document.createElementNS(svgNS, "linearGradient");
    dayGradient.setAttribute("id", `dayGradient-${uniqueId}`);
    dayGradient.setAttribute("x1", "0%");
    dayGradient.setAttribute("y1", "0%");
    dayGradient.setAttribute("x2", "100%");
    dayGradient.setAttribute("y2", "0%");
    
    // Sunrise colors - just at the beginning
    const stop1 = document.createElementNS(svgNS, "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", "#FF9E80");
    
    // Transition to blue
    const stop2 = document.createElementNS(svgNS, "stop");
    stop2.setAttribute("offset", "10%");
    stop2.setAttribute("stop-color", "#4A90E2");
    
    // Midday blue - most of the arc
    const stop3 = document.createElementNS(svgNS, "stop");
    stop3.setAttribute("offset", "90%");
    stop3.setAttribute("stop-color", "#4A90E2");
    
    // Sunset colors - just at the end
    const stop4 = document.createElementNS(svgNS, "stop");
    stop4.setAttribute("offset", "100%");
    stop4.setAttribute("stop-color", "#FF7043");
    
    dayGradient.appendChild(stop1);
    dayGradient.appendChild(stop2);
    dayGradient.appendChild(stop3);
    dayGradient.appendChild(stop4);
    defs.appendChild(dayGradient);
    
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
    
    // Calculate times and angles
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    
    // Parse the sunrise and sunset times from the data
    let sunriseHour, sunsetHour, sunriseAngle, sunsetAngle;
    
    // Get current local time in decimal hours
    const locationTime = sunData.locationTime || (now.getHours() + now.getMinutes() / 60);
    
    if (sunData.sunrise && sunData.sunset) {
        // Convert sunrise and sunset to hours
        sunriseHour = sunData.sunrise.getHours() + sunData.sunrise.getMinutes() / 60;
        sunsetHour = sunData.sunset.getHours() + sunData.sunset.getMinutes() / 60;
        
        // Handle case where sunset is on next day (crosses midnight)
        if (sunsetHour < sunriseHour) {
            sunsetHour += 24;
        }
        
        // Calculate angles (0 degrees is at the top, clockwise)
        sunriseAngle = (sunriseHour / 24) * 360;
        sunsetAngle = (sunsetHour / 24) * 360;
        
        // Calculate the current time angle
        const currentAngle = (locationTime / 24) * 360;
    } else {
        // Default values if sunrise/sunset data isn't available
        sunriseHour = 6;
        sunsetHour = 18;
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
    dayArc.setAttribute("stroke", `url(#dayGradient-${uniqueId})`);
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
            // Make the labels more readable with a space
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
    const isDaytime = locationTime >= sunriseHour && locationTime <= sunsetHour;
    
    if (isDaytime) {
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
 * Using Canvas-based rendering for accurate moon phases
 */
function addMoonPhaseToSVG(svg, centerX, centerY, radius, moonData, uniqueId) {
    const svgNS = "http://www.w3.org/2000/svg";
    
    // Create a foreignObject to embed HTML/Canvas content in the SVG
    const foreignObject = document.createElementNS(svgNS, "foreignObject");
    foreignObject.setAttribute("x", centerX - radius);
    foreignObject.setAttribute("y", centerY - radius);
    foreignObject.setAttribute("width", radius * 2);
    foreignObject.setAttribute("height", radius * 2);
    
    // Create a Canvas element for the moon
    const canvas = document.createElement("canvas");
    canvas.width = radius * 2;
    canvas.height = radius * 2;
    canvas.style.display = "block";
    
    // Create the MoonPainter instance and draw the moon
    const painter = new MoonPainter(canvas);
    painter.paint(moonData.phase);
    
    // Add the Canvas to the foreignObject
    foreignObject.appendChild(canvas);
    
    // Add the foreignObject to the SVG
    svg.appendChild(foreignObject);
    
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
    illumText.textContent = `${Math.round(moonData.illumination)}% Illuminated`;
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
 * With minimal fix for center line
 */
class MoonPainter {
    constructor(canvas) {
        this.lineWidth = 0; // No outline for our moon
        this.radius = canvas.width / 2 - this.lineWidth / 2;
        this.offset = this.lineWidth / 2;

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }
    _drawDisc() {
        this.ctx.translate(this.offset, this.offset);
        this.ctx.beginPath();
        this.ctx.arc(this.radius, this.radius, this.radius, 0, 2 * Math.PI, true);
        this.ctx.closePath();
        this.ctx.fillStyle = '#FFFDE7'; // Light yellow for moon
        this.ctx.fill();
    }
    _drawPhase(phase) {
        // First draw a full shadow semicircle
        this.ctx.beginPath();
        this.ctx.arc(this.radius, this.radius, this.radius, -Math.PI / 2, Math.PI / 2, true);
        this.ctx.closePath();
        this.ctx.fillStyle = '#121826'; // Dark color for shadow
        this.ctx.fill();

        // Draw the illuminated portion with slight overlap to prevent the center line
        this.ctx.save(); // Save state before scaling
        this.ctx.translate(this.radius, this.radius);
        this.ctx.scale(phase, 1);
        this.ctx.translate(-this.radius, -this.radius);

        // Draw a slightly wider arc to prevent the center line
        this.ctx.beginPath();
        this.ctx.arc(this.radius, this.radius, this.radius + 1, -Math.PI / 2 - 0.01, Math.PI / 2 + 0.01, true);
        this.ctx.closePath();
        this.ctx.fillStyle = phase > 0 ? '#FFFDE7' : '#121826';
        this.ctx.fill();
        this.ctx.restore(); // Restore state after scaling
    }
    _drawCraters() {
        const craters = [
            { x: this.radius * 0.7, y: this.radius * 0.8, r: this.radius * 0.08 },
            { x: this.radius * 0.3, y: this.radius * 0.3, r: this.radius * 0.06 },
            { x: this.radius * 0.8, y: this.radius * 0.4, r: this.radius * 0.09 }
        ];

        // Draw each crater
        craters.forEach(crater => {
            this.ctx.beginPath();
            this.ctx.arc(crater.x, crater.y, crater.r, 0, 2 * Math.PI, false);
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
            this.ctx.fill();
        });
    }
    /**
     * @param {Number} phase - The phase expressed as a float in [0,1] range.
     */
    paint(phase) {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw the base moon disc
        this._drawDisc();

        if (phase <= 0.5) {
            // Add craters
            this._drawCraters();

            // Draw the phase shadow
            this._drawPhase(4 * phase - 1);
        } else {
            // For waning phases, rotate the canvas
            this.ctx.translate(this.radius * 2, this.radius * 2);
            this.ctx.rotate(Math.PI);
            this.ctx.translate(-this.radius, -this.radius);

            // Add craters
            this._drawCraters();

            // Draw the phase shadow
            this._drawPhase(4 * (1 - phase) - 1);
        }

        this.ctx.restore();
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

//==============================================================================
// 3. PUBLIC API AND EXPORTED FUNCTIONS
//==============================================================================

// Module state
let currentAstroData = null;
let isInitialized = false;
let pendingUpdate = null;
let containerId = 'astro-view'; // Default container ID

/**
 * Initialize the astronomical display with resize handling
 * @param {string} containerElementId - ID of the container element
 */
export function initAstro(containerElementId) {
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
    return function(...args) {
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

// Add hooks for manual refreshing
window.refreshAstronomicalDisplay = refreshAstroDisplay;

// Force recalculation on demand
window.forceAstroRecalculation = function() {
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

/**
 * Check if it's currently daytime at a location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} - True if it's daytime, false if nighttime
 */
export function checkIsDaytime(lat, lon) {
    try {
        // Create a fresh Date object for now
        const now = new Date();
        
        // Get timezone from the location
        let timezone = 'UTC';
        try {
            if (typeof window.tzlookup === 'function') {
                timezone = window.tzlookup(lat, lon);
            }
        } catch (e) {
            console.warn('Error with timezone lookup, using UTC');
        }
        
        // Calculate sunrise/sunset using the same logic 
        const result = calcSunriseSunset(now, lat, lon);
        const { sunrise, sunset, isPolarDay, isPolarNight } = result;
        
        // Handle polar day/night
        if (isPolarDay) return true;
        if (isPolarNight) return false;
        
        // If no sunrise/sunset (error case), use hour-based approximation
        if (!sunrise || !sunset) {
            // Longitude-based time approximation
            const utcHours = now.getUTCHours() + (now.getUTCMinutes() / 60);
            const timezoneOffset = lon / 15;
            const locationHour = ((utcHours + timezoneOffset) % 24 + 24) % 24;
            return locationHour >= 6 && locationHour < 18;
        }
        
        // Compare current time with sunrise/sunset
        // Try to use the proper timezone if available
        let currentLocalTime;
        try {
            if (timezone !== 'UTC') {
                const options = {
                    timeZone: timezone,
                    hour12: false,
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric'
                };
                
                const timeStr = now.toLocaleString('en-US', options);
                const [hours, minutes, seconds] = timeStr.split(':').map(Number);
                currentLocalTime = hours + (minutes / 60) + (seconds / 3600);
            } else {
                // Fallback to longitude approximation
                const utcHours = now.getUTCHours() + (now.getUTCMinutes() / 60);
                const timezoneOffset = lon / 15;
                currentLocalTime = ((utcHours + timezoneOffset) % 24 + 24) % 24;
            }
            
            // Extract sunrise/sunset hours
            const sunriseHour = sunrise.getHours() + (sunrise.getMinutes() / 60);
            const sunsetHour = sunset.getHours() + (sunset.getMinutes() / 60);
            
            // Handle case where sunset is after midnight
            let adjustedSunsetHour = sunsetHour;
            if (sunsetHour < sunriseHour) {
                adjustedSunsetHour += 24;
            }
            
            return currentLocalTime >= sunriseHour && currentLocalTime < adjustedSunsetHour;
            
        } catch (e) {
            console.warn('Error comparing times, using simple check:', e);
            // Fallback to simple hour check
            const hour = now.getHours();
            return hour >= 6 && hour < 18;
        }
    } catch (error) {
        console.error('Error in checkIsDaytime:', error);
        // Default to daytime in case of errors
        return true;
    }
}

// Export the createPolarClock function for potential external use
export { createPolarClock };