/**
 * Simple Radar View using RainViewer's direct tile API
 * This implementation directly uses the RainViewer API without loading their external script
 */

//==============================================================================
// 1. IMPORTS, CONSTANTS, AND MODULE STATE
//==============================================================================

import { API_ENDPOINTS } from './config.js';

// Configuration Constants
const RAINVIEWER_API_URL = 'https://api.rainviewer.com/public/weather-maps.json';
const DEFAULT_MAP_ZOOM = 7;
const DEFAULT_COLOR_SCHEME = 7; // 0: original, 1: universal, 2: TITAN, 4: The Weather Channel, 5: Meteored, 6: NEXRAD Level 3, 7: Rainbow SELEX-IS, 8: Dark Sky
const SMOOTHING = 1; // 0: False, 1: True
const SNOW_VIEW = 1; // 0: False, 1: True
const DEFAULT_OPACITY = 0.8;
const FRAMES_TO_KEEP = 11; // Number of recent frames to use in animation
const ANIMATION_SPEED = 1000; // time per frame in ms
const RETURN_TO_LATEST_ON_STOP = true; // Set to true to jump to latest frame when stopping animation
const ALERT_FETCH_THROTTLE = 3000; // Minimum time between fetches (3 seconds)

// Module state variables
let map = null;
let radarFrames = [];
let alertLayers = [];
let alertFetchInProgress = false;
let lastSuccessfulAlerts = [];
let lastAlertFetchTime = 0;
let animationPosition = 0;
let animationTimer = null;
let currentOverlay = null;
let isPlaying = false;
let mapInitialized = false;
let loadingIndicator = null;
let playPauseButton = null;
let timelineContainer = null;
let currentLocationMarker = null;
let timestampDisplay = null;
let timestampControl = null;
let timestampControlInstance = null;

//==============================================================================
// 2. PUBLIC API / EXPORTED FUNCTIONS
//==============================================================================

/**
 * Initialize the radar view
 * @param {string} containerId - ID of container element for the map
 */
export function initRadarView(containerId) {
    console.log('Initializing simple radar view with local Leaflet resources...');

    // Create loading indicator
    createLoadingIndicator(containerId);

    // Ensure Leaflet CSS is loaded
    ensureLeafletCSS();

    // Load Leaflet
    loadLeafletScript()
        .then(() => {
            console.log('Local Leaflet loaded, initializing map...');

            // Add a small delay to ensure Leaflet is fully initialized
            setTimeout(() => {
                if (window.L) {
                    // console.log('Leaflet global object available, proceeding with map initialization');

                    try {
                        initializeMap(containerId);
                        createRadarControls(containerId);

                        // Fetch radar data
                        fetchRadarData();

                        // Initialize the map alert system after the map is created
                        initMapAlertSystem();
                    } catch (err) {
                        console.error('Error during map initialization:', err);
                        showRadarError(containerId, 'Failed to initialize map components. Please try again.');
                    }
                } else {
                    console.error('Leaflet global object not available after loading script');
                    showRadarError(containerId, 'Failed to load map library. Please try refreshing the page.');
                }
            }, 300);
        })
        .catch(error => {
            console.error('Error loading local Leaflet:', error);
            showRadarError(containerId, 'Failed to load map. Please check console for details.');
        });

    // Make updateRadarLocation globally accessible as a fallback
    window.updateRadarLocation = updateRadarLocation;

    window.testAlertPolygon = testAlertPolygon;

    // Make fetchMapAreaAlerts accessible for manual testing
    window.fetchMapAreaAlerts = fetchMapAreaAlerts;
}

/**
 * Update the radar view when the location changes
 * @param {number} lat - Latitude of new location
 * @param {number} lon - Longitude of new location
 */
export function updateRadarLocation(lat, lon) {
    if (!map || !currentLocationMarker) return;

    // Update marker position
    currentLocationMarker.setLatLng([lat, lon]);

    // Center map on new location
    map.setView([lat, lon], map.getZoom());

    // After map view is updated, the moveend event will trigger
    // which will automatically call our throttled alert fetching function
    // No need to call fetchMapAreaAlerts() directly
    // console.log('Location changed, alerts will refresh after map movement completes');
}

/**
 * Clean up the radar view resources
 */
export function cleanupRadarView() {
    // Remove resize listener
    window.removeEventListener('resize', repositionTimestampControl);

    // Remove timestamp control if it exists
    if (map && timestampControlInstance) {
        try {
            map.removeControl(timestampControlInstance);
        } catch (error) {
            console.log('Error removing timestamp control:', error);
        }
    }

    // Stop animation
    stopAnimation();

    // Remove map if it exists
    if (map) {
        map.remove();
        map = null;
    }

    // Reset state
    radarFrames = [];
    animationPosition = 0;
    currentOverlay = null;
    mapInitialized = false;
    timestampControlInstance = null;
}

/**
 * Check if radar view is initialized
 * @returns {boolean} - True if radar view is initialized
 */
export function isRadarViewInitialized() {
    return mapInitialized;
}

/**
 * Refresh the radar data
 * Used for auto-updates to keep radar in sync with weather data
 */
export function refreshRadarData() {
    if (!mapInitialized) {
        console.warn('Cannot refresh radar data - map not initialized');
        return;
    }

    // console.log('Refreshing radar data...');

    // If animation is running, remember the state to restart it after refresh
    const wasPlaying = isPlaying;

    // Stop the animation if it's playing
    if (isPlaying) {
        stopAnimation();
    }

    // Show loading indicator
    if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
    }

    // Fetch new radar data
    fetchRadarData()
        .then(() => {
            // Restart the animation if it was playing before
            if (wasPlaying) {
                startAnimation();
            }
        })
        .catch(error => {
            console.error('Error refreshing radar data:', error);
        });
}

/**
 * Update alert polygons on the radar map with proper stacking order by severity
 * @param {Array} alerts - Array of weather alerts with geometry data
 */
export function updateAlertPolygons(alerts) {
    if (!mapInitialized || !map) {
        console.warn('Cannot update alert polygons - map not initialized');
        return;
    }

    // Check if the map is fully rendered
    if (!map.getContainer() || !map.getContainer().clientWidth) {
        console.warn('Map container not properly sized, delaying alert update');
        setTimeout(() => updateAlertPolygons(alerts), 500);
        return;
    }

    // Count alerts with geometry
    const alertsWithGeometry = alerts.filter(alert => alert.geometry);
    console.log(`Found ${alertsWithGeometry.length} alerts with geometry out of ${alerts.length} total alerts`);

    // Clear any existing alert layers
    clearAlertLayers();

    if (!alerts || alerts.length === 0) return;

    // First check if we need to add the CSS animation for extreme alerts
    addExtremeAlertAnimationCSS();

    // Track how many extreme alerts we're displaying
    let extremeAlertCount = 0;
    let alertsAdded = 0;

    // Define severity levels and their corresponding z-index values
    // Higher z-index values will appear on top
    const severityZIndex = {
        'extreme': 1000,  // Highest z-index for extreme alerts
        'severe': 800,    // High z-index for severe alerts
        'moderate': 600,  // Medium z-index for moderate alerts
        'minor': 400      // Lower z-index for minor alerts
    };
    
    // Sort alerts by severity to process more severe alerts last (so they're on top)
    const sortedAlerts = [...alertsWithGeometry].sort((a, b) => {
        const severityA = (a.properties && a.properties.severity) ? a.properties.severity.toLowerCase() : 'minor';
        const severityB = (b.properties && b.properties.severity) ? b.properties.severity.toLowerCase() : 'minor';
        
        // Compare severity z-index values (lower z-index processed first)
        return (severityZIndex[severityA] || 0) - (severityZIndex[severityB] || 0);
    });

    // Process alerts in order from least to most severe
    sortedAlerts.forEach(alert => {
        // Get severity for styling
        let severity = 'moderate';
        if (alert.properties && alert.properties.severity) {
            severity = alert.properties.severity.toLowerCase();
        }

        // Check if this is an extreme alert
        const isExtreme = severity === 'extreme';
        if (isExtreme) {
            extremeAlertCount++;
        }

        // Style based on severity
        const alertStyle = {
            color: getSeverityColor(severity),
            weight: isExtreme ? 3 : 2, // Thicker border for extreme alerts
            opacity: 0.8,
            fillColor: getSeverityColor(severity),
            fillOpacity: 0.2,
            // Add special class name for extreme alerts that we'll animate
            className: isExtreme ? 'extreme-alert-polygon' : ''
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
                        
                        // Create a more detailed popup for extreme alerts
                        const popupContent = isExtreme ? 
                            `
                            <div style="max-width: 250px;">
                                <h3 style="margin-top: 0; color: ${getSeverityColor(severity)}; animation: pulse-text 1.5s infinite;">
                                    ⚠️ ${title} ⚠️
                                </h3>
                                <p><strong>EXTREME ALERT</strong></p>
                                <p>${description}</p>
                                <p style="font-size: 0.9em; font-style: italic;">This is an EXTREME alert. Take immediate action if in affected area.</p>
                            </div>
                            ` :
                            `
                            <div style="max-width: 250px;">
                                <h3 style="margin-top: 0; color: ${getSeverityColor(severity)};">
                                    ${title}
                                </h3>
                                <p>${description}</p>
                            </div>
                            `;
                        
                        layer.bindPopup(popupContent);
                    }
                }
            });

            // Set z-index based on severity
            alertLayer.setZIndex(severityZIndex[severity] || 500);

            // Add to map and store reference
            alertLayer.addTo(map);
            alertLayers.push(alertLayer);
            alertsAdded++;
        } catch (error) {
            console.error('Error adding alert polygon:', error, alert);
        }
    });

    // Log results
    if (extremeAlertCount > 0) {
        console.log(`Displayed ${extremeAlertCount} extreme alert polygons with animation`);
    }
    console.log(`Successfully added ${alertsAdded} alert polygons to the map`);
}

/**
 * Fetch all active alerts nationwide with advanced throttling and caching
 */
export function fetchMapAreaAlerts(forceRefresh = false) {
    if (!map || !mapInitialized) {
        console.warn('Cannot fetch map alerts - map not initialized');
        return Promise.reject(new Error('Map not initialized'));
    }

    // Get current time to check throttling
    const now = Date.now();

    // If fetch is in progress, don't start another one
    if (alertFetchInProgress) {
        console.log('Alert fetch already in progress, skipping');
        return Promise.resolve(false);
    }

    // Throttle fetches unless force refresh is requested
    if (!forceRefresh && now - lastAlertFetchTime < ALERT_FETCH_THROTTLE) {
        // console.log(`Throttling alert fetch (last fetch was ${now - lastAlertFetchTime}ms ago)`);

        // If we have cached alerts and it's a throttled request, use the cache
        if (lastSuccessfulAlerts.length > 0) {
            console.log('Using cached alerts during throttle period');
            // Use the cached alerts without making a new request
            updateAlertPolygons(lastSuccessfulAlerts);
        }

        return Promise.resolve(false);
    }

    // Update the fetch timestamp immediately to prevent race conditions
    lastAlertFetchTime = now;
    alertFetchInProgress = true;

    // Only show loading indicator if it's been a while since the last fetch
    if (now - lastAlertFetchTime > 10000 || forceRefresh) {
        showMapLoadingIndicator('Fetching alerts...');
    }

    // Return a promise so we can await the result if needed
    return new Promise((resolve, reject) => {
        // Simple approach: Just fetch all active alerts nationwide
        const url = `${API_ENDPOINTS.NWS_ALERTS}`;

        // console.log('Fetching all active alerts nationwide');

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch alerts: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                // Hide loading indicator
                hideMapLoadingIndicator();

                // Process and validate the response
                if (!data || !data.features || !Array.isArray(data.features)) {
                    console.warn('Invalid or empty response from alert API');
                    throw new Error('Invalid alert API response');
                }

                // Process alerts to our standard format
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

                // console.log(`Found ${alerts.length} total alerts nationwide`);
                // console.log(`With geometry: ${alertsWithGeometry.length}`);

                // Only clear and update if we have valid new data
                if (alertsWithGeometry.length > 0) {
                    // Update our cache with the new alerts
                    lastSuccessfulAlerts = [...alertsWithGeometry];

                    // Update the alert polygons on the map
                    updateAlertPolygons(alertsWithGeometry);
                    resolve(true);
                } else if (lastSuccessfulAlerts.length > 0) {
                    // If the new fetch returned no alerts but we have cached ones,
                    // something is likely wrong with the API response - reuse cache
                    console.warn('API returned no alert geometries but we have cached alerts - using cache');
                    updateAlertPolygons(lastSuccessfulAlerts);
                    resolve(false);
                } else {
                    // Only clear if we don't have any cached alerts
                    clearAlertLayers();
                    resolve(false);
                }

                alertFetchInProgress = false;
            })
            .catch(error => {
                console.error('Error fetching nationwide alerts:', error);
                hideMapLoadingIndicator();
                alertFetchInProgress = false;

                // Show error message on the map
                showMapErrorMessage('Failed to load alerts');

                // If we have cached alerts, use them instead during an error
                if (lastSuccessfulAlerts.length > 0) {
                    console.log('Using cached alerts due to fetch error');
                    updateAlertPolygons(lastSuccessfulAlerts);
                }

                reject(error);
            });
    });
}

/**
 * Initialize the map alert system with advanced features
 */
export function initMapAlertSystem() {
    if (!map || !mapInitialized) {
        console.warn('Cannot init map alert system - map not initialized');
        return;
    }

    console.log('Initializing map alert system...');

    // Flag to track first initialization
    let initialFetchCompleted = false;

    // Wait for map to be fully initialized with a view before fetching alerts
    const initialViewHandler = function () {
        // Remove this one-time listener
        map.off('moveend', initialViewHandler);

        // Small delay to ensure the map is fully stable
        setTimeout(() => {
            // Only do the initial fetch if it hasn't been done yet
            if (!initialFetchCompleted) {
                initialFetchCompleted = true;
                fetchMapAreaAlerts(true) // Force refresh on initial load
                    .catch(err => console.error('Initial alert fetch failed:', err));
            }
        }, 500);
    };

    // Add the one-time initialization listener
    map.on('moveend', initialViewHandler);

    // Handle moveend events for later map movements
    // Use a more reliable approach with throttling
    const debouncedFetch = debounce(() => {
        // Only fetch if we've completed the initial fetch
        if (initialFetchCompleted) {
            fetchMapAreaAlerts()
                .catch(err => console.error('Map move alert fetch failed:', err));
        }
    }, 1000);

    map.on('moveend', debouncedFetch);

    // Set up periodic refresh with better error handling
    const refreshIntervalId = setInterval(() => {
        // Only refresh if the map is visible and initial fetch is done
        if (isMapVisible() && initialFetchCompleted) {
            console.log('Refreshing nationwide alerts (5-minute interval)');
            fetchMapAreaAlerts(true) // Force refresh on interval
                .catch(err => {
                    console.error('Scheduled alert refresh failed:', err);

                    // If we have too many consecutive failures, 
                    // we might want to consider adjusting the refresh frequency
                });
        }
    }, 5 * 60 * 1000); // 5 minutes

    // Clean up method for alert system
    window.cleanupAlertSystem = function () {
        clearInterval(refreshIntervalId);
        map.off('moveend', debouncedFetch);
        lastSuccessfulAlerts = [];
    };
}

// Test to see if polygon drawing is working, in browser console: window.testAlertPolygon();
export function testAlertPolygon() {
    if (!map) {
        console.error("Map not initialized");
        return;
    }

    // Clear existing layers
    clearAlertLayers();

    // Get the center of the current map view
    const center = map.getCenter();

    // Create a simple triangle polygon around the center point
    const fakeAlert = {
        properties: {
            event: "Test Alert",
            headline: "This is a test polygon to verify alert rendering",
            severity: "moderate"
        },
        geometry: {
            type: "Polygon",
            coordinates: [[
                [center.lng - 0.2, center.lat - 0.1],
                [center.lng + 0.2, center.lat - 0.1],
                [center.lng, center.lat + 0.2],
                [center.lng - 0.2, center.lat - 0.1] // Close the polygon
            ]]
        }
    };

    // Create test polygon with bright styling for visibility
    const testStyle = {
        color: '#FF0000',
        weight: 3,
        opacity: 1,
        fillColor: '#FF0000',
        fillOpacity: 0.3,
        pane: 'overlayPane' // Try to ensure it appears on top
    };

    // Create the layer
    const testLayer = L.geoJSON(fakeAlert.geometry, {
        style: testStyle
    });

    // Set high z-index to make sure it's visible
    testLayer.setZIndex(9999);

    // Add to map and store
    testLayer.addTo(map);
    alertLayers.push(testLayer);

    console.log("Added test alert polygon");

    // Add popup for test
    testLayer.bindPopup("<h3>Test Alert</h3><p>This is a test polygon</p>");

    return "Test polygon added";
}

//==============================================================================
// 3. INITIALIZATION FUNCTIONS
//==============================================================================

/**
 * Ensure Leaflet CSS is loaded
 */
function ensureLeafletCSS() {
    if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'resources/leaflet/leaflet.css'; // Use local path
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
            script.src = 'resources/leaflet/leaflet.js'; // Use local path
            script.async = true;

            script.onload = () => {
                // console.log('Local Leaflet script loaded successfully');
                resolve();
            };

            script.onerror = (e) => {
                console.error('Failed to load local Leaflet script:', e);
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
 * Create loading indicator for radar
 * @param {string} containerId - ID of container element
 */
function createLoadingIndicator(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'radar-loading';
    loadingIndicator.innerHTML = `
        <div class="radar-loading-spinner">
            <div></div><div></div><div></div>
        </div>
        <div class="radar-loading-text">Loading radar data...</div>
    `;
    container.appendChild(loadingIndicator);
}

//==============================================================================
// 4. MAP INITIALIZATION AND SETUP
//==============================================================================

/**
 * Initialize the map
 * @param {string} containerId - ID of container element
 */
function initializeMap(containerId) {
    // Get container element
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Map container '${containerId}' not found`);
        return;
    }

    // Create map div if it doesn't exist
    let mapDiv = container.querySelector('.radar-map');
    if (!mapDiv) {
        mapDiv = document.createElement('div');
        mapDiv.className = 'radar-map';
        container.appendChild(mapDiv);
    }

    // Set height for map
    mapDiv.style.height = '400px';

    try {
        // Initialize the map
        map = L.map(mapDiv, {
            attributionControl: true,
            zoomControl: true
        });

        // Add dark-themed map tiles (using CartoDB Dark Matter)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a> | Radar: <a href="https://rainviewer.com/">RainViewer</a>',
            subdomains: 'abcd',
            maxZoom: 19,
            opacity: 0.8 // Makes the dark theme lighter
        }).addTo(map);

        // Use current location coordinates from URL or default to a central US view
        const urlParams = new URLSearchParams(window.location.search);
        const lat = parseFloat(urlParams.get('lat')) || 39.8283;
        const lon = parseFloat(urlParams.get('lon')) || -98.5795;

        // Add marker for current location
        currentLocationMarker = L.marker([lat, lon]).addTo(map);

        // Create a custom timestamp display control
        createTimestampControl();

        // Set flag that map is initialized
        mapInitialized = true;

        // Properly center the map - add a small delay to ensure the container is fully rendered
        setTimeout(() => {
            // Make sure the map knows its container size
            map.invalidateSize();

            // Set view to current location with default zoom
            map.setView([lat, lon], DEFAULT_MAP_ZOOM);

            // Ensure the marker is centered
            map.panTo([lat, lon]);
        }, 100);

        // Add window resize handler to ensure map stays properly sized
        window.addEventListener('resize', () => {
            if (map) {
                map.invalidateSize();

                // Re-center on marker if it exists
                if (currentLocationMarker) {
                    const position = currentLocationMarker.getLatLng();
                    map.setView(position, map.getZoom());
                }
            }
        });

        // Setup the alert preservation system
        setupAlertPreservation();

    } catch (error) {
        console.error('Error initializing map:', error);
        showRadarError(containerId, 'Error initializing map. Please try again later.');
    }

    // Hide loading indicator
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

//==============================================================================
// 5. UI CONTROLS AND ELEMENTS
//==============================================================================

/**
 * Create a custom control for displaying the current timestamp
 */
function createTimestampControl() {
    if (!map) return;

    // Create a timestamp display element
    timestampDisplay = document.createElement('div');
    timestampDisplay.className = 'radar-timestamp-display';
    timestampDisplay.innerHTML = 'Loading...';

    // Determine best position based on screen size
    const position = window.innerWidth <= 768 ? 'topright' : 'bottomleft';

    // Create a custom Leaflet control class
    timestampControl = L.Control.extend({
        options: {
            position: position
        },

        onAdd: function (map) {
            return timestampDisplay;
        }
    });

    // Create and add an instance of the control to the map
    timestampControlInstance = new timestampControl();
    timestampControlInstance.addTo(map);

    // Add resize listener to reposition control if needed
    window.addEventListener('resize', repositionTimestampControl);
}

/**
 * Reposition the timestamp control based on screen size
 * This handles cases where the user rotates their device or resizes the window
 */
function repositionTimestampControl() {
    if (!map || !timestampDisplay || !timestampControlInstance) return;

    // Only needed if we're crossing the mobile breakpoint
    const shouldBeTopRight = window.innerWidth <= 768;
    const isCurrentlyTopRight = timestampDisplay.parentElement.classList.contains('leaflet-top') &&
        timestampDisplay.parentElement.classList.contains('leaflet-right');

    // If position needs to change
    if (shouldBeTopRight !== isCurrentlyTopRight) {
        try {
            // Remove existing control instance
            map.removeControl(timestampControlInstance);

            // Recreate with new position
            const position = shouldBeTopRight ? 'topright' : 'bottomleft';

            // Create a new control class with new position
            timestampControl = L.Control.extend({
                options: {
                    position: position
                },

                onAdd: function (map) {
                    return timestampDisplay;
                }
            });

            // Create and store new instance
            timestampControlInstance = new timestampControl();
            timestampControlInstance.addTo(map);
        } catch (error) {
            console.error('Error repositioning timestamp control:', error);
            // Fallback: if error occurs, make sure we at least display timestamp somewhere
            if (!timestampDisplay.parentElement) {
                // If display element is detached, create a new control
                timestampControlInstance = new timestampControl();
                timestampControlInstance.addTo(map);
            }
        }
    }
}

/**
 * Create radar control elements
 * @param {string} containerId - ID of container element
 */
function createRadarControls(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Create controls container with flex layout
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'radar-controls';

    // Create inner container for play button and timeline
    const timelineWrapper = document.createElement('div');
    timelineWrapper.className = 'radar-timeline-wrapper';

    // Create play/pause button
    playPauseButton = document.createElement('button');
    playPauseButton.className = 'radar-play-pause';
    playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
    playPauseButton.setAttribute('aria-label', 'Play radar animation');
    playPauseButton.addEventListener('click', toggleAnimation);

    // Create timeline container
    timelineContainer = document.createElement('div');
    timelineContainer.className = 'radar-timeline';

    // Add elements to the wrapper with proper order
    timelineWrapper.appendChild(playPauseButton);

    // Create a container for the timeline and timestamps
    const timelineControlsContainer = document.createElement('div');
    timelineControlsContainer.className = 'radar-timeline-controls';

    // Create timestamp row that will go above the timeline
    const timestampsRow = document.createElement('div');
    timestampsRow.className = 'radar-timestamps-row';

    // Add timeline components to their container
    timelineControlsContainer.appendChild(timestampsRow);
    timelineControlsContainer.appendChild(timelineContainer);

    // Add the timeline controls to the wrapper
    timelineWrapper.appendChild(timelineControlsContainer);

    // Add the wrapper to the main container
    controlsContainer.appendChild(timelineWrapper);
    container.appendChild(controlsContainer);

    // Add error message container
    const errorContainer = document.createElement('div');
    errorContainer.className = 'radar-error';
    errorContainer.id = 'radar-error-message';
    errorContainer.style.display = 'none';
    container.appendChild(errorContainer);
}

/**
 * Update the timestamp display with the current frame time
 * @param {Date} timestamp - Timestamp of the current frame
 */
function updateTimestampDisplay(timestamp) {
    if (!timestampDisplay) return;

    try {
        // Format the date and time
        const timeString = timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        const dateString = timestamp.toLocaleDateString([], {
            month: 'short',
            day: 'numeric'
        });

        // Check if we're on mobile
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // More compact format for mobile
            timestampDisplay.innerHTML = `<strong>${timeString}</strong> <span class="date-display">${dateString}</span>`;
        } else {
            // Normal format for desktop
            timestampDisplay.innerHTML = `<strong>${timeString}</strong><br>${dateString}`;
        }
    } catch (error) {
        console.error('Error updating timestamp display:', error);
        timestampDisplay.innerHTML = 'Time data unavailable';
    }
}

/**
 * Show error message for radar view
 * @param {string} containerId - ID of container element
 * @param {string} message - Error message to display
 */
function showRadarError(containerId, message) {
    const errorElement = document.getElementById('radar-error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    // Hide loading indicator if it exists
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

//==============================================================================
// 6. RADAR DATA FETCHING AND PROCESSING
//==============================================================================

/**
 * Fetch radar data from RainViewer API
 */
function fetchRadarData() {
    return new Promise((resolve, reject) => {
        if (!mapInitialized) {
            console.error('Map not initialized. Cannot fetch radar data.');
            reject(new Error('Map not initialized'));
            return;
        }

        // Show loading indicator
        if (loadingIndicator) {
            loadingIndicator.style.display = 'flex';
        }

        // Add a timestamp to prevent caching
        const urlWithTimestamp = `${RAINVIEWER_API_URL}?t=${Date.now()}`;

        fetch(urlWithTimestamp)
            .then(response => {
                if (!response.ok) {
                    console.error(`API response not OK: ${response.status} ${response.statusText}`);
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (!data || !data.radar || !data.radar.past || data.radar.past.length === 0) {
                    console.error('Invalid or empty radar data format:', data);
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

                    // Start preloading all frames
                    preloadRadarFrames().then(() => {
                        // After preloading, display the latest frame
                        showFrame(animationPosition);

                        // Make sure play button shows correct state
                        if (playPauseButton) {
                            playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
                            playPauseButton.setAttribute('aria-label', 'Play radar animation');
                        }
                        isPlaying = false;
                    });
                } else {
                    console.warn('No radar frames available after processing');
                    showRadarError('radar-view', 'No radar data available for this location.');
                }

                // Resolve the promise
                resolve();
            })
            .catch(error => {
                console.error('Error fetching radar data:', error);
                showRadarError('radar-view', 'Failed to load radar data. Please try again later.');

                // Hide loading indicator
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }

                // Reject the promise
                reject(error);
            });
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
    if (!timelineContainer) return;

    // Remove any existing timeline content
    timelineContainer.innerHTML = '';

    // Find the timestamp row that was created in createRadarControls
    const timestampsRow = document.querySelector('.radar-timestamps-row');
    if (timestampsRow) {
        timestampsRow.innerHTML = '';
    }

    // Create timestamps for frames with better spacing
    if (radarFrames.length > 0) {
        // Determine how many timestamps to show based on screen width
        const containerWidth = timelineContainer.offsetWidth;
        // Assume each timestamp needs ~60px of space minimum to avoid overlap
        const minSpaceBetweenTimestamps = 60;
        const maxTimestamps = Math.max(3, Math.floor(containerWidth / minSpaceBetweenTimestamps));

        // Calculate step size - ensure we show at least first, last, and some middle timestamps
        let step = Math.ceil(radarFrames.length / maxTimestamps);

        // At minimum, we want timestamps at the beginning, middle and end
        // For very short frame sequences, just show all frames
        if (radarFrames.length <= 6) {
            step = 1;
        } else if (radarFrames.length <= 20) {
            step = 5; // Show every other frame
        }

        // Create timestamps at calculated intervals 
        for (let i = 0; i < radarFrames.length; i += step) {
            // Skip some middle frames if we have too many
            if (i !== 0 && i !== radarFrames.length - 1 && i % (step * 2) !== 0 && radarFrames.length > 12) {
                continue;
            }

            const timeLabel = document.createElement('div');
            timeLabel.className = 'radar-timestamp';

            // Format the time
            const timeString = radarFrames[i].timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            timeLabel.textContent = timeString;

            // Calculate position as percentage
            const position = (i / (radarFrames.length - 1)) * 100;

            // Apply specific positioning rules to prevent edge overflow
            if (i === 0) {
                // First timestamp
                timeLabel.style.left = '0%';
                timeLabel.style.transform = 'none'; // Override the default transform
            } else if (i === radarFrames.length - 1) {
                // Last timestamp
                timeLabel.style.left = '100%';
                timeLabel.style.transform = 'translateX(-100%)'; // Align right edge
            } else {
                // Middle timestamps use standard positioning
                timeLabel.style.left = `${position}%`;
            }

            if (timestampsRow) {
                timestampsRow.appendChild(timeLabel);
            }
        }

        // Always ensure the last timestamp is shown
        if (step > 1 && radarFrames.length > 1) {
            const lastIndex = radarFrames.length - 1;

            // Check if the last timestamp wasn't already added
            if (lastIndex % step !== 0) {
                const lastTimeLabel = document.createElement('div');
                lastTimeLabel.className = 'radar-timestamp';

                const timeString = radarFrames[lastIndex].timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                lastTimeLabel.textContent = timeString;
                lastTimeLabel.style.left = '100%';
                lastTimeLabel.style.transform = 'translateX(-100%)'; // Align right edge

                if (timestampsRow) {
                    timestampsRow.appendChild(lastTimeLabel);
                }
            }
        }
    }

    // Create the progress bar with evenly spaced markers
    radarFrames.forEach((frame, index) => {
        const marker = document.createElement('div');
        marker.className = 'radar-frame-marker';
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

        // Make marker clickable with fix for last frame issue
        marker.addEventListener('click', () => {
            stopAnimation();

            // Only change frames if we're not already at this position
            // This fixes the issue with the radar disappearing when clicking on the timeline
            if (animationPosition !== index) {
                animationPosition = index;
                showFrame(index);
            }

            updateTimelineSelection();
        });

        timelineContainer.appendChild(marker);
    });

    // Create current position indicator that will move along the timeline
    const positionIndicator = document.createElement('div');
    positionIndicator.id = 'radar-position-indicator';
    positionIndicator.className = 'radar-position-indicator';
    timelineContainer.appendChild(positionIndicator);

    // Default to showing the latest frame (at initial load)
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
    if (!timelineContainer) return;

    // Update the marker selection
    const markers = timelineContainer.querySelectorAll('.radar-frame-marker');
    if (!markers.length) return;

    markers.forEach((marker, index) => {
        if (index === animationPosition) {
            marker.classList.add('active');
        } else {
            marker.classList.remove('active');
        }
    });

    // Update position indicator
    const positionIndicator = document.getElementById('radar-position-indicator');
    if (positionIndicator && radarFrames.length > 1) {
        // Calculate position percentage
        const position = (animationPosition / (radarFrames.length - 1)) * 100;
        positionIndicator.style.left = `${position}%`;

        // Make sure it's visible
        positionIndicator.style.display = 'block';
    }
}

//==============================================================================
// 7. FRAME PRELOADING AND DISPLAY
//==============================================================================

/**
 * Preload radar frames for smoother animation
 * @returns {Promise} - Resolves when preloading is complete
 */
function preloadRadarFrames() {
    if (!map || radarFrames.length === 0) {
        return Promise.resolve();
    }

    // Create a visual indicator of preload progress
    updatePreloadingUI(true);

    // Store preloaded layers
    const preloadedLayers = [];
    let loadedCount = 0;

    // Get current center and zoom for preloading the visible area
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    // Calculate the visible tile coordinates
    const centerPoint = map.project(currentCenter, currentZoom).divideBy(256).floor();
    const bounds = map.getBounds();
    const northEast = map.project(bounds.getNorthEast(), currentZoom).divideBy(256).floor();
    const southWest = map.project(bounds.getSouthWest(), currentZoom).divideBy(256).floor();

    // Define the area of tiles to preload (the visible area + margin)
    const tileRange = {
        min: {
            x: Math.max(0, southWest.x - 1),
            y: Math.max(0, northEast.y - 1)
        },
        max: {
            x: southWest.x + 1,
            y: northEast.y + 1
        }
    };

    // Create a promise for each frame's preloading
    const preloadPromises = radarFrames.map((frame, index) => {
        return new Promise((resolve) => {
            // Create the tile URL pattern for this frame
            const tileUrl = `https://tilecache.rainviewer.com/v2/radar/${frame.time}/512/{z}/{x}/{y}/${DEFAULT_COLOR_SCHEME}/${SMOOTHING}_${SNOW_VIEW}.png`;

            // Create a tile layer but don't add it to the map yet
            const layer = L.tileLayer(tileUrl, {
                opacity: 0,  // Invisible during preload
                zIndex: 1,   // Lower z-index
                tileSize: 256
            });

            // Store for later use
            preloadedLayers[index] = layer;

            // Create an array to hold the tile-loading promises
            const tilePromises = [];

            // Manually create Image objects for critical tiles
            for (let x = tileRange.min.x; x <= tileRange.max.x; x++) {
                for (let y = tileRange.min.y; y <= tileRange.max.y; y++) {
                    const tilePromise = new Promise((tileResolve) => {
                        const img = new Image();
                        img.onload = () => {
                            tileResolve();
                        };
                        img.onerror = () => {
                            tileResolve(); // Resolve anyway to continue
                        };
                        // Generate the actual tile URL
                        const url = tileUrl
                            .replace('{z}', currentZoom)
                            .replace('{x}', x)
                            .replace('{y}', y);
                        img.src = url;
                    });
                    tilePromises.push(tilePromise);
                }
            }

            // When critical tiles are loaded, update progress and resolve
            Promise.all(tilePromises).then(() => {
                loadedCount++;
                updatePreloadProgress(loadedCount, radarFrames.length);
                resolve(layer);
            });

            // Set a timeout to avoid waiting too long for any single frame
            setTimeout(() => {
                if (!layer._loaded) {
                    loadedCount++;
                    updatePreloadProgress(loadedCount, radarFrames.length);
                    resolve(layer);
                }
            }, 3000); // 3 second timeout per frame
        });
    });

    // Return a promise that resolves when all frames are preloaded (or timeout)
    return Promise.all(preloadPromises)
        .then(() => {
            // Store preloaded layers for later use
            window.preloadedRadarLayers = preloadedLayers;
            updatePreloadingUI(false);
            return preloadedLayers;
        })
        .catch(error => {
            console.error('Error preloading radar frames:', error);
            updatePreloadingUI(false);
            return [];
        });
}

/**
 * Update the UI to show preloading progress
 * @param {boolean} isLoading - Whether the radar is currently preloading
 */
function updatePreloadingUI(isLoading) {
    const playButton = document.querySelector('.radar-play-pause');
    if (!playButton) return;

    if (isLoading) {
        playButton.classList.add('radar-loading');
        playButton.setAttribute('disabled', 'disabled');
        playButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        playButton.setAttribute('aria-label', 'Loading radar data...');
    } else {
        playButton.classList.remove('radar-loading');
        playButton.removeAttribute('disabled');
        playButton.innerHTML = '<i class="fas fa-play"></i>';
        playButton.setAttribute('aria-label', 'Play radar animation');
    }
}

/**
 * Update the preload progress indicator
 * @param {number} loaded - Number of frames loaded
 * @param {number} total - Total number of frames
 */
function updatePreloadProgress(loaded, total) {
    // We could update a progress bar here if we added one
    // For now, we'll update the play button text
    const playButton = document.querySelector('.radar-play-pause');
    if (!playButton) return;

    const percent = Math.floor((loaded / total) * 100);
    playButton.setAttribute('aria-label', `Loading: ${percent}%`);
}

/**
 * Show a specific radar frame with smooth transition
 * @param {number} index - Index of frame to show
 */
function showFrame(index) {
    if (!map || !radarFrames.length || index >= radarFrames.length) {
        return;
    }

    // Get the frame
    const frame = radarFrames[index];

    // Store the old overlay for removal later
    const oldOverlay = currentOverlay;

    // Check if we have preloaded layers
    if (window.preloadedRadarLayers && window.preloadedRadarLayers[index]) {
        // Use preloaded layer
        const newOverlay = window.preloadedRadarLayers[index];
        newOverlay.setOpacity(DEFAULT_OPACITY);
        newOverlay.setZIndex(11);

        if (!newOverlay._map) {
            newOverlay.addTo(map);
        }

        // Update current overlay reference
        currentOverlay = newOverlay;
    } else {
        // Fallback to creating new layer if preloaded layer isn't available
        const tileUrl = `https://tilecache.rainviewer.com/v2/radar/${frame.time}/512/{z}/{x}/{y}/${DEFAULT_COLOR_SCHEME}/${SMOOTHING}_${SNOW_VIEW}.png`;

        // Create a new tile layer and add it to the map
        const newOverlay = L.tileLayer(tileUrl, {
            opacity: DEFAULT_OPACITY,
            zIndex: 11, // Higher z-index to ensure it appears above the old layer
            tileSize: 256,
        });

        // Add the new layer to the map
        newOverlay.addTo(map);

        // Update current overlay reference
        currentOverlay = newOverlay;
    }

    // Remove the old overlay only after the new one is added (with a small delay)
    if (oldOverlay) {
        setTimeout(() => {
            map.removeLayer(oldOverlay);
        }, 90);
    }

    // Update the timestamp display
    updateTimestampDisplay(frame.timestamp);

    // Update timeline selection
    updateTimelineSelection();
}

//==============================================================================
// 8. ANIMATION CONTROL
//==============================================================================

/**
 * Start the radar animation
 */
function startAnimation() {
    // Stop any existing animation
    stopAnimation();

    // If we automatically jumped to the latest frame on stop, we need to
    // set the position back to the beginning for a fresh animation
    if (RETURN_TO_LATEST_ON_STOP) {
        // Start from the beginning of the animation if we're at the end
        if (animationPosition === radarFrames.length - 1) {
            animationPosition = 0;
            // Show the first frame immediately before starting the interval
            showFrame(animationPosition);
        }
    }

    // Update button state
    if (playPauseButton) {
        playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
        playPauseButton.setAttribute('aria-label', 'Pause radar animation');
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
 * Stop the radar animation
 * Optionally returns to the latest frame based on configuration
 */
function stopAnimation() {
    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
    }

    // Update button state
    if (playPauseButton) {
        playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
        playPauseButton.setAttribute('aria-label', 'Play radar animation');
    }

    isPlaying = false;

    // If configured to return to latest frame when stopping
    if (RETURN_TO_LATEST_ON_STOP && radarFrames.length > 0) {
        // Only change and show frame if we're not already on the latest frame
        // This prevents the disappearing radar issue when already on the last frame
        if (animationPosition !== radarFrames.length - 1) {
            // Set position to the latest frame (last in the array)
            animationPosition = radarFrames.length - 1;

            // Show the latest frame
            showFrame(animationPosition);
        }
    }
}

/**
 * Toggle the animation play/pause state
 */
function toggleAnimation() {
    if (isPlaying) {
        stopAnimation(); // This will now handle returning to latest frame if configured
    } else {
        startAnimation();
    }
}

//==============================================================================
// 9. MAP ALERT POLYGONS
//==============================================================================

/**
 * Clear all alert polygon layers from the map
 */
function clearAlertLayers() {
    alertLayers.forEach(layer => {
        if (map) map.removeLayer(layer);
    });
    alertLayers = [];
}

/**
 * Get color for alert severity
 */
function getSeverityColor(severity) {
    switch (severity) {
        case 'extreme': return '#d32f2f';
        case 'severe': return '#f44336';
        case 'moderate': return '#ff9800';
        case 'minor': return '#ffb74d';
        default: return '#757575';
    }
}

/**
 * Add CSS animation styles for extreme alerts if not already present
 */
function addExtremeAlertAnimationCSS() {
    // Check if we've already added the styles
    if (document.getElementById('extreme-alert-animation-css')) return;

    // Create a style element for our animations
    const style = document.createElement('style');
    style.id = 'extreme-alert-animation-css';

    // Define the animations
    style.textContent = `
        /* Pulsing animation for extreme alert polygons */
        @keyframes extreme-alert-pulse {
            0%, 100% { 
                stroke-opacity: 0.8;
                fill-opacity: 0.2;
                stroke-width: 3;
            }
            50% { 
                stroke-opacity: 1;
                fill-opacity: 0.4;
                stroke-width: 5;
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
        
        /* Apply a glow effect to extreme alert polygons */
        .extreme-alert-polygon path {
            filter: drop-shadow(0 0 6px #d32f2f);
        }
    `;

    // Add style to document head
    document.head.appendChild(style);
}

/**
 * Show a loading indicator for map data operations
 * @param {string} message - Optional message to display
 */
function showMapLoadingIndicator(message = 'Loading...') {
    // Check if we already have a loading indicator
    let loadingElement = document.getElementById('map-data-loading');

    if (!loadingElement) {
        // Create a loading indicator if it doesn't exist
        loadingElement = document.createElement('div');
        loadingElement.id = 'map-data-loading';
        loadingElement.className = 'map-data-loading';
        loadingElement.innerHTML = `
            <div class="map-loading-spinner">
                <div></div><div></div><div></div>
            </div>
            <div class="map-loading-text">${message}</div>
        `;

        // Add styles if needed
        const style = document.createElement('style');
        style.textContent = `
            .map-data-loading {
                position: absolute;
                top: 10px;
                right: 10px;
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                z-index: 1000;
                display: flex;
                align-items: center;
                font-size: 12px;
                pointer-events: none;
            }
            .map-loading-spinner {
                display: flex;
                margin-right: 8px;
            }
            .map-loading-spinner div {
                width: 6px;
                height: 6px;
                background-color: white;
                border-radius: 50%;
                margin: 0 2px;
                animation: map-loading-bounce 1.4s infinite ease-in-out both;
            }
            .map-loading-spinner div:nth-child(1) {
                animation-delay: -0.32s;
            }
            .map-loading-spinner div:nth-child(2) {
                animation-delay: -0.16s;
            }
            @keyframes map-loading-bounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);

        // Add to the map container
        const mapContainer = map.getContainer();
        mapContainer.appendChild(loadingElement);
    } else {
        // Update message if the indicator already exists
        const textElement = loadingElement.querySelector('.map-loading-text');
        if (textElement) {
            textElement.textContent = message;
        }

        // Make sure it's visible
        loadingElement.style.display = 'flex';
    }
}

/**
 * Hide the map loading indicator
 */
function hideMapLoadingIndicator() {
    const loadingElement = document.getElementById('map-data-loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
}

/**
 * Show an error message on the map
 * @param {string} message - Error message to display
 */
function showMapErrorMessage(message) {
    // Check if we already have an error display
    let errorElement = document.getElementById('map-data-error');

    if (!errorElement) {
        // Create an error message element
        errorElement = document.createElement('div');
        errorElement.id = 'map-data-error';
        errorElement.className = 'map-data-error';

        // Add styles if needed
        const style = document.createElement('style');
        style.textContent = `
            .map-data-error {
                position: absolute;
                top: 10px;
                right: 10px;
                background-color: rgba(244, 67, 54, 0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                z-index: 1000;
                font-size: 12px;
                pointer-events: none;
                max-width: 80%;
            }
        `;
        document.head.appendChild(style);

        // Add to the map container
        const mapContainer = map.getContainer();
        mapContainer.appendChild(errorElement);
    }

    // Set the message and make visible
    errorElement.textContent = message;
    errorElement.style.display = 'block';

    // Auto-hide after a delay
    setTimeout(() => {
        hideMapErrorMessage();
    }, 5000);
}

/**
 * Hide the map error message
 */
function hideMapErrorMessage() {
    const errorElement = document.getElementById('map-data-error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

/**
 * Check if the map is currently visible in the viewport
 * @returns {boolean} - True if the map is visible
 */
function isMapVisible() {
    if (!map) return false;

    const mapElement = map.getContainer();
    if (!mapElement) return false;

    const rect = mapElement.getBoundingClientRect();
    return (
        rect.top < window.innerHeight &&
        rect.bottom > 0
    );
}

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - The function to debounce
 * @param {number} wait - Timeout in milliseconds
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
 * Monitor for layout changes and keep alert polygons visible
 * This function should be added to the map initialization
 */
function setupAlertPreservation() {
    if (!map || !mapInitialized) {
        console.warn('Cannot setup alert preservation - map not initialized');
        return;
    }
    
    console.log('Setting up alert polygon preservation system');
    
    // Track the map's size to detect container changes
    let lastMapWidth = map.getSize().x;
    let lastMapHeight = map.getSize().y;
    
    // Flag to track if we need to restore alerts
    let needToRestoreAlerts = false;
    
    // Track when alerts were last displayed (used for restoration timing)
    let lastAlertDisplayTime = Date.now();
    
    // Add a ResizeObserver to monitor the map container for size changes
    const mapContainer = map.getContainer();
    const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            // When map container size changes
            if (entry.target === mapContainer) {
                // Check if the map size has actually changed
                const currentSize = map.getSize();
                if (currentSize.x !== lastMapWidth || currentSize.y !== lastMapHeight) {
                    console.log('Map container size changed, invalidating map');
                    
                    // Flag that we need to restore alerts
                    needToRestoreAlerts = true;
                    
                    // Call invalidateSize to ensure Leaflet adjusts
                    map.invalidateSize();
                    
                    // Update stored sizes
                    lastMapWidth = currentSize.x;
                    lastMapHeight = currentSize.y;
                    
                    // Schedule alert restoration
                    setTimeout(() => {
                        if (needToRestoreAlerts && lastSuccessfulAlerts.length > 0) {
                            console.log('Restoring alert polygons after container resize');
                            updateAlertPolygons(lastSuccessfulAlerts);
                            needToRestoreAlerts = false;
                            lastAlertDisplayTime = Date.now();
                        }
                    }, 300);
                }
            }
        }
    });
    
    // Start observing the map container
    resizeObserver.observe(mapContainer);
    
    // Listen for weather data loading events by monitoring DOM changes
    // This specifically targets the weather data container
    const weatherDataContainer = document.getElementById('weather-data');
    if (weatherDataContainer) {
        const weatherObserver = new MutationObserver(mutations => {
            // Check if any mutations affect the display style
            const displayChanged = mutations.some(mutation => 
                mutation.type === 'attributes' && 
                mutation.attributeName === 'style' &&
                weatherDataContainer.style.display !== 'none');
            
            // If display changed from none to block, weather data loaded
            if (displayChanged && weatherDataContainer.style.display !== 'none') {
                console.log('Weather data container became visible, checking alerts');
                
                // Only restore if alerts were shown recently
                const timeSinceLastDisplay = Date.now() - lastAlertDisplayTime;
                if (timeSinceLastDisplay < 60000) { // Within the last minute
                    setTimeout(() => {
                        // Check if alerts are still visible after the layout settles
                        const alertCount = document.querySelectorAll('.leaflet-overlay-pane path').length;
                        if (lastSuccessfulAlerts.length > 0 && alertCount === 0) {
                            console.log('Alerts disappeared after weather data load, restoring');
                            updateAlertPolygons(lastSuccessfulAlerts);
                            lastAlertDisplayTime = Date.now();
                        }
                    }, 500); // Wait for layout to settle
                }
            }
        });
        
        // Observe changes to the weather data container style attribute
        weatherObserver.observe(weatherDataContainer, { 
            attributes: true, 
            attributeFilter: ['style'] 
        });
    }
    
    // Also monitor for visibility changes of the map
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && map) {
            // When tab becomes visible again, check if we need to restore alerts
            setTimeout(() => {
                const alertCount = document.querySelectorAll('.leaflet-overlay-pane path').length;
                if (lastSuccessfulAlerts.length > 0 && alertCount === 0) {
                    console.log('Alerts disappeared after visibility change, restoring');
                    updateAlertPolygons(lastSuccessfulAlerts);
                    lastAlertDisplayTime = Date.now();
                }
            }, 500);
        }
    });
    
    // Clean up function
    return function cleanupAlertPreservation() {
        resizeObserver.disconnect();
        if (weatherDataContainer) {
            weatherObserver.disconnect();
        }
    };
}