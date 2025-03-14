// modalRadarController.js with complete radar functionality

// Global state
let modalMap = null;
let radarModalOpen = false;
let radarFrames = [];
let animationPosition = 0;
let currentOverlay = null;
let animationTimer = null;
let isPlaying = false;
let lastSuccessfulAlerts = [];
let alertLayers = [];
let timestampDisplay = null;
let alertFetchInProgress = false;
let lastAlertFetchTime = 0;

// Constants
const RAINVIEWER_API_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const DEFAULT_COLOR_SCHEME = 7; // Rainbow SELEX-IS
const SMOOTHING = 1; // True
const SNOW_VIEW = 1; // True
const DEFAULT_OPACITY = 0.8;
const FRAMES_TO_KEEP = 11; // Number of recent frames to use in animation
const ANIMATION_SPEED = 1000; // time per frame in ms
const ALERT_FETCH_THROTTLE = 3000; // Minimum time between fetches (3 seconds)
const API_ENDPOINTS = {
    NWS_ALERTS: 'https://api.weather.gov/alerts/active'
};

/**
 * Initialize the modal controller
 */
export function initModalController() {
    // Get radar button and modal elements
    const openRadarBtn = document.getElementById('open-radar');
    const closeRadarBtn = document.getElementById('close-radar-modal');
    const radarModal = document.getElementById('radar-modal');
    const radarBackdrop = document.getElementById('radar-modal-backdrop');

    if (openRadarBtn && closeRadarBtn && radarModal && radarBackdrop) {
        // Add event listeners for opening and closing the radar modal
        openRadarBtn.addEventListener('click', openRadarModal);
        closeRadarBtn.addEventListener('click', closeRadarModal);
        radarBackdrop.addEventListener('click', closeRadarModal);

        // Also close on escape key
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && radarModalOpen) {
                closeRadarModal();
            }
        });
    } else {
        console.error('Could not find radar modal elements');
    }
}

/**
 * Open the radar modal and initialize map
 */
function openRadarModal() {
    // Update state
    radarModalOpen = true;
    
    // Hide all weather icons and animations to improve performance
    hideWeatherElements(true);
    
    // Show the modal and backdrop
    const radarModal = document.getElementById('radar-modal');
    const radarBackdrop = document.getElementById('radar-modal-backdrop');
    
    if (!radarModal || !radarBackdrop) {
        console.error('Modal elements not found');
        return;
    }
    
    // Display modal
    radarModal.style.display = 'block';
    radarBackdrop.style.display = 'block';
    
    // Add class for animation
    setTimeout(() => {
        radarModal.classList.add('open');
        radarBackdrop.classList.add('open');
        document.body.classList.add('modal-open');
        
        // Initialize or refresh map after modal is visible
        setTimeout(() => {
            initModalMap();
        }, 300);
    }, 10);
}

/**
 * Close the radar modal
 */
function closeRadarModal() {
    // Update state
    radarModalOpen = false;
    
    // Pause animation if running
    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
    }
    
    // Hide the modal with animation
    const radarModal = document.getElementById('radar-modal');
    const radarBackdrop = document.getElementById('radar-modal-backdrop');
    
    if (!radarModal || !radarBackdrop) return;
    
    radarModal.classList.remove('open');
    radarBackdrop.classList.remove('open');
    document.body.classList.remove('modal-open');
    
    // After animation completes
    setTimeout(() => {
        radarModal.style.display = 'none';
        radarBackdrop.style.display = 'none';
        
        // Show weather elements again
        hideWeatherElements(false);
    }, 300);
}

/**
 * Hide or show weather elements to improve performance when radar is open
 * @param {boolean} hide - True to hide elements, false to show them
 */
function hideWeatherElements(hide) {
    // Main weather icon
    const weatherIcon = document.getElementById('weather-icon');
    if (weatherIcon) {
        weatherIcon.style.display = hide ? 'none' : 'block';
    }
    
    // Weather background animations
    const weatherBackground = document.getElementById('weather-background');
    if (weatherBackground) {
        weatherBackground.style.visibility = hide ? 'hidden' : 'visible';
    }
    
    // Forecast icons
    const forecastIcons = document.querySelectorAll('.forecast-icon');
    forecastIcons.forEach(icon => {
        icon.style.visibility = hide ? 'hidden' : 'visible';
    });
    
    // Hourly forecast icons
    const hourlyIcons = document.querySelectorAll('.hourly-forecast-card .forecast-icon');
    hourlyIcons.forEach(icon => {
        icon.style.visibility = hide ? 'hidden' : 'visible';
    });
    
    // Weather cards visibility (optional - you might want to keep these visible)
    // Uncomment if you want to hide entire cards
    /*
    const weatherCards = document.querySelectorAll('.weather-card');
    weatherCards.forEach(card => {
        if (!card.id.includes('search-container')) { // Keep search container visible
            card.style.opacity = hide ? '0.5' : '1';
        }
    });
    */
    
    console.log(`Weather elements ${hide ? 'hidden' : 'shown'} for performance optimization`);
}

/**
 * Initialize the modal map with radar functionality
 */
function initModalMap() {
    const container = document.getElementById('modal-radar-view');
    if (!container) {
        console.error('Modal radar container not found');
        return;
    }

    // IMPORTANT: Make the container fully visible
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.right = '0';
    container.style.bottom = '0';
    container.style.overflow = 'hidden';

    // If map already exists, just refresh data
    if (modalMap) {
        console.log('Map already exists, refreshing data');

        // Ensure the map size is correct
        modalMap.invalidateSize(true);

        // Fetch new radar data
        fetchRadarData();

        // Fetch alerts
        fetchMapAreaAlerts(true);

        return;
    }

    // Show loading indicator
    container.innerHTML = `
    <div class="radar-loading" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(0,0,0,0.5); z-index: 1000;">
        <div class="radar-loading-spinner"><div></div><div></div><div></div></div>
        <div class="radar-loading-text">Loading radar data...</div>
    </div>
    <div style="display: flex; flex-direction: column; width: 100%; height: 100%; overflow: hidden;">
        <!-- Map Container (now with bottom margin for controls) -->
        <div id="modal-map-container" style="flex: 1; position: relative; overflow: hidden; margin-bottom: 60px;"></div>
        
        <!-- Timestamp Display -->
        <div id="timestamp-display" class="timestamp-display" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 6px 10px; border-radius: 4px; font-size: 14px; z-index: 1000;"></div>
        
        <!-- Control Bar (now positioned as a separate element below the map) -->
        <div id="radar-controls" class="radar-controls" style="position: absolute; bottom: 0; left: 0; right: 0; height: 60px; padding: 10px 15px; background-color: #222222; border-top: 1px solid rgba(255,255,255,0.2); box-shadow: 0 -2px 10px rgba(0,0,0,0.3); z-index: 1001;">
            <div class="radar-timeline-wrapper" style="display: flex; align-items: flex-start; gap: 12px; width: 100%;">
                <button id="radar-play-pause" class="radar-play-pause" style="width: 36px; height: 36px; min-width: 36px; border-radius: 50%; background-color: #1e88e5; color: white; border: none; display: flex; justify-content: center; align-items: center; cursor: pointer; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">
                    <i class="bi bi-play-fill"></i>
                </button>
                <div class="radar-timeline-controls" style="flex: 1; min-width: 0;">
                    <div id="radar-timestamps-row" class="radar-timestamps-row" style="position: relative; height: 20px; width: 100%; margin-bottom: 4px;"></div>
                    <div id="radar-timeline" class="radar-timeline" style="height: 6px; background-color: rgba(0, 0, 0, 0.3); border-radius: 3px; position: relative; overflow: visible; width: 100%; margin: 5px 0;"></div>
                </div>
            </div>
        </div>
    </div>
`;

    // Create a new map container with guaranteed dimensions
    const mapContainer = document.getElementById('modal-map-container');
    if (!mapContainer) {
        console.error('Map container element not created');
        return;
    }

    // Get play/pause button and timeline elements
    const playPauseButton = document.getElementById('radar-play-pause');
    const timelineContainer = document.getElementById('radar-timeline');

    // Store timestamp display
    timestampDisplay = document.getElementById('timestamp-display');

    // Add event listener to play/pause button
    if (playPauseButton) {
        playPauseButton.addEventListener('click', toggleAnimation);
    }

    // Load Leaflet if needed
    ensureLeafletCSS();

    // Get coordinates from URL
    const urlParams = new URLSearchParams(window.location.search);
    const lat = parseFloat(urlParams.get('lat')) || 39.8283;
    const lon = parseFloat(urlParams.get('lon')) || -98.5795;

    // Then load Leaflet script and initialize map
    loadLeafletScript()
        .then(() => {
            if (!window.L) {
                throw new Error('Leaflet not available after loading');
            }

            console.log('Leaflet loaded, creating map');

            try {
                console.log('Creating Leaflet map instance');

                // Create map instance
                modalMap = L.map(mapContainer, {
                    zoomControl: true,
                    attributionControl: true
                });

                // CRITICAL: Set view BEFORE adding layers
                modalMap.setView([lat, lon], 7);
                console.log('Map view set');

                // Now add the tile layer
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Radar: <a href="https://rainviewer.com/">RainViewer</a>',
                    subdomains: 'abcd',
                    maxZoom: 19,
                    opacity: 0.8
                }).addTo(modalMap);
                console.log('Tile layer added');

                // Add a marker at the current location
                L.marker([lat, lon]).addTo(modalMap);
                console.log('Marker added');

                // Force map to recognize container size
                modalMap.invalidateSize(true);
                console.log('Map size invalidated');

                // Fetch radar data
                fetchRadarData();

                // Fetch alerts after a delay
                setTimeout(() => {
                    fetchMapAreaAlerts(true);
                }, 1000);

                // Add event listener for map movements to update alerts
                modalMap.on('moveend', debounce(() => {
                    if (radarModalOpen) {
                        fetchMapAreaAlerts();
                    }
                }, 500));

                // Force map refresh again after a delay
                setTimeout(() => {
                    modalMap.invalidateSize(true);
                }, 500);
            } catch (error) {
                console.error('Error initializing modal map:', error);
                showModalMapError('Error initializing map: ' + error.message);
            }
        })
        .catch(error => {
            console.error('Failed to load Leaflet:', error);
            showModalMapError('Failed to load map library: ' + error.message);
        });
}

/**
 * Create NWS request options with proper headers
 * @returns {Object} - Request options with headers
 */
function createNWSRequestOptions() {
    return {
        headers: {
            'User-Agent': '(joshuakimsey.github.io/variable-weather, https://github.com/JoshuaKimsey)',
            'Accept': 'application/geo+json'
        }
    };
}

/**
 * Fetch map alerts from NWS API
 * @param {boolean} forceRefresh - Force refresh regardless of throttling
 * @returns {Promise} - Promise resolving after fetch completes
 */
function fetchMapAreaAlerts(forceRefresh = false) {
    return new Promise((resolve, reject) => {
        try {
            if (!modalMap) {
                console.warn('Cannot fetch map alerts - map not initialized');
                resolve(false);
                return;
            }

            // Check if modal is open
            if (!radarModalOpen && !forceRefresh) {
                console.log('Modal not open, skipping alert fetch');
                resolve(false);
                return;
            }

            // Get current time for throttling
            const now = Date.now();

            // If fetch is in progress, don't start another one
            if (alertFetchInProgress) {
                console.log('Alert fetch already in progress, skipping');
                resolve(false);
                return;
            }

            // Throttle fetches unless force refresh is requested
            if (!forceRefresh && now - lastAlertFetchTime < ALERT_FETCH_THROTTLE) {
                console.log('Throttling alert fetch');

                // If we have cached alerts, use those
                if (lastSuccessfulAlerts.length > 0) {
                    console.log('Using cached alerts');
                    updateAlertPolygons(lastSuccessfulAlerts);
                }

                resolve(false);
                return;
            }

            // Update timestamp and set fetch in progress
            lastAlertFetchTime = now;
            alertFetchInProgress = true;

            // Show loading indicator
            showMapLoadingIndicator('Fetching alerts...');

            // Create request options
            const requestOptions = createNWSRequestOptions();

            // Fetch all active alerts
            fetch(`${API_ENDPOINTS.NWS_ALERTS}`, requestOptions)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch alerts: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // Hide loading indicator
                    hideMapLoadingIndicator();

                    // Check if we have valid data
                    if (!data || !data.features || !Array.isArray(data.features)) {
                        console.warn('Invalid response from alert API');
                        throw new Error('Invalid alert API response');
                    }

                    // Process alerts
                    const alerts = data.features.map(alert => {
                        const alertObj = {
                            properties: alert.properties
                        };

                        if (alert.geometry) {
                            alertObj.geometry = alert.geometry;
                        }

                        return alertObj;
                    });

                    // Get alerts with geometry
                    const alertsWithGeometry = alerts.filter(alert => alert.geometry);

                    console.log(`Found ${alerts.length} total alerts, ${alertsWithGeometry.length} with geometry`);

                    // Update display if we have alerts with geometry
                    if (alertsWithGeometry.length > 0) {
                        // Store for later use
                        lastSuccessfulAlerts = [...alertsWithGeometry];

                        // Update the alert polygons
                        updateAlertPolygons(alertsWithGeometry);
                        resolve(true);
                    } else if (lastSuccessfulAlerts.length > 0) {
                        // Use cached alerts if no new ones found
                        updateAlertPolygons(lastSuccessfulAlerts);
                        resolve(false);
                    } else {
                        // Clear alerts if none found
                        clearAlertLayers();
                        resolve(false);
                    }

                    alertFetchInProgress = false;
                })
                .catch(error => {
                    console.error('Error fetching alerts:', error);
                    hideMapLoadingIndicator();
                    alertFetchInProgress = false;

                    // Show error message
                    showMapErrorMessage('Failed to load alerts');

                    // Use cached alerts if available
                    if (lastSuccessfulAlerts.length > 0) {
                        updateAlertPolygons(lastSuccessfulAlerts);
                    }

                    resolve(false);
                });
        } catch (error) {
            console.error('Unexpected error in fetchMapAreaAlerts:', error);
            alertFetchInProgress = false;
            resolve(false);
        }
    });
}

/**
 * Update alert polygons on the map
 * @param {Array} alerts - Array of alert objects with properties and geometry
 */
function updateAlertPolygons(alerts) {
    if (!modalMap) {
        console.warn('Cannot update alert polygons - map not initialized');
        return;
    }

    // Clear existing alert layers
    clearAlertLayers();

    if (!alerts || alerts.length === 0) return;

    // Add CSS animation for severe/extreme alerts
    addAlertAnimationCSS();

    // Define severity levels for z-index
    const severityZIndex = {
        'extreme': 1000,
        'severe': 800,
        'moderate': 600,
        'minor': 400
    };

    // Sort alerts by severity (less severe first)
    const sortedAlerts = [...alerts].sort((a, b) => {
        const severityA = (a.properties && a.properties.severity) ? a.properties.severity.toLowerCase() : 'minor';
        const severityB = (b.properties && b.properties.severity) ? b.properties.severity.toLowerCase() : 'minor';

        return (severityZIndex[severityA] || 0) - (severityZIndex[severityB] || 0);
    });

    // Process each alert
    sortedAlerts.forEach(alert => {
        // Get severity
        let severity = 'moderate';
        if (alert.properties && alert.properties.severity) {
            severity = alert.properties.severity.toLowerCase();
        }

        // Check severity levels
        const isExtreme = severity === 'extreme';
        const isSevere = severity === 'severe';

        // Get alert color
        const alertColor = getAlertTypeColor(alert);

        // Create style for the alert
        const alertStyle = {
            color: alertColor.color,
            weight: isExtreme ? 3 : (isSevere ? 2.5 : 2),
            opacity: alertColor.borderOpacity || 0.9,
            fillColor: alertColor.color,
            fillOpacity: alertColor.fillOpacity || 0.2,
            className: isExtreme ? 'extreme-alert-polygon' : (isSevere ? 'severe-alert-polygon' : '')
        };

        try {
            // Create the layer
            const alertLayer = L.geoJSON(alert.geometry, {
                style: alertStyle,
                onEachFeature: (feature, layer) => {
                    // Add popup with alert information
                    if (alert.properties) {
                        const title = alert.properties.event || 'Weather Alert';
                        const description = alert.properties.headline || '';

                        // Create popup content
                        let popupContent = `
                            <div style="max-width: 250px;">
                                <h3 style="margin-top: 0; color: ${alertColor.color}; ${isExtreme ? 'animation: pulse-text 1.5s infinite;' : ''}">
                                    ${isExtreme ? '⚠️ ' : ''}${title}${isExtreme ? ' ⚠️' : ''}
                                </h3>`;

                        // Add severity indicator
                        if (isExtreme) {
                            popupContent += `<p><strong style="color: #B71C1C;">EXTREME ALERT</strong></p>`;
                        } else if (isSevere) {
                            popupContent += `<p><strong style="color: #C62828;">SEVERE ALERT</strong></p>`;
                        }

                        // Add description
                        popupContent += `<p>${description}</p>`;

                        if (isExtreme) {
                            popupContent += `<p style="font-size: 0.9em; font-style: italic;">This is an EXTREME alert. Take immediate action if in affected area.</p>`;
                        } else if (isSevere) {
                            popupContent += `<p style="font-size: 0.9em; font-style: italic;">This is a SEVERE alert. Prepare to take action if in affected area.</p>`;
                        }

                        popupContent += `</div>`;

                        layer.bindPopup(popupContent);
                    }
                }
            });

            // Set z-index based on severity
            alertLayer.setZIndex(severityZIndex[severity] || 500);

            // Add to map and store reference
            alertLayer.addTo(modalMap);
            alertLayers.push(alertLayer);
        } catch (error) {
            console.error('Error adding alert polygon:', error, alert);
        }
    });

    console.log(`Added ${alertLayers.length} alert polygons to the map`);
}

/**
 * Get color for alert type
 * @param {Object} alert - Alert object
 * @returns {Object} - Color information with color, borderOpacity, fillOpacity
 */
function getAlertTypeColor(alert) {
    // Make sure we have valid alert properties
    if (!alert || !alert.properties || !alert.properties.event) {
        return { color: '#757575', borderOpacity: 0.9, fillOpacity: 0.2 }; // Default gray
    }

    // Convert event name to lowercase for case-insensitive matching
    const eventType = alert.properties.event.toLowerCase();
    const severity = (alert.properties.severity || '').toLowerCase();

    // Get intensity level based on severity
    let intensityLevel = 1; // Default to moderate (1)

    if (severity === 'extreme') {
        intensityLevel = 3; // Darkest/most intense (3)
    } else if (severity === 'severe') {
        intensityLevel = 2; // Dark/intense (2)
    } else if (severity === 'minor') {
        intensityLevel = 0; // Lightest/least intense (0)
    }

    // Calculate opacity based on severity
    const borderOpacity = 0.7 + (intensityLevel * 0.1); // 0.7, 0.8, 0.9, 1.0
    const fillOpacity = 0.15 + (intensityLevel * 0.05); // 0.15, 0.2, 0.25, 0.3

    // FLOOD / WATER RELATED ALERTS (GREEN)
    if (eventType.includes('flood') ||
        eventType.includes('hydrologic') ||
        eventType.includes('seiche') ||
        eventType.includes('tsunami') ||
        eventType.includes('dam') ||
        eventType.includes('coastal')) {

        const greenShades = ['#81C784', '#66BB6A', '#4CAF50', '#2E7D32'];
        return {
            color: greenShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    // THUNDERSTORM RELATED ALERTS (YELLOW/ORANGE)
    if (eventType.includes('thunderstorm') ||
        eventType.includes('tstm') ||
        eventType.includes('lightning') ||
        eventType.includes('special weather')) {

        const yellowShades = ['#FFD54F', '#FFC107', '#FF9800', '#F57C00'];
        return {
            color: yellowShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    // TORNADO RELATED ALERTS (RED)
    if (eventType.includes('tornado') ||
        eventType.includes('extreme wind') ||
        eventType.includes('dust storm') ||
        eventType.includes('dust devil')) {

        const redShades = ['#EF9A9A', '#EF5350', '#E53935', '#B71C1C'];
        return {
            color: redShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    // WINTER WEATHER RELATED ALERTS (BLUE/PURPLE)
    if (eventType.includes('snow') ||
        eventType.includes('blizzard') ||
        eventType.includes('winter') ||
        eventType.includes('ice') ||
        eventType.includes('freezing') ||
        eventType.includes('frost') ||
        eventType.includes('freeze') ||
        eventType.includes('cold') ||
        eventType.includes('wind chill') ||
        eventType.includes('sleet')) {

        const blueShades = ['#9FA8DA', '#7986CB', '#3F51B5', '#283593'];
        return {
            color: blueShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    // FIRE / HEAT RELATED ALERTS (ORANGE/RED)
    if (eventType.includes('fire') ||
        eventType.includes('smoke') ||
        eventType.includes('heat') ||
        eventType.includes('hot') ||
        eventType.includes('red flag') ||
        eventType.includes('volcanic')) {

        const orangeShades = ['#FFAB91', '#FF7043', '#F4511E', '#BF360C'];
        return {
            color: orangeShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    // FOG / VISIBILITY RELATED ALERTS (GRAY)
    if (eventType.includes('fog') ||
        eventType.includes('visibility') ||
        eventType.includes('dense') ||
        eventType.includes('air quality') ||
        eventType.includes('smoke')) {

        const grayShades = ['#B0BEC5', '#90A4AE', '#607D8B', '#37474F'];
        return {
            color: grayShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    // WIND RELATED ALERTS (TEAL/CYAN)
    if (eventType.includes('wind') ||
        eventType.includes('gale') ||
        eventType.includes('hurricane') ||
        eventType.includes('typhoon') ||
        eventType.includes('tropical') ||
        eventType.includes('storm')) {

        const tealShades = ['#80CBC4', '#4DB6AC', '#009688', '#00695C'];
        return {
            color: tealShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    // OTHER/MISC ALERTS (PURPLE)
    const purpleShades = ['#B39DDB', '#9575CD', '#673AB7', '#4527A0'];
    return {
        color: purpleShades[intensityLevel],
        borderOpacity: borderOpacity,
        fillOpacity: fillOpacity
    };
}

/**
 * Add CSS animations for alert polygons
 */
function addAlertAnimationCSS() {
    // Check if already added
    if (document.getElementById('alert-animation-css')) return;

    // Create style element
    const style = document.createElement('style');
    style.id = 'alert-animation-css';
    style.textContent = `
        /* Pulsing animation for extreme alert polygons */
        @keyframes extreme-alert-pulse {
            0%, 100% { 
                stroke-opacity: 0.9;
                fill-opacity: 0.3;
                stroke-width: 3px;
            }
            50% { 
                stroke-opacity: 1;
                fill-opacity: 0.5;
                stroke-width: 5px;
            }
        }
        
        /* Pulsing animation for severe alert polygons */
        @keyframes severe-alert-pulse {
            0%, 100% { 
                stroke-opacity: 0.8;
                fill-opacity: 0.25;
                stroke-width: 2.5px;
            }
            50% { 
                stroke-opacity: 0.9;
                fill-opacity: 0.35;
                stroke-width: 3.5px;
            }
        }
        
        /* Text pulsing for popups */
        @keyframes pulse-text {
            0%, 100% { 
                opacity: 1;
            }
            50% { 
                opacity: 0.7;
            }
        }
        
        /* Apply animation to extreme alert polygons */
        .extreme-alert-polygon {
            animation: extreme-alert-pulse 2s infinite ease-in-out;
        }
        
        /* Apply animation to severe alert polygons */
        .severe-alert-polygon {
            animation: severe-alert-pulse 3s infinite ease-in-out;
        }
    `;

    // Add to document
    document.head.appendChild(style);
}

/**
 * Clear alert layers from the map
 */
function clearAlertLayers() {
    alertLayers.forEach(layer => {
        if (modalMap) modalMap.removeLayer(layer);
    });
    alertLayers = [];
}

/**
 * Show loading indicator for map operations
 * @param {string} message - Message to display
 */
function showMapLoadingIndicator(message = 'Loading...') {
    let loadingElement = document.getElementById('map-data-loading');

    if (!loadingElement) {
        loadingElement = document.createElement('div');
        loadingElement.id = 'map-data-loading';
        loadingElement.style.position = 'absolute';
        loadingElement.style.top = '10px';
        loadingElement.style.right = '10px';
        loadingElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        loadingElement.style.color = 'white';
        loadingElement.style.padding = '8px 12px';
        loadingElement.style.borderRadius = '4px';
        loadingElement.style.zIndex = '1000';
        loadingElement.style.display = 'flex';
        loadingElement.style.alignItems = 'center';
        loadingElement.style.fontSize = '12px';
        loadingElement.innerHTML = `
            <div style="display: flex; margin-right: 8px;">
                <div style="width: 6px; height: 6px; background-color: white; border-radius: 50%; margin: 0 2px; animation: map-loading-bounce 1.4s infinite ease-in-out both; animation-delay: -0.32s;"></div>
                <div style="width: 6px; height: 6px; background-color: white; border-radius: 50%; margin: 0 2px; animation: map-loading-bounce 1.4s infinite ease-in-out both; animation-delay: -0.16s;"></div>
                <div style="width: 6px; height: 6px; background-color: white; border-radius: 50%; margin: 0 2px; animation: map-loading-bounce 1.4s infinite ease-in-out both;"></div>
            </div>
            <div>${message}</div>
        `;

        // Add animation style if not already present
        if (!document.getElementById('map-loading-animation')) {
            const animStyle = document.createElement('style');
            animStyle.id = 'map-loading-animation';
            animStyle.textContent = `
                @keyframes map-loading-bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
            `;
            document.head.appendChild(animStyle);
        }

        // Add to map container
        const mapContainer = document.getElementById('modal-map-container');
        if (mapContainer) {
            mapContainer.appendChild(loadingElement);
        }
    } else {
        // Update message
        const textElement = loadingElement.querySelector('div:last-child');
        if (textElement) {
            textElement.textContent = message;
        }

        loadingElement.style.display = 'flex';
    }
}

/**
 * Hide map loading indicator
 */
function hideMapLoadingIndicator() {
    const loadingElement = document.getElementById('map-data-loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

/**
 * Show error message on map
 * @param {string} message - Error message
 */
function showMapErrorMessage(message) {
    let errorElement = document.getElementById('map-data-error');

    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'map-data-error';
        errorElement.style.position = 'absolute';
        errorElement.style.top = '10px';
        errorElement.style.right = '10px';
        errorElement.style.backgroundColor = 'rgba(244, 67, 54, 0.8)';
        errorElement.style.color = 'white';
        errorElement.style.padding = '8px 12px';
        errorElement.style.borderRadius = '4px';
        errorElement.style.zIndex = '1000';
        errorElement.style.fontSize = '12px';
        errorElement.style.maxWidth = '80%';

        const mapContainer = document.getElementById('modal-map-container');
        if (mapContainer) {
            mapContainer.appendChild(errorElement);
        }
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';

    // Auto-hide after delay
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

/**
 * Ensure Leaflet CSS is loaded
 */
function ensureLeafletCSS() {
    if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'resources/leaflet/leaflet.css';
        document.head.appendChild(link);
    }
}

/**
 * Load the Leaflet JavaScript library
 * @returns {Promise} - Resolves when Leaflet is loaded
 */
function loadLeafletScript() {
    return new Promise((resolve, reject) => {
        // Skip if Leaflet is already loaded
        if (window.L) {
            console.log('Leaflet already loaded');
            resolve();
            return;
        }

        try {
            const script = document.createElement('script');
            script.src = './resources/leaflet/leaflet.js';
            script.async = true;

            script.onload = () => {
                console.log('Leaflet script loaded successfully');
                resolve();
            };

            script.onerror = (e) => {
                console.error('Failed to load Leaflet script:', e);
                reject(new Error('Failed to load Leaflet script'));
            };

            document.head.appendChild(script);
        } catch (err) {
            console.error('Error setting up Leaflet script:', err);
            reject(err);
        }
    });
}

/**
 * Display an error message on the modal map
 */
function showModalMapError(message) {
    const container = document.getElementById('modal-radar-view');
    if (!container) return;

    // Create error element if not exists
    let errorElement = container.querySelector('.radar-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'radar-error';
        errorElement.style.position = 'absolute';
        errorElement.style.top = '50%';
        errorElement.style.left = '50%';
        errorElement.style.transform = 'translate(-50%, -50%)';
        errorElement.style.background = 'rgba(0, 0, 0, 0.7)';
        errorElement.style.color = 'white';
        errorElement.style.padding = '15px 20px';
        errorElement.style.borderRadius = '8px';
        errorElement.style.textAlign = 'center';
        errorElement.style.maxWidth = '80%';
        errorElement.style.zIndex = '1000';
        container.appendChild(errorElement);
    }

    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

/**
 * Fetch radar data from RainViewer API
 */
function fetchRadarData() {
    const loadingIndicator = document.querySelector('.radar-loading');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }

    // Add a timestamp to prevent caching
    const urlWithTimestamp = `${RAINVIEWER_API_URL}?t=${Date.now()}`;

    fetch(urlWithTimestamp)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data || !data.radar || !data.radar.past || data.radar.past.length === 0) {
                throw new Error('Invalid radar data format received');
            }

            processRadarData(data);

            // Hide loading indicator
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }

            // Show the latest frame only (don't start animation)
            if (radarFrames.length > 0) {
                // Set the animation position to the latest frame
                animationPosition = radarFrames.length - 1;

                // Display the latest frame
                showFrame(animationPosition);

                // Make sure play button shows correct state
                const playPauseButton = document.getElementById('radar-play-pause');
                if (playPauseButton) {
                    playPauseButton.innerHTML = '<i class="bi bi-play-fill"></i>';
                }
                isPlaying = false;
            } else {
                console.warn('No radar frames available after processing');
            }
        })
        .catch(error => {
            console.error('Error fetching radar data:', error);

            // Hide loading indicator
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }

            showModalMapError('Failed to load radar data: ' + error.message);
        });
}

/**
 * Process radar data from API response
 * @param {Object} data - API response data
 */
function processRadarData(data) {
    if (!data || !data.radar || !data.radar.past) {
        console.error('Invalid radar data format');
        return;
    }

    // Get the most recent frames
    let frames = [...data.radar.past];

    // Limit to FRAMES_TO_KEEP most recent frames
    if (frames.length > FRAMES_TO_KEEP) {
        frames = frames.slice(-FRAMES_TO_KEEP);
    }

    // Store just the timestamp information - we'll construct the full URL later
    radarFrames = frames.map(frame => ({
        time: frame.time,
        timestamp: new Date(frame.time * 1000)
    }));

    // Update timeline
    updateTimeline();
}

/**
 * Update the timeline display with frame markers
 */
function updateTimeline() {
    const timelineContainer = document.getElementById('radar-timeline');
    const timestampsRow = document.getElementById('radar-timestamps-row');
    if (!timelineContainer || !timestampsRow) return;

    // Clear previous content
    timelineContainer.innerHTML = '';
    timestampsRow.innerHTML = '';

    // Create timestamps for frames
    if (radarFrames.length > 0) {
        // Determine how many timestamps to show based on screen width
        const containerWidth = timelineContainer.offsetWidth;
        const minSpaceBetweenTimestamps = 60;
        const maxTimestamps = Math.max(5, Math.floor(containerWidth / minSpaceBetweenTimestamps));

        // Calculate step size
        let step = Math.ceil(radarFrames.length / maxTimestamps);

        // At minimum, we want timestamps at the beginning, middle and end
        // For very short frame sequences, just show all frames
        if (radarFrames.length <= 6) {
            step = 1;
        } else if (radarFrames.length <= 20) {
            step = 5; // Show every other frame
        }

        // Create timestamps
        for (let i = 0; i < radarFrames.length; i += step) {
            // Skip some middle frames if we have too many
            if (i !== 0 && i !== radarFrames.length - 1 && i % (step * 2) !== 0 && radarFrames.length > 12) {
                continue;
            }

            const timeLabel = document.createElement('div');
            timeLabel.className = 'radar-timestamp';
            timeLabel.style.position = 'absolute';
            timeLabel.style.fontSize = '11px';
            timeLabel.style.color = 'rgba(255, 255, 255, 0.9)';
            timeLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
            timeLabel.style.padding = '1px 4px';
            timeLabel.style.borderRadius = '3px';
            timeLabel.style.whiteSpace = 'nowrap';
            timeLabel.style.overflow = 'hidden';
            timeLabel.style.textOverflow = 'ellipsis';
            timeLabel.style.transform = 'translateX(-50%)';

            // Format the time
            const timeString = radarFrames[i].timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            timeLabel.textContent = timeString;

            // Calculate position as percentage
            const position = (i / (radarFrames.length - 1)) * 100;
            timeLabel.style.left = `${position}%`;

            timestampsRow.appendChild(timeLabel);
        }

        // Always ensure the last timestamp is shown
        if (step > 1 && radarFrames.length > 1) {
            const lastIndex = radarFrames.length - 1;

            // Check if the last timestamp wasn't already added
            if (lastIndex % step !== 0) {
                const lastTimeLabel = document.createElement('div');
                lastTimeLabel.className = 'radar-timestamp';
                lastTimeLabel.style.position = 'absolute';
                lastTimeLabel.style.fontSize = '11px';
                lastTimeLabel.style.color = 'rgba(255, 255, 255, 0.9)';
                lastTimeLabel.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                lastTimeLabel.style.padding = '1px 4px';
                lastTimeLabel.style.borderRadius = '3px';
                lastTimeLabel.style.whiteSpace = 'nowrap';
                lastTimeLabel.style.overflow = 'hidden';
                lastTimeLabel.style.textOverflow = 'ellipsis';
                lastTimeLabel.style.right = '0';
                lastTimeLabel.style.transform = 'translateX(0)';

                const timeString = radarFrames[lastIndex].timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                lastTimeLabel.textContent = timeString;
                timestampsRow.appendChild(lastTimeLabel);
            }
        }
    }

    // Create frame markers
    radarFrames.forEach((frame, index) => {
        const marker = document.createElement('div');
        marker.className = 'radar-frame-marker';
        marker.style.position = 'absolute';
        marker.style.width = '2px';
        marker.style.height = '6px';
        marker.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
        marker.style.top = '0';
        marker.style.cursor = 'pointer';
        marker.style.transition = 'background-color 0.2s ease';
        marker.setAttribute('data-index', index);

        // Position the marker
        marker.style.left = `${(index / (radarFrames.length - 1)) * 100}%`;

        // Format time for tooltip
        const timeString = frame.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Add time tooltip
        marker.title = timeString;

        // Make marker clickable
        marker.addEventListener('click', () => {
            stopAnimation();
            animationPosition = index;
            showFrame(index);
            updateTimelineSelection();
        });

        timelineContainer.appendChild(marker);
    });

    // Create current position indicator
    const positionIndicator = document.createElement('div');
    positionIndicator.id = 'radar-position-indicator';
    positionIndicator.className = 'radar-position-indicator';
    positionIndicator.style.position = 'absolute';
    positionIndicator.style.width = '12px';
    positionIndicator.style.height = '12px';
    positionIndicator.style.backgroundColor = 'white';
    positionIndicator.style.borderRadius = '50%';
    positionIndicator.style.top = '50%';
    positionIndicator.style.transform = 'translate(-50%, -50%)';
    positionIndicator.style.boxShadow = '0 0 4px rgba(0, 0, 0, 0.5)';
    positionIndicator.style.zIndex = '10';
    positionIndicator.style.pointerEvents = 'none';
    positionIndicator.style.transition = 'left 0.2s ease-out';
    timelineContainer.appendChild(positionIndicator);

    // Default to showing the latest frame
    if (animationPosition === 0 && radarFrames.length > 0) {
        animationPosition = radarFrames.length - 1;
    }

    // Initial selection
    updateTimelineSelection();
}

/**
 * Update the timeline to highlight the current frame
 */
function updateTimelineSelection() {
    const timelineContainer = document.getElementById('radar-timeline');
    if (!timelineContainer) return;

    // Update the marker selection
    const markers = timelineContainer.querySelectorAll('.radar-frame-marker');
    if (!markers.length) return;

    markers.forEach((marker, index) => {
        if (index === animationPosition) {
            marker.style.backgroundColor = 'white';
        } else {
            marker.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
        }
    });

    // Update position indicator
    const positionIndicator = document.getElementById('radar-position-indicator');
    if (positionIndicator && radarFrames.length > 1) {
        // Calculate position percentage
        const position = (animationPosition / (radarFrames.length - 1)) * 100;
        positionIndicator.style.left = `${position}%`;
    }
}

/**
 * Show a specific radar frame
 * @param {number} index - Index of frame to show
 */
function showFrame(index) {
    if (!modalMap || !radarFrames.length || index >= radarFrames.length) {
        return;
    }

    // Get the frame
    const frame = radarFrames[index];

    // Store the old overlay for removal later
    const oldOverlay = currentOverlay;

    // Create the tile URL for this frame
    const tileUrl = `https://tilecache.rainviewer.com/v2/radar/${frame.time}/512/{z}/{x}/{y}/${DEFAULT_COLOR_SCHEME}/${SMOOTHING}_${SNOW_VIEW}.png`;

    // Create a new tile layer and add it to the map
    const newOverlay = L.tileLayer(tileUrl, {
        opacity: DEFAULT_OPACITY,
        zIndex: 11,
        tileSize: 256,
    });

    // Add the new layer to the map
    newOverlay.addTo(modalMap);

    // Update current overlay reference
    currentOverlay = newOverlay;

    // Remove the old overlay after a short delay
    if (oldOverlay) {
        setTimeout(() => {
            modalMap.removeLayer(oldOverlay);
        }, 90);
    }

    // Update timestamp display
    updateTimestampDisplay(frame.timestamp);

    // Update timeline selection
    updateTimelineSelection();
}

/**
 * Update the timestamp display
 * @param {Date} timestamp - Current frame timestamp
 */
function updateTimestampDisplay(timestamp) {
    if (!timestampDisplay) return;

    try {
        // Format date and time
        const timeString = timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        const dateString = timestamp.toLocaleDateString([], {
            month: 'short',
            day: 'numeric'
        });

        // Update display
        timestampDisplay.innerHTML = `<strong>${timeString}</strong><br>${dateString}`;
    } catch (error) {
        console.error('Error updating timestamp display:', error);
        timestampDisplay.textContent = 'Time data unavailable';
    }
}

/**
 * Start the radar animation
 */
function startAnimation() {
    // Stop any existing animation
    stopAnimation();

    // Start from the beginning of the animation if we're at the end
    if (animationPosition === radarFrames.length - 1) {
        animationPosition = 0;
        // Show the first frame immediately
        showFrame(animationPosition);
    }

    // Update button state
    const playPauseButton = document.getElementById('radar-play-pause');
    if (playPauseButton) {
        playPauseButton.innerHTML = '<i class="bi bi-pause-fill"></i>';
    }

    isPlaying = true;

    // Start the animation timer
    animationTimer = setInterval(() => {
        // Move to the next frame in the sequence
        animationPosition = (animationPosition + 1) % radarFrames.length;
        showFrame(animationPosition);
    }, ANIMATION_SPEED);
}

/**
 * Stop the radar animation and return to latest frame
 */
function stopAnimation() {
    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
    }

    // Update button state
    const playPauseButton = document.getElementById('radar-play-pause');
    if (playPauseButton) {
        playPauseButton.innerHTML = '<i class="bi bi-play-fill"></i>';
    }

    isPlaying = false;
    
    // Return to the latest frame when stopping
    if (radarFrames.length > 0) {
        // Set position to the latest frame
        animationPosition = radarFrames.length - 1;
        
        // Show the latest frame
        showFrame(animationPosition);
        
        // Update timeline selection
        updateTimelineSelection();
    }
}

/**
 * Toggle the animation play/pause state
 */
function toggleAnimation() {
    if (isPlaying) {
        stopAnimation();
    } else {
        startAnimation();
    }
}

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Check if radar modal is open
 * @returns {boolean} True if modal is open
 */
export function isRadarModalOpen() {
    return radarModalOpen;
}