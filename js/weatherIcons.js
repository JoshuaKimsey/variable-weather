/**
 * Weather icon creation functions
 * Contains all functions needed to create animated weather icons
 */

// Export icon creation functions
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
 */
export function setWeatherIcon(iconCode, element) {
    // Clear previous icon
    element.innerHTML = '';

    //console.log(`Setting weather icon for code: ${iconCode}`);

    // Create and add the appropriate icon
    if (weatherIcons[iconCode]) {
        weatherIcons[iconCode](element);
    } else {
        // Fallback for unknown icon codes
        console.warn(`Unknown icon code: ${iconCode}. Using cloudy icon as fallback.`);
        createCloudyIcon(element);
    }
}

/**
 * Set forecast icon 
 */
export function setForecastIcon(iconCode, element) {
    if (weatherIcons[iconCode]) {
        weatherIcons[iconCode](element, true);
    } else {
        createCloudyIcon(element, true);
    }
}

// Weather Icon Creation Functions
function createClearDayIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Use SVG for better control
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

// Replace the existing createClearNightIcon function in weatherIcons.js with this improved version

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

    // We'll create the crescent overlay in the clipGroup section below

    // Small details on moon surface have been moved to the clip group section

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

function createRainIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Cloud
    const cloud = document.createElement('div');
    cloud.style.width = `${size * 0.8}px`;
    cloud.style.height = `${size * 0.4}px`;
    cloud.style.backgroundColor = '#CCCCCC';
    cloud.style.borderRadius = `${size * 0.4}px`;
    cloud.style.position = 'absolute';
    cloud.style.top = '20%';
    cloud.style.left = '10%';

    // Cloud details
    const cloudDetail1 = document.createElement('div');
    cloudDetail1.style.width = `${size * 0.4}px`;
    cloudDetail1.style.height = `${size * 0.4}px`;
    cloudDetail1.style.backgroundColor = '#CCCCCC';
    cloudDetail1.style.borderRadius = '50%';
    cloudDetail1.style.position = 'absolute';
    cloudDetail1.style.top = '-50%';
    cloudDetail1.style.left = '20%';

    const cloudDetail2 = document.createElement('div');
    cloudDetail2.style.width = `${size * 0.5}px`;
    cloudDetail2.style.height = `${size * 0.5}px`;
    cloudDetail2.style.backgroundColor = '#CCCCCC';
    cloudDetail2.style.borderRadius = '50%';
    cloudDetail2.style.position = 'absolute';
    cloudDetail2.style.top = '-60%';
    cloudDetail2.style.left = '50%';

    cloud.appendChild(cloudDetail1);
    cloud.appendChild(cloudDetail2);

    // Raindrops
    const numDrops = isForecast ? 5 : 10;
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

    container.appendChild(cloud);
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

function createSnowIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Cloud (same as rain icon)
    const cloud = document.createElement('div');
    cloud.style.width = `${size * 0.8}px`;
    cloud.style.height = `${size * 0.4}px`;
    cloud.style.backgroundColor = '#CCCCCC';
    cloud.style.borderRadius = `${size * 0.4}px`;
    cloud.style.position = 'absolute';
    cloud.style.top = '20%';
    cloud.style.left = '10%';

    // Cloud details
    const cloudDetail1 = document.createElement('div');
    cloudDetail1.style.width = `${size * 0.4}px`;
    cloudDetail1.style.height = `${size * 0.4}px`;
    cloudDetail1.style.backgroundColor = '#CCCCCC';
    cloudDetail1.style.borderRadius = '50%';
    cloudDetail1.style.position = 'absolute';
    cloudDetail1.style.top = '-50%';
    cloudDetail1.style.left = '20%';

    const cloudDetail2 = document.createElement('div');
    cloudDetail2.style.width = `${size * 0.5}px`;
    cloudDetail2.style.height = `${size * 0.5}px`;
    cloudDetail2.style.backgroundColor = '#CCCCCC';
    cloudDetail2.style.borderRadius = '50%';
    cloudDetail2.style.position = 'absolute';
    cloudDetail2.style.top = '-60%';
    cloudDetail2.style.left = '50%';

    cloud.appendChild(cloudDetail1);
    cloud.appendChild(cloudDetail2);

    // Snowflakes
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

    container.appendChild(cloud);
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

function createSleetIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Cloud (same as rain icon)
    const cloud = document.createElement('div');
    cloud.style.width = `${size * 0.8}px`;
    cloud.style.height = `${size * 0.4}px`;
    cloud.style.backgroundColor = '#CCCCCC';
    cloud.style.borderRadius = `${size * 0.4}px`;
    cloud.style.position = 'absolute';
    cloud.style.top = '20%';
    cloud.style.left = '10%';

    // Cloud details
    const cloudDetail1 = document.createElement('div');
    cloudDetail1.style.width = `${size * 0.4}px`;
    cloudDetail1.style.height = `${size * 0.4}px`;
    cloudDetail1.style.backgroundColor = '#CCCCCC';
    cloudDetail1.style.borderRadius = '50%';
    cloudDetail1.style.position = 'absolute';
    cloudDetail1.style.top = '-50%';
    cloudDetail1.style.left = '20%';

    const cloudDetail2 = document.createElement('div');
    cloudDetail2.style.width = `${size * 0.5}px`;
    cloudDetail2.style.height = `${size * 0.5}px`;
    cloudDetail2.style.backgroundColor = '#CCCCCC';
    cloudDetail2.style.borderRadius = '50%';
    cloudDetail2.style.position = 'absolute';
    cloudDetail2.style.top = '-60%';
    cloudDetail2.style.left = '50%';

    cloud.appendChild(cloudDetail1);
    cloud.appendChild(cloudDetail2);

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

    container.appendChild(cloud);
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

function createWindIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Create multiple wind lines
    for (let i = 0; i < 5; i++) {
        const windLine = document.createElement('div');
        windLine.style.height = `${size * 0.05}px`;
        windLine.style.borderRadius = `${size * 0.025}px`;
        windLine.style.backgroundColor = '#CCCCCC';
        windLine.style.position = 'absolute';
        windLine.style.top = `${20 + i * 15}%`;
        windLine.style.left = '10%';
        windLine.style.animation = `windBlow 3s infinite ${i * 0.2}s`;

        // Vary the length of each line
        if (i % 2 === 0) {
            windLine.style.width = `${size * 0.6}px`;
        } else {
            windLine.style.width = `${size * 0.4}px`;
        }

        container.appendChild(windLine);
    }

    element.appendChild(container);

    // Add animation for wind lines
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes windBlow {
            0% { transform: scaleX(0.3); opacity: 0.3; transform-origin: left; }
            50% { transform: scaleX(1); opacity: 1; transform-origin: left; }
            100% { transform: scaleX(0.3); opacity: 0.3; transform-origin: left; }
        }
    `;
    document.head.appendChild(style);
}

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

function createCloudyIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Create multiple clouds
    for (let i = 0; i < 3; i++) {
        const cloud = document.createElement('div');
        const cloudSize = size * (0.4 + i * 0.2);

        cloud.style.width = `${cloudSize}px`;
        cloud.style.height = `${cloudSize * 0.6}px`;
        cloud.style.backgroundColor = i === 0 ? '#AAAAAA' : '#CCCCCC';
        cloud.style.borderRadius = '50px';
        cloud.style.position = 'absolute';
        cloud.style.animation = `cloudFloat 8s infinite alternate ${i * 0.5}s ease-in-out`;

        // Position clouds
        if (i === 0) {
            cloud.style.top = '50%';
            cloud.style.left = '25%';
            cloud.style.zIndex = '1';
        } else if (i === 1) {
            cloud.style.top = '30%';
            cloud.style.left = '35%';
            cloud.style.zIndex = '2';
        } else {
            cloud.style.top = '40%';
            cloud.style.left = '15%';
            cloud.style.zIndex = '3';
        }

        // Add cloud puffs
        for (let j = 0; j < 3; j++) {
            const cloudPuff = document.createElement('div');
            cloudPuff.style.width = `${cloudSize * 0.5}px`;
            cloudPuff.style.height = `${cloudSize * 0.5}px`;
            cloudPuff.style.backgroundColor = i === 0 ? '#AAAAAA' : '#CCCCCC';
            cloudPuff.style.borderRadius = '50%';
            cloudPuff.style.position = 'absolute';
            cloudPuff.style.bottom = '50%';
            cloudPuff.style.left = `${j * 30}%`;
            cloud.appendChild(cloudPuff);
        }

        container.appendChild(cloud);
    }

    element.appendChild(container);

    // Add animation for clouds
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes cloudFloat {
            0% { transform: translateX(-5%) translateY(0); }
            100% { transform: translateX(5%) translateY(-10%); }
        }
    `;
    document.head.appendChild(style);
}

function createPartlyCloudyDayIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Create the SVG sun (smaller version of the clear day sun)
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "70%");
    svg.setAttribute("height", "70%");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.style.position = "absolute";
    svg.style.top = "10%";
    svg.style.left = "0%";
    svg.style.zIndex = "1";

    // Create a unique ID for the filter to avoid conflicts if multiple icons are on the page
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

    // Create the cloud
    const cloudContainer = document.createElement('div');
    cloudContainer.style.width = '100%';
    cloudContainer.style.height = '100%';
    cloudContainer.style.position = 'absolute';
    cloudContainer.style.top = '0';
    cloudContainer.style.left = '0';
    cloudContainer.style.zIndex = '2';

    const cloud = document.createElement('div');
    cloud.style.width = `${size * 0.7}px`;
    cloud.style.height = `${size * 0.35}px`;
    cloud.style.backgroundColor = '#FFFFFF';
    cloud.style.borderRadius = `${size * 0.3}px`;
    cloud.style.position = 'absolute';
    cloud.style.bottom = '20%';
    cloud.style.right = '5%';
    cloud.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.3)';
    cloud.style.animation = 'float-cloud 8s infinite alternate ease-in-out';

    // Add cloud puffs
    for (let i = 0; i < 3; i++) {
        const cloudPuff = document.createElement('div');
        cloudPuff.style.width = `${size * 0.35}px`;
        cloudPuff.style.height = `${size * 0.35}px`;
        cloudPuff.style.backgroundColor = '#FFFFFF';
        cloudPuff.style.borderRadius = '50%';
        cloudPuff.style.position = 'absolute';
        cloudPuff.style.bottom = '50%';
        cloudPuff.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.3)';

        // Position puffs
        if (i === 0) {
            cloudPuff.style.left = '10%';
        } else if (i === 1) {
            cloudPuff.style.left = '40%';
        } else {
            cloudPuff.style.left = '65%';
        }

        cloud.appendChild(cloudPuff);
    }

    cloudContainer.appendChild(cloud);

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
        
        @keyframes float-cloud {
            0% { transform: translateX(-5px); }
            100% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(style);

    element.appendChild(container);
}

// Replace the existing createPartlyCloudyNightIcon function in weatherIcons.js with this improved version

function createPartlyCloudyNightIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Stars layer - added first so they appear behind everything
    const starsLayer = document.createElement('div');
    starsLayer.style.position = 'absolute';
    starsLayer.style.width = '100%';
    starsLayer.style.height = '100%';
    starsLayer.style.top = '0';
    starsLayer.style.left = '0';
    starsLayer.style.zIndex = '1'; // Lower z-index for stars

    // Improved stars - fewer than in clear night
    const starColors = ['#FFFFFF', '#F5F5F5', '#FFFDE7', '#FFF9C4'];
    const starCount = isForecast ? 3 : 8;

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

        // Ensure stars don't overlap with where the moon and clouds will be
        // Keep stars mostly in the top and edges of the container
        let topPos = Math.random() * 60; // Mostly in the top half
        let leftPos;
        if (topPos < 30) {
            // If star is higher up, allow it to be anywhere horizontally
            leftPos = Math.random() * 100;
        } else {
            // If star is lower, keep it toward the edges
            leftPos = Math.random() < 0.5 ?
                Math.random() * 30 :  // Left edge
                70 + Math.random() * 30; // Right edge
        }

        star.style.top = `${topPos}%`;
        star.style.left = `${leftPos}%`;

        // Animation timing
        star.style.animation = `twinkle-star ${2 + Math.random() * 4}s infinite ease-in-out`;
        star.style.animationDelay = `${Math.random() * 5}s`;

        starsLayer.appendChild(star);
    }

    // Add stars layer to container
    container.appendChild(starsLayer);

    // Moon layer (with middle z-index)
    const moonLayer = document.createElement('div');
    moonLayer.style.position = 'absolute';
    moonLayer.style.width = '70%';  // Moon is smaller than in clear night
    moonLayer.style.height = '70%';
    moonLayer.style.top = '0';
    moonLayer.style.left = '0';
    moonLayer.style.zIndex = '2'; // Middle z-index for moon

    // Create SVG for the moon
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "0 0 100 100");

    // Create a unique filter ID for this instance
    const filterId = `pc-moon-glow-${Math.random().toString(36).substr(2, 9)}`;

    // Create defs section for filters
    const defs = document.createElementNS(svgNS, "defs");

    // Create radial gradient for the moon
    const gradientId = `pc-moon-gradient-${Math.random().toString(36).substr(2, 9)}`;
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
    const clipPathId = `pc-moon-clip-${Math.random().toString(36).substr(2, 9)}`;
    const clipPath = document.createElementNS(svgNS, "clipPath");
    clipPath.setAttribute("id", clipPathId);

    const clipCircle = document.createElementNS(svgNS, "circle");
    clipCircle.setAttribute("cx", "50");
    clipCircle.setAttribute("cy", "40");
    clipCircle.setAttribute("r", "20");

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

    // Create moon group
    const moonGroup = document.createElementNS(svgNS, "g");

    // Create a group with clip path for the moon and crescent
    const clipGroup = document.createElementNS(svgNS, "g");
    clipGroup.setAttribute("clip-path", `url(#${clipPathId})`);

    // Full moon circle
    const moonCircle = document.createElementNS(svgNS, "circle");
    moonCircle.setAttribute("cx", "50");
    moonCircle.setAttribute("cy", "40");
    moonCircle.setAttribute("r", "20");
    moonCircle.setAttribute("fill", `url(#${gradientId})`);
    moonCircle.setAttribute("filter", `url(#${filterId})`);

    clipGroup.appendChild(moonCircle);

    // Overlay circle to create crescent (now will be clipped to moon's boundaries)
    const crescentOverlay = document.createElementNS(svgNS, "circle");
    crescentOverlay.setAttribute("cx", "62");
    crescentOverlay.setAttribute("cy", "40");
    crescentOverlay.setAttribute("r", "17");
    crescentOverlay.setAttribute("fill", "#1C2331");

    clipGroup.appendChild(crescentOverlay);

    // Add craters after overlay circle but still inside clip path
    const crater1 = document.createElementNS(svgNS, "circle");
    crater1.setAttribute("cx", "40");
    crater1.setAttribute("cy", "42");
    crater1.setAttribute("r", "2");
    crater1.setAttribute("fill", "rgba(255, 250, 230, 0.3)");

    const crater2 = document.createElementNS(svgNS, "circle");
    crater2.setAttribute("cx", "38");
    crater2.setAttribute("cy", "34");
    crater2.setAttribute("r", "2.5");
    crater2.setAttribute("fill", "rgba(255, 250, 230, 0.2)");

    // Add all elements to the proper groups
    clipGroup.appendChild(crater1);
    clipGroup.appendChild(crater2);
    moonGroup.appendChild(clipGroup);

    svg.appendChild(defs);
    svg.appendChild(moonGroup);

    moonLayer.appendChild(svg);
    container.appendChild(moonLayer);

    // Cloud layer (with highest z-index)
    const cloudLayer = document.createElement('div');
    cloudLayer.style.position = 'absolute';
    cloudLayer.style.width = '100%';
    cloudLayer.style.height = '100%';
    cloudLayer.style.top = '0';
    cloudLayer.style.left = '0';
    cloudLayer.style.zIndex = '3'; // Highest z-index for clouds

    // Create the cloud
    const cloud = document.createElement('div');
    cloud.style.width = `${size * 0.7}px`;
    cloud.style.height = `${size * 0.4}px`;
    cloud.style.backgroundColor = '#A5B0C3'; // Slightly lighter gray for night clouds
    cloud.style.borderRadius = `${size * 0.3}px`;
    cloud.style.position = 'absolute';
    cloud.style.bottom = '20%';
    cloud.style.right = '10%';
    // No box shadow for flat appearance
    cloud.style.animation = 'float-cloud 8s infinite alternate ease-in-out';

    // Add cloud puffs
    for (let i = 0; i < 3; i++) {
        const cloudPuff = document.createElement('div');
        cloudPuff.style.width = `${size * 0.35}px`;
        cloudPuff.style.height = `${size * 0.35}px`;
        cloudPuff.style.backgroundColor = '#A5B0C3';
        cloudPuff.style.borderRadius = '50%';
        cloudPuff.style.position = 'absolute';
        cloudPuff.style.bottom = '50%';
        // No box shadow for flat appearance

        // Position puffs
        if (i === 0) {
            cloudPuff.style.left = '10%';
        } else if (i === 1) {
            cloudPuff.style.left = '40%';
        } else {
            cloudPuff.style.left = '65%';
        }

        cloud.appendChild(cloudPuff);
    }

    cloudLayer.appendChild(cloud);
    container.appendChild(cloudLayer);

    // Add animations if not already added
    if (!document.getElementById('pc-night-animations')) {
        const animStyle = document.createElement('style');
        animStyle.id = 'pc-night-animations';
        animStyle.textContent = `
            @keyframes twinkle-star {
                0%, 100% { opacity: 0.2; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.5); }
            }
            
            @keyframes float-cloud {
                0% { transform: translateX(-5px) translateY(0); }
                100% { transform: translateX(5px) translateY(-5px); }
            }
        `;
        document.head.appendChild(animStyle);
    }

    element.appendChild(container);
}

function createThunderstormIcon(element, isForecast = false) {
    const size = isForecast ? 60 : 150;
    const container = document.createElement('div');
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
    container.style.position = 'relative';

    // Cloud (darker for thunderstorm)
    const cloud = document.createElement('div');
    cloud.style.width = `${size * 0.8}px`;
    cloud.style.height = `${size * 0.4}px`;
    cloud.style.backgroundColor = '#555555';
    cloud.style.borderRadius = `${size * 0.4}px`;
    cloud.style.position = 'absolute';
    cloud.style.top = '20%';
    cloud.style.left = '10%';

    // Cloud details
    const cloudDetail1 = document.createElement('div');
    cloudDetail1.style.width = `${size * 0.4}px`;
    cloudDetail1.style.height = `${size * 0.4}px`;
    cloudDetail1.style.backgroundColor = '#555555';
    cloudDetail1.style.borderRadius = '50%';
    cloudDetail1.style.position = 'absolute';
    cloudDetail1.style.top = '-50%';
    cloudDetail1.style.left = '20%';

    const cloudDetail2 = document.createElement('div');
    cloudDetail2.style.width = `${size * 0.5}px`;
    cloudDetail2.style.height = `${size * 0.5}px`;
    cloudDetail2.style.backgroundColor = '#555555';
    cloudDetail2.style.borderRadius = '50%';
    cloudDetail2.style.position = 'absolute';
    cloudDetail2.style.top = '-60%';
    cloudDetail2.style.left = '50%';

    cloud.appendChild(cloudDetail1);
    cloud.appendChild(cloudDetail2);

    // Improved Lightning bolt - using SVG for better control
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

    // Raindrops (fewer than in rain icon)
    const numDrops = isForecast ? 3 : 6;
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

    container.appendChild(cloud);
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