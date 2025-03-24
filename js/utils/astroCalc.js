/**
 * Astronomical calculations module
 * Provides utility functions for sun and moon calculations using the SunCalc3 library
 */

// Reference to SunCalc to be cached once found
let SunCalcRef = null;

//==============================================================================
// UTILITY FUNCTIONS
//==============================================================================

/**
 * Gets SunCalc reference, attempting multiple ways to access it
 * @returns {Object|null} SunCalc reference or null if not found
 */
function getSunCalc() {
    // Return cached reference if already found
    if (SunCalcRef) return SunCalcRef;

    // Try different ways the library might be exposed
    if (typeof window !== 'undefined') {
        if (window.SunCalc) {
            SunCalcRef = window.SunCalc;
            return SunCalcRef;
        }
    }

    // Try direct global name
    if (typeof SunCalc !== 'undefined') {
        SunCalcRef = SunCalc;
        return SunCalcRef;
    }

    // Try lowercase name
    if (typeof suncalc !== 'undefined') {
        SunCalcRef = suncalc;
        return SunCalcRef;
    }

    return null;
}

/**
 * Create fallback sun data when SunCalc is not available
 * @returns {Object} Default sun time data
 */
function createFallbackSunData() {
    const now = new Date();
    return {
        sunrise: null,
        sunset: null,
        dayLength: 12,
        sunPosition: 0.5,
        rawSunPosition: 0.5,
        isPolarDay: false,
        isPolarNight: false,
        isDaytime: now.getHours() >= 6 && now.getHours() < 18, // Simple day/night check
        formattedSunrise: 'N/A',
        formattedSunset: 'N/A',
        formattedDayLength: '12h 0m',
        timezone: 'UTC',
        locationTime: now.getHours() + now.getMinutes() / 60,
        azimuth: 0,
        altitude: 0
    };
}

/**
 * Create fallback moon data when SunCalc is not available
 * @returns {Object} Default moon data
 */
function createFallbackMoonData() {
    const now = new Date();
    // Create proper date objects for fallback values
    const nextMonth = new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000);
    const halfMonth = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    return {
        phase: 0.5,
        ageDays: 15,
        illumination: 50,
        phaseName: "Waning Crescent",
        nextFullMoon: nextMonth,
        nextNewMoon: halfMonth,
        isWaxing: false,
        isWaning: true,
        angle: 0,
        fraction: 0.5,
        zenithAngle: 0,
        distance: 384400 // Average distance in km
    };
}

//==============================================================================
// SUN CALCULATIONS
//==============================================================================

/**
 * Calculate sunrise, sunset, and other sun information for a specific location
 * @param {number} lat - Latitude in decimal degrees
 * @param {number} lon - Longitude in decimal degrees
 * @param {Date} [date=new Date()] - Date to calculate for
 * @returns {Object} Comprehensive sun data
 */
export function calculateSunTimes(lat, lon, date = new Date()) {
    // Get SunCalc reference
    const suncalc = getSunCalc();
    if (!suncalc) {
        console.warn('SunCalc library not available, using fallback data');
        return createFallbackSunData();
    }

    try {
        // Get timezone if available
        let timezone = 'UTC';
        try {
            if (typeof window.tzlookup === 'function') {
                timezone = window.tzlookup(lat, lon);
            }
        } catch (e) {
            console.warn('Timezone lookup not available');
        }

        // Create a fresh date to avoid caching issues
        const now = new Date(date);

        // Calculate current time at the location
        let localTime;
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
                localTime = hours + (minutes / 60) + (seconds / 3600);
            } else {
                // Approximate local time using longitude
                const utcHours = now.getUTCHours() + (now.getUTCMinutes() / 60);
                const timezoneOffset = lon / 15; // 15° longitude = 1 hour
                localTime = ((utcHours + timezoneOffset) % 24 + 24) % 24;
            }
        } catch (e) {
            console.warn('Error calculating local time, using device time');
            localTime = now.getHours() + (now.getMinutes() / 60);
        }

        // Get sun times from SunCalc
        // Enable addDeprecated for compatibility (5th parameter = true)
        const sunTimes = suncalc.getSunTimes(now, lat, lon, 0, true);

        // Get current sun position
        const sunPosition = suncalc.getPosition(now, lat, lon);

        // Check for polar day/night
        // In SunCalc3, these properties might be directly indicated
        const isPolarDay = sunTimes.polarDay === true ||
            (sunTimes.type === 'polar_day');

        const isPolarNight = sunTimes.polarNight === true ||
            (sunTimes.type === 'polar_night');

        // Extract sunrise/sunset data according to SunCalc3 documentation
        // In SunCalc3, each property is an ISunTimeDef object with a .value property containing the Date
        let sunriseDate = null;
        if (sunTimes.sunriseStart && sunTimes.sunriseStart.value instanceof Date) {
            sunriseDate = sunTimes.sunriseStart.value;
        } else if (sunTimes.sunrise && sunTimes.sunrise.value instanceof Date) {
            sunriseDate = sunTimes.sunrise.value;
        }

        let sunsetDate = null;
        if (sunTimes.sunsetEnd && sunTimes.sunsetEnd.value instanceof Date) {
            sunsetDate = sunTimes.sunsetEnd.value;
        } else if (sunTimes.sunset && sunTimes.sunset.value instanceof Date) {
            sunsetDate = sunTimes.sunset.value;
        }

        // Format time strings
        let formattedSunrise = 'N/A';
        let formattedSunset = 'N/A';

        if (sunriseDate instanceof Date) {
            try {
                formattedSunrise = sunriseDate.toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
            } catch (e) {
                console.warn('Error formatting sunrise time');
            }
        }

        if (sunsetDate instanceof Date) {
            try {
                formattedSunset = sunsetDate.toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
            } catch (e) {
                console.warn('Error formatting sunset time');
            }
        }

        // Calculate day length
        let dayLength = 0;
        if (sunriseDate && sunsetDate) {
            dayLength = (sunsetDate - sunriseDate) / (1000 * 60 * 60); // Convert ms to hours
        } else if (isPolarDay) {
            dayLength = 24; // 24 hours of daylight
        }

        // Format day length
        const dayHours = Math.floor(dayLength);
        const dayMinutes = Math.round((dayLength % 1) * 60);
        const formattedDayLength = `${dayHours}h ${dayMinutes}m`;

        // Determine if it's currently daytime
        // Standard solar elevation for sunrise/sunset is -0.833 degrees
        let isDaytime;
        if (isPolarDay) {
            isDaytime = true;
        } else if (isPolarNight) {
            isDaytime = false;
        } else {
            isDaytime = sunPosition.altitude > -0.833 * (Math.PI / 180);
        }

        // Calculate normalized sun position (0-1) for visualization
        let sunPositionValue;

        if (isPolarDay) {
            // For polar day, use time of day to determine position
            sunPositionValue = (localTime % 24) / 24;
        } else if (isPolarNight) {
            // For polar night, sun is always below horizon
            sunPositionValue = -1; // Negative to indicate below horizon
        } else if (sunriseDate && sunsetDate) {
            // Extract hours for comparison
            const sunriseHour = sunriseDate.getHours() + (sunriseDate.getMinutes() / 60);
            const sunsetHour = sunsetDate.getHours() + (sunsetDate.getMinutes() / 60);

            // Handle day crossing midnight
            let adjustedSunsetHour = sunsetHour;
            if (sunsetHour < sunriseHour) {
                adjustedSunsetHour += 24;
            }

            if (localTime < sunriseHour) {
                // Before sunrise
                const nightProgress = localTime / sunriseHour;
                sunPositionValue = -1 + (nightProgress * 0.9);
            } else if (localTime > sunsetHour && sunsetHour > sunriseHour) {
                // After sunset (same day)
                const nightProgress = (localTime - sunsetHour) / (24 - sunsetHour + sunriseHour);
                sunPositionValue = -0.1 - (nightProgress * 0.9);
                sunPositionValue = Math.max(-1, sunPositionValue); // Cap at -1
            } else if (localTime > 0 && localTime < sunriseHour + 24 && sunsetHour < sunriseHour) {
                // After sunset (next day)
                sunPositionValue = -0.5;
            } else {
                // During daylight
                sunPositionValue = (localTime - sunriseHour) / (adjustedSunsetHour - sunriseHour);
                sunPositionValue = Math.max(0, Math.min(1, sunPositionValue)); // Ensure between 0-1
            }
        } else {
            // Fallback position based on sun altitude
            if (isDaytime) {
                // Scale altitude to position value
                const maxAltitude = Math.PI / 2; // 90 degrees in radians
                const minAltitude = -0.833 * (Math.PI / 180); // -0.833 degrees in radians
                sunPositionValue = (sunPosition.altitude - minAltitude) / (maxAltitude - minAltitude);
                sunPositionValue = Math.max(0, Math.min(1, sunPositionValue));
            } else {
                sunPositionValue = -0.5; // Below horizon
            }
        }

        // For visualization, clamp to 0-1 range
        const visualSunPosition = Math.max(0, Math.min(1, sunPositionValue));

        // Return comprehensive object with all information
        return {
            sunrise: sunriseDate,
            sunset: sunsetDate,
            dayLength,
            sunPosition: visualSunPosition,
            rawSunPosition: sunPositionValue,
            isPolarDay,
            isPolarNight,
            isDaytime,
            formattedSunrise,
            formattedSunset,
            formattedDayLength,
            timezone,
            locationTime: localTime,
            azimuth: sunPosition.azimuth,
            altitude: sunPosition.altitude,
            // Include azimuth/altitude in degrees if available
            azimuthDegrees: sunPosition.azimuthDegrees,
            altitudeDegrees: sunPosition.altitudeDegrees
        };
    } catch (error) {
        console.error('Error calculating sun times:', error);
        return createFallbackSunData();
    }
}

//==============================================================================
// MOON CALCULATIONS
//==============================================================================

/**
 * Calculate moon phase and related information
 * @param {Date} [date=new Date()] - Date to calculate for
 * @returns {Object} Comprehensive moon data
 */
export function calculateMoonPhase(date = new Date()) {
    // Get SunCalc reference
    const suncalc = getSunCalc();
    if (!suncalc) {
        console.warn('SunCalc library not available, using fallback data');
        return createFallbackMoonData();
    }

    try {
        // Create a fresh date object
        const now = new Date(date);

        // Use getMoonIllumination from SunCalc3 which provides detailed data
        const moonIllum = suncalc.getMoonIllumination(now);

        // Extract phase value (0-1 range where 0/1 = new moon and 0.5 = full moon)
        // SunCalc3 may use 'phaseValue' or 'phase' property
        const phase = moonIllum.phaseValue !== undefined ? moonIllum.phaseValue : moonIllum.phase;

        // Calculate illumination percentage from fraction
        const illuminationPercent = parseFloat((moonIllum.fraction * 100).toFixed(1));

        // Determine waxing/waning - in SunCalc3, moon is waxing if angle is negative, waning if positive
        const isWaxing = moonIllum.angle < 0;
        const isWaning = !isWaxing;

        // Get phase name from the SunCalc3 object if available
        let phaseName;
        if (moonIllum.phase && typeof moonIllum.phase === 'object' && moonIllum.phase.name) {
            phaseName = moonIllum.phase.name;
        } else {
            // Fall back to our own calculation
            phaseName = getMoonPhaseName(phase);
        }

        // Replace any "third quarter" variations with "Last Quarter"
        // Check for "third" and "quarter" case-insensitively
        if (phaseName && phaseName.toLowerCase().includes('third') &&
            phaseName.toLowerCase().includes('quarter')) {
            phaseName = "Last Quarter";
        }

        // Ensure proper capitalization regardless of source
        phaseName = capitalizeWords(phaseName);

        // Get next phase dates from the SunCalc3 object if available
        let nextNewMoon, nextFullMoon;

        // SunCalc3 provides next phase dates directly in the 'next' property
        if (moonIllum.next) {
            // Extract next new moon
            if (moonIllum.next.newMoon) {
                if (typeof moonIllum.next.newMoon.date === 'string') {
                    nextNewMoon = new Date(moonIllum.next.newMoon.date);
                } else if (typeof moonIllum.next.newMoon.value === 'number') {
                    nextNewMoon = new Date(moonIllum.next.newMoon.value);
                }
            }

            // Extract next full moon
            if (moonIllum.next.fullMoon) {
                if (typeof moonIllum.next.fullMoon.date === 'string') {
                    nextFullMoon = new Date(moonIllum.next.fullMoon.date);
                } else if (typeof moonIllum.next.fullMoon.value === 'number') {
                    nextFullMoon = new Date(moonIllum.next.fullMoon.value);
                }
            }
        }

        // If we couldn't get the dates from SunCalc3, calculate them
        if (!nextNewMoon || !nextFullMoon) {
            // Synodic month (time between same moon phases) is ~29.53 days
            const SYNODIC_PERIOD = 29.530588861;

            // Calculate days to next new moon (phase 0)
            const daysToNewMoon = ((1 - phase + 1) % 1) * SYNODIC_PERIOD;
            nextNewMoon = new Date(now.getTime() + Math.round(daysToNewMoon * 24 * 60 * 60 * 1000));

            // Calculate days to next full moon (phase 0.5)
            let daysToFullMoon;
            if (phase < 0.5) {
                daysToFullMoon = (0.5 - phase) * SYNODIC_PERIOD;
            } else {
                daysToFullMoon = (1.5 - phase) * SYNODIC_PERIOD;
            }
            nextFullMoon = new Date(now.getTime() + Math.round(daysToFullMoon * 24 * 60 * 60 * 1000));
        }

        // Calculate moon age in days
        const SYNODIC_PERIOD = 29.530588861;
        const moonAgeDays = phase * SYNODIC_PERIOD;

        // Gather additional data available in SunCalc3
        // Try to get moon position data 
        let zenithAngle = 0;
        let distance = 0;

        try {
            if (typeof suncalc.getMoonPosition === 'function') {
                const moonPosition = suncalc.getMoonPosition(now, 0, 0); // Use equator as reference
                if (moonPosition && typeof moonPosition.distance === 'number') {
                    distance = moonPosition.distance;
                }
            }

            // Try to get comprehensive moon data which includes zenithAngle
            if (typeof suncalc.getMoonData === 'function') {
                const moonData = suncalc.getMoonData(now, 0, 0); // Use equator as reference
                if (moonData && typeof moonData.zenithAngle === 'number') {
                    zenithAngle = moonData.zenithAngle;
                }
            }
        } catch (e) {
            console.warn('Error getting additional moon data:', e);
        }

        return {
            phase,
            ageDays: null,
            illumination: illuminationPercent,
            phaseName,
            nextFullMoon,
            nextNewMoon,
            isWaxing,
            isWaning,
            angle: moonIllum.angle,
            fraction: moonIllum.fraction,
            zenithAngle,
            distance
        };
    } catch (error) {
        console.error('Error calculating moon phase:', error);
        return createFallbackMoonData();
    }
}

/**
 * Get the name of a moon phase based on its value
 * @param {number} phase - Moon phase (0-1)
 * @returns {string} Name of the moon phase
 */
export function getMoonPhaseName(phase) {
    // Normalize phase to ensure it's in 0-1 range
    phase = ((phase % 1) + 1) % 1;

    // Define phase ranges
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
    } else {
        return "Waning Crescent";
    }
}

/**
 * Helper function to capitalize words in a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalizeWords(str) {
    if (!str) return '';
    return str.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Determine if it's currently daytime at a location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Date} [date=new Date()] - Date to check
 * @returns {boolean} True if daytime, false if nighttime
 */
export function isDaytime(lat, lon, date = new Date()) {
    try {
        // Get SunCalc reference
        const suncalc = getSunCalc();
        if (!suncalc) {
            // Default to time-based approximation if SunCalc not available
            const hours = date.getHours();
            return hours >= 6 && hours < 18;
        }

        // Get the sun position
        const sunPos = suncalc.getPosition(date, lat, lon);

        // Sun is considered "up" when its center is less than 0.833° below the horizon
        // (standard solar elevation for sunrise/sunset)
        return sunPos.altitude > -0.833 * (Math.PI / 180);
    } catch (error) {
        console.error('Error in isDaytime:', error);
        // Default to daytime as fallback
        return true;
    }
}