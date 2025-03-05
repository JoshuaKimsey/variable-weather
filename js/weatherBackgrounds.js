/**
 * Weather background animation functions
 * Contains all functions needed for animated weather backgrounds
 */

// Get the weather background element
let weatherBackground;

// Initialize the weather background element
export function initBackgrounds(backgroundElementId) {
    weatherBackground = document.getElementById(backgroundElementId);
}

// Map of weather conditions to background functions
export const weatherBackgrounds = {
    // NWS backgrounds
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

    // Night versions
    'nskc': setBackgroundClearNight, // clear night
    'nfew': setBackgroundPartlyCloudyNight, // few clouds night
    'nsct': setBackgroundPartlyCloudyNight, // scattered clouds night
    'nbkn': setBackgroundPartlyCloudyNight, // broken clouds night

    // Pirate weather backgrounds (fallback)
    'clear-day': setBackgroundClearDay,
    'clear-night': setBackgroundClearNight,
    'rain': setBackgroundRain,
    'snow': setBackgroundSnow,
    'sleet': setBackgroundSleet,
    'wind': setBackgroundWind,
    'fog': setBackgroundFog,
    'cloudy': setBackgroundCloudy,
    'partly-cloudy-day': setBackgroundPartlyCloudy,
    'partly-cloudy-night': setBackgroundPartlyCloudyNight,
    'thunderstorm': setBackgroundThunderstorm
};

/**
 * Set weather background based on icon code
 */
export function setWeatherBackground(iconCode) {
    if (!weatherBackground) {
        console.error('Weather background element not initialized');
        return;
    }

    // Clear previous background elements
    weatherBackground.innerHTML = '';

    // Reset background color
    document.body.style.background = '';

    // Create and add the appropriate background
    if (weatherBackgrounds[iconCode]) {
        weatherBackgrounds[iconCode]();
    } else {
        // Fallback for unknown icon codes
        setBackgroundCloudy();
    }
}

// Weather Background Creation Functions
function setBackgroundClearDay() {
    document.body.style.background = 'linear-gradient(to bottom, #4A90E2 0%, #87CEEB 100%)';

    // Add a single sun with rays to background
    // const sun = document.createElement('div');
    // sun.className = 'animation-element sun';
    // sun.style.top = '15%';
    // sun.style.left = '75%';
    // sun.style.opacity = '0.8';
    // sun.style.width = '100px';
    // sun.style.height = '100px';

    // // Add a slight glow effect
    // sun.style.boxShadow = '0 0 60px rgba(255, 235, 59, 0.6)';
    // sun.style.background = 'radial-gradient(circle, #ffeb3b, rgba(255, 235, 59, 0.6), rgba(255, 235, 59, 0))';

    // weatherBackground.appendChild(sun);
}

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

function setBackgroundPartlyCloudy() {
    document.body.style.background = 'linear-gradient(to bottom, #2980B9 0%, #6DD5FA 50%, #FFFFFF 100%)';

    // Add a single sun
    // const sun = document.createElement('div');
    // sun.className = 'animation-element sun';
    // sun.style.top = '15%';
    // sun.style.left = '75%';
    // sun.style.opacity = '0.7';
    // sun.style.width = '80px';
    // sun.style.height = '80px';
    // sun.style.boxShadow = '0 0 40px rgba(255, 235, 59, 0.5)';
    // sun.style.background = 'radial-gradient(circle, #ffeb3b, rgba(255, 235, 59, 0.6), rgba(255, 235, 59, 0))';

    // weatherBackground.appendChild(sun);

    // Add clouds (existing code for clouds remains the same)
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