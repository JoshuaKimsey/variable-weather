/**
 * Weather Background System
 * 
 * This module handles the dynamic weather backgrounds for the application.
 * It provides animated visual representations of different weather conditions,
 * with day and night variants for most conditions.
 */

//----------------------------------------------------------------------
// INITIALIZATION AND CORE FUNCTIONS
//----------------------------------------------------------------------

// Reference to the background container element
let weatherBackground;

/**
 * Initialize the weather background system
 * @param {string} backgroundElementId - ID of the DOM element to use for backgrounds
 */
export function initBackgrounds(backgroundElementId) {
    weatherBackground = document.getElementById(backgroundElementId);
}

/**
 * Set the weather background based on icon code and time of day
 * @param {string} iconCode - The weather icon code from NWS or other provider
 * @param {boolean} isDaytime - Whether it's currently daytime (optional)
 */
export function setWeatherBackground(iconCode, isDaytime = true) {
    if (!weatherBackground) {
        console.error('Weather background element not initialized');
        return;
    }

    // Clear previous background elements
    weatherBackground.innerHTML = '';

    // Reset background color
    document.body.style.background = '';
    
    console.log('Setting weather background for:', iconCode);
    
    // Determine if it's night time
    const isNight = isDaytime === false;
    console.log('Night time detected:', isNight);
    
    // First check for common icon codes that need time-specific handling
    const timeSpecificChecks = [
        // Rain at night
        { condition: iconCode === 'rain' && isNight, handler: setBackgroundRainNight, message: 'Using rain at night background' },
        // Cloudy at night
        { condition: iconCode === 'cloudy' && isNight, handler: setBackgroundCloudyNight, message: 'Using cloudy at night background' },
        // Wind at night
        { condition: iconCode === 'wind' && isNight, handler: setBackgroundWindNight, message: 'Using wind at night background' }
    ];
    
    // Check time-specific conditions first
    for (const check of timeSpecificChecks) {
        if (check.condition) {
            console.log(check.message);
            check.handler();
            return;
        }
    }
    
    // Try direct mapping from the icon code to background function
    if (WEATHER_BACKGROUND_MAPPING[iconCode]) {
        console.log('Using direct background mapping for:', iconCode);
        WEATHER_BACKGROUND_MAPPING[iconCode]();
        return;
    }
    
    // Pattern-based fallback logic
    if (isNight) {
        applyNightBackgroundByPattern(iconCode);
    } else {
        applyDayBackgroundByPattern(iconCode);
    }
}

/**
 * Apply night background based on pattern matching when no direct mapping exists
 * @param {string} iconCode - The weather icon code to match against
 */
function applyNightBackgroundByPattern(iconCode) {
    // Patterns for night conditions
    const nightPatterns = [
        { pattern: ['rain', 'shower'], handler: setBackgroundRainNight, message: 'Using night rain background (pattern match)' },
        { pattern: ['cloud', 'ovc', 'bkn', 'few', 'sct'], handler: setBackgroundCloudyNight, message: 'Using night cloudy background (pattern match)' },
        { pattern: ['thunder', 'tsra'], handler: setBackgroundThunderstorm, message: 'Using thunderstorm background' },
        { pattern: ['fog', 'haze', 'smoke'], handler: setBackgroundFog, message: 'Using fog background' },
        { pattern: ['snow', 'blizzard'], handler: setBackgroundSnow, message: 'Using snow background' },
        { pattern: ['sleet', 'fzra'], handler: setBackgroundSleet, message: 'Using sleet background' },
        { pattern: ['wind'], handler: setBackgroundWindNight, message: 'Using night wind background' },
        { pattern: ['clear', 'skc'], handler: setBackgroundClearNight, message: 'Using clear night background' }
    ];
    
    // Try to match the icon code against patterns
    for (const { pattern, handler, message } of nightPatterns) {
        if (pattern.some(keyword => iconCode.includes(keyword))) {
            console.log(message);
            handler();
            return;
        }
    }
    
    // Default fallback for night
    console.log('Using default night background (partly cloudy)');
    setBackgroundPartlyCloudyNight();
}

/**
 * Apply day background based on pattern matching when no direct mapping exists
 * @param {string} iconCode - The weather icon code to match against
 */
function applyDayBackgroundByPattern(iconCode) {
    // Patterns for day conditions
    const dayPatterns = [
        { pattern: ['rain', 'shower'], handler: setBackgroundRain, message: 'Using day rain background (pattern match)' },
        { pattern: ['cloud', 'ovc'], handler: setBackgroundCloudy, message: 'Using day cloudy background (pattern match)' },
        { pattern: ['thunder', 'tsra'], handler: setBackgroundThunderstorm, message: 'Using thunderstorm background' },
        { pattern: ['fog', 'haze', 'smoke'], handler: setBackgroundFog, message: 'Using fog background' },
        { pattern: ['snow', 'blizzard'], handler: setBackgroundSnow, message: 'Using snow background' },
        { pattern: ['sleet', 'fzra'], handler: setBackgroundSleet, message: 'Using sleet background' },
        { pattern: ['wind'], handler: setBackgroundWind, message: 'Using wind background' },
        { pattern: ['clear', 'skc'], handler: setBackgroundClearDay, message: 'Using clear day background' },
        { pattern: ['few', 'sct', 'bkn', 'partly'], handler: setBackgroundPartlyCloudy, message: 'Using partly cloudy day background' }
    ];
    
    // Try to match the icon code against patterns
    for (const { pattern, handler, message } of dayPatterns) {
        if (pattern.some(keyword => iconCode.includes(keyword))) {
            console.log(message);
            handler();
            return;
        }
    }
    
    // Default fallback for day
    console.log('Using default day background (cloudy)');
    setBackgroundCloudy();
}

//----------------------------------------------------------------------
// DAY BACKGROUND IMPLEMENTATIONS
//----------------------------------------------------------------------

/**
 * Clear sky during daytime
 * Bright blue gradient with subtle sun effects
 */
function setBackgroundClearDay() {
    document.body.style.background = 'linear-gradient(to bottom, #4A90E2 0%, #87CEEB 100%)';
    
    // Sun has been commented out in the original code,
    // keeping the comment here for reference
    /*
    const sun = document.createElement('div');
    sun.className = 'animation-element sun';
    sun.style.top = '15%';
    sun.style.left = '75%';
    sun.style.opacity = '0.8';
    sun.style.width = '100px';
    sun.style.height = '100px';
    sun.style.boxShadow = '0 0 60px rgba(255, 235, 59, 0.6)';
    sun.style.background = 'radial-gradient(circle, #ffeb3b, rgba(255, 235, 59, 0.6), rgba(255, 235, 59, 0))';
    weatherBackground.appendChild(sun);
    */
}

/**
 * Rainy conditions during daytime
 * Blue-gray gradient with animated rain droplets
 */
function setBackgroundRain() {
    document.body.style.background = 'linear-gradient(to bottom, #4B79A1 0%, #283E51 100%)';

    // Add rain droplets
    for (let i = 0; i < 100; i++) {
        const droplet = document.createElement('div');
        droplet.className = 'animation-element droplet';
        droplet.style.left = `${Math.random() * 100}%`;
        droplet.style.opacity = Math.random() * 0.3 + 0.7;
        droplet.style.animationDuration = `${Math.random() * 0.5 + 0.7}s`;
        droplet.style.animationDelay = `${Math.random() * 2}s`;
        weatherBackground.appendChild(droplet);
    }
}

/**
 * Snowy conditions (day or night)
 * Light gray-blue gradient with animated snowflakes
 */
function setBackgroundSnow() {
    document.body.style.background = 'linear-gradient(to bottom, #757F9A 0%, #D7DDE8 100%)';

    // Add snowflakes
    for (let i = 0; i < 50; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'animation-element snowflake';
        snowflake.textContent = '❄';
        snowflake.style.left = `${Math.random() * 100}%`;
        snowflake.style.opacity = Math.random() * 0.3 + 0.7;
        snowflake.style.fontSize = `${Math.random() * 15 + 5}px`;
        snowflake.style.animationDuration = `${Math.random() * 3 + 5}s`;
        snowflake.style.animationDelay = `${Math.random() * 5}s`;
        weatherBackground.appendChild(snowflake);
    }
}

/**
 * Sleet or mixed precipitation (day or night)
 * Gray-teal gradient with mixed precipitation animations
 */
function setBackgroundSleet() {
    document.body.style.background = 'linear-gradient(to bottom, #616161 0%, #9BC5C3 100%)';

    // Mix of rain and snow elements
    for (let i = 0; i < 70; i++) {
        if (i % 2 === 0) {
            // Rain droplet
            const droplet = document.createElement('div');
            droplet.className = 'animation-element droplet';
            droplet.style.left = `${Math.random() * 100}%`;
            droplet.style.opacity = Math.random() * 0.3 + 0.7;
            droplet.style.animationDuration = `${Math.random() * 0.5 + 0.7}s`;
            droplet.style.animationDelay = `${Math.random() * 2}s`;
            weatherBackground.appendChild(droplet);
        } else {
            // Snowflake (smaller and fewer)
            const snowflake = document.createElement('div');
            snowflake.className = 'animation-element snowflake';
            snowflake.textContent = '❄';
            snowflake.style.left = `${Math.random() * 100}%`;
            snowflake.style.opacity = Math.random() * 0.3 + 0.7;
            snowflake.style.fontSize = `${Math.random() * 8 + 4}px`;
            snowflake.style.animationDuration = `${Math.random() * 3 + 5}s`;
            snowflake.style.animationDelay = `${Math.random() * 5}s`;
            weatherBackground.appendChild(snowflake);
        }
    }
}

/**
 * Windy conditions during daytime
 * Purple-peach gradient with animated wind streaks
 */
function setBackgroundWind() {
    document.body.style.background = 'linear-gradient(to bottom, #636FA4 0%, #E8CBC0 100%)';

    // Add wind elements (moving horizontal lines)
    for (let i = 0; i < 15; i++) {
        const wind = document.createElement('div');
        wind.style.position = 'absolute';
        wind.style.height = '3px';
        wind.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
        wind.style.width = `${Math.random() * 200 + 100}px`;
        wind.style.top = `${Math.random() * 100}%`;
        wind.style.left = '-100px';
        wind.style.animation = `windMove ${Math.random() * 3 + 4}s linear infinite`;
        wind.style.animationDelay = `${Math.random() * 4}s`;
        wind.style.transform = `rotate(${Math.random() * 10 - 5}deg)`;
        weatherBackground.appendChild(wind);
    }
}

/**
 * Foggy conditions (day or night)
 * Light gray gradient with animated fog layers
 */
function setBackgroundFog() {
    document.body.style.background = 'linear-gradient(to bottom, #B6B6B6 0%, #E0E0E0 100%)';

    // Add fog elements
    for (let i = 0; i < 10; i++) {
        const fog = document.createElement('div');
        fog.className = 'animation-element fog';
        fog.style.width = `${Math.random() * 300 + 200}px`;
        fog.style.top = `${Math.random() * 100}%`;
        fog.style.animationDuration = `${Math.random() * 20 + 30}s`;
        fog.style.opacity = Math.random() * 0.2 + 0.1;
        weatherBackground.appendChild(fog);
    }
}

/**
 * Cloudy conditions during daytime
 * Light blue-gray to white gradient with animated clouds
 */
function setBackgroundCloudy() {
    document.body.style.background = 'linear-gradient(to bottom, #8e9eab 0%, #eef2f3 100%)';

    // Add cloud elements
    for (let i = 0; i < 8; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'animation-element cloud';
        cloud.style.width = `${Math.random() * 150 + 100}px`;
        cloud.style.height = `${Math.random() * 60 + 40}px`;
        cloud.style.top = `${Math.random() * 60 + 10}%`;
        cloud.style.animationDuration = `${Math.random() * 30 + 40}s`;

        // Cloud details
        cloud.style.boxShadow = 'inset 40px -20px 40px -30px rgba(255,255,255,0.8)';

        // Create cloud puffs
        const numPuffs = Math.floor(Math.random() * 3) + 2;
        for (let j = 0; j < numPuffs; j++) {
            const puff = document.createElement('div');
            puff.className = 'cloud-puff';
            puff.style.width = `${Math.random() * 70 + 50}px`;
            puff.style.height = `${Math.random() * 70 + 50}px`;
            puff.style.position = 'absolute';
            puff.style.backgroundColor = 'white';
            puff.style.borderRadius = '50%';
            puff.style.top = `${Math.random() * 20 - 30}px`;
            puff.style.left = `${j * 30 + Math.random() * 20}px`;
            cloud.appendChild(puff);
        }

        weatherBackground.appendChild(cloud);
    }
}

/**
 * Partly cloudy conditions during daytime
 * Blue to white gradient with some clouds
 */
function setBackgroundPartlyCloudy() {
    document.body.style.background = 'linear-gradient(to bottom, #2980B9 0%, #6DD5FA 50%, #FFFFFF 100%)';

    // Sun has been commented out in the original code
    
    // Add clouds (fewer than in cloudy)
    for (let i = 0; i < 5; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'animation-element cloud';
        cloud.style.width = `${Math.random() * 150 + 100}px`;
        cloud.style.height = `${Math.random() * 60 + 40}px`;
        cloud.style.top = `${Math.random() * 40 + 30}%`;
        cloud.style.animationDuration = `${Math.random() * 30 + 40}s`;

        // Create cloud puffs
        const numPuffs = Math.floor(Math.random() * 3) + 2;
        for (let j = 0; j < numPuffs; j++) {
            const puff = document.createElement('div');
            puff.className = 'cloud-puff';
            puff.style.width = `${Math.random() * 70 + 50}px`;
            puff.style.height = `${Math.random() * 70 + 50}px`;
            puff.style.position = 'absolute';
            puff.style.backgroundColor = 'white';
            puff.style.borderRadius = '50%';
            puff.style.top = `${Math.random() * 20 - 30}px`;
            puff.style.left = `${j * 30 + Math.random() * 20}px`;
            cloud.appendChild(puff);
        }

        weatherBackground.appendChild(cloud);
    }
}

/**
 * Thunderstorm conditions (day or night)
 * Dark gray gradient with rain and lightning effects
 */
function setBackgroundThunderstorm() {
    document.body.style.background = 'linear-gradient(to bottom, #232526 0%, #414345 100%)';

    // Add rain droplets
    for (let i = 0; i < 100; i++) {
        const droplet = document.createElement('div');
        droplet.className = 'animation-element droplet';
        droplet.style.left = `${Math.random() * 100}%`;
        droplet.style.opacity = Math.random() * 0.3 + 0.7;
        droplet.style.animationDuration = `${Math.random() * 0.5 + 0.7}s`;
        droplet.style.animationDelay = `${Math.random() * 2}s`;
        weatherBackground.appendChild(droplet);
    }

    // Add lightning flashes
    for (let i = 0; i < 3; i++) {
        const lightning = document.createElement('div');
        lightning.className = 'animation-element lightning';
        lightning.style.left = `${20 + Math.random() * 60}%`;
        lightning.style.top = '0';
        lightning.style.height = '100%';
        lightning.style.width = `${Math.random() * 100 + 50}px`;
        lightning.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        lightning.style.animation = `lightningFlash ${Math.random() * 4 + 6}s infinite`;
        lightning.style.animationDelay = `${Math.random() * 5}s`;
        weatherBackground.appendChild(lightning);
    }
}

//----------------------------------------------------------------------
// NIGHT BACKGROUND IMPLEMENTATIONS
//----------------------------------------------------------------------

/**
 * Clear sky during nighttime
 * Dark blue gradient with animated stars
 */
function setBackgroundClearNight() {
    document.body.style.background = 'linear-gradient(to bottom, #0F2027 0%, #203A43 50%, #2C5364 100%)';

    // Add stars to background
    for (let i = 0; i < 100; i++) {
        const star = document.createElement('div');
        star.className = 'animation-element star';
        star.style.top = `${Math.random() * 100}%`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.animationDuration = `${Math.random() * 3 + 2}s`;
        weatherBackground.appendChild(star);
    }
}

/**
 * Rainy conditions during nighttime
 * Dark blue-gray gradient with layered rain effects
 */
function setBackgroundRainNight() {
    // Darker blue-gray gradient for rainy night sky
    document.body.style.background = 'linear-gradient(to bottom, #0a1118 0%, #162029 50%, #1c2a36 100%)';

    // Create a dark overlay to simulate heavy cloud cover
    const rainOverlay = document.createElement('div');
    rainOverlay.style.position = 'absolute';
    rainOverlay.style.top = '0';
    rainOverlay.style.left = '0';
    rainOverlay.style.width = '100%';
    rainOverlay.style.height = '100%';
    rainOverlay.style.background = 'linear-gradient(to bottom, rgba(10, 17, 24, 0.7) 0%, rgba(22, 32, 41, 0.5) 100%)';
    rainOverlay.style.zIndex = '1';
    weatherBackground.appendChild(rainOverlay);
    
    // Add rain droplets in layers for depth
    // Layer 1 - distant rain (slower, more transparent)
    for (let i = 0; i < 40; i++) {
        const droplet = document.createElement('div');
        droplet.className = 'animation-element droplet';
        droplet.style.left = `${Math.random() * 100}%`;
        droplet.style.opacity = Math.random() * 0.2 + 0.2; // More transparent
        droplet.style.backgroundColor = 'rgba(180, 200, 240, 0.4)'; // Blueish for night rain
        droplet.style.width = '1px'; // Thinner rain
        droplet.style.height = `${Math.random() * 15 + 10}px`; // Shorter streaks
        droplet.style.animationDuration = `${Math.random() * 0.8 + 1.2}s`; // Slower
        droplet.style.animationDelay = `${Math.random() * 3}s`;
        droplet.style.zIndex = '2';
        weatherBackground.appendChild(droplet);
    }
    
    // Layer 2 - mid-distance rain (medium speed and opacity)
    for (let i = 0; i < 60; i++) {
        const droplet = document.createElement('div');
        droplet.className = 'animation-element droplet';
        droplet.style.left = `${Math.random() * 100}%`;
        droplet.style.opacity = Math.random() * 0.3 + 0.4;
        droplet.style.backgroundColor = 'rgba(180, 200, 240, 0.5)';
        droplet.style.width = '1.5px';
        droplet.style.height = `${Math.random() * 20 + 15}px`;
        droplet.style.animationDuration = `${Math.random() * 0.6 + 0.8}s`;
        droplet.style.animationDelay = `${Math.random() * 2}s`;
        droplet.style.zIndex = '3';
        weatherBackground.appendChild(droplet);
    }
    
    // Layer 3 - close rain (faster, more visible)
    for (let i = 0; i < 80; i++) {
        const droplet = document.createElement('div');
        droplet.className = 'animation-element droplet';
        droplet.style.left = `${Math.random() * 100}%`;
        droplet.style.opacity = Math.random() * 0.3 + 0.6;
        droplet.style.backgroundColor = 'rgba(180, 200, 240, 0.6)';
        droplet.style.width = '2px';
        droplet.style.height = `${Math.random() * 25 + 20}px`;
        droplet.style.animationDuration = `${Math.random() * 0.5 + 0.5}s`;
        droplet.style.animationDelay = `${Math.random() * 1.5}s`;
        droplet.style.zIndex = '4';
        weatherBackground.appendChild(droplet);
    }
}

/**
 * Cloudy conditions during nighttime
 * Dark blue-purple gradient with multi-layered clouds
 */
function setBackgroundCloudyNight() {
    // Darker blue-gray gradient for a heavily overcast night
    document.body.style.background = 'linear-gradient(to bottom, #121620 0%, #1c2331 60%, #2c3350 100%)';

    // Add very few stars - only a couple should be visible through heavy cloud cover
    for (let i = 0; i < 8; i++) {
        const star = document.createElement('div');
        star.className = 'animation-element star';
        star.style.top = `${Math.random() * 30}%`; // Only in top portion of sky
        star.style.left = `${Math.random() * 100}%`;
        star.style.opacity = Math.random() * 0.3 + 0.1; // Very faint stars
        star.style.animationDuration = `${Math.random() * 3 + 2}s`;
        weatherBackground.appendChild(star);
    }

    // Create a dark cloud "blanket" covering most of the sky
    const cloudCover = document.createElement('div');
    cloudCover.style.position = 'absolute';
    cloudCover.style.top = '0';
    cloudCover.style.left = '0';
    cloudCover.style.width = '100%';
    cloudCover.style.height = '70%';
    cloudCover.style.background = 'linear-gradient(to bottom, rgba(25, 28, 40, 0.9) 0%, rgba(32, 35, 50, 0.7) 100%)';
    cloudCover.style.zIndex = '1';
    weatherBackground.appendChild(cloudCover);

    // Add multiple dense cloud layers
    addCloudLayer(5, 180, 200, 80, 100, '#292d3e', 0.9, 50, 40, 2, 5, 40, 3, 4);
    addCloudLayer(4, 150, 220, 60, 80, '#232736', 0.85, 40, 35, 3, 20, 50, 2, 3);
    addCloudLayer(3, 120, 160, 40, 60, '#272b3d', 0.9, 35, 30, 4, 15, 60, 2, 3, true);
    
    // Add slight fog effect near the bottom
    const fogLayer = document.createElement('div');
    fogLayer.style.position = 'absolute';
    fogLayer.style.bottom = '0';
    fogLayer.style.left = '0';
    fogLayer.style.width = '100%';
    fogLayer.style.height = '30%';
    fogLayer.style.background = 'linear-gradient(to top, rgba(40, 45, 60, 0.8) 0%, rgba(40, 45, 60, 0) 100%)';
    fogLayer.style.zIndex = '5';
    weatherBackground.appendChild(fogLayer);
}

/**
 * Partly cloudy conditions during nighttime
 * Dark blue gradient with stars and some clouds
 */
function setBackgroundPartlyCloudyNight() {
    document.body.style.background = 'linear-gradient(to bottom, #0F2027 0%, #203A43 50%, #2C5364 100%)';

    // Add stars (fewer than clear night)
    for (let i = 0; i < 50; i++) {
        const star = document.createElement('div');
        star.className = 'animation-element star';
        star.style.top = `${Math.random() * 100}%`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.animationDuration = `${Math.random() * 3 + 2}s`;
        weatherBackground.appendChild(star);
    }

    // Add cloud elements
    for (let i = 0; i < 4; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'animation-element cloud';
        cloud.style.width = `${Math.random() * 150 + 100}px`;
        cloud.style.height = `${Math.random() * 60 + 40}px`;
        cloud.style.top = `${Math.random() * 40 + 30}%`;
        cloud.style.opacity = '0.7'; // Make clouds slightly transparent
        cloud.style.animationDuration = `${Math.random() * 30 + 40}s`;

        // Create cloud puffs
        const numPuffs = Math.floor(Math.random() * 3) + 2;
        for (let j = 0; j < numPuffs; j++) {
            const puff = document.createElement('div');
            puff.className = 'cloud-puff';
            puff.style.width = `${Math.random() * 70 + 50}px`;
            puff.style.height = `${Math.random() * 70 + 50}px`;
            puff.style.position = 'absolute';
            puff.style.backgroundColor = '#AAAAAA';
            puff.style.borderRadius = '50%';
            puff.style.top = `${Math.random() * 20 - 30}px`;
            puff.style.left = `${j * 30 + Math.random() * 20}px`;
            cloud.appendChild(puff);
        }

        weatherBackground.appendChild(cloud);
    }
}

/**
 * Windy conditions during nighttime
 * Dark blue-purple gradient with wind streaks and debris
 */
function setBackgroundWindNight() {
    // Dark blue-purple gradient for night sky
    document.body.style.background = 'linear-gradient(to bottom, #0c1220 0%, #1a2338 50%, #2a304d 100%)';
    
    // Add some sparse stars
    for (let i = 0; i < 25; i++) {
        const star = document.createElement('div');
        star.className = 'animation-element star';
        star.style.top = `${Math.random() * 60}%`; // Keep stars in upper portion
        star.style.left = `${Math.random() * 100}%`;
        star.style.opacity = Math.random() * 0.4 + 0.1; // Faint stars
        star.style.animationDuration = `${Math.random() * 3 + 2}s`;
        weatherBackground.appendChild(star);
    }
    
    // Add wind elements (moving horizontal lines) with better visibility for night
    for (let i = 0; i < 20; i++) {
        const wind = document.createElement('div');
        wind.style.position = 'absolute';
        wind.style.height = `${Math.random() * 2 + 1}px`; // Varied thickness
        wind.style.backgroundColor = `rgba(180, 200, 220, ${Math.random() * 0.3 + 0.1})`; // Lighter color for visibility
        wind.style.width = `${Math.random() * 200 + 100}px`;
        wind.style.top = `${Math.random() * 100}%`;
        wind.style.left = '-100px';
        wind.style.animation = `windMove ${Math.random() * 3 + 3}s linear infinite`; // Slightly faster for more intensity
        wind.style.animationDelay = `${Math.random() * 3}s`;
        wind.style.transform = `rotate(${Math.random() * 6 - 3}deg)`; // Slight angle variation
        wind.style.zIndex = '2';
        weatherBackground.appendChild(wind);
    }
    
    // Add some fast-moving wispy clouds
    for (let i = 0; i < 6; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'animation-element cloud';
        cloud.style.width = `${Math.random() * 120 + 80}px`;
        cloud.style.height = `${Math.random() * 40 + 20}px`;
        cloud.style.backgroundColor = i % 2 === 0 ? '#222a3d' : '#2a3248'; // Dark clouds
        cloud.style.borderRadius = '40px';
        cloud.style.position = 'absolute';
        cloud.style.top = `${Math.random() * 70 + 5}%`;
        cloud.style.left = '-120px'; // Start off-screen
        cloud.style.opacity = Math.random() * 0.5 + 0.3; // Semi-transparent
        
        // Custom animation for fast-moving clouds
        const animationDuration = Math.random() * 12 + 8; // 8-20 seconds to cross screen
        cloud.style.animation = `windCloud ${animationDuration}s linear infinite`;
        cloud.style.animationDelay = `${Math.random() * animationDuration}s`; // Stagger start times
        
        // Add a few puffs to each cloud
        const numPuffs = Math.floor(Math.random() * 2) + 2; // 2-3 puffs
        for (let j = 0; j < numPuffs; j++) {
            const puff = document.createElement('div');
            puff.className = 'cloud-puff';
            puff.style.width = `${Math.random() * 50 + 30}px`;
            puff.style.height = `${Math.random() * 50 + 30}px`;
            puff.style.position = 'absolute';
            puff.style.backgroundColor = cloud.style.backgroundColor; // Match cloud color
            puff.style.borderRadius = '50%';
            puff.style.bottom = `${Math.random() * 10 - 5}px`;
            puff.style.left = `${j * 30 + Math.random() * 10}px`;
            cloud.appendChild(puff);
        }
        
        weatherBackground.appendChild(cloud);
    }
    
    // Add some leaves or debris for more wind indication
    for (let i = 0; i < 10; i++) {
        const debris = document.createElement('div');
        debris.style.position = 'absolute';
        debris.style.width = '4px';
        debris.style.height = '4px';
        debris.style.backgroundColor = '#a8a090'; // Light brown/gray color
        debris.style.borderRadius = '50%';
        debris.style.top = `${Math.random() * 70 + 30}%`; // Keep in lower portion
        debris.style.left = '-10px'; // Start off-screen
        
        // Create the swirling animation
        const duration = Math.random() * 5 + 8;
        debris.style.animation = `debrisMove ${duration}s linear infinite`;
        debris.style.animationDelay = `${Math.random() * 5}s`;
        
        weatherBackground.appendChild(debris);
    }
    
    // Add rippling effect on lower part to suggest disturbance (like grass or water)
    const rippleLayer = document.createElement('div');
    rippleLayer.style.position = 'absolute';
    rippleLayer.style.bottom = '0';
    rippleLayer.style.left = '0';
    rippleLayer.style.width = '100%';
    rippleLayer.style.height = '20%';
    rippleLayer.style.background = 'linear-gradient(to top, rgba(25, 35, 55, 0.4) 0%, rgba(25, 35, 55, 0) 100%)';
    rippleLayer.style.zIndex = '1';
    rippleLayer.style.animation = 'rippleWind 8s ease-in-out infinite';
    weatherBackground.appendChild(rippleLayer);
    
    // Add necessary animations
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes windMove {
            0% {
                transform: translateX(0) rotate(${Math.random() * 6 - 3}deg);
                opacity: 0;
            }
            10% {
                opacity: 0.4;
            }
            90% {
                opacity: 0.4;
            }
            100% {
                transform: translateX(calc(100vw + 200px)) rotate(${Math.random() * 6 - 3}deg);
                opacity: 0;
            }
        }
        
        @keyframes windCloud {
            0% {
                transform: translateX(0);
            }
            100% {
                transform: translateX(calc(100vw + 200px));
            }
        }
        
        @keyframes debrisMove {
            0% {
                transform: translateX(0) translateY(0) rotate(0deg);
                opacity: 0;
            }
            10% {
                opacity: 0.7;
            }
            100% {
                transform: translateX(calc(100vw + 20px)) translateY(${Math.random() * 100 - 50}px) rotate(${Math.random() * 360 + 360}deg);
                opacity: 0;
            }
        }
        
        @keyframes rippleWind {
            0%, 100% {
                transform: scaleY(1.0) translateY(0);
            }
            50% {
                transform: scaleY(1.1) translateY(-5px);
            }
        }
    `;
    document.head.appendChild(style);
}

//----------------------------------------------------------------------
// HELPER FUNCTIONS
//----------------------------------------------------------------------

/**
 * Helper function to add a layer of clouds with specified properties
 * Used by the cloudy night background to create multiple cloud layers
 * 
 * @param {number} count - Number of clouds to create
 * @param {number} minWidth - Minimum cloud width
 * @param {number} maxWidth - Maximum cloud width
 * @param {number} minHeight - Minimum cloud height
 * @param {number} maxHeight - Maximum cloud height
 * @param {string} color - Cloud color (CSS color string)
 * @param {number} opacity - Cloud opacity (0-1)
 * @param {number} maxAnim - Maximum animation duration (in seconds)
 * @param {number} minAnim - Minimum animation duration (in seconds)
 * @param {number} zIndex - z-index for this cloud layer
 * @param {number} leftPos - Left position (percentage) - or right if useRight is true
 * @param {number} topPos - Top position range (percentage)
 * @param {number} minPuffs - Minimum number of puffs per cloud
 * @param {number} maxPuffs - Maximum number of puffs per cloud
 * @param {boolean} useRight - Whether to position from right instead of left
 * @param {boolean} reverseDirection - Whether to reverse animation direction
 */
function addCloudLayer(count, minWidth, maxWidth, minHeight, maxHeight, color, opacity, 
                      maxAnim, minAnim, zIndex, leftPos, topPos, minPuffs, maxPuffs, 
                      useRight = false, reverseDirection = false) {
    for (let i = 0; i < count; i++) {
        const cloud = document.createElement('div');
        cloud.className = 'animation-element cloud';
        cloud.style.width = `${Math.random() * (maxWidth - minWidth) + minWidth}px`;
        cloud.style.height = `${Math.random() * (maxHeight - minHeight) + minHeight}px`;
        cloud.style.backgroundColor = color;
        cloud.style.borderRadius = '50px';
        cloud.style.position = 'absolute';
        cloud.style.top = `${Math.random() * topPos + 5}%`;
        
        if (useRight) {
            cloud.style.right = `${Math.random() * leftPos}%`;
        } else {
            cloud.style.left = `${Math.random() * leftPos}%`;
        }
        
        cloud.style.animationDuration = `${Math.random() * (maxAnim - minAnim) + minAnim}s`;
        
        if (reverseDirection) {
            cloud.style.animationDirection = 'reverse';
        }
        
        cloud.style.opacity = opacity;
        cloud.style.zIndex = zIndex.toString();

        // Create cloud puffs
        const numPuffs = Math.floor(Math.random() * (maxPuffs - minPuffs + 1)) + minPuffs;
        for (let j = 0; j < numPuffs; j++) {
            const puff = document.createElement('div');
            puff.className = 'cloud-puff';
            puff.style.width = `${Math.random() * (cloud.style.width.replace('px', '') * 0.5) + 50}px`;
            puff.style.height = `${Math.random() * (cloud.style.height.replace('px', '') * 0.5) + 50}px`;
            puff.style.position = 'absolute';
            puff.style.backgroundColor = color;
            puff.style.borderRadius = '50%';
            puff.style.top = `${Math.random() * 20 - 30}px`;
            puff.style.left = `${j * 35 + Math.random() * 20}px`;
            cloud.appendChild(puff);
        }

        weatherBackground.appendChild(cloud);
    }
}

//----------------------------------------------------------------------
// WEATHER ICON TO BACKGROUND FUNCTION MAPPING
//----------------------------------------------------------------------

/**
 * Map of weather condition codes to background functions
 * This provides direct mappings from icon codes to their handler functions
 */
const WEATHER_BACKGROUND_MAPPING = {
    // NWS Day backgrounds
    'skc': setBackgroundClearDay, // clear day
    'few': setBackgroundPartlyCloudy, // few clouds day
    'sct': setBackgroundPartlyCloudy, // scattered clouds day
    'bkn': setBackgroundPartlyCloudy, // broken clouds day
    'ovc': setBackgroundCloudy, // overcast clouds
    'wind': setBackgroundWind, // windy
    'snow': setBackgroundSnow, // snow
    'rain': setBackgroundRain, // rain
    'rain_showers': setBackgroundRain, // rain showers
    'rain_showers_hi': setBackgroundRain, // rain showers with higher intensity
    'tsra': setBackgroundThunderstorm, // thunderstorms
    'tsra_sct': setBackgroundThunderstorm, // scattered thunderstorms
    'tsra_hi': setBackgroundThunderstorm, // high intensity thunderstorms
    'tornado': setBackgroundThunderstorm, // tornado
    'hurricane': setBackgroundThunderstorm, // hurricane
    'tropical_storm': setBackgroundRain, // tropical storm
    'dust': setBackgroundFog, // dust
    'smoke': setBackgroundFog, // smoke
    'haze': setBackgroundFog, // haze
    'hot': setBackgroundClearDay, // hot
    'cold': setBackgroundClearDay, // cold
    'blizzard': setBackgroundSnow, // blizzard
    'fog': setBackgroundFog, // fog

    // NWS Night backgrounds
    'nskc': setBackgroundClearNight, // clear night
    'nfew': setBackgroundPartlyCloudyNight, // few clouds night
    'nsct': setBackgroundPartlyCloudyNight, // scattered clouds night
    'nbkn': setBackgroundPartlyCloudyNight, // broken clouds night
    'nrain': setBackgroundRainNight, // rain night
    'nrain_showers': setBackgroundRainNight, // rain showers night
    'nrain_showers_hi': setBackgroundRainNight, // rain showers with higher intensity night
    'ntropical_storm': setBackgroundRainNight, // tropical storm night
    'novc': setBackgroundCloudyNight, // overcast clouds night
    'nwind': setBackgroundWindNight, // wind night
    
    // Pirate Weather backgrounds (fallback)
    'clear-day': setBackgroundClearDay,
    'clear-night': setBackgroundClearNight,
    'partly-cloudy-day': setBackgroundPartlyCloudy,
    'partly-cloudy-night': setBackgroundPartlyCloudyNight,
    'thunderstorm': setBackgroundThunderstorm,
    'sleet': setBackgroundSleet,
    'cloudy': setBackgroundCloudy
};