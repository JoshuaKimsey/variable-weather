/**
 * Weather Icon System
 * 
 * This module handles the creation and rendering of animated weather icons
 * for different weather conditions, with day and night variants.
 * Icons are dynamically generated with random variations for a more
 * natural appearance.
 */

//----------------------------------------------------------------------
// EXPORTS AND MAIN INTERFACES
//----------------------------------------------------------------------

// Clean up any old animations when this module loads
cleanupOldCloudAnimations();

// Export the icon mapping for external use
export const weatherIcons = {
    // NWS icons - Basic icons
    'skc': createClearDayIcon, // clear day
    'few': createPartlyCloudyDayIcon, // few clouds day
    'sct': createPartlyCloudyDayIcon, // scattered clouds day
    'bkn': createPartlyCloudyDayIcon, // broken clouds day
    'ovc': createCloudyIcon, // overcast clouds
    'wind': createWindIcon, // windy
    'snow': createSnowIcon, // snow
    'rain': createRainIcon, // rain
    'rain_showers': createRainIcon, // rain showers
    'rain_showers_hi': createRainIcon, // rain showers with higher intensity
    'tsra': createThunderstormIcon, // thunderstorms
    'tsra_sct': createThunderstormIcon, // scattered thunderstorms
    'tsra_hi': createThunderstormIcon, // high intensity thunderstorms
    'tornado': createThunderstormIcon, // tornado (no specialized icon, using thunderstorm)
    'hurricane': createThunderstormIcon, // hurricane (no specialized icon, using thunderstorm)
    'tropical_storm': createRainIcon, // tropical storm
    'dust': createFogIcon, // dust
    'smoke': createFogIcon, // smoke
    'haze': createFogIcon, // haze
    'hot': createClearDayIcon, // hot
    'cold': createClearDayIcon, // cold
    'blizzard': createSnowIcon, // blizzard
    'fog': createFogIcon, // fog

    // Additional NWS icon codes 
    'fzra': createSleetIcon, // freezing rain
    'ip': createSleetIcon, // ice pellets
    'mix': createSleetIcon, // wintry mix
    'raip': createSleetIcon, // rain/ice pellets
    'rasn': createSleetIcon, // rain/snow
    'shra': createRainIcon, // showers
    'sleet': createSleetIcon, // sleet
    'fzrara': createSleetIcon, // freezing rain/rain
    'hi_shwrs': createRainIcon, // slight chance showers
    'hi_nshwrs': createRainIcon, // slight chance showers night
    'frhza': createFogIcon, // freezing haze
    'hi_tsra': createThunderstormIcon, // slight chance thunderstorms
    'fc': createThunderstormIcon, // funnel cloud
    'hurr': createThunderstormIcon, // hurricane
    'hur_warn': createThunderstormIcon, // hurricane warning
    'waterspout': createThunderstormIcon, // waterspout
    'hurricane_warning': createThunderstormIcon, // hurricane warning
    'ts_warn': createThunderstormIcon, // thunderstorm warning
    'tor_warn': createThunderstormIcon, // tornado warning
    'hurricane_watch': createThunderstormIcon, // hurricane watch
    'ts_watch': createThunderstormIcon, // thunderstorm watch
    'tor_watch': createThunderstormIcon, // tornado watch

    // Night versions - Basic NWS icons
    'nskc': createClearNightIcon, // clear night
    'nfew': createPartlyCloudyNightIcon, // few clouds night
    'nsct': createPartlyCloudyNightIcon, // scattered clouds night
    'nbkn': createPartlyCloudyNightIcon, // broken clouds night

    // Night versions - Additional NWS icons
    'nwind': createWindIcon, // wind night
    'nrain': createRainIcon, // rain night
    'ntsra': createThunderstormIcon, // thunderstorm night
    'nfog': createFogIcon, // fog night
    'nsnow': createSnowIcon, // snow night
    'nsleet': createSleetIcon, // sleet night
    'nfzra': createSleetIcon, // freezing rain night
    'nip': createSleetIcon, // ice pellets night
    'nmix': createSleetIcon, // wintry mix night
    'nraip': createSleetIcon, // rain/ice pellets night
    'nrasn': createSleetIcon, // rain/snow night
    'nshra': createRainIcon, // showers night
    'nfzrara': createSleetIcon, // freezing rain/rain night

    // Pirate weather icons (fallback)
    'clear-day': createClearDayIcon,
    'clear-night': createClearNightIcon,
    'rain': createRainIcon,
    'snow': createSnowIcon,
    'sleet': createSleetIcon,
    'wind': createWindIcon,
    'fog': createFogIcon,
    'cloudy': createCloudyIcon,
    'partly-cloudy-day': createPartlyCloudyDayIcon,
    'partly-cloudy-night': createPartlyCloudyNightIcon,
    'thunderstorm': createThunderstormIcon
};

/**
 * Set weather icon based on icon code
 * @param {string} iconCode - The weather icon code
 * @param {HTMLElement} element - DOM element to append the icon to
 */
export function setWeatherIcon(iconCode, element) {
    // Clear previous icon
    element.innerHTML = '';
    
    // Create a wrapper to ensure proper positioning
    const wrapper = document.createElement('div');
    wrapper.className = 'weather-icon-wrapper';
    element.appendChild(wrapper);
    
    // Create and add the appropriate icon
    if (weatherIcons[iconCode]) {
        weatherIcons[iconCode](wrapper);
    } else {
        // Fallback for unknown icon codes
        console.warn(`Unknown icon code: ${iconCode}. Using cloudy icon as fallback.`);
        createCloudyIcon(wrapper);
    }
}

/**
 * Set forecast icon (smaller variant)
 * @param {string} iconCode - The weather icon code
 * @param {HTMLElement} element - DOM element to append the icon to
 */
export function setForecastIcon(iconCode, element) {
    // Clear previous icon
    element.innerHTML = '';
    
    // Create a wrapper to ensure proper positioning
    const wrapper = document.createElement('div');
    wrapper.className = 'weather-icon-wrapper';
    element.appendChild(wrapper);
    
    if (weatherIcons[iconCode]) {
        weatherIcons[iconCode](wrapper, true);
    } else {
        createCloudyIcon(wrapper, true);
    }
}

//----------------------------------------------------------------------
// CLOUD GENERATION UTILITIES
//----------------------------------------------------------------------

/**
 * Generate a random cloud with unique variations
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.baseWidth - Base width for the cloud
 * @param {number} options.baseHeight - Base height for the cloud
 * @param {string} options.color - Base color for the cloud
 * @param {number} options.top - Top position (percentage)
 * @param {number} options.left - Left position (percentage)
 * @param {number} options.zIndex - Z-index for the cloud
 * @param {boolean} options.animate - Whether to animate the cloud
 * @param {number} options.minPuffs - Minimum number of puffs to add
 * @param {number} options.maxPuffs - Maximum number of puffs to add
 * @param {number} options.variance - Variance factor for randomness (0-1)
 * @param {string} options.boxShadow - Optional box shadow for the cloud
 * @returns {HTMLElement} - The generated cloud element
 */
function generateRandomCloud(options) {
    // Default options
    const defaults = {
        baseWidth: 100,
        baseHeight: 50,
        color: '#FFFFFF',
        top: 50,
        left: 50,
        zIndex: 1,
        animate: true,
        minPuffs: 3,
        maxPuffs: 5,
        variance: 0.2,
        boxShadow: null
    };

    // Merge default options with provided options
    const config = {...defaults, ...options};
    
    // Apply randomness to dimensions within variance
    const varianceFactor = (1 - config.variance) + (Math.random() * config.variance * 2);
    const width = config.baseWidth * varianceFactor;
    const height = config.baseHeight * (0.9 + Math.random() * 0.2); // Less variance for height
    
    // Create the cloud base
    const cloud = document.createElement('div');
    cloud.className = 'animation-element cloud';
    cloud.style.width = `${width}px`;
    cloud.style.height = `${height}px`;
    cloud.style.backgroundColor = config.color;
    cloud.style.borderRadius = `${Math.max(height, width) * 0.5}px`;
    cloud.style.position = 'absolute';
    cloud.style.top = `${config.top}%`;
    cloud.style.left = `${config.left}%`;
    cloud.style.zIndex = config.zIndex;
    
    // Apply box shadow if provided
    if (config.boxShadow) {
        cloud.style.boxShadow = config.boxShadow;
    }
    
    // Add animation with improved looping
    if (config.animate) {
        // Generate unique animation ID to prevent conflicts
        const animId = Math.random().toString(36).substring(2, 10);
        
        // Create custom keyframes for this specific cloud to ensure smooth animation
        const style = document.createElement('style');
        
        // Create a custom animation name for this cloud instance
        const animationName = `cloudFloat_${animId}`;
        
        // Define horizontal and vertical movement ranges
        const xRange = 10; // Total horizontal movement in pixels
        const yRange = 5;  // Total vertical movement in pixels
        
        // Add keyframes with proper easing for smooth looping
        style.innerHTML = `
            @keyframes ${animationName} {
                0% { transform: translate(0, 0); }
                50% { transform: translate(${xRange}px, -${yRange}px); }
                100% { transform: translate(0, 0); }
            }
        `;
        document.head.appendChild(style);
        
        // Set animation with longer duration and proper timing function
        const animationDuration = 10 + Math.random() * 10; // 30-60s
        cloud.style.animation = `${animationName} ${animationDuration}s infinite ease-in-out`;
        
        // Randomize animation start point to prevent all clouds moving in sync
        cloud.style.animationDelay = `${Math.random() * -animationDuration}s`;
    }
    
    // Continue with creating cloud puffs as before...
    // Determine number of puffs to add
    const numPuffs = Math.floor(Math.random() * (config.maxPuffs - config.minPuffs + 1)) + config.minPuffs;
    
    // Create puff reference points - distribute along the top of the cloud
    const puffPositions = [];
    
    // Always include puffs at the extremes and middle for good coverage
    puffPositions.push({left: 10 + Math.random() * 10, bottom: 50 + Math.random() * 20}); // Left edge
    puffPositions.push({left: 45 + Math.random() * 10, bottom: 50 + Math.random() * 30}); // Middle
    puffPositions.push({left: 80 + Math.random() * 10, bottom: 50 + Math.random() * 20}); // Right edge
    
    // Add additional random puffs if needed
    for (let i = 3; i < numPuffs; i++) {
        const leftPos = 15 + Math.random() * 70; // Avoid extreme edges
        const bottomPos = 40 + Math.random() * 30;
        
        // Check if too close to existing puffs
        const tooClose = puffPositions.some(pos => {
            const distance = Math.sqrt(Math.pow(pos.left - leftPos, 2) + Math.pow(pos.bottom - bottomPos, 2));
            return distance < 15; // Minimum distance between puff centers
        });
        
        // If not too close, add to positions
        if (!tooClose) {
            puffPositions.push({left: leftPos, bottom: bottomPos});
        } else {
            // Try again
            i--;
        }
    }
    
    // Create puffs based on the positions
    puffPositions.forEach(pos => {
        const puff = document.createElement('div');
        puff.className = 'cloud-puff';
        
        // Random size for each puff, with the center puff being largest
        const isPuffNearCenter = Math.abs(pos.left - 50) < 20;
        const puffSizeFactor = isPuffNearCenter ? 
                            (0.9 + Math.random() * 0.2) : 
                            (0.6 + Math.random() * 0.3);
        
        const puffSize = Math.max(width, height) * 0.6 * puffSizeFactor;
        
        puff.style.width = `${puffSize}px`;
        puff.style.height = `${puffSize}px`;
        puff.style.position = 'absolute';
        puff.style.backgroundColor = config.color;
        puff.style.borderRadius = '50%';
        puff.style.bottom = `${pos.bottom}%`;
        puff.style.left = `${pos.left}%`;
        
        // Random subtle opacity variation for texture (if not a night cloud)
        if (!config.color.includes('#AAA') && !config.color.includes('#555')) {
            puff.style.opacity = 0.9 + Math.random() * 0.1;
        }
        
        // Apply the same box shadow if provided
        if (config.boxShadow) {
            puff.style.boxShadow = config.boxShadow;
        }
        
        cloud.appendChild(puff);
    });
    
    return cloud;
}

/**
 * Remove old animation-related styles that could cause conflicts
 * 
 * This function should be called when updating the icon system to ensure
 * that old animation keyframes don't conflict with the new ones.
 */
function cleanupOldCloudAnimations() {
    // Find and remove any existing cloudFloat animation styles
    const oldStyles = document.querySelectorAll('style');
    oldStyles.forEach(style => {
        if (style.innerHTML.includes('@keyframes cloudFloat')) {
            style.remove();
        }
    });
}

/**
 * Generate a cloud group with multiple random clouds
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.numClouds - Number of clouds to generate
 * @param {number} options.containerSize - Size of the container element
 * @param {boolean} options.isNight - Whether it's nighttime (affects coloring)
 * @param {number} options.coverage - Cloud coverage factor (0-1)
 * @param {boolean} options.isDark - Whether to use darker clouds (for storms)
 * @returns {DocumentFragment} - Fragment containing the generated clouds
 */
function generateCloudGroup(options) {
    // Default options
    const defaults = {
        numClouds: 3,
        containerSize: 150,
        isNight: false,
        coverage: 0.7, // 0.3=sparse, 0.7=moderate, 1.0=full coverage
        isDark: false
    };

    // Merge default options with provided options
    const config = {...defaults, ...options};
    
    // Create document fragment to hold all clouds
    const fragment = document.createDocumentFragment();
    
    // Determine cloud coloring based on time and type
    let cloudColor;
    let boxShadow = null;
    
    if (config.isDark) {
        // Dark storm clouds
        cloudColor = '#555555';
    } else if (config.isNight) {
        // Night clouds - darker and more blue/gray
        cloudColor = '#A5B0C3';
    } else {
        // Day clouds - white with optional slight shadow for depth
        cloudColor = '#FFFFFF';
        boxShadow = '0 0 20px rgba(255, 255, 255, 0.3)';
    }
    
    // SHIFTED POSITIONING STRATEGIES - All clouds moved more to the left
    const positionStrategies = {
        // Sparse coverage (few clouds) - for partly cloudy
        sparse: [
            {top: 30, left: -10 + (Math.random() * 20), z: 3, size: 0.9},  // Main cloud in center (shifted left)
            {top: 20, left: -10 + (Math.random() * 20), z: 2, size: 0.7},  // Second cloud top-left
            {top: 40, left: -10 + (Math.random() * 20), z: 1, size: 0.75}  // Third cloud right (shifted left)
        ],
        // Moderate coverage - for normal cloudy
        moderate: [
            {top: 30, left: -10 + (Math.random() * 20), z: 3, size: 1.0},  // Main central cloud (shifted left)
            {top: 20, left: -10 + (Math.random() * 20), z: 3, size: 0.85}, // Upper left
            {top: 15, left: -10 + (Math.random() * 20), z: 2, size: 0.75}, // Upper right (shifted left)
            {top: 40, left: -10 + (Math.random() * 20), z: 2, size: 0.8},  // Lower left
            {top: 45, left: -10 + (Math.random() * 20), z: 1, size: 0.7}   // Lower right (shifted left)
        ],
        // Full coverage - for heavy precipitation
        full: [
            {top: 25, left: -10 + (Math.random() * 20), z: 4, size: 1.1},  // Main large central cloud (shifted left)
            {top: 15, left: -10 + (Math.random() * 20), z: 3, size: 0.9},  // Upper left
            {top: 15, left: -10 + (Math.random() * 20), z: 3, size: 0.85}, // Upper right (shifted left)
            {top: 35, left: -10 + (Math.random() * 20), z: 2, size: 0.8},  // Mid left
            {top: 40, left: -10 + (Math.random() * 20), z: 2, size: 0.75}, // Mid right (shifted left)
            {top: 50, left: -10 + (Math.random() * 20), z: 1, size: 0.85}  // Lower center (shifted left)
        ]
    };
    
    // Add extra positions for high coverage scenarios
    // These have also been shifted leftward
    if (config.coverage >= 0.9) {
        positionStrategies.full.push(
            {top: 30, left: 50, z: 1, size: 0.7},  // Extra right cloud (shifted left)
            {top: 25, left: 0, z: 1, size: 0.75}   // Extra left cloud
        );
    }
    
    // Select positioning strategy based on coverage
    let positions;
    if (config.coverage <= 0.4) {
        positions = positionStrategies.sparse;
    } else if (config.coverage <= 0.8) {
        positions = positionStrategies.moderate;
    } else {
        positions = positionStrategies.full;
    }
    
    // Randomize the cloud positions slightly to break any remaining patterns
    positions = positions.map(pos => {
        // Add vertical and horizontal randomness
        const verticalVariance = 8; 
        const horizontalVariance = 5; // Slightly reduced to maintain leftward positioning
        
        return {
            top: pos.top + (Math.random() * verticalVariance * 2 - verticalVariance),
            left: pos.left + (-0.5 + Math.random() * horizontalVariance * 2 - horizontalVariance),
            z: pos.z,
            size: pos.size * (0.9 + Math.random() * 0.2) // Add 10% random size variation
        };
    });
    
    // Limit clouds to the specified number, but at least 1
    const numClouds = Math.max(1, Math.min(config.numClouds, positions.length));
    
    // Add a small chance to shuffle the cloud order
    if (Math.random() > 0.5) {
        // Simple Fisher-Yates shuffle
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }
    }
    
    // Generate clouds based on position strategies
    for (let i = 0; i < numClouds; i++) {
        const position = positions[i];
        
        // Calculate cloud size based on container and relative size factor
        const cloudWidth = config.containerSize * 0.7 * position.size;
        const cloudHeight = cloudWidth * 0.5;
        
        // Create the cloud
        const cloud = generateRandomCloud({
            baseWidth: cloudWidth,
            baseHeight: cloudHeight,
            color: cloudColor,
            top: position.top,
            left: position.left,
            zIndex: position.z,
            animate: true,
            minPuffs: 5,
            maxPuffs: 8,
            variance: 0.2,
            boxShadow: boxShadow
        });
        
        fragment.appendChild(cloud);
    }
    
    return fragment;
}

//----------------------------------------------------------------------
// SUN AND MOON ICON FUNCTIONS
//----------------------------------------------------------------------

/**
 * Create a clear day icon with sun
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isForecast - Whether this is a smaller forecast icon
 */
function createClearDayIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Create SVG for better control
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "0 0 100 100");

    // Create a group for the sun and rays (for animation)
    const sunGroup = document.createElementNS(svgNS, "g");
    sunGroup.setAttribute("class", "sun-group");

    // Sun circle
    const sunCircle = document.createElementNS(svgNS, "circle");
    sunCircle.setAttribute("cx", "50");
    sunCircle.setAttribute("cy", "50");
    sunCircle.setAttribute("r", "20");
    sunCircle.setAttribute("fill", "#FFD700");
    sunCircle.setAttribute("class", "sun-circle");

    // Add glow with filter
    const defs = document.createElementNS(svgNS, "defs");
    const filter = document.createElementNS(svgNS, "filter");
    filter.setAttribute("id", "sun-glow");
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");

    const feGaussianBlur = document.createElementNS(svgNS, "feGaussianBlur");
    feGaussianBlur.setAttribute("stdDeviation", "3");
    feGaussianBlur.setAttribute("result", "blur");

    const feComposite = document.createElementNS(svgNS, "feComposite");
    feComposite.setAttribute("in", "SourceGraphic");
    feComposite.setAttribute("in2", "blur");
    feComposite.setAttribute("operator", "over");

    filter.appendChild(feGaussianBlur);
    filter.appendChild(feComposite);
    defs.appendChild(filter);

    sunCircle.setAttribute("filter", "url(#sun-glow)");

    // Add sun rays
    const numRays = 12;
    for (let i = 0; i < numRays; i++) {
        const angle = (i * 360 / numRays);
        const ray = document.createElementNS(svgNS, "rect");

        // Determine if this is a major or minor ray
        const isMajor = i % 3 === 0;
        const rayLength = isMajor ? 15 : 10;
        const rayWidth = isMajor ? 4 : 3;

        ray.setAttribute("x", "50");
        ray.setAttribute("y", (50 - rayWidth / 2).toString());
        ray.setAttribute("width", rayLength.toString());
        ray.setAttribute("height", rayWidth.toString());
        ray.setAttribute("fill", "#FFD700");
        ray.setAttribute("transform", `rotate(${angle}, 50, 50) translate(20, 0)`);

        sunGroup.appendChild(ray);
    }

    // Add elements to SVG
    svg.appendChild(defs);
    sunGroup.appendChild(sunCircle);
    svg.appendChild(sunGroup);
    container.appendChild(svg);

    // Add animation with CSS
    const style = document.createElement('style');
    style.innerHTML = `
        .sun-group {
            animation: spin-sun 30s linear infinite;
            transform-origin: center;
        }
        
        .sun-circle {
            animation: pulse-glow 4s ease-in-out infinite;
        }
        
        @keyframes spin-sun {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse-glow {
            0%, 100% { opacity: 0.9; }
            50% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    element.appendChild(container);
}

/**
 * Create a clear night icon with moon and stars
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isForecast - Whether this is a smaller forecast icon
 */
function createClearNightIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Stars layer - added first so they appear behind the moon
    const starsLayer = document.createElement('div');
    starsLayer.style.position = 'absolute';
    starsLayer.style.width = '100%';
    starsLayer.style.height = '100%';
    starsLayer.style.top = '0';
    starsLayer.style.left = '0';
    starsLayer.style.zIndex = '1'; // Lower z-index for stars

    // Improved stars
    const starColors = ['#FFFFFF', '#F5F5F5', '#FFFDE7', '#FFF9C4'];
    const starCount = isForecast ? 5 : 15;

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.style.position = 'absolute';

        // Create more varied star sizes
        const starSize = (Math.random() * 0.04 + 0.01) * size;
        star.style.width = `${starSize}px`;
        star.style.height = `${starSize}px`;

        // Use different star colors
        const colorIndex = Math.floor(Math.random() * starColors.length);
        star.style.backgroundColor = starColors[colorIndex];

        // Add box-shadow for glow effect
        star.style.boxShadow = `0 0 ${starSize * 0.5}px ${starColors[colorIndex]}`;

        star.style.borderRadius = '50%';

        // Ensure stars don't overlap with where the moon will be
        let validPosition = false;
        let topPos, leftPos;

        while (!validPosition) {
            topPos = Math.random() * 100;
            leftPos = Math.random() * 100;

            // Check if star is not in the moon's area (center of container)
            const distFromCenter = Math.sqrt(
                Math.pow((topPos - 50), 2) +
                Math.pow((leftPos - 50), 2)
            );

            if (distFromCenter > 30) { // Keep stars away from moon
                validPosition = true;
            }
        }

        star.style.top = `${topPos}%`;
        star.style.left = `${leftPos}%`;

        // Better animation timing
        star.style.animation = `twinkle-star ${2 + Math.random() * 4}s infinite ease-in-out`;
        star.style.animationDelay = `${Math.random() * 5}s`;

        starsLayer.appendChild(star);
    }

    // Add stars layer to container
    container.appendChild(starsLayer);

    // Moon layer (with higher z-index)
    const moonLayer = document.createElement('div');
    moonLayer.style.position = 'absolute';
    moonLayer.style.width = '100%';
    moonLayer.style.height = '100%';
    moonLayer.style.top = '0';
    moonLayer.style.left = '0';
    moonLayer.style.zIndex = '2'; // Higher z-index for moon

    // Create SVG for more control over the moon shape
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "0 0 100 100");

    // Create a unique filter ID for this instance
    const filterId = `moon-glow-${Math.random().toString(36).substr(2, 9)}`;

    // Create defs section for filters
    const defs = document.createElementNS(svgNS, "defs");

    // Create radial gradient for the moon
    const gradientId = `moon-gradient-${Math.random().toString(36).substr(2, 9)}`;
    const gradient = document.createElementNS(svgNS, "radialGradient");
    gradient.setAttribute("id", gradientId);
    gradient.setAttribute("cx", "50%");
    gradient.setAttribute("cy", "50%");
    gradient.setAttribute("r", "50%");

    const stop1 = document.createElementNS(svgNS, "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", "#FFFDE7");

    const stop2 = document.createElementNS(svgNS, "stop");
    stop2.setAttribute("offset", "85%");
    stop2.setAttribute("stop-color", "#FFF9C4");

    const stop3 = document.createElementNS(svgNS, "stop");
    stop3.setAttribute("offset", "100%");
    stop3.setAttribute("stop-color", "#FFF176");

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    gradient.appendChild(stop3);
    defs.appendChild(gradient);

    // Create a clip path for the moon
    const clipPathId = `moon-clip-${Math.random().toString(36).substr(2, 9)}`;
    const clipPath = document.createElementNS(svgNS, "clipPath");
    clipPath.setAttribute("id", clipPathId);

    const clipCircle = document.createElementNS(svgNS, "circle");
    clipCircle.setAttribute("cx", "0");
    clipCircle.setAttribute("cy", "0");
    clipCircle.setAttribute("r", "23");

    clipPath.appendChild(clipCircle);
    defs.appendChild(clipPath);

    // Create glow filter for the moon
    const filter = document.createElementNS(svgNS, "filter");
    filter.setAttribute("id", filterId);
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");

    const feGaussianBlur = document.createElementNS(svgNS, "feGaussianBlur");
    feGaussianBlur.setAttribute("stdDeviation", "2");
    feGaussianBlur.setAttribute("result", "blur");

    const feComposite = document.createElementNS(svgNS, "feComposite");
    feComposite.setAttribute("in", "SourceGraphic");
    feComposite.setAttribute("in2", "blur");
    feComposite.setAttribute("operator", "over");

    filter.appendChild(feGaussianBlur);
    filter.appendChild(feComposite);
    defs.appendChild(filter);

    // Create moon using SVG paths
    const moonGroup = document.createElementNS(svgNS, "g");
    moonGroup.setAttribute("transform", "translate(50, 50)");

    // Full circle for the moon
    const moonCircle = document.createElementNS(svgNS, "circle");
    moonCircle.setAttribute("cx", "0");
    moonCircle.setAttribute("cy", "0");
    moonCircle.setAttribute("r", "23");
    moonCircle.setAttribute("fill", `url(#${gradientId})`);
    moonCircle.setAttribute("filter", `url(#${filterId})`);

    // Create a group with clip path for the moon and crescent
    const clipGroup = document.createElementNS(svgNS, "g");
    clipGroup.setAttribute("clip-path", `url(#${clipPathId})`);

    // Full moon circle
    clipGroup.appendChild(moonCircle);

    // Overlay circle to create crescent (now will be clipped to moon's boundaries)
    const crescentOverlay = document.createElementNS(svgNS, "circle");
    crescentOverlay.setAttribute("cx", "15");
    crescentOverlay.setAttribute("cy", "0");
    crescentOverlay.setAttribute("r", "21");
    crescentOverlay.setAttribute("fill", "#1C2331");

    clipGroup.appendChild(crescentOverlay);

    // Add craters after overlay circle but still inside clip path
    const crater1 = document.createElementNS(svgNS, "circle");
    crater1.setAttribute("cx", "-15");
    crater1.setAttribute("cy", "5");
    crater1.setAttribute("r", "2.5");
    crater1.setAttribute("fill", "rgba(255, 250, 230, 0.3)");

    const crater2 = document.createElementNS(svgNS, "circle");
    crater2.setAttribute("cx", "-13");
    crater2.setAttribute("cy", "-7");
    crater2.setAttribute("r", "3");
    crater2.setAttribute("fill", "rgba(255, 250, 230, 0.2)");

    // Add all elements to the proper groups
    moonGroup.appendChild(clipGroup);
    clipGroup.appendChild(crater1);
    clipGroup.appendChild(crater2);

    svg.appendChild(defs);
    svg.appendChild(moonGroup);

    // Add subtle animation to moon
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes moon-glow {
            0%, 100% { filter: drop-shadow(0 0 3px rgba(255, 249, 196, 0.4)); }
            50% { filter: drop-shadow(0 0 5px rgba(255, 249, 196, 0.6)); }
        }
        
        @keyframes twinkle-star {
            0%, 100% { opacity: 0.2; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.5); }
        }
    `;
    document.head.appendChild(style);

    moonLayer.appendChild(svg);
    container.appendChild(moonLayer);

    element.appendChild(container);
}

//----------------------------------------------------------------------
// CLOUD-BASED ICON FUNCTIONS
//----------------------------------------------------------------------

/**
 * Create a cloudy icon with randomly generated clouds
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isForecast - Whether this is a smaller forecast icon
 */
function createCloudyIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Use cloud generator to create random clouds with high coverage
    const clouds = generateCloudGroup({
        numClouds: isForecast ? 3 : 5,
        containerSize: size,
        isNight: false,
        coverage: 0.9, // High coverage for cloudy
        isDark: false
    });

    container.appendChild(clouds);
    element.appendChild(container);
}

/**
 * Create a cloudy night icon with randomly generated clouds
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isForecast - Whether this is a smaller forecast icon
 */
function createCloudyNightIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Add a few stars in the background
    for (let i = 0; i < 8; i++) {
        const star = document.createElement('div');
        star.className = 'animation-element star';
        star.style.top = `${Math.random() * 30}%`; // Only in top portion
        star.style.left = `${Math.random() * 100}%`;
        star.style.opacity = Math.random() * 0.3 + 0.1; // Very faint stars
        star.style.animationDuration = `${Math.random() * 3 + 2}s`;
        container.appendChild(star);
    }

    // Use cloud generator to create random clouds with night coloring
    const clouds = generateCloudGroup({
        numClouds: isForecast ? 3 : 5,
        containerSize: size,
        isNight: true,
        coverage: 0.9, // High coverage for cloudy
        isDark: false
    });

    container.appendChild(clouds);
    element.appendChild(container);
}

/**
 * Create a partly cloudy day icon with sun and randomly generated clouds
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isForecast - Whether this is a smaller forecast icon
 */
function createPartlyCloudyDayIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Create the SVG sun
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "70%");
    svg.setAttribute("height", "70%");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.style.position = "absolute";
    svg.style.top = "10%";
    svg.style.left = "0%";
    svg.style.zIndex = "1";

    // Create a unique ID for the filter to avoid conflicts
    const filterId = `sun-glow-${Math.random().toString(36).substr(2, 9)}`;

    // Create a group for the sun and rays (for animation)
    const sunGroup = document.createElementNS(svgNS, "g");
    sunGroup.setAttribute("class", "sun-group");

    // Sun circle
    const sunCircle = document.createElementNS(svgNS, "circle");
    sunCircle.setAttribute("cx", "50");
    sunCircle.setAttribute("cy", "50");
    sunCircle.setAttribute("r", "20");
    sunCircle.setAttribute("fill", "#FFD700");
    sunCircle.setAttribute("class", "sun-circle");

    // Add glow with filter
    const defs = document.createElementNS(svgNS, "defs");
    const filter = document.createElementNS(svgNS, "filter");
    filter.setAttribute("id", filterId);
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");

    const feGaussianBlur = document.createElementNS(svgNS, "feGaussianBlur");
    feGaussianBlur.setAttribute("stdDeviation", "3");
    feGaussianBlur.setAttribute("result", "blur");

    const feComposite = document.createElementNS(svgNS, "feComposite");
    feComposite.setAttribute("in", "SourceGraphic");
    feComposite.setAttribute("in2", "blur");
    feComposite.setAttribute("operator", "over");

    filter.appendChild(feGaussianBlur);
    filter.appendChild(feComposite);
    defs.appendChild(filter);

    sunCircle.setAttribute("filter", `url(#${filterId})`);

    // Add sun rays
    const numRays = 12;
    for (let i = 0; i < numRays; i++) {
        const angle = (i * 360 / numRays);
        const ray = document.createElementNS(svgNS, "rect");

        // Determine if this is a major or minor ray
        const isMajor = i % 3 === 0;
        const rayLength = isMajor ? 15 : 10;
        const rayWidth = isMajor ? 4 : 3;

        ray.setAttribute("x", "50");
        ray.setAttribute("y", (50 - rayWidth / 2).toString());
        ray.setAttribute("width", rayLength.toString());
        ray.setAttribute("height", rayWidth.toString());
        ray.setAttribute("fill", "#FFD700");
        ray.setAttribute("transform", `rotate(${angle}, 50, 50) translate(20, 0)`);

        sunGroup.appendChild(ray);
    }

    // Add elements to SVG
    svg.appendChild(defs);
    sunGroup.appendChild(sunCircle);
    svg.appendChild(sunGroup);

    // Create the cloud container
    const cloudContainer = document.createElement('div');
    cloudContainer.style.width = '100%';
    cloudContainer.style.height = '100%';
    cloudContainer.style.position = 'absolute';
    cloudContainer.style.top = '0';
    cloudContainer.style.left = '0';
    cloudContainer.style.zIndex = '2';

    // Use cloud generator to create random clouds (fewer for partly cloudy)
    const clouds = generateCloudGroup({
        numClouds: isForecast ? 2 : 3,
        containerSize: size,
        isNight: false,
        coverage: 0.4, // Sparse coverage for partly cloudy
        isDark: false
    });

    cloudContainer.appendChild(clouds);

    // Add elements to container
    container.appendChild(svg);
    container.appendChild(cloudContainer);

    // Add animation with CSS
    const style = document.createElement('style');
    style.innerHTML = `
        .sun-group {
            animation: spin-sun 30s linear infinite;
            transform-origin: center;
        }
        
        .sun-circle {
            animation: pulse-glow 4s ease-in-out infinite;
        }
        
        @keyframes spin-sun {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse-glow {
            0%, 100% { opacity: 0.9; }
            50% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    element.appendChild(container);
}

/**
 * Create a partly cloudy night icon with moon, stars, and randomly generated clouds
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isForecast - Whether this is a smaller forecast icon
 */
function createPartlyCloudyNightIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Stars layer
    const starsLayer = document.createElement('div');
    starsLayer.style.position = 'absolute';
    starsLayer.style.width = '100%';
    starsLayer.style.height = '100%';
    starsLayer.style.top = '0';
    starsLayer.style.left = '0';
    starsLayer.style.zIndex = '1';

    // Add stars - more than in cloudy night
    const starColors = ['#FFFFFF', '#F5F5F5', '#FFFDE7', '#FFF9C4'];
    const starCount = isForecast ? 6 : 15;

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.style.position = 'absolute';

        // Create varied star sizes
        const starSize = (Math.random() * 0.04 + 0.01) * size;
        star.style.width = `${starSize}px`;
        star.style.height = `${starSize}px`;

        // Use different star colors
        const colorIndex = Math.floor(Math.random() * starColors.length);
        star.style.backgroundColor = starColors[colorIndex];

        // Add box-shadow for glow effect
        star.style.boxShadow = `0 0 ${starSize * 0.5}px ${starColors[colorIndex]}`;

        star.style.borderRadius = '50%';
        
        // Position stars away from the moon
        let validPosition = false;
        let topPos, leftPos;

        while (!validPosition) {
            topPos = Math.random() * 100;
            leftPos = Math.random() * 100;
            
            // Avoid placing stars in the moon area (top left)
            if (!(topPos < 50 && leftPos < 50 && Math.sqrt(Math.pow(topPos - 25, 2) + Math.pow(leftPos - 25, 2)) < 20)) {
                validPosition = true;
            }
        }

        star.style.top = `${topPos}%`;
        star.style.left = `${leftPos}%`;

        // Animation timing
        star.style.animation = `twinkle-star ${2 + Math.random() * 4}s infinite ease-in-out`;
        star.style.animationDelay = `${Math.random() * 5}s`;

        starsLayer.appendChild(star);
    }

    container.appendChild(starsLayer);

    // Moon layer
    const moonLayer = document.createElement('div');
    moonLayer.style.position = 'absolute';
    moonLayer.style.width = '40%';
    moonLayer.style.height = '40%';
    moonLayer.style.top = '10%';
    moonLayer.style.left = '10%';
    moonLayer.style.zIndex = '2';

    // Create SVG for the moon
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "0 0 100 100");

    // Create a unique filter ID for this instance
    const filterId = `moon-glow-${Math.random().toString(36).substr(2, 9)}`;

    // Create defs section for filters
    const defs = document.createElementNS(svgNS, "defs");

    // Create radial gradient for the moon
    const gradientId = `moon-gradient-${Math.random().toString(36).substr(2, 9)}`;
    const gradient = document.createElementNS(svgNS, "radialGradient");
    gradient.setAttribute("id", gradientId);
    gradient.setAttribute("cx", "50%");
    gradient.setAttribute("cy", "50%");
    gradient.setAttribute("r", "50%");

    const stop1 = document.createElementNS(svgNS, "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", "#FFFDE7");

    const stop2 = document.createElementNS(svgNS, "stop");
    stop2.setAttribute("offset", "85%");
    stop2.setAttribute("stop-color", "#FFF9C4");

    const stop3 = document.createElementNS(svgNS, "stop");
    stop3.setAttribute("offset", "100%");
    stop3.setAttribute("stop-color", "#FFF176");

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    gradient.appendChild(stop3);
    defs.appendChild(gradient);

    // Create glow filter for the moon
    const filter = document.createElementNS(svgNS, "filter");
    filter.setAttribute("id", filterId);
    filter.setAttribute("x", "-50%");
    filter.setAttribute("y", "-50%");
    filter.setAttribute("width", "200%");
    filter.setAttribute("height", "200%");

    const feGaussianBlur = document.createElementNS(svgNS, "feGaussianBlur");
    feGaussianBlur.setAttribute("stdDeviation", "2");
    feGaussianBlur.setAttribute("result", "blur");

    filter.appendChild(feGaussianBlur);
    defs.appendChild(filter);

    // Create moon circle
    const moonCircle = document.createElementNS(svgNS, "circle");
    moonCircle.setAttribute("cx", "50");
    moonCircle.setAttribute("cy", "50");
    moonCircle.setAttribute("r", "30");
    moonCircle.setAttribute("fill", `url(#${gradientId})`);
    moonCircle.setAttribute("filter", `url(#${filterId})`);

    // Create crescent shape with a slightly offset circle mask
    const clipPathId = `moon-clip-${Math.random().toString(36).substr(2, 9)}`;
    const clipPath = document.createElementNS(svgNS, "clipPath");
    clipPath.setAttribute("id", clipPathId);

    const clipCircle = document.createElementNS(svgNS, "circle");
    clipCircle.setAttribute("cx", "50");
    clipCircle.setAttribute("cy", "50");
    clipCircle.setAttribute("r", "30");
    clipPath.appendChild(clipCircle);
    defs.appendChild(clipPath);

    const moonGroup = document.createElementNS(svgNS, "g");
    moonGroup.setAttribute("clip-path", `url(#${clipPathId})`);

    // Add darkened circle to create crescent
    const darkCircle = document.createElementNS(svgNS, "circle");
    darkCircle.setAttribute("cx", "70");
    darkCircle.setAttribute("cy", "50");
    darkCircle.setAttribute("r", "25");
    darkCircle.setAttribute("fill", "#1a2338");
    
    moonGroup.appendChild(moonCircle);
    moonGroup.appendChild(darkCircle);

    svg.appendChild(defs);
    svg.appendChild(moonGroup);
    moonLayer.appendChild(svg);
    container.appendChild(moonLayer);

    // Cloud layer - uses cloud generator with night coloring and sparse coverage
    const cloudLayer = document.createElement('div');
    cloudLayer.style.position = 'absolute';
    cloudLayer.style.width = '100%';
    cloudLayer.style.height = '100%';
    cloudLayer.style.top = '0';
    cloudLayer.style.left = '0';
    cloudLayer.style.zIndex = '3';

    // Use cloud generator
    const clouds = generateCloudGroup({
        numClouds: isForecast ? 2 : 3,
        containerSize: size,
        isNight: true,
        coverage: 0.4, // Sparse coverage for partly cloudy
        isDark: false
    });

    cloudLayer.appendChild(clouds);
    container.appendChild(cloudLayer);

    // Add animations
    const animStyle = document.createElement('style');
    animStyle.innerHTML = `
        @keyframes twinkle-star {
            0%, 100% { opacity: 0.2; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.5); }
        }
    `;
    document.head.appendChild(animStyle);

    element.appendChild(container);
}

//----------------------------------------------------------------------
// PRECIPITATION ICON FUNCTIONS
//----------------------------------------------------------------------

/**
 * Create a rain icon with clouds and animated raindrops
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isForecast - Whether this is a smaller forecast icon
 */
function createRainIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Use cloud generator with darker gray clouds for rain
    const clouds = generateCloudGroup({
        numClouds: isForecast ? 2 : 3,
        containerSize: size,
        isNight: false,
        coverage: 0.8, // High coverage for rain
        isDark: false
    });

    // Add raindrops
    const numDrops = isForecast ? 6 : 14;
    for (let i = 0; i < numDrops; i++) {
        const drop = document.createElement('div');
        drop.style.width = `${size * 0.03}px`;
        drop.style.height = `${size * 0.1}px`;
        drop.style.backgroundColor = '#61A8FF';
        drop.style.borderRadius = `${size * 0.03}px`;
        drop.style.position = 'absolute';
        drop.style.top = `${Math.random() * 30 + 60}%`;
        drop.style.left = `${Math.random() * 80 + 10}%`;
        drop.style.animation = `rainDrop ${Math.random() * 0.5 + 1}s infinite linear`;

        // Set animation delay
        drop.style.animationDelay = `${Math.random()}s`;

        container.appendChild(drop);
    }

    container.appendChild(clouds);
    element.appendChild(container);

    // Add animation for raindrops
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes rainDrop {
            0% { transform: translateY(-10px); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(${size * 0.5}px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Create a snow icon with clouds and animated snowflakes
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isForecast - Whether this is a smaller forecast icon
 */
function createSnowIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Use cloud generator
    const clouds = generateCloudGroup({
        numClouds: isForecast ? 2 : 3,
        containerSize: size,
        isNight: false,
        coverage: 0.8, // High coverage for snow
        isDark: false
    });

    // Add snowflakes
    const numFlakes = isForecast ? 5 : 10;
    for (let i = 0; i < numFlakes; i++) {
        const snowflake = document.createElement('div');
        snowflake.textContent = '❄';
        snowflake.style.position = 'absolute';
        snowflake.style.color = 'white';
        snowflake.style.fontSize = `${size * 0.1}px`;
        snowflake.style.top = `${Math.random() * 30 + 60}%`;
        snowflake.style.left = `${Math.random() * 80 + 10}%`;
        snowflake.style.animation = `snowfall ${Math.random() * 2 + 3}s infinite linear`;
        snowflake.style.animationDelay = `${Math.random() * 2}s`;
        container.appendChild(snowflake);
    }

    container.appendChild(clouds);
    element.appendChild(container);

    // Add animation for snowflakes
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes snowfall {
            0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(${size * 0.5}px) rotate(360deg); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Create a sleet icon with clouds and mixed precipitation (rain + snow)
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isForecast - Whether this is a smaller forecast icon
 */
function createSleetIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Use cloud generator
    const clouds = generateCloudGroup({
        numClouds: isForecast ? 2 : 3,
        containerSize: size,
        isNight: false,
        coverage: 0.8, // High coverage for sleet
        isDark: false
    });

    // Mix of rain and snow elements
    const numElements = isForecast ? 6 : 12;
    for (let i = 0; i < numElements; i++) {
        if (i % 2 === 0) {
            // Raindrop for sleet
            const drop = document.createElement('div');
            drop.style.width = `${size * 0.03}px`;
            drop.style.height = `${size * 0.1}px`;
            drop.style.backgroundColor = '#61A8FF';
            drop.style.borderRadius = `${size * 0.03}px`;
            drop.style.position = 'absolute';
            drop.style.top = `${Math.random() * 30 + 60}%`;
            drop.style.left = `${Math.random() * 80 + 10}%`;
            drop.style.animation = `rainDrop ${Math.random() * 0.5 + 1}s infinite linear`;
            drop.style.animationDelay = `${Math.random() * 2}s`;
            container.appendChild(drop);
        } else {
            // Small ice pellet for sleet
            const pellet = document.createElement('div');
            pellet.style.width = `${size * 0.05}px`;
            pellet.style.height = `${size * 0.05}px`;
            pellet.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
            pellet.style.borderRadius = '50%';
            pellet.style.position = 'absolute';
            pellet.style.top = `${Math.random() * 30 + 60}%`;
            pellet.style.left = `${Math.random() * 80 + 10}%`;
            pellet.style.animation = `sleetPellet ${Math.random() * 1 + 2}s infinite linear`;
            pellet.style.animationDelay = `${Math.random() * 2}s`;
            container.appendChild(pellet);
        }
    }

    container.appendChild(clouds);
    element.appendChild(container);

    // Add animations
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes sleetPellet {
            0% { transform: translateY(-10px); opacity: 0; }
            10% { opacity: 0.8; }
            90% { opacity: 0.8; }
            100% { transform: translateY(${size * 0.5}px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Create a thunderstorm icon with dark clouds, lightning and rain
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isForecast - Whether this is a smaller forecast icon
 */
function createThunderstormIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Use cloud generator with dark storm clouds
    const clouds = generateCloudGroup({
        numClouds: isForecast ? 2 : 4,
        containerSize: size,
        isNight: false,
        coverage: 0.8, // High coverage for thunderstorm
        isDark: true // Dark storm clouds
    });

    // Improved Lightning bolt using SVG
    const lightning = document.createElement('div');
    lightning.style.position = 'absolute';
    lightning.style.top = '50%';
    lightning.style.left = '40%';
    lightning.style.zIndex = '3';
    lightning.style.animation = 'lightning 3s infinite';

    // Create SVG lightning bolt
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", `${size * 0.4}px`);
    svg.setAttribute("height", `${size * 0.5}px`);
    svg.setAttribute("viewBox", "0 0 32 50");

    // Create zigzag path for lightning bolt
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M18,0 L0,22 L12,25 L8,50 L32,20 L18,18 L24,0 Z");
    path.setAttribute("fill", "#FFD700");
    path.setAttribute("stroke", "#FFA500");
    path.setAttribute("stroke-width", "1");

    svg.appendChild(path);
    lightning.appendChild(svg);

    // Add raindrops (fewer than in rain icon)
    const numDrops = isForecast ? 4 : 8;
    for (let i = 0; i < numDrops; i++) {
        const drop = document.createElement('div');
        drop.style.width = `${size * 0.03}px`;
        drop.style.height = `${size * 0.1}px`;
        drop.style.backgroundColor = '#61A8FF';
        drop.style.borderRadius = `${size * 0.03}px`;
        drop.style.position = 'absolute';
        drop.style.top = `${Math.random() * 30 + 60}%`;

        // Avoid raindrops overlapping with lightning
        if (i % 2 === 0) {
            drop.style.left = `${Math.random() * 30 + 10}%`;
        } else {
            drop.style.left = `${Math.random() * 30 + 60}%`;
        }

        drop.style.animation = `rainDrop ${Math.random() * 0.5 + 1}s infinite linear`;
        drop.style.animationDelay = `${Math.random()}s`;

        container.appendChild(drop);
    }

    container.appendChild(clouds);
    container.appendChild(lightning);
    element.appendChild(container);

    // Add animations
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes lightning {
            0%, 100% { opacity: 0; }
            48%, 52% { opacity: 0; }
            50% { opacity: 1; }
            85%, 95% { opacity: 0; }
            90% { opacity: 0.6; }
        }
        
        @keyframes rainDrop {
            0% { transform: translateY(-10px); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(${size * 0.4}px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

//----------------------------------------------------------------------
// WIND AND FOG ICON FUNCTIONS
//----------------------------------------------------------------------

/**
 * Create a wind icon with flowing curves and particles
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isForecast - Whether this is a smaller forecast icon
 */
function createWindIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';
    
    // Create SVG element for better curve control
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "0 0 100 100");
    
    // Create defs for gradients
    const defs = document.createElementNS(svgNS, "defs");
    
    // Add gradient for wind lines
    const windGradient = document.createElementNS(svgNS, "linearGradient");
    windGradient.setAttribute("id", "windGradient");
    windGradient.setAttribute("x1", "0%");
    windGradient.setAttribute("y1", "0%");
    windGradient.setAttribute("x2", "100%");
    windGradient.setAttribute("y2", "0%");
    
    const stop1 = document.createElementNS(svgNS, "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", "#A5B0C3");
    stop1.setAttribute("stop-opacity", "0.3");
    
    const stop2 = document.createElementNS(svgNS, "stop");
    stop2.setAttribute("offset", "50%");
    stop2.setAttribute("stop-color", "#C8D4E6");
    stop2.setAttribute("stop-opacity", "0.9");
    
    const stop3 = document.createElementNS(svgNS, "stop");
    stop3.setAttribute("offset", "100%");
    stop3.setAttribute("stop-color", "#A5B0C3");
    stop3.setAttribute("stop-opacity", "0.3");
    
    windGradient.appendChild(stop1);
    windGradient.appendChild(stop2);
    windGradient.appendChild(stop3);
    defs.appendChild(windGradient);
    
    // Add filter for soft glow
    const filter = document.createElementNS(svgNS, "filter");
    filter.setAttribute("id", "windGlow");
    filter.setAttribute("x", "-20%");
    filter.setAttribute("y", "-20%");
    filter.setAttribute("width", "140%");
    filter.setAttribute("height", "140%");
    
    const feGaussianBlur = document.createElementNS(svgNS, "feGaussianBlur");
    feGaussianBlur.setAttribute("stdDeviation", "1");
    feGaussianBlur.setAttribute("result", "blur");
    filter.appendChild(feGaussianBlur);
    
    defs.appendChild(filter);
    svg.appendChild(defs);
    
    // Create wind path geometries - more flowing and natural
    const windPaths = [
        // First wind stream (top)
        {
            d: "M10,25 C30,22 50,28 90,20",
            width: 3.5,
            animDelay: 0,
            animDuration: 4
        },
        // Second wind stream (upper middle)
        {
            d: "M5,40 C30,35 55,45 95,35",
            width: 4,
            animDelay: 0.5,
            animDuration: 3.5
        },
        // Third wind stream (middle)
        {
            d: "M8,55 C35,50 60,60 92,50",
            width: 4.5,
            animDelay: 1,
            animDuration: 4.5
        },
        // Fourth wind stream (lower middle)
        {
            d: "M6,70 C40,65 70,75 92,65",
            width: 4,
            animDelay: 1.5,
            animDuration: 4
        },
        // Fifth wind stream (bottom)
        {
            d: "M12,85 C40,80 70,90 88,80",
            width: 3.5,
            animDelay: 0.8,
            animDuration: 3.8
        }
    ];
    
    // Create and add wind streams to SVG
    windPaths.forEach((pathData, index) => {
        // Create the main path for each wind stream
        const windPath = document.createElementNS(svgNS, "path");
        windPath.setAttribute("d", pathData.d);
        windPath.setAttribute("fill", "none");
        windPath.setAttribute("stroke", "url(#windGradient)");
        windPath.setAttribute("stroke-width", pathData.width);
        windPath.setAttribute("stroke-linecap", "round");
        windPath.setAttribute("filter", "url(#windGlow)");
        windPath.setAttribute("class", `wind-path-${index}`);
        
        // Add animation for the wind stream
        const animate = document.createElementNS(svgNS, "animate");
        animate.setAttribute("attributeName", "stroke-dashoffset");
        animate.setAttribute("from", "200");
        animate.setAttribute("to", "0");
        animate.setAttribute("dur", `${pathData.animDuration}s`);
        animate.setAttribute("begin", `${pathData.animDelay}s`);
        animate.setAttribute("repeatCount", "indefinite");
        
        windPath.appendChild(animate);
        
        // Set dash pattern for animation
        windPath.setAttribute("stroke-dasharray", "25, 15");
        
        svg.appendChild(windPath);
        
        // Add small particle groups being blown along the path
        if (!isForecast) { // Only add particles for the main icon, not forecast icons
            addParticlesAlongPath(svg, pathData.d, index, pathData.animDuration - 0.5);
        }
    });
    
    container.appendChild(svg);
    
    // Add keyframes for particle animation
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes moveAlongPath0 {
            0% { offset-distance: 0%; opacity: 0; }
            10% { opacity: 0.7; }
            90% { opacity: 0.7; }
            100% { offset-distance: 100%; opacity: 0; }
        }
        @keyframes moveAlongPath1 {
            0% { offset-distance: 0%; opacity: 0; }
            10% { opacity: 0.7; }
            90% { opacity: 0.7; }
            100% { offset-distance: 100%; opacity: 0; }
        }
        @keyframes moveAlongPath2 {
            0% { offset-distance: 0%; opacity: 0; }
            10% { opacity: 0.7; }
            90% { opacity: 0.7; }
            100% { offset-distance: 100%; opacity: 0; }
        }
        @keyframes moveAlongPath3 {
            0% { offset-distance: 0%; opacity: 0; }
            10% { opacity: 0.7; }
            90% { opacity: 0.7; }
            100% { offset-distance: 100%; opacity: 0; }
        }
        @keyframes moveAlongPath4 {
            0% { offset-distance: 0%; opacity: 0; }
            10% { opacity: 0.7; }
            90% { opacity: 0.7; }
            100% { offset-distance: 100%; opacity: 0; }
        }
        @keyframes spinParticle {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    element.appendChild(container);
}

/**
 * Add particle groups that follow a defined SVG path
 * @param {SVGElement} svg - SVG element to append particles to
 * @param {string} pathDef - SVG path definition
 * @param {number} pathIndex - Index of the path (for unique animations)
 * @param {number} duration - Animation duration in seconds
 */
function addParticlesAlongPath(svg, pathDef, pathIndex, duration) {
    const svgNS = "http://www.w3.org/2000/svg";
    
    // Create a hidden path for particles to follow
    const guidePath = document.createElementNS(svgNS, "path");
    guidePath.setAttribute("d", pathDef);
    guidePath.setAttribute("fill", "none");
    guidePath.setAttribute("stroke", "none");
    guidePath.setAttribute("id", `guide-path-${pathIndex}`);
    svg.appendChild(guidePath);
    
    // Add particle groups along the path
    const numParticles = 3; // Number of particle groups per path
    
    for (let i = 0; i < numParticles; i++) {
        const particleGroup = document.createElementNS(svgNS, "g");
        particleGroup.setAttribute("class", "particle-group");
        
        // Use motion path for movement
        particleGroup.style.offsetPath = `path('${pathDef}')`;
        particleGroup.style.animation = `moveAlongPath${pathIndex} ${duration}s infinite linear`;
        particleGroup.style.animationDelay = `${i * (duration / numParticles)}s`;
        
        // Create particles in the group (small circles and lines)
        const shapes = [
            { type: 'circle', cx: 0, cy: 0, r: 1.2 },
            { type: 'circle', cx: 2, cy: 1, r: 0.8 },
            { type: 'circle', cx: -1, cy: 1, r: 0.6 },
            { type: 'line', x1: -2, y1: 0, x2: 2, y2: 0 },
            { type: 'line', x1: 0, y1: -2, x2: 0, y2: 2 },
        ];
        
        shapes.forEach(shape => {
            let element;
            if (shape.type === 'circle') {
                element = document.createElementNS(svgNS, "circle");
                element.setAttribute("cx", shape.cx);
                element.setAttribute("cy", shape.cy);
                element.setAttribute("r", shape.r);
                element.setAttribute("fill", "#E8F1FF");
            } else {
                element = document.createElementNS(svgNS, "line");
                element.setAttribute("x1", shape.x1);
                element.setAttribute("y1", shape.y1);
                element.setAttribute("x2", shape.x2);
                element.setAttribute("y2", shape.y2);
                element.setAttribute("stroke", "#E8F1FF");
                element.setAttribute("stroke-width", "0.5");
            }
            
            // Add subtle rotation animation to particles
            element.style.animation = `spinParticle ${Math.random() * 2 + 3}s infinite linear`;
            particleGroup.appendChild(element);
        });
        
        svg.appendChild(particleGroup);
    }
}

/**
 * Create a fog icon with animated fog layers
 * @param {HTMLElement} element - DOM element to append the icon to
 * @param {boolean} isForecast - Whether this is a smaller forecast icon
 */
function createFogIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Create fog layers
    for (let i = 0; i < 5; i++) {
        const fogLayer = document.createElement('div');
        fogLayer.style.width = `${size * 0.8}px`;
        fogLayer.style.height = `${size * 0.1}px`;
        fogLayer.style.backgroundColor = 'rgba(204, 204, 204, 0.8)';
        fogLayer.style.borderRadius = `${size * 0.05}px`;
        fogLayer.style.position = 'absolute';
        fogLayer.style.top = `${30 + i * 15}%`;
        fogLayer.style.left = '10%';
        fogLayer.style.animation = `fogFloat 4s infinite alternate ${i * 0.3}s ease-in-out`;

        container.appendChild(fogLayer);
    }

    element.appendChild(container);

    // Add animation for fog layers
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes fogFloat {
            0% { transform: translateX(-5%); opacity: 0.7; }
            100% { transform: translateX(5%); opacity: 0.9; }
        }
    `;
    document.head.appendChild(style);
}