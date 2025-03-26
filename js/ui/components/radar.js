// modalRadarController.js with complete radar functionality

import { loadComponentCSS } from '../../utils/cssLoader.js';

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
let historyStateAdded = false;
let isProgrammaticMove = false;
let ignoreNextMoveEnd = false;
let lastClickedAlertId = null;

// Define a unique identifier for our history state
const MODAL_STATE_ID = 'weather_radar_modal_open';

// Constants
const RAINVIEWER_API_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const DEFAULT_COLOR_SCHEME = 7; // Rainbow SELEX-IS
const SMOOTHING = 1; // True
const SNOW_VIEW = 1; // True
const DEFAULT_OPACITY = 0.8;
const FRAMES_TO_KEEP = 11; // Number of recent frames to use in animation
const ANIMATION_SPEED = 1000; // time per frame in ms
const ALERT_FETCH_THROTTLE = 3000; // Minimum time between fetches (3 seconds)

/**
 * Initialize the modal controller
 */
export function initModalController() {

    loadComponentCSS('./styles/radar.css').catch(error => console.warn('Failed to load radar styles:', error));

    // Get radar button and modal elements
    const openRadarBtn = document.getElementById('open-radar');
    const closeRadarBtn = document.getElementById('close-radar-modal');
    const backRadarBtn = document.getElementById('radar-back-button');
    const radarModal = document.getElementById('radar-modal');
    const radarBackdrop = document.getElementById('radar-modal-backdrop');

    if (openRadarBtn && radarModal && radarBackdrop) {
        // Add event listeners for opening and closing the radar modal
        openRadarBtn.addEventListener('click', openRadarModal);

        if (closeRadarBtn) {
            closeRadarBtn.addEventListener('click', closeRadarModal);
        }

        if (backRadarBtn) {
            backRadarBtn.addEventListener('click', closeRadarModal);
        }

        radarBackdrop.addEventListener('click', closeRadarModal);

        // Also close on escape key
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && radarModalOpen) {
                closeRadarModal();
            }
        });

        // Set up history event listener for back button/gesture
        window.addEventListener('popstate', function (event) {
            console.log('History navigation detected', event.state);
            if (radarModalOpen) {
                // If the modal is open and we navigate back, close it
                closeRadarModal(true); // true = coming from popstate event
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

    document.body.classList.add('radar-modal-open');

    // Hide all weather icons and animations to improve performance
    hideWeatherElements(true);

    // Show the modal and backdrop
    const radarModal = document.getElementById('radar-modal');
    const radarBackdrop = document.getElementById('radar-modal-backdrop');
    const backButton = document.getElementById('radar-back-button');

    if (!radarModal || !radarBackdrop) {
        console.error('Modal elements not found');
        return;
    }

    // Update back button visibility
    if (backButton) {
        backButton.style.display = window.innerWidth <= 480 ? 'flex' : 'none';
    }

    // CRITICAL FIX: Reset visibility and positioning properties
    radarModal.style.visibility = 'visible';
    radarModal.style.pointerEvents = 'auto';
    radarModal.style.zIndex = '2000';

    radarBackdrop.style.visibility = 'visible';
    radarBackdrop.style.pointerEvents = 'auto';
    radarBackdrop.style.zIndex = '1999';

    // Add a history entry for back button support
    try {
        // Get current URL to preserve it
        const currentUrl = window.location.href;
        // Push state with our modal identifier
        history.pushState({ modalId: MODAL_STATE_ID }, document.title, currentUrl);
        historyStateAdded = true;
    } catch (e) {
        console.error('Failed to add history state:', e);
    }

    // Display modal
    radarModal.style.display = 'block';
    radarBackdrop.style.display = 'block';

    // Add mobile-specific class if needed
    if (window.innerWidth <= 480) {
        document.body.classList.add('radar-modal-open');
    }

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
 * @param {boolean} fromPopState - Whether this was triggered from a popstate event
 */
function closeRadarModal(fromPopState = false) {
    // Only manipulate history when closing directly (not from back button)
    if (historyStateAdded && !fromPopState) {
        console.log('Manually going back in history');
        history.back();
        return; // Exit early - the popstate will call this function again
    }

    // Reset the flag
    historyStateAdded = false;

    // Update state
    radarModalOpen = false;

    document.body.classList.remove('radar-modal-open');

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
    document.body.classList.remove('radar-modal-open');

    // After animation completes
    setTimeout(() => {
        // CRITICAL FIX: Use visibility:hidden instead of display:none
        // This ensures it doesn't block clicks but keeps the map state
        radarModal.style.display = 'none';
        radarModal.style.visibility = 'hidden';
        radarModal.style.pointerEvents = 'none'; // Ensure it doesn't capture clicks
        radarModal.style.zIndex = '-1'; // Move it below other elements

        radarBackdrop.style.display = 'none';
        radarBackdrop.style.visibility = 'hidden';
        radarBackdrop.style.pointerEvents = 'none';
        radarBackdrop.style.zIndex = '-1';

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

    // console.log(`Weather elements ${hide ? 'hidden' : 'shown'} for performance optimization`);
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
    container.style.width = '100%';
    container.style.height = '100%';

    // If map already exists, just refresh data
    if (modalMap) {
        console.log('Map exists, refreshing');

        // CRITICAL FIX: Force multiple map size updates with increasing delays
        modalMap.invalidateSize(true);

        // Add additional delayed invalidations
        [100, 300, 800].forEach(delay => {
            setTimeout(() => {
                if (modalMap) {
                    console.log(`Invalidating map size after ${delay}ms`);
                    modalMap.invalidateSize(true);
                }
            }, delay);
        });

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
    <div style="width: 100%; height: 100%; position: relative; overflow: hidden;">
        <!-- Map Container -->
        <div id="modal-map-container" style="width: 100%; height: calc(100% - 60px); position: absolute; top: 0; left: 0;"></div>
        
        <!-- Timestamp Display -->
        <div id="timestamp-display" class="timestamp-display" style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 6px 10px; border-radius: 4px; font-size: 14px; z-index: 1000;"></div>
        
        <!-- Control Bar -->
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

    // CRITICAL: Explicitly set dimensions
    mapContainer.style.width = '100%';
    mapContainer.style.height = 'calc(100% - 60px)';
    mapContainer.style.position = 'absolute';
    mapContainer.style.top = '0';
    mapContainer.style.left = '0';

    // Get play/pause button and timeline elements
    const playPauseButton = document.getElementById('radar-play-pause');
    const timelineContainer = document.getElementById('radar-timeline');

    // Store timestamp display
    timestampDisplay = document.getElementById('timestamp-display');

    // Add event listener to play/pause button
    if (playPauseButton) {
        playPauseButton.addEventListener('click', toggleAnimation);
    }

    // Ensure Leaflet CSS is loaded
    ensureLeafletCSS();

    // Get coordinates from URL
    const urlParams = new URLSearchParams(window.location.search);
    const lat = parseFloat(urlParams.get('lat')) || 39.8283;
    const lon = parseFloat(urlParams.get('lon')) || -98.5795;

    // Load Leaflet script and initialize map
    loadLeafletScript()
        .then(() => {
            if (!window.L) {
                throw new Error('Leaflet not available after loading');
            }

            try {
                console.log('Creating Leaflet map instance');

                // IMPORTANT: Make sure the map container has explicit dimensions
                mapContainer.style.width = '100%';
                mapContainer.style.height = 'calc(100% - 60px)';

                // Create map instance with explicit dimensions
                modalMap = L.map(mapContainer, {
                    zoomControl: true,
                    attributionControl: true,
                    fadeAnimation: false,       // Disable fade animations
                    preferCanvas: true
                });

                // Set view BEFORE adding layers
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

                // CRITICAL: Force multiple map size updates with increasing delays
                modalMap.invalidateSize(true);
                // console.log('Initial invalidateSize called');

                // Multiple delayed invalidations for reliability
                [100, 300, 600, 1000, 2000].forEach(delay => {
                    setTimeout(() => {
                        if (modalMap) {
                            // console.log(`Invalidating map size after ${delay}ms`);
                            modalMap.invalidateSize(true);
                        }
                    }, delay);
                });

                // Fetch radar data
                fetchRadarData();

                // Fetch alerts after a delay
                setTimeout(() => {
                    fetchMapAreaAlerts(true);
                }, 1000);

                // Add event listener for map movements to update alerts
                modalMap.on('moveend', debounce(() => {
                    if (ignoreNextMoveEnd) {
                        ignoreNextMoveEnd = false;
                        return;
                    }

                    if (radarModalOpen) {
                        fetchMapAreaAlerts();
                    }
                }, 500));

                modalMap.on('moveend', function () {
                    if (isProgrammaticMove) {
                        isProgrammaticMove = false;
                        return;
                    }

                    if (lastClickedAlertId != null) {
                        lastClickedAlertId = null;
                    }
                });
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
 * Fetch map alerts from the alerts API system
 * 
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
                // console.log('Modal not open, skipping alert fetch');
                resolve(false);
                return;
            }

            // Get current time for throttling
            const now = Date.now();

            // If fetch is in progress, don't start another one
            if (alertFetchInProgress) {
                // console.log('Alert fetch already in progress, skipping');
                resolve(false);
                return;
            }

            // Throttle fetches unless force refresh is requested
            if (!forceRefresh && now - lastAlertFetchTime < ALERT_FETCH_THROTTLE) {
                // console.log('Throttling alert fetch');

                // If we have cached alerts, use those
                if (lastSuccessfulAlerts.length > 0) {
                    // console.log('Using cached alerts');
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

            // Get the map bounds for the alert query
            const bounds = modalMap.getBounds();
            const mapBounds = {
                north: bounds.getNorth(),
                south: bounds.getSouth(),
                east: bounds.getEast(),
                west: bounds.getWest()
            };

            // Import the alertsApi fetchMapAreaAlerts function
            import('../../api/alerts/alertsApi.js')
                .then(({ fetchMapAreaAlerts }) => {
                    // Call the centralized alerts API function
                    return fetchMapAreaAlerts(mapBounds);
                })
                .then(alerts => {
                    // Hide loading indicator
                    hideMapLoadingIndicator();
                    alertFetchInProgress = false;

                    // Check if we have valid alerts
                    if (!alerts || !Array.isArray(alerts)) {
                        console.warn('Invalid response from alert API');
                        throw new Error('Invalid alert API response');
                    }

                    // console.log(`Found ${alerts.length} alerts for map area`);

                    // Get alerts with geometry
                    const alertsWithGeometry = alerts.filter(alert => alert.geometry);

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

    // Store alert that was clicked before clearing layers
    let clickedAlert = null;
    if (lastClickedAlertId && alertLayers.length > 0) {
        // Find the alert by ID in our current collection
        clickedAlert = alerts.find(alert =>
            alert.id === lastClickedAlertId ||
            (alert.properties && alert.properties.id === lastClickedAlertId)
        );
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
        const severityA = (a.properties && a.properties.severity) ? a.properties.severity.toLowerCase() :
            (a.severity ? a.severity.toLowerCase() : 'minor');
        const severityB = (b.properties && b.properties.severity) ? b.properties.severity.toLowerCase() :
            (b.severity ? b.severity.toLowerCase() : 'minor');

        return (severityZIndex[severityA] || 0) - (severityZIndex[severityB] || 0);
    });

    // Process each alert
    sortedAlerts.forEach(alert => {
        // Get alert ID for tracking
        const alertId = alert.id || (alert.properties && alert.properties.id);

        // Get severity
        let severity = 'moderate';
        if (alert.properties && alert.properties.severity) {
            severity = alert.properties.severity.toLowerCase();
        } else if (alert.severity) {
            severity = alert.severity.toLowerCase();
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
                    if (alert.title || (alert.properties && alert.properties.event)) {
                        const title = alert.title || alert.properties.event || 'Weather Alert';
                        const description = alert.description || (alert.properties && alert.properties.headline) || '';

                        // Create popup content with more detailed information
                        let popupContent = `
                <div class="alert-popup-content">
                  <h3 style="margin-top: 0; color: ${alertColor.color}; ${isExtreme ? 'animation: pulse-text 1.5s infinite;' : ''}">
                    ${isExtreme ? '⚠️ ' : ''}${title}${isExtreme ? ' ⚠️' : ''}
                  </h3>`;

                        // Add severity and urgency badges
                        let severityText = '';
                        if (isExtreme) {
                            severityText = 'EXTREME';
                        } else if (isSevere) {
                            severityText = 'SEVERE';
                        } else if (severity === 'moderate') {
                            severityText = 'MODERATE';
                        } else {
                            severityText = 'MINOR';
                        }

                        const urgency = alert.urgency || (alert.properties && alert.properties.urgency) || '';
                        popupContent += `<div style="display: flex; gap: 5px; margin-bottom: 8px; flex-wrap: wrap;">
                <span class="alert-severity ${severity}" style="background-color: ${alertColor.color};">
                  ${severityText}
                </span>`;

                        if (urgency) {
                            popupContent += `
                  <span style="background-color: #424242; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em;">
                    ${urgency.toUpperCase()}
                  </span>`;
                        }
                        popupContent += `</div>`;

                        // Add description
                        popupContent += `<p style="margin-bottom: 12px;">${description}</p>`;

                        // Add expiration time if available
                        const expires = alert.expires || (alert.properties && alert.properties.expires);
                        if (expires) {
                            let expiresDate;
                            if (typeof expires === 'number') {
                                expiresDate = new Date(expires * 1000); // If it's a Unix timestamp
                            } else {
                                expiresDate = new Date(expires); // If it's a date string
                            }

                            // Format expires date
                            const expiresFormatted = expiresDate.toLocaleString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                            });

                            popupContent += `<p style="margin-bottom: 8px; font-size: 0.9em;"><strong>Expires:</strong> ${expiresFormatted}</p>`;
                        }

                        // Add hazard types if available
                        const hazardTypes = alert.hazardTypes ||
                            (alert.properties && alert.properties.hazardTypes) ||
                            [];

                        if (hazardTypes && hazardTypes.length > 0) {
                            popupContent += `<div style="margin-bottom: 10px;">
                  <p style="margin-bottom: 5px; font-size: 0.9em;"><strong>Hazards:</strong></p>
                  <div class="hazard-tags" style="display: flex; flex-wrap: wrap; gap: 5px;">`;

                            hazardTypes.forEach(hazard => {
                                const hazardName = hazard.charAt(0).toUpperCase() + hazard.slice(1);
                                popupContent += `<span class="hazard-tag" style="background-color: #616161; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em;">
                    ${hazardName}
                  </span>`;
                            });

                            popupContent += `</div></div>`;
                        }

                        // Add action guidance based on severity
                        if (isExtreme) {
                            popupContent += `<p class="action-guidance" style="padding: 8px; background-color: rgba(183, 28, 28, 0.1); border-left: 3px solid #B71C1C; font-size: 0.9em; margin: 10px 0;">
                  <strong>TAKE ACTION NOW:</strong> This is an EXTREME alert. Seek shelter or follow official instructions immediately.
                </p>`;
                        } else if (isSevere) {
                            popupContent += `<p class="action-guidance" style="padding: 8px; background-color: rgba(198, 40, 40, 0.1); border-left: 3px solid #C62828; font-size: 0.9em; margin: 10px 0;">
                  <strong>BE PREPARED:</strong> This is a SEVERE alert. Prepare to take action if in the affected area.
                </p>`;
                        } else if (severity === 'moderate') {
                            popupContent += `<p class="action-guidance" style="padding: 8px; background-color: rgba(239, 108, 0, 0.1); border-left: 3px solid #EF6C00; font-size: 0.9em; margin: 10px 0;">
                  <strong>STAY AWARE:</strong> Monitor conditions and follow updates.
                </p>`;
                        }

                        // Add full alert text in a collapsible section using HTML5 details/summary
                        const fullText = alert.fullText || (alert.properties && alert.properties.fullText);
                        if (fullText) {
                            // Process the text to handle newlines and make it more readable
                            const processedText = fullText.replace(/\n/g, '<br>');

                            popupContent += `
                  <details>
                    <summary style="cursor: pointer; background-color: #424242; color: white; padding: 6px; border-radius: 4px; font-size: 0.9em; outline: none;">
                      View Full Alert
                    </summary>
                    <div class="full-text" style="margin-top: 8px; max-height: 200px; overflow-y: auto; padding: 8px; background-color: #f5f5f5; border-radius: 4px; font-size: 0.85em; line-height: 1.4;">
                      ${processedText}
                    </div>
                  </details>`;
                        }

                        popupContent += `</div>`;

                        // Create popup with options to prevent auto-close and set max width
                        const popup = layer.bindPopup(popupContent, {
                            maxWidth: 320,
                            autoPan: true,
                            autoPanPadding: [20, 20],
                            closeOnClick: true,
                        });

                        // Add click handler for this alert
                        layer.on('click', function (e) {
                            // Set the flag to ignore the next moveend event
                            ignoreNextMoveEnd = true;

                            // Store the ID of the clicked alert
                            lastClickedAlertId = alertId;

                            // Stop event propagation to prevent map click
                            L.DomEvent.stopPropagation(e);
                        });
                    }
                }
            });

            // Set z-index based on severity
            alertLayer.setZIndex(severityZIndex[severity] || 500);

            // Add to map and store reference
            alertLayer.addTo(modalMap);
            alertLayers.push(alertLayer);

            // If this was the clicked alert, open its popup
            if (clickedAlert && alertId === lastClickedAlertId) {
                // Find the first layer in the GeoJSON
                for (const key in alertLayer._layers) {
                    alertLayer._layers[key].openPopup();
                    break;
                }
            }
        } catch (error) {
            console.error('Error adding alert polygon:', error, alert);
        }
    });
}


/**
 * Get color for alert type
 * @param {Object} alert - Alert object
 * @returns {Object} - Color information with color, borderOpacity, fillOpacity
 */
function getAlertTypeColor(alert) {
    // Make sure we have valid alert properties
    if (!alert || !alert.title) {
        return { color: '#757575', borderOpacity: 0.9, fillOpacity: 0.2 }; // Default gray
    }

    // Convert event name to lowercase for case-insensitive matching
    const eventType = alert.title.toLowerCase();
    const severity = (alert.severity || '').toLowerCase();

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

    // Get hazard type from primaryHazard or from the title
    const hazardType = alert.primaryHazard || getDefaultHazardType(alert.title);

    // FLOOD / WATER RELATED ALERTS (GREEN)
    if (hazardType === 'flood') {
        const greenShades = ['#81C784', '#66BB6A', '#4CAF50', '#2E7D32'];
        return {
            color: greenShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    // THUNDERSTORM RELATED ALERTS (YELLOW/ORANGE)
    if (hazardType === 'thunderstorm' || eventType.includes('special weather')) {
        const yellowShades = ['#FFD54F', '#FFC107', '#FF9800', '#F57C00'];
        return {
            color: yellowShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    // TORNADO RELATED ALERTS (RED)
    if (hazardType === 'tornado' || hazardType === 'dust') {
        const redShades = ['#EF9A9A', '#EF5350', '#E53935', '#B71C1C'];
        return {
            color: redShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    // WINTER WEATHER RELATED ALERTS (BLUE/PURPLE)
    if (hazardType === 'snow' || hazardType === 'ice' || hazardType === 'cold') {
        const blueShades = ['#9FA8DA', '#7986CB', '#3F51B5', '#283593'];
        return {
            color: blueShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    // FIRE / HEAT RELATED ALERTS (ORANGE/RED)
    if (hazardType === 'fire' || hazardType === 'smoke' || hazardType === 'heat') {
        const orangeShades = ['#FFAB91', '#FF7043', '#F4511E', '#BF360C'];
        return {
            color: orangeShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    // FOG / VISIBILITY RELATED ALERTS (GRAY)
    if (hazardType === 'fog') {
        const grayShades = ['#B0BEC5', '#90A4AE', '#607D8B', '#37474F'];
        return {
            color: grayShades[intensityLevel],
            borderOpacity: borderOpacity,
            fillOpacity: fillOpacity
        };
    }

    // WIND RELATED ALERTS (TEAL/CYAN)
    if (hazardType === 'wind' || hazardType === 'hurricane') {
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

function getDefaultHazardType(title) {
    if (!title) return 'unknown';

    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes('tornado')) return 'tornado';
    if (lowerTitle.includes('flood')) return 'flood';
    if (lowerTitle.includes('thunder') || lowerTitle.includes('lightning')) return 'thunderstorm';
    if (lowerTitle.includes('snow') || lowerTitle.includes('winter')) return 'snow';
    if (lowerTitle.includes('ice') || lowerTitle.includes('freez')) return 'ice';
    if (lowerTitle.includes('wind')) return 'wind';
    if (lowerTitle.includes('heat')) return 'heat';
    if (lowerTitle.includes('cold')) return 'cold';
    if (lowerTitle.includes('fog')) return 'fog';
    if (lowerTitle.includes('hurricane')) return 'hurricane';

    return 'unknown';
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
 * Format an alert time string
 * @param {string|number} timeValue - Time value (timestamp or date string)
 * @returns {string} - Formatted time string
 */
function formatAlertTime(timeValue) {
    if (!timeValue) return 'Unknown';

    try {
        let date;

        if (typeof timeValue === 'number') {
            // It's a timestamp in seconds
            date = new Date(timeValue * 1000);
        } else {
            // It's a date string
            date = new Date(timeValue);
        }

        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'Unknown';
        }

        // Format date nicely
        return date.toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Error formatting alert time:', error);
        return 'Unknown';
    }
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

// Add enhanced back button support
function initRadarBackButton() {
    // Get the back button
    const backButton = document.getElementById('radar-back-button');
    if (!backButton) return;

    // Clear any existing listeners
    const newBackButton = backButton.cloneNode(true);
    backButton.parentNode.replaceChild(newBackButton, backButton);

    // Add click event to call closeRadarModal
    newBackButton.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        closeRadarModal();
    });

    console.log('Radar back button initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'complete') {
    initRadarBackButton();
} else {
    window.addEventListener('load', initRadarBackButton);
}